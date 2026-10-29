import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwKind, ProductSpec, Vec3 } from "../../types";

/**
 * HAGAÅN open cabinets, read from their manuals (the same steps in the GB and US sizes). Nothing is cam-locked:
 * the panels have click dowels that snap into the sides. The fittings go onto the sides lying flat, then the box is
 * built lying on its front: the top and bottom click into one side, the other side presses on, and a hardboard back
 * slides in down grooves and is pinned with plastic rivets. It hangs on a suspension rail screwed to the wall (four
 * screws, a spacer behind each), the hooks are set with the Allen key, and two machine screws lock it to the rail.
 * The tall wall cabinet adds clips along the back, clip-in suspension fittings and three shelves on screw-in supports.
 * Sizes match the HAGAÅN cabinets drawn inside the ÄNGSJÖN and HAVBÄCK sets: 16 mm board, the back near the wall.
 */

const T = 16;
const SMALL: Partial<CustomFix> = { len: 13, dia: 3.5 }; // the small chipboard screws for the fittings
const r = (n: number) => Math.round(n * 10) / 10;

interface Box {
  W: number;
  H: number;
  D: number;
  wall: boolean; // the tall wall cabinet with shelves
}

function boxOf(s: ProductSpec): Box | null {
  const slug = s.slug ?? "";
  if (!/^hagaan-/.test(slug)) return null;
  const wall = /wall-open-cabinet/.test(slug);
  if (!wall && !/open-cabinet/.test(slug)) return null;
  return { W: s.size.w * 10, H: s.size.h * 10, D: s.size.d * 10, wall };
}

const fx = (kind: HwKind, on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({
  kind,
  count: at.length,
  on,
  dir,
  at: at.map((p) => p.map(r) as Vec3),
  ...o,
});

function recipe(g: Box) {
  const { W, H, D, wall } = g;
  const iw = W - 2 * T;
  const zBack = -D / 2 + 9; // the hardboard back, just in front of the rail
  const zp0 = zBack + 2; // panels run from the back to the front edge
  const pd = D / 2 - zp0;
  const zp = zp0 + pd / 2;
  const xs = (sx: number) => sx * (W / 2 - T / 2);
  const inner = (sx: number) => sx * (W / 2 - T);
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, H, D], pos: [xs(-1), H / 2, 0] },
    { id: "R", name: "Side panel", size: [T, H, D], pos: [xs(1), H / 2, 0] },
    { id: "B", name: "Top and bottom", size: [iw, T, pd], pos: [0, T / 2, zp] },
    { id: "P", name: "Top and bottom", size: [iw, T, pd], pos: [0, H - T / 2, zp] },
    { id: "K", name: "Back panel", size: [iw, H, 4], pos: [0, H / 2, zBack], material: "fiber" },
  ];
  // the rail's top sits 109 mm under the top of the low cabinet, 35 mm under the tall one's
  const railTop = H - (wall ? 35 : 109);
  const railY = railTop - 20;
  parts.push({ id: "X", name: "Suspension rail", size: [iw - 20, 40, 6], pos: [0, railY, -D / 2 + 3], material: "metal" });
  const shelves: string[] = [];
  if (wall) {
    const gap = (H - 2 * T - 3 * T) / 4;
    for (let i = 1; i <= 3; i++) {
      const id = `S${i}`;
      shelves.push(id);
      parts.push({ id, name: "Shelf", size: [iw - 2, T, pd - 10], pos: [0, T + i * gap + (i - 0.5) * T, zp + 5] });
    }
  }

  const zf = -D / 2 + 4; // fittings in the space behind the back
  const hookAt = (sx: number): Vec3 => [inner(sx), railY + 10, zf];
  const screwsAt = (sx: number): Vec3[] => (wall ? [railY + 40, railY + 20] : [railY + 45, railY + 20, railY - 5]).map((y) => [inner(sx), y, -D / 2 + 22]);
  const bracketAt = (sx: number): Vec3 => [inner(sx) - sx * 20, railY - 38, zf];
  const bracketScrews = (sx: number): Vec3[] => [railY - 50, railY - 26].map((y) => [inner(sx), y, -D / 2 + 20]);

  const steps: CustomStep[] = [];
  const sideFits = (id: string, sx: number): CustomFix[] =>
    wall
      ? [fx("angle", id, [sx, 0, 0], [bracketAt(sx)], { len: 40, dia: 30, name: "Small bracket" }), fx("screw", id, [sx, 0, 0], bracketScrews(sx), SMALL)]
      : [fx("hook", id, [sx, 0, 0], [hookAt(sx)], { len: 30, dia: 36, name: "Suspension fitting" }), fx("screw", id, [sx, 0, 0], screwsAt(sx), SMALL)];
  steps.push({
    title: wall ? "Screw a small bracket onto the right side" : "Screw a suspension fitting onto the right side",
    detail: wall
      ? "Lay the side flat on a rug, inside up. The bracket goes near the top back corner, with two screws."
      : "Lay the side flat on a rug, inside up. The fittings are marked left and right; this one takes three screws in the top back corner.",
    add: ["R"],
    fix: sideFits("R", 1),
    tools: ["screwdriver"],
    pose: "-x",
    warnings: ["floor"],
  });
  steps.push({
    title: "Click the top and the bottom into the side",
    detail: "Stand the side on its front edge, inside facing in. Push each panel's dowels into the keyhole slots, then press down until it clicks.",
    add: ["P", "B"],
    from: { P: [-260, 0, 0], B: [-260, 0, 0] },
    pose: "-z",
  });
  steps.push({
    title: wall ? "Fit the left bracket and press that side on" : "Fit the left fitting and press that side on",
    detail: `Screw its ${wall ? "bracket" : "fitting"} on first, the same way. Then dowels into its slots along both panels, and press down until every one clicks.`,
    add: ["L"],
    fix: sideFits("L", -1),
    tools: ["screwdriver"],
    people: wall ? 2 : 1,
    from: { L: [-300, 0, 0] },
  });
  steps.push({
    title: "Slide the back panel into the grooves",
    detail: "Light side towards the front. It drops in between the sides and rests on the top and bottom.",
    add: ["K"],
    from: { K: [0, 0, -300] },
    check: "square",
  });
  const rivetPts: Vec3[] = [T / 2, H - T / 2].flatMap((y) => [-1, 1].map((sx) => [(sx * iw) / 4, y, zBack - 2] as Vec3));
  steps.push({
    title: "Pin the back with the plastic rivets",
    detail: "Push a sleeve through each hole into the panel behind it, then press its pin in until it sits flat.",
    fix: [
      { ...fx("clip", "K", [0, 0, 1], rivetPts.filter((p) => p[1] < H / 2), { len: 12, dia: 8, name: "Plastic rivet" }), mate: "B" },
      { ...fx("clip", "K", [0, 0, 1], rivetPts.filter((p) => p[1] > H / 2), { len: 12, dia: 8, name: "Plastic rivet" }), mate: "P" },
    ],
  });
  if (wall) {
    const clipPts: Vec3[] = [-1, 1].flatMap((sx) => [0.2, 0.5, 0.8].map((f) => [inner(sx) - sx * 6, H * f, zBack - 2] as Vec3));
    steps.push({
      title: "Square it up and press the clips onto the back",
      detail: "Check the corners are square first. Each clip goes in two halves along the sides; press them on by hand, never with a hammer.",
      fix: [fx("clip", "K", [0, 0, 1], clipPts, { len: 16, dia: 12, name: "Back clip" })],
      warnings: ["square"],
    });
    const fitAt = (sx: number): Vec3 => [inner(sx) - sx * 22, railY + 22, zf];
    steps.push({
      title: "Click the suspension fittings into the top corners",
      detail: "Left and right are marked. Press each one into its holes until it sits tight against the side, with no gap.",
      fix: [-1, 1].map((sx) => fx("hook", sx < 0 ? "L" : "R", [sx, 0, 0], [fitAt(sx)], { len: 30, dia: 36, name: "Suspension fitting" })),
    });
    steps.push({
      title: "Screw the fittings tight",
      detail: "One screw in each. Turn it in by hand and stop when it's snug, or it strips the board.",
      fix: [-1, 1].map((sx) => fx("screw", sx < 0 ? "L" : "R", [sx, 0, 0], [[inner(sx) - sx * 12, railY + 46, zf + 2]], { len: 25, dia: 4 })),
      tools: ["screwdriver"],
      warnings: ["hand"],
    });
  }

  const ends = [-1, 1].map((sx) => sx * (iw / 2 - 60));
  const wallPts: Vec3[] = ends.flatMap((x) => [railY + 14, railY - 14].map((y) => [x, y, -D / 2 + 6] as Vec3));
  steps.push({
    title: "Screw the suspension rail to the wall",
    detail: `Level, with its top ${wall ? 35 : 109} mm under where the top of the cabinet will be and 75 mm in from its side. A spacer behind each of the four screws. Screws and plugs for your wall aren't included.`,
    add: ["X"],
    from: { X: [0, 0, 260] },
    fix: [
      fx("plug", "X", [0, 0, -1], wallPts.map((p) => [p[0], p[1], -D / 2 - 30] as Vec3)),
      fx("screw", "X", [0, 0, -1], wallPts, { len: 50, dia: 5 }),
      // the spacer sits on the screw, between the rail and the wall
      fx("washer", "X", [0, 0, -1], wallPts.map((p) => [p[0], p[1], -D / 2 + 1] as Vec3), { len: 4, dia: 20, name: "Spacer" }),
    ],
    tools: ["drill", "level", "pencil", "screwdriver"],
    pose: "+y",
    wall: true,
    warnings: ["wall"],
  });
  steps.push({
    title: "Hang the cabinet on the rail",
    detail: "Lift it so both fittings hook over the rail. Turn their screws with the Allen key to level it and pull it back to the wall.",
    tools: ["allen", "level"],
    people: wall ? 2 : 1,
    wall: true,
  });
  const lockPts: Vec3[] = [-1, 1].map((sx) => (wall ? [inner(sx) - sx * 20, railY - 10, zf + 6] : [inner(sx) - sx * 30, railY, zf + 6]));
  steps.push({
    title: "Lock it to the rail",
    detail: wall
      ? "A machine screw and a washer through each small bracket into the rail, then snap a cover over each bracket."
      : "A machine screw and a washer through each fitting into the rail, so it can't be lifted off.",
    fix: [
      ...[-1, 1].map((sx, i) => ({ ...fx("bolt", sx < 0 ? "L" : "R", [0, 0, -1], [lockPts[i]], { len: 12, dia: 6, name: "Machine screw" }), mate: "X" })),
      ...[-1, 1].map((sx, i) => fx("washer", sx < 0 ? "L" : "R", [0, 0, -1], [lockPts[i]], { len: 2, dia: 22 })),
      ...(wall ? [-1, 1].map((sx, i) => fx("cap", sx < 0 ? "L" : "R", [-sx, 0, 0], [[lockPts[i][0] - sx * 10, lockPts[i][1], lockPts[i][2]]], { len: 10, dia: 40, name: "Cover" })) : []),
    ],
    tools: ["allen"],
  });
  if (wall) {
    const pinPts = (sx: number): Vec3[] =>
      shelves.flatMap((id) => {
        const p = parts.find((x) => x.id === id)!;
        const y = p.pos[1] - T / 2 - 4;
        return [p.pos[2] - p.size[2] / 2 + 20, p.pos[2] + p.size[2] / 2 - 20].map((z) => [inner(sx), y, z] as Vec3);
      });
    steps.push({
      title: "Put the shelves in",
      detail: "Screw four supports in level for each shelf, then lay it on them with its rounded edge to the front.",
      add: shelves,
      fix: [-1, 1].map((sx) => fx("pin", sx < 0 ? "L" : "R", [sx, 0, 0], pinPts(sx), { len: 16, dia: 5, name: "Shelf support" })),
      from: Object.fromEntries(shelves.map((id) => [id, [0, 0, 260] as Vec3])),
    });
  }
  return { parts, steps };
}

const family: Family = {
  names: ["HAGAÅN", "HAGAAN"],
  recipe(s) {
    const g = boxOf(s);
    return g ? recipe(g) : null;
  },
};
export default family;
