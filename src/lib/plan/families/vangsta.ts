import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VÄNGSTA, read from the 120/180 extendable table's manual (it is no longer sold in the UK or US). Built upside down
 * on its top: slide blocks go into the two side rails, the rails are bolted to the top, an end rail clips on and two
 * legs are bolted into its corner plates and tightened with the spanner. A brace drops in, two pairs of rails slide
 * into the side rails and are screwed at the end, the second end rail clips onto them and takes the other two legs.
 * Two people turn it over; the loose leaf gets its peg and socket plates. To extend it, pull the far end out and lay
 * the leaf in on the rails.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const UP: Vec3 = [0, 1, 0], DOWN: Vec3 = [0, -1, 0];

function table(s: ProductSpec): CustomParams {
  // IKEA: 120 (180 open) long, 75 wide, 73 high
  const W = Math.round(s.size.w * 10) || 1200, H = Math.round(s.size.h * 10) || 730, D = Math.round(s.size.d * 10) || 750;
  const TT = 20, yt = H - TT; // the top, and its underside
  const RH = 60, ry = yt - RH; // side rails and end rails under the top
  const L = 45, ly = ry - 10; // legs, square steel, up to the end rails' corner plates
  const xl = W / 2 - 30, zl = D / 2 - 30;
  const zr = D / 2 - 45; // side rails, 30 thick
  const zi = zr - 26, za = zi - 24; // the inner rails and the leaf supports beside them
  const xe = W / 2 - 65; // end rails
  const inX0 = -(W / 2 - 180), inX1 = W / 2 - 75; // the rails that slide out
  const g2 = [-1, 1];
  const endRail = (g: number): CustomPart => {
    const c: Vec3 = [g * (W / 2 - 40), ry + RH / 2 - 5, 0];
    const pieces: PartPiece[] = [
      { shape: "box", size: [30, RH, 2 * zr - 30], pos: [g * (xe - (W / 2 - 40)), 5, 0] },
      // the corner plates the legs bolt into
      ...g2.map((gz): PartPiece => ({ shape: "box", size: [50, 6, 50], pos: [g * (xl - (W / 2 - 40)), ly + 3 - c[1], gz * zl] })),
    ];
    return { id: g < 0 ? "EA" : "EB", name: "End rail", size: [80, RH + 10, D - 20], pos: c, pieces, material: "metal" };
  };
  const parts: CustomPart[] = [
    { id: "TP", name: "Table top", size: [W, TT, D], pos: [0, yt + TT / 2, 0], material: "board" },
    ...g2.map((g, i): CustomPart => ({ id: `OR${i}`, name: "Side rail", size: [W - 100, RH, 30], pos: [0, ry + RH / 2, g * zr], material: "metal" })),
    endRail(-1),
    ...g2.map((g, i): CustomPart => ({ id: `LA${i}`, name: "Leg", size: [L, ly, L], pos: [-xl, ly / 2, g * zl], material: "metal" })),
    { id: "BR", name: "Brace", size: [30, 30, 2 * zi - 30], pos: [-(W / 2 - 150), ry + 15, 0], material: "metal" },
    ...g2.map((g, i): CustomPart => ({ id: `IR${i}`, name: "Sliding rail", size: [inX1 - inX0, 30, 22], pos: [(inX0 + inX1) / 2, yt - 15, g * zi], material: "metal" })),
    ...g2.map((g, i): CustomPart => ({ id: `AR${i}`, name: "Leaf support", size: [inX1 - inX0, 30, 22], pos: [(inX0 + inX1) / 2, yt - 15, g * za], material: "metal" })),
    endRail(1),
    ...g2.map((g, i): CustomPart => ({ id: `LB${i}`, name: "Leg", size: [L, ly, L], pos: [xl, ly / 2, g * zl], material: "metal" })),
    // the leaf is stored apart: here it lies on the top until it's needed
    { id: "LF", name: "Leaf", size: [W / 2, TT, D], pos: [0, H + 10 + TT / 2, 0], material: "board" },
  ];
  const sideBolts = g2.map((g, i) => fx("bolt", [-450, -150, 150, 450].map((x): Vec3 => [x * (W / 1200), ry, g * zr]), UP, { len: 70, dia: 6, on: `OR${i}` }));
  const legBolts = (sx: number, ids: string[]): CustomFix[] => [
    ...g2.map((g, i) => fx("washer", [[sx * xl, ly + 6, g * zl]], DOWN, { name: "Lock washer", len: 2, dia: 14, on: ids[i] })),
    ...g2.map((g, i) => fx("bolt", [[sx * xl, ly + 7, g * zl]], DOWN, { name: "Hex bolt", len: 30, dia: 8, on: ids[i] })),
  ];
  const clips = (g: number) => [fx("clip", g2.map((gz): Vec3 => [g * xe, ry + RH / 2, gz * (zr - 25)]), [g, 0, 0], { name: "Rail clip", len: 30, dia: 20, on: g < 0 ? "EA" : "EB" })];
  const endScrews = (z: number, ids: string[]) => g2.map((g, i) => fx("screw", [[inX0 + 15, yt - 30, g * z]], UP, { len: 10, dia: 6, on: ids[i] }));
  const lx0 = 0, lw = W / 2; // the leaf, as it lies on the top
  const plates = (edge: number, name: string): CustomFix[] => [
    fx("connector", g2.map((gz): Vec3 => [lx0 + edge * (lw / 2 - 30), H + 10, gz * (D / 2 - 120)]), DOWN, { name, len: 40, dia: 30, on: "LF" }),
    fx("screw", g2.flatMap((gz) => [-15, 15].map((dz): Vec3 => [lx0 + edge * (lw / 2 - 30), H + 4, gz * (D / 2 - 120) + dz])), UP, { len: 12, dia: 4, on: "LF" }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Push the slide blocks into the side rails",
      detail: "Two in each rail, into the square holes, then turn them until they lock.",
      fix: g2.map((g, i) => fx("connector", [100, W / 2 - 80].map((x): Vec3 => [x, ry + 30, g * zr]), DOWN, { name: "Slide block", len: 40, dia: 24, on: `OR${i}` })),
      pose: "-y",
      wait: ["OR0", "OR1"],
      from: { OR0: [0, 0, -400], OR1: [0, 0, 400] },
    },
    {
      title: "Lay the side rails on the top",
      detail: "Lay the top face down on a rug and put a rail along each long edge, over the holes.",
      add: ["TP", "OR0", "OR1"],
      from: { OR0: [0, -150, 0], OR1: [0, -150, 0] },
      warnings: ["floor"],
    },
    { title: "Bolt the side rails to the top", detail: "Four long bolts through each rail into the top. Tighten them with the Allen key.", fix: sideBolts, tools: ["allen"] },
    { title: "Clip the end rail", detail: "Push a clip into each end of one end rail.", fix: clips(-1), wait: ["EA"], from: { EA: [-400, 0, 0] } },
    { title: "Click the end rail onto the side rails", detail: "At the end with the slide blocks furthest in, until it clicks.", add: ["EA"], from: { EA: [0, -120, 0] } },
    { title: "Bolt two legs into the corner plates", detail: "A lock washer on each bolt, then turn it into the leg by hand.", add: ["LA0", "LA1"], fix: legBolts(-1, ["LA0", "LA1"]), from: { LA0: [0, -300, 0], LA1: [0, -300, 0] } },
    { title: "Tighten the leg bolts with the spanner", detail: "Check each leg stands straight up, not tilted, then tighten.", tools: ["wrench"] },
    { title: "Drop the brace in", detail: "Across the frame next to the end rail, its flat side against the top.", add: ["BR"], from: { BR: [0, -150, 0] } },
    { title: "Slide in the two sliding rails", detail: "From the open end, into the slide blocks, all the way to the end rail.", add: ["IR0", "IR1"], from: { IR0: [800, 0, 0], IR1: [800, 0, 0] } },
    { title: "Screw the sliding rails at the end", detail: "One screw through the end of each rail.", fix: endScrews(zi, ["IR0", "IR1"]), tools: ["allen"] },
    { title: "Slide in the leaf supports", detail: "The angled rails go in beside the sliding rails, hooks towards the open end.", add: ["AR0", "AR1"], from: { AR0: [800, 0, 0], AR1: [800, 0, 0] } },
    { title: "Screw the leaf supports at the end", detail: "One screw through the end of each.", fix: endScrews(za, ["AR0", "AR1"]), tools: ["allen"] },
    { title: "Clip the second end rail", detail: "Two clips again, one in each end.", fix: clips(1), wait: ["EB"], from: { EB: [400, 0, 0] } },
    { title: "Click it onto the sliding rails", detail: "At the open end, until it clicks.", add: ["EB"], from: { EB: [0, -120, 0] } },
    { title: "Bolt on the last two legs", detail: "A lock washer on each bolt, turned in by hand.", add: ["LB0", "LB1"], fix: legBolts(1, ["LB0", "LB1"]), from: { LB0: [0, -300, 0], LB1: [0, -300, 0] } },
    { title: "Tighten them with the spanner", detail: "Again with the legs standing straight.", tools: ["wrench"] },
    { title: "Turn the table over", detail: "Lift it together by the frame and stand it on its legs.", pose: "+y", people: 2, kind: "standup" },
    { title: "Screw the peg plates onto the leaf", detail: "Lay the leaf face down. Two plates along one edge, two screws each.", fix: plates(-1, "Leaf peg plate"), tools: ["allen"], wait: ["LF"], from: { LF: [0, -500, 900] } },
    { title: "Screw the socket plates on the other edge", detail: "The other two plates, two screws each.", fix: plates(1, "Leaf socket plate"), tools: ["allen"] },
    { title: "Lay the leaf on the table", detail: "Keep it flat until you need it, so it doesn't warp.", add: ["LF"], from: { LF: [0, 0, 300] } },
    { title: "To make it longer, pull the end out", detail: "Hold the end with the loose legs and pull until the rails stop." },
    { title: "Lay the leaf in and push it closed", detail: "Plates down, pegs towards the top, on the leaf supports. Push the end back until the plates lock." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["VÄNGSTA", "VANGSTA"],
  recipe(s) {
    if (/extendable table/i.test(s.variant)) return table(s);
    return null;
  },
};
export default family;
