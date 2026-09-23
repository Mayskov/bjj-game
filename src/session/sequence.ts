import { BASIC_ACTIONS, POSITION_NAMES, SUBMISSIONS, TRANSITIONS, actionName, categoryOf } from "../engine/catalog";
import { describeFailReason, opponent } from "../engine/rules";
import type {
  ActionId,
  BasicActionId,
  DuelActionId,
  ExchangeResult,
  MatchState,
  Side,
  SubmissionId,
  TransitionId
} from "../engine/types";
import { baseKey, type BasicOverlay, type SceneFrame, type VisualKey, type VisualPhase } from "../visual/manifest";

export type Stage = "playerAttempt" | "botResponse" | "result";

export type Tone = "good" | "bad" | "neutral";

export interface Indicator {
  text: string;
  tone: Tone;
  icon: "plus" | "minus" | "check" | "cross" | "shield" | "lock" | "tap" | "star";
}

export interface Caption {
  tag: string;
  who: Side | null;
  text: string;
  tone: Tone;
}

export interface SequenceStep {
  stage: Stage;
  /** Короткая анимация борьбы за захват перед кадром. */
  gripBefore: boolean;
  frame: SceneFrame;
  caption: Caption;
}

const WHO: Record<Side, string> = { player: "Ты", bot: "Бот" };

function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

function attemptKey(state: MatchState, side: Side, action: ActionId): VisualKey | null {
  const category = categoryOf(action);
  if (category === "transition") {
    return { position: state.position, top: state.top, technique: action as TransitionId, attacker: side, phase: "attempt" };
  }
  if (category === "submission") {
    return { position: state.position, top: state.top, technique: action as SubmissionId, attacker: side, phase: "attempt" };
  }
  return null;
}

function basicOf(side: Side, action: ActionId): BasicOverlay[] {
  return categoryOf(action) === "basic" ? [{ side, action: action as BasicActionId }] : [];
}

/**
 * Строит последовательность кадров «моя попытка → ответ бота → итог»
 * только из результата движка. Правила здесь не пересчитываются.
 */
export function buildSequence(before: MatchState, result: ExchangeResult): SequenceStep[] {
  const { report, nextState } = result;
  const p = report.player.action;
  const b = report.bot.action;

  if (result.duel) {
    const sub = before.submission!;
    const duelKey = (phase: VisualPhase): VisualKey => ({ position: before.position, top: before.top, technique: sub.technique, attacker: sub.attacker, phase });
    const resultKey: VisualKey = nextState.result ? duelKey("tap") : baseKey(nextState);
    return [
      { stage: "playerAttempt", gripBefore: true, frame: { key: duelKey(p as DuelActionId), basics: [] }, caption: { tag: "Попытка", who: "player", text: `Ты: ${actionName(p)}`, tone: "neutral" } },
      { stage: "botResponse", gripBefore: true, frame: { key: duelKey(b as DuelActionId), basics: [] }, caption: { tag: "Ответ", who: "bot", text: `Бот: ${actionName(b)}`, tone: "neutral" } },
      { stage: "result", gripBefore: false, frame: { key: resultKey, basics: [] }, caption: resultCaption(before, result) }
    ];
  }

  const base = baseKey(before);
  const pKey = attemptKey(before, "player", p);
  const bKey = attemptKey(before, "bot", b);
  const playerFrame: SceneFrame = { key: pKey ?? base, basics: basicOf("player", p) };
  const botFrame: SceneFrame = bKey
    ? { key: bKey, basics: basicOf("player", p) }
    : { key: pKey ?? base, basics: [...basicOf("player", p), ...basicOf("bot", b)] };
  return [
    { stage: "playerAttempt", gripBefore: true, frame: playerFrame, caption: { tag: "Попытка", who: "player", text: `Ты: ${actionName(p)}`, tone: "neutral" } },
    { stage: "botResponse", gripBefore: true, frame: botFrame, caption: { tag: "Ответ", who: "bot", text: `Бот: ${actionName(b)}`, tone: "neutral" } },
    { stage: "result", gripBefore: false, frame: { key: baseKey(nextState), basics: [] }, caption: resultCaption(before, result) }
  ];
}

function resultCaption(before: MatchState, result: ExchangeResult): Caption {
  for (const e of result.events) {
    if (e.type === "submissionWin") {
      return { tag: "Сдача", who: e.side, text: `${SUBMISSIONS[e.technique].name}: ${e.side === "player" ? "бот сдался" : "ты сдался"}`, tone: e.side === "player" ? "good" : "bad" };
    }
    if (e.type === "submissionDefended") {
      return { tag: "Итог", who: e.defender, text: `${WHO[e.defender]}: защита сработала, приём снят`, tone: e.defender === "player" ? "good" : "bad" };
    }
    if (e.type === "submissionLocked") {
      return { tag: "Успешно", who: e.side, text: `${WHO[e.side]}: ${SUBMISSIONS[e.technique].name} зафиксирован${e.technique === "kimura" ? "а" : e.technique === "choke" ? "о" : ""}`, tone: e.side === "player" ? "good" : "bad" };
    }
    if (e.type === "transition") {
      const def = TRANSITIONS[e.action];
      return { tag: "Успешно", who: e.side, text: `${WHO[e.side]}: ${def.name} → ${POSITION_NAMES[e.to]}${def.points ? ` +${def.points}` : ""}`, tone: e.side === "player" ? "good" : "bad" };
    }
  }
  const { player, bot } = result.report;
  if (player.failReason === "equalGrips") return { tag: "Итог", who: null, text: "Скрэмбл: равные захваты, обе атаки сорвались", tone: "neutral" };
  const blocked = player.outcome === "blocked" ? "player" : bot.outcome === "blocked" ? "bot" : null;
  if (blocked) {
    const reason = describeFailReason(result.report[blocked].failReason!);
    return { tag: "Итог", who: opponent(blocked), text: `${WHO[blocked]}: атака заблокирована — ${reason}`, tone: blocked === "player" ? "bad" : "good" };
  }
  return { tag: "Итог", who: null, text: `Позиция сохраняется: ${POSITION_NAMES[before.position]}`, tone: "neutral" };
}

/** Индикаторы рядом с бойцами — строятся из отчёта и событий движка. */
export function buildIndicators(result: ExchangeResult): Record<Side, Indicator[]> {
  const out: Record<Side, Indicator[]> = { player: [], bot: [] };
  for (const e of result.events) {
    switch (e.type) {
      case "transition": {
        const def = TRANSITIONS[e.action];
        out[e.side].push({ text: def.points ? `${def.short} +${def.points}` : `${def.short}: успешно`, tone: "good", icon: "star" });
        break;
      }
      case "blocked":
        out[e.side].push({ text: `Заблокировано: ${e.by === "frame" ? "рамка" : "защита шеи"}`, tone: "bad", icon: "cross" });
        out[e.blocker].push({ text: e.by === "frame" ? "Рамка сработала" : "Защита шеи сработала", tone: "good", icon: "shield" });
        break;
      case "attackFailed":
        if (e.reason === "equalGrips" || e.reason === "lostGrips") {
          out[e.side].push({ text: `Атака сорвалась: ${describeFailReason(e.reason)}`, tone: "bad", icon: "cross" });
        }
        break;
      case "submissionLocked":
        out[e.side].push({ text: "Приём зафиксирован", tone: "good", icon: "lock" });
        out[opponent(e.side)].push({ text: "Под угрозой!", tone: "bad", icon: "lock" });
        break;
      case "submissionDefended":
        out[e.defender].push({ text: "Защита сработала", tone: "good", icon: "shield" });
        out[e.attacker].push({ text: "Приём снят", tone: "bad", icon: "cross" });
        break;
      case "submissionWin":
        out[e.side].push({ text: "Победа сабмишном", tone: "good", icon: "star" });
        out[opponent(e.side)].push({ text: "Сдача", tone: "bad", icon: "tap" });
        break;
    }
  }
  for (const side of ["player", "bot"] as Side[]) {
    const { report } = result;
    if (report[side].outcome === "basic") {
      out[side].unshift({ text: BASIC_ACTIONS[report[side].action as BasicActionId].name, tone: "neutral", icon: "check" });
    }
    const d = report[side].delta;
    if (d.grips > 0) out[side].push({ text: `Захват +${d.grips}`, tone: "good", icon: "plus" });
    if (d.grips < 0) out[side].push({ text: `−${-d.grips} ${plural(d.grips, "захват", "захвата", "захватов")}`, tone: "bad", icon: "minus" });
    if (d.breath > 0) out[side].push({ text: `Дыхание +${d.breath}`, tone: "good", icon: "plus" });
    if (d.breath < 0) out[side].push({ text: `−${-d.breath} ${plural(d.breath, "дыхание", "дыхания", "дыханий")}`, tone: "bad", icon: "minus" });
  }
  return out;
}
