import { categoryOf } from "./catalog";
import type { Rng } from "./rng";
import { legalActions } from "./rules";
import type { ActionId, MatchState } from "./types";

export interface WeightedAction {
  action: ActionId;
  weight: number;
}

/**
 * Веса бота. Бот видит только открытое состояние схватки (позиция, ресурсы),
 * но не выбор игрока в текущем обмене — функция его просто не получает.
 */
export function botWeights(state: MatchState): WeightedAction[] {
  const legal = legalActions(state, "bot");
  if (state.submission) return legal.map((action) => ({ action, weight: 1 }));

  const me = state.fighters.bot;
  const foe = state.fighters.player;
  const playerHasSubmission = legalActions(state, "player").some((a) => categoryOf(a) === "submission");

  return legal.map((action) => {
    let weight: number;
    switch (categoryOf(action)) {
      case "transition":
        weight = 4;
        break;
      case "submission":
        weight = 3;
        break;
      default:
        weight =
          action === "grip"
            ? me.grips < 2
              ? 6
              : 0.2
            : action === "breathe"
              ? me.breath < 2
                ? 7
                : 0.3
              : action === "frame"
                ? foe.grips > 0
                  ? 2
                  : 0.3
                : playerHasSubmission
                  ? 2
                  : 0.2;
    }
    return { action, weight };
  });
}

export function pickWeighted(options: WeightedAction[], rng: Rng): ActionId {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll < 0) return option.action;
  }
  return options[options.length - 1].action;
}

export function chooseBotAction(state: MatchState, rng: Rng): ActionId {
  return pickWeighted(botWeights(state), rng);
}
