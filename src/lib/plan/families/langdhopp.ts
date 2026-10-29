import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * LÄNGDHOPP pull-out desk, from its manual. Everything is built upside down on a rug. The sides get their glides,
 * cam bolts and runners, the back rail slides onto one side and the other side goes on, both locked with cams. Dowels
 * and cam bolts go into the sides and the top, and the frame is lowered onto the top. The pull-out desk's two legs
 * take their plates, are bolted under its board and get castors, then it slides in on the runners and is screwed to
 * them. Stood up, the lower desk pulls out in front.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function recipe(_s: ProductSpec): CustomParams {
  // IKEA: 90 wide, 39 deep (71 pulled out), 87 high; the pull-out desk is 75 high
  const W = 900, D = 390, H = 870;
  const t = 18, sx = W / 2 - t / 2, ix = W / 2 - t; // the sides, their inner faces
  const top = H - t;
  const railH = 100, ry = top - railH / 2, rz = -D / 2 + t / 2;
  const RW = 13, runY = 715, rx = ix - RW / 2; // runners on the sides' inner faces
  const pw = 2 * (ix - RW), pd = D - 20, py = 741, pz = -10; // the pull-out board, its top at 75 cm
  const L = 30, wheel = 50, lx = pw / 2 - 30, lz = pz + pd / 2 - 25, lTop = py - t / 2;
  const parts: CustomPart[] = [
    { id: "SL", name: "Side panel", size: [t, top, D], pos: [-sx, top / 2, 0], material: "board" },
    { id: "SR", name: "Side panel", size: [t, top, D], pos: [sx, top / 2, 0], material: "board" },
    { id: "RL", name: "Runner", size: [RW, 35, D - 40], pos: [-rx, runY, 0], material: "metal" },
    { id: "RR", name: "Runner", size: [RW, 35, D - 40], pos: [rx, runY, 0], material: "metal" },
    { id: "BR", name: "Back rail", size: [2 * ix, railH, t], pos: [0, ry, rz], material: "board" },
    { id: "TOP", name: "Top", size: [W, t, D], pos: [0, H - t / 2, 0], material: "board" },
    { id: "PB", name: "Pull-out board", size: [pw, t, pd], pos: [0, py, pz], material: "board" },
    { id: "LL", name: "Leg", size: [L, lTop - wheel, L], pos: [-lx, (lTop + wheel) / 2, lz], material: "metal" },
    { id: "LR", name: "Leg", size: [L, lTop - wheel, L], pos: [lx, (lTop + wheel) / 2, lz], material: "metal" },
  ];
  const side = (g: number) => (g < 0 ? "SL" : "SR");
  const railCams = (g: number): Vec3[] => [ry - 30, ry + 30].map((y): Vec3 => [g * (ix - 34), y, rz + t / 2]);
  const topZ = [-110, 110];
  const out = { from: { PB: [0, 0, 600] as Vec3, LL: [0, 0, 600] as Vec3, LR: [0, 0, 600] as Vec3 } };
  return {
    parts,
    steps: [
      {
        title: "Press the glides into the sides",
        detail: "Lay both sides on a rug, inside up. Two glides into the holes in each side's bottom edge.",
        add: ["SL", "SR"],
        fix: [-1, 1].map((g) => fx("glide", [-120, 120].map((z): Vec3 => [g * sx, 0, z]), [0, 1, 0], side(g))),
        pose: "-y",
        warnings: ["floor"],
        wait: ["SR"],
      },
      {
        title: "Screw in the cam bolts for the back rail",
        detail: "Two in each side, by hand or with a screwdriver, until they stop.",
        fix: [-1, 1].map((g) => fx("camScrew", [ry - 30, ry + 30].map((y): Vec3 => [g * ix, y, rz]), [g, 0, 0], side(g), { mate: "BR" })),
        tools: ["screwdriver"],
      },
      {
        title: "Screw the runners to the sides",
        detail: "The fixed half of each runner, two screws each. Slide the inner half along to reach the second hole.",
        add: ["RL", "RR"],
        fix: [-1, 1].map((g) => fx("screw", [-120, 120].map((z): Vec3 => [g * (ix - RW), runY, z]), [g, 0, 0], g < 0 ? "RL" : "RR", { len: 16, dia: 4, mate: side(g) })),
        tools: ["screwdriver"],
        wait: ["RR"],
      },
      { title: "Slide the back rail onto one side", detail: "Its holes go over the two cam bolts.", add: ["BR"], from: { BR: [400, 0, 0] } },
      { title: "Lock it with two cams", detail: "Turn each cam clockwise until it grips the bolt.", fix: [fx("cam", railCams(-1), [0, 0, -1], "BR")], tools: ["screwdriver"] },
      { title: "Put the other side on", detail: "Its runner faces in. Push it onto the rail's other end.", add: ["SR", "RR"], from: { SR: [400, 0, 0], RR: [400, 0, 0] } },
      { title: "Lock that end with two cams", detail: "The same way.", fix: [fx("cam", railCams(1), [0, 0, -1], "BR")], tools: ["screwdriver"] },
      {
        title: "Tap dowels into the sides",
        detail: "Two into the top edge of each side.",
        fix: [-1, 1].map((g) => fx("dowel", [-60, 60].map((z): Vec3 => [g * sx, top, z]), [0, -1, 0], side(g), { len: 30, dia: 8, mate: "TOP" })),
        tools: ["hammer"],
      },
      {
        title: "Screw the cam bolts into the top",
        detail: "Lay the top face down on the rug. Four cam bolts into the holes near its ends, by hand.",
        fix: [-1, 1].map((g) => fx("camScrew", topZ.map((z): Vec3 => [g * sx, top, z]), [0, 1, 0], "TOP", { mate: side(g) })),
        wait: ["TOP"],
      },
      {
        title: "Push the big cams into the sides",
        detail: "Four, near the top of the sides, arrows pointing to the edge.",
        fix: [-1, 1].map((g) => fx("cam", topZ.map((z): Vec3 => [g * ix, top - 34, z]), [-g, 0, 0], side(g))),
      },
      {
        title: "Lower the frame onto the top",
        detail: "Dowels and bolts into their holes, then turn the four cams with the long Allen key until they grip.",
        add: ["TOP"],
        from: { TOP: [0, 300, 0] },
        tools: ["allen"],
      },
      { title: "Press the cover caps on", detail: "Over the four cams in the back rail.", fix: [fx("cap", [...railCams(-1), ...railCams(1)].map((p): Vec3 => [p[0], p[1], p[2] + 1]), [0, 0, -1], "BR")] },
      {
        title: "Screw a plate onto each leg",
        detail: "One flat screw through each plate into the top of the leg.",
        fix: [-1, 1].flatMap((g) => [fx("plate", [[g * lx, lTop, lz]], [0, -1, 0], g < 0 ? "LL" : "LR"), fx("screw", [[g * lx, lTop + 2, lz]], [0, -1, 0], g < 0 ? "LL" : "LR", { len: 12, dia: 5 })]),
        tools: ["allen"],
        wait: ["LL", "LR", "PB"],
      },
      {
        title: "Bolt the legs under the pull-out board",
        detail: "At its front corners, two bolts through each plate.",
        fix: [-1, 1].map((g) => fx("bolt", [-1, 1].map((k): Vec3 => [g * lx + k * 22, lTop - 2, lz]), [0, 1, 0], g < 0 ? "LL" : "LR", { len: 14, dia: 6, mate: "PB" })),
        tools: ["allen"],
      },
      { title: "Click the castors into the legs", detail: "Push one into each leg end until it clicks.", fix: [-1, 1].map((g) => fx("castor", [[g * lx, wheel, lz]], [0, 1, 0], g < 0 ? "LL" : "LR", { len: wheel, dia: 40 })) },
      { title: "Slide the pull-out desk in", detail: "Board face down, its edges onto the runners' inner halves, legs at the front.", add: ["PB", "LL", "LR"], ...out },
      {
        title: "Screw the runners to the board",
        detail: "Three screws through each runner into the board's edge.",
        fix: [-1, 1].map((g) => fx("screw", [-140, 0, 100].map((z): Vec3 => [g * (ix - 2), py, z]), [-g, 0, 0], g < 0 ? "RL" : "RR", { len: 18, dia: 4, mate: "PB" })),
        tools: ["allen"],
      },
      { title: "Turn the desk over", detail: "Stand it on its glides and castors, then pull the lower desk out to check it runs smoothly.", pose: "+y", people: 2, warnings: ["two"] },
    ],
  };
}

const family: Family = { names: ["LÄNGDHOPP", "LANGDHOPP"], recipe };
export default family;
