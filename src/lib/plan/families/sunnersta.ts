import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SUNNERSTA, read from the storage unit's manual. Each side is two bent tubes, built upside down: the lower loop that
 * runs along the floor takes two adjustable feet, then the upper loop (with the drawer runner) is slid onto it. The
 * two sides are joined by the top shelf
 * and then the bottom shelf, four Allen bolts each. The feet are levelled, two clips on the back tubes go onto
 * screws in the wall (spacers for a skirting board), and the sheet metal drawer is folded up and slid in under the
 * top shelf.
 */

const TUBE = 16;

/** A tube loop in the y-z plane at x: legs at both z ends from y0 to y1, closed by a bar at yb (y1 or y0). */
function loop(x: number, zs: number, y0: number, y1: number, yb: number, c: Vec3): PartPiece[] {
  return [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [TUBE, y1 - y0, TUBE], pos: [x - c[0], (y0 + y1) / 2 - c[1], sz * zs - c[2]] })),
    { shape: "cyl", size: [TUBE, 2 * zs, TUBE], pos: [x - c[0], yb - c[1], -c[2]], rot: [Math.PI / 2, 0, 0] },
  ];
}

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 56 long, 38 wide, 97 high
  const W = Math.round(s.size.w * 10) || 560, D = Math.round(s.size.d * 10) || 380, H = Math.round(s.size.h * 10) || 970;
  const xs = W / 2 - TUBE / 2, zs = D / 2 - TUBE / 2;
  const yJ = Math.round(H * 0.55); // where the upper loop slides onto the lower
  const yFoot = 12; // the lower loop's bar runs just above its feet
  const yTop = H - 160, yLow = Math.round(H * 0.33), st = 20; // shelf tops
  const parts: CustomPart[] = [];
  // the drawer hangs on a flat bar inside each upper loop, under the top shelf
  const runner = (x: number, c: Vec3): PartPiece => ({ shape: "box", size: [4, 12, 2 * zs], pos: [x - c[0], yTop - 20 - 10 - c[1], -c[2]] });
  [-1, 1].forEach((sx, i) => {
    const x = sx * xs;
    const cu: Vec3 = [x, (yJ + H) / 2, 0], cl: Vec3 = [x, (yFoot + yJ) / 2, 0];
    parts.push({ id: `U${i + 1}`, name: "Upper frame", size: [TUBE, H - yJ, D], pos: cu, material: "metal", pieces: [...loop(x, zs, yJ, H - TUBE / 2, H - TUBE / 2, cu), runner(x - sx * 10, cu)] });
    parts.push({ id: `B${i + 1}`, name: "Lower frame", size: [TUBE, yJ - yFoot, D], pos: cl, material: "metal", pieces: loop(x, zs, yFoot + TUBE / 2, yJ, yFoot + TUBE / 2, cl) });
  });
  const sw = W - 2 * TUBE;
  const shelf = (id: string, name: string, y: number): CustomPart => ({
    id,
    name,
    size: [sw, st, D - TUBE],
    pos: [0, y - st / 2, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [sw, 2, D - TUBE], pos: [0, st / 2 - 1, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [sw, st, 2], pos: [0, 0, (sz * (D - TUBE - 2)) / 2] })),
    ],
  });
  parts.push(shelf("T", "Top shelf", yTop), shelf("S", "Bottom shelf", yLow));
  const dh = 110, dw = sw - 40, dd = D - 40, yD = yTop - st - 6 - dh / 2;
  parts.push({
    id: "DR",
    name: "Drawer",
    size: [dw, dh, dd],
    pos: [0, yD, 10],
    material: "metal",
    pieces: [
      { shape: "box", size: [dw, 2, dd], pos: [0, -dh / 2 + 1, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [dw, dh, 2], pos: [0, 0, (sz * (dd - 2)) / 2] })),
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [2, dh, dd], pos: [(sx * (dw - 2)) / 2, 0, 0] })),
    ],
  });

  const bolts = (id: string, y: number): CustomFix[] =>
    [-1, 1].map((sx, i) => ({
      kind: "bolt",
      count: 2,
      len: 30,
      dia: 6,
      // through each leg tube into the shelf's turned-down edge, front and back
      at: [-1, 1].map((sz): Vec3 => [sx * (W / 2), y - st / 2, (sz * (D - TUBE - 2)) / 2]),
      dir: [-sx, 0, 0],
      on: y > yJ ? `U${i + 1}` : `B${i + 1}`,
      mate: id,
    }));
  const zb = -D / 2, yW = yTop - 60;
  return {
    parts,
    steps: [
      {
        title: "Screw the feet into the lower frames",
        detail: "Lay them upside down on a rug and turn two feet into each one by hand.",
        fix: [-1, 1].map((sx, i): CustomFix => ({ kind: "foot", count: 2, len: 15, dia: 14, at: [-1, 1].map((sz): Vec3 => [sx * xs, 0, sz * (zs - 40)]), dir: [0, 1, 0], on: `B${i + 1}` })),
        wait: ["B1", "B2"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Slide each upper frame onto a lower frame",
        detail: "The tube ends fit into each other. Push until the holes line up, then you have the two sides.",
        add: ["B1", "U1", "B2", "U2"],
      },
      { pose: "+y", title: "Bolt the top shelf between the sides", detail: "Two bolts through each side with the Allen key. Leave them a little loose for now.", add: ["T"], fix: [...bolts("T", yTop)], tools: ["allen"] },
      { title: "Bolt on the bottom shelf", detail: "Two bolts in each side, then tighten all eight.", add: ["S"], fix: [...bolts("S", yLow)], tools: ["allen"] },
      { title: "Level the feet", detail: "Stand it where it goes and turn the four feet under the frames until it doesn't rock." },
      {
        title: "Clip the wall brackets onto the back tubes",
        detail: "One on each side, just under the top shelf, with the screw hole facing the wall.",
        fix: [-1, 1].map((sx, i): CustomFix => ({ kind: "bracket", count: 1, at: [[sx * xs, yW, zb - 2]], dir: [0, 0, 1], on: `U${i + 1}` })),
      },
      {
        title: "Screw it to the wall",
        detail: "Use screws and plugs that suit your wall. Over a skirting board, put a spacer behind each bracket.",
        fix: [
          { kind: "plate", name: "Spacer", count: 2, included: true, at: [-1, 1].map((sx): Vec3 => [sx * xs, yW, zb - 12]), dir: [0, 0, 1], on: "U1" },
          { kind: "plug", count: 2, at: [-1, 1].map((sx): Vec3 => [sx * xs, yW, zb - 20]), dir: [0, 0, 1] },
          { kind: "screw", count: 2, len: 50, dia: 5, at: [-1, 1].map((sx): Vec3 => [sx * xs, yW, zb - 2]), dir: [0, 0, -1] },
        ],
        tools: ["drill", "screwdriver", "pencil"],
        warnings: ["wall", "tip"],
        wall: true,
      },
      {
        title: "Fold up the drawer",
        detail: "Bend the sides of the tray up and hook the tabs at each corner, then fold the front over and press its tabs in.",
        wait: ["DR"],
        warnings: ["hand"],
      },
      {
        title: "Slide the drawer in under the top shelf",
        detail: "Lift its back edge onto the runners under the shelf, lower it and push it in.",
        add: ["DR"],
        from: { DR: [0, 0, 350] },
      },
    ],
  };
}

const family: Family = { names: ["SUNNERSTA"], recipe };
export default family;
