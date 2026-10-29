import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * UGGLERUM, read from its two manuals. The coffee table's base is built on the upside-down top as a work
 * surface: two leg frames (two legs and a cross bar in one piece) take connector bolts, the two long rails have
 * a dowel in each end and are pulled onto the bolts with cross dowels and locking screws, then the base gets its
 * glides, is lowered onto the top on two dowels and screwed down with ten long bolts. The side table is a single
 * curved column: a steel plate on its top end, screwed to the upside-down top, then the base on two dowels and
 * two long bolts, with six glides under it.
 */

function coffee(s: ProductSpec): CustomParams {
  // IKEA: 130 x 65, 43 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 20, yT = H - tt;
  const xl = W / 2 - 160, zl = D / 2 - 30; // legs, set in from the ends, at the long edges
  const bw = 45, bh = 40; // cross bar
  const yB = yT - bh;
  const leg = 42;
  const frameOf = (id: string, sx: number): CustomPart => {
    const cy = yT / 2;
    const pieces: PartPiece[] = [
      { shape: "box", size: [bw, bh, D - 20], pos: [0, yB + bh / 2 - cy, 0], material: "wood" },
      { shape: "cyl", size: [leg, yB, leg], pos: [0, yB / 2 - cy, -zl], material: "wood" },
      { shape: "cyl", size: [leg, yB, leg], pos: [0, yB / 2 - cy, zl], material: "wood" },
    ];
    return { id, name: "Leg frame", size: [bw, yT, D - 20], pos: [sx * xl, cy, 0], pieces, material: "wood" };
  };
  const rh = 60, rt = 20, zr = D / 2 - 130;
  const xi = xl - bw / 2; // inner face of a cross bar
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [W, tt, D], pos: [0, yT + tt / 2, 0], material: "wood" },
    frameOf("L", -1),
    frameOf("R", 1),
    { id: "RA", name: "Long rail", size: [2 * xi, rh, rt], pos: [0, yT - rh / 2, -zr], material: "wood" },
    { id: "RB", name: "Long rail", size: [2 * xi, rh, rt], pos: [0, yT - rh / 2, zr], material: "wood" },
  ];
  // the rail ends meet the cross bars where both overlap: the bolt low, the dowel high
  const yJ = Math.max(yB, yT - rh) / 2 + yT / 2, yBolt = yJ - 12, yDow = yJ + 12;
  const railAt = (z: number) => (z < 0 ? "RA" : "RB");
  const fx = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, ...(on ? { on } : {}), ...o });
  const bolts = (sx: number) => fx("bolt", [-zr, zr].map((z): Vec3 => [sx * xi, yBolt, z]), [sx, 0, 0], sx < 0 ? "L" : "R", { name: "Connector bolt", len: 40, dia: 6 });
  const dowels = (sx: number) => [-zr, zr].map((z) => fx("dowel", [[sx * xi, yDow, z]], [-sx, 0, 0], railAt(z), { mate: sx < 0 ? "L" : "R" }));
  // the cross dowel sits in its hole level with the bolt; the locking screw goes in after it from the rail's edge
  const lock = (sx: number): CustomFix[] => [-zr, zr].map((z) => fx("nut", [[sx * (xi - 40), yBolt, z]], [0, 1, 0], railAt(z), { name: "Cross dowel", len: 14, dia: 10 }));
  const tighten = (sx: number) => [-zr, zr].map((z) => fx("screw", [[sx * (xi - 40), yT - rh, z]], [0, 1, 0], railAt(z), { name: "Locking screw", len: 12, dia: 6 }));
  const steps: CustomStep[] = [
    { title: "Lay the top upside down on a rug", detail: "It's your work surface while you build the base on it.", add: ["T"], pose: "-y", warnings: ["floor"] },
    {
      title: "Screw the connector bolts into the leg frames",
      detail: "Two into the inside of each cross bar, by hand, until only the plain end sticks out.",
      add: ["L"],
      fix: [bolts(-1), bolts(1)],
      wait: ["R"],
      // the second frame waits in front, out of the rails' way
      from: { R: [0, 0, 600] },
    },
    { title: "Push a dowel into each end of the long rails", detail: "One dowel in each end, four in all.", fix: [...dowels(-1), ...dowels(1)], wait: ["RA", "RB"], from: { RA: [700, 0, 0], RB: [700, 0, 0] } },
    {
      title: "Push the rails onto one leg frame",
      detail: "Each rail end goes over a bolt and its dowel. Drop a cross dowel into the hole in each rail, slot facing the bolt.",
      add: ["RA", "RB"],
      fix: lock(-1),
    },
    { title: "Tighten the locking screws", detail: "Turn them in with the Allen key until the rail pulls tight against the frame.", fix: tighten(-1), tools: ["allen"] },
    { title: "Fit the other leg frame", detail: "Onto the free ends of the rails, then drop in the two cross dowels.", add: ["R"], fix: lock(1) },
    { title: "Tighten the locking screws", detail: "Pull the frame tight, the same as the first one.", fix: tighten(1), tools: ["allen"] },
    {
      title: "Tap the glides into the legs",
      detail: "One into the end of each leg.",
      fix: [fx("glide", [-1, 1].flatMap((sx) => [-zl, zl].map((z): Vec3 => [sx * xl, 0, z])), [0, 1, 0], "", { name: "Glide", len: 6, dia: 30 })],
      tools: ["hammer"],
    },
    {
      title: "Push a dowel into each cross bar",
      detail: "Into the hole in the middle of the side that meets the top.",
      fix: [fx("dowel", [-1, 1].map((sx): Vec3 => [sx * xl, yT, 0]), [0, -1, 0], "")],
    },
    { title: "Lower the base onto the top", detail: "Turn the base over and set it down so both dowels find their holes.", warnings: ["hand"] },
    {
      title: "Screw the leg frames to the top",
      detail: "Two long bolts through each cross bar, into their sunk holes.",
      fix: [fx("bolt", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, yT - 58, sz * (D / 2 - 90)])), [0, 1, 0], "", { len: 70, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Screw the rails to the top",
      detail: "Three long bolts along each rail. Tighten every bolt now.",
      fix: [fx("bolt", [-1, 1].flatMap((sz) => [-xi + 120, 0, xi - 120].map((x): Vec3 => [x, yT - 58, sz * zr])), [0, 1, 0], "", { len: 70, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Turn the table over", detail: "Lift it by the top, not the legs.", pose: "+y" },
  ];
  return { parts, steps };
}

/** The rounded top and base, drawn as a disc as wide as their average size. */
function disc(id: string, name: string, W: number, D: number, t: number, y: number): CustomPart {
  const d = (W + D) / 2;
  return { id, name, shape: "cyl", size: [d, t, d], pos: [0, y, 0], material: "wood" };
}

function side(s: ProductSpec): CustomParams {
  // IKEA: 46 x 40, 67 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 22, bt = 24, gl = 6, pt = 5;
  const yBase = gl, yCol = gl + bt, yPlate = H - tt - pt;
  const R = (W + D) / 4;
  const xc = 0, zc = -R + 60; // column, at the back
  const ch = yPlate - yCol;
  const parts: CustomPart[] = [
    { id: "C", name: "Column", size: [64, ch, 46], pos: [xc, yCol + ch / 2, zc], material: "wood" },
    { id: "P", name: "Steel plate", size: [110, pt, 90], pos: [xc, yPlate + pt / 2, zc + 10], material: "metal" },
    disc("T", "Table top", W, D, tt, H - tt / 2),
    disc("B", "Base", W, D, bt, yBase + bt / 2),
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw the steel plate onto the column",
      detail: "On the narrow end, three screws with the Allen key. No drill: turn them by hand.",
      add: ["C", "P"],
      fix: [{ kind: "screw", count: 3, len: 16, dia: 6, at: [[xc - 15, yPlate + pt, zc], [xc + 15, yPlate + pt, zc], [xc, yPlate + pt, zc + 18]], dir: [0, -1, 0], on: "P", mate: "C" }],
      tools: ["allen"],
    },
    {
      title: "Screw the column to the top",
      detail: "Top upside down on a rug. Stand the column on it plate down and turn in four screws through the plate.",
      add: ["T"],
      fix: [{ kind: "screw", count: 4, len: 16, dia: 6, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [xc + sx * 42, yPlate, zc + 10 + sz * 34])), dir: [0, 1, 0], on: "P", mate: "T" }],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Push two dowels into the column's end", detail: "Into the two holes in the wide end.", fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: [[xc - 18, yCol, zc], [xc + 18, yCol, zc]], dir: [0, 1, 0], on: "C", mate: "B" }] },
    {
      title: "Press the glides into the base",
      detail: "Six glides in the holes on its underside, then set it glides up on the dowels.",
      add: ["B"],
      fix: [
        {
          kind: "glide",
          name: "Glide",
          count: 6,
          len: gl,
          dia: 28,
          at: Array.from({ length: 6 }, (_, i): Vec3 => [Math.cos((i * Math.PI) / 3) * (R - 40), 0, Math.sin((i * Math.PI) / 3) * (R - 40)]),
          dir: [0, 1, 0],
          on: "B",
        },
      ],
    },
    {
      title: "Bolt the base onto the column",
      detail: "Two long bolts through the base into the column.",
      fix: [{ kind: "bolt", count: 2, len: 80, dia: 6, at: [[xc, yBase, zc - 12], [xc, yBase, zc + 12]], dir: [0, 1, 0], on: "B", mate: "C" }],
      tools: ["allen"],
    },
    { title: "Turn the table over", detail: "Stand it on its glides.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["UGGLERUM"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
    if (/coffee/.test(t)) return coffee(s);
    if (/side/.test(t)) return side(s);
    return null;
  },
};
export default family;
