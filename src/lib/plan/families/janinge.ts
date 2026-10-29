import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * JANINGE, read from the bar stool's manual. The base plate is bolted to the lower column, the height lever is clicked
 * into the seat plate on the gas column, the seat is bolted to the plate upside down and its cover screwed on under
 * it, the footrest is clamped round the lower column with two grub screws, and the seat's column drops into the
 * lower one. The chair has no manual here and keeps its old guide.
 */

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

function stool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const SH = (s.seat?.seatH ?? 76) * 10; // seat at its highest
  const BD = 420, BT = 10; // base plate
  const yFoot = 300; // footrest
  const yPlate = SH - 52; // the seat plate under the seat
  const yCover = yPlate - 20;
  const parts: CustomPart[] = [
    { id: "BA", name: "Base plate", size: [BD, BT, BD], pos: [0, BT / 2, 0], shape: "cyl", material: "metal" },
  ];
  const lowTop = yFoot + 25;
  const lowPieces: PartPiece[] = [
    { shape: "cyl", size: [130, 8, 130], pos: [0, -(lowTop - BT) / 2 + 4, 0] },
    { shape: "cyl", size: [48, lowTop - BT, 48], pos: [0, 0, 0] },
  ];
  parts.push({ id: "LC", name: "Lower column", size: [130, lowTop - BT, 130], pos: [0, (lowTop + BT) / 2, 0], pieces: lowPieces, material: "metal" });
  // the footrest: a clamp round the column and a bar in front of it
  const footPieces: PartPiece[] = [
    { shape: "cyl", size: [64, 50, 64], pos: [0, 0, -60] },
    { shape: "box", size: [30, 20, 70], pos: [0, -5, 5] },
    { shape: "box", size: [320, 20, 34], pos: [0, -5, 57] },
  ];
  parts.push({ id: "FR", name: "Footrest", size: [320, 50, 184], pos: [0, yFoot, 60], pieces: footPieces, material: "metal" });
  parts.push({ id: "UC", name: "Gas column", size: [60, yCover - 10 - lowTop, 60], pos: [0, (yCover - 10 + lowTop) / 2, 0], shape: "cyl", material: "metal" });
  parts.push({ id: "CV", name: "Cover", size: [170, 20, 170], pos: [0, yCover, 0], shape: "cyl", material: "board" });
  parts.push({ id: "PL", name: "Seat plate", size: [150, 12, 150], pos: [0, yPlate - 4, 0], material: "metal" });
  parts.push({ id: "LV", name: "Height lever", size: [120, 10, 12], pos: [135, yPlate - 4, 40], material: "metal" });
  const seatPieces: PartPiece[] = [
    { shape: "cyl", size: [W, 45, D], pos: [0, -(H - yPlate) / 2 + 23.5, 0] },
    // the back half rises into a low lip
    { shape: "halfcyl", size: [W, H - yPlate - 45, D / 2], pos: [0, 22.5, -D / 4], rot: [0, Math.PI, 0] },
  ];
  parts.push({ id: "SE", name: "Seat", size: [W, H - yPlate + 2, D], pos: [0, (H + yPlate) / 2 + 1, 0], pieces: seatPieces, material: "board" });

  const ring = (r: number): Vec3[] => [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * r, 0, sz * r]));
  const steps: CustomStep[] = [
    { title: "Peel the film off the base plate", detail: "From its underside, then turn it over on a rug.", add: ["BA"], pose: "-y", warnings: ["floor"] },
    {
      title: "Bolt the lower column to the base",
      detail: "Hold the base on its edge. Four bolts through the base into the column's foot, tightened with the long Allen key.",
      add: ["LC"],
      fix: [fx("bolt", ring(36).map((p): Vec3 => [p[0], 0, p[2]]), [0, 1, 0], "BA", { len: 20, dia: 8, mate: "LC" })],
      tools: ["allen"],
      pose: "+x",
    },
    {
      title: "Click the height lever into the seat plate",
      detail: "Push it through the hole in the side of the plate on the gas column until it clicks, then turn it down.",
      add: ["UC", "PL", "LV"],
      pose: "+y",
    },
    {
      title: "Bolt the seat to the plate",
      detail: "Lay the seat upside down on a rug, set the plate on it and screw in the four bolts with the small Allen key.",
      add: ["SE"],
      fix: [fx("bolt", ring(55).map((p): Vec3 => [p[0], yPlate - 10, p[2]]), [0, 1, 0], "PL", { len: 16, dia: 6, mate: "SE", name: "Flange bolt" })],
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Slide the cover down the column", detail: "Turn the seat right way up, then push the cover down over the plate.", add: ["CV"] },
    {
      title: "Screw the cover on",
      detail: "Four small screws up into the seat.",
      fix: [fx("screw", [[0, yCover - 10, 80], [0, yCover - 10, -80], [80, yCover - 10, 0], [-80, yCover - 10, 0]], [0, 1, 0], "CV", { len: 14, dia: 4, mate: "SE" })],
      tools: ["screwdriver"],
    },
    { title: "Slide the footrest down the lower column", detail: "Bar to the front. It rests on the column's step.", add: ["FR"], from: { FR: [0, 320, 0] } },
    {
      title: "Tighten the footrest's grub screws",
      detail: "Two of them, at the back of the clamp, with the small Allen key.",
      fix: [fx("bolt", [-14, 14].map((x): Vec3 => [x, yFoot, -33]), [0, 0, 1], "FR", { len: 10, dia: 8, name: "Grub screw" })],
      tools: ["allen"],
    },
    { title: "Drop the seat into the column", detail: "Lower the gas column straight into the top of the lower column. Your weight pushes it home the first time you sit." },
    { title: "Set the height", detail: "Sit on it and lift the lever to go down; stand up and lift it to go up. It needs about 50 kg on it to move down." },
  ];
  return { parts, steps };
}

/** The seat, its plate and its column are built upside down on the rug beside the base, then dropped in as one. */
function restage(b: PlanBuilder, recipe: CustomParams, ids: string[], from: number, at: number, top: number) {
  for (const id of ids) {
    const p = recipe.parts.find((q) => q.id === id)!.pos;
    const it = b.items.find((x) => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p[k]) < 0.5));
    if (!it || it.kind !== "part") continue;
    const later = it.states.filter((x) => x.step >= at);
    const first = it.states[0];
    const shown = { step: Math.max(first.step, from), scene: "main", pos: [p[0] + 520, top - p[1], -p[2]] as Vec3, rot: [Math.PI, 0, 0] as Vec3, delay: first.delay };
    it.states = [shown, ...(later.length ? later : [{ step: at, scene: "main", pos: it.final.pos, rot: it.final.rot, from: [0, 260, 0] as Vec3, delay: 0.2 }])];
  }
}

const family: Family = {
  names: ["JANINGE"],
  build(b, s) {
    if (!/bar-stool|bar stool/i.test(`${s.slug ?? ""} ${s.variant}`)) return false;
    const recipe = stool(s);
    buildCustom(b, { ...s, custom: recipe });
    const drop = recipe.steps.findIndex((x) => x.title === "Drop the seat into the column");
    // the plate and its column stand on their own until the seat goes on, then the whole seat lies upside down
    restage(b, recipe, ["SE", "PL", "LV", "UC", "CV"], 2, drop, s.size.h * 10);
    return true;
  },
};
export default family;
