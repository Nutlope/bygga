import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * LISTERBY, read from its manuals. The coffee table is built standing on one end: cam bolts and dowels go into the
 * two end frames (an apron with a leg at each end), the middle rail and the slatted shelf stand on one frame on cam
 * locks, the other frame goes on top, then the whole frame is turned upside down onto the top and screwed to it from
 * the aprons. The console table lies on its back: feet, dowels and threaded rods go into the four round legs, the top
 * and the shelf stand on their back edges, two legs are pressed onto their front edges and nutted from inside, then it
 * is turned over for the other two legs, and caps close the nut holes.
 */

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

/** A board with rounded corners, drawn as one flat slab. */
function rounded(w: number, t: number, d: number, r: number): PartPiece[] {
  return [{ shape: "slab", size: [w, t, d], pos: [0, 0, 0], outline: [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], round: r }];
}

/** A board with round ends: a slab whose corner radius is half its depth. */
function stadium(w: number, t: number, d: number): PartPiece[] {
  return rounded(w, t, d, d / 2 - 1);
}

interface Stage {
  id: string;
  shown: { step: number; pos: Vec3; rot: Vec3 }[]; // where it lies before it goes on
  at: number; // the step it reaches its place
  from?: Vec3;
}

/** Parts the recipe adds early (so fittings can go into them) lie loose on the floor until the step they really go on. */
function restage(b: PlanBuilder, recipe: CustomParams, stages: Stage[]) {
  stages.forEach((st, i) => {
    const p = recipe.parts.find((q) => q.id === st.id)!.pos;
    const it = b.items.find((x) => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p[k]) < 0.5));
    if (!it || it.kind !== "part") return;
    const later = it.states.filter((x) => x.step >= st.at);
    const shown = st.shown.map((s) => ({ step: s.step, scene: "main", pos: s.pos, rot: s.rot, delay: 0.15 + 0.12 * i }));
    const final = later.length ? later : [{ step: st.at, scene: "main", pos: it.final.pos, rot: it.final.rot, from: st.from, delay: 0.15 + 0.3 * (i % 2) }];
    it.states = [...shown, ...final];
  });
}

function coffee(s: ProductSpec): { recipe: CustomParams; stages: Stage[] } {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 30; // top
  const LD = 45; // legs
  const yU = H - TT; // underside of the top
  const xl = W / 2 - 140, zl = D / 2 - 60; // leg centres
  const xi = xl - LD / 2; // inside faces of the end frames
  const AT = 22, AH = 80; // aprons
  const yShelf = 135;
  const parts: CustomPart[] = [];
  const framePieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [LD, yU, LD], pos: [0, 0, sz * zl] })),
    { shape: "box", size: [AT, AH, 2 * zl - LD], pos: [-(LD / 2 - AT / 2), yU / 2 - AH / 2, 0] },
  ];
  const mirror = (ps: PartPiece[]) => ps.map((p) => ({ ...p, pos: [-p.pos[0], p.pos[1], p.pos[2]] as Vec3 }));
  parts.push({ id: "EL", name: "End frame", size: [LD, yU, 2 * zl + LD], pos: [-xl, yU / 2, 0], pieces: mirror(framePieces), material: "wood" });
  parts.push({ id: "ER", name: "End frame", size: [LD, yU, 2 * zl + LD], pos: [xl, yU / 2, 0], pieces: framePieces, material: "wood" });
  const BH = 70, BT = 22;
  const yBeam = yU - BH / 2;
  parts.push({ id: "M", name: "Middle rail", size: [2 * xi, BH, BT], pos: [0, yBeam, 0], material: "wood" });
  // the slatted shelf comes in one piece: two round side rails and round slats across
  const RD = 28, SD = 16, nSlats = 15;
  const sw = 2 * xi, sl = 2 * zl - RD;
  const shelfPieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [RD, sw, RD], pos: [0, 0, sz * zl], rot: [0, 0, Math.PI / 2] })),
    ...Array.from({ length: nSlats }, (_, k): PartPiece => ({ shape: "cyl", size: [SD, sl, SD], pos: [-sw / 2 + 40 + ((sw - 80) * k) / (nSlats - 1), 0, 0], rot: [Math.PI / 2, 0, 0] })),
  ];
  parts.push({ id: "S", name: "Slatted shelf", size: [sw, RD, 2 * zl + RD], pos: [0, yShelf, 0], pieces: shelfPieces, material: "wood" });
  parts.push({ id: "T", name: "Table top", size: [W, TT, D], pos: [0, H - TT / 2, 0], pieces: rounded(W, TT, D, 110), material: "board" });

  const end = (sx: number) => (sx < 0 ? "EL" : "ER");
  const camBolts = (sx: number) =>
    fx("camScrew", [[sx * xi, yBeam, 0], ...[-1, 1].map((sz): Vec3 => [sx * xi, yShelf, sz * zl])], [sx, 0, 0], end(sx), { len: 30 });
  const legDowels = (sx: number) => fx("dowel", [-1, 1].map((sz): Vec3 => [sx * xl, yU, sz * zl]), [0, -1, 0], end(sx), { len: 50, dia: 10, mate: "T", name: "Long dowel" });
  const beamCam = (sx: number) => fx("cam", [[sx * (xi - 30), yBeam, BT / 2]], [0, 0, -1], "M", { dia: 12, name: "Small cam lock" });
  const shelfCams = (sx: number) => fx("cam", [-1, 1].map((sz): Vec3 => [sx * (xi - 25), yShelf - RD / 2, sz * zl]), [0, 1, 0], "S", { dia: 15 });
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the end frames",
      detail: "Lay both frames flat on a rug, inside face up. One bolt in the middle of each apron and one in each leg.",
      add: ["EL", "ER"],
      fix: [camBolts(-1), camBolts(1)],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Tap a long dowel into the top of each leg",
      detail: "Use the long dowels here and keep the short ones for the middle rail.",
      fix: [legDowels(-1), legDowels(1)],
      tools: ["hammer"],
    },
    {
      title: "Tap the short dowels into the middle rail",
      detail: "One in each end and two along its top edge.",
      add: ["M"],
      fix: [
        ...[-1, 1].map((sx) => fx("dowel", [[sx * xi, yBeam, 0]], [-sx, 0, 0], "M", { mate: end(sx) })),
        fx("dowel", [-1, 1].map((sx): Vec3 => [sx * 300, yU, 0]), [0, -1, 0], "M", { mate: "T" }),
      ],
      tools: ["hammer"],
    },
    {
      title: "Stand the middle rail on one end frame",
      detail: "Its dowel goes into the middle of the apron. Turn the small cam lock until it pulls the rail tight.",
      fix: [beamCam(-1)],
      tools: ["screwdriver"],
    },
    {
      title: "Stand the slatted shelf on the frame",
      detail: "Its two side rails go onto the cam bolts in the legs. Lock them with the two big cam locks.",
      add: ["S"],
      fix: [shelfCams(-1)],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the other end frame on top",
      detail: "Guide the rail and the shelf onto its cam bolts, then lock the middle rail with the small cam.",
      fix: [beamCam(1)],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the shelf to it",
      detail: "Two big cam locks, turned until they pull the shelf rails tight to the legs.",
      fix: [shelfCams(1)],
      tools: ["screwdriver"],
    },
    {
      title: "Turn the frame over onto the top",
      detail: "Lay the top face down on a rug and lower the frame onto it, so every dowel finds its hole.",
      add: ["T"],
      // the top lies still on the rug and the frame, turned over, comes down onto it along the dowels
      from: { T: [0, 0, 0] },
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the aprons to the top",
      detail: "Three long screws down through each apron into the top, with the Allen key.",
      fix: [-1, 1].map((sx) => fx("bolt", [-150, 0, 150].map((z): Vec3 => [sx * (xl - LD / 2 + AT / 2), yU - AH, z]), [0, 1, 0], end(sx), { len: 90, dia: 6, mate: "T", name: "Long screw" })),
      tools: ["allen"],
    },
    {
      title: "Press a foot into each leg",
      detail: "Push them into the holes in the leg ends until they sit flat.",
      fix: [fx("glide", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, 0, sz * zl])), [0, 1, 0], undefined, { name: "Foot", dia: 30 })],
    },
    { title: "Turn it the right way up", detail: "Lift it by the top, not by the shelf.", pose: "+y" },
  ];
  // the second frame lies flat beside the first, inside face up, and the rail lies by them, until each goes on
  const stages: Stage[] = [
    { id: "ER", shown: [{ step: 0, pos: [-xl, yU / 2, D + 120], rot: [0, Math.PI, 0] }], at: 5, from: [500, 0, 0] },
    { id: "M", shown: [{ step: 2, pos: [-xl - LD / 2 + BH / 2, yU / 2, -D - 60], rot: [0, 0, Math.PI / 2] }], at: 3, from: [500, 0, 0] },
  ];
  return { recipe: { parts, steps }, stages };
}

function consoleTable(s: ProductSpec): { recipe: CustomParams; stages: Stage[] } {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const LD = 35; // legs
  const SD = D - 2 * LD; // shelves, between the legs
  const xl = W / 2 - SD / 2, zl = D / 2 - LD / 2; // the legs stand where the round ends begin
  const zf = SD / 2; // the shelves' front edge
  const T = 25;
  const yTop = H - 20 - T / 2, yShelf = 330 - T / 2;
  const parts: CustomPart[] = [];
  const legIds = ["LF0", "LF1", "LB0", "LB1"];
  const legAt = (id: string): Vec3 => [(id.endsWith("0") ? -1 : 1) * xl, H / 2, (id[1] === "F" ? 1 : -1) * zl];
  for (const id of legIds) parts.push({ id, name: "Leg", size: [LD, H, LD], pos: legAt(id), shape: "cyl", material: "wood" });
  parts.push({ id: "T", name: "Table top", size: [W, T, SD], pos: [0, yTop, 0], pieces: stadium(W, T, SD), material: "board" });
  parts.push({ id: "S", name: "Shelf", size: [W, T, SD], pos: [0, yShelf, 0], pieces: stadium(W, T, SD), material: "board" });

  const front = legIds.slice(0, 2), back = legIds.slice(2);
  const sideOf = (id: string) => (id[1] === "F" ? 1 : -1);
  const inLeg = (ids: string[], kind: CustomFix["kind"], dy: number, o: Partial<CustomFix>) =>
    ids.flatMap((id) => {
      const [x, , z] = legAt(id), sz = sideOf(id);
      return [yTop, yShelf].map((y, k) => fx(kind, [[x, y + dy, z - sz * (LD / 2)]], [0, 0, sz], id, { mate: k ? "S" : "T", ...o }));
    });
  const nuts = (ids: string[]) =>
    ids.flatMap((id) => {
      const [x] = legAt(id), sz = sideOf(id);
      return [
        fx("washer", [yTop, yShelf].map((y): Vec3 => [x, y, sz * (zf - 40)]), [0, 0, sz], undefined, { name: "Wedge", dia: 22 }),
        fx("nut", [yTop, yShelf].map((y): Vec3 => [x, y, sz * (zf - 42)]), [0, 0, sz], undefined, { dia: 8 }),
      ];
    });
  const steps: CustomStep[] = [
    {
      title: "Press a foot into each leg",
      detail: "Into the hole in the plain end of all four legs.",
      add: legIds,
      fix: [fx("glide", legIds.map((id): Vec3 => [legAt(id)[0], 0, legAt(id)[2]]), [0, 1, 0], undefined, { name: "Foot", dia: 30 })],
      warnings: ["floor"],
    },
    { title: "Tap the dowels into the legs", detail: "Two in each leg, into the holes beside the metal inserts.", fix: inLeg(legIds, "dowel", -28, {}), tools: ["hammer"] },
    { title: "Screw the threaded rods into the legs", detail: "By hand, into the metal inserts, until they stop.", fix: inLeg(legIds, "stud", 0, { len: 60, dia: 8, name: "Threaded rod" }) },
    {
      title: "Stand the top and the shelf on their back edges",
      detail: "Side by side on a rug, the holes in their front edges facing up.",
      add: ["T", "S"],
      from: { T: [0, 0, 300], S: [0, 0, 300] },
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Press two legs onto the front edges", detail: "Each leg's rods and dowels go into the top and the shelf. One of you holds the boards steady.", people: 2, warnings: ["two"] },
    {
      title: "Tighten the nuts from inside",
      detail: "Through each hole in the boards: slip a wedge over the rod, then the nut, and tighten it with the spanner.",
      fix: nuts(front),
      tools: ["wrench"],
    },
    { title: "Turn it over and fit the other two legs", detail: "Lay it on the front legs and press the last two legs onto the back edges.", pose: "-z", people: 2, warnings: ["two"] },
    { title: "Tighten their nuts", detail: "A wedge and a nut on each rod, tightened with the spanner.", fix: nuts(back), tools: ["wrench"] },
    {
      title: "Press the caps into the holes",
      detail: "One over each nut hole, under the top and under the shelf.",
      fix: [fx("cap", [-1, 1].flatMap((sz) => [-1, 1].flatMap((sx) => [yTop, yShelf].map((y): Vec3 => [sx * xl, y - T / 2, sz * (zf - 40)]))), [0, 1, 0], undefined, { dia: 26 })],
    },
    { title: "Stand it up", detail: "On its feet, against a wall if you like.", pose: "+y" },
  ];
  // the legs lie on the rug while their fittings go in, then two at a time go onto the boards
  const lying = (i: number, step: number, y: number, z: number) => ({ step, pos: [0, y + i * 70, z] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 });
  const stages: Stage[] = legIds.map((id, i) => ({
    id,
    shown: [lying(i, 0, LD / 2, D / 2 + 140), lying(i, 3, H + 160, -D / 2 + LD / 2)],
    at: id[1] === "F" ? 4 : 6,
    from: [0, 0, sideOf(id) * 300],
  }));
  return { recipe: { parts, steps }, stages };
}

const family: Family = {
  names: ["LISTERBY"],
  build(b, s) {
    const kind = /console/i.test(`${s.slug ?? ""} ${s.variant}`) ? "console" : /coffee/i.test(`${s.slug ?? ""} ${s.variant}`) ? "coffee" : null;
    if (!kind) return false;
    const { recipe, stages } = kind === "console" ? consoleTable(s) : coffee(s);
    buildCustom(b, { ...s, custom: recipe });
    restage(b, recipe, stages);
    return true;
  },
};
export default family;
