import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * AGAM junior chair, read from its manual. The backrest comes in one piece (crest rail, two posts and two spindles):
 * it is pushed into the seat and pressed right down, then held from below with four screws. The base is screwed
 * together from its round rods: the two front legs with the footrest between them, the two side rails with the
 * middle rail between them, then the side rails into the front legs and a back leg onto each. The legs are tapped
 * into the seat with a hammer and four more screws hold them. Every screw takes the Allen key, and the twelve in the
 * base are tightened again with the chair standing.
 */

const fx = (at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind: "screw", count: at.length, at, dir, len: 40, dia: 6, ...o });
const G = [-1, 1] as const;
const r = (n: number) => Math.round(n);

const LEG = 32, ROD = 26;
const ST = 25; // seat thickness

function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const yS = 630, yB = yS - ST; // seat top and underside
  const SW = 350, SD = 340, zS = 20; // seat
  // legs: tops under the seat, feet splayed out to the footprint
  const xt = 120, xf = W / 2 - LEG / 2;
  const zt = { f: zS + 115, b: zS - 115 }, zf = { f: D / 2 - LEG / 2, b: -D / 2 + LEG / 2 };
  const legAt = (sx: number, end: "f" | "b", y: number): Vec3 => {
    const k = y / yB;
    return [sx * (xf + (xt - xf) * k), y, zf[end] + (zt[end] - zf[end]) * k];
  };
  const leg = (id: string, sx: number, end: "f" | "b"): CustomPart => {
    const top = legAt(sx, end, yB), foot = legAt(sx, end, 0);
    const d: Vec3 = [top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]];
    const len = Math.hypot(...d);
    const rot: Vec3 = [Math.atan2(d[2], d[1]), 0, Math.asin(-d[0] / len)];
    return { id, name: end === "f" ? "Front leg" : "Back leg", shape: "cyl", size: [LEG, r(len), LEG], pos: [r((top[0] + foot[0]) / 2), r(yB / 2), r((top[2] + foot[2]) / 2)], rot, material: "wood" };
  };

  // the backrest: two posts and two spindles from the seat up to the crest rail, leaning back a little
  const zBk = zS - SD / 2 + 30, lean = 30, yC = H - 35;
  const ang = Math.atan2(lean, yC - yS);
  const rods = [-150, -50, 50, 150];
  const upLen = Math.hypot(yC - 35 - yS, lean);
  const backAbs: PartPiece[] = [
    ...rods.map((x): PartPiece => ({ shape: "cyl", size: [Math.abs(x) > 100 ? 24 : 18, r(upLen + 20), Math.abs(x) > 100 ? 24 : 18], pos: [x, r((yS + yC - 35) / 2), r(zBk - lean / 2)], rot: [-ang, 0, 0] })),
    { shape: "box", size: [370, 70, 22], pos: [0, yC, zBk - lean - 6] },
  ];
  const bLo: Vec3 = [-185, yS - 10, zBk - lean - 20], bHi: Vec3 = [185, H, zBk + 12];
  const bc: Vec3 = [(bLo[0] + bHi[0]) / 2, (bLo[1] + bHi[1]) / 2, (bLo[2] + bHi[2]) / 2];
  const back: CustomPart = {
    id: "BACK",
    name: "Backrest",
    size: [bHi[0] - bLo[0], bHi[1] - bLo[1], bHi[2] - bLo[2]],
    pos: bc,
    material: "wood",
    pieces: backAbs.map((p) => ({ ...p, pos: [p.pos[0] - bc[0], p.pos[1] - bc[1], p.pos[2] - bc[2]] as Vec3 })),
  };

  // the rods between the legs
  const yF = 300, yH = 250;
  const xF = legAt(1, "f", yF)[0], xH = legAt(1, "f", yH)[0];
  const zHf = legAt(1, "f", yH)[2], zHb = legAt(1, "b", yH)[2];
  const zMid = (zHf + zHb) / 2;
  const parts: CustomPart[] = [
    { id: "SEAT", name: "Seat", size: [SW, ST, SD], pos: [0, yS - ST / 2, zS], material: "wood", pieces: [{ shape: "slab", size: [SW, ST, SD], pos: [0, 0, 0], outline: [[-SW / 2, -SD / 2], [SW / 2, -SD / 2], [SW / 2, SD / 2], [-SW / 2, SD / 2]], round: 50 }] },
    back,
    leg("FL1", -1, "f"),
    leg("FL2", 1, "f"),
    { id: "FOOT", name: "Footrest", shape: "cyl", size: [r(2 * xF - LEG + 10), ROD, ROD], pos: [0, yF, r(legAt(1, "f", yF)[2])], material: "wood" },
    ...G.map((sx, i): CustomPart => ({ id: `SR${i + 1}`, name: "Side rail", shape: "cyl", size: [ROD, ROD, r(zHf - zHb - LEG + 10)], pos: [r(sx * xH), yH, r(zMid)], material: "wood" })),
    { id: "MID", name: "Middle rail", shape: "cyl", size: [r(2 * xH - ROD + 10), ROD, ROD], pos: [0, yH, r(zMid)], material: "wood" },
    leg("BL1", -1, "b"),
    leg("BL2", 1, "b"),
  ];

  const backScrews = fx(rods.map((x): Vec3 => [x, yB, r(zBk)]), [0, 1, 0], { on: "SEAT", mate: "BACK" });
  const footScrews = G.map((sx, i) => fx([[r(sx * (xF + LEG / 2)), yF, r(legAt(1, "f", yF)[2])]], [-sx, 0, 0], { on: `FL${i + 1}`, mate: "FOOT" }));
  const midScrews = G.map((sx, i) => fx([[r(sx * (xH + ROD / 2)), yH, r(zMid)]], [-sx, 0, 0], { on: `SR${i + 1}`, mate: "MID" }));
  const frontScrews = G.map((sx, i) => fx([[r(sx * xH), yH, r(zHf + LEG / 2)]], [0, 0, -1], { on: `FL${i + 1}`, mate: `SR${i + 1}` }));
  const backLegScrew = (i: number) => fx([[r(G[i] * xH), yH, r(zHb - LEG / 2)]], [0, 0, 1], { on: `BL${i + 1}`, mate: `SR${i + 1}` });
  // one screw at each leg's top, angled up through the leg into the seat
  const legScrews = (["f", "b"] as const).flatMap((end) =>
    G.map((sx) => {
      const p = legAt(sx, end, yB - 22);
      const inward = end === "f" ? -1 : 1;
      const d = [sx * 0.35, 1, -inward * 0.35];
      const n = Math.hypot(...d);
      return fx([[r(p[0] - sx * LEG * 0.45), r(p[1]), r(p[2] + inward * LEG * 0.45)]], [d[0] / n, d[1] / n, d[2] / n], { on: `${end === "f" ? "FL" : "BL"}${sx < 0 ? 1 : 2}`, mate: "SEAT" });
    }),
  );

  return {
    parts,
    steps: [
      {
        title: "Push the backrest into the seat",
        detail: "Seat on a rug, the right way up. Line up the posts and spindles with their holes and push them in.",
        add: ["SEAT", "BACK"],
        from: { BACK: [0, 250, 0] },
        warnings: ["floor"],
      },
      {
        title: "Press the backrest right down",
        detail: "Push down hard on the crest rail with both hands, until there is no gap left between the posts and the seat.",
        warnings: ["hand"],
      },
      {
        title: "Turn the seat over and screw the backrest on",
        detail: "Lay it upside down on the rug. One screw up into each post and spindle.",
        fix: [backScrews],
        pose: "-y",
        tools: ["allen"],
      },
      {
        title: "Screw the footrest between the front legs",
        detail: "Pick the two shortest legs with one hole each side. One screw through each leg into the footrest.",
        add: ["FL1", "FL2", "FOOT"],
        fix: footScrews,
        tools: ["allen"],
      },
      {
        title: "Screw the middle rail between the side rails",
        detail: "One screw through each side rail into an end of the middle rail.",
        add: ["SR1", "SR2", "MID"],
        fix: midScrews,
        tools: ["allen"],
      },
      {
        title: "Screw the side rails into the front legs",
        detail: "One screw through each front leg into the end of a side rail.",
        fix: frontScrews,
        tools: ["allen"],
      },
      {
        title: "Add a back leg",
        detail: "Its top goes into the hole in the seat, then one screw through the leg into the side rail.",
        add: ["BL1"],
        fix: [backLegScrew(0)],
        tools: ["allen"],
      },
      {
        title: "Add the other back leg",
        detail: "The same way, one screw.",
        add: ["BL2"],
        fix: [backLegScrew(1)],
        tools: ["allen"],
      },
      {
        title: "Tap the legs home and screw them to the seat",
        detail: "Knock each leg top fully into the seat with the hammer, the notch facing the screw hole. Then one screw into each leg.",
        fix: legScrews,
        tools: ["hammer", "allen"],
      },
      {
        title: "Stand it up and tighten every screw again",
        detail: "Press down on the seat and go round the twelve screws in the base once more with the Allen key.",
        pose: "+y",
        tools: ["allen"],
      },
    ],
  };
}

const family: Family = {
  names: ["AGAM"],
  recipe: (s) => (/chair/i.test(`${s.variant} ${s.slug ?? ""}`) ? chair(s) : null),
};
export default family;
