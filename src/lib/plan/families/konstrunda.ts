import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KONSTRUNDA, three different builds, each read from its own manual.
 * The pine box stool: four sides and a seat held by cam bolts into corner rails (two rails screwed to the back,
 * one doweled to each side), closed up in turn and finished with four nail-on glides.
 * The 40 cm stool: four bundles of pine rounds joined in pairs by corner blocks (dowels, long bolts in barrel
 * nuts), the halves locked with wedge connectors, then set upside down on the scalloped seat and screwed on.
 * The metal side table: a stud screwed to the base plate, the two drums dropped over it, the pole and the top
 * screwed on by hand.
 */

// ---------- the pine box stool ----------

function boxStool(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 20, ST = 20, R = 30;
  const hs = H - ST;
  const xi = W / 2 - T, zi = D / 2 - T; // inner faces
  const rail = (id: string, sx: number, sz: number): CustomPart => ({ id, name: "Corner rail", size: [R, hs - 20, R], pos: [sx * (xi - R / 2), hs / 2, sz * (zi - R / 2)], material: "wood" });
  const parts: CustomPart[] = [
    { id: "A", name: "Side panel", size: [W, hs, T], pos: [0, hs / 2, -(D / 2 - T / 2)], material: "wood" },
    rail("K0", -1, -1),
    rail("K1", 1, -1),
    { id: "B", name: "Side panel", size: [T, hs, D - 2 * T], pos: [-(W / 2 - T / 2), hs / 2, 0], material: "wood" },
    rail("K2", -1, 1),
    { id: "C", name: "Side panel", size: [T, hs, D - 2 * T], pos: [W / 2 - T / 2, hs / 2, 0], material: "wood" },
    rail("K3", 1, 1),
    { id: "S", name: "Seat", size: [W, ST, D], pos: [0, H - ST / 2, 0], material: "wood" },
    { id: "F", name: "Side panel", size: [W, hs, T], pos: [0, hs / 2, D / 2 - T / 2], material: "wood" },
  ];
  const ys = (n: number) => Array.from({ length: n }, (_, i) => 50 + ((hs - 100) * i) / Math.max(1, n - 1));
  // cam bolts in a panel, into the rails behind it; the cams go in the rails
  const bolts = (on: string, pts: Vec3[], dir: Vec3): CustomFix => ({ kind: "camScrew", count: pts.length, at: pts, dir, on });
  const cams = (on: string, pts: Vec3[], dir: Vec3): CustomFix => ({ kind: "cam", count: pts.length, at: pts, dir, on });
  const rx = (sx: number) => sx * (xi - R / 2), rz = (sz: number) => sz * (zi - R / 2);
  const bPts = [...ys(3).map((y) => [-xi, y, rz(-1)] as Vec3), ...ys(2).map((y) => [-xi, y, rz(1)] as Vec3)];
  const cPts = [...ys(3).map((y) => [xi, y, rz(-1)] as Vec3), ...ys(2).map((y) => [xi, y, rz(1)] as Vec3)];
  const sPts = [rx(-1), rx(1)].flatMap((x) => [rz(-1), rz(1)].map((z) => [x, hs, z] as Vec3)).concat([[0, hs, rz(-1)]]);
  const fPts = [rx(-1), rx(1)].flatMap((x) => ys(2).map((y) => [x, y, zi] as Vec3)).concat([[rx(-1), hs / 2, zi]]);
  const steps: CustomStep[] = [
    {
      title: "Tap the big dowels into the corner rails",
      detail: "Into the ends and faces of three rails, as on the drawing. Keep the small dowels for later.",
      fix: [{ kind: "dowel", count: 6, len: 30, dia: 8, to: ["K0", "K1", "K2"] }],
      warnings: ["floor"],
    },
    { title: "Push the small dowels into two rails", detail: "Two in each, in the holes on the long face.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 2, len: 16, dia: 6, at: [hs * 0.45, hs * 0.55].map((y) => [rx(sx), y, -zi] as Vec3), dir: [0, 0, 1], on: sx < 0 ? "K0" : "K1" })) },
    {
      title: "Screw two rails onto a side panel",
      detail: "Along both side edges on the inside, cam holes facing outwards. Two screws each.",
      add: ["A", "K0", "K1"],
      fix: [{ kind: "screw", count: 4, len: 30, dia: 4, at: [-1, 1].flatMap((sx) => [hs * 0.3, hs * 0.7].map((y) => [rx(sx), y, -(D / 2)] as Vec3)), dir: [0, 0, 1] }],
      pose: "+z",
    },
    { title: "Screw cam bolts into the next panel", detail: "Five, by hand, until they stop.", fix: [bolts("B", bPts.map((p) => [-(W / 2 - T), p[1], p[2]] as Vec3), [-1, 0, 0])], wait: ["B"] },
    { title: "Stand the first panel on it with a rail", detail: "Lay the panel flat, then press the rails onto its bolts and push the loose rail onto the front ones.", add: ["B", "K2"], from: { B: [-240, 0, 0] }, pose: "+x" },
    { title: "Lock the cams", detail: "Five cams in the rails, arrow towards the bolt, turned clockwise.", fix: [cams("K0", bPts.map((p) => [rx(-1) + R / 2, p[1], p[2]] as Vec3), [-1, 0, 0])], tools: ["screwdriver"] },
    { title: "Screw cam bolts into the third panel", detail: "Five again.", fix: [bolts("C", cPts.map((p) => [W / 2 - T, p[1], p[2]] as Vec3), [1, 0, 0])], wait: ["C"] },
    { title: "Tap two dowels into the last rail", detail: "One in each end.", fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: [[rx(1), 10, rz(1)], [rx(1), hs - 10, rz(1)]], dir: [0, 1, 0], on: "K3" }] },
    { title: "Fit the rail to the third panel", detail: "Onto the front bolts.", add: ["C", "K3"], from: { C: [240, 0, 0] }, pose: "-x" },
    { title: "Lock its cams", detail: "Three cams, turned clockwise.", fix: [cams("K3", cPts.slice(3).map((p) => [rx(1) - R / 2, p[1], p[2]] as Vec3).concat([[rx(1) - R / 2, hs / 2, rz(1)]]), [1, 0, 0])], tools: ["screwdriver"] },
    { title: "Join the third panel to the others", detail: "Push it onto the back rail's dowels and bolts.", pose: "+y" },
    { title: "Lock the last two cams", detail: "In the back rail, turned clockwise.", fix: [cams("K1", cPts.slice(0, 2).map((p) => [rx(1) - R / 2, p[1], p[2]] as Vec3), [1, 0, 0])], tools: ["screwdriver"] },
    { title: "Tap dowels into the top of the rails", detail: "One in each rail end at the top.", fix: [-1, 1].flatMap((sx) => [-1, 1].map((sz): CustomFix => ({ kind: "dowel", count: 1, len: 30, dia: 8, at: [[rx(sx), hs - 10, rz(sz)]], dir: [0, -1, 0], on: `K${(sz < 0 ? 0 : 2) + (sx < 0 ? 0 : 1)}` }))) },
    {
      title: "Screw cam bolts into the seat and the last panel",
      detail: "Five in each.",
      fix: [bolts("S", sPts, [0, 1, 0]), bolts("F", fPts, [0, 0, 1])],
    },
    { title: "Press the seat on", detail: "Onto the dowels and bolts at the top.", add: ["S"] },
    { title: "Turn it on its back and tap in four dowels", detail: "Into the front edges of the side panels and rails.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 2, len: 30, dia: 8, at: [hs * 0.25, hs * 0.75].map((y) => [rx(sx), y, zi] as Vec3), dir: [0, 0, -1], on: sx < 0 ? "K2" : "K3" })), pose: "+z" },
    { title: "Press the last panel on", detail: "Onto the dowels and bolts.", add: ["F"] },
    { title: "Lock the ten cams", detail: "Turned clockwise until the panels pull tight.", fix: [cams("K0", [...sPts.map((p) => [p[0], p[1] - 20, p[2]] as Vec3), ...fPts.map((p) => [p[0], p[1], p[2] - 20] as Vec3)], [0, 0, 1])], tools: ["screwdriver"] },
    {
      title: "Turn it over and tap on the glides",
      detail: "One under each side, nails into the bottom edge, with a gentle tap.",
      fix: [{ kind: "glide", name: "Glide", count: 4, at: [[0, 0, -(D / 2 - T / 2)], [-(W / 2 - T / 2), 0, 0], [W / 2 - T / 2, 0, 0], [0, 0, D / 2 - T / 2]], dir: [0, 1, 0] }],
      tools: ["hammer"],
      pose: "-y",
    },
  ];
  return { parts, steps };
}

// ---------- the 40 cm stool of pine rounds ----------

function roundStool(s: ProductSpec) {
  const H = s.size.h * 10;
  const ST = 22, top = H - ST;
  const RAD = 135, DIA = 92; // the twelve rounds stand in a ring
  const lens = [top, 230, 180];
  const at = (k: number): [number, number] => [RAD * Math.sin((k * Math.PI) / 6), RAD * Math.cos((k * Math.PI) / 6)];
  const parts: CustomPart[] = [];
  for (let c = 0; c < 4; c++) {
    const ks = [3 * c, 3 * c + 1, 3 * c + 2];
    const pts = ks.map(at);
    const cx = pts.reduce((a, p) => a + p[0], 0) / 3, cz = pts.reduce((a, p) => a + p[1], 0) / 3;
    const pieces: PartPiece[] = ks.map((_, i) => ({ shape: "cyl", size: [DIA, lens[i], DIA], pos: [pts[i][0] - cx, top - lens[i] / 2 - top / 2, pts[i][1] - cz] }));
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) + DIA, d = Math.max(...zs) - Math.min(...zs) + DIA;
    parts.push({ id: `C${c}`, name: "Leg bundle", size: [w, top, d], pos: [cx, top / 2, cz], material: "wood", pieces });
  }
  // a block across each inside corner, between one bundle and the next
  for (let c = 0; c < 4; c++) {
    const [x, z] = at(3 * c + 2.5).map((v) => v * 0.55);
    const ang = -((3 * c + 2.5) * Math.PI) / 6;
    parts.push({ id: `B${c}`, name: "Corner block", size: [70, 60, 70], pos: [x, top - 30, z], material: "wood", pieces: [{ shape: "box", size: [110, 60, 34], pos: [0, 0, 0], rot: [0, ang, 0] }] });
  }
  const seatPieces: PartPiece[] = [{ shape: "cyl", size: [2 * RAD, ST, 2 * RAD], pos: [0, 0, 0] }, ...Array.from({ length: 12 }, (_, k) => ({ shape: "cyl" as const, size: [DIA + 14, ST, DIA + 14] as Vec3, pos: [at(k)[0], 0, at(k)[1]] as Vec3 }))];
  parts.push({ id: "S", name: "Seat", size: [2 * RAD + DIA + 14, ST, 2 * RAD + DIA + 14], pos: [0, H - ST / 2, 0], material: "wood", pieces: seatPieces });
  const blockAt = (c: number) => parts.find((p) => p.id === `B${c}`)!.pos;
  const wedge = (cs: number[]): CustomFix => ({ kind: "clamp", name: "Wedge connector", count: cs.length, at: cs.map((c) => [blockAt(c)[0], top - 45, blockAt(c)[2]] as Vec3), dir: [0, 1, 0] });
  const steps: CustomStep[] = [
    {
      title: "Join the bundles in pairs with two blocks",
      detail: "Tap the dowels into the blocks and bundles, then push each block between two bundles.",
      add: ["C0", "C1", "B0", "C2", "C3", "B2"],
      fix: [0, 2].map((c): CustomFix => {
        const a = ((3 * c + 2.5) * Math.PI) / 6, p = blockAt(c);
        const tx = Math.cos(a), tz = -Math.sin(a);
        const ends = [-1, 1].flatMap((e) => [-14, 14].map((dy) => [p[0] + e * 55 * tx, p[1] + dy, p[2] + e * 55 * tz] as Vec3));
        return { kind: "dowel", count: 5, len: 30, dia: 8, at: [...ends, [p[0] + 17 * Math.sin(a), p[1], p[2] + 17 * Math.cos(a)]], dir: [Math.sin(a), 0, Math.cos(a)], on: `B${c}` };
      }),
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Bolt the blocks to the bundles",
      detail: "Drop a barrel nut into each bundle with its slot facing the hole, then screw a long bolt down into it with the Allen key.",
      fix: [
        { kind: "connector", name: "Barrel nut", count: 4, at: [0, 1, 2, 3].map((c) => [parts[c].pos[0] * 0.8, top - 30, parts[c].pos[2] * 0.8] as Vec3), dir: [0, 0, 1] },
        { kind: "bolt", count: 4, len: 90, dia: 6, at: [0, 1, 2, 3].map((c) => [parts[c].pos[0] * 0.8, top, parts[c].pos[2] * 0.8] as Vec3), dir: [0, -1, 0] },
      ],
      tools: ["allen"],
    },
    { title: "Fit the other two blocks", detail: "One on the free end of each pair.", add: ["B1", "B3"] },
    { title: "Tighten two wedge connectors", detail: "Slide each into its slot and turn the Allen key until the block pulls tight.", fix: [wedge([1, 3])], tools: ["allen"] },
    { title: "Stand the halves up and push them together", detail: "Long legs down, the blocks onto the other half.", pose: "+y" },
    { title: "Tighten the last two wedge connectors", detail: "The same way, until the halves sit tight.", fix: [wedge([0, 2])], tools: ["allen"] },
    {
      title: "Push the seat brackets into the blocks",
      detail: "One on top of each block.",
      fix: [{ kind: "clip", name: "Seat bracket", count: 4, at: [0, 1, 2, 3].map((c) => [blockAt(c)[0], top, blockAt(c)[2]] as Vec3), dir: [0, -1, 0] }],
    },
    {
      title: "Set it upside down on the seat and screw it on",
      detail: "Seat face down on a rug, lobes lined up with the rounds. One screw through each bracket.",
      add: ["S"],
      fix: [{ kind: "screw", count: 4, len: 16, dia: 4, at: [0, 1, 2, 3].map((c) => [blockAt(c)[0] + 12, top, blockAt(c)[2]] as Vec3), dir: [0, 1, 0] }],
      tools: ["screwdriver"],
      pose: "-y",
    },
  ];
  return { parts, steps };
}

// ---------- the metal side table ----------

function sideTable(s: ProductSpec) {
  const H = s.size.h * 10, Dt = s.size.w * 10;
  const yBase = 6, yDrum = yBase + 90, yRing = yDrum + 60;
  const cyl = (id: string, name: string, dia: number, y0: number, y1: number, material: CustomPart["material"]): CustomPart => ({ id, name, size: [dia, y1 - y0, dia], pos: [0, (y0 + y1) / 2, 0], shape: "cyl", material });
  const parts: CustomPart[] = [
    cyl("P", "Base plate", 240, 0, yBase, "metal"),
    cyl("K", "Stud", 30, yBase, yRing + 20, "metal"),
    cyl("D", "Base drum", 270, yBase, yDrum, "board"),
    cyl("R", "Ring drum", 190, yDrum, yRing, "board"),
    cyl("L", "Pole", 40, yRing + 20, H - 5, "metal"),
    cyl("T", "Top", Dt, H - 5, H, "metal"),
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw the stud onto the base plate",
      detail: "The screw goes up through the plate from underneath. Tighten it with the Allen key.",
      add: ["P", "K"],
      fix: [{ kind: "screw", count: 1, len: 20, dia: 8, at: [[0, 0, 0]], dir: [0, 1, 0], on: "P", mate: "K" }],
      tools: ["allen"],
    },
    { title: "Drop the base drum over the stud", detail: "Lower it straight down until it rests on the plate.", add: ["D"] },
    { title: "Add the ring and screw on the pole", detail: "Ring over the stud first, then turn the pole onto the stud by hand until it is tight.", add: ["R", "L"] },
    { title: "Screw the top onto the pole", detail: "Turn it clockwise by hand until it sits firm.", add: ["T"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["KONSTRUNDA"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`;
    if (/side table/i.test(v)) return sideTable(s);
    if (/stool/i.test(v)) return /40/.test(v) ? roundStool(s) : boxStool(s);
    return null;
  },
};
export default family;
