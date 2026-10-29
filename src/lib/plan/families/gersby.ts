import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * GERSBY, read from its manual. Built lying on its front: dowels go into both ends of the top, the fixed shelf and
 * the bottom, they stand in one side and are fixed with two long screws each through it, the plinth goes on with
 * dowels at the bottom front, then the other side goes on with the same screws. The fixed shelf is marked on the
 * back edges, the folding back panel is nailed on, it stands up and two brackets hold the top to the wall. Shelf pins
 * and three loose shelves go in last.
 */

const T = 15; // panels
const B = 3; // the back lies on the back edges
const PL = 50; // plinth

type Kind = CustomFix["kind"];
const fx = (kind: Kind, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, dir, at, ...o });

function bookcase(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const Wi = W - 2 * T;
  const dz = B / 2; // everything but the back sits this far forward
  const Dp = D - B;
  const yTop = H - T / 2, yBot = PL + T / 2, yFix = Math.round(H * 0.48);
  const zPl = D / 2 - T / 2 - 8;
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, H, Dp], pos: [-W / 2 + T / 2, H / 2, dz] },
    { id: "R", name: "Side panel", size: [T, H, Dp], pos: [W / 2 - T / 2, H / 2, dz] },
    { id: "top", name: "Top panel", size: [Wi, T, Dp], pos: [0, yTop, dz] },
    { id: "fix", name: "Fixed shelf", size: [Wi, T, Dp], pos: [0, yFix, dz] },
    { id: "bot", name: "Bottom panel", size: [Wi, T, Dp], pos: [0, yBot, dz] },
    { id: "pl", name: "Plinth", size: [Wi, PL, T], pos: [0, PL / 2, zPl] },
    { id: "back", name: "Back panel", size: [W, H, B], pos: [0, H / 2, -D / 2 + B / 2], material: "fiber" },
  ];
  // three loose shelves: two above the fixed shelf, one below
  const sd = Dp - 10;
  const shelfYs = [Math.round((yBot + yFix) / 2), Math.round(yFix + (yTop - yFix) / 3), Math.round(yFix + (2 * (yTop - yFix)) / 3)];
  shelfYs.forEach((y, i) => parts.push({ id: `S${i}`, name: "Shelf", size: [Wi - 2, T, sd], pos: [0, y, D / 2 - sd / 2 - 4] }));

  const zs = Dp / 2 - 40;
  const boards: [string, number][] = [["top", yTop], ["fix", yFix], ["bot", yBot]];
  const dowels = (sx: number, list: [string, number][]): CustomFix[] =>
    list.map(([id, y]) => fx("dowel", [sx, 0, 0], [-zs, zs].map((z) => [sx * (Wi / 2), y, dz + z] as Vec3), { on: id, len: 30, dia: 8 }));
  const plinthDowels = (sx: number) => fx("dowel", [sx, 0, 0], [PL / 2 - 12, PL / 2 + 12].map((y) => [sx * (Wi / 2), y, zPl] as Vec3), { on: "pl", len: 30, dia: 8 });
  const screws = (sx: number): CustomFix =>
    fx("screw", [-sx, 0, 0], boards.flatMap(([, y]) => [-zs + 30, zs - 30].map((z) => [sx * (W / 2), y, dz + z] as Vec3)), { on: sx < 0 ? "L" : "R", len: 50, dia: 7, name: "Long screw" });
  const pins = (sx: number): CustomFix =>
    fx("pin", [sx, 0, 0], shelfYs.flatMap((y) => [-1, 1].map((sz) => [sx * (Wi / 2), y - T / 2 - 3, D / 2 - sd / 2 - 4 + sz * (sd / 2 - 40)] as Vec3)), { on: sx < 0 ? "L" : "R", dia: 5, len: 16 });
  const bx = [-1, 1].map((sx) => sx * (Wi / 2 - 60));
  const zb = -D / 2 + 30;
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the top, fixed shelf and bottom",
      detail: "Two in each end of every panel. Then stand the side on its long edge on a rug and push the three panels onto it, the unfinished edges facing down.",
      add: ["L", "top", "fix", "bot"],
      fix: [...dowels(-1, boards), ...dowels(1, boards)],
      tools: ["hammer"],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Screw the side to the panels", detail: "Two long screws through the side into each panel, with the Allen key. Turn them until they're snug.", fix: [screws(-1)], tools: ["allen"] },
    {
      title: "Fit the plinth",
      detail: "Two dowels in each end, then push it into the side at the bottom, under the bottom panel at the front.",
      add: ["pl"],
      fix: [plinthDowels(-1), plinthDowels(1)],
      tools: ["hammer"],
    },
    { title: "Put the other side on and screw it", detail: "Line it up on all the dowels, press it home, then the same six long screws.", add: ["R"], fix: [screws(1)], tools: ["allen"] },
    {
      title: "Mark the fixed shelf on the back edges",
      detail: "A pencil mark on the back edge of each side at the middle of the fixed shelf, so you know where to nail across it.",
      tools: ["pencil"],
    },
    {
      title: "Nail the back panel on",
      detail: "Unfold it over the back, smooth side in, flush with the outer edges. Nail the corners first, check it's square, then along the edges and across the fixed shelf.",
      add: ["back"],
      fix: [{ kind: "nail", count: 32, len: 20, dia: 1.6, to: ["back"] }],
      from: { back: [0, 0, -300] },
      tools: ["hammer", "pencil"],
      check: "square",
    },
    {
      title: "Stand it up and screw the wall brackets on top",
      detail: "Lift it upright together. One bracket at each end of the top, at the back, a washer under the screw.",
      pose: "+y",
      people: 2,
      warnings: ["two"],
      fix: [
        fx("angle", [0, -1, 0], bx.map((x) => [x, H + 30, -D / 2 + 2] as Vec3), { on: "top", name: "Wall bracket", len: 60, dia: 30 }),
        fx("washer", [0, -1, 0], bx.map((x) => [x, H + 2, zb] as Vec3), { len: 1.5, dia: 16 }),
        fx("screw", [0, -1, 0], bx.map((x) => [x, H + 3, zb] as Vec3), { on: "top", len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw it to the wall",
      detail: "Through the slot in each bracket, a washer under each screw. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", [0, 0, -1], bx.map((x) => [x, H + 40, -D / 2 - 40] as Vec3), { len: 35, dia: 8 }),
        fx("washer", [0, 0, -1], bx.map((x) => [x, H + 40, -D / 2] as Vec3), { len: 1.5, dia: 16 }),
        fx("screw", [0, 0, -1], bx.map((x) => [x, H + 40, -D / 2 - 4] as Vec3), { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Put the shelf pins and shelves in", detail: "Four pins at the same height for each shelf, then lay the shelf on them.", add: shelfYs.map((_, i) => `S${i}`), fix: [pins(-1), pins(1)] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["GERSBY"],
  recipe(s) {
    if (/gersby-bookcase/.test(s.slug ?? "")) return bookcase(s);
    return null;
  },
};
export default family;
