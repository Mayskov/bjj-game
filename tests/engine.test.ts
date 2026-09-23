import { describe, expect, it } from "vitest";
import { botWeights, chooseBotAction } from "../src/engine/bot";
import { seededRng } from "../src/engine/rng";
import { createMatch, legalActions, resolveExchange, IllegalActionError } from "../src/engine/rules";
import type { MatchState, Side } from "../src/engine/types";

function withState(patch: Partial<MatchState> & { player?: Partial<MatchState["fighters"]["player"]>; bot?: Partial<MatchState["fighters"]["bot"]> }): MatchState {
  const base = createMatch();
  const { player, bot, ...rest } = patch;
  return {
    ...base,
    ...rest,
    fighters: {
      player: { ...base.fighters.player, ...player },
      bot: { ...base.fighters.bot, ...bot }
    }
  };
}

const f = (s: MatchState, side: Side) => s.fighters[side];

describe("начало", () => {
  it("стойка, 0:0, 0 захватов, 6 дыхания, обмен 1", () => {
    const s = createMatch();
    expect(s.position).toBe("standing");
    expect(s.top).toBeNull();
    expect(s.exchange).toBe(1);
    expect(s.submission).toBeNull();
    for (const side of ["player", "bot"] as Side[]) {
      expect(f(s, side)).toEqual({ grips: 0, breath: 6, score: 0 });
    }
    expect(legalActions(s, "player")).toEqual(["grip", "frame", "neck", "breathe"]);
  });
});

describe("базовые действия", () => {
  it("захват открывает технику стойки", () => {
    const { nextState: s } = resolveExchange(createMatch(), "grip", "breathe");
    expect(f(s, "player")).toMatchObject({ grips: 1, breath: 6 });
    expect(legalActions(s, "player")).toContain("takedown");
    expect(legalActions(s, "player")).toContain("pullGuard");
    expect(s.exchange).toBe(2);
    expect(s.position).toBe("standing");
  });

  it("ресурсы не выше максимума", () => {
    const s = withState({ player: { grips: 3, breath: 5 } });
    const { nextState } = resolveExchange(s, "grip", "breathe");
    expect(f(nextState, "player")).toMatchObject({ grips: 3, breath: 6 });
    const r2 = resolveExchange(withState({ bot: { breath: 5 } }), "frame", "breathe");
    expect(f(r2.nextState, "bot").breath).toBe(6);
  });
});

describe("переходы", () => {
  it("затянуть в гард — игрок снизу, 0 очков, захваты 1/0", () => {
    const s = withState({ player: { grips: 1 }, bot: { grips: 2 } });
    const r = resolveExchange(s, "pullGuard", "grip");
    const n = r.nextState;
    expect(n.position).toBe("guard");
    expect(n.top).toBe("bot");
    expect(f(n, "player")).toEqual({ grips: 1, breath: 5, score: 0 });
    expect(f(n, "bot").grips).toBe(0);
    expect(r.report.player.outcome).toBe("success");
  });

  it("проход в ноги — атакующий сверху, +2", () => {
    const s = withState({ bot: { grips: 1 } });
    const n = resolveExchange(s, "breathe", "takedown").nextState;
    expect(n.position).toBe("guard");
    expect(n.top).toBe("bot");
    expect(f(n, "bot")).toEqual({ grips: 1, breath: 5, score: 2 });
    expect(f(n, "player").grips).toBe(0);
  });

  it("свип из гарда — нижний становится верхним в халф гарде, +2", () => {
    const s = withState({ position: "guard", top: "bot", player: { grips: 2 } });
    const n = resolveExchange(s, "guardSweep", "breathe").nextState;
    expect(n.position).toBe("halfGuard");
    expect(n.top).toBe("player");
    expect(f(n, "player").score).toBe(2);
  });

  it("свип из халф гарда меняет верхнего", () => {
    const s = withState({ position: "halfGuard", top: "player", bot: { grips: 2 } });
    const n = resolveExchange(s, "breathe", "halfSweep").nextState;
    expect(n.position).toBe("halfGuard");
    expect(n.top).toBe("bot");
    expect(f(n, "bot").score).toBe(2);
  });

  it("проход гарда +3, маунт +4, спина +4", () => {
    let s = withState({ position: "halfGuard", top: "player", player: { grips: 2 } });
    s = resolveExchange(s, "passGuard", "grip").nextState;
    expect([s.position, s.top, f(s, "player").score]).toEqual(["sideControl", "player", 3]);
    s = { ...s, fighters: { ...s.fighters, player: { ...f(s, "player"), grips: 2 } } };
    s = resolveExchange(s, "mountUp", "breathe").nextState;
    expect([s.position, s.top, f(s, "player").score]).toEqual(["mount", "player", 7]);
    s = { ...s, fighters: { ...s.fighters, player: { ...f(s, "player"), grips: 2 } } };
    s = resolveExchange(s, "takeBack", "breathe").nextState;
    expect([s.position, s.top, f(s, "player").score]).toEqual(["back", "player", 11]);
  });

  it("забрать спину из халф гарда — и сверху, и снизу, +4, нужно 3 захвата", () => {
    const top = withState({ position: "halfGuard", top: "player", player: { grips: 3 } });
    expect(legalActions(top, "player")).toContain("halfBackTop");
    let n = resolveExchange(top, "halfBackTop", "breathe").nextState;
    expect([n.position, n.top, f(n, "player").score]).toEqual(["back", "player", 4]);
    const bottom = withState({ position: "halfGuard", top: "bot", player: { grips: 3 } });
    expect(legalActions(bottom, "player")).toContain("halfBackBottom");
    n = resolveExchange(bottom, "halfBackBottom", "breathe").nextState;
    expect([n.position, n.top, f(n, "player").score]).toEqual(["back", "player", 4]);
    expect(legalActions(withState({ position: "halfGuard", top: "player", player: { grips: 2 } }), "player")).not.toContain("halfBackTop");
  });

  it("выходы снизу: сползти в гард из спины — защищающийся снизу в гарде", () => {
    const s = withState({ position: "back", top: "bot", player: { grips: 2 } });
    const n = resolveExchange(s, "slideToGuard", "breathe").nextState;
    expect([n.position, n.top]).toEqual(["guard", "bot"]);
    expect(f(n, "player").score).toBe(0);
  });

  it("переход требует захваты и минимум 1 дыхание", () => {
    const s = withState({ player: { grips: 1, breath: 0 } });
    expect(legalActions(s, "player")).not.toContain("takedown");
    expect(() => resolveExchange(s, "takedown", "grip")).toThrow(IllegalActionError);
  });

  it("захват базовым действием не перебивает установку 1/0 после перехода", () => {
    const s = withState({ bot: { grips: 1 }, player: { grips: 2 } });
    const n = resolveExchange(s, "grip", "takedown").nextState;
    expect(f(n, "player").grips).toBe(0);
    expect(f(n, "bot").grips).toBe(1);
  });
});

describe("защиты и сравнение", () => {
  it("рамка блокирует переход, атакующий теряет ещё 1 дыхание", () => {
    const s = withState({ player: { grips: 2, breath: 3 } });
    const r = resolveExchange(s, "takedown", "frame");
    expect(r.nextState.position).toBe("standing");
    expect(f(r.nextState, "player")).toMatchObject({ grips: 1, breath: 1 });
    expect(f(r.nextState, "bot").breath).toBe(6);
    expect(r.report.player).toMatchObject({ outcome: "blocked", failReason: "blockedFrame" });
    expect(r.events.some((e) => e.type === "blocked" && e.by === "frame" && e.blocker === "bot")).toBe(true);
  });

  it("штраф блока не уводит дыхание ниже нуля", () => {
    const s = withState({ player: { grips: 1, breath: 1 } });
    const n = resolveExchange(s, "takedown", "frame").nextState;
    expect(f(n, "player").breath).toBe(0);
  });

  it("рамка не блокирует сабмишн, защита шеи не блокирует переход", () => {
    const sub = withState({ position: "mount", top: "player", player: { grips: 2 } });
    expect(resolveExchange(sub, "armbar", "frame").nextState.submission).toEqual({ technique: "armbar", attacker: "player" });
    const tr = withState({ player: { grips: 1 } });
    expect(resolveExchange(tr, "takedown", "neck").nextState.position).toBe("guard");
  });

  it("равные захваты — обе атаки срываются, позиция сохраняется, стоимость оплачена", () => {
    const s = withState({ player: { grips: 1 }, bot: { grips: 1 } });
    const r = resolveExchange(s, "takedown", "pullGuard");
    expect(r.nextState.position).toBe("standing");
    expect(f(r.nextState, "player")).toMatchObject({ grips: 0, breath: 5, score: 0 });
    expect(f(r.nextState, "bot")).toMatchObject({ grips: 0, breath: 5 });
    expect(r.report.player.failReason).toBe("equalGrips");
    expect(r.report.bot.failReason).toBe("equalGrips");
  });

  it("сравнение по захватам до списания стоимости", () => {
    // Игрок: 3 захвата, тратит 2 на свип → 1. Бот: 2 захвата, тратит 1 → 1.
    const s = withState({ position: "guard", top: "bot", player: { grips: 3 }, bot: { grips: 2 } });
    const r = resolveExchange(s, "guardSweep", "openGuard");
    expect(r.nextState.top).toBe("player");
    expect(r.nextState.position).toBe("halfGuard");
    expect(r.report.bot).toMatchObject({ outcome: "failed", failReason: "lostGrips" });
    expect(r.events.find((e) => e.type === "clash")).toMatchObject({ winner: "player", gripsBefore: { player: 3, bot: 2 } });
  });
});

describe("сабмишны", () => {
  const guardBottom = () => withState({ position: "guard", top: "bot", player: { grips: 2 } });

  it("треугольник: попытка → фиксация → дожим → сдача", () => {
    const r1 = resolveExchange(guardBottom(), "triangle", "grip");
    expect(r1.nextState.submission).toEqual({ technique: "triangle", attacker: "player" });
    expect(r1.nextState.exchange).toBe(1);
    expect(r1.report.player.outcome).toBe("locked");
    expect(f(r1.nextState, "player")).toMatchObject({ grips: 0, breath: 5 });
    expect(legalActions(r1.nextState, "player")).toEqual(["finish", "switch"]);
    expect(legalActions(r1.nextState, "bot")).toEqual(["defendGrip", "turn"]);
    const r2 = resolveExchange(r1.nextState, "finish", "turn");
    expect(r2.nextState.result).toEqual({ winner: "player", reason: "submission", technique: "triangle" });
    expect(r2.report.bot.outcome).toBe("tapped");
  });

  it("защита шеи блокирует начало сабмишна", () => {
    const r = resolveExchange(guardBottom(), "triangle", "neck");
    expect(r.nextState.submission).toBeNull();
    expect(f(r.nextState, "player")).toMatchObject({ grips: 0, breath: 4 });
    expect(r.report.player.failReason).toBe("blockedNeck");
  });

  it("правильная защита от дожима: приём снят, −2 дыхания атакующему, захваты 0, позиция та же", () => {
    const locked = resolveExchange(guardBottom(), "triangle", "grip").nextState;
    const r = resolveExchange(locked, "finish", "defendGrip");
    const n = r.nextState;
    expect(n.submission).toBeNull();
    expect(n.result).toBeNull();
    expect(n.position).toBe("guard");
    expect(n.top).toBe("bot");
    expect(f(n, "player")).toMatchObject({ grips: 0, breath: 3 });
    expect(f(n, "bot").grips).toBe(0);
    expect(n.exchange).toBe(2);
  });

  it("правильная защита от смены приёма", () => {
    const locked = resolveExchange(guardBottom(), "triangle", "grip").nextState;
    const n = resolveExchange(locked, "switch", "turn").nextState;
    expect(n.submission).toBeNull();
    expect(n.result).toBeNull();
  });

  it("дуэль доступна при нулевых ресурсах", () => {
    const s = withState({ position: "mount", top: "bot", submission: { technique: "armbar", attacker: "bot" }, player: { grips: 0, breath: 0 }, bot: { grips: 0, breath: 0 } });
    expect(legalActions(s, "player")).toEqual(["defendGrip", "turn"]);
    const n = resolveExchange(s, "defendGrip", "finish").nextState;
    expect(f(n, "bot").breath).toBe(0);
  });

  it("сабмишн со стороны бота", () => {
    const s = withState({ position: "back", top: "bot", bot: { grips: 2 } });
    const r1 = resolveExchange(s, "grip", "choke");
    expect(r1.nextState.submission).toEqual({ technique: "choke", attacker: "bot" });
    const r2 = resolveExchange(r1.nextState, "defendGrip", "switch");
    expect(r2.nextState.result).toEqual({ winner: "bot", reason: "submission", technique: "choke" });
  });

  it("сабмишн на 12-м обмене: сначала дуэль, потом итог", () => {
    const s = withState({ exchange: 12, position: "sideControl", top: "player", player: { grips: 2 }, bot: { score: 5 } });
    const r1 = resolveExchange(s, "kimura", "breathe");
    expect(r1.nextState.result).toBeNull();
    expect(r1.nextState.submission).not.toBeNull();
    const defended = resolveExchange(r1.nextState, "finish", "defendGrip").nextState;
    expect(defended.result).toEqual({ winner: "bot", reason: "points" });
    const tapped = resolveExchange(r1.nextState, "finish", "turn").nextState;
    expect(tapped.result).toMatchObject({ winner: "player", reason: "submission" });
  });
});

describe("завершение по лимиту", () => {
  it("по очкам", () => {
    const s = withState({ exchange: 12, player: { score: 2 } });
    expect(resolveExchange(s, "grip", "grip").nextState.result).toEqual({ winner: "player", reason: "points" });
  });
  it("по дыханию", () => {
    const s = withState({ exchange: 12, player: { breath: 3 }, bot: { breath: 5 } });
    expect(resolveExchange(s, "grip", "grip").nextState.result).toEqual({ winner: "bot", reason: "breath" });
  });
  it("ничья", () => {
    const s = withState({ exchange: 12 });
    expect(resolveExchange(s, "grip", "grip").nextState.result).toEqual({ winner: null, reason: "draw" });
  });
  it("после 11 обменов игра продолжается", () => {
    const s = withState({ exchange: 11 });
    const n = resolveExchange(s, "grip", "grip").nextState;
    expect(n.result).toBeNull();
    expect(n.exchange).toBe(12);
  });
  it("завершённая схватка не принимает действий", () => {
    const s = resolveExchange(withState({ exchange: 12 }), "grip", "grip").nextState;
    expect(() => resolveExchange(s, "grip", "grip")).toThrow(IllegalActionError);
  });
});

describe("бот", () => {
  it("выбирает только легальные действия и воспроизводим по seed", () => {
    const seqA: string[] = [];
    const seqB: string[] = [];
    for (const seq of [seqA, seqB]) {
      const rng = seededRng(42);
      let s = createMatch();
      while (!s.result) {
        const bot = chooseBotAction(s, rng);
        expect(legalActions(s, "bot")).toContain(bot);
        const player = legalActions(s, "player")[0];
        seq.push(bot);
        s = resolveExchange(s, player, bot).nextState;
      }
    }
    expect(seqA).toEqual(seqB);
  });

  it("веса по правилам прототипа", () => {
    const s = withState({ player: { grips: 1 }, bot: { grips: 1, breath: 1 } });
    const w = Object.fromEntries(botWeights(s).map((o) => [o.action, o.weight]));
    expect(w).toEqual({ grip: 6, frame: 2, neck: 0.2, breathe: 7, takedown: 4, pullGuard: 4 });
    const guard = withState({ position: "guard", top: "bot", player: { grips: 2 }, bot: { grips: 2, breath: 6 } });
    const w2 = Object.fromEntries(botWeights(guard).map((o) => [o.action, o.weight]));
    expect(w2).toEqual({ grip: 0.2, frame: 2, neck: 2, breathe: 0.3, openGuard: 4 });
    const bottom = withState({ position: "guard", top: "player", bot: { grips: 2 } });
    expect(Object.fromEntries(botWeights(bottom).map((o) => [o.action, o.weight])).triangle).toBe(3);
    const duel = withState({ position: "guard", top: "bot", submission: { technique: "triangle", attacker: "player" } });
    expect(botWeights(duel)).toEqual([{ action: "defendGrip", weight: 1 }, { action: "turn", weight: 1 }]);
  });
});
