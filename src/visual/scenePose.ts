import type { FramePose } from "./FighterLayer";
import { mirrorJoints, SCENE_W } from "./rig";
import { solvePose, type PoseDef } from "./poses";

export function buildFramePose(def: PoseDef, mirror: boolean): FramePose {
  const j = solvePose(def);
  const marks = (def.marks ?? []).map((m) => ({ kind: m.kind, at: m.at(j), r: m.r }));
  if (!mirror) return { A: j.A, B: j.B, order: def.order, marks };
  return {
    A: mirrorJoints(j.A),
    B: mirrorJoints(j.B),
    order: def.order,
    marks: marks.map((m) => ({ ...m, at: [SCENE_W - m.at[0], m.at[1]] }))
  };
}
