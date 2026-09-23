import { describe, expect, it } from "vitest";
import { POSITION_NAMES } from "../src/engine/catalog";
import { seededRng } from "../src/engine/rng";
import { resolveExchange } from "../src/engine/rules";
import type { ActionId, MatchState, Side } from "../src/engine/types";
import { buildIndicators, buildSequence } from "../src/session/sequence";
import { GameSession, type SessionOptions } from "../src/session/session";
import { TIMING } from "../src/session/timing";
import { VISUAL_MANIFEST, lookupVisual, resolveFrame } from "../src/visual/manifest";

/** Ручные часы: таймеры срабатывают только по advance(). */
function clock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    opts: {
      now: () => now,
      setTimer: (fn: () => void, ms: number) => {
        const id = ++seq;
        timers.set(id, { at: now + ms, fn });
        return id;
      },
      clearTimer: (id: unknown) => void timers.delete(id as number)
    } satisfies Partial<SessionOptions>,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    pending: () => timers.size
  };
}

const ALL = 60_000;

describe("сессия", () => {
  it("бот фиксирует выбор заранее, повторные чтения не меняют его", () => {
    const s = new GameSession({ rng: seededRng(1) });
    const pick = s.peekBotPickForTests();
    for (let i = 0; i < 20; i++) s.getSnapshot();
    expect(s.peekBotPickForTests()).toBe(pick);
    expect(s.botDecisions).toBe(1);
  });

  it("двойное нажатие не создаёт второй обмен", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, botScript: ["breathe", "breathe"] });
    expect(s.act("grip")).toBe(true);
    expect(s.act("grip")).toBe(false);
    expect(s.act("frame")).toBe(false);
    c.advance(ALL);
    const m = s.getSnapshot().match;
    expect(m.exchange).toBe(2);
    expect(m.history).toHaveLength(1);
    expect(m.fighters.player.grips).toBe(1);
  });

  it("проигрывает этапы по порядку и обновляет счёт только на итоге", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, botScript: ["breathe", "breathe"] });
    c.advance(0);
    s.act("grip");
    c.advance(TIMING.grip + TIMING.attempt + TIMING.grip + TIMING.response);
    s.act("grip");
    c.advance(ALL);
    s.act("pullGuard");
    const phases: string[] = [];
    const scores: number[] = [];
    const unsub = s.subscribe(() => {
      const v = s.getSnapshot();
      if (phases[phases.length - 1] !== v.phase) phases.push(v.phase);
      scores.push(v.match.fighters.player.grips);
    });
    expect(s.getSnapshot().match.position).toBe("standing");
    c.advance(ALL);
    unsub();
    expect(phases).toEqual(["playerAttempt", "botResponse", "result", "idle"]);
    expect(s.getSnapshot().match.position).toBe("guard");
    expect(s.getSnapshot().frame.key).toEqual({ position: "guard", top: "bot", phase: "base" });
  });

  it("реванш во время анимации: старые таймеры не трогают новую схватку", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, botScript: ["breathe"] });
    s.act("grip");
    c.advance(TIMING.grip + 10);
    s.restart();
    expect(c.pending()).toBe(0);
    c.advance(ALL);
    const v = s.getSnapshot();
    expect(v.round).toBe(1);
    expect(v.busy).toBe(false);
    expect(v.phase).toBe("idle");
    expect(v.match.exchange).toBe(1);
    expect(v.match.fighters.player).toEqual({ grips: 0, breath: 6, score: 0 });
    expect(v.indicators).toEqual({ player: [], bot: [] });
    expect(s.act("grip")).toBe(true);
  });

  it("пауза при уходе вкладки в фон и продолжение после возврата", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, botScript: ["breathe"] });
    s.act("grip");
    c.advance(100);
    s.setHidden(true);
    c.advance(ALL);
    expect(s.getSnapshot().phase).toBe("playerAttempt");
    s.setHidden(false);
    c.advance(ALL);
    expect(s.getSnapshot().phase).toBe("idle");
    expect(s.getSnapshot().match.exchange).toBe(2);
  });

  it("меню паузы и фон вкладки: показ продолжается, только когда обе причины сняты", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, botScript: ["breathe"] });
    s.act("grip");
    s.setPaused("menu", true);
    s.setHidden(true);
    s.setHidden(false);
    c.advance(ALL);
    expect(s.getSnapshot().phase).toBe("playerAttempt");
    s.setPaused("menu", false);
    c.advance(ALL);
    expect(s.getSnapshot().phase).toBe("idle");
  });

  it("окно результата открывается только после кадра сдачи", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, botScript: ["grip", "breathe", "breathe", "breathe", "turn"] });
    for (const a of ["grip", "pullGuard", "grip", "triangle"] as ActionId[]) {
      expect(s.act(a)).toBe(true);
      c.advance(ALL);
    }
    expect(s.getSnapshot().frame.key).toMatchObject({ technique: "triangle", phase: "locked", attacker: "player" });
    s.act("finish");
    c.advance(TIMING.grip);
    expect(s.getSnapshot().frame.key.phase).toBe("finish");
    c.advance(TIMING.attempt + TIMING.grip + TIMING.response);
    expect(s.getSnapshot().frame.key.phase).toBe("tap");
    expect(s.getSnapshot().showResult).toBe(false);
    c.advance(TIMING.endDelay);
    expect(s.getSnapshot().showResult).toBe(true);
    expect(s.getSnapshot().match.result).toEqual({ winner: "player", reason: "submission", technique: "triangle" });
  });

  it("reduced motion: та же последовательность этапов", () => {
    const c = clock();
    const s = new GameSession({ ...c.opts, reducedMotion: () => true, botScript: ["breathe"] });
    const phases: string[] = [];
    s.subscribe(() => {
      const p = s.getSnapshot().phase;
      if (phases[phases.length - 1] !== p) phases.push(p);
    });
    s.act("grip");
    c.advance(ALL);
    expect(phases).toEqual(["idle", "playerAttempt", "botResponse", "result", "idle"]);
    expect(s.timing.tween).toBe(0);
  });
});

function st(patch: Partial<MatchState> & { p?: number; b?: number }): MatchState {
  const { p = 0, b = 0, ...rest } = patch;
  return {
    position: "standing",
    top: null,
    fighters: { player: { grips: p, breath: 6, score: 0 }, bot: { grips: b, breath: 6, score: 0 } },
    exchange: 1,
    submission: null,
    result: null,
    history: [],
    ...rest
  };
}

describe("кадры и индикаторы из результата движка", () => {
  it("попытка ≠ успех: кадр попытки показывает приём, итог — новую позицию", () => {
    const before = st({ p: 1 });
    const r = resolveExchange(before, "takedown", "breathe");
    const seq = buildSequence(before, r);
    expect(seq.map((x) => x.stage)).toEqual(["playerAttempt", "botResponse", "result"]);
    expect(seq[0].frame.key).toMatchObject({ technique: "takedown", phase: "attempt", attacker: "player", position: "standing" });
    expect(seq[0].caption.tag).toBe("Попытка");
    expect(seq[2].frame.key).toEqual({ position: "guard", top: "player", phase: "base" });
    expect(seq[2].caption.tag).toBe("Успешно");
  });

  it("блок рамкой: причина и принадлежность индикаторов", () => {
    const before = st({ p: 1 });
    const r = resolveExchange(before, "takedown", "frame");
    const ind = buildIndicators(r);
    expect(ind.player.map((i) => i.text)).toEqual(["Заблокировано: рамка", "−1 захват", "−2 дыхания"]);
    expect(ind.bot.map((i) => i.text)).toEqual(["Рамка", "Рамка сработала"]);
    const seq = buildSequence(before, r);
    expect(seq[1].frame.basics).toEqual([{ side: "bot", action: "frame" }]);
    expect(seq[2].frame.key).toEqual({ position: "standing", top: null, phase: "base" });
  });

  it("равные захваты: обе атаки сорвались с причиной", () => {
    const r = resolveExchange(st({ p: 1, b: 1 }), "takedown", "pullGuard");
    const ind = buildIndicators(r);
    expect(ind.player[0].text).toBe("Атака сорвалась: равные захваты");
    expect(ind.bot[0].text).toBe("Атака сорвалась: равные захваты");
  });

  it("проход гарда: индикатор «Проход +3» у правильного бойца", () => {
    const r = resolveExchange(st({ position: "halfGuard", top: "bot", b: 2 }), "grip", "passGuard");
    expect(buildIndicators(r).bot[0].text).toBe("Проход +3");
    expect(buildIndicators(r).player[0].text).toBe("Взять захват");
  });

  it("треугольник: попытка → фиксация → дожим → сдача — разные кадры, не обычный гард", () => {
    const before = st({ position: "guard", top: "bot", p: 2 });
    const r1 = resolveExchange(before, "triangle", "breathe");
    const s1 = buildSequence(before, r1);
    const r2 = resolveExchange(r1.nextState, "finish", "turn");
    const s2 = buildSequence(r1.nextState, r2);
    const poses = [s1[0], s1[2], s2[0], s2[2]].map((step) => resolveFrame(step.frame).poseId);
    expect(poses).toEqual(["triangle.attempt", "triangle.locked", "triangle.finish", "triangle.tap"]);
    expect(poses).not.toContain("guard");
    expect(resolveFrame(s2[2].frame).marks.map((m) => m.kind)).toContain("tap");
  });

  it("верная защита от смены приёма показывает поворот и возвращает базовую позицию", () => {
    const locked = resolveExchange(st({ position: "mount", top: "bot", b: 2 }), "grip", "armbar").nextState;
    const r = resolveExchange(locked, "turn", "switch");
    const seq = buildSequence(locked, r);
    expect(resolveFrame(seq[0].frame).poseId).toBe("armbar.turn");
    expect(resolveFrame(seq[1].frame).poseId).toBe("armbar.switch");
    expect(resolveFrame(seq[2].frame).poseId).toBe("mount");
    expect(buildIndicators(r).player[0].text).toBe("Защита сработала");
  });
});

describe("манифест визуализации", () => {
  const sides: Side[] = ["player", "bot"];
  it("кадр есть для каждой позиции, контроля, приёма и фазы", () => {
    for (const e of VISUAL_MANIFEST) expect(() => resolveFrame({ key: { position: e.position, top: e.controller, technique: e.technique ?? undefined, attacker: e.attacker ?? undefined, phase: e.phase }, basics: [] })).not.toThrow();
    // 1 стойка + 5×2 базовых + 14×2 попыток + 4×2×7 фаз сабмишнов
    expect(VISUAL_MANIFEST).toHaveLength(1 + 10 + 28 + 56);
  });

  it("чёрное ги (игрок) — верхний, когда игрок контролирует, и нижний — когда бот", () => {
    for (const position of Object.keys(POSITION_NAMES).filter((p) => p !== "standing")) {
      for (const top of sides) {
        const e = lookupVisual({ position: position as MatchState["position"], top, phase: "base" });
        expect(e.roles.A).toBe(top);
        const f = resolveFrame({ key: { position: position as MatchState["position"], top, phase: "base" }, basics: [] });
        // Поза с разными ролями — не просто отражение: верхний боец (роль A) выше по сцене.
        expect(Math.min(f.A.s[1], f.A.hd[1])).toBeLessThan(f.B.s[1] + 1);
      }
    }
  });

  it("игрок остаётся слева, где это возможно", () => {
    const f = resolveFrame({ key: { position: "guard", top: "player", phase: "base" }, basics: [] });
    const playerRole = f.roles.A === "player" ? "A" : "B";
    const botRole = playerRole === "A" ? "B" : "A";
    expect(f[playerRole].h[0]).toBeLessThan(f[botRole].h[0]);
  });
});
