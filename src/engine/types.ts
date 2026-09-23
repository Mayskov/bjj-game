export type Side = "player" | "bot";

export type Position = "standing" | "guard" | "halfGuard" | "sideControl" | "mount" | "back";

/** Роль стороны в текущей позиции. «top» — верхний / контролирующий (в «Спине» — тот, кто за спиной). */
export type Role = "standing" | "top" | "bottom";

export type BasicActionId = "grip" | "frame" | "neck" | "breathe";

export type TransitionId =
  | "takedown"
  | "pullGuard"
  | "openGuard"
  | "guardSweep"
  | "passGuard"
  | "halfSweep"
  | "halfBackTop"
  | "halfBackBottom"
  | "recoverGuard"
  | "mountUp"
  | "recoverHalf"
  | "takeBack"
  | "elbowKnee"
  | "slideToGuard";

export type SubmissionId = "triangle" | "kimura" | "armbar" | "choke";

export type DuelAttackId = "finish" | "switch";
export type DuelDefenseId = "defendGrip" | "turn";
export type DuelActionId = DuelAttackId | DuelDefenseId;

export type ActionId = BasicActionId | TransitionId | SubmissionId | DuelActionId;

export type ActionCategory = "basic" | "transition" | "submission" | "duelAttack" | "duelDefense";

export interface FighterState {
  grips: number;
  breath: number;
  score: number;
}

export interface ActiveSubmission {
  technique: SubmissionId;
  attacker: Side;
}

export type EndReason = "submission" | "points" | "breath" | "draw";

export interface MatchResult {
  winner: Side | null;
  reason: EndReason;
  technique?: SubmissionId;
}

export interface HistoryEntry {
  exchange: number;
  duel: boolean;
  player: ActionId;
  bot: ActionId;
  summary: string;
}

export interface MatchState {
  position: Position;
  /** Верхний / контролирующий. null — в стойке. */
  top: Side | null;
  fighters: Record<Side, FighterState>;
  /** Номер текущего основного обмена, 1..MAX_EXCHANGES. */
  exchange: number;
  submission: ActiveSubmission | null;
  result: MatchResult | null;
  history: HistoryEntry[];
}

export type BlockReason = "frame" | "neck";
export type FailReason = "blockedFrame" | "blockedNeck" | "lostGrips" | "equalGrips";

export type EngineEvent =
  | { type: "actions"; player: ActionId; bot: ActionId; duel: boolean }
  | { type: "paid"; side: Side; action: ActionId; grips: number; breath: number }
  | { type: "restored"; side: Side; action: BasicActionId; grips: number; breath: number }
  | { type: "blocked"; side: Side; action: ActionId; by: BlockReason; blocker: Side; breathPenalty: number }
  | { type: "clash"; winner: Side | null; gripsBefore: Record<Side, number> }
  | { type: "attackFailed"; side: Side; action: ActionId; reason: FailReason }
  | {
      type: "transition";
      side: Side;
      action: TransitionId;
      from: Position;
      to: Position;
      fromTop: Side | null;
      toTop: Side;
    }
  | { type: "score"; side: Side; points: number; action: TransitionId }
  | { type: "gripsSet"; values: Record<Side, number>; reason: "transition" | "submissionDefended" }
  | { type: "submissionLocked"; side: Side; technique: SubmissionId }
  | {
      type: "submissionDefended";
      attacker: Side;
      defender: Side;
      technique: SubmissionId;
      attack: DuelAttackId;
      defense: DuelDefenseId;
      breathPenalty: number;
    }
  | { type: "submissionWin"; side: Side; technique: SubmissionId; attack: DuelAttackId; defense: DuelDefenseId }
  | { type: "exchangeAdvanced"; from: number; to: number }
  | { type: "matchEnd"; result: MatchResult };

export type SideOutcome =
  | "basic"
  | "success"
  | "blocked"
  | "failed"
  | "locked"
  | "defended"
  | "escaped"
  | "tapped"
  | "won"
  | "idle";

export interface SideReport {
  action: ActionId;
  outcome: SideOutcome;
  failReason?: FailReason;
  delta: FighterState;
}

export interface ExchangeResult {
  nextState: MatchState;
  events: EngineEvent[];
  report: Record<Side, SideReport>;
  duel: boolean;
}
