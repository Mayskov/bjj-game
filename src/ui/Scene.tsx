import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Side } from "../engine/types";
import type { Caption, Indicator } from "../session/sequence";
import { DojoBackdrop } from "../visual/Dojo";
import { FighterLayer, type FramePose } from "../visual/FighterLayer";
import { resolveFrame, type ResolvedFrame, type SceneFrame } from "../visual/manifest";
import { lerpJoints } from "../visual/rig";

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function blend(a: ResolvedFrame, b: ResolvedFrame, t: number): ResolvedFrame {
  // Роли могут поменяться (например, после свипа) — сопоставляем бойцов по стороне, а не по роли.
  const byA = (f: ResolvedFrame, side: Side) => (f.roles.A === side ? f.A : f.B);
  const pick = (role: "A" | "B") => {
    const side = b.roles[role];
    return lerpJoints(byA(a, side), byA(b, side), t);
  };
  return {
    ...b,
    A: pick("A"),
    B: pick("B"),
    order: t < 0.5 ? remapOrder(a, b) : b.order,
    marks: t < 0.85 ? [] : b.marks
  };
}

/** Порядок слоёв предыдущего кадра, выраженный в ролях нового кадра. */
function remapOrder(a: ResolvedFrame, b: ResolvedFrame): FramePose["order"] {
  if (a.roles.A === b.roles.A) return a.order;
  return a.order.map((id) => ((id.startsWith("A.") ? "B." : "A.") + id.slice(2)) as FramePose["order"][number]);
}

function useAnimatedFrame(frame: SceneFrame, tweenMs: number): ResolvedFrame {
  const target = useMemo(() => resolveFrame(frame), [frame]);
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    if (tweenMs <= 0) {
      setShown(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / tweenMs);
      setShown(t >= 1 ? target : blend(from, target, ease(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // При отмене (новый кадр, уход в фон) сразу фиксируем целевую позу — без пустых вспышек.
    return () => {
      cancelAnimationFrame(raf);
      shownRef.current = target;
      setShown(target);
    };
  }, [target, tweenMs]);

  return shown;
}

const ICON: Record<Indicator["icon"], string> = {
  plus: "+",
  minus: "−",
  check: "•",
  cross: "✕",
  shield: "🛡",
  lock: "🔒",
  tap: "✋",
  star: "★"
};

function IndicatorColumn({ side, items }: { side: Side; items: Indicator[] }) {
  return (
    <ul className={`indicators indicators-${side}`} aria-label={side === "player" ? "Итог для тебя" : "Итог для бота"}>
      {items.map((it, i) => (
        <li key={`${i}-${it.text}`} className={`chip chip-${it.tone}`} style={{ animationDelay: `${i * 70}ms` }} data-testid={`ind-${side}`}>
          <span className="chip-icon" aria-hidden="true">
            {ICON[it.icon]}
          </span>
          {it.text}
        </li>
      ))}
    </ul>
  );
}

export interface SceneProps {
  frame: SceneFrame;
  grip: boolean;
  caption: Caption | null;
  indicators: Record<Side, Indicator[]>;
  tweenMs: number;
  phase: string;
}

/** Камера: минимум 210×166 единиц сцены, остальное место — фон додзё. Бойцы крупнее на высоких экранах. */
const CAM = { cx: 200, floor: 266, minW: 214, minH: 196 };

function useCamera() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 360, h: 260 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth || 360, h: el.clientHeight || 260 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(box.w / CAM.minW, box.h / CAM.minH);
  const vw = box.w / scale;
  const vh = box.h / scale;
  return { ref, viewBox: `${(CAM.cx - vw / 2).toFixed(1)} ${(CAM.floor - vh).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}` };
}

export function Scene({ frame, grip, caption, indicators, tweenMs, phase }: SceneProps) {
  const pose = useAnimatedFrame(frame, tweenMs);
  const top = pose.roles;
  const cam = useCamera();
  return (
    <div ref={cam.ref} className="scene" data-phase={phase} data-pose={pose.poseId} data-grip={grip ? "1" : "0"} data-roles={`${top.A}-${top.B}`}>
      <svg className="scene-svg" viewBox={cam.viewBox} preserveAspectRatio="xMidYMax meet" role="img" aria-label={`Сцена: ${pose.poseId}`}>
        <DojoBackdrop />
        <g className={grip ? "fighters dim" : "fighters"}>
          <FighterLayer pose={pose} sides={pose.roles} />
        </g>
      </svg>
      <div className="side-tag side-tag-player" aria-hidden="true">
        <span className="swatch swatch-player" />Ты
      </div>
      <div className="side-tag side-tag-bot" aria-hidden="true">
        Бот<span className="swatch swatch-bot" />
      </div>
      <IndicatorColumn side="player" items={indicators.player} />
      <IndicatorColumn side="bot" items={indicators.bot} />
      {grip && <GripSpinner />}
      {caption && !grip && (
        <div className={`caption caption-${caption.tone} caption-${caption.who ?? "none"}`} data-testid="caption" role="status">
          <span className="caption-tag">{caption.tag}</span>
          <span className="caption-text">{caption.text}</span>
        </div>
      )}
    </div>
  );
}

function GripSpinner() {
  return (
    <div className="grip-spinner" data-testid="grip-spinner" aria-label="Борьба за захват">
      <svg viewBox="-40 -40 80 80" width="76" height="76" aria-hidden="true">
        <circle r="30" fill="rgba(20,12,6,.55)" />
        <g className="grip-arc grip-arc-a">
          <path d="M0 -24 A24 24 0 0 1 24 0" stroke="#15161b" strokeWidth="9" fill="none" strokeLinecap="round" />
          <circle cx="24" cy="0" r="7" fill="#c98e62" stroke="#08080b" strokeWidth="2" />
        </g>
        <g className="grip-arc grip-arc-b">
          <path d="M0 24 A24 24 0 0 1 -24 0" stroke="#f7f4ec" strokeWidth="9" fill="none" strokeLinecap="round" />
          <circle cx="-24" cy="0" r="7" fill="#f1c9a3" stroke="#34323c" strokeWidth="2" />
        </g>
        <circle r="5" fill="#ffd23f" />
      </svg>
    </div>
  );
}
