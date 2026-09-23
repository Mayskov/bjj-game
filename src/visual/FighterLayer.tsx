import { Fragment } from "react";
import type { Side } from "../engine/types";
import { renderPart, type PartId, type Role } from "./Fighter";
import { PALETTES } from "./palette";
import type { Joints, Pt } from "./rig";
import type { MarkKind } from "./poses";

export interface ResolvedMark {
  kind: MarkKind;
  at: Pt;
  r?: number;
}

export interface FramePose {
  A: Joints;
  B: Joints;
  order: PartId[];
  marks: ResolvedMark[];
}

function shadowFor(j: Joints) {
  const xs = [j.h[0], j.s[0], j.na[0], j.fa[0], j.hd[0]];
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  return { cx: (min + max) / 2, rx: (max - min) / 2 + 18 };
}

export function FighterLayer({ pose, sides }: { pose: FramePose; sides: Record<Role, Side> }) {
  const sa = shadowFor(pose.A);
  const sb = shadowFor(pose.B);
  return (
    <g>
      <ellipse cx={sa.cx} cy={229} rx={sa.rx} ry={7} fill="#5c6b80" opacity={0.28} />
      <ellipse cx={sb.cx} cy={229} rx={sb.rx} ry={7} fill="#5c6b80" opacity={0.28} />
      {pose.order.map((id) => {
        const [role, kind] = id.split(".") as [Role, Parameters<typeof renderPart>[0]];
        const side = sides[role];
        return (
          <g key={id} data-part={id} data-side={side}>
            {renderPart(kind, pose[role], PALETTES[side])}
          </g>
        );
      })}
      {pose.marks.map((m, i) => (
        <Fragment key={i}>{renderMark(m)}</Fragment>
      ))}
    </g>
  );
}

function renderMark(m: ResolvedMark) {
  const [x, y] = m.at;
  switch (m.kind) {
    case "lock":
      return (
        <g className="mark mark-lock">
          <circle cx={x} cy={y} r={m.r ?? 22} fill="none" stroke="#f08a0c" strokeWidth={3} strokeDasharray="6 4" />
          <circle cx={x} cy={y} r={(m.r ?? 22) + 3} fill="none" stroke="#1d1305" strokeWidth={1} opacity={0.5} />
        </g>
      );
    case "squeeze":
      return (
        <g className="mark mark-squeeze" stroke="#ff7a1a" strokeWidth={3} strokeLinecap="round" fill="none">
          <path d={`M${x - 20} ${y - 12} l8 6 M${x - 22} ${y + 2} l9 0 M${x - 20} ${y + 14} l8 -6`} />
          <path d={`M${x + 20} ${y - 12} l-8 6 M${x + 22} ${y + 2} l-9 0 M${x + 20} ${y + 14} l-8 -6`} />
        </g>
      );
    case "tap":
      return (
        <g className="mark mark-tap">
          <circle cx={x} cy={y} r={9} fill="none" stroke="#fff" strokeWidth={2.5} />
          <circle cx={x} cy={y} r={15} fill="none" stroke="#fff" strokeWidth={2} opacity={0.6} />
          <g transform={`translate(${x} ${y - 30})`}>
            <rect x={-24} y={-10} width={48} height={20} rx={6} fill="#d62f2f" stroke="#fff" strokeWidth={2} />
            <text x={0} y={5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff" letterSpacing={1}>
              ТАП
            </text>
          </g>
        </g>
      );
    case "shield":
      return (
        <g className="mark mark-shield">
          <path d={`M${x} ${y - 11} l9 4 v6 c0 6 -5 10 -9 12 c-4 -2 -9 -6 -9 -12 v-6z`} fill="#2bb673" stroke="#fff" strokeWidth={2} />
        </g>
      );
    case "block":
      return (
        <g className="mark mark-block">
          <circle cx={x} cy={y} r={11} fill="#2f7fe0" stroke="#fff" strokeWidth={2} />
          <path d={`M${x - 5} ${y}h10`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case "breath":
      return (
        <g className="mark mark-breath" fill="#e9fbff" stroke="#5aa9c9" strokeWidth={1.4}>
          <circle cx={x} cy={y} r={4} />
          <circle cx={x + 8} cy={y - 7} r={5.5} />
          <circle cx={x + 18} cy={y - 15} r={7} />
        </g>
      );
  }
}
