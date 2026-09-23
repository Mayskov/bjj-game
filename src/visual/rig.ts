/**
 * Двухмерный скелетный риг бойца. Позы задаются ключевыми точками
 * (таз, наклон корпуса, цели для кистей и стоп), локти и колени решаются IK,
 * поэтому пропорции бойца одинаковы во всех кадрах.
 */
export type Pt = [number, number];

export const FLOOR_Y = 228;
export const SCENE_W = 400;

export const BODY = {
  torso: 50,
  neck: 16,
  head: 11.5,
  upperArm: 27,
  forearm: 25,
  thigh: 36,
  shin: 34,
  foot: 10
} as const;

export type Bend = 1 | -1;

export interface FighterSpec {
  hip: Pt;
  /** Угол таз → плечи, градусы (−90 — вертикально вверх, 180 — влево). */
  torso: number;
  /** Угол плечи → голова. По умолчанию как у корпуса. */
  neck?: number;
  /** Сторона лица относительно шеи: 1 — по часовой, −1 — против. */
  dir: 1 | -1;
  /** Коэффициент длины корпуса для ракурса. */
  tl?: number;
  nh: Pt;
  fh: Pt;
  nf: Pt;
  ff: Pt;
  /** Изгиб локтей/коленей: +1 — по часовой от линии «корень → цель». */
  bnh?: Bend;
  bfh?: Bend;
  bnf?: Bend;
  bff?: Bend;
  /** Направление носка стопы (переопределение), в градусах. */
  ntoe?: number;
  ftoe?: number;
}

export interface Joints {
  hd: Pt;
  /** Точка на лице (направление взгляда). */
  fc: Pt;
  s: Pt;
  h: Pt;
  ne: Pt;
  nw: Pt;
  fe: Pt;
  fw: Pt;
  nk: Pt;
  na: Pt;
  nt: Pt;
  fk: Pt;
  fa: Pt;
  ft: Pt;
}

export const JOINT_KEYS: (keyof Joints)[] = ["hd", "fc", "s", "h", "ne", "nw", "fe", "fw", "nk", "na", "nt", "fk", "fa", "ft"];

const rad = (deg: number) => (deg * Math.PI) / 180;
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Поворот на 90° по часовой стрелке в экранных координатах (ось y вниз). */
export const cw = (a: Pt): Pt => [-a[1], a[0]];
const polar = (deg: number, r: number): Pt => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r];

/** Двухзвенный IK. Возвращает [средний сустав, конечная точка]. */
export function solveIK(root: Pt, target: Pt, l1: number, l2: number, bend: Bend): [Pt, Pt] {
  const v = sub(target, root);
  const raw = len(v);
  const u = raw > 0.0001 ? mul(v, 1 / raw) : ([1, 0] as Pt);
  const d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.2, raw));
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mid = add(add(root, mul(u, a)), mul(cw(u), h * bend));
  return [mid, add(root, mul(u, d))];
}

function toe(ankle: Pt, knee: Pt, dir: 1 | -1, override?: number): Pt {
  if (override !== undefined) return add(ankle, polar(override, BODY.foot));
  const v = norm(sub(ankle, knee));
  const tip: Pt = [v[1] * dir, -v[0] * dir];
  return add(ankle, add(mul(tip, BODY.foot), mul(v, 2)));
}

export function solveFighter(spec: FighterSpec): Joints {
  const tl = spec.tl ?? 1;
  const h = spec.hip;
  const s = add(h, polar(spec.torso, BODY.torso * tl));
  const neckAngle = spec.neck ?? spec.torso;
  const hd = add(s, polar(neckAngle, BODY.neck));
  const nv = norm(polar(neckAngle, 1));
  const faceDir: Pt = spec.dir === 1 ? cw(nv) : mul(cw(nv), -1);
  const fc = add(hd, mul(faceDir, BODY.head));
  const armBendDefault = spec.dir;
  const legBendDefault = (-spec.dir) as Bend;
  const [ne, nw] = solveIK(s, spec.nh, BODY.upperArm, BODY.forearm, spec.bnh ?? armBendDefault);
  const [fe, fw] = solveIK(s, spec.fh, BODY.upperArm, BODY.forearm, spec.bfh ?? armBendDefault);
  const [nk, na] = solveIK(h, spec.nf, BODY.thigh, BODY.shin, spec.bnf ?? legBendDefault);
  const [fk, fa] = solveIK(h, spec.ff, BODY.thigh, BODY.shin, spec.bff ?? legBendDefault);
  return {
    hd,
    fc,
    s,
    h,
    ne,
    nw,
    fe,
    fw,
    nk,
    na,
    nt: toe(na, nk, spec.dir, spec.ntoe),
    fk,
    fa,
    ft: toe(fa, fk, spec.dir, spec.ftoe)
  };
}

export function mirrorJoints(j: Joints): Joints {
  const out = {} as Joints;
  for (const key of JOINT_KEYS) out[key] = [SCENE_W - j[key][0], j[key][1]];
  return out;
}

export function lerpJoints(a: Joints, b: Joints, t: number): Joints {
  const out = {} as Joints;
  for (const key of JOINT_KEYS) out[key] = lerpPt(a[key], b[key], t);
  return out;
}

/** Переставить руку на новую цель, сохранив сторону изгиба локтя. */
export function reachArm(j: Joints, arm: "n" | "f", target: Pt, bendOverride?: Bend): Joints {
  const elbowKey = arm === "n" ? "ne" : "fe";
  const handKey = arm === "n" ? "nw" : "fw";
  const bend = bendOverride ?? sideOf(j.s, j[handKey], j[elbowKey]);
  const [e, w] = solveIK(j.s, target, BODY.upperArm, BODY.forearm, bend);
  return { ...j, [elbowKey]: e, [handKey]: w };
}

export function reachLeg(j: Joints, leg: "n" | "f", target: Pt, bendOverride?: Bend): Joints {
  const kneeKey = leg === "n" ? "nk" : "fk";
  const ankleKey = leg === "n" ? "na" : "fa";
  const toeKey = leg === "n" ? "nt" : "ft";
  const bend = bendOverride ?? sideOf(j.h, j[ankleKey], j[kneeKey]);
  const [k, a] = solveIK(j.h, target, BODY.thigh, BODY.shin, bend);
  const offset = sub(j[toeKey], j[ankleKey]);
  return { ...j, [kneeKey]: k, [ankleKey]: a, [toeKey]: add(a, offset) };
}

function sideOf(root: Pt, end: Pt, mid: Pt): Bend {
  const u = sub(end, root);
  const m = sub(mid, root);
  const c = cw(u);
  return m[0] * c[0] + m[1] * c[1] >= 0 ? 1 : -1;
}

/** Точки соперника, к которым тянутся руки базовых действий. */
export function anchors(j: Joints) {
  const up = norm(sub(j.hd, j.s));
  return {
    collar: lerpPt(j.s, j.hd, 0.25),
    neck: lerpPt(j.s, j.hd, 0.55),
    chest: lerpPt(j.s, j.h, 0.3),
    belt: lerpPt(j.s, j.h, 0.82),
    hip: j.h,
    sleeve: j.ne,
    knee: j.nk,
    chin: add(lerpPt(j.hd, j.fc, 0.6), mul(up, -6))
  };
}
