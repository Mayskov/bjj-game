import type { ReactElement } from "react";
/** Простые пиктограммы действий: цвет кнопки — тип действия, иконка — само действие. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const PATHS: Record<string, ReactElement> = {
  grip: <path {...P} d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v5m0-4a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5A6.5 6.5 0 0 1 5 16l-1.4-3a1.5 1.5 0 0 1 2.6-1.4L7 13" />,
  frame: <path {...P} d="M4 12h9m0 0-3-3m3 3-3 3M17 5v14" />,
  neck: <path {...P} d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" />,
  breathe: <path {...P} d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" />,
  transition: <path {...P} d="M4 12h14m0 0-5-5m5 5-5 5" />,
  submission: (
    <>
      <rect {...P} x="5" y="11" width="14" height="10" rx="2" />
      <path {...P} d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  finish: <path {...P} d="M4 4l6 6m10-6-6 6M4 20l6-6m10 6-6-6" />,
  switch: <path {...P} d="M4 8h13l-3-3M20 16H7l3 3" />,
  defendGrip: <path {...P} d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
  turn: <path {...P} d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  rematch: <path {...P} d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
};

export function ActionIcon({ kind }: { kind: string }) {
  return (
    <svg className="act-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {PATHS[kind] ?? PATHS.transition}
    </svg>
  );
}
