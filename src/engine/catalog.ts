import type {
  ActionCategory,
  ActionId,
  BasicActionId,
  DuelActionId,
  Position,
  Role,
  SubmissionId,
  TransitionId
} from "./types";

export const MAX_EXCHANGES = 12;
export const MAX_GRIPS = 3;
export const MAX_BREATH = 6;
export const START_BREATH = 6;

export const TRANSITION_BREATH_COST = 1;
export const BLOCK_BREATH_PENALTY = 1;
export const SUBMISSION_GRIP_COST = 2;
export const SUBMISSION_BREATH_COST = 1;
export const DEFENDED_SUB_BREATH_PENALTY = 2;
/** После успешного перехода захваты победителя и проигравшего. */
export const GRIPS_AFTER_TRANSITION = { winner: 1, loser: 0 } as const;

export const POSITION_NAMES: Record<Position, string> = {
  standing: "Стойка",
  guard: "Закрытый гард",
  halfGuard: "Полугард",
  sideControl: "Боковой контроль",
  mount: "Маунт",
  back: "Контроль спины"
};

export interface BasicDef {
  id: BasicActionId;
  name: string;
  grips: number;
  breath: number;
  blocks?: "transition" | "submission";
  effect: string;
}

export const BASIC_ACTIONS: Record<BasicActionId, BasicDef> = {
  grip: { id: "grip", name: "Взять захват", grips: 1, breath: 1, effect: "+1 захват · +1 дыхание" },
  frame: {
    id: "frame",
    name: "Рамка",
    grips: 0,
    breath: 1,
    blocks: "transition",
    effect: "Блок перехода · +1 дыхание"
  },
  neck: {
    id: "neck",
    name: "Защита шеи",
    grips: 0,
    breath: 1,
    blocks: "submission",
    effect: "Блок сабмишна · +1 дыхание"
  },
  breathe: { id: "breathe", name: "Перевести дыхание", grips: 0, breath: 2, effect: "+2 дыхания" }
};

export const BASIC_ORDER: BasicActionId[] = ["grip", "frame", "neck", "breathe"];

export interface TransitionDef {
  id: TransitionId;
  name: string;
  /** Короткое название для индикатора. */
  short: string;
  from: Position;
  role: Role;
  cost: number;
  to: Position;
  /** true — атакующий по итогу сверху (контролирует). */
  attackerEndsTop: boolean;
  points: number;
}

export const TRANSITIONS: Record<TransitionId, TransitionDef> = {
  takedown: { id: "takedown", name: "Проход в ноги", short: "Проход в ноги", from: "standing", role: "standing", cost: 1, to: "guard", attackerEndsTop: true, points: 2 },
  pullGuard: { id: "pullGuard", name: "Затянуть в гард", short: "Гард", from: "standing", role: "standing", cost: 1, to: "guard", attackerEndsTop: false, points: 0 },
  openGuard: { id: "openGuard", name: "Раскрыть гард", short: "Гард раскрыт", from: "guard", role: "top", cost: 1, to: "halfGuard", attackerEndsTop: true, points: 0 },
  guardSweep: { id: "guardSweep", name: "Свип", short: "Свип", from: "guard", role: "bottom", cost: 2, to: "halfGuard", attackerEndsTop: true, points: 2 },
  passGuard: { id: "passGuard", name: "Пройти гард", short: "Проход", from: "halfGuard", role: "top", cost: 2, to: "sideControl", attackerEndsTop: true, points: 3 },
  halfSweep: { id: "halfSweep", name: "Свип", short: "Свип", from: "halfGuard", role: "bottom", cost: 2, to: "halfGuard", attackerEndsTop: true, points: 2 },
  recoverGuard: { id: "recoverGuard", name: "Вернуть гард", short: "Гард возвращён", from: "halfGuard", role: "bottom", cost: 1, to: "guard", attackerEndsTop: false, points: 0 },
  mountUp: { id: "mountUp", name: "Занять маунт", short: "Маунт", from: "sideControl", role: "top", cost: 2, to: "mount", attackerEndsTop: true, points: 4 },
  recoverHalf: { id: "recoverHalf", name: "Вернуть полугард", short: "Полугард", from: "sideControl", role: "bottom", cost: 1, to: "halfGuard", attackerEndsTop: false, points: 0 },
  takeBack: { id: "takeBack", name: "Забрать спину", short: "Спина", from: "mount", role: "top", cost: 2, to: "back", attackerEndsTop: true, points: 4 },
  elbowKnee: { id: "elbowKnee", name: "Локоть–колено", short: "Полугард", from: "mount", role: "bottom", cost: 1, to: "halfGuard", attackerEndsTop: false, points: 0 },
  slideToGuard: { id: "slideToGuard", name: "Сползти в гард", short: "Гард", from: "back", role: "bottom", cost: 2, to: "guard", attackerEndsTop: false, points: 0 }
};

export const TRANSITION_ORDER: TransitionId[] = [
  "takedown",
  "pullGuard",
  "openGuard",
  "guardSweep",
  "passGuard",
  "halfSweep",
  "recoverGuard",
  "mountUp",
  "recoverHalf",
  "takeBack",
  "elbowKnee",
  "slideToGuard"
];

export interface SubmissionDef {
  id: SubmissionId;
  name: string;
  from: Position;
  role: Role;
  /** Родительный падеж для подписей вида «защита от …». */
  genitive: string;
}

export const SUBMISSIONS: Record<SubmissionId, SubmissionDef> = {
  triangle: { id: "triangle", name: "Треугольник", from: "guard", role: "bottom", genitive: "треугольника" },
  kimura: { id: "kimura", name: "Кимура", from: "sideControl", role: "top", genitive: "кимуры" },
  armbar: { id: "armbar", name: "Рычаг локтя", from: "mount", role: "top", genitive: "рычага локтя" },
  choke: { id: "choke", name: "Удушение", from: "back", role: "top", genitive: "удушения" }
};

export const SUBMISSION_ORDER: SubmissionId[] = ["triangle", "kimura", "armbar", "choke"];

export interface DuelDef {
  id: DuelActionId;
  name: string;
  side: "attacker" | "defender";
  /** Для атаки — защита, которая её останавливает. */
  counter?: DuelActionId;
}

export const DUEL_ACTIONS: Record<DuelActionId, DuelDef> = {
  finish: { id: "finish", name: "Дожать", side: "attacker", counter: "defendGrip" },
  switch: { id: "switch", name: "Сменить приём", side: "attacker", counter: "turn" },
  defendGrip: { id: "defendGrip", name: "Защитить захват", side: "defender" },
  turn: { id: "turn", name: "Повернуться", side: "defender" }
};

export function categoryOf(action: ActionId): ActionCategory {
  if (action in BASIC_ACTIONS) return "basic";
  if (action in TRANSITIONS) return "transition";
  if (action in SUBMISSIONS) return "submission";
  if (action === "finish" || action === "switch") return "duelAttack";
  return "duelDefense";
}

export function actionName(action: ActionId): string {
  switch (categoryOf(action)) {
    case "basic":
      return BASIC_ACTIONS[action as BasicActionId].name;
    case "transition":
      return TRANSITIONS[action as TransitionId].name;
    case "submission":
      return SUBMISSIONS[action as SubmissionId].name;
    default:
      return DUEL_ACTIONS[action as DuelActionId].name;
  }
}

export function gripCost(action: ActionId): number {
  const category = categoryOf(action);
  if (category === "transition") return TRANSITIONS[action as TransitionId].cost;
  if (category === "submission") return SUBMISSION_GRIP_COST;
  return 0;
}

export function breathCost(action: ActionId): number {
  const category = categoryOf(action);
  if (category === "transition") return TRANSITION_BREATH_COST;
  if (category === "submission") return SUBMISSION_BREATH_COST;
  return 0;
}
