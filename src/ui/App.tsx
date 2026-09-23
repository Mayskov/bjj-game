import { useEffect, useState, useSyncExternalStore } from "react";
import { MAX_BREATH, MAX_EXCHANGES, MAX_GRIPS, POSITION_NAMES, SUBMISSIONS } from "../engine/catalog";
import { seededRng } from "../engine/rng";
import { canAfford, roleOf, techniquesFor } from "../engine/rules";
import type { ActionId, MatchState, Side } from "../engine/types";
import { GameSession } from "../session/session";
import { ActionPanel } from "./ActionPanel";
import { InfoSheet, type SheetTab } from "./InfoSheet";
import { ResultOverlay } from "./ResultOverlay";
import { Scene } from "./Scene";
import { usePrefersReducedMotion } from "./useReducedMotion";

function createSession() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed");
  const script = params.get("botScript");
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return new GameSession({
    rng: seed ? seededRng(Number(seed)) : undefined,
    botScript: script ? (script.split(",").filter(Boolean) as ActionId[]) : undefined,
    reducedMotion: () => !!media?.matches
  });
}

export function App() {
  const [session] = useState(createSession);
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const reduced = usePrefersReducedMotion();
  const [sheet, setSheet] = useState<SheetTab | null>(null);

  useEffect(() => {
    const onVis = () => session.setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    if (import.meta.env.DEV || new URLSearchParams(window.location.search).has("test")) {
      (window as unknown as { __session: GameSession }).__session = session;
    }
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [session]);

  // Открытое меню ставит показ обмена на паузу.
  useEffect(() => {
    session.setPaused("menu", sheet !== null);
  }, [session, sheet]);

  const m = view.match;
  const status = statusFor(m, view.busy);
  return (
    <div className="app" data-round={view.round} data-busy={view.busy ? "1" : "0"}>
      <header className="topbar">
        <div>
          <p className="kicker">04 / Додзё</p>
          <h1 className="logo">Позиционка</h1>
        </div>
        <button type="button" className="round-btn" onClick={() => setSheet("rules")} aria-label="Пауза и меню" data-testid="menu">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="6.5" y="5" width="3.6" height="14" rx="1.4" fill="currentColor" />
            <rect x="13.9" y="5" width="3.6" height="14" rx="1.4" fill="currentColor" />
          </svg>
        </button>
      </header>

      <Scoreboard m={m} />

      <Scene
        frame={view.frame}
        grip={view.grip}
        caption={view.caption}
        indicators={view.indicators}
        tweenMs={reduced ? 0 : session.timing.tween}
        phase={view.phase}
      />

      <section className="status" aria-live="polite">
        <h2 className="pos-title" data-testid="position">
          {POSITION_NAMES[m.position]}
        </h2>
        <span className={`turn-chip turn-${status.tone}`} data-testid="turn">
          <span className="dot" aria-hidden="true" />
          {status.text}
        </span>
        <p className="hint" data-testid="hint">
          {view.busy ? (view.phase === "result" ? "Итог обмена" : "Идёт обмен…") : hintFor(m)}
        </p>
      </section>

      <ActionPanel match={m} busy={view.busy} onAct={(a) => session.act(a)} onRematch={() => session.restart()} />

      <button type="button" className="history-link" onClick={() => setSheet("history")}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        История
      </button>

      {sheet && (
        <InfoSheet
          match={m}
          initialTab={sheet}
          onClose={() => setSheet(null)}
          onRestart={() => {
            setSheet(null);
            session.restart();
          }}
        />
      )}
      {view.showResult && m.result && <ResultOverlay match={m} onRematch={() => session.restart()} onClose={() => session.closeResult()} />}
    </div>
  );
}

function statusFor(m: MatchState, busy: boolean): { text: string; tone: "turn" | "wait" | "danger" | "over" } {
  if (m.result) return { text: "Схватка окончена", tone: "over" };
  if (busy) return { text: "Идёт обмен", tone: "wait" };
  if (m.submission) {
    const name = SUBMISSIONS[m.submission.technique].name.toLowerCase();
    return m.submission.attacker === "bot" ? { text: `Защищайся: ${name}`, tone: "danger" } : { text: `Ваш ход: ${name}`, tone: "turn" };
  }
  return { text: "Ваш ход", tone: "turn" };
}

function Pips({ value, max, kind, label }: { value: number; max: number; kind: "grip" | "breath"; label: string }) {
  return (
    <div className={`pips pips-${kind}`} role="img" aria-label={`${label}: ${value} из ${max}`}>
      <span className="pips-label" aria-hidden="true">
        {kind === "grip" ? "Захв" : "Дых"}
      </span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? "pip on" : "pip"} />
      ))}
    </div>
  );
}

function Resources({ side, m }: { side: Side; m: MatchState }) {
  const f = m.fighters[side];
  return (
    <div className={`res res-${side}`} data-testid={`card-${side}`}>
      <Pips value={f.grips} max={MAX_GRIPS} kind="grip" label={side === "player" ? "Твои захваты" : "Захваты бота"} />
      <Pips value={f.breath} max={MAX_BREATH} kind="breath" label={side === "player" ? "Твоё дыхание" : "Дыхание бота"} />
      <span className="sr-only" data-testid={`res-${side}`}>
        {f.grips}/{f.breath}
      </span>
    </div>
  );
}

function Scoreboard({ m }: { m: MatchState }) {
  return (
    <section className="scoreboard" aria-label="Счёт и ресурсы">
      <div className="score-pill">
        <span className="score-name">
          <span className="swatch swatch-player" aria-hidden="true" />
          Вы
        </span>
        <b className="score-num score-player" data-testid="score-player">
          {m.fighters.player.score}
        </b>
        <span className="score-colon">:</span>
        <b className="score-num score-bot" data-testid="score-bot">
          {m.fighters.bot.score}
        </b>
        <span className="score-name">
          Бот
          <span className="swatch swatch-bot" aria-hidden="true" />
        </span>
      </div>
      <div className="score-row">
        <Resources side="player" m={m} />
        <span className="exchange" data-testid="exchange">
          обмен {m.exchange} / {MAX_EXCHANGES}
        </span>
        <Resources side="bot" m={m} />
      </div>
    </section>
  );
}

export function hintFor(m: MatchState): string {
  if (m.result) return "Схватка окончена — жми «Реванш»";
  if (m.submission) {
    const name = SUBMISSIONS[m.submission.technique].name;
    return m.submission.attacker === "player" ? `${name} зафиксирован — выбери продолжение` : `Ты под угрозой (${name.toLowerCase()}) — выбери защиту`;
  }
  const role = roleOf(m, "player");
  const canAttack = techniquesFor(m, "player").some((id) => canAfford(m.fighters.player, id));
  if (m.position === "standing") return canAttack ? "Стойка — проходи в ноги или затягивай в гард" : "Набери захват, чтобы открыть техники";
  const where: Record<Exclude<MatchState["position"], "standing">, [string, string, string, string]> = {
    guard: ["Ты сверху в гарде", "раскрывай гард", "Ты снизу в гарде", "свип или треугольник"],
    halfGuard: ["Ты сверху в халф гарде", "проходи гард или забирай спину", "Ты снизу в халф гарде", "свип, спина или верни гард"],
    sideControl: ["Ты в боковом контроле", "маунт или кимура", "Ты под боковым контролем", "верни халф гард"],
    mount: ["Ты в маунте", "спина или рычаг локтя", "Ты под маунтом", "локоть–колено"],
    back: ["Ты на спине бота", "души", "Бот на твоей спине", "сползай в гард"]
  };
  const [topText, topTip, bottomText, bottomTip] = where[m.position];
  const text = role === "top" ? topText : bottomText;
  return `${text} — ${canAttack ? (role === "top" ? topTip : bottomTip) : "набери захват"}`;
}
