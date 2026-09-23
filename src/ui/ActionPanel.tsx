import { BASIC_ACTIONS, BASIC_ORDER, DUEL_ACTIONS, MAX_BREATH, SUBMISSIONS, TRANSITIONS, SUBMISSION_GRIP_COST, categoryOf } from "../engine/catalog";
import { ActionIcon } from "./icons";
import { canAfford, legalActions, techniquesFor } from "../engine/rules";
import type { ActionId, DuelActionId, MatchState, SubmissionId, TransitionId } from "../engine/types";

interface Props {
  match: MatchState;
  busy: boolean;
  onAct: (a: ActionId) => void;
  onRematch: () => void;
}

interface ButtonSpec {
  id: ActionId;
  title: string;
  sub: string;
  kind: string;
  disabled: boolean;
}

function specs(m: MatchState): ButtonSpec[] {
  const me = m.fighters.player;
  if (m.submission) {
    const attacker = m.submission.attacker === "player";
    const ids: DuelActionId[] = attacker ? ["finish", "switch"] : ["defendGrip", "turn"];
    const sub: Record<DuelActionId, string> = {
      finish: "против: защита захвата",
      switch: "против: поворот",
      defendGrip: "спасает от дожима",
      turn: "спасает от смены приёма"
    };
    return ids.map((id) => ({ id, title: DUEL_ACTIONS[id].name, sub: sub[id], kind: id, disabled: false }));
  }
  // Базовое действие серое, если оно сейчас ничего не даёт: рамка без угрозы перехода,
  // защита шеи без угрозы сабмишна, отдых при полном дыхании. Захват доступен всегда.
  const foeMoves = legalActions(m, "bot").map(categoryOf);
  const idle: Record<string, string | null> = {
    grip: null,
    frame: foeMoves.includes("transition") ? null : "нет угрозы перехода",
    neck: foeMoves.includes("submission") ? null : "нет угрозы сабмишна",
    breathe: me.breath < MAX_BREATH ? null : "дыхание полное"
  };
  const SHORT: Record<string, string> = { grip: "+1 захв. · +1 дых.", frame: "блок перехода", neck: "блок сабмишна", breathe: "+2 дыхания" };
  const list: ButtonSpec[] = BASIC_ORDER.map((id) => ({ id, title: BASIC_ACTIONS[id].name, sub: idle[id] ?? SHORT[id], kind: id, disabled: idle[id] !== null }));
  for (const id of techniquesFor(m, "player")) {
    const affordable = canAfford(me, id);
    if (categoryOf(id) === "transition") {
      const def = TRANSITIONS[id as TransitionId];
      const need = def.cost > me.grips ? `нужно ${def.cost} захв.` : me.breath < 1 ? "нет дыхания" : "";
      list.push({
        id,
        title: def.name,
        sub: affordable ? `−${def.cost} захв.${def.points ? ` · +${def.points} очк.` : ""}` : need,
        kind: "transition",
        disabled: !affordable
      });
    } else {
      const def = SUBMISSIONS[id as SubmissionId];
      const need = SUBMISSION_GRIP_COST > me.grips ? `нужно ${SUBMISSION_GRIP_COST} захв.` : "нет дыхания";
      list.push({ id, title: def.name, sub: affordable ? "сабмишн · −2 захв." : need, kind: "submission", disabled: !affordable });
    }
  }
  return list;
}

export function ActionPanel({ match, busy, onAct, onRematch }: Props) {
  if (match.result) {
    return (
      <nav className="actions actions-over" aria-label="Действия">
        <button type="button" className="act act-rematch" onClick={onRematch} data-testid="rematch-panel">
          <ActionIcon kind="rematch" />
          <span className="act-text">
            <span className="act-title">Реванш</span>
            <span className="act-sub">Новая схватка с ботом</span>
          </span>
        </button>
      </nav>
    );
  }
  const items = specs(match);
  return (
    <nav className={`actions ${match.submission ? "actions-duel" : ""}`} aria-label="Действия" aria-busy={busy}>
      {items.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`act act-${b.kind}${b.disabled ? " locked" : ""}`}
          disabled={b.disabled || busy}
          aria-disabled={b.disabled || busy}
          onClick={() => onAct(b.id)}
          data-action={b.id}
        >
          <ActionIcon kind={b.kind} />
          <span className="act-text">
            <span className="act-title">{b.title}</span>
            <span className="act-sub">{b.sub}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
