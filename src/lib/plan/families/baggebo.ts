import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BAGGEBO, read from its manuals. The metal shelving units are four angle posts and perforated steel shelves:
 * two posts lie on the floor, the shelves stand on them and are screwed on at the corners (two screws each), the
 * other two posts go on top, then a perforated panel is screwed across one compartment at the back, feet go into
 * the posts and an angle bracket holds it to the wall. The white bookcases are boards between two sides that
 * reach the floor: the boards are doweled into the sides and screwed through them, with the unit lying on its
 * back, then a hardboard back in two halves is joined with a plastic joiner and nailed on, glides are knocked into
 * the sides and a bracket on the top holds it to the wall. The white cabinet with a door is built lying on its
 * front: the strip beside the door joins the top and bottom, the sides and the fixed shelf go on with dowels and
 * long screws, then the back, glides and wall bracket, and the door hangs on two pivot pins. The glass-door
 * cabinet is steel: front and back frames, a top and bottom slid on, mesh sides riveted in lying on each side in
 * turn, the back riveted on standing, a wall fitting, then the door on a pivot and two glass shelves.
 */

// the shelf runs right into the corners, inside the posts' 2 mm flanges, so each corner screw goes through both
const metal = (W: number, Dout: number, y: number, id: string): CustomPart => {
  const lip = 22, t = 2;
  const w = W - 4, D = Dout - 4;
  const pieces: PartPiece[] = [
    { shape: "box", size: [w, t, D - 2], pos: [0, lip / 2 - t / 2, 0] },
    { shape: "box", size: [w, lip, t], pos: [0, 0, D / 2 - t / 2] },
    { shape: "box", size: [w, lip, t], pos: [0, 0, -D / 2 + t / 2] },
    { shape: "box", size: [t, lip, D - 2 * t], pos: [-w / 2 + t / 2, 0, 0] },
    { shape: "box", size: [t, lip, D - 2 * t], pos: [w / 2 - t / 2, 0, 0] },
  ];
  return { id, name: "Shelf", size: [w, lip, D], pos: [0, y - lip / 2, 0], material: "metal", pieces };
};

function metalUnit(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = Math.round(s.size.d * 10);
  const P = 22; // posts, angle section
  const tall = H > 1000;
  const n = tall ? 4 : 3;
  const yLow = 120, yTop = H - 2;
  const shelfY = (i: number) => yLow + ((yTop - yLow) * i) / (n - 1); // top of each shelf
  const post = (sx: number, sz: number, id: string): CustomPart => ({
    id,
    name: "Post",
    size: [P, H - 12, P],
    pos: [sx * (W / 2 - P / 2), (H - 12) / 2 + 12, sz * (D / 2 - P / 2)],
    material: "metal",
    // an angle: two flanges along the outside faces
    pieces: [
      { shape: "box", size: [P, H - 12, 2], pos: [0, 0, sz * (P / 2 - 1)] },
      { shape: "box", size: [2, H - 12, P], pos: [sx * (P / 2 - 1), 0, 0] },
    ],
  });
  const parts: CustomPart[] = [post(-1, 1, "pFL"), post(1, 1, "pFR"), post(-1, -1, "pBL"), post(1, -1, "pBR")];
  const shelves = Array.from({ length: n }, (_, i) => `S${i}`);
  shelves.forEach((id, i) => parts.push(metal(W, D, shelfY(i), id)));
  // the perforated panel across one compartment at the back: the top one on the low unit, the second from the top on the tall one
  const k = tall ? n - 2 : n - 1;
  // it overlaps the back lips of the shelves above and below it, where its screws go
  const y0 = shelfY(k - 1) - 22, y1 = shelfY(k);
  const pw = Math.round(W * (tall ? 0.32 : 0.4)), px = Math.round(W * (tall ? 0.1 : 0.17));
  parts.push({ id: "mesh", name: "Perforated panel", size: [pw, y1 - y0, 2], pos: [px, (y0 + y1) / 2, -D / 2 + 1], material: "metal" });

  // two screws at each corner of a shelf, through the post's two flanges
  const corner = (sx: number, sz: number, y: number): Vec3[] => [
    [sx * W / 2, y - 11, sz * (D / 2 - 16)],
    [sx * (W / 2 - 16), y - 11, sz * D / 2],
  ];
  const cornerFix = (sx: number, sz: number, ids: number[], on: string): CustomFix[] => {
    const pts = ids.map((i) => corner(sx, sz, shelfY(i)));
    return [
      { kind: "screw", count: pts.length, len: 10, dia: 6, at: pts.map((p) => p[0]), dir: [-sx, 0, 0], on },
      { kind: "screw", count: pts.length, len: 10, dia: 6, at: pts.map((p) => p[1]), dir: [0, 0, -sz], on },
    ];
  };
  const all = shelves.map((_, i) => i);
  const meshScrews: CustomFix = {
    kind: "screw",
    count: 4,
    len: 10,
    dia: 6,
    at: [y0 + 11, y1 - 11].flatMap((y) => [-1, 1].map((sx) => [px + sx * (pw / 2 - 25), y, -D / 2] as Vec3)),
    dir: [0, 0, 1],
    on: "mesh",
  };
  const feet: CustomFix = { kind: "foot", count: 4, len: 14, dia: 20, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - P / 2), 12, sz * (D / 2 - P / 2)] as Vec3)), dir: [0, 1, 0] };
  const bx = W / 2 - P - 70;
  const bracketAt: Vec3[] = [-1, 1].map((sx) => [sx * bx, yTop - 11, -D / 2] as Vec3);
  const bracketStep: CustomStep = {
    title: "Screw the wall brackets to the top shelf",
    detail: "One at each end of the back edge, a washer under the screw. The slotted leg stands up behind the top.",
    fix: [
      { kind: "angle", name: "Wall bracket", count: 2, len: 50, dia: 24, at: bracketAt.map((p) => [p[0], p[1] + 26, p[2] - 2] as Vec3), dir: [0, 0, 1], on: "S" + (n - 1) },
      { kind: "washer", count: 2, len: 1.5, dia: 16, at: bracketAt.map((p) => [p[0], p[1], p[2] - 4] as Vec3), dir: [0, 0, 1] },
      { kind: "screw", count: 2, len: 10, dia: 6, at: bracketAt.map((p) => [p[0], p[1], p[2] - 5] as Vec3), dir: [0, 0, 1], on: "S" + (n - 1) },
    ],
    tools: ["screwdriver"],
  };
  const wallAt: Vec3[] = bracketAt.map((p) => [p[0], H + 20, -D / 2 - 4]);
  const wallStep: CustomStep = {
    title: "Screw it to the wall",
    detail: "Through the slot in each bracket. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      { kind: "plug", count: 2, len: 35, dia: 8, at: wallAt.map((p) => [p[0], p[1], -D / 2 - 40] as Vec3), dir: [0, 0, -1] },
      { kind: "screw", count: 2, len: 50, dia: 5, at: wallAt, dir: [0, 0, -1] },
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  };
  const steps: CustomStep[] = [
    {
      title: "Screw the first shelf to two posts",
      detail: "Lay the two front posts on a rug, the holes facing in. Stand the bottom shelf on its edge between their ends and fix each corner with two screws.",
      add: ["pFL", "pFR", "S0"],
      fix: [...cornerFix(-1, 1, [0], "pFL"), ...cornerFix(1, 1, [0], "pFR")],
      pose: "-z",
      warnings: ["floor"],
      tools: ["screwdriver"],
    },
    {
      title: `Screw on the other ${n - 1} shelves`,
      detail: "Same as the first, two screws at each corner. The top shelf goes flush with the ends of the posts.",
      add: shelves.slice(1),
      fix: [...cornerFix(-1, 1, all.slice(1), "pFL"), ...cornerFix(1, 1, all.slice(1), "pFR")],
    },
    {
      title: "Lay the back posts on and screw them on",
      detail: "Over the free corners of every shelf, two screws at each corner. Leave them a little loose until all are in, then tighten.",
      add: ["pBL", "pBR"],
      fix: [...cornerFix(-1, -1, all, "pBL"), ...cornerFix(1, -1, all, "pBR")],
      from: { pBL: [0, 0, -300], pBR: [0, 0, -300] },
    },
    {
      title: "Screw the perforated panel across the back",
      detail: tall ? "Into the second compartment from the top, two screws into the shelf above and two into the shelf below." : "Into the top compartment, two screws into the shelf above and two into the shelf below.",
      add: ["mesh"],
      fix: [meshScrews],
    },
  ];
  if (tall) {
    steps.push({ title: "Screw the feet into the posts", detail: "One into the bottom end of each post, by hand.", fix: [feet] });
    steps.push({ title: "Stand it up", detail: "Lift it upright, don't pull it up by one corner.", pose: "+y" });
    steps.push(bracketStep, wallStep);
  } else {
    steps.push({ ...bracketStep, title: "Screw the wall brackets to the back" });
    steps.push({ title: "Screw the feet into the posts", detail: "One into the bottom end of each post, by hand.", fix: [feet] });
    steps.push({ title: "Stand it up", detail: "Lift it upright, don't pull it up by one corner.", pose: "+y" });
    steps.push(wallStep);
  }
  return { parts, steps };
}

/** The white bookcases: two sides that reach the floor, boards between them, a back in two halves. */
function boardUnit(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 16, B = 3;
  const tall = H > 1200;
  const n = tall ? 5 : 3; // boards, top included
  const yBot = 90; // the bottom board stands this high, the sides reach the floor under it
  const boardY = (i: number) => yBot + T / 2 + ((H - T - yBot) * i) / (n - 1); // centre of each board, from the bottom
  const dz = B / 2; // boards and sides stop in front of the back
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, H, D - B], pos: [-W / 2 + T / 2, H / 2, dz] },
    { id: "R", name: "Side panel", size: [T, H, D - B], pos: [W / 2 - T / 2, H / 2, dz] },
  ];
  const boards = Array.from({ length: n }, (_, i) => `S${i}`);
  boards.forEach((id, i) => parts.push({ id, name: i === n - 1 ? "Top" : i === 0 ? "Bottom" : "Shelf", size: [W - 2 * T, T, D - B], pos: [0, boardY(i), dz] }));
  // the back in two halves, meeting on the middle board
  const yMid = boardY(Math.floor((n - 1) / 2));
  const yLo = yBot;
  parts.push({ id: "backLo", name: "Back panel", size: [W, yMid - yLo, B], pos: [0, (yMid + yLo) / 2, -D / 2 + B / 2], material: "fiber" });
  parts.push({ id: "backHi", name: "Back panel", size: [W, H - yMid, B], pos: [0, (H + yMid) / 2, -D / 2 + B / 2], material: "fiber" });

  const zs = (D - B) / 2 - 50;
  const dowelPts = (sx: number, ids: number[]): Vec3[] => ids.flatMap((i) => [-zs, zs].map((z) => [sx * (W / 2 - T), boardY(i), dz + z] as Vec3));
  const dowels = (sx: number, ids: number[], on?: string): CustomFix => ({ kind: "dowel", count: ids.length * 2, len: 30, dia: 8, at: dowelPts(sx, ids), dir: [sx, 0, 0], on });
  // a long screw through the side into the end of each board: two in the top and bottom of the low unit, one in the rest
  const screwZ = (i: number): number[] => (!tall && i !== Math.floor((n - 1) / 2) ? [-zs + 30, zs - 30] : [0]);
  const screws = (sx: number): CustomFix => {
    const pts = boards.flatMap((_, i) => screwZ(i).map((z) => [sx * (W / 2), boardY(i), dz + z] as Vec3));
    return { kind: "screw", count: pts.length, len: 50, dia: 5, at: pts, dir: [-sx, 0, 0], on: sx < 0 ? "L" : "R" };
  };
  const all = boards.map((_, i) => i);
  const glideAt = (sx: number) => [-1, 1].map((sz) => [sx * (W / 2 - T / 2), 0, dz + sz * ((D - B) / 2 - 30)] as Vec3);
  const glides = (sides: number[]): CustomFix => ({ kind: "glide", name: "Glide", count: 2 * sides.length, len: 6, dia: 18, at: sides.flatMap(glideAt), dir: [0, 1, 0] });
  const joiner: CustomFix = { kind: "clip", name: "Back joiner", count: 1, len: 30, dia: 20, at: [[0, yMid, -D / 2]], dir: [0, 0, 1], on: "backLo" };
  const nails: CustomFix = { kind: "nail", count: tall ? 30 : 14, len: 20, dia: 1.6, to: ["backLo", "backHi"] };
  const nb = tall ? 2 : 1;
  const bxs = nb === 1 ? [0] : [-1, 1].map((sx) => sx * (W / 2 - T - 50));
  const yTop = H;
  const bracket: CustomFix[] = [
    { kind: "angle", name: "Wall bracket", count: nb, len: 60, dia: 30, at: bxs.map((x) => [x, yTop + 30, -D / 2 + 2] as Vec3), dir: [0, -1, 0], on: `S${n - 1}` },
    { kind: "washer", count: nb, len: 1.5, dia: 16, at: bxs.map((x) => [x, yTop + 2, -D / 2 + 25] as Vec3), dir: [0, -1, 0] },
    { kind: "screw", count: nb, len: 12, dia: 4, at: bxs.map((x) => [x, yTop + 3, -D / 2 + 25] as Vec3), dir: [0, -1, 0], on: `S${n - 1}` },
  ];
  const wallAt: Vec3[] = bxs.map((x) => [x, yTop + 40, -D / 2 - 4]);
  const wall: CustomStep = {
    title: "Screw it to the wall",
    detail: `Through the slot in the bracket${nb > 1 ? "s" : ""}. Wall screws and plugs aren't included: pick ones made for your wall.`,
    fix: [
      { kind: "plug", count: nb, len: 35, dia: 8, at: wallAt.map((p) => [p[0], p[1], -D / 2 - 40] as Vec3), dir: [0, 0, -1] },
      { kind: "washer", count: nb, len: 1.5, dia: 16, at: wallAt.map((p) => [p[0], p[1], -D / 2] as Vec3), dir: [0, 0, -1] },
      { kind: "screw", count: nb, len: 50, dia: 5, at: wallAt, dir: [0, 0, -1] },
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  };
  const bracketStep: CustomStep = {
    title: nb > 1 ? "Screw the wall brackets onto the top" : "Screw the wall bracket onto the top",
    detail: "At the back edge, a washer under the screw, the slotted leg standing up. Don't tighten it so far that the washer bends.",
    fix: bracket,
    tools: ["screwdriver"],
  };
  const backSteps: CustomStep[] = [
    {
      title: "Lay the first half of the back on",
      detail: "Lay the frame on its front first. Smooth side in, its edge on the middle of a board, and push the plastic joiner onto its edge.",
      add: ["backLo"],
      fix: [joiner],
      pose: "-z",
      from: { backLo: [0, 0, -300] },
    },
    { title: "Slide the second half into the joiner", detail: "Push it in until the two halves meet, then line up the corners with the sides.", add: ["backHi"], from: { backHi: [0, 0, -300] } },
    {
      title: "Nail the back on",
      detail: "A nail in each corner first, then check the frame is square and nail along the edges and across each board. Draw a line across the back if it helps.",
      fix: [nails],
      tools: ["hammer", "pencil"],
      check: "square",
    },
  ];
  const steps: CustomStep[] = [];
  if (tall) {
    steps.push(
      {
        title: "Knock the glides into a side",
        detail: "Lay the side flat on a rug. Two glides into its bottom edge. The other side gets its two the same way before it goes on.",
        add: ["L"],
        fix: [glides([-1])],
        tools: ["hammer"],
        pose: "+x",
        warnings: ["floor"],
        from: { L: [-300, 0, 0] },
      },
      { title: "Tap the dowels into one side", detail: "Two for each board, in the holes on the inside face.", fix: [dowels(-1, all, "L")], tools: ["hammer"] },
      { title: "Push the boards on and screw them", detail: "Top, shelves and bottom onto the dowels, then one long screw through the side into each board, with the Allen key.", add: boards, fix: [screws(-1)], tools: ["allen"] },
      { title: "Tap dowels into the other ends", detail: "Two in each board.", fix: [dowels(1, all)], tools: ["hammer"] },
      { title: "Fit the other side and screw it on", detail: "Knock its glides in first. Line it up on the dowels, press it home, one screw into each board.", add: ["R"], fix: [glides([1]), screws(1)], tools: ["allen", "hammer"] },
      ...backSteps,
      { ...bracketStep, pose: "+y", title: nb > 1 ? "Stand it up and screw the wall brackets on top" : "Stand it up and screw the wall bracket on top", people: 2, warnings: ["two"] },
      wall,
    );
  } else {
    steps.push(
      { ...bracketStep, add: [`S${n - 1}`], title: "Screw the wall bracket onto the top", pose: "+y", from: { [`S${n - 1}`]: [0, 300, 0] } },
      {
        title: "Tap the dowels into the boards",
        detail: "Two into each end of every board.",
        add: boards.slice(0, -1),
        fix: [dowels(-1, all), dowels(1, all)],
        tools: ["hammer"],
      },
      { title: "Push the boards into one side", detail: "Stand the side on its long edge on a rug, the frame lying on its front. The edges with no holes face down.", add: ["L"], pose: "-z", warnings: ["floor"] },
      { title: "Screw the side to the boards", detail: "Long screws through the side, with the Allen key.", fix: [screws(-1)], tools: ["allen"] },
      { title: "Fit the other side and screw it on", detail: "Line it up on the dowels, press it home, then the same screws.", add: ["R"], fix: [screws(1)], tools: ["allen"] },
      ...backSteps,
      { title: "Knock the glides into the sides", detail: "Two into the bottom edge of each side.", fix: [glides([-1, 1])], tools: ["hammer"] },
      { title: "Stand it up", detail: "Lift it upright, don't pull it up by one corner.", pose: "+y" },
      wall,
    );
  }
  return { parts, steps };
}

type Kind = CustomFix["kind"];
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Fittings at exact points, in one part, going in one way. */
const fx = (kind: Kind, on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at: at.map((p) => p.map(r1) as Vec3), ...o });
const box = (parts: CustomPart[]) => (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) =>
  parts.push({ id, name, size: size.map(r1) as Vec3, pos: pos.map(r1) as Vec3, material: "board", ...o });

const DOWEL = { len: 30, dia: 8 };
const ALLEN = { len: 50, dia: 5, name: "Allen screw" };
const CAM_BOLT = { len: 34, dia: 7 };
const CAM = { dia: 15 };
const KNOB_BOLT = { len: 30, dia: 4, name: "Knob bolt" };

/** The pivot door the white cabinets share: bushes and plates in the panels above and below, two pins in the door. */
function pivotSteps(o: { door: string; top: string; bottom: string; x: number; yTop: number; yBot: number; z: number; plate: Vec3; knob: Vec3; oneStep?: boolean }): CustomStep[] {
  const { door, top, bottom, x, yTop, yBot, z } = o;
  const steps: CustomStep[] = [
    {
      title: "Press the hinge bushes into the panels",
      detail: "One into the hole at the front corner of the panel above the door, one into the panel below it.",
      fix: [fx("cap", bottom, [0, -1, 0], [[x, yBot, z]], { len: 10, dia: 12, name: "Hinge bush" }), fx("cap", top, [0, 1, 0], [[x, yTop, z]], { len: 10, dia: 12, name: "Hinge bush" })],
    },
    {
      title: "Push the hinge plates into the bushes",
      detail: "The round end into the bush, the arm pointing back along the panel.",
      fix: [fx("clip", bottom, [0, -1, 0], [[x, yBot + 1, z - 10]], { len: 6, dia: 20, name: "Hinge plate" }), fx("clip", top, [0, 1, 0], [[x, yTop - 1, z - 10]], { len: 6, dia: 20, name: "Hinge plate" })],
    },
    {
      title: "Screw the catch plate onto the door",
      detail: "The washer goes under the screw, on the inside face where it meets the magnetic catch.",
      fix: [fx("washer", door, [0, 0, 1], [o.plate], { len: 1.5, dia: 16, name: "Catch plate" }), fx("screw", door, [0, 0, 1], [o.plate], { len: 12, dia: 3.5 })],
      wait: [door],
      tools: ["screwdriver"],
    },
    {
      title: "Push the two pivot pins into the door",
      detail: "The spring pin goes in the top edge, the plain one in the bottom edge, both at the hinge side.",
      fix: [fx("stud", door, [0, -1, 0], [[x, yTop - 2, z]], { len: 30, dia: 8, name: "Spring pivot pin" }), fx("stud", door, [0, 1, 0], [[x, yBot + 2, z]], { len: 30, dia: 8, name: "Pivot pin" })],
      wait: [door],
    },
    {
      title: "Set the door on the lower plate",
      detail: "Drop the bottom pin into the hole in the lower hinge plate, the door standing a little open.",
      add: [door],
      from: { [door]: [0, 80, 260] },
    },
    { title: "Click the top pin into the upper plate", detail: "Press the spring pin down, swing the top of the door in and let go: it clicks into the plate.", kind: "doors" },
    {
      title: "Screw on the knob",
      detail: "The bolt goes in from the inside of the door. Tighten it by hand, then a little more with the screwdriver.",
      fix: [fx("knob", door, [0, 0, -1], [o.knob], { len: 30, dia: 30 }), fx("screw", door, [0, 0, 1], [[o.knob[0], o.knob[1], o.knob[2] - 24]], KNOB_BOLT)],
      tools: ["screwdriver"],
    },
  ];
  // the sideboard's manual shows the bushes and the plates in one step
  if (o.oneStep) steps.splice(0, 2, { title: "Fit the hinge bushes and plates", detail: "A bush into the front corner hole of the panel above and below the door, then a plate pushed into each, its arm pointing back.", fix: [...steps[0].fix!, ...steps[1].fix!] });
  return steps;
}

function wallSteps(top: string, W: number, H: number, D: number, at: Vec3, onTop = true): CustomStep[] {
  const wallAt: Vec3 = [at[0], H + 40, -D / 2 - 4];
  return [
    {
      title: onTop ? "Stand it up and screw the wall bracket onto the top" : "Screw the wall bracket on",
      detail: "At the back edge, a washer under the screw and the slotted leg standing up. Don't tighten it so far that the washer bends.",
      fix: [
        fx("angle", top, [0, -1, 0], [[at[0], at[1] + 30, at[2]]], { len: 60, dia: 30, name: "Wall bracket" }),
        fx("washer", top, [0, -1, 0], [[at[0], at[1] + 2, at[2] + 23]], { len: 1.5, dia: 16 }),
        fx("screw", top, [0, -1, 0], [[at[0], at[1] + 3, at[2] + 23]], { len: 12, dia: 4 }),
      ],
      pose: "+y",
      tools: ["screwdriver"],
    },
    {
      title: "Screw it to the wall",
      detail: "Through the slot in the bracket, with the other washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", top, [0, 0, -1], [[wallAt[0], wallAt[1], -D / 2 - 40]], { len: 35, dia: 8 }),
        fx("washer", top, [0, 0, -1], [[wallAt[0], wallAt[1], -D / 2]], { len: 1.5, dia: 16 }),
        fx("screw", top, [0, 0, -1], [wallAt], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
}

/** The white cabinet with one door: sides to the floor, a fixed strip beside the door, built lying on its front. */
function cabinetDoor(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 16, B = 3;
  const xi = W / 2 - T;
  const yB = 210 + T / 2, yT = H - T / 2, yS = r1((yB + yT) / 2); // bottom, top and the fixed shelf, centres
  const zc = B / 2, pd = D - B; // panels stop in front of the back
  const zf = D / 2 - T / 2; // the strip and the door, flush with the front
  const sw = 160; // the strip beside the door
  const parts: CustomPart[] = [];
  const add = box(parts);
  add("L", "Side panel", [T, H, pd], [-W / 2 + T / 2, H / 2, zc]);
  add("R", "Side panel", [T, H, pd], [W / 2 - T / 2, H / 2, zc]);
  add("TP", "Top panel", [2 * xi, T, pd], [0, yT, zc]);
  add("BO", "Bottom panel", [2 * xi, T, pd], [0, yB, zc]);
  add("ST", "Front strip", [sw, yT - yB - T, T], [-xi + sw / 2, (yB + yT) / 2, zf]);
  const shD = pd - T - 20;
  add("SH", "Shelf", [2 * xi, T, shD], [0, yS, -D / 2 + B + shD / 2]);
  add("BK", "Back panel", [W, H - 210, B], [0, (H + 210) / 2, -D / 2 + B / 2], { material: "fiber" });
  const dx0 = -xi + sw + 2, dx1 = xi - 2;
  add("DR", "Door", [dx1 - dx0, yT - yB - T - 4, T], [(dx0 + dx1) / 2, (yB + yT) / 2, zf]);

  const sx = (id: string) => (id === "L" ? -1 : 1);
  const sideDowels = (side: "L" | "R", ids: [string, number][]) =>
    ids.map(([id, y]) => ({ ...fx("dowel", side, [sx(side), 0, 0], [-50, 50].map((z) => [sx(side) * xi, y, (id === "SH" ? -D / 2 + B + shD / 2 : zc) + z] as Vec3), DOWEL), mate: id }));
  const sideScrews = (side: "L" | "R") =>
    (["TP", "BO"] as const).map((id) => ({ ...fx("screw", side, [-sx(side), 0, 0], [-1, 1].map((k) => [sx(side) * W / 2, id === "TP" ? yT : yB, zc + k * (pd / 2 - 40)] as Vec3), ALLEN), mate: id }));
  const cx = -xi + sw / 2;
  const catchAt: Vec3 = [dx0 + 20, yT - T / 2, zf - 22];
  const steps: CustomStep[] = [
    {
      title: "Screw the magnetic catch under the top panel",
      detail: "Lay the top panel on a rug, its underside up. The catch goes at the holes near the front edge, two screws.",
      add: ["TP"],
      fix: [fx("clip", "TP", [0, 1, 0], [[catchAt[0], catchAt[1] - 6, catchAt[2]]], { len: 30, dia: 14, name: "Magnetic catch" }), fx("screw", "TP", [0, 1, 0], [-12, 12].map((d) => [catchAt[0] + d, catchAt[1], catchAt[2]] as Vec3), { len: 12, dia: 3.5 })],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Tap the dowels into the front strip",
      detail: "Two into each end.",
      fix: [
        { ...fx("dowel", "ST", [0, -1, 0], [-40, 40].map((d) => [cx + d, yT - T / 2, zf] as Vec3), DOWEL), mate: "TP" },
        { ...fx("dowel", "ST", [0, 1, 0], [-40, 40].map((d) => [cx + d, yB + T / 2, zf] as Vec3), DOWEL), mate: "BO" },
      ],
      wait: ["ST"],
      tools: ["hammer"],
    },
    {
      title: "Join the strip to the top and bottom panels",
      detail: "Lay the strip flat and push the top and the bottom panel onto its ends, standing on their front edges. The catch faces in.",
      add: ["ST", "BO"],
      pose: "-z",
    },
    { title: "Tap dowels into a side and push it on", detail: "Two for the top and two for the bottom, in the holes on the inside face. Line it up and press it home.", add: ["L"], fix: sideDowels("L", [["TP", yT], ["BO", yB]]), tools: ["hammer"], from: { L: [-300, 0, 0] } },
    { title: "Screw the side to the top and bottom", detail: "Four long screws with the Allen key, two into each panel.", fix: sideScrews("L"), tools: ["allen"] },
    { title: "Slide the shelf in", detail: "Two dowels into the side for it first, then push the shelf onto them, its front edge behind the strip.", add: ["SH"], fix: sideDowels("L", [["SH", yS]]), tools: ["hammer"], from: { SH: [300, 0, 0] } },
    { title: "Fit the other side", detail: "Six dowels into its inside face, for the top, the shelf and the bottom. Then press it onto all three.", add: ["R"], fix: sideDowels("R", [["TP", yT], ["SH", yS], ["BO", yB]]), tools: ["hammer"], from: { R: [300, 0, 0] } },
    { title: "Screw the other side on", detail: "Four long screws, two into the top and two into the bottom.", fix: sideScrews("R"), tools: ["allen"] },
    {
      title: "Nail the back on",
      detail: "Smooth side in, lined up with the sides. A nail in each corner first, check it's square, then nail along the edges and across the shelf. The plastic holder keeps your fingers clear.",
      add: ["BK"],
      fix: [{ kind: "nail", count: 14, len: 20, dia: 1.6, to: ["BK"] }],
      from: { BK: [0, 0, -300] },
      tools: ["hammer"],
      check: "square",
    },
    {
      title: "Knock the glides into the sides",
      detail: "Two into the bottom edge of each side.",
      fix: [fx("glide", "L", [0, 1, 0], [-1, 1].map((k) => [-W / 2 + T / 2, 0, zc + k * (pd / 2 - 30)] as Vec3), { len: 6, dia: 18, name: "Glide" }), fx("glide", "R", [0, 1, 0], [-1, 1].map((k) => [W / 2 - T / 2, 0, zc + k * (pd / 2 - 30)] as Vec3), { len: 6, dia: 18, name: "Glide" })],
      tools: ["hammer"],
    },
    ...wallSteps("TP", W, H, D, [0, H, -D / 2 + 2]),
    ...pivotSteps({ door: "DR", top: "TP", bottom: "BO", x: dx1 - 16, yTop: yT - T / 2, yBot: yB + T / 2, z: zf, plate: [dx0 + 20, yT - T / 2 - 22, zf - T / 2], knob: [dx0 + 30, yS, zf + T / 2] }),
  ];
  return { parts, steps };
}

/** The metal cabinet with a glass door: front and back frames, a top and bottom, mesh sides, built lying on its side. */
function glassCabinet(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 20; // square tube
  const yb = 140; // the body starts above the legs
  const yt = H - 20; // the frames stop under the top
  const parts: CustomPart[] = [];
  const add = box(parts);
  const frame = (id: string, name: string, sz: number) => {
    const h = yt;
    add(id, name, [W, h, P], [0, h / 2, sz * (D / 2 - P / 2)], {
      material: "metal",
      pieces: [
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [P, h, P], pos: [sx * (W / 2 - P / 2), 0, 0] })),
        { shape: "box", size: [W - 2 * P, P, P], pos: [0, h / 2 - P / 2, 0] },
        { shape: "box", size: [W - 2 * P, P, P], pos: [0, yb + P / 2 - h / 2, 0] },
      ],
    });
  };
  frame("FF", "Front frame", 1);
  frame("BF", "Back frame", -1);
  add("TP", "Top", [W, 20, D], [0, H - 10, 0], { material: "metal" });
  add("BO", "Bottom", [W - 2 * P, 20, D - 2 * P], [0, yb + 10, 0], { material: "metal" });
  const mh = yt - yb - 20, my = (yt + yb + 20) / 2;
  add("ML", "Side panel", [2, mh, D - 2 * P], [-W / 2 + P / 2, my, 0], { material: "metal" });
  add("MR", "Side panel", [2, mh, D - 2 * P], [W / 2 - P / 2, my, 0], { material: "metal" });
  add("BK", "Back panel", [W - 2 * P, yt - yb - P, 1.5], [0, (yt + yb + P) / 2, -D / 2 + P / 2], { material: "metal" });
  const dw = W - 2 * P - 4, dh = yt - P - (yb + P) - 4, dy = (yt + yb) / 2;
  add("DR", "Glass door", [dw, dh, 16], [0, dy, D / 2 - P / 2], {
    material: "metal",
    pieces: [
      { shape: "box", size: [dw - 24, dh - 24, 4], pos: [0, 0, 0], material: "glass" },
      ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [12, dh, 16], pos: [k * (dw / 2 - 6), 0, 0] })),
      ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [dw - 24, 12, 16], pos: [0, k * (dh / 2 - 6), 0] })),
    ],
  });
  const ys = [0.37, 0.66].map((f) => yb + (yt - yb) * f);
  ys.forEach((y, i) => add(`G${i}`, "Glass shelf", [W - 2 * P - 6, 5, D - 2 * P - 10], [0, y, 0], { material: "glass" }));

  const supports = (side: "ML" | "MR"): CustomFix => {
    const sx = side === "ML" ? -1 : 1;
    return fx("pin", side, [sx, 0, 0], ys.flatMap((y) => [-1, 1].map((k) => [sx * (W / 2 - P / 2 - 1), y - 7, k * (D / 2 - P - 30)] as Vec3)), { len: 14, dia: 8, name: "Shelf support" });
  };
  const RIVET = { len: 10, dia: 10, name: "Plastic rivet" }, PIN = { len: 8, dia: 12, name: "Rivet pin" };
  const rivets = (on: string, at: Vec3[], dir: Vec3): CustomFix[] => [fx("clip", on, dir, at, RIVET), fx("cap", on, dir, at, PIN)];
  const sideRivets = (side: "ML" | "MR") => {
    const sx = side === "ML" ? -1 : 1;
    return rivets(side, [-1, 1].flatMap((k) => [yb + 70, yt - 70].map((y) => [sx * (W / 2), y, k * (D / 2 - P / 2)] as Vec3)), [-sx, 0, 0]);
  };
  const pivot: Vec3 = [-W / 2 + P + 14, 0, D / 2 - P / 2];
  const wallAt: Vec3 = [0, yt - 40, -D / 2 + P / 2];
  const steps: CustomStep[] = [
    {
      title: "Screw the feet into the frames",
      detail: "Lay the front and the back frame on a rug. One foot into the end of each leg, screwed in by hand.",
      add: ["FF", "BF"],
      fix: [-1, 1].flatMap((sz) => [fx("foot", sz > 0 ? "FF" : "BF", [0, 1, 0], [-1, 1].map((sx) => [sx * (W / 2 - P / 2), 0, sz * (D / 2 - P / 2)] as Vec3), { len: 30, dia: 24, name: "Adjustable foot" })]),
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Slide the top onto the frames", detail: "Stand both frames on their long edge and push the top over their top ends, the holes lined up.", add: ["TP"], from: { TP: [0, 300, 0] } },
    { title: "Slide the bottom in between the frames", detail: "Over the lower rails, the holes facing the frames.", add: ["BO"], from: { BO: [0, -300, 0] } },
    { title: "Lay the first side panel in", detail: "Its flanges go inside the frames. Slide it until its holes line up with the holes in the tubes.", add: ["ML"], from: { ML: [-300, 0, 0] } },
    { title: "Screw in its shelf supports", detail: "Four of them, through the side panel into the holes, by hand.", fix: [supports("ML")] },
    { title: "Click the rivets into the side panel", detail: "Push each sleeve through the panel and the tube, then press its pin in until it clicks.", fix: sideRivets("ML") },
    { title: "Turn it over and lay the other side panel in", detail: "Line it up the same way, then screw its four shelf supports in.", add: ["MR"], fix: [supports("MR")], pose: "-x", from: { MR: [300, 0, 0] } },
    { title: "Rivet the second side panel on", detail: "Four sleeves and pins, pressed in until they click.", fix: sideRivets("MR") },
    {
      title: "Stand it up and rivet the back on",
      detail: "Push the back panel into the back frame from behind, then four rivets through its corners.",
      add: ["BK"],
      fix: rivets("BK", [-1, 1].flatMap((sx) => [yb + 60, yt - 60].map((y) => [sx * (W / 2 - P - 15), y, -D / 2 + P / 2] as Vec3)), [0, 0, 1]),
      pose: "+y",
      from: { BK: [0, 0, -300] },
    },
    { title: "Level the feet", detail: "Turn each foot in or out until it stands steady on the floor.", tools: ["level"] },
    {
      title: "Fix it to the wall",
      detail: "Fold the wall fitting together and click it in under the top at the back. Screw through it into the wall with the washer, then snap the cap on. Wall screws and plugs aren't included.",
      fix: [
        fx("bracket", "BK", [0, 0, -1], [wallAt], { len: 30, dia: 30, name: "Wall fitting" }),
        fx("plug", "BK", [0, 0, -1], [[wallAt[0], wallAt[1], -D / 2 - 40]], { len: 35, dia: 8 }),
        fx("washer", "BK", [0, 0, -1], [[wallAt[0], wallAt[1], wallAt[2] + 8]], { len: 2, dia: 20 }),
        fx("screw", "BK", [0, 0, -1], [[wallAt[0], wallAt[1], wallAt[2] + 8]], { len: 50, dia: 5 }),
        fx("cap", "BK", [0, 0, -1], [[wallAt[0], wallAt[1], wallAt[2] + 10]], { len: 6, dia: 24, name: "Cover cap" }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw the knob onto the door",
      detail: "Lay the door on the rug. The screw goes through the frame from the inside into the knob.",
      fix: [fx("knob", "DR", [0, 0, -1], [[W / 2 - P - 20, dy, D / 2]], { len: 30, dia: 26 }), fx("screw", "DR", [0, 0, 1], [[W / 2 - P - 20, dy, D / 2 - 24]], { len: 26, dia: 4, name: "Knob screw" })],
      wait: ["DR"],
      tools: ["screwdriver"],
    },
    { title: "Push the lower pivot into the bottom", detail: "Into the hole at the front corner on the hinge side.", fix: [fx("stud", "BO", [0, -1, 0], [[pivot[0], yb + 20, pivot[2] - 12]], { len: 16, dia: 8, name: "Door pivot" })] },
    {
      title: "Hang the door",
      detail: "Set its bottom corner on the pivot, swing the top in under the top panel and screw the pivot screw down through the top into the door.",
      add: ["DR"],
      fix: [fx("screw", "TP", [0, -1, 0], [[pivot[0], H, pivot[2]]], { len: 40, dia: 6, name: "Pivot screw" })],
      from: { DR: [0, 0, 260] },
      tools: ["screwdriver"],
      kind: "doors",
    },
    { title: "Lay the glass shelves on the supports", detail: "Tilt each one in through the door and lower it onto its four supports.", add: ["G0", "G1"], from: { G0: [0, 0, 300], G1: [0, 0, 300] } },
  ];
  return { parts, steps };
}

/**
 * The sideboard: two sides and a divider to the floor, a drawer and an open cubby on a long panel under the top,
 * a shelf and a bottom on each side of the divider (the right ones behind a pivot door). Lying on its back, the
 * left side gets its shelf and bottom, the long panel with the small divider and the divider are joined and put
 * on, the right shelf goes on double cam bolts through the divider and the right bottom slides in, then the right
 * side. Standing up the top goes on cam locks, the back is nailed on lying on its front, then the door and drawer.
 */
function sideboard(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 16, B = 3;
  const xi = W / 2 - T; // inside faces of the sides
  const lw = 440; // the drawer side, between the left side and the divider
  const xm = -xi + lw + T / 2; // the divider and the small divider above it
  const zc = B / 2, pd = D - B;
  const zf = D / 2 - T / 2;
  const y0 = 190; // the bottoms stand this high
  const yB = y0 + T / 2;
  const yP = 764 - T / 2; // the long panel under the drawer and the cubby
  const yS = r1((yB + yP) / 2);
  const ys = H - T; // tops of the sides
  const parts: CustomPart[] = [];
  const add = box(parts);
  add("L", "Side panel", [T, ys, pd], [-W / 2 + T / 2, ys / 2, zc]);
  add("R", "Side panel", [T, ys, pd], [W / 2 - T / 2, ys / 2, zc]);
  add("M", "Divider", [T, yP - T / 2, pd], [xm, (yP - T / 2) / 2, zc]);
  add("P", "Long panel", [2 * xi, T, pd], [0, yP, zc]);
  add("S", "Small divider", [T, ys - yP - T / 2, pd], [xm, (ys + yP + T / 2) / 2, zc]);
  add("TP", "Top", [W, T, D], [0, H - T / 2, 0]);
  const xl0 = -xi, xl1 = xm - T / 2, xr0 = xm + T / 2, xr1 = xi;
  const shD = pd - 20;
  add("SL", "Shelf", [xl1 - xl0, T, pd], [(xl0 + xl1) / 2, yS, zc]);
  add("BL", "Bottom", [xl1 - xl0, T, pd], [(xl0 + xl1) / 2, yB, zc]);
  add("SR", "Shelf", [xr1 - xr0, T, shD], [(xr0 + xr1) / 2, yS, -D / 2 + B + shD / 2]);
  add("BR", "Bottom", [xr1 - xr0, T, pd], [(xr0 + xr1) / 2, yB, zc]);
  add("BK", "Back panel", [W, ys - y0, B], [0, (ys + y0) / 2, -D / 2 + B / 2], { material: "fiber" });
  const dx0 = xr0 + 2, dx1 = xr1 - 2;
  add("DR", "Door", [dx1 - dx0, yP - yB - T - 4, T], [(dx0 + dx1) / 2, (yB + yP) / 2, zf]);
  // the drawer: inset front, a box between the runners
  const dxc = (xl0 + xl1) / 2, oh = ys - yP - T / 2; // the opening
  const bw = lw - 26, bd = 270, bh = oh - 30, by0 = yP + T / 2 + 12;
  const bz1 = D / 2 - T, bz0 = bz1 - bd, bzc = (bz0 + bz1) / 2;
  add("DF", "Drawer front", [lw - 6, oh - 6, T], [dxc, yP + T / 2 + oh / 2, zf]);
  add("DS1", "Drawer side", [12, bh, bd], [dxc - bw / 2 + 6, by0 + bh / 2, bzc]);
  add("DS2", "Drawer side", [12, bh, bd], [dxc + bw / 2 - 6, by0 + bh / 2, bzc]);
  add("DB", "Drawer bottom", [bw - 16, 3, bd - 14], [dxc, by0 + 10, bzc + 2], { material: "fiber" });
  add("DK", "Drawer back", [bw - 24, bh - 14, 12], [dxc, by0 + 14 + (bh - 14) / 2, bz0 + 6]);

  const yRun = yP + T / 2 + 40;
  const runAt = (x: number): Vec3 => [x, yRun, zc + 5];
  const zz = (k: number) => zc + k * (pd / 2 - 50);
  const dw = (on: string, dir: Vec3, pts: Vec3[], mate: string, o: Partial<CustomFix> = DOWEL) => ({ ...fx("dowel", on, dir, pts, o), mate });
  const pair = (x: number, y: number, z0 = zc, d = 50): Vec3[] => [-1, 1].map((k) => [x, y, z0 + k * d] as Vec3);
  const screwsThrough = (side: "L" | "R", list: [string, number, number, number?][]) =>
    list.map(([id, y, n, z1]) => {
      const sx = side === "L" ? -1 : 1;
      const zs = n === 1 ? [z1 ?? zc] : [zz(-1), zz(1)];
      return { ...fx("screw", side, [-sx, 0, 0], zs.map((z) => [sx * W / 2, y, z] as Vec3), ALLEN), mate: id };
    });
  const camsIn = (on: string, at: Vec3[], dir: Vec3) => fx("cam", on, dir, at, CAM);
  const steps: CustomStep[] = [
    {
      title: "Screw the drawer runners onto the side and the small divider",
      detail: "Lay the left side and the small divider on a rug, inside faces up. One screw into the front hole of each runner first.",
      add: ["L"],
      fix: [fx("runner", "L", [-1, 0, 0], [runAt(-xi)], { len: bd, dia: 20, name: "Drawer runner" }), fx("runner", "S", [1, 0, 0], [runAt(xm - T / 2)], { len: bd, dia: 20, name: "Drawer runner" }), fx("screw", "L", [-1, 0, 0], [[-xi, yRun, zc + bd / 2 - 30]], { len: 12, dia: 4 }), fx("screw", "S", [1, 0, 0], [[xm - T / 2, yRun, zc + bd / 2 - 30]], { len: 12, dia: 4 })],
      wait: ["S"],
      pose: "+x",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Slide the runners open and screw the back ends",
      detail: "Pull the inner part forward until the back hole shows, one more screw in each.",
      fix: [fx("screw", "L", [-1, 0, 0], [[-xi, yRun, zc - bd / 2 + 30]], { len: 12, dia: 4 }), fx("screw", "S", [1, 0, 0], [[xm - T / 2, yRun, zc - bd / 2 + 30]], { len: 12, dia: 4 })],
      wait: ["S"],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the long dowels into the left shelf and bottom",
      detail: "Two in the end of each that meets the divider. Use the long ones here, not the short ones.",
      fix: [dw("SL", [-1, 0, 0], pair(xl1, yS), "M", { len: 40, dia: 8, name: "Long dowel" }), dw("BL", [-1, 0, 0], pair(xl1, yB), "M", { len: 40, dia: 8, name: "Long dowel" })],
      wait: ["SL", "BL"],
      tools: ["hammer"],
    },
    { title: "Tap short dowels into their other ends", detail: "Two in each.", fix: [dw("SL", [1, 0, 0], pair(xl0, yS), "L"), dw("BL", [1, 0, 0], pair(xl0, yB), "L")], wait: ["SL", "BL"], tools: ["hammer"] },
    {
      title: "Screw the left shelf and bottom to the side",
      detail: "Stand the side on its back edge. Push both panels onto it, their front edges flush with its front, then three long screws through the side.",
      add: ["SL", "BL"],
      fix: screwsThrough("L", [["SL", yS, 1], ["BL", yB, 2]]),
      pose: "+z",
      tools: ["allen"],
    },
    { title: "Tap dowels into the long panel", detail: "Two into each end and one into the face, where the small divider stands.", fix: [dw("P", [1, 0, 0], pair(-xi, yP), "L"), dw("P", [-1, 0, 0], pair(xi, yP), "R"), dw("P", [0, -1, 0], [[xm, yP + T / 2, zc]], "S")], wait: ["P"], tools: ["hammer"] },
    { title: "Screw two cam bolts into the long panel", detail: "Into the holes either side of that dowel, until they stop.", fix: [{ ...fx("camScrew", "P", [0, -1, 0], pair(xm, yP + T / 2, zc, 90), CAM_BOLT), mate: "S" }], wait: ["P"], tools: ["screwdriver"] },
    { title: "Stand the small divider on the long panel", detail: "Onto the dowel and the two cam bolts, the runner on the drawer side.", wait: ["P", "S"] },
    { title: "Turn its cam locks", detail: "Two, arrow towards the bolt, turned until they pull it down tight.", fix: [camsIn("S", pair(xm, yP + T / 2 + 30, zc, 90).map((p) => [xm + T / 2, p[1], p[2]] as Vec3), [-1, 0, 0])], wait: ["S"], tools: ["screwdriver"] },
    { title: "Screw two cam bolts under the long panel", detail: "Turn it over: they go where the divider meets it.", fix: [{ ...fx("camScrew", "P", [0, 1, 0], pair(xm, yP - T / 2, zc, 90), CAM_BOLT), mate: "M" }], wait: ["P"], tools: ["screwdriver"] },
    { title: "Tap two dowels into the end of the divider", detail: "Into its top edge.", fix: [dw("M", [0, -1, 0], pair(xm, yP - T / 2), "P")], wait: ["M"], tools: ["hammer"] },
    { title: "Push the divider onto the long panel", detail: "Onto the dowels and the cam bolts, the edges flush at the front.", wait: ["M", "P"] },
    { title: "Lock the divider", detail: "Two cam locks in the divider, turned clockwise until tight.", fix: [camsIn("M", pair(xm, yP - T / 2 - 30, zc, 90).map((p) => [xm - T / 2, p[1], p[2]] as Vec3), [1, 0, 0])], wait: ["M"], tools: ["screwdriver"] },
    { title: "Join the two halves", detail: "Slide the divider and long panel onto the left side's panels: the long dowels go into the divider, the long panel onto the side.", add: ["M", "P", "S"], from: { M: [400, 0, 0], P: [400, 0, 0], S: [400, 0, 0] } },
    { title: "Screw the side to the long panel", detail: "Two long screws through the side.", fix: screwsThrough("L", [["P", yP, 2]]), tools: ["allen"] },
    {
      title: "Push the double cam bolts through the divider",
      detail: "Two of them, from the right, into the left shelf. Turn its two cam locks to grip their ends.",
      fix: [{ ...fx("connector", "M", [-1, 0, 0], pair(xm + T / 2, yS, -D / 2 + B + shD / 2, 70), { len: 70, dia: 7, name: "Double cam bolt" }), mate: "SR" }, camsIn("SL", pair(xl1 - 30, yS + T / 2, zc, 70), [0, -1, 0])],
      tools: ["screwdriver"],
    },
    { title: "Push the right shelf onto the bolts", detail: "Its front edge sits back from the front, so the door can close.", add: ["SR"], from: { SR: [300, 0, 0] } },
    { title: "Lock the right shelf", detail: "Two cam locks, turned until tight.", fix: [camsIn("SR", pair(xr0 + 30, yS + T / 2, -D / 2 + B + shD / 2, 70), [0, -1, 0])], tools: ["screwdriver"] },
    { title: "Tap dowels into the right bottom", detail: "Two into each end.", fix: [dw("BR", [-1, 0, 0], pair(xr0, yB), "M"), dw("BR", [1, 0, 0], pair(xr1, yB), "R")], wait: ["BR"], tools: ["hammer"] },
    { title: "Slide the right bottom in", detail: "From the end, onto the divider's holes, level with the left bottom.", add: ["BR"], from: { BR: [0, 0, 300] } },
    { title: "Tap dowels into the right ends", detail: "Two into the long panel and two into the right shelf.", fix: [dw("SR", [-1, 0, 0], pair(xr1, yS, -D / 2 + B + shD / 2), "R"), dw("P", [-1, 0, 0], pair(xr1, yP, zc, 20), "R")], tools: ["hammer"] },
    { title: "Fit the right side and screw it on", detail: "Press it onto all the dowels, then five long screws.", add: ["R"], fix: screwsThrough("R", [["P", yP, 2], ["SR", yS, 1, -D / 2 + B + shD / 2], ["BR", yB, 2]]), tools: ["allen"], from: { R: [300, 0, 0] } },
    {
      title: "Stand it up and tap dowels into the tops",
      detail: "Two into each side and one into the small divider.",
      fix: [dw("L", [0, -1, 0], pair(-W / 2 + T / 2, ys), "TP"), dw("R", [0, -1, 0], pair(W / 2 - T / 2, ys), "TP"), dw("S", [0, -1, 0], [[xm, ys, zc]], "TP")],
      pose: "+y",
      people: 2,
      warnings: ["two"],
      tools: ["hammer"],
    },
    {
      title: "Screw the wall bracket onto the small divider",
      detail: "Near its top at the back, a washer under the screw. The slotted leg points back to the wall.",
      fix: [fx("angle", "S", [-1, 0, 0], [[xm + T / 2 + 2, ys - 40, -D / 2 + 30]], { len: 60, dia: 30, name: "Wall bracket", twist: Math.PI / 2 }), fx("washer", "S", [-1, 0, 0], [[xm + T / 2 + 4, ys - 40, -D / 2 + 40]], { len: 1.5, dia: 16 }), fx("screw", "S", [-1, 0, 0], [[xm + T / 2 + 5, ys - 40, -D / 2 + 40]], { len: 12, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Screw six cam bolts under the top", detail: "Lay the top upside down on the rug, they go into the small holes.", fix: [{ ...fx("camScrew", "TP", [0, 1, 0], [...pair(-W / 2 + T / 2, ys, zc, 100), ...pair(xm, ys, zc, 100), ...pair(W / 2 - T / 2, ys, zc, 100)], CAM_BOLT), mate: "L" }], wait: ["TP"], tools: ["screwdriver"] },
    { title: "Turn the top over and lower it on", detail: "Onto the dowels and into the holes in the tops of the sides and the small divider.", add: ["TP"], from: { TP: [0, 300, 0] } },
    {
      title: "Lock the top",
      detail: "Six cam locks, two in each side and two in the small divider, turned until tight.",
      fix: [camsIn("L", pair(-xi, ys - 30, zc, 100), [1, 0, 0]), camsIn("R", pair(xi, ys - 30, zc, 100), [-1, 0, 0]), camsIn("S", pair(xm - T / 2, ys - 30, zc, 100), [1, 0, 0])],
      tools: ["screwdriver"],
    },
    { title: "Lay it on its front and the back on", detail: "Unfold the back and lay it on, smooth side in, lined up with the top and the sides.", add: ["BK"], pose: "-z", people: 2, warnings: ["two", "floor"], from: { BK: [0, 0, -300] } },
    { title: "Mark the panels on the back", detail: "Draw two lines across, over the middle of the shelves, so the nails hit them.", tools: ["pencil", "tape"] },
    {
      title: "Nail the back on",
      detail: "A nail in each corner first, check it's square, then along the edges and the lines. The plastic holder keeps your fingers clear.",
      fix: [{ kind: "nail", count: 15, len: 20, dia: 1.6, to: ["BK"] }],
      tools: ["hammer"],
      check: "square",
    },
    {
      title: "Knock the glides in",
      detail: "Two into the bottom edge of each side and of the divider.",
      fix: [-W / 2 + T / 2, xm, W / 2 - T / 2].map((x, i) => fx("glide", ["L", "M", "R"][i], [0, 1, 0], [-1, 1].map((k) => [x, 0, zc + k * (pd / 2 - 30)] as Vec3), { len: 6, dia: 18, name: "Glide" })),
      tools: ["hammer"],
    },
    {
      title: "Stand it up and screw the magnetic catch under the long panel",
      detail: "At the front, next to the divider, two screws.",
      fix: [fx("clip", "P", [0, 1, 0], [[dx0 + 20, yP - T / 2 - 6, zf - 22]], { len: 30, dia: 14, name: "Magnetic catch" }), fx("screw", "P", [0, 1, 0], [-12, 12].map((d) => [dx0 + 20 + d, yP - T / 2, zf - 22] as Vec3), { len: 12, dia: 3.5 })],
      pose: "+y",
      tools: ["screwdriver"],
    },
    ...pivotSteps({ door: "DR", top: "P", bottom: "BR", x: dx1 - 16, yTop: yP - T / 2, yBot: yB + T / 2, z: zf, plate: [dx0 + 20, yP - T / 2 - 22, zf - T / 2], knob: [dx0 + 30, yS, zf + T / 2], oneStep: true }),
    {
      title: "Screw it to the wall",
      detail: "Through the slot in the bracket, with the other washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", "S", [0, 0, -1], [[xm + 40, ys - 40, -D / 2 - 40]], { len: 35, dia: 8 }),
        fx("washer", "S", [0, 0, -1], [[xm + 40, ys - 40, -D / 2]], { len: 1.5, dia: 16 }),
        fx("screw", "S", [0, 0, -1], [[xm + 40, ys - 40, -D / 2 + 2]], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw four cam bolts into the drawer front",
      detail: "Lay it face down on the rug. Two near each end.",
      fix: [-1, 1].map((sx) => ({ ...fx("camScrew", "DF", [0, 0, 1], [by0 + 25, by0 + bh - 25].map((y) => [dxc + sx * (bw / 2 - 6), y, zf - T / 2] as Vec3), CAM_BOLT), mate: sx < 0 ? "DS1" : "DS2" })),
      wait: ["DF"],
      tools: ["screwdriver"],
    },
    { title: "Stand the drawer sides on the front", detail: "Onto the cam bolts, the grooves facing in and down.", add: ["DF", "DS1", "DS2"], from: { DF: [0, 0, 500], DS1: [-200, 0, 500], DS2: [200, 0, 500] } },
    { title: "Lock the sides", detail: "Four cam locks in the sides, turned until tight.", fix: [-1, 1].map((sx) => camsIn(sx < 0 ? "DS1" : "DS2", [by0 + 25, by0 + bh - 25].map((y) => [dxc + sx * (bw / 2 - 12), y, bz1 - 30] as Vec3), [sx, 0, 0])), tools: ["screwdriver"] },
    { title: "Slide the bottom into the grooves", detail: "All the way down to the front.", add: ["DB"], from: { DB: [0, 0, -300] } },
    {
      title: "Knock the back on",
      detail: "Lay it on the ends of the sides, over the bottom, and hammer the four plastic pins through the sides into it.",
      add: ["DK"],
      fix: [-1, 1].map((sx) => ({ ...fx("dowel", sx < 0 ? "DS1" : "DS2", [-sx, 0, 0], [by0 + 25, by0 + bh - 25].map((y) => [dxc + sx * (bw / 2), y, bz0 + 6] as Vec3), { len: 40, dia: 8, name: "Plastic pin" }), mate: "DK" })),
      from: { DK: [0, 0, -300] },
      tools: ["hammer"],
    },
    { title: "Screw the knob onto the drawer", detail: "The bolt goes in from the inside of the front.", fix: [fx("knob", "DF", [0, 0, -1], [[dxc, yP + T / 2 + oh / 2, D / 2]], { len: 30, dia: 30 }), fx("screw", "DF", [0, 0, 1], [[dxc, yP + T / 2 + oh / 2, D / 2 - 24]], KNOB_BOLT)], tools: ["screwdriver"] },
    { title: "Pull the runners out", detail: "Pull the inner part of both runners forward until they stop.", kind: "drawer" },
    { title: "Slide the drawer onto the runners", detail: "Rest it on them and push it in.", kind: "drawer" },
    { title: "Pull the drawer out to the stop", detail: "Until the screw holes in the runners line up with the holes in the drawer sides.", kind: "drawer" },
    {
      title: "Screw the runners to the drawer",
      detail: "One small screw through each runner into the drawer side.",
      fix: [-1, 1].map((sx) => ({ ...fx("screw", sx < 0 ? "DS1" : "DS2", [sx, 0, 0], [[dxc + sx * (bw / 2 + 2), yRun, bz1 - 40]], { len: 10, dia: 4 }), mate: sx < 0 ? "L" : "S" })),
      tools: ["screwdriver"],
    },
    { title: "Push the drawer shut", detail: "It should run smoothly all the way in." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BAGGEBO"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/baggebo-shelving-unit/.test(slug)) return metalUnit(s);
    if (/baggebo-shelf-unit|baggebo-bookcase/.test(slug)) return boardUnit(s);
    if (/baggebo-cabinet-door/.test(slug)) return cabinetDoor(s);
    if (/baggebo-glass-door-cabinet/.test(slug)) return glassCabinet(s);
    if (/baggebo-sideboard/.test(slug)) return sideboard(s);
    return null;
  },
};
export default family;
