import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GLAMBERGET, read from its manuals.
 *
 * Room divider: each end foot is two pine bars that pivot on one bolt: glides are pressed into the bars, then the
 * bottom arm, the upper bar, a washer and the lower bar are stacked on a long threaded rod and held by a connector
 * bolt from below. The frame is then put together lying on the floor, one pole at a time: each pole screws onto the
 * threaded rod at its foot (or at a cap with a glide, for the middle poles), and at every joint a threaded rod passes
 * through the eye of one arm and the boss of the next, so the frame folds at the poles. Stood up, the three fabric
 * panels are hooked on.
 *
 * Wardrobe with 3 sliding doors: two pine slab feet are joined by a rail and the bottom is screwed onto them. The two
 * sides and the divider stand in the bottom on dowels and cam locks, a back panel closes one compartment (cam bolts
 * in the divider, screws through the side), and the top is lowered on by two people and cam-locked. Door tracks press
 * into the top and the bottom, two at the front and one at the back. Each door gets top guides, bottom rollers and a
 * pine edge strip, the back door is hung first, then the two front doors. The clothes rail and two shelves go in last.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

const GLIDE = { name: "Glide", len: 8, dia: 22 };
const ROD_L = { name: "Long threaded rod", len: 80, dia: 8 };
const ROD_S = { name: "Short threaded rod", len: 40, dia: 8 };

function divider(s: ProductSpec): CustomParams {
  // IKEA: 150 wide, 150 high; four poles, three fabric panels
  const W = Math.round(s.size.w * 10) || 1500, H = Math.round(s.size.h * 10) || 1500;
  const P = 30; // pole
  const gap = (W - P) / 3;
  const xs = [0, 1, 2, 3].map((i) => Math.round(-W / 2 + P / 2 + i * gap));
  const barW = 40, barH = 25, barL = 300;
  const yLowBar = 8, yUpBar = yLowBar + barH + 3;
  const yArmLo = yUpBar + barH + 10, yArmHi = H - 60;
  const yEndPole = yArmLo + 10, yCap = 50;
  const A = 12; // arm

  const parts: CustomPart[] = [];
  const feet = [0, 3].map((k) => xs[k]);
  feet.forEach((x, i) => {
    parts.push({
      id: `FU${i}`,
      name: "Upper foot bar",
      size: [barW, yUpBar + barH, barL],
      pos: [x, (yUpBar + barH) / 2, barL / 2 - 30],
      pieces: [
        { shape: "box", size: [barW, barH, barL], pos: [0, (yUpBar + barH) / 2 - barH / 2, 0] },
        { shape: "box", size: [barW, yUpBar - 8, 40], pos: [0, -(yUpBar + barH) / 2 + 8 + (yUpBar - 8) / 2, barL / 2 - 20] },
      ],
      material: "wood",
    });
    parts.push({ id: `FL${i}`, name: "Lower foot bar", size: [barW, barH, barL], pos: [x, yLowBar + barH / 2, -barL / 2 + 30], material: "wood" });
  });
  const pole = (id: string, name: string, x: number, y0: number) =>
    parts.push({ id, name, size: [P, H - y0, P], pos: [x, (H + y0) / 2, 0], shape: "cyl", material: "wood" });
  pole("E0", "End pole", xs[0], yEndPole);
  pole("M1", "Middle pole", xs[1], yCap + 20);
  pole("M2", "Middle pole", xs[2], yCap + 20);
  pole("E3", "End pole", xs[3], yEndPole);
  [1, 2].forEach((k) => parts.push({ id: `C${k}`, name: "Foot cap", size: [P + 4, yCap + 12, P + 4], pos: [xs[k], 8 + (yCap + 12) / 2, 0], shape: "cyl", material: "metal" }));
  // arms between neighbouring poles, top and bottom, each with a boss on one pole and an eye on the next
  const arm = (id: string, g: number, y: number): CustomPart => {
    const pieces: PartPiece[] = [
      { shape: "cyl", size: [A, gap - P, A], pos: [0, 0, 0], rot: [0, 0, Math.PI / 2] },
      { shape: "cyl", size: [P + 6, 18, P + 6], pos: [-gap / 2, 0, 0] },
      { shape: "cyl", size: [P - 4, 12, P - 4], pos: [gap / 2, 0, 0] },
    ];
    return { id, name: y < H / 2 ? "Bottom arm" : "Top arm", size: [gap + P + 6, 18, P + 6], pos: [(xs[g] + xs[g + 1]) / 2, y, 0], pieces, material: "metal" };
  };
  parts.push(arm("AB0", 0, yArmLo), arm("AT0", 0, yArmHi), arm("AB1", 1, yArmLo), arm("AT1", 1, yArmHi));
  // the last gap's arms come on the second end pole, bosses on it and eyes on the middle pole
  const last = (id: string, y: number): CustomPart => {
    const a = arm(id, 2, y);
    a.pieces = a.pieces!.map((p, i) => (i === 0 ? p : { ...p, pos: [-p.pos[0], p.pos[1], p.pos[2]] as Vec3 }));
    return a;
  };
  parts.push(last("AB2", yArmLo), last("AT2", yArmHi));
  const fy0 = yArmLo + 30, fy1 = yArmHi - 10;
  [0, 1, 2].forEach((g) =>
    parts.push({ id: `F${g}`, name: "Fabric panel", size: [Math.round(gap - P - 6), fy1 - fy0, 3], pos: [(xs[g] + xs[g + 1]) / 2, (fy0 + fy1) / 2, 0], material: "soft" }),
  );

  const footRod = (i: number) => {
    const x = feet[i];
    return [
      at("washer", [[x, yUpBar, 0]], [0, -1, 0], `FU${i}`, `FL${i}`, { len: 3, dia: 30 }),
      at("stud", [[x, yArmLo + 30, 0]], [0, -1, 0], i === 0 ? "AB0" : "AB2", `FU${i}`, ROD_L),
      at("bolt", [[x, yLowBar, 0]], [0, 1, 0], `FL${i}`, `FU${i}`, { name: "Connector bolt", len: 20, dia: 8 }),
    ];
  };
  const joint = (k: number, y: number, rod: typeof ROD_L, on: string, mate: string) => at("stud", [[xs[k], y, 0]], [0, -1, 0], on, mate, rod);

  const steps: CustomStep[] = [
    {
      title: "Press a glide into each upper foot bar",
      detail: "Into the hole at the plain end, under the bar. There are two feet: do both.",
      add: ["FU0", "FU1"],
      fix: [at("glide", feet.map((x) => [x, 0, barL - 50] as Vec3), [0, 1, 0], undefined, undefined, GLIDE)],
    },
    {
      title: "Press two glides into each lower foot bar",
      detail: "One at each end, on the side without the sunk hole.",
      add: ["FL0", "FL1"],
      fix: [at("glide", feet.flatMap((x) => [[x, 0, -barL + 50], [x, 0, -40]] as Vec3[]), [0, 1, 0], undefined, undefined, GLIDE)],
    },
    {
      title: "Bolt each foot together with a bottom arm",
      detail: "Stack the arm's boss, the upper bar, a washer and the lower bar. A long threaded rod goes down through them by hand and the connector bolt screws onto it from below.",
      add: ["AB0", "AB2"],
      fix: [...footRod(0), ...footRod(1)],
      tools: ["allen"],
    },
    {
      title: "Screw the first end pole onto its foot",
      detail: "Lay the foot on its side on the floor. Turn the pole onto the threaded rod, the end with the mark at the foot.",
      add: ["E0"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Fix a top arm to the top of the pole",
      detail: "A short threaded rod goes in by hand, then the arm's boss, then screw the cap on tight.",
      add: ["AT0"],
      fix: [joint(0, yArmHi + 20, ROD_S, "AT0", "E0")],
    },
    {
      title: "Press glides into the two short caps",
      detail: "These are the feet of the middle poles.",
      add: ["C1", "C2"],
      fix: [at("glide", [1, 2].map((k) => [xs[k], 0, 0] as Vec3), [0, 1, 0], undefined, undefined, GLIDE)],
    },
    {
      title: "Join the next bottom arm at the first arm's eye",
      detail: "A long threaded rod through the eye and the new arm's boss, then a cap with a glide screwed on underneath. Turn it until the caps sit tight, with the arms still able to swing.",
      add: ["AB1"],
      fix: [joint(1, yArmLo + 30, ROD_L, "AB1", "C1")],
    },
    { title: "Screw the first middle pole on", detail: "Marked end at the bottom. Turn it onto the threaded rod until it sits on the arms.", add: ["M1"] },
    {
      title: "Join the top arms on the middle pole",
      detail: "A long threaded rod into the top of the pole, through the eye of the first top arm and the boss of the next, and the cap on top.",
      add: ["AT1"],
      fix: [joint(1, yArmHi + 30, ROD_L, "AT1", "M1")],
    },
    {
      title: "Join the bottom arms of the last panel",
      detail: "A long threaded rod through the eye of the bottom arm and the eye of the second foot's arm, then the other cap with a glide.",
      fix: [joint(2, yArmLo + 30, ROD_L, "AB2", "C2")],
    },
    { title: "Screw the second middle pole on", detail: "Marked end at the bottom, like the first.", add: ["M2"] },
    {
      title: "Screw the last end pole onto its foot",
      detail: "Then fix the last top arm: its boss on the end pole with a short rod, its eye on the middle pole with a long one, and a cap on each.",
      add: ["E3", "AT2"],
      fix: [joint(3, yArmHi + 20, ROD_S, "AT2", "E3"), joint(2, yArmHi + 30, ROD_L, "AT1", "M2")],
    },
    { title: "Stand the divider up", detail: "Lift it by the top and swing it up onto its feet.", pose: "+y", kind: "standup" },
    {
      title: "Hang the fabric panels",
      detail: "One between each pair of poles. Pull the loops at its top corners over the ends of the top arms, six in all, so the fabric hangs tight.",
      add: ["F0", "F1", "F2"],
      from: { F0: [0, 0, 300], F1: [0, 0, 300], F2: [0, 0, 300] },
    },
  ];
  return { parts, steps };
}

function wardrobe(s: ProductSpec): CustomParams {
  // IKEA: 117 wide, 63 deep, 150 high
  const W = Math.round(s.size.w * 10) || 1170, D = Math.round(s.size.d * 10) || 630, H = Math.round(s.size.h * 10) || 1500;
  const T = 18;
  const yB = 170; // the bottom sits on the feet
  const yIn0 = yB + T, yIn1 = H - T;
  const hIn = yIn1 - yIn0;
  const zF = D / 2, zK = -D / 2;
  const zFront = [zF - 15, zF - 40], zBackDoor = zK + 15; // track lines
  const zBackPanel = zK + 40;
  const dz0 = zBackPanel - T / 2, dz1 = zF - 55; // divider, between the back panel and the front tracks
  const xIn = W / 2 - T;
  const footX = W / 2 - 130;
  const doorW = Math.round(xIn + 25), doorH = hIn - 24, doorT = 18;
  const doorX = Math.round(xIn - doorW / 2);
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `FT${i}`, name: "Foot", size: [30, yB, D - 110], pos: [sx * footX, yB / 2, 0], material: "wood" })),
    { id: "RL", name: "Base rail", size: [2 * footX - 30, 80, 22], pos: [0, 90, 0], material: "wood" },
    { id: "BT", name: "Bottom", size: [W, T, D], pos: [0, yB + T / 2, 0], material: "wood" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `SD${i}`, name: "Side", size: [T, hIn, D], pos: [sx * (W / 2 - T / 2), yIn0 + hIn / 2, 0], material: "wood" })),
    { id: "DV", name: "Divider", size: [T, hIn, dz1 - dz0], pos: [0, yIn0 + hIn / 2, (dz0 + dz1) / 2], material: "wood" },
    { id: "BK", name: "Back panel", size: [xIn - T / 2, hIn, T], pos: [-(xIn + T / 2) / 2, yIn0 + hIn / 2, zBackPanel], material: "board" },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0], material: "wood" },
  ];
  const tracks = [...zFront, zBackDoor];
  tracks.forEach((z, i) => {
    parts.push({ id: `TT${i}`, name: "Door track", size: [2 * xIn, 6, 12], pos: [0, yIn1 - 3, z], material: "metal" });
    parts.push({ id: `TB${i}`, name: "Door track", size: [2 * xIn, 6, 12], pos: [0, yIn0 + 3, z], material: "metal" });
  });
  // door A on the inner front track (left), B on the outer one (right), C at the back over the open compartment
  const doors = [
    { id: "DA", x: -doorX, z: zFront[1], edge: -1 },
    { id: "DB", x: doorX, z: zFront[0], edge: 1 },
    { id: "DC", x: doorX, z: zBackDoor, edge: 1 },
  ];
  const yDoor = yIn0 + 12 + doorH / 2;
  doors.forEach((d) => {
    parts.push({ id: d.id, name: d.id === "DC" ? "Back door" : "Front door", size: [doorW, doorH, doorT], pos: [d.x, yDoor, d.z], material: "board" });
    parts.push({ id: `E${d.id}`, name: "Door edge strip", size: [28, doorH, doorT + 6], pos: [d.x + d.edge * (doorW / 2 + 14), yDoor, d.z], material: "wood" });
  });
  const shelfW = xIn - T / 2 - 2, shelfD = dz1 - (zBackPanel + T / 2) - 4;
  [600, 1000].forEach((y, i) =>
    parts.push({ id: `SH${i}`, name: "Shelf", size: [shelfW, T, shelfD], pos: [-(xIn + T / 2) / 2, y, zBackPanel + T / 2 + 2 + shelfD / 2], material: "wood" }),
  );
  parts.push({ id: "CR", name: "Clothes rail", size: [xIn - T / 2, 25, 25], pos: [(xIn + T / 2) / 2, H - 120, 0], shape: "cyl", material: "metal", rot: [0, 0, Math.PI / 2] });
  // a cylinder lies along x by turning it, so give its size as it stands
  parts[parts.length - 1].size = [25, xIn - T / 2, 25];

  const onDoor = (pts: Vec3[], d: (typeof doors)[number]) => pts.filter((p) => Math.abs(p[0] - d.x) < doorW / 2 && p[2] === d.z);
  const inset = (d: (typeof doors)[number], y: number, k: number): Vec3 => [Math.round(d.x + k * (doorW / 2 - 60)), y, d.z];
  const tops = doors.flatMap((d) => [-1, 1].map((k) => inset(d, yDoor + doorH / 2, k)));
  const bottoms = doors.flatMap((d) => [-1, 1].map((k) => inset(d, yDoor - doorH / 2, k)));
  const supports = (x0: number, x1: number, y: number) =>
    [x0, x1].flatMap((x) => [zBackPanel + 60, (zBackPanel + dz1) / 2, dz1 - 40].map((z) => [Math.round(x), y - T / 2, Math.round(z)] as Vec3));
  const shelfXs = [-xIn, -T / 2];
  const stripPts = (d: (typeof doors)[number]) => [0.12, 0.38, 0.62, 0.88].map((f) => [Math.round(d.x + d.edge * (doorW / 2)), Math.round(yDoor - doorH / 2 + f * doorH), d.z] as Vec3);
  const hangDoor = (d: (typeof doors)[number], back: boolean): CustomStep => ({
    title: back ? "Hang the back door" : d.id === "DA" ? "Hang the first front door on the inner track" : "Hang the last door on the outer track",
    detail: "Tilt the top in first: push the guides up into the top track and lock their tabs, then lower the rollers into the bottom track and press until they click.",
    add: [d.id],
    from: { [d.id]: [0, 0, back ? -300 : 300] },
    people: 2,
    warnings: ["two"],
  });

  // three cam bolts under each side and the divider
  const camPts = (y: number) => [-(W / 2 - T / 2), 0, W / 2 - T / 2].flatMap((x) => [-1, 0, 1].map((k) => [Math.round(x), y, Math.round(k * (D / 2 - 90))] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Screw cam bolts into the bottom",
      detail: "Nine in the bottom, turned in by hand until they stop. The top takes nine more: they go in when it goes on.",
      fix: [at("camScrew", camPts(yB + T), [0, -1, 0], "BT", undefined, { len: 34 })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the ends of the base rail",
      detail: "One large dowel in each end.",
      fix: [at("dowel", [-1, 1].map((sx) => [sx * (footX - 15), 90, 0] as Vec3), [-1, 0, 0], "RL", undefined, { len: 40, dia: 10 })],
      tools: ["hammer"],
    },
    { title: "Press a glide under each foot", detail: "Two under each foot, into the holes in the bottom edge.", add: ["FT0", "FT1"], from: { FT0: [-300, 0, 0], FT1: [300, 0, 0] }, fix: [at("glide", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * footX, 0, sz * (D / 2 - 120)] as Vec3)), [0, 1, 0], undefined, undefined, { name: "Glide", len: 6, dia: 40 })] },
    {
      title: "Screw the rail between the feet",
      detail: "Its dowels go into the feet, then one Allen screw through each foot into the rail.",
      fix: [-1, 1].map((sx, i) => at("screw", [[sx * (footX + 15), 90, 0]], [-sx, 0, 0], `FT${i}`, "RL", { len: 70, dia: 6 })),
      tools: ["allen"],
      warnings: ["floor"],
    },
    // the dowels sit between the screw holes along the top of each foot
    { title: "Tap dowels into the tops of the feet", detail: "Three large dowels in each foot.", fix: [-1, 1].map((sx, i) => at("dowel", [-100, 60, 120].map((z) => [sx * footX, yB, z] as Vec3), [0, -1, 0], `FT${i}`, "BT", { len: 40, dia: 10 })), tools: ["hammer"] },
    {
      title: "Screw the bottom onto the feet",
      detail: "Cam bolts facing up. Six Allen screws from above through the bottom into the feet.",
      fix: [at("screw", [-1, 1].flatMap((sx) => [-1, 0, 1].map((k) => [sx * footX, yB + T, k * (D / 2 - 120)] as Vec3)), [0, -1, 0], "BT", undefined, { len: 70, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Tap dowels into the sides and the divider", detail: "Into the holes in their top and bottom edges.", fix: [{ kind: "dowel", count: 26, len: 30, dia: 8, to: ["SD0", "SD1", "DV"] }], tools: ["hammer"] },
    { title: "Screw three cam bolts into the divider", detail: "On the face that meets the back panel.", fix: [{ kind: "camScrew", count: 3, to: ["DV", "BK"], on: "DV" }], tools: ["screwdriver"] },
    { title: "Stand the sides in the bottom", detail: "Holes for the shelves facing in. Their dowels go into the bottom.", add: ["SD0", "SD1"], from: { SD0: [0, 500, 0], SD1: [0, 500, 0] } },
    { title: "Stand the divider in the middle", detail: "Cam bolts towards the compartment with the back.", add: ["DV"], from: { DV: [0, 500, 0] } },
    { title: "Lock the bottom with nine cam locks", detail: "Push them into the holes in the sides and divider, arrows to the edge, and turn clockwise.", fix: [{ kind: "cam", count: 9, to: ["BT"] }], tools: ["screwdriver"] },
    {
      title: "Slide the back panel in",
      detail: "Two dowels in the end by the divider. Angle it in past the side, then push it across so the dowels and the cam bolts go into the divider.",
      add: ["BK"],
      // dowels in the end that meets the divider: it slides along them onto the divider's cam bolts
      fix: [at("dowel", [0.3, 0.7].map((f) => [-T / 2, Math.round(yIn0 + hIn * f), zBackPanel] as Vec3), [-1, 0, 0], "BK", "DV", { len: 30, dia: 8 })],
      from: { BK: [-300, 0, 0] },
      tools: ["hammer"],
    },
    {
      title: "Lower the top on",
      detail: "Screw its nine cam bolts in first. Lift it together, cam bolts down, and lower it so every dowel finds its hole.",
      add: ["TP"],
      fix: [at("camScrew", camPts(H - T), [0, 1, 0], "TP", undefined, { len: 34 })],
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    },
    { title: "Lock the top with nine cam locks", detail: "Turn each one clockwise until the joints close up.", fix: [{ kind: "cam", count: 9, to: ["TP"] }], tools: ["screwdriver"] },
    {
      title: "Press the door tracks into the top",
      detail: "One along the back, two side by side at the front. Push them up into the grooves along their whole length.",
      add: ["TT2", "TT0", "TT1"],
      from: { TT0: [0, -200, 0], TT1: [0, -200, 0], TT2: [0, -200, 0] },
    },
    {
      title: "Press the door tracks into the bottom",
      detail: "The same: one at the back, two at the front.",
      add: ["TB2", "TB0", "TB1"],
      from: { TB0: [0, 200, 0], TB1: [0, 200, 0], TB2: [0, 200, 0] },
    },
    { title: "Screw the side to the back panel", detail: "Three screws through the side into the edge of the back panel.", fix: [{ kind: "screw", count: 3, len: 50, dia: 5, to: ["SD0", "BK"] }], tools: ["allen"] },
    { title: "Lock the back panel to the divider", detail: "Three cam locks in the back panel, turned clockwise onto the divider's cam bolts.", fix: [{ kind: "cam", count: 3, to: ["BK", "DV"], on: "BK" }], tools: ["screwdriver"] },
    {
      title: "Hang the clothes rail",
      detail: "Clip the two holders onto the rail, hook them into one of the three pairs of holes and turn the screw to lock each one.",
      add: ["CR"],
      fix: [at("clip", [[T / 2 + 20, H - 120, 0], [xIn - 20, H - 120, 0]], [0, 1, 0], "CR", undefined, { name: "Rail holder", len: 40, dia: 30 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the top plates onto the doors",
      detail: "Lay the three doors flat. Two plates on the top edge of each.",
      wait: doors.map((d) => d.id),
      fix: doors.flatMap((d) => [at("plate", onDoor(tops, d), [0, -1, 0], d.id, undefined, { name: "Top guide plate", len: 6, dia: 40 }), at("screw", onDoor(tops, d).map((p) => [p[0] + 25, p[1], p[2]] as Vec3), [0, -1, 0], d.id, undefined, { len: 12, dia: 4 })]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the rollers under the doors",
      detail: "Two rollers on the bottom edge of each door, two screws each.",
      fix: doors.flatMap((d) => [at("roller", onDoor(bottoms, d), [0, 1, 0], d.id, undefined, { name: "Bottom roller" }), at("screw", onDoor(bottoms, d).flatMap((p) => [-25, 25].map((dx) => [p[0] + dx, p[1], p[2]] as Vec3)), [0, 1, 0], d.id, undefined, { len: 12, dia: 4 })]),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the top guides on the front doors",
      detail: "A guide and a pad on each top plate of the two front doors, two pins each.",
      fix: doors.slice(0, 2).flatMap((d) => [
        at("clip", onDoor(tops, d), [0, -1, 0], d.id, undefined, { name: "Top guide", len: 20, dia: 30 }),
        at("spacer", onDoor(tops, d), [0, -1, 0], d.id, undefined, { name: "Pad", len: 3, dia: 30 }),
        at("pin", onDoor(tops, d).flatMap((p) => [-25, 25].map((dx) => [p[0] + dx, p[1], p[2]] as Vec3)), [0, -1, 0], d.id, undefined, { name: "Pin", len: 12, dia: 5 }),
      ]),
    },
    { title: "Tap dowels into the edge strips", detail: "Four small dowels in each of the three pine strips.", wait: doors.map((d) => `E${d.id}`), fix: doors.map((d) => at("dowel", stripPts(d), [d.edge, 0, 0], `E${d.id}`, d.id, { len: 25, dia: 6 })), tools: ["hammer"] },
    hangDoor(doors[2], true),
    hangDoor(doors[0], false),
    { ...hangDoor(doors[1], false), detail: "The same way, on the outermost track. Turn the roller screws if a door needs raising or lowering so the gaps are even." },
    {
      title: "Screw the edge strips onto the doors",
      detail: "Push each strip onto its door's free edge, over the dowels, then four screws through the door into it.",
      add: doors.map((d) => `E${d.id}`),
      from: Object.fromEntries(doors.map((d) => [`E${d.id}`, [d.edge * 250, 0, 0] as Vec3])),
      fix: doors.map((d) => at("screw", stripPts(d).map((p) => [p[0], p[1] + 40, p[2]] as Vec3), [d.edge, 0, 0], d.id, `E${d.id}`, { len: 30, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Push in the shelf supports and lay in a shelf",
      detail: "Six supports at the height you want, then lay the shelf on them.",
      add: ["SH0"],
      fix: [at("pin", supports(shelfXs[0], shelfXs[1], 600), [0, -1, 0], undefined, undefined, { name: "Shelf support", len: 16, dia: 5 })],
      from: { SH0: [0, 0, 400] },
    },
    {
      title: "Fit the second shelf",
      detail: "Six more supports, higher up, and the other shelf on them.",
      add: ["SH1"],
      fix: [at("pin", supports(shelfXs[0], shelfXs[1], 1000), [0, -1, 0], undefined, undefined, { name: "Shelf support", len: 16, dia: 5 })],
      from: { SH1: [0, 0, 400] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["GLAMBERGET"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/room-divider/.test(slug)) return divider(s);
    if (/wardrobe-3-sliding-doors/.test(slug)) return wardrobe(s);
    return null;
  },
};
export default family;
