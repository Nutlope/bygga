import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * NORRÅKER, read from the table's manual. The frame is made on a rug: a corner bracket screwed inside each end of the
 * two short rails, then the long rails screwed onto the brackets' other flanges. The frame is laid on the upside-down
 * top and held with two long screws, then ten more. Each leg takes a cross dowel in its top end and two threaded
 * studs, the studs go through the bracket and a spring washer and a nut hold them, tightened with the box spanner.
 * Four glides are tapped into the feet. The chair has no manual we could find, so it keeps its old guide.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const G = [-1, 1] as const;
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
const r = (n: number) => Math.round(n);
const UP: Vec3 = [0, 1, 0];

const TT = 28; // top
const RH = 75, RT = 20; // rails
const IN = 40; // rails in from the top's edges
const LEG = 50;

const LONG_SCREW = { len: 90, dia: 5, name: "Long screw" };
const SMALL = { len: 14, dia: 4 };
const BRACKET = { len: 90, dia: 40, name: "Corner bracket" };
const STUD = { len: 60, dia: 8, name: "Threaded stud" };
const CROSS = { len: 40, dia: 10, name: "Cross dowel" };
const NUT = { len: 7, dia: 13 };
const WASHER = { len: 2, dia: 14, name: "Spring washer" };
const GLIDE = { len: 12, dia: 24, name: "Glide" };

function table(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const yTop = H - TT; // underside of the top
  const yR = yTop - RH / 2;
  const yLow = yTop - RH; // the rails' lower edge, facing up while you work
  const xo = W / 2 - IN - RT / 2, zo = D / 2 - IN - RT / 2; // rail centres
  const xi = W / 2 - IN - RT, zi = D / 2 - IN - RT; // inside faces of the rails
  const xl = xi - LEG / 2, zl = zi - LEG / 2; // leg centres, tucked into the corners
  const lenX = W - 2 * IN, lenZ = D - 2 * IN - 2 * RT;

  const parts: CustomPart[] = [
    ...G.map((sx, i): CustomPart => ({ id: `Z${i + 1}`, name: "Short rail", size: [RT, RH, r(lenZ)], pos: [r(sx * xo), yR, 0], material: "wood" })),
    ...G.map((sz, i): CustomPart => ({ id: `X${i + 1}`, name: "Long rail", size: [r(lenX), RH, RT], pos: [0, yR, r(sz * zo)], material: "wood" })),
    { id: "T", name: "Table top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    ...CORNERS.map(([sx, sz], i): CustomPart => ({ id: `L${i + 1}`, name: "Leg", size: [LEG, yTop, LEG], pos: [r(sx * xl), yTop / 2, r(sz * zl)], material: "wood" })),
  ];
  const xRail = (sz: number) => (sz < 0 ? "X1" : "X2");

  // a bracket's flanges sit on the rails just past the leg, its web across the corner with two holes for the studs
  const reach = LEG + 40;
  const flangeZ = CORNERS.map(([sx, sz]) => G.map((dy): Vec3 => [r(sx * xi), r(yR + dy * 18), r(sz * (zi - reach))]));
  const flangeX = CORNERS.map(([sx, sz]) => G.map((dy): Vec3 => [r(sx * (xi - reach)), r(yR + dy * 18), r(sz * zi)]));
  const diag = (sx: number, sz: number): Vec3 => [-sx * 0.71, 0, -sz * 0.71]; // from the corner towards the middle
  const brackets = CORNERS.map(([sx, sz]) =>
    fx("angle", [[r(sx * (xi - reach / 2 - 10)), r(yR), r(sz * (zi - reach / 2 - 10))]], [sx * 0.71, 0, sz * 0.71], { ...BRACKET, on: sx < 0 ? "Z1" : "Z2", mate: xRail(sz) }),
  );
  const bracketScrewsZ = CORNERS.map(([sx], i) => fx("screw", flangeZ[i], [sx, 0, 0], { ...SMALL, on: sx < 0 ? "Z1" : "Z2" }));
  const bracketScrewsX = CORNERS.map(([, sz], i) => fx("screw", flangeX[i], [0, 0, sz], { ...SMALL, on: xRail(sz) }));

  // long screws down through the rails into the top
  const along = (n: number, len: number) => Array.from({ length: n }, (_, k) => -len / 2 + 120 + ((len - 240) * k) / Math.max(1, n - 1));
  const shortScrew = (sx: number, z: number) => fx("screw", [[r(sx * xo), r(yLow), r(z)]], UP, { ...LONG_SCREW, on: sx < 0 ? "Z1" : "Z2", mate: "T" });
  const first = G.map((sx) => shortScrew(sx, -lenZ / 4));
  const rest = [
    ...G.map((sx) => shortScrew(sx, lenZ / 4)),
    ...G.map((sz) => fx("screw", along(4, lenX).map((x): Vec3 => [r(x), r(yLow), r(sz * zo)]), UP, { ...LONG_SCREW, on: xRail(sz), mate: "T" })),
  ];

  // leg fittings: a cross dowel down into the top end, two studs out of the inside corner through the bracket
  const edge = (sx: number, sz: number, k: number): Vec3 => {
    const d = diag(sx, sz);
    return [r(sx * xl + d[0] * k), 0, r(sz * zl + d[2] * k)];
  };
  const studY = [yR - 16, yR + 16];
  const crosses = CORNERS.map(([sx, sz], i) => fx("nut", [[r(sx * xl), r(yTop - 45), r(sz * zl)]], [0, -1, 0], { ...CROSS, on: `L${i + 1}` }));
  const studs = CORNERS.map(([sx, sz], i) => fx("stud", studY.map((y): Vec3 => { const p = edge(sx, sz, LEG * 0.6); return [p[0], r(y), p[2]]; }), diag(sx, sz), { ...STUD, on: `L${i + 1}` }));
  const nuts = (k: "washer" | "nut") =>
    CORNERS.map(([sx, sz], i) =>
      fx(k, studY.map((y): Vec3 => { const p = edge(sx, sz, LEG * 0.6 + 32); return [p[0], r(y), p[2]]; }), diag(sx, sz), { ...(k === "nut" ? NUT : WASHER), on: `L${i + 1}` }),
    );
  const glides = fx("glide", CORNERS.map(([sx, sz]): Vec3 => [r(sx * xl), 0, r(sz * zl)]), UP, { ...GLIDE });

  return {
    parts,
    steps: [
      {
        title: "Screw a corner bracket into each end of the short rails",
        detail: "Lay the rails on a rug. Each bracket sits on the inside of a rail end and takes two small screws.",
        add: ["Z1", "Z2"],
        fix: [...brackets, ...bracketScrewsZ],
        pose: "-y",
        tools: ["screwdriver"],
        warnings: ["floor"],
      },
      {
        title: "Screw the long rails onto the brackets",
        detail: "Two small screws through each bracket's free flange. Check the screw holes in the rails face up, to the top.",
        add: ["X1", "X2"],
        fix: bracketScrewsX,
        tools: ["screwdriver"],
      },
      {
        title: "Lay the frame on the top and fix it with two screws",
        detail: "Lay the top face down on the rug and set the frame on it, the same gap all round. One long screw in each short rail holds it while you do the rest.",
        add: ["T"],
        fix: first,
        from: { T: [0, 400, 0] },
        tools: ["screwdriver"],
      },
      {
        title: "Drive in the other ten long screws",
        detail: "Four along each long rail and one more in each short rail, firmly but without stripping the wood.",
        fix: rest,
        tools: ["screwdriver"],
      },
      {
        title: "Fit a cross dowel and two studs to each leg",
        detail: "The cross dowel drops into the top end of the leg with its slot lined up with the holes. Screw both studs in by hand until they stop in it.",
        fix: [...crosses, ...studs],
        wait: ["L1", "L2", "L3", "L4"],
        tools: ["flathead"],
      },
      {
        title: "Bolt each leg into its corner",
        detail: "Push the studs through the holes in the bracket, then a spring washer and a nut on each. Tighten with the box spanner until the leg sits firm against both rails.",
        add: ["L1", "L2", "L3", "L4"],
        fix: [...nuts("washer"), ...nuts("nut")],
        from: Object.fromEntries(CORNERS.map(([sx, sz], i) => [`L${i + 1}`, [-sx * 40, -260, -sz * 40] as Vec3])),
        tools: ["wrench"],
      },
      {
        title: "Tap a glide into each foot",
        detail: "One gentle tap with the hammer each, until the glide sits flat.",
        fix: [glides],
        tools: ["hammer"],
      },
      { title: "Turn the table over", detail: "Together, lifting it by the top, never by the legs.", pose: "+y", people: 2, warnings: ["two"] },
    ],
  };
}

const family: Family = {
  names: ["NORRÅKER", "NORRAKER"],
  recipe: (s) => (/table/i.test(s.variant) && !/bar|bench/i.test(s.variant) ? table(s) : null),
};
export default family;
