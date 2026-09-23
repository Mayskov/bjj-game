import { SUBMISSIONS } from "../engine/catalog";
import type { MatchState } from "../engine/types";

export function ResultOverlay({ match, onRematch, onClose }: { match: MatchState; onRematch: () => void; onClose: () => void }) {
  const r = match.result!;
  const p = match.fighters.player;
  const b = match.fighters.bot;
  const title = r.winner === null ? "Ничья" : r.winner === "player" ? "Победа!" : "Поражение";
  const reason =
    r.reason === "submission"
      ? `Сабмишн: ${SUBMISSIONS[r.technique!].name}${r.winner === "player" ? " — бот сдался" : " — ты сдался"}`
      : r.reason === "points"
        ? "По очкам после 12 обменов"
        : r.reason === "breath"
          ? `Очки равны — решило дыхание (${p.breath} : ${b.breath})`
          : "Очки и дыхание равны";
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={`result-card result-${r.winner ?? "draw"}`} data-testid="result">
        <p className="result-kicker">Схватка окончена</p>
        <h2 id="result-title">{title}</h2>
        <p className="result-reason" data-testid="result-reason">
          {reason}
        </p>
        <div className="result-score">
          <span>
            <span className="swatch swatch-player" /> Ты <b>{p.score}</b>
          </span>
          <span>:</span>
          <span>
            <b>{b.score}</b> Бот <span className="swatch swatch-bot" />
          </span>
        </div>
        <div className="result-buttons">
          <button type="button" className="act act-rematch" onClick={onRematch} data-testid="rematch" autoFocus>
            <span className="act-title">Реванш</span>
          </button>
          <button type="button" className="ghost-btn dark" onClick={onClose}>
            Смотреть сцену
          </button>
        </div>
      </div>
    </div>
  );
}
