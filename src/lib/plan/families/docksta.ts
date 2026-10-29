import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, ProductSpec, Vec3 } from "../../types";

/**
 * DOCKSTA, read from the underframe's manual. A pedestal table, not one on legs: eight clips are tapped into the
 * heavy base plate, two people hold it on its edge while the steel pole is bolted on, then the domed base cover,
 * the tapered column sleeve, the flared top and the round top plate are stacked down the pole and locked with one
 * nut. The underframe is turned upside down onto the top, bolted on with six bolts and toothed washers, and two
 * people turn the table over.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];

/** A round part made of discs stacked up the middle: [diameter, bottom, top] for each, in product mm. */
function stack(id: string, name: string, layers: [number, number, number][], material: PartMaterial): CustomPart {
  const y0 = Math.min(...layers.map((l) => l[1])), y1 = Math.max(...layers.map((l) => l[2]));
  const dia = Math.max(...layers.map((l) => l[0]));
  const cy = (y0 + y1) / 2;
  return {
    id,
    name,
    size: [dia, y1 - y0, dia],
    pos: [0, cy, 0],
    material,
    pieces: layers.map(([d, a, b]) => ({ shape: "cyl" as const, size: [d, b - a, d] as Vec3, pos: [0, (a + b) / 2 - cy, 0] as Vec3 })),
  };
}

/** Discs following a radius profile r(t), t from 0 at y0 to 1 at y1, so a dome or a taper reads as a smooth curve. */
function profile(y0: number, y1: number, n: number, r: (t: number) => number): [number, number, number][] {
  return Array.from({ length: n }, (_, i) => [2 * r((i + 0.5) / n), y0 + ((y1 - y0) * i) / n, y0 + ((y1 - y0) * (i + 1)) / n] as [number, number, number]);
}

const ring = (r: number, n: number, y: number, a0 = 0): Vec3[] => Array.from({ length: n }, (_, i) => [r * Math.cos(a0 + (2 * Math.PI * i) / n), y, r * Math.sin(a0 + (2 * Math.PI * i) / n)]);

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10;
  const T = 20; // the top
  const yTop = H - T;
  const BD = Math.min(560, W * 0.55); // base, across
  const PT = 12; // base plate
  const yPlate = yTop - 12; // top plate, under the top
  const yFlare = yPlate - 110;
  const parts: CustomPart[] = [
    stack("BP", "Base plate", [[BD - 40, 0, PT]], "metal"),
    // a welded foot flange at the bottom of the pole takes the four bolts
    stack("PO", "Pole", [[90, PT, PT + 8], [36, PT + 8, yPlate + 6]], "metal"),
    // a low dome rising to a collar round the column
    stack("BC", "Base cover", [[BD, 0, 16], ...profile(16, 96, 5, (t) => 50 + (BD / 2 - 50) * (1 - t) ** 2.2)], "board"),
    // narrowest a little above the middle, wider at the foot
    stack("SL", "Column sleeve", profile(96, yFlare, 3, (t) => 32 + 14 * (1 - t) ** 2 + 4 * t ** 3), "board"),
    stack("FL", "Top flare", profile(yFlare, yPlate, 4, (t) => 36 + 64 * t ** 2.2), "board"),
    stack("TP", "Top plate", [[340, yPlate, yTop]], "metal"),
    stack("TT", "Table top", [[W, yTop, H]], "board"),
  ];
  const steps: CustomStep[] = [
    {
      title: "Tap the clips into the base plate",
      detail: "Lay the plate flat on a rug. Push the eight clips into the holes round its rim and tap them home with a hammer.",
      add: ["BP"],
      fix: [fx("clip", ring(BD / 2 - 45, 8, PT, Math.PI / 8), DOWN, "BP")],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the pole to the base plate",
      detail: "One of you holds the plate on its edge with the pole in its socket. Four bolts go in from under the plate.",
      add: ["PO"],
      fix: [fx("bolt", ring(28, 4, 0, Math.PI / 4), UP, "BP", { len: 16, dia: 8, mate: "PO" })],
      tools: ["allen"],
      pose: "+x",
      people: 2,
    },
    {
      title: "Lower the base cover over the pole",
      detail: "Stand the base flat again. The smooth side of the cover faces up; press it down until it clicks onto the clips.",
      add: ["BC"],
      pose: "+y",
    },
    {
      title: "Slide the column sleeve down the pole",
      detail: "Wide end down, so it sits in the collar of the base cover.",
      add: ["SL"],
      from: { SL: [0, 500, 0] },
    },
    { title: "Drop the flare onto the sleeve", detail: "Its narrow end goes down into the top of the sleeve.", add: ["FL"], from: { FL: [0, 300, 0] } },
    { title: "Turn the flare to lock it", detail: "Twist it by hand until it stops and sits firmly on the sleeve." },
    {
      title: "Lay the top plate on the flare",
      detail: "The pole comes up through the hole in the middle. Turn the plate until its notches drop over the lugs on the flare.",
      add: ["TP"],
      from: { TP: [0, 200, 0] },
    },
    {
      title: "Tighten the nut on the pole",
      detail: "Washer first, then the nut, done up hard with a spanner so nothing turns.",
      fix: [fx("washer", [[0, yPlate + 6, 0]], DOWN, "TP"), fx("nut", [[0, yPlate + 8, 0]], DOWN, "TP", { dia: 12 })],
      tools: ["wrench"],
    },
    {
      title: "Turn the underframe onto the top",
      detail: "Lay the top upside down on a rug. Lift the underframe together, turn it over and stand it in the middle of the top.",
      add: ["TT"],
      pose: "-y",
      people: 2,
      warnings: ["two", "floor"],
    },
    {
      title: "Bolt the top plate to the top",
      detail: "Six bolts, each with a toothed washer under its head, through the plate into the top.",
      fix: [fx("washer", ring(140, 6, yPlate - 2), UP, "TP", { name: "Toothed washer" }), fx("bolt", ring(140, 6, yPlate - 4), UP, "TP", { len: 20, dia: 6, mate: "TT" })],
      tools: ["allen"],
    },
    { title: "Turn the table over together", detail: "Lift it by the top and stand it on its base.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["DOCKSTA"],
  recipe(s) {
    if (!/table/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
