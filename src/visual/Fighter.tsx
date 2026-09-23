import type { ReactElement } from "react";
import type { FighterPalette } from "./palette";
import { add, cw, lerpPt, mul, norm, sub, type Joints, type Pt } from "./rig";

export type PartKind = "fa" | "fl" | "t" | "h" | "nl" | "na";
export type Role = "A" | "B";
export type PartId = `${Role}.${PartKind}`;

const LIGHT: Pt = norm([-0.45, -0.9]);
const f1 = (n: number) => n.toFixed(1);

function capsule(p1: Pt, p2: Pt, r1: number, r2: number): string {
  const u = norm(sub(p2, p1));
  const n = cw(u);
  const a1 = add(p1, mul(n, r1));
  const a2 = add(p2, mul(n, r2));
  const b2 = add(p2, mul(n, -r2));
  const b1 = add(p1, mul(n, -r1));
  return `M${f1(a1[0])} ${f1(a1[1])}L${f1(a2[0])} ${f1(a2[1])}A${r2} ${r2} 0 0 0 ${f1(b2[0])} ${f1(b2[1])}L${f1(b1[0])} ${f1(b1[1])}A${r1} ${r1} 0 0 0 ${f1(a1[0])} ${f1(a1[1])}Z`;
}

function highlight(p1: Pt, p2: Pt, r: number): string {
  const u = norm(sub(p2, p1));
  const n = cw(u);
  const sign = n[0] * LIGHT[0] + n[1] * LIGHT[1] >= 0 ? 1 : -1;
  const off = mul(n, r * 0.45 * sign);
  const a = add(lerpPt(p1, p2, 0.12), off);
  const b = add(lerpPt(p1, p2, 0.85), off);
  return `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
}

interface SegProps {
  p1: Pt;
  p2: Pt;
  r1: number;
  r2: number;
  fill: string;
  hi?: string;
  outline: string;
}

function Seg({ p1, p2, r1, r2, fill, hi, outline }: SegProps) {
  return (
    <>
      <path d={capsule(p1, p2, r1, r2)} fill={fill} stroke={outline} strokeWidth={1.8} strokeLinejoin="round" />
      {hi && <path d={highlight(p1, p2, (r1 + r2) / 2)} stroke={hi} strokeWidth={(r1 + r2) * 0.16} strokeLinecap="round" opacity={0.55} fill="none" />}
    </>
  );
}

function Arm({ j, near, pal }: { j: Joints; near: boolean; pal: FighterPalette }) {
  const e = near ? j.ne : j.fe;
  const w = near ? j.nw : j.fw;
  const gi = near ? pal.gi : pal.giShade;
  const skin = near ? pal.skin : pal.skinShade;
  const cuff = lerpPt(e, w, 0.78);
  return (
    <g>
      <Seg p1={e} p2={w} r1={5.2} r2={4.6} fill={skin} outline={pal.outline} />
      <Seg p1={j.s} p2={e} r1={9} r2={7.6} fill={gi} hi={near ? pal.giHi : undefined} outline={pal.outline} />
      <Seg p1={e} p2={cuff} r1={7.6} r2={7} fill={gi} hi={near ? pal.giHi : undefined} outline={pal.outline} />
      <circle cx={w[0]} cy={w[1]} r={6.2} fill={skin} stroke={pal.outline} strokeWidth={1.8} />
    </g>
  );
}

function Leg({ j, near, pal }: { j: Joints; near: boolean; pal: FighterPalette }) {
  const k = near ? j.nk : j.fk;
  const a = near ? j.na : j.fa;
  const t = near ? j.nt : j.ft;
  const gi = near ? pal.gi : pal.giShade;
  const skin = near ? pal.skin : pal.skinShade;
  const cuff = lerpPt(k, a, 0.86);
  return (
    <g>
      <Seg p1={a} p2={t} r1={5.4} r2={4.2} fill={skin} outline={pal.outline} />
      <Seg p1={k} p2={a} r1={7} r2={5.6} fill={skin} outline={pal.outline} />
      <Seg p1={j.h} p2={k} r1={12.5} r2={10} fill={gi} hi={near ? pal.giHi : undefined} outline={pal.outline} />
      <Seg p1={k} p2={cuff} r1={10} r2={8.6} fill={gi} hi={near ? pal.giHi : undefined} outline={pal.outline} />
    </g>
  );
}

function Torso({ j, pal }: { j: Joints; pal: FighterPalette }) {
  const axis = norm(sub(j.s, j.h));
  const n = cw(axis);
  const faceSide = sub(j.fc, j.hd);
  const front = faceSide[0] * n[0] + faceSide[1] * n[1] >= 0 ? n : mul(n, -1);
  const beltC = lerpPt(j.h, j.s, 0.2);
  const rb = 15;
  const b1 = add(add(beltC, mul(n, rb)), mul(axis, 3.2));
  const b2 = add(add(beltC, mul(n, -rb)), mul(axis, 3.2));
  const b3 = add(add(beltC, mul(n, -rb)), mul(axis, -3.2));
  const b4 = add(add(beltC, mul(n, rb)), mul(axis, -3.2));
  const knot = add(beltC, mul(front, rb - 3));
  const tailDir: Pt = norm(add([0, 1], mul(front, 0.5)));
  const tailA = add(knot, add(mul(tailDir, 11), mul(cw(tailDir), 3)));
  const tailB = add(knot, add(mul(tailDir, 12), mul(cw(tailDir), -2.5)));
  const neckBase = add(j.s, mul(front, 6));
  const lapelEnd = add(lerpPt(j.h, j.s, 0.26), mul(front, 11));
  const vTip = add(add(j.s, mul(front, 9)), mul(axis, -12));
  const pts = (arr: Pt[]) => arr.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ");
  return (
    <g>
      <path d={capsule(j.h, j.s, 15.5, 16.5)} fill={pal.gi} stroke={pal.outline} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={highlight(j.h, j.s, 16)} stroke={pal.giHi} strokeWidth={4} strokeLinecap="round" opacity={0.45} fill="none" />
      <polygon points={pts([add(j.s, mul(front, 3)), add(j.s, mul(front, 13)), vTip])} fill={pal.skin} stroke={pal.outline} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={`M${f1(neckBase[0])} ${f1(neckBase[1])}L${f1(lapelEnd[0])} ${f1(lapelEnd[1])}`} stroke={pal.outline} strokeWidth={6.5} strokeLinecap="round" />
      <path d={`M${f1(neckBase[0])} ${f1(neckBase[1])}L${f1(lapelEnd[0])} ${f1(lapelEnd[1])}`} stroke={pal.lapel} strokeWidth={3.6} strokeLinecap="round" />
      <polygon points={pts([b1, b2, b3, b4])} fill={pal.belt} stroke={pal.beltEdge} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={`M${f1(knot[0])} ${f1(knot[1])}L${f1(tailA[0])} ${f1(tailA[1])}M${f1(knot[0])} ${f1(knot[1])}L${f1(tailB[0])} ${f1(tailB[1])}`} stroke={pal.beltEdge} strokeWidth={5.6} strokeLinecap="round" />
      <path d={`M${f1(knot[0])} ${f1(knot[1])}L${f1(tailA[0])} ${f1(tailA[1])}M${f1(knot[0])} ${f1(knot[1])}L${f1(tailB[0])} ${f1(tailB[1])}`} stroke={pal.belt} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={knot[0]} cy={knot[1]} r={3.6} fill={pal.belt} stroke={pal.beltEdge} strokeWidth={1.4} />
    </g>
  );
}

function Head({ j, pal }: { j: Joints; pal: FighterPalette }) {
  const r = 11.5;
  const f = norm(sub(j.fc, j.hd));
  const up = norm(sub(j.hd, j.s));
  const back = mul(f, -1);
  const hairCenter = norm(add(mul(back, 0.8), mul(up, 1)));
  const ang = Math.atan2(hairCenter[1], hairCenter[0]);
  const span = 1.85;
  const p1: Pt = add(j.hd, [Math.cos(ang - span) * (r + 1.2), Math.sin(ang - span) * (r + 1.2)]);
  const p2: Pt = add(j.hd, [Math.cos(ang + span) * (r + 1.2), Math.sin(ang + span) * (r + 1.2)]);
  const inner = add(j.hd, mul(hairCenter, 3));
  const neckA = lerpPt(j.s, j.hd, 0.15);
  const eye = add(add(j.hd, mul(f, 6.5)), mul(up, 2.2));
  const browA = add(add(j.hd, mul(f, 4)), mul(up, 5.2));
  const browB = add(add(j.hd, mul(f, 9)), mul(up, 5.4));
  const nose = add(add(j.hd, mul(f, 11.2)), mul(up, -0.5));
  const ear = add(j.hd, mul(back, 1.5));
  const mouthA = add(add(j.hd, mul(f, 6.5)), mul(up, -5.5));
  const mouthB = add(add(j.hd, mul(f, 9.5)), mul(up, -5));
  return (
    <g>
      <path d={capsule(neckA, j.hd, 5.6, 5.6)} fill={pal.skinShade} stroke={pal.outline} strokeWidth={2} />
      <circle cx={nose[0]} cy={nose[1]} r={2.6} fill={pal.skin} stroke={pal.outline} strokeWidth={1.6} />
      <circle cx={j.hd[0]} cy={j.hd[1]} r={r} fill={pal.skin} stroke={pal.outline} strokeWidth={1.8} />
      <path
        d={`M${f1(p1[0])} ${f1(p1[1])}A${r + 1.2} ${r + 1.2} 0 0 1 ${f1(p2[0])} ${f1(p2[1])}Q${f1(inner[0])} ${f1(inner[1])} ${f1(p1[0])} ${f1(p1[1])}Z`}
        fill={pal.hair}
        stroke={pal.outline}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <ellipse cx={ear[0]} cy={ear[1]} rx={2.6} ry={3.4} fill={pal.skinShade} stroke={pal.outline} strokeWidth={1.2} />
      <circle cx={eye[0]} cy={eye[1]} r={1.5} fill={pal.eye} />
      <path d={`M${f1(browA[0])} ${f1(browA[1])}L${f1(browB[0])} ${f1(browB[1])}`} stroke={pal.hair} strokeWidth={1.8} strokeLinecap="round" />
      <path d={`M${f1(mouthA[0])} ${f1(mouthA[1])}L${f1(mouthB[0])} ${f1(mouthB[1])}`} stroke={pal.skinShade} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

export function renderPart(kind: PartKind, j: Joints, pal: FighterPalette): ReactElement {
  switch (kind) {
    case "fa":
      return <Arm j={j} near={false} pal={pal} />;
    case "na":
      return <Arm j={j} near pal={pal} />;
    case "fl":
      return <Leg j={j} near={false} pal={pal} />;
    case "nl":
      return <Leg j={j} near pal={pal} />;
    case "t":
      return <Torso j={j} pal={pal} />;
    case "h":
      return <Head j={j} pal={pal} />;
  }
}
