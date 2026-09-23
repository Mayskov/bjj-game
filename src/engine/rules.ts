import {
  BASIC_ACTIONS,
  BASIC_ORDER,
  BLOCK_BREATH_PENALTY,
  DEFENDED_SUB_BREATH_PENALTY,
  DUEL_ACTIONS,
  GRIPS_AFTER_TRANSITION,
  MAX_BREATH,
  MAX_EXCHANGES,
  MAX_GRIPS,
  POSITION_NAMES,
  START_BREATH,
  SUBMISSIONS,
  SUBMISSION_ORDER,
  TRANSITIONS,
  TRANSITION_ORDER,
  actionName,
  breathCost,
  categoryOf,
  gripCost
} from "./catalog";
import type {
  ActionId,
  BasicActionId,
  DuelActionId,
  DuelAttackId,
  DuelDefenseId,
  EngineEvent,
  ExchangeResult,
  FailReason,
  FighterState,
  MatchResult,
  MatchState,
  Role,
  Side,
  SideReport,
  SubmissionId,
  TransitionId
} from "./types";

export const SIDES: Side[] = ["player", "bot"];

export function opponent(side: Side): Side {
  return side === "player" ? "bot" : "player";
}

export function createMatch(): MatchState {
  return {
    position: "standing",
    top: null,
    fighters: {
      player: { grips: 0, breath: START_BREATH, score: 0 },
      bot: { grips: 0, breath: START_BREATH, score: 0 }
    },
    exchange: 1,
    submission: null,
    result: null,
    history: []
  };
}

export function roleOf(state: Pick<MatchState, "position" | "top">, side: Side): Role {
  if (state.position === "standing" || state.top === null) return "standing";
  return state.top === side ? "top" : "bottom";
}

/** Все техники (переходы и сабмишны) данной позиции и роли — вне зависимости от ресурсов. */
export function techniquesFor(state: Pick<MatchState, "position" | "top">, side: Side): (TransitionId | SubmissionId)[] {
  const role = roleOf(state, side);
  const list: (TransitionId | SubmissionId)[] = [];
  for (const id of TRANSITION_ORDER) {
    const def = TRANSITIONS[id];
    if (def.from === state.position && def.role === role) list.push(id);
  }
  for (const id of SUBMISSION_ORDER) {
    const def = SUBMISSIONS[id];
    if (def.from === state.position && def.role === role) list.push(id);
  }
  return list;
}

export function canAfford(fighter: FighterState, action: ActionId): boolean {
  const category = categoryOf(action);
  if (category !== "transition" && category !== "submission") return true;
  return fighter.grips >= gripCost(action) && fighter.breath >= breathCost(action);
}

export function isDuel(state: MatchState): boolean {
  return state.submission !== null;
}

export function legalActions(state: MatchState, side: Side): ActionId[] {
  if (state.result) return [];
  if (state.submission) {
    return state.submission.attacker === side ? ["finish", "switch"] : ["defendGrip", "turn"];
  }
  const fighter = state.fighters[side];
  const techniques = techniquesFor(state, side).filter((id) => canAfford(fighter, id));
  return [...BASIC_ORDER, ...techniques];
}

export function isLegal(state: MatchState, side: Side, action: ActionId): boolean {
  return legalActions(state, side).includes(action);
}

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    fighters: { player: { ...state.fighters.player }, bot: { ...state.fighters.bot } },
    submission: state.submission ? { ...state.submission } : null,
    result: state.result ? { ...state.result } : null,
    history: state.history.slice()
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function limitResult(state: MatchState): MatchResult {
  const p = state.fighters.player;
  const b = state.fighters.bot;
  if (p.score !== b.score) return { winner: p.score > b.score ? "player" : "bot", reason: "points" };
  if (p.breath !== b.breath) return { winner: p.breath > b.breath ? "player" : "bot", reason: "breath" };
  return { winner: null, reason: "draw" };
}

/** Закрывает основной обмен: либо следующий номер, либо итог по лимиту. */
function closeExchange(next: MatchState, events: EngineEvent[]) {
  if (next.exchange >= MAX_EXCHANGES) {
    next.result = limitResult(next);
    events.push({ type: "matchEnd", result: next.result });
  } else {
    events.push({ type: "exchangeAdvanced", from: next.exchange, to: next.exchange + 1 });
    next.exchange += 1;
  }
}

function deltaOf(before: FighterState, after: FighterState): FighterState {
  return {
    grips: after.grips - before.grips,
    breath: after.breath - before.breath,
    score: after.score - before.score
  };
}

export class IllegalActionError extends Error {}

/**
 * Чистый расчёт обмена. Оба действия уже зафиксированы.
 * Если активен сабмишн — это решающая дуэль, продолжение текущего обмена.
 */
export function resolveExchange(state: MatchState, playerAction: ActionId, botAction: ActionId): ExchangeResult {
  if (state.result) throw new IllegalActionError("Схватка уже завершена");
  if (!isLegal(state, "player", playerAction)) throw new IllegalActionError(`Недоступно игроку: ${playerAction}`);
  if (!isLegal(state, "bot", botAction)) throw new IllegalActionError(`Недоступно боту: ${botAction}`);
  return state.submission
    ? resolveDuel(state, playerAction as DuelActionId, botAction as DuelActionId)
    : resolveMain(state, playerAction, botAction);
}

function resolveMain(state: MatchState, playerAction: ActionId, botAction: ActionId): ExchangeResult {
  const next = cloneState(state);
  const acts: Record<Side, ActionId> = { player: playerAction, bot: botAction };
  const events: EngineEvent[] = [{ type: "actions", player: playerAction, bot: botAction, duel: false }];
  const outcome: Record<Side, SideReport["outcome"]> = { player: "basic", bot: "basic" };
  const failReason: Partial<Record<Side, FailReason>> = {};

  // 2. Захваты до списания.
  const gripsBefore: Record<Side, number> = { player: state.fighters.player.grips, bot: state.fighters.bot.grips };

  // 3. Списание стоимости атак и восстановление базовыми действиями.
  const attackers: Side[] = [];
  for (const side of SIDES) {
    const action = acts[side];
    const fighter = next.fighters[side];
    const category = categoryOf(action);
    if (category === "basic") {
      const def = BASIC_ACTIONS[action as BasicActionId];
      const grips = clamp(fighter.grips + def.grips, 0, MAX_GRIPS) - fighter.grips;
      const breath = clamp(fighter.breath + def.breath, 0, MAX_BREATH) - fighter.breath;
      fighter.grips += grips;
      fighter.breath += breath;
      events.push({ type: "restored", side, action: action as BasicActionId, grips, breath });
    } else {
      const grips = gripCost(action);
      const breath = breathCost(action);
      fighter.grips -= grips;
      fighter.breath -= breath;
      events.push({ type: "paid", side, action, grips: -grips, breath: -breath });
      attackers.push(side);
    }
  }

  // 4. Защиты.
  const live: Side[] = [];
  for (const side of attackers) {
    const category = categoryOf(acts[side]);
    const opp = opponent(side);
    const oppAction = acts[opp];
    const by =
      category === "transition" && oppAction === "frame"
        ? "frame"
        : category === "submission" && oppAction === "neck"
          ? "neck"
          : null;
    if (by) {
      const fighter = next.fighters[side];
      const penalty = Math.min(BLOCK_BREATH_PENALTY, fighter.breath);
      fighter.breath -= penalty;
      events.push({ type: "blocked", side, action: acts[side], by, blocker: opp, breathPenalty: -penalty });
      const reason: FailReason = by === "frame" ? "blockedFrame" : "blockedNeck";
      events.push({ type: "attackFailed", side, action: acts[side], reason });
      outcome[side] = "blocked";
      failReason[side] = reason;
    } else {
      live.push(side);
    }
  }

  // 5. Сравнение незаблокированных атак.
  let winner: Side | null = null;
  if (live.length === 1) {
    winner = live[0];
  } else if (live.length === 2) {
    const p = gripsBefore.player;
    const b = gripsBefore.bot;
    winner = p === b ? null : p > b ? "player" : "bot";
    events.push({ type: "clash", winner, gripsBefore });
    for (const side of live) {
      if (side === winner) continue;
      const reason: FailReason = winner === null ? "equalGrips" : "lostGrips";
      events.push({ type: "attackFailed", side, action: acts[side], reason });
      outcome[side] = "failed";
      failReason[side] = reason;
    }
  }

  // 6. Результат победившей атаки.
  if (winner) {
    const action = acts[winner];
    const loser = opponent(winner);
    if (categoryOf(action) === "transition") {
      const def = TRANSITIONS[action as TransitionId];
      const fromTop = next.top;
      next.position = def.to;
      next.top = def.attackerEndsTop ? winner : loser;
      events.push({ type: "transition", side: winner, action: def.id, from: def.from, to: def.to, fromTop, toTop: next.top });
      next.fighters[winner].grips = GRIPS_AFTER_TRANSITION.winner;
      next.fighters[loser].grips = GRIPS_AFTER_TRANSITION.loser;
      events.push({
        type: "gripsSet",
        values: { [winner]: GRIPS_AFTER_TRANSITION.winner, [loser]: GRIPS_AFTER_TRANSITION.loser } as Record<Side, number>,
        reason: "transition"
      });
      if (def.points > 0) {
        next.fighters[winner].score += def.points;
        events.push({ type: "score", side: winner, points: def.points, action: def.id });
      }
      outcome[winner] = "success";
    } else {
      next.submission = { technique: action as SubmissionId, attacker: winner };
      events.push({ type: "submissionLocked", side: winner, technique: action as SubmissionId });
      outcome[winner] = "locked";
    }
  }

  next.history.push({
    exchange: state.exchange,
    duel: false,
    player: playerAction,
    bot: botAction,
    summary: summarizeMain(acts, winner, outcome, failReason, next)
  });

  if (!next.submission) closeExchange(next, events);

  return {
    nextState: next,
    events,
    duel: false,
    report: {
      player: { action: playerAction, outcome: outcome.player, failReason: failReason.player, delta: deltaOf(state.fighters.player, next.fighters.player) },
      bot: { action: botAction, outcome: outcome.bot, failReason: failReason.bot, delta: deltaOf(state.fighters.bot, next.fighters.bot) }
    }
  };
}

function resolveDuel(state: MatchState, playerAction: DuelActionId, botAction: DuelActionId): ExchangeResult {
  const next = cloneState(state);
  const sub = state.submission!;
  const attacker = sub.attacker;
  const defender = opponent(attacker);
  const acts: Record<Side, DuelActionId> = { player: playerAction, bot: botAction };
  const attack = acts[attacker] as DuelAttackId;
  const defense = acts[defender] as DuelDefenseId;
  const events: EngineEvent[] = [{ type: "actions", player: playerAction, bot: botAction, duel: true }];
  const outcome: Record<Side, SideReport["outcome"]> = { player: "idle", bot: "idle" };
  const correct = DUEL_ACTIONS[attack].counter === defense;

  let summary: string;
  if (correct) {
    const fighter = next.fighters[attacker];
    const penalty = Math.min(DEFENDED_SUB_BREATH_PENALTY, fighter.breath);
    fighter.breath -= penalty;
    next.fighters.player.grips = 0;
    next.fighters.bot.grips = 0;
    next.submission = null;
    events.push({ type: "submissionDefended", attacker, defender, technique: sub.technique, attack, defense, breathPenalty: -penalty });
    events.push({ type: "gripsSet", values: { player: 0, bot: 0 }, reason: "submissionDefended" });
    outcome[attacker] = "escaped";
    outcome[defender] = "defended";
    summary = `${sideName(defender)}: защита от ${SUBMISSIONS[sub.technique].genitive} сработала`;
    next.history.push({ exchange: state.exchange, duel: true, player: playerAction, bot: botAction, summary });
    closeExchange(next, events);
  } else {
    next.submission = null;
    next.result = { winner: attacker, reason: "submission", technique: sub.technique };
    events.push({ type: "submissionWin", side: attacker, technique: sub.technique, attack, defense });
    events.push({ type: "matchEnd", result: next.result });
    outcome[attacker] = "won";
    outcome[defender] = "tapped";
    summary = `${sideName(attacker)}: ${SUBMISSIONS[sub.technique].name} — сдача`;
    next.history.push({ exchange: state.exchange, duel: true, player: playerAction, bot: botAction, summary });
  }

  return {
    nextState: next,
    events,
    duel: true,
    report: {
      player: { action: playerAction, outcome: outcome.player, delta: deltaOf(state.fighters.player, next.fighters.player) },
      bot: { action: botAction, outcome: outcome.bot, delta: deltaOf(state.fighters.bot, next.fighters.bot) }
    }
  };
}

function sideName(side: Side) {
  return side === "player" ? "Ты" : "Бот";
}

function summarizeMain(
  acts: Record<Side, ActionId>,
  winner: Side | null,
  outcome: Record<Side, SideReport["outcome"]>,
  failReason: Partial<Record<Side, FailReason>>,
  next: MatchState
): string {
  const parts = [`Ты: ${actionName(acts.player)}`, `Бот: ${actionName(acts.bot)}`];
  if (winner) {
    const action = acts[winner];
    if (categoryOf(action) === "transition") {
      const def = TRANSITIONS[action as TransitionId];
      parts.push(`→ ${POSITION_NAMES[next.position]}${def.points ? ` (+${def.points} ${winner === "player" ? "тебе" : "боту"})` : ""}`);
    } else {
      parts.push(`→ ${SUBMISSIONS[action as SubmissionId].name} зафиксирован`);
    }
  } else if (outcome.player === "failed" && failReason.player === "equalGrips") {
    parts.push("→ скрэмбл, обе атаки сорвались");
  } else if (outcome.player === "blocked" || outcome.bot === "blocked") {
    parts.push("→ атака заблокирована");
  }
  return parts.join(" · ");
}

export function describeFailReason(reason: FailReason): string {
  switch (reason) {
    case "blockedFrame":
      return "рамка";
    case "blockedNeck":
      return "защита шеи";
    case "equalGrips":
      return "равные захваты";
    case "lostGrips":
      return "меньше захватов";
  }
}
