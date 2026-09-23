import type { PartId, Role } from "./Fighter";
import { SCENE_W, anchors, reachArm, solveFighter, type FighterSpec, type Joints, type Pt } from "./rig";

/**
 * Библиотека поз. Роли:
 *  - стойка: A — боец слева (в попытках — атакующий), B — справа;
 *  - партер: A — верхний / контролирующий, B — нижний / защищающийся.
 * `left` — какая роль нарисована слева; при показе сцена отражается так,
 * чтобы игрок по возможности оставался слева, но верх/низ не меняются.
 */
export type MarkKind = "lock" | "tap" | "squeeze" | "shield" | "breath" | "block";

export interface MarkDef {
  kind: MarkKind;
  at: (j: PoseJoints) => Pt;
  r?: number;
}

export interface PoseJoints {
  A: Joints;
  B: Joints;
}

export interface PoseDef {
  id: string;
  label: string;
  left: Role;
  A: FighterSpec;
  B: FighterSpec;
  order: PartId[];
  adjust?: (j: PoseJoints) => PoseJoints;
  marks?: MarkDef[];
}

export function mirrorSpec(s: FighterSpec): FighterSpec {
  const m = (p: Pt): Pt => [SCENE_W - p[0], p[1]];
  const flip = (b?: 1 | -1) => (b === undefined ? undefined : ((-b) as 1 | -1));
  const ang = (a?: number) => (a === undefined ? undefined : 180 - a);
  return {
    ...s,
    hip: m(s.hip),
    torso: 180 - s.torso,
    neck: ang(s.neck),
    dir: (-s.dir) as 1 | -1,
    nh: m(s.nh),
    fh: m(s.fh),
    nf: m(s.nf),
    ff: m(s.ff),
    bnh: flip(s.bnh),
    bfh: flip(s.bfh),
    bnf: flip(s.bnf),
    bff: flip(s.bff),
    ntoe: ang(s.ntoe),
    ftoe: ang(s.ftoe)
  };
}

const o = (...ids: PartId[]) => ids;

// ---------------------------------------------------------------- Стойка
const standA: FighterSpec = {
  hip: [150, 166],
  torso: -82,
  neck: -76,
  dir: 1,
  nh: [194, 132],
  fh: [186, 142],
  nf: [170, 228],
  ff: [126, 228]
};
const standB = mirrorSpec(standA);
const STAND_ORDER = o("B.fa", "B.fl", "A.fa", "A.fl", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "B.na", "A.na");

// ---------------------------------------------------------------- Нижний на спине (голова слева)
const lyingB = (hipX: number, extra: Partial<FighterSpec> = {}): FighterSpec => ({
  hip: [hipX, 211],
  torso: 180,
  neck: 184,
  dir: 1,
  nh: [hipX - 40, 196],
  fh: [hipX - 45, 190],
  nf: [hipX + 60, 224],
  ff: [hipX + 66, 225],
  bnh: 1,
  bfh: 1,
  bnf: -1,
  bff: -1,
  ...extra
});

// ---------------------------------------------------------------- Базовые позиции
const guardBase: PoseDef = {
  id: "guard",
  label: "Закрытый гард",
  left: "B",
  A: {
    hip: [244, 186],
    torso: -114,
    neck: -104,
    dir: -1,
    nh: [206, 200],
    fh: [214, 196],
    nf: [270, 225],
    ff: [278, 223],
    bnh: -1,
    bfh: -1,
    bnf: 1,
    bff: 1
  },
  B: lyingB(204, {
    nh: [212, 196],
    fh: [222, 170],
    nf: [268, 192],
    ff: [262, 196],
    bnf: -1,
    bff: -1,
    bnh: 1,
    bfh: 1
  }),
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "A.t", "A.h", "B.t", "B.h", "A.nl", "B.nl", "A.na", "B.na")
};

const halfBase: PoseDef = {
  id: "halfGuard",
  label: "Халф гард",
  left: "B",
  A: {
    hip: [232, 184],
    torso: 184,
    neck: 172,
    dir: -1,
    nh: [128, 222],
    fh: [168, 210],
    nf: [268, 224],
    ff: [300, 222],
    bnh: 1,
    bfh: 1,
    bnf: 1,
    bff: 1
  },
  B: lyingB(210, {
    nh: [214, 170],
    fh: [196, 176],
    nf: [264, 208],
    ff: [256, 222],
    bnf: -1,
    bff: -1,
    bnh: -1,
    bfh: -1
  }),
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "B.t", "B.h", "A.t", "A.h", "A.nl", "B.nl", "A.na", "B.na")
};

const sideBase: PoseDef = {
  id: "sideControl",
  label: "Боковой контроль",
  left: "B",
  A: {
    hip: [214, 192],
    torso: 198,
    neck: 204,
    tl: 0.74,
    dir: -1,
    nh: [128, 224],
    fh: [196, 214],
    nf: [252, 226],
    ff: [258, 222],
    bnh: 1,
    bfh: 1,
    bnf: 1,
    bff: 1
  },
  B: lyingB(212, {
    nh: [216, 196],
    fh: [172, 176],
    nf: [258, 226],
    ff: [266, 224],
    bnf: -1,
    bff: -1,
    bnh: -1,
    bfh: -1
  }),
  order: o("B.fa", "B.fl", "A.fl", "A.fa", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "A.na", "B.na")
};

const mountBase: PoseDef = {
  id: "mount",
  label: "Маунт",
  left: "B",
  A: {
    hip: [214, 184],
    torso: -96,
    neck: -100,
    dir: -1,
    nh: [178, 198],
    fh: [172, 194],
    nf: [242, 224],
    ff: [248, 222],
    bnh: -1,
    bfh: -1,
    bnf: 1,
    bff: 1
  },
  B: lyingB(220, {
    nh: [206, 186],
    fh: [196, 180],
    nf: [282, 225],
    ff: [290, 226],
    bnh: -1,
    bfh: -1
  }),
  order: o("A.fl", "B.fa", "B.fl", "B.t", "B.h", "B.nl", "A.fa", "A.t", "A.h", "A.nl", "A.na", "B.na")
};

const backBase: PoseDef = {
  id: "back",
  label: "Контроль спины",
  left: "A",
  A: {
    hip: [182, 212],
    torso: -70,
    neck: -125,
    dir: 1,
    nh: [230, 170],
    fh: [226, 156],
    nf: [244, 204],
    ff: [238, 208],
    bnh: 1,
    bfh: -1,
    bnf: -1,
    bff: -1
  },
  B: {
    hip: [220, 212],
    torso: -104,
    neck: -92,
    dir: 1,
    nh: [226, 176],
    fh: [222, 170],
    nf: [284, 224],
    ff: [292, 226],
    bnh: 1,
    bfh: 1,
    bnf: -1,
    bff: -1
  },
  order: o("A.fl", "A.fa", "A.t", "A.h", "B.fa", "B.fl", "B.t", "B.h", "A.nl", "B.nl", "A.na", "B.na")
};

const standingBase: PoseDef = {
  id: "standing",
  label: "Стойка",
  left: "A",
  A: standA,
  B: standB,
  order: STAND_ORDER
};

type Patch = {
  A?: Partial<FighterSpec>;
  B?: Partial<FighterSpec>;
  order?: PartId[];
  adjust?: (j: PoseJoints) => PoseJoints;
  marks?: MarkDef[];
};

function derive(base: PoseDef, id: string, label: string, patch: Patch): PoseDef {
  return {
    id,
    label,
    left: base.left,
    A: { ...base.A, ...patch.A },
    B: { ...base.B, ...patch.B },
    order: patch.order ?? base.order,
    adjust: patch.adjust,
    marks: patch.marks
  };
}

const mid = (a: Pt, b: Pt, t = 0.5): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const lockAt = (pick: (j: PoseJoints) => Pt, r = 22): MarkDef => ({ kind: "lock", at: pick, r });
const squeezeAt = (pick: (j: PoseJoints) => Pt): MarkDef => ({ kind: "squeeze", at: pick });
const shieldAt = (pick: (j: PoseJoints) => Pt): MarkDef => ({ kind: "shield", at: pick });
const tapAt = (pick: (j: PoseJoints) => Pt): MarkDef => ({ kind: "tap", at: pick });

// ---------------------------------------------------------------- Попытки в стойке (A — атакующий слева)
const takedownTry: PoseDef = {
  id: "try.takedown",
  label: "Проход в ноги — попытка",
  left: "A",
  A: {
    hip: [170, 194],
    torso: -16,
    neck: -8,
    dir: 1,
    nh: [262, 204],
    fh: [256, 198],
    nf: [150, 226],
    ff: [116, 226],
    bnh: 1,
    bfh: 1,
    bnf: -1,
    bff: -1
  },
  B: {
    hip: [250, 164],
    torso: -102,
    neck: -118,
    dir: -1,
    nh: [218, 170],
    fh: [226, 166],
    nf: [232, 228],
    ff: [276, 228]
  },
  order: o("B.fa", "B.fl", "A.fl", "A.fa", "B.t", "B.h", "A.t", "A.h", "B.nl", "A.nl", "A.na", "B.na")
};

const pullGuardTry: PoseDef = {
  id: "try.pullGuard",
  label: "Затянуть в гард — попытка",
  left: "A",
  A: {
    hip: [180, 204],
    torso: -132,
    neck: -112,
    dir: 1,
    nh: [200, 142],
    fh: [204, 152],
    nf: [236, 174],
    ff: [224, 222],
    bnh: 1,
    bfh: 1,
    bnf: -1,
    bff: -1
  },
  B: {
    hip: [252, 166],
    torso: -106,
    neck: -114,
    dir: -1,
    nh: [214, 176],
    fh: [220, 172],
    nf: [232, 228],
    ff: [276, 228]
  },
  order: o("B.fa", "B.fl", "A.fa", "A.fl", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "A.na", "B.na")
};

// ---------------------------------------------------------------- Гард
const openGuardTry = derive(guardBase, "try.openGuard", "Раскрыть гард — попытка", {
  A: { hip: [252, 170], torso: -100, neck: -104, nf: [226, 227], bnf: 1, ff: [284, 226], nh: [226, 196], fh: [232, 192] },
  B: { hip: [204, 208], nf: [276, 172], ff: [270, 178], nh: [222, 190], fh: [226, 186] }
});

const guardSweepTry = derive(guardBase, "try.guardSweep", "Свип из гарда — попытка", {
  A: { hip: [242, 172], torso: -152, neck: -162, nh: [150, 204], fh: [166, 206], nf: [266, 206], ff: [286, 218], bnh: 1, bfh: 1 },
  B: { hip: [206, 204], torso: 176, nf: [240, 168], bnf: -1, ff: [262, 216], bff: 1, nh: [180, 188], fh: [150, 222] },
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "B.t", "B.h", "A.t", "A.h", "A.nl", "B.nl", "A.na", "B.na")
});

// ---------------------------------------------------------------- Халф гард
const passGuardTry = derive(halfBase, "try.passGuard", "Пройти гард — попытка", {
  A: { hip: [232, 176], torso: -152, neck: -164, nf: [250, 212], bnf: 1, ff: [298, 224], nh: [152, 210], fh: [172, 200] },
  B: { nh: [196, 184], fh: [190, 180], nf: [254, 210], ff: [262, 222] },
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "A.na", "B.na")
});

const halfSweepTry = derive(halfBase, "try.halfSweep", "Свип из халф гарда — попытка", {
  A: { hip: [242, 178], torso: 214, neck: 222, nh: [176, 222], fh: [292, 196], nf: [282, 194], ff: [306, 224], bfh: -1 },
  B: { hip: [214, 210], torso: 200, neck: 206, nh: [240, 176], fh: [168, 224], nf: [262, 190], ff: [256, 224], bnh: -1 },
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "A.t", "A.h", "B.t", "B.h", "A.nl", "B.nl", "A.na", "B.na")
});

const halfBackTopTry = derive(halfBase, "try.halfBackTop", "Забрать спину из халф гарда (сверху) — попытка", {
  A: { hip: [214, 176], torso: -118, neck: -130, nh: [176, 214], fh: [196, 200], nf: [250, 214], ff: [286, 222] },
  B: { torso: 190, neck: 204, nh: [200, 206], fh: [186, 200], nf: [258, 206], ff: [270, 218] },
  order: o("B.fa", "B.fl", "B.t", "B.h", "B.nl", "A.fl", "A.fa", "A.t", "A.h", "A.nl", "A.na", "B.na")
});

const halfBackBottomTry = derive(halfBase, "try.halfBackBottom", "Забрать спину из халф гарда (снизу) — попытка", {
  A: { hip: [238, 180], torso: 206, neck: 214, nh: [150, 218], fh: [170, 214] },
  B: { hip: [206, 204], torso: -150, neck: -140, nh: [262, 170], fh: [244, 176], nf: [252, 212], ff: [236, 222] },
  order: o("A.fl", "A.fa", "B.fl", "B.fa", "A.t", "A.h", "A.nl", "B.t", "B.h", "B.nl", "A.na", "B.na")
});

const recoverGuardTry = derive(halfBase, "try.recoverGuard", "Вернуть гард — попытка", {
  A: { hip: [238, 182], torso: 198, neck: 188, nh: [150, 212], fh: [176, 206] },
  B: { hip: [198, 212], torso: 186, nh: [196, 176], fh: [206, 180], nf: [240, 186], ff: [262, 214], bnh: -1 },
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "B.t", "B.h", "A.t", "A.h", "A.nl", "B.nl", "A.na", "B.na")
});

// ---------------------------------------------------------------- Боковой контроль
const mountUpTry = derive(sideBase, "try.mountUp", "Занять маунт — попытка", {
  A: { hip: [218, 174], torso: 160, neck: 172, tl: 0.9, nf: [244, 196], bnf: 1, ff: [270, 224], nh: [132, 222], fh: [190, 214] },
  B: { nh: [212, 206], fh: [170, 186] }
});

const recoverHalfTry = derive(sideBase, "try.recoverHalf", "Вернуть халф гард — попытка", {
  A: { hip: [214, 186] },
  B: { hip: [226, 212], torso: 186, nf: [238, 176], bnf: -1, nh: [214, 192], fh: [176, 180] },
  order: o("B.fa", "B.fl", "A.fl", "A.fa", "B.t", "B.h", "A.t", "A.h", "A.nl", "B.nl", "A.na", "B.na")
});

// ---------------------------------------------------------------- Маунт
const takeBackTry = derive(mountBase, "try.takeBack", "Забрать спину — попытка", {
  A: { hip: [214, 170], torso: -112, neck: -122, nh: [190, 200], fh: [186, 194], nf: [236, 212] },
  B: { torso: 184, neck: 196, nh: [196, 210], fh: [190, 206], nf: [262, 208], ff: [272, 214], bnh: 1, bfh: 1 }
});

const elbowKneeTry = derive(mountBase, "try.elbowKnee", "Локоть–колено — попытка", {
  A: { hip: [214, 176], torso: -104, nh: [168, 208], fh: [164, 204] },
  B: { hip: [222, 202], torso: 174, nf: [240, 222], bnf: -1, ff: [288, 224], nh: [212, 218], fh: [212, 182], bnh: 1 },
  order: o("A.fl", "B.fa", "B.fl", "B.t", "B.h", "A.fa", "A.t", "A.h", "A.nl", "B.nl", "A.na", "B.na")
});

// ---------------------------------------------------------------- Спина
const slideToGuardTry = derive(backBase, "try.slideToGuard", "Сползти в гард — попытка", {
  A: { hip: [180, 214], torso: -62, nf: [252, 212], nh: [226, 178], fh: [222, 164] },
  B: { hip: [236, 216], torso: -128, neck: -110, nh: [250, 210], fh: [246, 206], nf: [282, 226], ff: [288, 226] }
});

// ---------------------------------------------------------------- Треугольник (атакует нижний B)
const triangleTry = derive(guardBase, "triangle.attempt", "Треугольник — попытка", {
  A: { hip: [244, 184], torso: -140, neck: -160, nh: [202, 196], fh: [176, 202], bnh: -1, bfh: -1 },
  B: { hip: [202, 198], torso: 165, neck: 180, nf: [236, 136], bnf: -1, ff: [252, 196], nh: [200, 196], fh: [206, 150] },
  order: o("A.fl", "A.fa", "B.fa", "B.fl", "B.t", "B.h", "A.t", "A.h", "A.nl", "B.nl", "A.na", "B.na")
});

const triangleLockSpec = {
  A: {
    hip: [252, 184] as Pt,
    torso: 191,
    tl: 1.06,
    neck: 160,
    nh: [170, 202] as Pt,
    fh: [222, 224] as Pt,
    bnh: 1 as const,
    bfh: -1 as const
  },
  B: {
    hip: [206, 184] as Pt,
    torso: 150,
    neck: 178,
    nf: [228, 160] as Pt,
    bnf: -1 as const,
    ff: [250, 180] as Pt,
    bff: -1 as const,
    nh: [180, 204] as Pt,
    fh: [170, 212] as Pt,
    bnh: -1 as const,
    bfh: 1 as const
  }
};
// Голова и прижатая рука защищающегося рисуются поверх замка ног, чтобы их было видно внутри «треугольника».
const TRI_ORDER = o("A.fl", "A.fa", "B.fa", "B.t", "B.h", "A.t", "B.fl", "A.nl", "B.nl", "A.na", "A.h", "B.na");
const triLockMark = lockAt((j) => mid(j.A.hd, j.A.s, 0.3), 27);

const triangleLocked = derive(guardBase, "triangle.locked", "Треугольник зафиксирован", {
  ...triangleLockSpec,
  order: TRI_ORDER,
  marks: [triLockMark]
});

const triangleFinish = derive(triangleLocked, "triangle.finish", "Треугольник — дожим", {
  A: { ...triangleLockSpec.A, neck: 146, torso: 194 },
  B: { ...triangleLockSpec.B, hip: [206, 178], torso: 144, nh: [186, 164], fh: [176, 204] },
  order: TRI_ORDER,
  marks: [triLockMark, squeezeAt((j) => j.A.hd)]
});

const triangleSwitch = derive(triangleLocked, "triangle.switch", "Треугольник → рычаг локтя", {
  A: { ...triangleLockSpec.A, nh: [176, 142], bnh: 1 },
  B: { ...triangleLockSpec.B, hip: [208, 180], nh: [178, 146], fh: [182, 152], bfh: -1 },
  order: TRI_ORDER,
  marks: [lockAt((j) => j.A.ne, 16)]
});

const triangleDefendGrip = derive(triangleLocked, "triangle.defendGrip", "Треугольник — защита захвата", {
  A: { ...triangleLockSpec.A, torso: 200, neck: 186, nh: [212, 192], fh: [216, 190], bnh: 1, bfh: 1 },
  B: { ...triangleLockSpec.B, hip: [206, 188], nf: [232, 164], ff: [252, 186] },
  order: o("A.fl", "B.fa", "B.t", "B.h", "A.t", "B.fl", "A.nl", "B.nl", "A.h", "B.na", "A.fa", "A.na"),
  marks: [triLockMark, shieldAt((j) => j.A.nw)]
});

const triangleTurn = derive(triangleLocked, "triangle.turn", "Треугольник — поворот", {
  A: { ...triangleLockSpec.A, hip: [246, 160], torso: 184, neck: 168, nf: [262, 226], ff: [286, 226], bnf: 1, bff: 1, fh: [172, 222] },
  B: { ...triangleLockSpec.B, hip: [204, 176], torso: 128, nf: [224, 150], ff: [246, 170] },
  order: TRI_ORDER,
  marks: [shieldAt((j) => j.A.h)]
});

const triangleTap = derive(triangleFinish, "triangle.tap", "Треугольник — сдача", {
  A: { ...triangleFinish.A },
  B: { ...triangleFinish.B },
  order: o("A.fl", "B.fa", "B.t", "B.h", "A.t", "B.fl", "A.nl", "B.nl", "A.na", "A.h", "B.na", "A.fa"),
  adjust: (j) => ({ ...j, A: reachArm(j.A, "f", mid(j.B.h, j.B.nk, 0.5), -1) }),
  marks: [triLockMark, tapAt((j) => j.A.fw)]
});

// ---------------------------------------------------------------- Кимура (атакует верхний A из бокового)
const kimuraBase = {
  A: { hip: [216, 188] as Pt, torso: 204, neck: 214, tl: 0.8 },
  B: { nh: [184, 178] as Pt, bnh: 1 as const }
};
const KIM_ORDER = o("B.fa", "B.fl", "A.fl", "A.fa", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "B.na", "A.na");

const kimuraTry = derive(sideBase, "kimura.attempt", "Кимура — попытка", {
  A: { ...kimuraBase.A, nh: [186, 184], fh: [192, 198] },
  B: { ...kimuraBase.B, nh: [186, 182] },
  order: KIM_ORDER
});

const kimuraLocked = derive(sideBase, "kimura.locked", "Кимура зафиксирована", {
  A: { ...kimuraBase.A, hip: [218, 186], torso: 212, nh: [184, 174], fh: [180, 180], bfh: -1 },
  B: { ...kimuraBase.B, nh: [184, 174] },
  order: KIM_ORDER,
  marks: [lockAt((j) => j.B.ne, 18)]
});

const kimuraFinish = derive(kimuraLocked, "kimura.finish", "Кимура — дожим", {
  A: { ...kimuraLocked.A, torso: 196, nh: [150, 192], fh: [156, 188] },
  B: { ...kimuraLocked.B, nh: [150, 194], bnh: -1 },
  order: KIM_ORDER,
  marks: [lockAt((j) => j.B.ne, 18), squeezeAt((j) => j.B.ne)]
});

const kimuraSwitch = derive(kimuraLocked, "kimura.switch", "Кимура → рычаг локтя", {
  A: { ...kimuraLocked.A, torso: 232, neck: 236, nh: [176, 160], fh: [180, 166] },
  B: { ...kimuraLocked.B, nh: [176, 158] },
  order: KIM_ORDER,
  marks: [lockAt((j) => j.B.ne, 16)]
});

const kimuraDefendGrip = derive(kimuraLocked, "kimura.defendGrip", "Кимура — защита захвата", {
  A: { ...kimuraLocked.A, nh: [184, 186], fh: [180, 190] },
  B: { ...kimuraLocked.B, nh: [184, 188], fh: [188, 192], bfh: 1 },
  order: o("B.fl", "A.fl", "A.fa", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "B.fa", "B.na", "A.na"),
  marks: [shieldAt((j) => j.B.fw)]
});

const kimuraTurn = derive(kimuraLocked, "kimura.turn", "Кимура — поворот", {
  A: { ...kimuraLocked.A, hip: [220, 180] },
  B: { ...kimuraLocked.B, torso: 194, neck: 204, nf: [236, 192], bnf: -1, ff: [262, 222] },
  order: KIM_ORDER,
  marks: [shieldAt((j) => j.B.nk)]
});

const kimuraTap = derive(kimuraFinish, "kimura.tap", "Кимура — сдача", {
  A: { ...kimuraFinish.A },
  B: { ...kimuraFinish.B },
  adjust: (j) => ({ ...j, B: reachArm(j.B, "f", mid(j.A.s, j.A.h, 0.4), -1) }),
  order: o("B.fl", "A.fl", "A.fa", "B.t", "B.h", "B.nl", "A.t", "A.h", "A.nl", "B.na", "A.na", "B.fa"),
  marks: [lockAt((j) => j.B.ne, 18), tapAt((j) => j.B.fw)]
});

// ---------------------------------------------------------------- Рычаг локтя (атакует верхний A из маунта)
const ARM_ORDER = o("B.fa", "B.fl", "A.fl", "B.t", "B.h", "B.nl", "A.fa", "A.t", "A.h", "B.na", "A.nl", "A.na");

const armbarTry = derive(mountBase, "armbar.attempt", "Рычаг локтя — попытка", {
  A: { hip: [204, 182], torso: -106, neck: -120, nh: [172, 162], fh: [176, 168], nf: [176, 226], bnf: 1 },
  B: { nh: [170, 160], bnh: 1 },
  order: o("A.fl", "B.fa", "B.fl", "B.t", "B.h", "B.nl", "A.fa", "A.t", "A.h", "B.na", "A.nl", "A.na")
});

const armbarLockSpec = {
  A: {
    hip: [178, 204] as Pt,
    torso: -150,
    neck: -128,
    dir: 1 as const,
    nh: [140, 180] as Pt,
    fh: [138, 176] as Pt,
    bnh: 1 as const,
    bfh: 1 as const,
    nf: [230, 206] as Pt,
    bnf: -1 as const,
    ff: [128, 212] as Pt,
    bff: 1 as const
  },
  B: { nh: [128, 176] as Pt, bnh: 1 as const }
};

const armbarLocked = derive(mountBase, "armbar.locked", "Рычаг локтя зафиксирован", {
  ...armbarLockSpec,
  order: ARM_ORDER,
  marks: [lockAt((j) => j.B.ne, 16)]
});

const armbarFinish = derive(armbarLocked, "armbar.finish", "Рычаг локтя — дожим", {
  A: { ...armbarLockSpec.A, hip: [180, 198], torso: -156, nh: [136, 184], fh: [134, 180] },
  B: { ...armbarLockSpec.B, nh: [126, 180] },
  order: ARM_ORDER,
  marks: [lockAt((j) => j.B.ne, 16), squeezeAt((j) => j.B.ne)]
});

const armbarSwitch = derive(armbarLocked, "armbar.switch", "Рычаг → смена угла", {
  A: { ...armbarLockSpec.A, torso: -112, neck: -104, nh: [172, 158], fh: [176, 164], hip: [180, 206] },
  B: { ...armbarLockSpec.B, nh: [172, 160] },
  order: ARM_ORDER,
  marks: [lockAt((j) => j.B.ne, 16)]
});

const armbarDefendGrip = derive(armbarLocked, "armbar.defendGrip", "Рычаг — защита захвата", {
  A: { ...armbarLockSpec.A, nh: [156, 188], fh: [154, 184] },
  B: { ...armbarLockSpec.B, nh: [160, 186], fh: [164, 190], bfh: 1 },
  order: o("B.fl", "A.fl", "B.t", "B.h", "B.nl", "A.fa", "A.t", "A.h", "B.fa", "B.na", "A.nl", "A.na"),
  marks: [shieldAt((j) => j.B.fw)]
});

const armbarTurn = derive(armbarLocked, "armbar.turn", "Рычаг — поворот", {
  A: { ...armbarLockSpec.A },
  B: { ...armbarLockSpec.B, torso: 194, neck: 204, nh: [140, 186], nf: [250, 196], bnf: -1 },
  order: ARM_ORDER,
  marks: [shieldAt((j) => j.B.nk)]
});

const armbarTap = derive(armbarFinish, "armbar.tap", "Рычаг локтя — сдача", {
  A: { ...armbarFinish.A },
  B: { ...armbarFinish.B },
  adjust: (j) => ({ ...j, B: reachArm(j.B, "f", mid(j.A.h, j.A.nk, 0.6), -1) }),
  order: o("B.fl", "A.fl", "B.t", "B.h", "B.nl", "A.fa", "A.t", "A.h", "B.na", "A.nl", "A.na", "B.fa"),
  marks: [lockAt((j) => j.B.ne, 16), tapAt((j) => j.B.fw)]
});

// ---------------------------------------------------------------- Удушение со спины (атакует A сзади)
const CHOKE_ORDER = o("A.fl", "A.fa", "A.t", "A.h", "B.fa", "B.fl", "B.t", "B.h", "A.nl", "B.nl", "B.na", "A.na");
const chokeTry = derive(backBase, "choke.attempt", "Удушение — попытка", {
  A: { nh: [224, 162], fh: [196, 146], bnh: 1, bfh: -1 },
  B: { nh: [232, 176], fh: [228, 180] },
  order: CHOKE_ORDER
});

const chokeLockSpec = {
  A: { nh: [200, 161] as Pt, bnh: 1 as const, fh: [194, 146] as Pt, bfh: -1 as const },
  B: { neck: -80, nh: [232, 178] as Pt, fh: [228, 182] as Pt }
};
const chokeLocked = derive(backBase, "choke.locked", "Удушение зафиксировано", {
  ...chokeLockSpec,
  order: CHOKE_ORDER,
  marks: [lockAt((j) => j.A.ne, 16)]
});

const chokeFinish = derive(chokeLocked, "choke.finish", "Удушение — дожим", {
  A: { ...backBase.A, ...chokeLockSpec.A, torso: -84, hip: [180, 212] },
  B: { ...backBase.B, ...chokeLockSpec.B, torso: -114, neck: -104 },
  order: CHOKE_ORDER,
  marks: [lockAt((j) => j.A.ne, 16), squeezeAt((j) => mid(j.B.s, j.B.hd, 0.5))]
});

const chokeSwitch = derive(chokeLocked, "choke.switch", "Удушение → захват воротника", {
  A: { ...backBase.A, torso: -62, nh: [226, 160], bnh: 1, fh: [240, 196], bfh: 1 },
  B: { ...backBase.B, torso: -98, nh: [226, 168], fh: [222, 164] },
  order: CHOKE_ORDER,
  marks: [lockAt((j) => mid(j.B.s, j.B.hd, 0.5), 16)]
});

const chokeDefendGrip = derive(chokeLocked, "choke.defendGrip", "Удушение — защита захвата", {
  A: { ...backBase.A, nh: [210, 158], bnh: 1, fh: [196, 144], bfh: -1 },
  B: { ...backBase.B, nh: [224, 170], fh: [220, 166], bnh: 1, bfh: 1 },
  order: CHOKE_ORDER,
  marks: [shieldAt((j) => j.B.nw)]
});

const chokeTurn = derive(chokeLocked, "choke.turn", "Удушение — поворот", {
  A: { ...backBase.A, ...chokeLockSpec.A },
  B: { ...backBase.B, hip: [230, 214], torso: -122, neck: -130, dir: -1, nh: [196, 180], fh: [200, 176], nf: [270, 212], ff: [288, 226] },
  order: CHOKE_ORDER,
  marks: [shieldAt((j) => j.B.s)]
});

const chokeTap = derive(chokeFinish, "choke.tap", "Удушение — сдача", {
  A: { ...chokeFinish.A },
  B: { ...chokeFinish.B },
  adjust: (j) => ({ ...j, B: reachArm(j.B, "f", mid(j.A.nk, j.A.na, 0.3), 1) }),
  order: o("A.fl", "A.fa", "A.t", "A.h", "B.fl", "B.t", "B.h", "A.nl", "B.nl", "B.na", "A.na", "B.fa"),
  marks: [lockAt((j) => j.A.ne, 16), tapAt((j) => j.B.fw)]
});

export const POSES: Record<string, PoseDef> = {};
function register(...defs: PoseDef[]) {
  for (const d of defs) POSES[d.id] = d;
}
register(
  standingBase,
  guardBase,
  halfBase,
  sideBase,
  mountBase,
  backBase,
  takedownTry,
  pullGuardTry,
  openGuardTry,
  guardSweepTry,
  passGuardTry,
  halfSweepTry,
  halfBackTopTry,
  halfBackBottomTry,
  recoverGuardTry,
  mountUpTry,
  recoverHalfTry,
  takeBackTry,
  elbowKneeTry,
  slideToGuardTry,
  triangleTry,
  triangleLocked,
  triangleFinish,
  triangleSwitch,
  triangleDefendGrip,
  triangleTurn,
  triangleTap,
  kimuraTry,
  kimuraLocked,
  kimuraFinish,
  kimuraSwitch,
  kimuraDefendGrip,
  kimuraTurn,
  kimuraTap,
  armbarTry,
  armbarLocked,
  armbarFinish,
  armbarSwitch,
  armbarDefendGrip,
  armbarTurn,
  armbarTap,
  chokeTry,
  chokeLocked,
  chokeFinish,
  chokeSwitch,
  chokeDefendGrip,
  chokeTurn,
  chokeTap
);

export function solvePose(def: PoseDef): PoseJoints {
  const j = { A: solveFighter(def.A), B: solveFighter(def.B) };
  return def.adjust ? def.adjust(j) : j;
}

export { anchors, reachArm };
