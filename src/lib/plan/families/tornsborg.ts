import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TORNSBORG, read from its manual (the armchair-bed and the 2-seat sofa-bed share one). Each pine side frame is
 * two legs with big dowels and joining plates at the top, a side board (with a block on dowels and bolts) bolted
 * across them, felt pads under the feet and the armrest bolted on upside down. The back rail joins the two side
 * frames on dowels, cam pins and cam locks, two steel crossbars are bolted between the side boards, and the folding
 * bed unit gets two hooks, hangs on the back crossbar and is locked with clips. Felt pads go under its fold-out legs
 * and two more clips lock its front.
 */

const UP: Vec3 = [0, 1, 0];
const SIDES = [-1, 1];
const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });
const box = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "wood"): CustomPart => ({ id, name, size, pos, material });

function recipe(s: ProductSpec): CustomParams | null {
  const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
  const sofa = /2-seat|sofa/.test(t);
  if (!sofa && !/armchair/.test(t)) return null;
  // IKEA: 84 (armchair) or 154 (2-seat) wide, 95 deep, 82 high, seat 38 high, armrests 53 high and 7 wide
  const W = sofa ? 1540 : 840, D = 950, H = 820;
  const xs = W / 2 - 35; // side frames
  const legH = 480, armT = 45, armY = legH + armT / 2;
  const zf = D / 2 - 90, zb = -D / 2 + 60; // front and back legs
  const leg = (sx: number, sz: number) => `L${sx < 0 ? "l" : "r"}${sz > 0 ? "f" : "b"}`;
  const side = (sx: number) => (sx < 0 ? "l" : "r");
  const xb = xs - 35; // side boards, on the inside of the legs
  const zBlock = zb + 230;
  const xin = xb - 10; // inner face of the side boards
  const yRail = 400, yBar = 200;
  const zBars = [zb + 150, zf - 140];
  const bw = 2 * (xin - 40) - 6; // the bed unit, between the blocks
  const zBed0 = zb + 40, zBed1 = D / 2 - 30;

  const parts: CustomPart[] = [];
  for (const sx of SIDES) {
    for (const sz of SIDES) parts.push(box(leg(sx, sz), "Leg", [50, legH, 50], [sx * xs, legH / 2, sz > 0 ? zf : zb]));
    parts.push(box(`B${side(sx)}`, "Side board", [20, 220, zf - zb + 50], [sx * xb, 170, (zf + zb) / 2]));
    parts.push(box(`K${side(sx)}`, "Block", [40, 60, 90], [sx * (xin - 20), 250, zBlock]));
    parts.push(box(`A${side(sx)}`, "Armrest", [70, armT, D - 20], [sx * xs, armY, 10]));
  }
  parts.push(box("R", "Back rail", [2 * (xs - 25), 120, 20], [0, yRail, zb]));
  zBars.forEach((z, i) => parts.push({ id: `X${i}`, name: "Crossbar", shape: "cyl", size: [2 * xin, 25, 25], pos: [0, yBar, z], material: "metal" }));

  // the bed unit folded up as a seat: a pine base, the seat cushion on it and the back section standing behind
  const cy = (90 + H - 40) / 2, cz = (zBed0 + zBed1) / 2;
  const rel = (p: Vec3): Vec3 => [p[0], p[1] - cy, p[2] - cz];
  const backs = sofa ? [-1, 1].map((k) => k * (bw / 4)) : [0];
  const bed: PartPiece[] = [
    { shape: "box", size: [bw, 160, zBed1 - zBed0], pos: rel([0, 170, cz]), material: "wood" },
    { shape: "box", size: [bw, 130, zBed1 - zBed0 - 180], pos: rel([0, 315, cz + 90]), material: "soft" },
    ...backs.map((x): PartPiece => ({ shape: "box", size: [bw / backs.length - (sofa ? 10 : 0), H - 40 - 250, 170], pos: rel([x, (250 + H - 40) / 2, zBed0 + 85]), rot: [-0.12, 0, 0], material: "soft" })),
  ];
  parts.push({ id: "BED", name: "Bed unit", size: [bw, H - 40 - 90, zBed1 - zBed0], pos: [0, cy, cz], pieces: bed, material: "soft" });

  const legs = (f: (sx: number, sz: number) => Vec3) => SIDES.flatMap((sx) => SIDES.map((sz) => f(sx, sz === 1 ? zf : zb)));
  const legsOf = (sx: number) => SIDES.map((sz) => leg(sx, sz));
  const tops = legs((sx, z) => [sx * xs, legH, z]);
  const plates = legs((sx, z) => [sx * (xs - 25), legH - 30, z]);
  const plateScrews = plates.map((p): Vec3 => [p[0], p[1] - 25, p[2]]); // through the plate's lower hole
  const boardBolts = SIDES.flatMap((sx) => [zf, zb].flatMap((z) => [110, 230].map((y): Vec3 => [sx * (xin), y, z])));
  const blockBolts = (sx: number) => [-25, 25].map((dz): Vec3 => [sx * (xin - 40), 250, zBlock + dz]);
  const camPins = (sx: number): Vec3[] => [yRail - 35, yRail + 35].map((y): Vec3 => [sx * (xs - 25), y, zb]);
  const camLocks = (sx: number): Vec3[] => [yRail - 35, yRail + 35].map((y): Vec3 => [sx * (xs - 55), y, zb - 10]);
  const barBolts = SIDES.flatMap((sx) => zBars.flatMap((z) => [-18, 18].map((dz): Vec3 => [sx * xin, yBar, z + dz])));
  const hooks: Vec3[] = SIDES.map((sx): Vec3 => [sx * (bw / 2 - 120), 90, zBars[0]]);
  const fronts: Vec3[] = SIDES.map((sx): Vec3 => [sx * (bw / 2 - 120), 90, zBars[1]]);
  const feet: Vec3[] = SIDES.map((sx): Vec3 => [sx * (bw / 2 - 60), 90, zBed1 - 60]);

  const steps: CustomStep[] = [
    {
      title: "Tap a big dowel into the top of each leg",
      detail: "Lay the four legs on a rug. Use the long dowels here, the short ones come later.",
      add: SIDES.flatMap(legsOf),
      fix: [fx("dowel", tops, { len: 40, dia: 10, dir: UP, mate: "Al" })],
      tools: ["hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw a joining plate onto each leg",
      detail: "Flat side against the leg, next to the dowel. One screw in each.",
      fix: SIDES.flatMap((sx) => {
        const pts = plates.filter((p) => Math.sign(p[0]) === sx);
        return [fx("plate", pts, { name: "Joining plate", len: 3, dia: 40, dir: [sx, 0, 0] }), fx("screw", plateScrews.filter((p) => Math.sign(p[0]) === sx), { len: 40, dia: 5, dir: [sx, 0, 0] })];
      }),
      tools: ["allen"],
    },
    {
      title: "Fix a block onto each side board",
      detail: "A short dowel goes under each block. The two boards are mirror images, so check which side the block goes.",
      add: ["Bl", "Kl", "Br", "Kr"],
      fix: SIDES.map((sx) => fx("dowel", [[sx * xin, 250, zBlock]], { len: 30, dia: 8, dir: [-sx, 0, 0], on: `K${side(sx)}`, mate: `B${side(sx)}` })),
    },
    { title: "Bolt the blocks down", detail: "Two long bolts through each block, with the small Allen key.", fix: SIDES.map((sx) => fx("bolt", blockBolts(sx), { len: 70, dia: 6, dir: [sx, 0, 0], on: `K${side(sx)}`, mate: `B${side(sx)}` })), tools: ["allen"] },
    {
      title: "Bolt the side boards across the legs",
      detail: "Two bolts at each leg. Tighten them with the T-handle until the head sits flat, not sunk in.",
      fix: SIDES.map((sx) => fx("bolt", boardBolts.filter((p) => Math.sign(p[0]) === sx), { len: 20, dia: 6, dir: [sx, 0, 0], mate: legsOf(sx)[0] })),
      tools: ["allen"],
    },
    { title: "Stick a felt pad under each leg", detail: "Use the square pads here.", fix: [fx("glide", legs((sx, z) => [sx * xs, 0, z]), { name: "Felt pad", dir: UP })] },
    {
      title: "Bolt the armrests onto the legs",
      detail: "Lay each armrest upside down on the rug and stand the legs on it, dowels in the holes. One bolt through each plate.",
      add: ["Al", "Ar"],
      fix: [fx("bolt", plates.map((p): Vec3 => [p[0], legH, p[2] + 15]), { len: 20, dia: 6, dir: UP })],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Screw two cam pins into each side frame",
      detail: "Into the back leg, below the armrest, by hand.",
      fix: SIDES.map((sx) => fx("camScrew", camPins(sx), { len: 34, dia: 6, dir: [sx, 0, 0], on: leg(sx, -1), mate: "R" })),
      pose: "+x",
    },
    {
      title: "Tap a big dowel into each end of the back rail",
      fix: SIDES.map((sx) => fx("dowel", [[sx * (xs - 25), yRail, zb]], { len: 40, dia: 10, dir: [-sx, 0, 0], on: "R", mate: leg(sx, -1) })),
      wait: ["R"],
      tools: ["hammer"],
    },
    { title: "Push the back rail onto one side frame", detail: "Stand it upright on the side frame lying on the rug, onto the pins and the dowel.", add: ["R"] },
    { title: "Turn the cam locks", detail: "Two at this end. Push them in arrow first and turn them clockwise until tight.", fix: [fx("cam", camLocks(-1), { dia: 15, dir: [0, 0, 1], on: "R" })], tools: ["screwdriver"] },
    { title: "Push the other side frame on", detail: "Stand the frame up and push the second side frame onto the free end of the rail.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Turn the cam locks at this end", fix: [fx("cam", camLocks(1), { dia: 15, dir: [0, 0, 1], on: "R" })], tools: ["screwdriver"] },
    {
      title: "Bolt the two crossbars between the side boards",
      detail: "Two bolts through each end plate. Tighten them with the small Allen key.",
      add: ["X0", "X1"],
      fix: SIDES.map((sx) => fx("bolt", barBolts.filter((p) => Math.sign(p[0]) === sx), { len: 12, dia: 6, dir: [sx, 0, 0] })),
      tools: ["allen"],
    },
    {
      title: "Screw the two hooks under the bed unit",
      detail: "Lay the bed unit upside down on the rug first. One screw through each hook, with the T-handle.",
      wait: ["BED"],
      from: { BED: [0, 150, 600] },
      fix: [fx("hook", hooks, { name: "Hook bracket", len: 40, dia: 30, dir: UP, on: "BED" }), fx("screw", hooks, { len: 40, dia: 6, dir: UP, on: "BED" })],
      tools: ["allen"],
    },
    { title: "Hang the bed unit on the back crossbar", detail: "Turn it the right way up and lower it into the frame so both hooks drop over the bar.", add: ["BED"], from: { BED: [0, 150, 600] }, people: 2, warnings: ["two"] },
    { title: "Lock the hooks with clips", detail: "Push a clip up under each hook until it clicks.", fix: [fx("clip", hooks, { name: "Locking clip", len: 30, dia: 30, dir: UP })] },
    { title: "Stick felt pads on the fold-out legs", detail: "Use the round pads on the tops where the legs fold against the frame.", fix: [fx("glide", feet.map((p): Vec3 => [p[0], p[1] + 40, p[2]]), { name: "Felt pad", dir: UP })] },
    {
      title: "Open the bed and pad the feet",
      detail: "Fold the top section out and stick a square pad under each fold-out leg, then fold it back.",
      fix: [fx("glide", feet, { name: "Felt pad", dir: UP })],
    },
    { title: "Pull the bed out once", detail: "Lift the front and pull it towards you until it lies flat, so you can reach the front clips." },
    {
      title: "Clip in the front catches",
      detail: "Slide a clip into each holder at the front until it clicks, then fold the bed back into a seat.",
      fix: [fx("clip", fronts, { name: "Locking clip", len: 30, dia: 30, dir: [0, 0, -1] })],
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["TORNSBORG"], recipe };
export default family;
