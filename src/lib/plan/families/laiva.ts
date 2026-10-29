import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/*
 * LAIVA bookcase, read from its manual. Each of the four uprights comes in two halves, joined end to end with a cam
 * bolt, two dowels and a cam lock. Two end blocks on dowels join a front and a back upright into a side frame. The
 * bookcase is built lying on its front: the five boards go in between the side frames, two screws at each end,
 * the two hardboard backs slide into the grooves and are nailed to the boards, and two brackets fix it to the wall.
 * IKEA's sizes: 62 wide, 24 deep, 165 high.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function recipe(s: ProductSpec): CustomParams {
  const W = 620, H = 1650, D = 240;
  const TF = 15, UD = 40; // side frames' thickness, the uprights' depth
  const xf = W / 2 - TF / 2, xi = W / 2 - TF, zu = D / 2 - UD / 2;
  const mid = H / 2; // where each upright's halves meet
  const parts: CustomPart[] = [];
  const up = (id: string, g: number, gz: number) => parts.push({ id, name: "Upright", size: [TF, H, UD], pos: [g * xf, H / 2, gz * zu], material: "wood" });
  const block = (id: string, g: number, y: number) => parts.push({ id, name: "End block", size: [TF, 40, D - 2 * UD], pos: [g * xf, y, 0], material: "wood" });
  up("UL0", -1, -1), up("UL1", -1, 1), up("UR0", 1, -1), up("UR1", 1, 1);
  block("BL0", -1, 20), block("BL1", -1, H - 20), block("BR0", 1, 20), block("BR1", 1, H - 20);
  const boardY = [90, 440, 790, 1140, H - 90];
  const bz0 = -D / 2 + 8, bz1 = D / 2 - 12; // boards stop at the back panels' grooves
  boardY.forEach((y, i) => parts.push({ id: `S${i}`, name: i === 0 || i === 4 ? "End board" : "Shelf", size: [2 * xi, 18, bz1 - bz0], pos: [0, y, (bz0 + bz1) / 2], material: "wood" }));
  const zb = -D / 2 + 6; // the back panels, in grooves in the back uprights
  parts.push(
    { id: "K0", name: "Back panel", size: [2 * xi + 8, mid - 40, 3], pos: [0, (40 + mid) / 2, zb], material: "fiber" },
    { id: "K1", name: "Back panel", size: [2 * xi + 8, H - 40 - mid, 3], pos: [0, (mid + H - 40) / 2, zb], material: "fiber" },
  );
  const ups = ["UL0", "UL1", "UR0", "UR1"];
  const upX = (id: string) => (id[1] === "L" ? -xf : xf), upZ = (id: string) => (id[2] === "0" ? -zu : zu);
  const joint = (dy: number, o: Partial<CustomFix>, dir: Vec3, dz = 0) => ups.map((id) => fx(o.kind!, [[upX(id), mid + dy, upZ(id) + dz]], dir, { ...o, on: id }));
  const blockDowels = (g: number) =>
    [`B${g < 0 ? "L" : "R"}0`, `B${g < 0 ? "L" : "R"}1`].flatMap((id, k) =>
      [-1, 1].map((gz) => fx("dowel", [-8, 8].map((dy): Vec3 => [g * xf, (k ? H - 20 : 20) + dy, gz * (D / 2 - UD)]), [0, 0, -gz], { on: id, len: 30, dia: 8 })),
    );
  const boardScrews = (g: number, ys: number[]) => fx("screw", ys.flatMap((y) => [-1, 1].map((gz): Vec3 => [g * (W / 2), y, gz * (zu - 4)])), [-g, 0, 0], { len: 50, dia: 5, name: "Connector screw" });
  const nails = (y: number, n: number, panel: string) => fx("nail", Array.from({ length: n }, (_, k): Vec3 => [-xi + 30 + (k * (2 * xi - 60)) / Math.max(1, n - 1), y, zb - 1.5]), [0, 0, 1], { len: 20, dia: 2, on: panel });
  const wx = [-160, 160];
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the upright halves",
      detail: "Each upright comes in two halves. Lay them on a rug and turn a cam bolt into the end of one half of each, by hand.",
      add: ups,
      fix: joint(0, { kind: "camScrew", len: 34, dia: 7 }, [0, -1, 0]),
      pose: "-z",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Tap two dowels in beside each bolt", detail: "Eight dowels in all, into the same ends.", fix: ups.flatMap((id) => [fx("dowel", [-12, 12].map((dz): Vec3 => [upX(id), mid, upZ(id) + dz]), [0, -1, 0], { on: id, len: 30, dia: 8 })]), tools: ["hammer"] },
    {
      title: "Join the halves and lock the cams",
      detail: "Push each pair together end to end on the floor, so it doesn't bend, then turn the cam lock clockwise until the joint pulls tight.",
      fix: joint(40, { kind: "cam", len: 13, dia: 15 }, [0, 0, 1], -UD / 2 + 2).map((f) => ({ ...f, at: f.at!.map((p): Vec3 => [p[0], p[1], p[2] < 0 ? -D / 2 : D / 2 - UD]) })),
      tools: ["screwdriver"],
    },
    {
      title: "Join the uprights with the end blocks",
      detail: "Two dowels in each end of the four blocks, then press a front and a back upright onto each pair of blocks to make the two side frames.",
      add: ["BL0", "BL1", "BR0", "BR1"],
      fix: [...blockDowels(-1), ...blockDowels(1)],
      tools: ["hammer"],
    },
    {
      title: "Screw the top board to one side frame",
      detail: "Its edge with the groove goes to the back. Two screws through the side frame into its end, turned with the Allen key.",
      add: ["S4"],
      fix: [boardScrews(-1, [H - 90])],
      from: { S4: [0, 0, -300] },
      tools: ["allen"],
    },
    {
      title: "Put the other boards in",
      detail: "The bottom board and the three shelves, grooves to the back. Two screws into each.",
      add: ["S0", "S1", "S2", "S3"],
      fix: [boardScrews(-1, boardY.slice(0, 4))],
      from: Object.fromEntries(["S0", "S1", "S2", "S3"].map((id) => [id, [0, 0, -300] as Vec3])),
      tools: ["allen"],
    },
    { title: "Screw the other side frame on", detail: "Ten screws, two into each board.", fix: [boardScrews(1, boardY)], tools: ["allen"] },
    { title: "Slide the back panels into the grooves", detail: "Smooth side out, the two halves meeting at the middle shelf.", add: ["K0", "K1"], from: { K0: [0, -900, 0], K1: [0, 900, 0] } },
    {
      title: "Nail the backs to the top and bottom",
      detail: "Check the bookcase is square first: both diagonals the same. Four nails into each end board.",
      fix: [nails(boardY[0], 4, "K0"), nails(boardY[4], 4, "K1")],
      tools: ["hammer", "tape"],
      check: "square",
    },
    { title: "Nail the backs to the shelves", detail: "Eleven nails along each of the two shelves shown.", fix: [nails(boardY[1], 11, "K0"), nails(boardY[3], 11, "K1")], tools: ["hammer"] },
    {
      title: "Stand it up and fix it to the wall",
      detail: "Screw the two brackets under the top board at the back, with a washer under each screw, then into the wall through the other washers. Wall screws and plugs aren't included: pick ones made for your wall.",
      pose: "+y",
      fix: [
        fx("angle", wx.map((x): Vec3 => [x, H - 99, -D / 2 + 8]), [0, 1, 0], { name: "Wall bracket", len: 60, dia: 30, on: "S4" }),
        fx("washer", wx.map((x): Vec3 => [x, H - 99, -D / 2 + 40]), [0, 1, 0], { on: "S4", len: 2, dia: 18 }),
        fx("screw", wx.map((x): Vec3 => [x, H - 100, -D / 2 + 40]), [0, 1, 0], { len: 16, dia: 4, on: "S4" }),
        fx("plug", wx.map((x): Vec3 => [x, H - 120, -D / 2 - 30]), [0, 0, -1], { len: 35, dia: 8 }),
        fx("washer", wx.map((x): Vec3 => [x, H - 120, -D / 2 + 1]), [0, 0, -1], { len: 2, dia: 18 }),
        fx("screw", wx.map((x): Vec3 => [x, H - 120, -D / 2 + 2]), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["screwdriver", "drill", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["LAIVA"],
  recipe(s) {
    return /^laiva-bookcase/.test(s.slug ?? "") ? recipe(s) : null;
  },
};
export default family;
