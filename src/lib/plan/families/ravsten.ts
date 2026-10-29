import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * RÄVSTEN (black solid wood), read from its three manuals.
 * Bar stool and bench share one build: dowels and two long bolts go into each ready-made end frame (two legs with
 * a top rail and a foot rail), the frame lies flat and the long rails stand in it, the other frame goes on top,
 * clamps in the rails' slots are tightened onto the bolts, the foot rails are screwed at an angle, and the frame
 * goes upside down onto the seat, held with long screws. The stool's legs splay both ways, the bench's only to
 * the ends; the bench's seat is dowelled first and its clamps are tightened on the seat.
 * Table: the top comes with its rail frame fitted. Each leg gets a cross dowel and two threaded rods, goes into a
 * corner bracket with a washer and nut on each rod, then two people turn it over.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));

/** A leg from its top centre to its foot centre: middle, length and the turn that points it there. */
function legBetween(top: Vec3, foot: Vec3) {
  const d: Vec3 = [top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  const rot: Vec3 = [Math.atan2(u[2], u[1]), 0, -Math.asin(u[0])];
  const mid: Vec3 = [(top[0] + foot[0]) / 2, (top[1] + foot[1]) / 2, (top[2] + foot[2]) / 2];
  return { mid, len, rot };
}
const rel = (p: Vec3, c: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];

interface Frame {
  legX: (y: number) => number; // leg centre, distance from the middle along x at height y
  legZ: (y: number) => number;
  yTop: number; // leg tops
  apronY: number;
  footY: number; // the end frames' foot rails
  railFootY: number; // the long foot rails
  apronH: number;
}

/** One end frame (two legs, top rail, foot rail) at side g, as pieces about its own middle. */
function endFrame(f: Frame, g: number, L: number): CustomPart {
  const c: Vec3 = [g * (f.legX(f.yTop) + f.legX(0)) / 2, f.yTop / 2, 0];
  const legs = [-1, 1].map((z): PartPiece => {
    const l = legBetween(pt(g * f.legX(f.yTop), f.yTop, z * f.legZ(f.yTop)), pt(g * f.legX(0), 0, z * f.legZ(0)));
    return { shape: "box", size: [L, l.len, L], pos: rel(l.mid, c), rot: l.rot };
  });
  const rail = (y: number, h: number): PartPiece => ({ shape: "box", size: [20, h, 2 * f.legZ(y) - L], pos: rel(pt(g * f.legX(y), y, 0), c) });
  const spanX = f.legX(0) - f.legX(f.yTop) + L;
  return {
    id: g < 0 ? "FL" : "FR",
    name: "End frame",
    size: [spanX, f.yTop, 2 * f.legZ(0) + L],
    pos: c,
    material: "wood",
    pieces: [...legs, rail(f.apronY, f.apronH), rail(f.footY, 30)],
  };
}

/** The long rails between the end frames: the two top rails (with clamp slots) and the two foot rails. */
function longRails(f: Frame, L: number): CustomPart[] {
  const rail = (id: string, name: string, y: number, h: number, z: number): CustomPart => ({
    id,
    name,
    size: [2 * (f.legX(y) - L / 2), h, 20],
    pos: [0, y, z * f.legZ(y)],
    material: "wood",
  });
  return [
    rail("A0", "Top rail", f.apronY, f.apronH, -1),
    rail("A1", "Top rail", f.apronY, f.apronH, 1),
    rail("R0", "Foot rail", f.railFootY, 30, -1),
    rail("R1", "Foot rail", f.railFootY, 30, 1),
  ];
}

/** The fittings at one end frame's joints with the long rails. */
function joints(f: Frame, g: number, L: number) {
  const on = g < 0 ? "FL" : "FR";
  const ax = g * (f.legX(f.apronY) - L / 2), rx = g * (f.legX(f.railFootY) - L / 2);
  const za = f.legZ(f.apronY), zr = f.legZ(f.railFootY);
  const dowels: CustomFix = {
    kind: "dowel",
    count: 4,
    len: 30,
    dia: 8,
    on,
    at: [-1, 1].flatMap((z) => [pt(ax, f.apronY - 12, z * za), pt(rx, f.railFootY, z * zr)]),
    dir: [-g, 0, 0],
  };
  // in from the outside of the frame's top rail, sticking out inside until the long rail goes on
  const bolts: CustomFix = { kind: "bolt", name: "Long bolt", count: 2, len: 80, dia: 8, on, at: [-1, 1].map((z) => pt(g * (f.legX(f.apronY) + 10), f.apronY + 10, z * za)), dir: [-g, 0, 0] };
  const clamps: CustomFix[] = [-1, 1].map((z, i): CustomFix => ({
    kind: "nut",
    name: "Bolt clamp",
    count: 1,
    len: 14,
    dia: 22,
    on: `A${i}`,
    at: [pt(ax - g * 45, f.apronY + 10, z * (za - 10))],
    dir: [0, 0, z],
  }));
  const angled: CustomFix[] = [-1, 1].map((z, i): CustomFix => ({
    kind: "screw",
    name: "Short screw",
    count: 1,
    len: 40,
    dia: 4,
    on: `R${i}`,
    mate: on,
    at: [pt(rx - g * 40, f.railFootY - 8, z * (zr - 10))],
    dir: [g, 0, 0],
  }));
  return { dowels, bolts, clamps, angled };
}

/* ---------------------------------------------------------------- bar stool */

function stool(s: ProductSpec): CustomParams {
  const H = 620, R = Math.round((s.size.w || 33) * 10) || 330, ST = 25, L = 32;
  const yTop = H - ST;
  const off = (y: number) => 100 + (85 * (yTop - y)) / yTop;
  const f: Frame = { legX: off, legZ: off, yTop, apronY: yTop - 25, footY: 230, railFootY: 250, apronH: 50 };
  const parts: CustomPart[] = [
    endFrame(f, -1, L),
    ...longRails(f, L),
    endFrame(f, 1, L),
    { id: "S", name: "Seat", size: [R, ST, R], pos: [0, H - ST / 2, 0], shape: "cyl", material: "wood" },
  ];
  const jl = joints(f, -1, L), jr = joints(f, 1, L);
  const seatY = f.apronY - f.apronH / 2;
  const za = f.legZ(f.apronY);
  const steps: CustomStep[] = [
    { title: "Tap the dowels into one end frame", detail: "Lay it flat on a rug and tap four dowels into the rail holes. Do the same in the other frame.", add: ["FL"], fix: [jl.dowels], tools: ["hammer"], pose: "+x", repeat: 2, warnings: ["floor"] },
    { title: "Screw the long bolts into the frame", detail: "Two in each frame, by hand, until about 5 cm still sticks out.", fix: [jl.bolts], repeat: 2, kind: "bolts" },
    { title: "Stand the top rails in one frame", detail: "With that frame flat on the rug, push the two rails with slots onto the bolts and dowels.", add: ["A0", "A1"], from: { A0: [-300, 0, 0], A1: [-300, 0, 0] } },
    { title: "Stand the foot rails in", detail: "The two longer rails go onto the dowels lower down, their screw holes facing in.", add: ["R0", "R1"], from: { R0: [-300, 0, 0], R1: [-300, 0, 0] } },
    { title: "Tighten the clamps on this side", detail: "Slide a clamp into each rail's slot over the bolt and turn the bolt with the Allen key until it pulls tight.", fix: jl.clamps, tools: ["allen"] },
    { title: "Lay the other frame on top", detail: "Lower it so the bolts and dowels go into the rails' free ends. Mind your fingers.", add: ["FR"], fix: [jr.dowels, jr.bolts], warnings: ["hand"] },
    { title: "Turn it over and tighten the other clamps", detail: "Two more clamps in the slots, tightened with the Allen key.", fix: jr.clamps, tools: ["allen"], pose: "-x" },
    { title: "Screw the foot rails at an angle", detail: "Stand it upside down. One short screw through the end of each foot rail into the leg.", fix: [...jl.angled, ...jr.angled], tools: ["screwdriver"], pose: "-y" },
    {
      title: "Push the long screws into the top rails",
      detail: "Four long screws down through the holes in the top rails, ready for the seat.",
      fix: [-1, 1].map((z, i): CustomFix => ({ kind: "screw", name: "Long screw", count: 2, len: 70, dia: 5, on: `A${i}`, at: [-1, 1].map((x) => pt(x * 60, seatY, z * za)), dir: [0, 1, 0] })),
    },
    { title: "Lower the frame onto the seat", detail: "Lay the seat upside down on a table with a cloth on it and set the frame on it, screws in the seat's holes.", add: ["S"], from: { S: [0, 300, 0] }, warnings: ["floor"] },
    { title: "Screw the seat on", detail: "Drive the four long screws into the seat, then turn the stool over.", tools: ["screwdriver"], kind: "screws" },
    { title: "Stand the stool up", detail: "Check every screw and bolt is tight.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- bench */

function bench(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 930, D = Math.round(s.size.d * 10) || 330, H = Math.round(s.size.h * 10) || 450;
  const ST = 25, L = 32;
  const yTop = H - ST;
  const f: Frame = { legX: (y) => W / 2 - 70 + (45 * (yTop - y)) / yTop, legZ: () => D / 2 - 50, yTop, apronY: yTop - 25, footY: 140, railFootY: 140, apronH: 50 };
  const seat: PartPiece[] = [
    { shape: "box", size: [W - D, ST, D], pos: [0, 0, 0] },
    ...[-1, 1].map((g): PartPiece => ({ shape: "halfcyl", size: [D, ST, D / 2], pos: [g * (W / 2 - D / 4), 0, 0], rot: [0, (g * Math.PI) / 2, 0] })),
  ];
  const parts: CustomPart[] = [
    endFrame(f, -1, L),
    ...longRails(f, L),
    endFrame(f, 1, L),
    { id: "S", name: "Seat", size: [W, ST, D], pos: [0, H - ST / 2, 0], material: "wood", pieces: seat },
  ];
  // the bench's foot rails sit level with the end frames' foot rails, so they go in just above
  parts.filter((p) => p.id === "R0" || p.id === "R1").forEach((p) => (p.pos = [p.pos[0], f.railFootY + 32, p.pos[2]]));
  const fr: Frame = { ...f, railFootY: f.railFootY + 32 };
  const jl = joints(fr, -1, L), jr = joints(fr, 1, L);
  const za = f.legZ(0);
  const seatY = f.apronY - f.apronH / 2;
  const ix = f.legX(f.apronY) - L / 2;
  const steps: CustomStep[] = [
    { title: "Tap the dowels into one end frame", detail: "Lay it flat on a rug and tap four dowels into the rail holes. Do the same in the other frame.", add: ["FL"], fix: [jl.dowels], tools: ["hammer"], pose: "+x", repeat: 2, warnings: ["floor"] },
    { title: "Screw the long bolts into the frame", detail: "Two in each frame, by hand, until about 5 cm still sticks out.", fix: [jl.bolts], repeat: 2, kind: "bolts" },
    { title: "Stand the top rails in one frame", detail: "Push the two rails with slots onto the bolts and dowels.", add: ["A0", "A1"], from: { A0: [-400, 0, 0], A1: [-400, 0, 0] } },
    { title: "Stand the foot rails in", detail: "The two plain rails go onto the lower dowels.", add: ["R0", "R1"], from: { R0: [-400, 0, 0], R1: [-400, 0, 0] } },
    { title: "Screw the foot rails at an angle", detail: "One short screw through the end of each foot rail into the leg.", fix: jl.angled, tools: ["screwdriver"] },
    { title: "Lay the other frame on top", detail: "Lower it so the bolts and dowels go into the rails' free ends. Mind your fingers.", add: ["FR"], fix: [jr.dowels, jr.bolts], warnings: ["hand"] },
    { title: "Turn it over and screw the other foot rails", detail: "Two more short screws at an angle.", fix: jr.angled, tools: ["screwdriver"], pose: "-x" },
    { title: "Check all four short screws", detail: "Each one sits flush in its hole and the rails are tight against the legs.", tools: ["screwdriver"], kind: "screws" },
    {
      title: "Tap four dowels into the seat",
      detail: "Lay the seat upside down on a table with a cloth on it.",
      add: ["S"],
      fix: [{ kind: "dowel", count: 4, len: 30, dia: 8, on: "S", at: [-1, 1].flatMap((x) => [-1, 1].map((z) => pt(x * (ix - 120), H - ST, z * za))), dir: [0, 1, 0] }],
      tools: ["hammer"],
      pose: "-y",
      from: { S: [0, 300, 0] },
    },
    { title: "Lower the frame onto the seat", detail: "Upside down, so the dowels go into the holes in the top rails.", kind: "join" },
    { title: "Tighten the clamps", detail: "Slide a clamp into each slot in the top rails, over the bolt, and turn the bolt with the Allen key until it pulls tight.", fix: [...jl.clamps, ...jr.clamps], tools: ["allen"] },
    {
      title: "Screw the seat on",
      detail: "Five long screws up through each top rail into the seat.",
      fix: [-1, 1].map((z, i): CustomFix => ({ kind: "screw", name: "Long screw", count: 5, len: 70, dia: 5, on: `A${i}`, at: spread(-ix + 80, ix - 80, 5).map((x) => pt(x, seatY, z * za)), dir: [0, 1, 0] })),
      tools: ["screwdriver"],
    },
    { title: "Turn the bench over", detail: "Stand it on its legs and check every screw is tight.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- table */

function table(s: ProductSpec): CustomParams {
  const R = Math.round(s.size.w * 10) || 750, H = Math.round(s.size.h * 10) || 920;
  const TT = 25, AH = 80, LD = 40;
  const c = 230; // leg tops, out from the middle on each axis
  const foot = 290;
  const yTop = H - TT;
  const apron: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [2 * c - 60, AH, 20], pos: [0, -TT / 2 - AH / 2, g * (c - 20)] })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [20, AH, 2 * c - 60], pos: [g * (c - 20), -TT / 2 - AH / 2, 0] })),
  ];
  const topPieces: PartPiece[] = [{ shape: "cyl", size: [R, TT, R], pos: [0, AH / 2, 0] }, ...apron.map((p): PartPiece => ({ ...p, pos: [p.pos[0], p.pos[1] + AH / 2, p.pos[2]] }))];
  const corners = [-1, 1].flatMap((x) => [-1, 1].map((z) => [x, z] as const));
  const legs = corners.map(([x, z], i): CustomPart => {
    const l = legBetween(pt(x * c, yTop - 10, z * c), pt(x * foot, 0, z * foot));
    return { id: `L${i}`, name: "Leg", size: [LD, l.len, LD], pos: l.mid, rot: l.rot, shape: "cyl", material: "wood" };
  });
  const parts: CustomPart[] = [{ id: "T", name: "Table top with frame", size: [R, TT + AH, R], pos: [0, H - (TT + AH) / 2, 0], material: "wood", pieces: topPieces }, ...legs];
  const ry = (k: number) => yTop - 25 - k * 30;
  const inward = (x: number, z: number, d: number): Vec3 => [(-x * d) / Math.SQRT2, 0, (-z * d) / Math.SQRT2];
  const along = (x: number, z: number, y: number, d: number): Vec3 => {
    const v = inward(x, z, d);
    return pt(x * c + v[0], y, z * c + v[2]);
  };
  const perLeg = (kind: CustomFix["kind"], d: number, o: Partial<CustomFix>, sign: number): CustomFix[] =>
    corners.map(([x, z], i): CustomFix => ({
      kind,
      count: 2,
      ...o,
      on: o.on ?? `L${i}`,
      at: [0, 1].map((k) => along(x, z, ry(k), d)),
      dir: inward(x, z, sign),
    }));
  const steps: CustomStep[] = [
    { title: "Lay the top upside down and lift out the legs", detail: "Leave the top in the bottom of its box, or on a rug, with the rail frame facing up.", add: ["T"], pose: "-y", warnings: ["floor"] },
    {
      title: "Fit a cross dowel and two rods to each leg",
      detail: "Push the cross dowel into the hole near the top of the leg, slot lined up, then screw both threaded rods into it by hand.",
      add: legs.map((l) => l.id),
      fix: [
        // across the leg, square to the rods
        ...corners.map(([x, z], i): CustomFix => {
          const a = along(x, z, yTop - 40, 0), q: Vec3 = [z / Math.SQRT2, 0, -x / Math.SQRT2];
          return { kind: "nut", name: "Cross dowel", count: 1, len: 40, dia: 10, on: `L${i}`, at: [pt(a[0] - q[0] * 20, a[1], a[2] - q[2] * 20)], dir: q };
        }),
        ...perLeg("stud", 40, { name: "Threaded rod", len: 80, dia: 8 }, 1),
      ],
      tools: ["flathead"],
    },
    {
      title: "Bolt each leg into its corner bracket",
      detail: "Push the rods through the bracket, then a washer and a nut on each. Tighten them with the box spanner.",
      fix: [...perLeg("washer", 70, { len: 2, dia: 16, on: "T" }, -1), ...perLeg("nut", 74, { len: 8, dia: 13, on: "T" }, -1)],
      tools: ["wrench"],
    },
    { title: "Turn the table over", detail: "Lift it together by the top, not the legs, and stand it up.", pose: "+y", people: 2, kind: "standup" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RÄVSTEN", "RAVSTEN"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^ravsten-bar-stool/.test(slug)) return stool(s);
    if (/^ravsten-bench/.test(slug)) return bench(s);
    if (/^ravsten-table/.test(slug)) return table(s);
    return null;
  },
};
export default family;
