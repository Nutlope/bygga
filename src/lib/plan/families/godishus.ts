import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * GODISHUS, read from its manuals.
 *
 * Chest of 3 drawers: the drawer runners are screwed into the two sides on a rug, the bottom goes between them on
 * dowels and cam locks, the back panel slides in and takes four Allen screws through the sides, glides are tapped under
 * the sides, then the top goes on with dowels and cam locks after two wall brackets are screwed under it. It is fixed
 * to the wall. Each drawer is built on its front: dowels and cam bolts, the sides, cam locks, the bottom down the
 * grooves, the back on top, screws, a knob, then it slides in and six stops are screwed in.
 *
 * Wardrobe: built lying on its back. Feet and glides go under the bottom, the bottom, sides and top are joined with
 * dowels and Allen screws, plinth clips are tapped in, wall brackets go under the top and the hardboard back is nailed
 * on. Stood up and fixed to the wall, it gets the clothes rail, the shelf and two doors on three hinges each.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
const T = 18;

function wallFix(x: number[], y: number, z: number): CustomFix[] {
  const pts = x.map((v) => [v, y, z] as Vec3);
  return [
    at("plug", pts.map((p) => [p[0], p[1], z - 40] as Vec3), [0, 0, -1], undefined, undefined, { len: 40, dia: 8, included: true }),
    at("screw", pts, [0, 0, -1], undefined, undefined, { len: 50, dia: 5, included: true }),
  ];
}

function chest(s: ProductSpec): CustomParams {
  // IKEA: 60 wide, 40 deep, 60 high; drawers 53 x 34 inside
  const W = Math.round(s.size.w * 10) || 600, D = Math.round(s.size.d * 10) || 400, H = Math.round(s.size.h * 10) || 600;
  const X = W / 2, Z = D / 2;
  const yb = 30, hs = H - T; // bottom panel, sides under the top
  const xi = X - T;
  const parts: CustomPart[] = [
    // the back is a full-width board on the sides' back edges, dowelled and screwed into them
    box("SL", "Side", [-X, 0, -Z + T], [-xi, hs, Z]),
    box("SR", "Side", [xi, 0, -Z + T], [X, hs, Z]),
    box("BT", "Bottom", [-xi, yb, -Z + T], [xi, yb + T, Z]),
    box("BK", "Back panel", [-X, 0, -Z], [X, hs, -Z + T]),
    box("TP", "Top", [-X, hs, -Z], [X, H, Z + 5]),
  ];
  const y0 = yb + T, gap = (hs - y0) / 3;
  const dx = xi - 2;
  const drawers = [0, 1, 2].map((i) => {
    const lo = y0 + i * gap + 2, hi = lo + gap - 4;
    const zb = -Z + T + 10, zf = Z - T;
    const k = `${i}`;
    parts.push(
      box(`DF${k}`, "Drawer front", [-dx, lo, zf], [dx, hi, Z]),
      box(`DS${k}a`, "Drawer side", [-dx + 6, lo + 15, zb], [-dx + 18, hi - 30, zf], "board"),
      box(`DS${k}b`, "Drawer side", [dx - 18, lo + 15, zb], [dx - 6, hi - 30, zf], "board"),
      box(`DB${k}`, "Drawer bottom", [-dx + 18, lo + 15, zb + 12], [dx - 18, lo + 19, zf], "fiber"),
      box(`DK${k}`, "Drawer back", [-dx + 18, lo + 19, zb], [dx - 18, hi - 40, zb + 12]),
    );
    return { k, lo, hi, zb, zf, ym: (lo + hi) / 2 };
  });
  const ids = (p: string) => drawers.flatMap((d) => (p === "DS" ? [`DS${d.k}a`, `DS${d.k}b`] : [`${p}${d.k}`]));

  const runnerPts = (sx: number) => drawers.map((d) => [sx * xi, d.lo + 12, 0] as Vec3);
  const sideDowel = (y: number) => [-1, 1].flatMap((sx) => [-Z + 60, Z - 60].map((z) => [sx * xi, y, z] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Screw the drawer runners into the sides",
      detail: "Lay both sides on a rug, insides up. Three runners on each, two screws each, flat edge down.",
      add: ["SL", "SR"],
      fix: [-1, 1].flatMap((sx) => [
        at("runner", runnerPts(sx), [-sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { name: "Drawer runner", len: 340, dia: 20 }),
        at("screw", runnerPts(sx).flatMap((p) => [[p[0] - sx * 3, p[1], -100], [p[0] - sx * 3, p[1], 100]] as Vec3[]), [sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { len: 14, dia: 4 }),
      ]),
      warnings: ["floor"],
      tools: ["screwdriver"],
    },
    { title: "Screw cam bolts into the sides", detail: "The chest is built upside down. Two cam bolts near the bottom end of each side, for the bottom panel.", pose: "-y", fix: [-1, 1].map((sx) => at("camScrew", [-Z + 60, Z - 60].map((z) => [sx * xi, yb + T / 2, z] as Vec3), [-sx, 0, 0], sx < 0 ? "SL" : "SR", "BT", { len: 34 })), tools: ["screwdriver"] },
    { title: "Tap dowels into the ends of the bottom", detail: "Two in each end.", fix: [at("dowel", sideDowel(yb + T / 2).map((p) => [p[0], p[1], p[2] / 2] as Vec3), [1, 0, 0], "BT", undefined, { len: 30, dia: 8 })], tools: ["hammer"] },
    { title: "Push the bottom onto one side", detail: "Its dowels and the cam bolts go into the holes.", add: ["BT"] },
    { title: "Lock it with two cam locks", detail: "Arrow towards the cam bolt, then turn clockwise.", fix: [{ kind: "cam", count: 2, to: ["BT", "SL"] }], tools: ["screwdriver"] },
    { title: "Push the other side on", detail: "Onto the other end of the bottom, dowels and cam bolts into its holes." },
    { title: "Lock it with two cam locks", detail: "The same as the first side.", fix: [{ kind: "cam", count: 2, to: ["BT", "SR"] }], tools: ["screwdriver"] },
    { title: "Tap dowels into the back edges of the sides", detail: "Two in each side, for the back panel. Turn the frame so its back faces you.", fix: [-1, 1].map((sx) => at("dowel", [yb + 120, hs - 120].map((y) => [sx * (X - T / 2), y, -Z + T] as Vec3), [0, 0, 1], sx < 0 ? "SL" : "SR", "BK", { len: 30, dia: 8 })), tools: ["hammer"] },
    {
      title: "Put the back panel on and screw it",
      detail: "Label side in. Push it onto the dowels in the sides' back edges, then four Allen screws through it into the sides.",
      add: ["BK"],
      fix: [-1, 1].map((sx) => at("screw", [yb + 70, hs - 70].map((y) => [sx * (X - T / 2), y, -Z] as Vec3), [0, 0, 1], "BK", sx < 0 ? "SL" : "SR", { len: 50, dia: 6 })),
      from: { BK: [0, 0, -300] },
      tools: ["allen"],
    },
    { title: "Tap the glides under the sides", detail: "Two under each side, at the front and the back.", fix: [at("glide", [-1, 1].flatMap((sx) => [-Z + 40, Z - 40].map((z) => [sx * (X - T / 2), 0, z] as Vec3)), [0, 1, 0], undefined, undefined, { name: "Glide", len: 6, dia: 18 })], tools: ["hammer"] },
    { title: "Stand it up and tap dowels into the sides", detail: "Two in the top edge of each side.", pose: "+y", fix: [-1, 1].map((sx) => at("dowel", sideDowel(hs).filter((p) => Math.sign(p[0]) === sx).map((p) => [p[0] + sx * 9, p[1], p[2]] as Vec3), [0, -1, 0], sx < 0 ? "SL" : "SR", "TP", { len: 30, dia: 8 })), tools: ["hammer"] },
    { title: "Screw cam bolts into the top", detail: "Lay it upside down: four cam bolts, one near each corner.", fix: [at("camScrew", [-1, 1].flatMap((sx) => [-Z + 100, Z - 100].map((z) => [sx * (X - T / 2), hs, z] as Vec3)), [0, 1, 0], "TP", undefined, { len: 34 })], tools: ["screwdriver"] },
    {
      title: "Screw the wall brackets under the top",
      detail: "Two brackets at the back, each with a screw and washer, the long arm pointing back.",
      fix: [at("angle", [-1, 1].map((sx) => [sx * (X - 120), hs, -Z + 20] as Vec3), [0, 1, 0], "TP", undefined, { name: "Wall bracket", len: 50, dia: 30 }), at("washer", [-1, 1].map((sx) => [sx * (X - 120), hs, -Z + 40] as Vec3), [0, 1, 0], "TP", undefined, { len: 1.5, dia: 12 }), at("screw", [-1, 1].map((sx) => [sx * (X - 120), hs, -Z + 40] as Vec3), [0, 1, 0], "TP", undefined, { len: 14, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Lower the top on", detail: "Dowels and cam bolts into the holes in the sides.", add: ["TP"] },
    { title: "Lock the top with four cam locks", detail: "Turn each one clockwise until the top is pulled tight.", fix: [{ kind: "cam", count: 4, to: ["TP"] }], tools: ["screwdriver"] },
    {
      title: "Fix the chest to the wall",
      detail: "Push it against the wall, mark and drill through the brackets, then a plug and a screw in each. Use screws made for your wall if the ones in the bag don't suit it.",
      fix: wallFix([-(X - 120), X - 120], hs - 10, -Z - 2),
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    // the drawers, built on their fronts; all three the same way
    {
      title: "Tap dowels into the drawer sides",
      detail: "Build each drawer on its front, face down on a rug. Two dowels in the front end of each side.",
      add: ids("DF"),
      fix: drawers.map((d) => at("dowel", [-1, 1].flatMap((sx) => [d.lo + 35, d.hi - 50].map((y) => [sx * (dx - 12), y, d.zf] as Vec3)), [0, 0, 1], undefined, `DF${d.k}`, { len: 30, dia: 6 })),
      tools: ["hammer"],
      from: Object.fromEntries(ids("DF").map((id) => [id, [0, 0, 400] as Vec3])),
    },
    { title: "Screw cam bolts into the fronts", detail: "Two in each front.", fix: drawers.map((d) => at("camScrew", [-1, 1].map((sx) => [sx * (dx - 12), d.ym + 20, d.zf] as Vec3), [0, 0, 1], `DF${d.k}`, undefined, { len: 30 })), tools: ["screwdriver"] },
    { title: "Stand the sides on the fronts", detail: "Grooves facing in and down to the bottom edge.", add: ids("DS"), from: Object.fromEntries(ids("DS").map((id) => [id, [0, 0, 400] as Vec3])) },
    { title: "Lock the sides with cam locks", detail: "One in each side, turned clockwise.", fix: drawers.map((d) => at("cam", [-1, 1].map((sx) => [sx * (dx - 12), d.ym + 20, d.zf - 30] as Vec3), [1, 0, 0], undefined, undefined, { dia: 15 })), tools: ["screwdriver"] },
    { title: "Slide the bottoms down the grooves", detail: "Smooth side in, all the way to the front.", add: ids("DB"), from: Object.fromEntries(ids("DB").map((id) => [id, [0, 0, -400] as Vec3])) },
    { title: "Lay the backs on", detail: "Between the sides, over the edge of the bottom.", add: ids("DK"), from: Object.fromEntries(ids("DK").map((id) => [id, [0, 0, -300] as Vec3])) },
    {
      title: "Screw the backs to the sides",
      detail: "Two screws through each side into the back, tapped in to start, then screwed home.",
      fix: drawers.flatMap((d) => [-1, 1].map((sx) => at("screw", [d.lo + 40, d.hi - 50].map((y) => [sx * (dx - 6), y, d.zb + 6] as Vec3), [-sx, 0, 0], `DS${d.k}${sx < 0 ? "a" : "b"}`, `DK${d.k}`, { len: 30, dia: 4 }))),
      tools: ["hammer", "screwdriver"],
    },
    { title: "Screw the bottoms to the backs", detail: "Two small screws up through each bottom into its back.", fix: drawers.map((d) => at("screw", [-1, 1].map((sx) => [sx * 150, d.lo + 15, d.zb + 6] as Vec3), [0, 1, 0], `DB${d.k}`, `DK${d.k}`, { len: 12, dia: 3.5 })), tools: ["screwdriver"] },
    {
      title: "Screw a knob onto each drawer",
      detail: "One screw from inside the front. Stick on the labels from the sheet if you like.",
      fix: [at("knob", drawers.map((d) => [0, d.ym, Z] as Vec3), [0, 0, -1], undefined, undefined, { len: 30, dia: 50 }), at("screw", drawers.map((d) => [0, d.ym, d.zf - 5] as Vec3), [0, 0, 1], undefined, undefined, { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Slide the drawers in", detail: "Lift each drawer onto its runners and push it all the way in.", kind: "drawer" },
    {
      title: "Screw in the drawer stops",
      detail: "Pull each drawer out a little. Two stops inside the back of each opening, with the round end up, so the drawers can't come out by mistake.",
      fix: [at("clip", drawers.flatMap((d) => [-1, 1].map((sx) => [sx * (xi - 20), d.hi - 10, -Z + T + 4] as Vec3)), [0, 0, -1], undefined, undefined, { name: "Drawer stop", len: 20, dia: 20 })],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

function wardrobe(s: ProductSpec): CustomParams {
  // IKEA: 60 wide, 54 deep, 178 high
  const W = Math.round(s.size.w * 10) || 600, D = Math.round(s.size.d * 10) || 540, H = Math.round(s.size.h * 10) || 1780;
  const X = W / 2, Z = D / 2;
  const xi = X - T;
  const yb = 60;
  const zk = -Z + 3; // hardboard back on the back edges
  const parts: CustomPart[] = [
    box("BT", "Bottom", [-xi, yb, zk], [xi, yb + T, Z - 18]),
    box("SL", "Side", [-X, 0, zk], [-xi, H, Z]),
    box("SR", "Side", [xi, 0, zk], [X, H, Z]),
    box("TP", "Top", [-xi, H - T, zk], [xi, H, Z]),
    box("PL", "Plinth", [-xi, 0, Z - 40], [xi, yb, Z - 22]),
    box("BK", "Back panel", [-X, 0, -Z], [X, H, zk], "fiber"),
    box("SH", "Shelf", [-xi + 2, 400, zk + 10], [xi - 2, 400 + T, Z - 30]),
    { id: "CR", name: "Clothes rail", size: [25, 2 * xi - 4, 25], pos: [0, H - 160, 0], shape: "cyl", material: "metal", rot: [0, 0, Math.PI / 2] },
  ];
  const doorW = X - 2, doorH = H - yb - 4;
  [-1, 1].forEach((sx, i) => parts.push(box(`DR${i}`, "Door", [sx < 0 ? -X : 2, yb, Z], [sx < 0 ? -2 : X, yb + doorH, Z + T])));
  const hingeY = [yb + 120, yb + doorH / 2, yb + doorH - 120];

  const steps: CustomStep[] = [
    {
      title: "Screw the feet under the bottom",
      detail: "Lay the bottom upside down on a rug. One foot at each front corner, three screws each.",
      add: ["BT"],
      fix: [at("foot", [-1, 1].map((sx) => [sx * (xi - 70), yb, Z - 90] as Vec3), [0, 1, 0], "BT", undefined, { len: yb, dia: 60 }), at("screw", [-1, 1].flatMap((sx) => [-25, 0, 25].map((dx) => [sx * (xi - 70) + dx, yb, Z - 120] as Vec3)), [0, 1, 0], "BT", undefined, { len: 14, dia: 4 })],
      pose: "-y",
      warnings: ["floor"],
      tools: ["screwdriver"],
    },
    { title: "Tap dowels into the bottom", detail: "Two in each end. The top gets four more when it goes on.", fix: [-1, 1].map((sx) => at("dowel", [zk + 60, Z - 60].map((z) => [sx * xi, yb + T / 2, z] as Vec3), [-sx, 0, 0], "BT", sx < 0 ? "SL" : "SR", { len: 30, dia: 8 })), tools: ["hammer"] },
    { title: "Screw the glides under the bottom", detail: "Four glides at the back corners and middle, a screw in each.", fix: [at("glide", [-1, 1].flatMap((sx) => [zk + 40, 0].map((z) => [sx * (xi - 40), yb, z] as Vec3)), [0, 1, 0], "BT", undefined, { name: "Glide", len: 8, dia: 20 })], tools: ["screwdriver"] },
    { title: "Stand a side on its long edge", detail: "Front edge up. The bottom will go on its lower end.", add: ["SL"], pose: "+z" },
    {
      title: "Screw the bottom to the side",
      detail: "Dowels into the holes, then two Allen screws through the side into the bottom.",
      fix: [at("screw", [zk + 30, Z - 30].map((z) => [-X, yb + T / 2, z] as Vec3), [1, 0, 0], "SL", "BT", { len: 50, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Fit the top to the same side",
      detail: "Tap two dowels into each end of the top, then push it onto the upper end of the side.",
      add: ["TP"],
      fix: [-1, 1].map((sx) => at("dowel", [zk + 60, Z - 60].map((z) => [sx * xi, H - T / 2, z] as Vec3), [-sx, 0, 0], "TP", sx < 0 ? "SL" : "SR", { len: 30, dia: 8 })),
      tools: ["hammer"],
    },
    { title: "Screw the top to the side", detail: "Two more Allen screws through the side.", fix: [at("screw", [zk + 30, Z - 30].map((z) => [-X, H - T / 2, z] as Vec3), [1, 0, 0], "SL", "TP", { len: 50, dia: 6 })], tools: ["allen"] },
    { title: "Lay the other side on", detail: "Turn the frame so it lies on its back, and push the second side onto the dowels.", add: ["SR"] },
    { title: "Screw the second side on", detail: "Four Allen screws, two into the top and two into the bottom.", fix: [at("screw", [yb + T / 2, H - T / 2].flatMap((y) => [zk + 30, Z - 30].map((z) => [X, y, z] as Vec3)), [-1, 0, 0], "SR", undefined, { len: 50, dia: 6 })], tools: ["allen"] },
    {
      title: "Tap in the plinth clips and click the plinth on",
      detail: "Four clips into the holes at the front of the sides, low down, then press the plinth onto them.",
      add: ["PL"],
      fix: [at("clip", [-1, 1].flatMap((sx) => [15, yb - 15].map((y) => [sx * xi, y, Z - 31] as Vec3)), [-1, 0, 0], undefined, undefined, { name: "Plinth clip", len: 20, dia: 15 })],
      tools: ["hammer"],
    },
    {
      title: "Screw the wall brackets to the top",
      detail: "Two brackets at the back of the top, a screw and a washer in each.",
      fix: [at("angle", [-1, 1].map((sx) => [sx * (xi - 80), H, zk + 20] as Vec3), [0, -1, 0], "TP", undefined, { name: "Wall bracket", len: 50, dia: 30 }), at("washer", [-1, 1].map((sx) => [sx * (xi - 80), H, zk + 40] as Vec3), [0, -1, 0], "TP", undefined, { len: 1.5, dia: 12 }), at("screw", [-1, 1].map((sx) => [sx * (xi - 80), H, zk + 40] as Vec3), [0, -1, 0], "TP", undefined, { len: 14, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Lay the back panel on", detail: "Turn the frame over so it lies on its front. Lay the back on, smooth side down, edges flush all round.", add: ["BK"], pose: "-z", check: "square" },
    {
      title: "Nail the back on",
      detail: "Four nails at the corners first, then two in the middle, then the rest all round, about 10 cm apart: 36 in all.",
      fix: [
        at("nail", [-1, 1].flatMap((sx) => [20, H - 20].map((y) => [sx * (X - 9), y, -Z] as Vec3)), [0, 0, 1], "BK", undefined, { len: 17, dia: 2 }),
        at("nail", [-1, 1].map((sx) => [sx * (X - 9), H / 2, -Z] as Vec3), [0, 0, 1], "BK", undefined, { len: 17, dia: 2 }),
        at("nail", [
          ...[-1, 1].flatMap((sx) => Array.from({ length: 13 }, (_, i) => [sx * (X - 9), Math.round(130 + i * 120), -Z] as Vec3).filter((p) => Math.abs(p[1] - H / 2) > 40)),
          ...[yb + T / 2, H - T / 2].flatMap((y) => [-200, -100, 0, 100, 200].map((x) => [x, y, -Z] as Vec3)),
        ].slice(0, 30), [0, 0, 1], "BK", undefined, { len: 17, dia: 2 }),
      ],
      tools: ["hammer"],
    },
    { title: "Stand the wardrobe up", detail: "Lift it together, by the sides, not the back.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Fix the wardrobe to the wall",
      detail: "Mark through the brackets, drill, then a plug and a screw in each. Use screws made for your wall if the ones in the bag don't suit it.",
      fix: wallFix([-(xi - 80), xi - 80], H - 10, -Z - 2),
      tools: ["drill", "screwdriver", "pencil", "level"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Hang the clothes rail",
      detail: "Screw a rail holder into each side near the top, then drop the rail into them.",
      add: ["CR"],
      fix: [-1, 1].map((sx) => at("clip", [[sx * xi, H - 160, 0]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", "CR", { name: "Rail holder", len: 30, dia: 30 })),
      tools: ["screwdriver"],
    },
    {
      title: "Lay the shelf on its supports",
      detail: "Four supports at the height you want, then the shelf, and two clips screwed under it at the back so it can't tip.",
      add: ["SH"],
      fix: [at("pin", [-1, 1].flatMap((sx) => [zk + 60, Z - 70].map((z) => [sx * xi, 400, z] as Vec3)), [-1, 0, 0], undefined, undefined, { name: "Shelf support", len: 16, dia: 5 }), at("clip", [-1, 1].map((sx) => [sx * 150, 400, zk + 20] as Vec3), [0, 1, 0], "SH", undefined, { name: "Shelf clip", len: 20, dia: 15 })],
      from: { SH: [0, 0, 400] },
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hinges onto the doors",
      detail: "Lay the doors face down. Three hinges in the cups of each door, two screws each.",
      fix: [0, 1].map((i) => at("hinge", hingeY.map((y) => [i === 0 ? -X + 22 : X - 22, y, Z] as Vec3), [0, 0, -1], `DR${i}`, undefined, { len: 35, dia: 35 })),
      tools: ["screwdriver"],
    },
    {
      title: "Hang the doors",
      detail: "Screw the mounting plates into the sides, then click each hinge onto its plate, from the top hinge down.",
      add: ["DR0", "DR1"],
      fix: [-1, 1].map((sx) => at("plate", hingeY.map((y) => [sx * xi, y, Z - 40] as Vec3), [-sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { name: "Mounting plate", len: 8, dia: 40 })),
      from: { DR0: [0, 0, 300], DR1: [0, 0, 300] },
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the knobs",
      detail: "One on each door, the screw from inside. Stick on the labels if you like. Adjust the hinges until the gaps are even.",
      fix: [at("knob", [-1, 1].map((sx) => [sx * 40, yb + doorH / 2 + 60, Z + T] as Vec3), [0, 0, -1], undefined, undefined, { len: 30, dia: 40 })],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["GODISHUS"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/chest-3-drawers/.test(slug)) return chest(s);
    if (/godishus-wardrobe/.test(slug)) return wardrobe(s);
    return null;
  },
};
export default family;
