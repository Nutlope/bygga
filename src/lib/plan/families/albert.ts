import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * ALBERT, read from the shelving unit's manual (solid softwood, everything screwed with one kind of wood screw).
 * Each side is a ladder: two uprights with four shelf supports screwed between them, end on. The unit is built
 * lying on its back: one side stands on its edge, three slats a shelf go onto the supports' ledges and are screwed
 * through the support into their ends, the other side goes on the same way, then it's stood up and the front and
 * back slats are screwed through the uprights too. One angle bracket fixes it to the wall.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const SCREW = { len: 40, dia: 4 };
const UX = 45, UZ = 22; // uprights: their wide face to the front
const CX = 22, CY = 45; // shelf supports, between the uprights
const ST = 18, SN = 3; // slats, three a shelf

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 64 wide, 28 deep, 159 high
  const W = Math.round(s.size.w * 10) || 640, D = Math.round(s.size.d * 10) || 280, H = Math.round(s.size.h * 10) || 1590;
  const xs = [-1, 1];
  const ux = W / 2 - UX / 2, uz = D / 2 - UZ / 2, cx = W / 2 - CX / 2;
  const inner = D - 2 * UZ; // between the uprights
  const sw = (inner - (SN - 1) * 10) / SN; // slat width
  const sz = Array.from({ length: SN }, (_, i) => -inner / 2 + sw / 2 + i * (sw + 10));
  const levels = [0, 1, 2, 3].map((i) => 90 + (i * (H - 20 - 90)) / 3); // top of each shelf
  const side = (g: number) => (g < 0 ? "L" : "R");
  const parts: CustomPart[] = [];
  for (const g of xs) {
    for (const zg of [-1, 1]) parts.push({ id: `${side(g)}U${zg < 0 ? "b" : "f"}`, name: "Upright", size: [UX, H, UZ], pos: [g * ux, H / 2, zg * uz], material: "wood" });
    levels.forEach((y, i) => parts.push({ id: `${side(g)}C${i}`, name: "Shelf support", size: [CX, CY, inner], pos: [g * cx, y - CY / 2, 0], material: "wood" }));
  }
  levels.forEach((y, i) => sz.forEach((z, k) => parts.push({ id: `S${i}${k}`, name: "Slat", size: [W - 2 * CX, ST, sw], pos: [0, y - ST / 2, z], material: "wood" })));
  const ids = (g: number) => [`${side(g)}Ub`, `${side(g)}Uf`, ...levels.map((_, i) => `${side(g)}C${i}`)];
  const slats = levels.flatMap((_, i) => sz.map((_, k) => `S${i}${k}`));
  // a screw through each upright, end on into each support
  const ladderScrews = (g: number) => [-1, 1].map((zg) => fx("screw", levels.map((y): Vec3 => [g * cx, y - CY / 2, zg * D / 2]), [0, 0, -zg], { ...SCREW, on: `${side(g)}U${zg < 0 ? "b" : "f"}` }));
  // a screw through the support into the end of each slat
  const slatScrews = (g: number) => levels.map((y, i) => fx("screw", sz.map((z): Vec3 => [g * W / 2, y - ST / 2, z]), [-g, 0, 0], { ...SCREW, on: `${side(g)}C${i}` }));
  const xTop = W / 2 - UX + 12;
  const steps: CustomStep[] = [
    {
      title: "Screw the shelf supports between two uprights",
      detail: "Two uprights on their edges with the four supports between them, ledges all facing the same way. One screw through the upright into each end.",
      add: ids(-1),
      fix: ladderScrews(-1),
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Make the second side the same way",
      detail: "Its ledges face the other way, so the two sides mirror each other.",
      fix: ladderScrews(1),
      tools: ["screwdriver"],
      wait: ids(1),
      from: Object.fromEntries(ids(1).map((id) => [id, [250, 0, 0] as Vec3])),
    },
    {
      title: "Screw the slats onto the first side",
      detail: "Three slats to a shelf, their ends on the ledges of the first side, then a screw through the support into each slat.",
      add: slats,
      fix: slatScrews(-1),
      tools: ["screwdriver"],
    },
    {
      title: "Put the second side on and screw it",
      detail: "Fit the free slat ends onto its ledges and screw through each support into the slats.",
      add: ids(1),
      fix: slatScrews(1),
      tools: ["screwdriver"],
      from: Object.fromEntries(ids(1).map((id) => [id, [250, 0, 0] as Vec3])),
    },
    {
      title: "Stand it up and screw the front and back slats",
      detail: "Through each upright into the slat behind it, at every shelf.",
      fix: xs.flatMap((g) => [-1, 1].map((zg) => fx("screw", levels.map((y): Vec3 => [g * xTop, y - ST / 2, zg * D / 2]), [0, 0, -zg], { ...SCREW, on: `${side(g)}U${zg < 0 ? "b" : "f"}` }))),
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Fix it to the wall",
      detail: "Screw the bracket onto the top back slat with the washer, then to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("angle", [[0, H - 20, -D / 2 + 30]], [0, -1, 0], { name: "Wall bracket", twist: 0 }),
        fx("washer", [[0, H - 18, -D / 2 + 40]], [0, -1, 0], { len: 1.5, dia: 12 }),
        fx("screw", [[0, H - 17, -D / 2 + 40]], [0, -1, 0], { len: 16, dia: 4, on: `S${levels.length - 1}0` }),
        fx("plug", [[0, H - 40, -D / 2 - 40]], [0, 0, -1]),
        fx("screw", [[0, H - 40, -D / 2 - 4]], [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "pencil", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["ALBERT"], recipe };
export default family;
