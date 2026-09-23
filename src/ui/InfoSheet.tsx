import { useEffect, useState } from "react";
import { BASIC_ACTIONS, BASIC_ORDER, POSITION_NAMES, SUBMISSIONS, SUBMISSION_ORDER, TRANSITIONS, TRANSITION_ORDER } from "../engine/catalog";
import type { MatchState, Position } from "../engine/types";

export type SheetTab = "rules" | "map" | "history";
type Tab = SheetTab;
const ROLE: Record<string, string> = { standing: "из стойки", top: "сверху", bottom: "снизу" };
const POSITIONS: Position[] = ["standing", "guard", "halfGuard", "sideControl", "mount", "back"];

export function InfoSheet({ match, initialTab = "rules", onClose, onRestart }: { match: MatchState; initialTab?: Tab; onClose: () => void; onRestart: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Правила и история" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="tabs" role="tablist">
            {(
              [
                ["rules", "Правила"],
                ["map", "Карта позиций"],
                ["history", "История"]
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab on" : "tab"} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="ghost-btn dark" onClick={onClose} aria-label="Продолжить">
            ✕
          </button>
        </div>
        <div className="sheet-actions">
          <span className="paused-label">Пауза</span>
          <button type="button" className="ghost-btn dark" onClick={onClose}>
            Продолжить
          </button>
          <button type="button" className="ghost-btn dark" onClick={onRestart} data-testid="restart">
            Начать заново
          </button>
        </div>
        <div className="sheet-body">
          {tab === "rules" && (
            <div className="rules">
              <p>
                <b>12 обменов.</b> Ты и бот выбираете действие одновременно: бот решает заранее и твой выбор не видит. Победа — сабмишном или по очкам; при равенстве очков решает дыхание, дальше — ничья.
              </p>
              <p>Ресурсы: захваты 0–3, дыхание 0–6. Старт: 0 захватов, 6 дыхания.</p>
              <ul>
                {BASIC_ORDER.map((id) => (
                  <li key={id}>
                    <b>{BASIC_ACTIONS[id].name}</b> — {BASIC_ACTIONS[id].effect}
                  </li>
                ))}
              </ul>
              <p>
                Техника стоит захваты и 1 дыхание. Рамка блокирует переходы, защита шеи — начало сабмишна; заблокированный теряет ещё 1 дыхание. Если атакуют оба — побеждает тот, у кого было больше захватов <i>до</i> оплаты; поровну — обе атаки срываются. После успешного перехода у победителя 1 захват, у соперника 0.
              </p>
              <p>
                Сабмишн (2 захвата + 1 дыхание) открывает решающую дуэль: «Дожать» останавливается «Защитой захвата», «Сменить приём» — «Поворотом». Верная защита снимает приём (атакующий −2 дыхания, захваты обнуляются), неверная — сдача.
              </p>
            </div>
          )}
          {tab === "map" && (
            <div className="map">
              {POSITIONS.map((pos) => (
                <div key={pos} className={pos === match.position ? "map-pos on" : "map-pos"}>
                  <h3>
                    {POSITION_NAMES[pos]}
                    {pos === match.position && <span className="here">сейчас</span>}
                  </h3>
                  <ul>
                    {TRANSITION_ORDER.filter((id) => TRANSITIONS[id].from === pos).map((id) => {
                      const d = TRANSITIONS[id];
                      return (
                        <li key={id}>
                          {d.name} ({ROLE[d.role]}, {d.cost} захв.) → {POSITION_NAMES[d.to]}
                          {d.points ? ` · +${d.points}` : ""}
                        </li>
                      );
                    })}
                    {SUBMISSION_ORDER.filter((id) => SUBMISSIONS[id].from === pos).map((id) => (
                      <li key={id} className="sub">
                        {SUBMISSIONS[id].name} ({ROLE[SUBMISSIONS[id].role]}, 2 захв.) — сабмишн
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {tab === "history" && (
            <ol className="history" data-testid="history">
              {match.history.length === 0 && <li className="empty">Пока пусто</li>}
              {match.history.map((h, i) => (
                <li key={i}>
                  <span className="h-num">
                    {h.exchange}
                    {h.duel ? "·д" : ""}
                  </span>
                  {h.summary}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
