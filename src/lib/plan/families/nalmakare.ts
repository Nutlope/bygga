import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NÅLMAKARE, read from the cabinet on castors' manual. Each side is a welded steel frame with its mesh and a handle
 * loop on top. Two castors are screwed into each frame with the spanner, then the cabinet is built lying on its front:
 * the three shelves are bolted to one side frame (two bolts each), the other frame goes on with six, and the two mesh
 * back panels are screwed on with four screws each. Stood up, the two mesh doors are lifted into the top track and
 * dropped into the bottom one.
 * IKEA: 78.7 wide, 43.7 deep, 87.6 high.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function recipe(s: ProductSpec): CustomParams {
  const W = 787, D = 437, H = 876;
  const t = 20; // tube
  const yC = 100; // castors under the frame
  const xF = W / 2 - t / 2;
  const zP = D / 2 - t / 2;
  const yHandle = H - 120; // where the handle loop starts to curve over
  const TT = 18;
  const shelves = [185, 514, 731]; // top faces
  const frame = (sx: number): CustomPart => {
    const c: Vec3 = [sx * xF, (yC + H) / 2, 0];
    const p = (y: number, z: number): Vec3 => [0, y - c[1], z];
    const pieces: PartPiece[] = [
      // front and back posts up to the loop, the loop over the top, a bottom rail, and the mesh between them
      { shape: "cyl", size: [t, yHandle - yC, t], pos: p((yC + yHandle) / 2, zP - 20) },
      { shape: "cyl", size: [t, yHandle - yC, t], pos: p((yC + yHandle) / 2, -zP + 20) },
      { shape: "cyl", size: [t, D - 160, t], pos: p(H - t / 2, 0), rot: [Math.PI / 2, 0, 0] },
      { shape: "cyl", size: [t, 120, t], pos: p(H - 70, zP - 50), rot: [-0.6, 0, 0] },
      { shape: "cyl", size: [t, 120, t], pos: p(H - 70, -zP + 50), rot: [0.6, 0, 0] },
      { shape: "box", size: [t, t, D - 40], pos: p(yC + t / 2, 0) },
      { shape: "box", size: [t, t, D - 40], pos: p(shelves[2] + 70, 0) },
      { shape: "box", size: [3, shelves[2] + 70 - yC - t, D - 60], pos: p((yC + t + shelves[2] + 70) / 2, 0) },
    ];
    return { id: sx < 0 ? "F1" : "F2", name: "Side frame", size: [t, H - yC, D], pos: c, material: "metal", pieces };
  };
  const sw = W - 2 * t, sd = D - 40;
  const shelf = (id: string, yTop: number): CustomPart => ({ id, name: "Shelf", size: [sw, TT, sd], pos: [0, yTop - TT / 2, 0], material: "wood" });
  const zBack = -D / 2 + 12;
  const zDoor = [D / 2 - 30, D / 2 - 50];
  const doorW = sw / 2 + 20, doorH = shelves[1] - TT - shelves[0] - 10;
  const parts: CustomPart[] = [
    frame(-1),
    frame(1),
    shelf("S1", shelves[0]),
    shelf("S2", shelves[1]),
    shelf("S3", shelves[2]),
    { id: "B1", name: "Back panel", size: [sw, shelves[1] - shelves[0], 4], pos: [0, (shelves[0] + shelves[1]) / 2 - TT / 2, zBack], material: "metal" },
    { id: "B2", name: "Back panel", size: [sw, shelves[2] + 70 - shelves[1] + TT, 4], pos: [0, (shelves[1] - TT + shelves[2] + 70) / 2, zBack], material: "metal" },
    { id: "D1", name: "Sliding door", size: [doorW, doorH, 10], pos: [-sw / 4 + 10, shelves[0] + 5 + doorH / 2, zDoor[0]], material: "metal" },
    { id: "D2", name: "Sliding door", size: [doorW, doorH, 10], pos: [sw / 4 - 10, shelves[0] + 5 + doorH / 2, zDoor[1]], material: "metal" },
  ];
  const BOLT = { len: 12, dia: 6 };
  const shelfBolts = (sx: number, ys: number[]): CustomFix[] =>
    ys.map((y, i) => fx("bolt", [-1, 1].map((sz): Vec3 => [sx * (W / 2), y - TT / 2, sz * (zP - 40)]), [-sx, 0, 0], sx < 0 ? "F1" : "F2", { mate: `S${shelves.indexOf(y) + 1 || i + 1}`, ...BOLT }));
  // the two panels share the middle shelf: the upper one's screws sit further in, clear of the lower one's
  const panelScrews = (id: string, y0: number, y1: number, inset = 30): CustomFix =>
    fx("screw", [y0, y1].flatMap((y) => [-1, 1].map((sx): Vec3 => [sx * (sw / 2 - inset), y, -D / 2 + 10])), [0, 0, 1], id, { len: 10, dia: 4 });
  const steps: CustomStep[] = [
    {
      title: "Screw the castors into the side frames",
      detail: "Lay both frames flat on a rug. Turn a castor into each foot by hand, then tighten it with the spanner.",
      add: ["F1"],
      wait: ["F2"],
      fix: [-1, 1].flatMap((sx) => fx("castor", [-1, 1].map((sz): Vec3 => [sx * xF, yC, sz * (zP - 20)]), [0, 1, 0], sx < 0 ? "F1" : "F2")),
      tools: ["wrench"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the bottom shelf to a side frame",
      detail: "Stand the frame on its front edge on the rug. Slide the shelf into its ledge and turn in two bolts.",
      add: ["S1"],
      fix: shelfBolts(-1, [shelves[0]]),
      pose: "-z",
    },
    { title: "Bolt on the middle shelf", detail: "The groove for the doors faces down, towards the front.", add: ["S2"], fix: shelfBolts(-1, [shelves[1]]) },
    { title: "Bolt on the top shelf", detail: "Two bolts again, at the top of the frame.", add: ["S3"], fix: shelfBolts(-1, [shelves[2]]) },
    {
      title: "Bolt on the other side frame",
      detail: "Fit it over the free ends of all three shelves, castors at the same end as the first frame. Six bolts.",
      add: ["F2"],
      fix: shelfBolts(1, shelves),
    },
    {
      title: "Screw on the lower back panel",
      detail: "Lay it in between the bottom and middle shelves, the right way round. Four screws.",
      add: ["B1"],
      fix: [panelScrews("B1", shelves[0] - TT / 2, shelves[1] - TT / 2)],
    },
    { title: "Screw on the upper back panel", detail: "Between the middle and top shelves, four screws.", add: ["B2"], fix: [panelScrews("B2", shelves[1] - TT / 2, shelves[2] - TT / 2, 70)] },
    { title: "Stand it up", detail: "Tip it up onto its castors and lock two of them.", pose: "+y" },
    { title: "Hang the back door", detail: "Lift it into the inner groove under the middle shelf, then lower it into the track on the bottom shelf.", add: ["D2"], from: { D2: [0, 40, 260] } },
    { title: "Hang the front door", detail: "The same way, in the outer groove. Check both slide freely.", add: ["D1"], from: { D1: [0, 40, 260] } },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NÅLMAKARE", "NALMAKARE"],
  recipe(s) {
    if (!/cabinet/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
