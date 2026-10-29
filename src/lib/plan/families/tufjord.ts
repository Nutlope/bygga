import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TUFJORD, read from the bed frame's manual and LÖNSET's. The padded side rails lie upside down while a corner
 * bracket is bolted to each end and a steel leg to each bracket. Stood up, two people bolt the plain head rail (on
 * dowels) and the padded foot rail between them, sixteen countersunk bolts in all. The headboard is two centre
 * panels and two curved wings, joined by hook plates: the centre drops onto the head rail, the wings hook on, and
 * long bolts through the head rail hold it. Inside go two slat rails with stops, two centre plates and the centre
 * beam in two halves, then the two LÖNSET slatted bases, each built from strips, cross rails and slats.
 */

type K = CustomFix["kind"];
const fx = (kind: K, at: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, mate, ...o });

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 174 wide, 223 long, headboard 109 and footboard 38 high, 20 free under; mattress 150 x 200
  const MW = (s.bed?.mattressW ?? 150) * 10, ML = (s.bed?.mattressL ?? 200) * 10;
  const W = MW + 240, H = 1090;
  const rw = (W - MW) / 2, xr = MW / 2 + rw / 2; // side rails
  const y0 = 200, y1 = 380, yM = (y0 + y1) / 2;
  const hbT = 100, hrT = 25, frT = 105;
  const zBack = -(ML + hbT + hrT + frT) / 2;
  const zHB = zBack + hbT, zIn0 = zHB + hrT, zIn1 = zIn0 + ML, zEnd = zIn1 + frT;
  const half = MW / 2;
  const wingW = rw, wingD = 230;
  const ySS = 300, yBase = ySS + 15;
  const legs: CustomPart[] = [-1, 1].flatMap((sx) =>
    [zIn0 + 90, zIn1 - 60].map((z, i): CustomPart => ({ id: `LG${sx < 0 ? "L" : "R"}${i}`, name: "Leg", size: [24, y0, 24], pos: [sx * (half + 30), y0 / 2, z], rot: [0, 0, sx * 0.08], shape: "cyl", material: "metal" })),
  );
  // a LÖNSET half: two slat strips, three cross rails and the slats across
  const base = (sx: number): CustomPart => {
    const bw = half - 6, n = 26;
    const pieces: PartPiece[] = [
      // the strips lie on the cross rails, the slats on the strips
      ...[-1, 1].map((k) => ({ shape: "box" as const, size: [30, 30, ML - 20] as Vec3, pos: [k * (bw / 2 - 60), 4, 0] as Vec3 })),
      ...[-1, 0, 1].map((k) => ({ shape: "box" as const, size: [bw - 20, 20, 50] as Vec3, pos: [0, -21, k * (ML / 2 - 60)] as Vec3 })),
      ...Array.from({ length: n }, (_, i) => ({ shape: "box" as const, size: [bw, 8, 55] as Vec3, pos: [0, 23, -ML / 2 + 40 + ((ML - 80) * i) / (n - 1)] as Vec3 })),
    ];
    return { id: sx < 0 ? "LB0" : "LB1", name: "Slatted base", size: [bw, 62, ML - 20], pos: [sx * (half / 2), yBase + 31, (zIn0 + zIn1) / 2], material: "wood", pieces };
  };
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "SRL" : "SRR", name: "Side rail", size: [rw, y1 - y0, zEnd - zHB], pos: [sx * xr, yM, (zHB + zEnd) / 2], material: "soft" })),
    ...legs,
    { id: "HR", name: "Head rail", size: [MW, 160, hrT], pos: [0, yM, zHB + hrT / 2] },
    { id: "FR", name: "Foot rail", size: [MW, y1 - y0, frT], pos: [0, yM, zIn1 + frT / 2], material: "soft" },
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "HL" : "HRR", name: "Headboard panel", size: [half, H - y0, hbT], pos: [(sx * half) / 2, (H + y0) / 2, zBack + hbT / 2], material: "soft" })),
    ...[-1, 1].map((sx): CustomPart => ({
      id: sx < 0 ? "WL" : "WR",
      name: "Headboard wing",
      size: [wingW, H - y1, wingD],
      pos: [sx * xr, (H + y1) / 2, zBack + wingD / 2],
      material: "soft",
      pieces: [
        { shape: "box", size: [wingW, H - y1, hbT], pos: [0, 0, -wingD / 2 + hbT / 2] },
        { shape: "box", size: [wingW - 30, H - y1 - 60, wingD - hbT], pos: [sx * 15, -30, hbT / 2] },
      ],
    })),
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "SSL" : "SSR", name: "Slat rail", size: [30, 30, ML], pos: [sx * (half - 15), ySS, (zIn0 + zIn1) / 2], material: "metal" })),
    ...[zIn0 + 3, zIn1 - 3].map((z, i): CustomPart => ({ id: i ? "PF" : "PH", name: "Centre plate", size: [140, 60, 6], pos: [0, ySS, z], material: "metal" })),
    ...[0, 1].map((i): CustomPart => ({ id: `CB${i}`, name: "Centre beam half", size: [40, 30, ML / 2 - 6], pos: [0, ySS, i ? zIn0 + (3 * ML) / 4 : zIn0 + ML / 4], material: "metal" })),
    base(-1),
    base(1),
    { id: "MAT", name: "Your mattress", size: [MW, 200, ML], pos: [0, yBase + 58 + 100, (zIn0 + zIn1) / 2], material: "soft", extra: true },
  ];
  const yB = yM; // bracket bolts sit halfway up the rails
  const side = (sx: number) => (sx < 0 ? "SRL" : "SRR");
  const railBolts = (z: number, mate: string) => [-1, 1].map((sx) => fx("bolt", [-25, 25].map((y): Vec3 => [sx * half, yB + y, z + (z < 0 ? 1 : -1) * 2]), [-sx, 0, 0], side(sx), mate, { name: "Countersunk bolt", len: 20, dia: 6 }));
  const zMid = (zIn0 + zIn1) / 2;
  const steps: CustomStep[] = [
    {
      title: "Bolt a corner bracket to each end of the side rails",
      detail: "Lay both rails upside down on a rug. Two countersunk bolts in each bracket, heads sunk flat.",
      add: ["SRL", "SRR"],
      fix: [
        ...[-1, 1].map((sx) => fx("angle", [zIn0, zIn1].map((z): Vec3 => [sx * half, yB, z]), [0, 1, 0], side(sx), undefined, { name: "Corner bracket" })),
        ...[-1, 1].map((sx) => fx("bolt", [zIn0, zIn1].flatMap((z) => [-30, 30].map((d): Vec3 => [sx * (half + 10), y0, z + (z < 0 ? 1 : -1) * 40 + d])), [0, 1, 0], side(sx), undefined, { name: "Countersunk bolt", len: 20, dia: 6 })),
      ],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt a leg to each bracket",
      detail: "One bolt through the leg's plate into the bracket. Keep the feet pointing out from the corners.",
      add: legs.map((l) => l.id),
      fix: legs.map((l) => fx("bolt", [[l.pos[0], y0 - 10, l.pos[2]]], [0, 1, 0], l.id, undefined, { len: 16, dia: 6 })),
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the head rail",
      detail: "Turn the side rails onto their legs. Two dowels in each end of the head rail.",
      fix: [-1, 1].map((sx) => fx("dowel", [-65, 65].map((y): Vec3 => [sx * half, yM + y, zHB + hrT / 2]), [sx, 0, 0], "HR", undefined, { len: 30, dia: 8 })),
      wait: ["HR"],
      pose: "+y",
    },
    {
      title: "Bolt the head rail to the left side rail",
      detail: "One of you holds the rails while the other pushes the dowels home and puts two bolts through the bracket.",
      add: ["HR"],
      fix: [railBolts(zIn0 - hrT / 2, "HR")[0]],
      people: 2,
      tools: ["allen"],
    },
    { title: "Bolt the right side rail on", detail: "The same at the other end of the head rail: dowels in, two bolts.", fix: [railBolts(zIn0 - hrT / 2, "HR")[1]], people: 2, tools: ["allen"] },
    { title: "Bolt on the foot rail", detail: "Two bolts through each bracket into the padded foot rail.", add: ["FR"], fix: railBolts(zIn1 + 20, "FR"), people: 2, tools: ["allen"] },
    { title: "Tighten all sixteen bolts", detail: "Use the long Allen key with the handle, so every head sits flat in its bracket.", tools: ["allen"], check: "square" },
    {
      title: "Screw hook plates onto the headboard parts",
      detail: "Three on the inner edge of each wing and two on one centre panel, one screw each.",
      fix: [
        ...[-1, 1].flatMap((sx) => {
          const at = [500, 700, 900].map((y): Vec3 => [sx * (half + 20), y, zBack]);
          const sc = at.map((p): Vec3 => [p[0], p[1] + 25, p[2]]);
          return [fx("hook", at, [0, 0, 1], sx < 0 ? "WL" : "WR", undefined, { name: "Hook plate" }), fx("screw", sc, [0, 0, 1], sx < 0 ? "WL" : "WR", undefined, { len: 16, dia: 4 })];
        }),
        fx("hook", [450, 850].map((y): Vec3 => [-20, y, zBack]), [0, 0, 1], "HL", undefined, { name: "Hook plate" }),
        fx("screw", [475, 875].map((y): Vec3 => [-20, y, zBack]), [0, 0, 1], "HL", undefined, { len: 16, dia: 4 }),
      ],
      wait: ["HL", "HRR", "WL", "WR"],
      tools: ["screwdriver"],
    },
    {
      title: "Hook the centre panels together and stand them on the head rail",
      detail: "Slide one panel's hooks down into the other's slots, then lower both so the four posts drop into the holes behind the head rail.",
      add: ["HL", "HRR"],
      from: { HL: [0, 400, -200], HRR: [0, 400, -200] },
    },
    { title: "Hook on the left wing", detail: "Hold it against the centre panel and slide it down onto all three hooks.", add: ["WL"], from: { WL: [-300, 300, 0] } },
    { title: "Hook on the right wing", detail: "The same on the other side.", add: ["WR"], from: { WR: [300, 300, 0] } },
    {
      title: "Screw the headboard to the head rail",
      detail: "Two long screws with washers through the head rail into the headboard's posts.",
      fix: [
        fx("screw", [-300, 300].map((x): Vec3 => [x, yM, zIn0]), [0, 0, -1], "HR", "HL", { len: 90, dia: 6 }),
        fx("washer", [-300, 300].map((x): Vec3 => [x, yM, zIn0]), [0, 0, -1], "HR", undefined, { dia: 6 }),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the headboard's sides on",
      detail: "One of you holds the headboard upright. A bolt and washer through each end of the head rail.",
      fix: [
        fx("bolt", [-1, 1].map((sx): Vec3 => [sx * (half - 80), yM + 40, zIn0]), [0, 0, -1], "HR", undefined, { len: 70, dia: 6 }),
        fx("washer", [-1, 1].map((sx): Vec3 => [sx * (half - 80), yM + 40, zIn0]), [0, 0, -1], "HR", undefined, { dia: 6 }),
      ],
      tools: ["allen"],
    },
    {
      title: "Slide the connector onto the centre beam",
      detail: "Fit the two halves end to end and push the U-shaped connector over the joint.",
      fix: [fx("connector", [[0, ySS + 15, zMid]], [0, -1, 0], "CB0", "CB1")],
      wait: ["CB0", "CB1"],
      from: { CB0: [1100, 0, 0], CB1: [1100, 0, 0] },
    },
    {
      title: "Screw stops onto the slat rails",
      detail: "Four on each rail, one small screw each.",
      fix: [-1, 1].flatMap((sx) => {
        const at = [zIn0 + 30, zMid - 40, zMid + 40, zIn1 - 30].map((z): Vec3 => [sx * (half - 15), ySS + 15, z]);
        return [fx("clip", at, [0, -1, 0], sx < 0 ? "SSL" : "SSR", undefined, { name: "Stop" }), fx("screw", at.map((p): Vec3 => [p[0], p[1], p[2] + 25]), [0, -1, 0], sx < 0 ? "SSL" : "SSR", undefined, { len: 10, dia: 5 })];
      }),
      wait: ["SSL", "SSR"],
      from: { SSL: [-900, 0, 0], SSR: [900, 0, 0] },
      tools: ["screwdriver"],
    },
    {
      title: "Screw the slat rails inside the side rails",
      detail: "Eight screws along each rail, lined up with the bottom of the brackets.",
      add: ["SSL", "SSR"],
      fix: [-1, 1].map((sx) => fx("screw", Array.from({ length: 8 }, (_, i): Vec3 => [sx * (half - 30), ySS, zIn0 + 120 + ((ML - 240) * i) / 7]), [sx, 0, 0], sx < 0 ? "SSL" : "SSR", side(sx), { len: 16, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw a centre plate to the head and foot rails",
      detail: "In the middle of each, two screws, with the hook slot facing up.",
      add: ["PH", "PF"],
      fix: [zIn0, zIn1].map((z, i) => fx("screw", [-50, 50].map((x): Vec3 => [x, ySS, z + (i ? -6 : 6)]), [0, 0, i ? 1 : -1], i ? "PF" : "PH", i ? "FR" : "HR", { len: 16, dia: 4 })),
      tools: ["screwdriver"],
    },
    { title: "Hook the centre beam onto the head end", detail: "Lower its hooked end into the plate on the head rail.", add: ["CB0"] },
    { title: "Hook it onto the foot end", detail: "Lower the other end into the foot rail's plate.", add: ["CB1"] },
    { title: "Lock the beam's middle joint", detail: "Push the two halves together until the joint clicks and the beam runs dead straight." },
    {
      title: "Screw the beam down",
      detail: "Two screws through the connector and one at each end into the plates.",
      fix: [0, 1].map((i) => fx("screw", [[0, ySS + 15, i ? zMid + 30 : zMid - 30], [0, ySS + 15, i ? zIn1 - 30 : zIn0 + 30]], [0, -1, 0], `CB${i}`, undefined, { len: 12, dia: 5 })),
      tools: ["screwdriver"],
    },
    {
      title: "Build the two slatted bases",
      detail: "For each half, screw the three cross rails between two slat strips, six screws on each strip.",
      fix: [-1, 1].map((sx) => {
        const bw = half - 6;
        return fx("screw", [-1, 1].flatMap((k) => [-1, 0, 1].flatMap((c) => [-12, 12].map((d): Vec3 => [sx * (half / 2) + k * (bw / 2 - 60), yBase + 50, (zIn0 + zIn1) / 2 + c * (ML / 2 - 60) + d]))), [0, -1, 0], sx < 0 ? "LB0" : "LB1", undefined, { len: 50, dia: 5 });
      }),
      wait: ["LB0", "LB1"],
      from: { LB0: [-1400, 0, 0], LB1: [1400, 0, 0] },
      tools: ["allen"],
    },
    { title: "Click the slats into their holders", detail: "Curved side up, both ends pushed down into the holders until they snap in." },
    {
      title: "Lay the bases into the bed",
      detail: "Each one rests on a slat rail and the centre beam, held at the ends by the stops. Two screws with washers fix each one.",
      add: ["LB0", "LB1"],
      fix: [-1, 1].flatMap((sx) => {
        const at = [zIn0 + 60, zIn1 - 60].map((z): Vec3 => [sx * 30, yBase + 20, z]);
        const on = sx < 0 ? "LB0" : "LB1";
        return [fx("screw", at, [0, -1, 0], on, undefined, { len: 16, dia: 4 }), fx("washer", at, [0, -1, 0], on, undefined, { dia: 4 })];
      }),
      tools: ["screwdriver"],
    },
    { title: "Lay on your mattress", add: ["MAT"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["TUFJORD"],
  recipe(s) {
    if (!/bed frame/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;
