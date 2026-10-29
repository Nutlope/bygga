import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * ÖSTAVALL, read from the lift-top coffee table's manual. The box is built lying on its back on a rug: the storage
 * bottom goes between the two aprons on dowels and cam locks, then the two side panels (with glides tapped in) go on
 * with cam bolts. Standing, a grommet fits the cable hole and the lift mechanism goes in: four arms on screw sleeves
 * and pins, two screws in each rear arm, a cross bar on four bolts, two gas springs that click on, and the top, held by
 * one screw and seven sleeves and pins.
 */

const t = 18;

function table(s: ProductSpec): CustomParams {
  // IKEA: 90 long, 60 deep (63 with the top raised), 48 high closed, 25 free under the box
  const W = s.size.w * 10 || 900, H = s.size.h * 10 || 480;
  const D = s.size.d * 10 > 700 ? 600 : s.size.d * 10 || 600;
  const yBox = H - t, yBot = 250, aH = yBox - yBot;
  const xs = W / 2 - t / 2, xIn = W / 2 - t, Wi = W - 2 * t;
  const zA = D / 2 - t / 2, zIn = D / 2 - t;
  const yA = yBot + aH / 2, yB = yBot + t / 2;
  const zFa = D / 2 - 100, zRa = -D / 2 + 120; // front and rear lift arms
  const SX = [-1, 1] as const;
  const sid = (sx: number) => (sx < 0 ? "SL" : "SR");
  const parts: CustomPart[] = [
    { id: "BA", name: "Apron", size: [Wi, aH, t], pos: [0, yA, -zA], material: "board" },
    { id: "FA", name: "Apron", size: [Wi, aH, t], pos: [0, yA, zA], material: "board" },
    { id: "BOT", name: "Bottom", size: [Wi, t, D - 2 * t], pos: [0, yB, 0], material: "board" },
    { id: "SL", name: "Side panel", size: [t, yBox, D], pos: [-xs, yBox / 2, 0], material: "board" },
    { id: "SR", name: "Side panel", size: [t, yBox, D], pos: [xs, yBox / 2, 0], material: "board" },
    ...SX.map((sx, i): CustomPart => ({ id: `AF${i}`, name: "Front lift arm", size: [10, yBox - 300, 30], pos: [sx * (xIn - 5), (300 + yBox) / 2, zFa], material: "metal" })),
    ...SX.map((sx, i): CustomPart => ({ id: `AR${i}`, name: "Rear lift arm", size: [10, yBox - 290, 60], pos: [sx * (xIn - 5), (290 + yBox) / 2, zRa], material: "metal" })),
    // a flat bar, its two bolts per end side by side, above the pivot pins
    { id: "BAR", name: "Cross bar", size: [Wi - 20, 25, 50], pos: [0, 400, zRa], material: "metal" },
    ...SX.map((sx, i): CustomPart => ({ id: `GS${i}`, name: "Gas spring", shape: "cyl", size: [30, 30, 260], pos: [sx * (xIn - 40), 310, 20], material: "metal" })),
    { id: "TOP", name: "Table top", size: [W, t, D], pos: [0, H - t / 2, 0], material: "board" },
  ];
  const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
  const CAMB = { len: 34, dia: 7 }, CAM = { len: 13, dia: 15 }, DOW = { len: 30, dia: 8 };
  const xsCam = [-300, 0, 300], xsDow = [-400, -150, 150];
  const apronBolts = (id: string, z: number) => at("camScrew", xsCam.map((x): Vec3 => [x, yB, z]), [0, 0, -Math.sign(z)], id, "BOT", CAMB);
  const apronDowels = (id: string, z: number) => SX.map((sx) => at("dowel", [yA - 60, yA + 60].map((y): Vec3 => [sx * xIn, y, z]), [sx, 0, 0], id, undefined, DOW));
  const botCams = (z: number) => at("cam", xsCam.map((x): Vec3 => [x, yBot + t, z - Math.sign(z) * 25]), [0, -1, 0], "BOT", undefined, CAM);
  const sideBolts = SX.map((sx) =>
    at("camScrew", [[sx * xIn, yA, -zA], [sx * xIn, yA, zA], ...[-200, 0, 200].map((z): Vec3 => [sx * xIn, yB, z])], [sx, 0, 0], sid(sx), undefined, CAMB),
  );
  const sideCams = SX.flatMap((sx) => [
    at("cam", [[sx * (xIn - 30), yA, -zIn]], [0, 0, -1], "BA", undefined, CAM),
    at("cam", [[sx * (xIn - 30), yA, zIn]], [0, 0, 1], "FA", undefined, CAM),
    at("cam", [-200, 0, 200].map((z): Vec3 => [sx * (xIn - 30), yBot + t, z]), [0, -1, 0], "BOT", undefined, CAM),
  ]);
  const armJoint = (z: number, ids: string[], ys: number[]) => [
    at("stud", SX.flatMap((sx) => ys.map((y): Vec3 => [sx * xIn, y, z])), [1, 0, 0], "SL", undefined, { name: "Screw sleeve", len: 12, dia: 10, to: ["SL", "SR"] }),
    ...SX.map((sx, i) => at("pin", ys.map((y): Vec3 => [sx * (xIn - 10), y, z]), [sx, 0, 0], ids[i], sid(sx), { name: "Locking pin", len: 14, dia: 6 })),
  ];
  const topPts: Vec3[] = SX.flatMap((sx) => [zFa, zRa].flatMap((z) => [z - 12, z + 12].map((zz): Vec3 => [sx * (xIn - 5), yBox, zz])));
  return {
    parts,
    steps: [
      {
        title: "Screw the cam bolts into the aprons",
        detail: "Lay both aprons on a rug, inside face up, and screw three cam bolts into each by hand.",
        add: ["BA"],
        fix: [apronBolts("BA", -zIn), apronBolts("FA", zIn)],
        wait: ["FA"],
        pose: "+z",
        warnings: ["floor"],
      },
      { title: "Tap the dowels into the apron ends", detail: "Two at each end of both aprons.", fix: [...apronDowels("BA", -zA), ...apronDowels("FA", zA)], tools: ["hammer"] },
      {
        title: "Tap the dowels into the bottom",
        detail: "Three along each long edge and two along each short one.",
        fix: [
          ...[-1, 1].map((sz) => at("dowel", xsDow.map((x): Vec3 => [x, yB, sz * zIn]), [0, 0, sz], "BOT", undefined, DOW)),
          ...SX.map((sx) => at("dowel", [[sx * xIn, yB, -120], [sx * xIn, yB, 120]], [sx, 0, 0], "BOT", undefined, DOW)),
        ],
        wait: ["BOT"],
        tools: ["hammer"],
      },
      { title: "Push the bottom onto the apron", detail: "Stand it on its long edge on the cam bolts, cable hole towards the floor end.", add: ["BOT"] },
      { title: "Lock the three cams", detail: "Turn each cam clockwise until it grips the bolt.", fix: [botCams(-zIn)] },
      { title: "Push on the other apron", detail: "Press it down onto the top edge of the bottom.", add: ["FA"] },
      { title: "Lock its three cams", fix: [botCams(zIn)] },
      {
        title: "Tap the glides into the side panels",
        detail: "Two into the bottom edge of each panel, with a hammer.",
        fix: SX.map((sx) => at("glide", [[sx * xs, 0, -D / 2 + 50], [sx * xs, 0, D / 2 - 50]], [0, 1, 0], sid(sx), undefined, { name: "Glide", len: 6, dia: 20 })),
        wait: ["SL", "SR"],
        tools: ["hammer"],
      },
      { title: "Screw the cam bolts into the side panels", detail: "Five in each, by hand.", fix: sideBolts },
      { title: "Fit the side panels", detail: "Push one onto each end of the box, over the dowels and bolts.", add: ["SL", "SR"] },
      { title: "Lock the first cams", detail: "The two you can reach in the lower apron.", fix: sideCams.filter((f) => f.on === "BA") },
      { title: "Stand it up and lock the rest", detail: "Eight more: one in the front apron and three in the bottom at each end.", fix: sideCams.filter((f) => f.on !== "BA"), pose: "+y" },
      { title: "Fit the cable grommet", detail: "Press the ring into the hole in the bottom and set the cover in it with the slot where you want the cable.", fix: [at("cap", [[-xIn + 70, yBot + t, -zIn + 70]], [0, -1, 0], "BOT", undefined, { name: "Cable grommet", len: 20, dia: 80 })] },
      {
        title: "Fit the two front lift arms",
        detail: "Turn the box so the front faces you. Screw the sleeves into the side panels and push a pin through each arm's plate into them.",
        add: ["AF0", "AF1"],
        fix: armJoint(zFa, ["AF0", "AF1"], [310, 340]),
      },
      {
        title: "Fit the two rear lift arms",
        detail: "Left and right arms are different: match the bend in each plate to the drawing on its label.",
        add: ["AR0", "AR1"],
        fix: armJoint(zRa, ["AR0", "AR1"], [300, 330]),
      },
      {
        title: "Screw the rear arms to the side panels",
        detail: "Two screws through each plate.",
        fix: SX.map((sx, i) => at("screw", [[sx * (xIn - 10), 360, zRa - 20], [sx * (xIn - 10), 360, zRa + 20]], [sx, 0, 0], `AR${i}`, sid(sx), { len: 16, dia: 4 })),
      },
      {
        title: "Bolt on the cross bar",
        detail: "Put a washer on each bolt and turn it in by hand through the arm into the bar. Don't tighten yet.",
        add: ["BAR"],
        fix: SX.flatMap((sx, i) => {
          const pts: Vec3[] = [[sx * xIn, 400, zRa - 12], [sx * xIn, 400, zRa + 12]];
          // the engine keeps a washer on the bolt already at its point, so the bolt is listed first
          return [at("bolt", pts, [-sx, 0, 0], `AR${i}`, "BAR", { len: 16, dia: 6 }), at("washer", pts, [-sx, 0, 0], `AR${i}`, undefined, { len: 2, dia: 16 })];
        }),
      },
      { title: "Fold the arms down and tighten the bolts", detail: "Push the bar down until the arms lie flat, then tighten all four bolts with the Allen key.", tools: ["allen"] },
      { title: "Click on the gas springs", detail: "Press each end onto its ball until it clicks. The thick end goes to the front.", add: ["GS0", "GS1"], warnings: ["hand"] },
      {
        title: "Lay the top on and fix it with one screw",
        detail: "Line it up flush with the box all round, then put one screw through a front arm's plate to hold it in place.",
        add: ["TOP"],
        fix: [at("screw", [topPts[0]], [0, 1, 0], "AF0", "TOP", { len: 16, dia: 4 })],
        people: 2,
      },
      {
        title: "Fix the top with the sleeves and pins",
        detail: "Seven more: screw a sleeve into each hole under the top and push a pin through the plate into it. Raise and lower the top to check the lock catches.",
        fix: [
          at("stud", topPts.slice(1), [0, 1, 0], "TOP", undefined, { name: "Screw sleeve", len: 12, dia: 10 }),
          at("pin", topPts.slice(1).map((p): Vec3 => [p[0], p[1] - 3, p[2]]), [0, 1, 0], "TOP", undefined, { name: "Locking pin", len: 14, dia: 6 }),
        ],
      },
    ],
  };
}

const family: Family = {
  names: ["ÖSTAVALL", "OSTAVALL"],
  recipe: (s) => (/coffee table/i.test(`${s.variant} ${s.slug ?? ""}`) || /ostavall-adjustable-coffee/.test(s.slug ?? "") ? table(s) : null),
};
export default family;
