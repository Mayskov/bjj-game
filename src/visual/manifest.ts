import { SUBMISSIONS, TRANSITIONS } from "../engine/catalog";
import { opponent } from "../engine/rules";
import type { BasicActionId, Position, Side, SubmissionId, TransitionId } from "../engine/types";
import type { Role } from "./Fighter";
import type { ResolvedMark } from "./FighterLayer";
import type { FramePose } from "./FighterLayer";
import { POSES } from "./poses";
import { anchors, lerpPt, reachArm, type Joints } from "./rig";
import { buildFramePose } from "./scenePose";

export type VisualPhase = "base" | "attempt" | "locked" | "finish" | "switch" | "defendGrip" | "turn" | "tap";

/** Что показать: выбирается по позиции, контролю, приёму, атакующему и фазе — не только по позиции. */
export interface VisualKey {
  position: Position;
  top: Side | null;
  technique?: TransitionId | SubmissionId;
  attacker?: Side;
  phase: VisualPhase;
}

export interface ManifestEntry {
  position: Position;
  controller: Side | null;
  technique: TransitionId | SubmissionId | null;
  attacker: Side | null;
  phase: VisualPhase;
  /** Ресурс — идентификатор векторной позы в библиотеке. */
  pose: string;
  /** Кто в какой роли позы: A — верхний/контролирующий (в стойке — левый/атакующий). */
  roles: Record<Role, Side>;
  mirror: boolean;
}

const SIDES: Side[] = ["player", "bot"];
const GROUND: Position[] = ["guard", "halfGuard", "sideControl", "mount", "back"];
const SUB_PHASES: VisualPhase[] = ["attempt", "locked", "finish", "switch", "defendGrip", "turn", "tap"];

function entry(e: Omit<ManifestEntry, "mirror">): ManifestEntry {
  const def = POSES[e.pose];
  if (!def) throw new Error(`Нет позы ${e.pose}`);
  return { ...e, mirror: e.roles[def.left] !== "player" };
}

function groundRoles(top: Side): Record<Role, Side> {
  return { A: top, B: opponent(top) };
}

function buildManifest(): ManifestEntry[] {
  const list: ManifestEntry[] = [];
  list.push(entry({ position: "standing", controller: null, technique: null, attacker: null, phase: "base", pose: "standing", roles: { A: "player", B: "bot" } }));
  for (const position of GROUND) {
    for (const top of SIDES) {
      list.push(entry({ position, controller: top, technique: null, attacker: null, phase: "base", pose: position, roles: groundRoles(top) }));
    }
  }
  for (const def of Object.values(TRANSITIONS)) {
    for (const attacker of SIDES) {
      if (def.role === "standing") {
        list.push(entry({ position: def.from, controller: null, technique: def.id, attacker, phase: "attempt", pose: `try.${def.id}`, roles: { A: attacker, B: opponent(attacker) } }));
      } else {
        const top = def.role === "top" ? attacker : opponent(attacker);
        list.push(entry({ position: def.from, controller: top, technique: def.id, attacker, phase: "attempt", pose: `try.${def.id}`, roles: groundRoles(top) }));
      }
    }
  }
  for (const def of Object.values(SUBMISSIONS)) {
    for (const attacker of SIDES) {
      const top = def.role === "top" ? attacker : opponent(attacker);
      for (const phase of SUB_PHASES) {
        list.push(entry({ position: def.from, controller: top, technique: def.id, attacker, phase, pose: `${def.id}.${phase}`, roles: groundRoles(top) }));
      }
    }
  }
  return list;
}

export const VISUAL_MANIFEST: ManifestEntry[] = buildManifest();

export function lookupVisual(key: VisualKey): ManifestEntry {
  const found = VISUAL_MANIFEST.find(
    (e) =>
      e.position === key.position &&
      e.controller === key.top &&
      e.phase === key.phase &&
      e.technique === (key.technique ?? null) &&
      e.attacker === (key.attacker ?? null)
  );
  if (!found) throw new Error(`Нет кадра для ${JSON.stringify(key)}`);
  return found;
}

export interface BasicOverlay {
  side: Side;
  action: BasicActionId;
}

export interface SceneFrame {
  key: VisualKey;
  basics: BasicOverlay[];
}

export interface ResolvedFrame extends FramePose {
  roles: Record<Role, Side>;
  poseId: string;
}

/** Базовые действия показываются движением рук поверх текущей позы. */
function applyBasic(pose: FramePose, roles: Record<Role, Side>, overlay: BasicOverlay): FramePose {
  const role: Role = roles.A === overlay.side ? "A" : "B";
  const other: Role = role === "A" ? "B" : "A";
  const me: Joints = pose[role];
  const them = anchors(pose[other]);
  const own = anchors(me);
  let next = me;
  const marks: ResolvedMark[] = [];
  switch (overlay.action) {
    case "grip":
      next = reachArm(reachArm(me, "n", them.collar), "f", them.sleeve);
      break;
    case "frame":
      next = reachArm(reachArm(me, "n", them.neck), "f", them.hip);
      marks.push({ kind: "block", at: lerpPt(next.nw, them.neck, 0.2) });
      break;
    case "neck":
      next = reachArm(reachArm(me, "n", own.chin), "f", lerpPt(own.chin, own.collar, 0.5));
      marks.push({ kind: "shield", at: [own.chin[0], own.chin[1] - 26] });
      break;
    case "breathe":
      marks.push({ kind: "breath", at: [me.hd[0] + 8, me.hd[1] - 16] });
      break;
  }
  return { ...pose, [role]: next, marks: [...pose.marks, ...marks] };
}

export function resolveFrame(frame: SceneFrame): ResolvedFrame {
  const e = lookupVisual(frame.key);
  let pose = buildFramePose(POSES[e.pose], e.mirror);
  for (const b of frame.basics) pose = applyBasic(pose, e.roles, b);
  return { ...pose, roles: e.roles, poseId: e.pose };
}

export function baseKey(state: { position: Position; top: Side | null; submission: { technique: SubmissionId; attacker: Side } | null }): VisualKey {
  if (state.submission) {
    return { position: state.position, top: state.top, technique: state.submission.technique, attacker: state.submission.attacker, phase: "locked" };
  }
  return { position: state.position, top: state.top, phase: "base" };
}
