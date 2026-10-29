import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VOXLÖV, read from its two manuals (bamboo).
 * Chair: each side frame comes in one piece (front leg, back leg and upright, joined by the side rail). Two cross
 * rails take a dowel in each end; upside down they plug into one side frame and get a long Allen screw each, then
 * the other side goes on the same way. Stood up, the woven back slides in between the uprights on four bolts.
 * Upside down again the seat slides in, two screws hold its back and two bolts with sleeve nuts its front, and all
 * ten bolts are tightened with the chair on its legs.
 * Table: each end frame (two legs and a curved crosspiece) gets a barrel nut and two studs in each leg top. Upside
 * down, the end rail lies on the crosspiece, two corner brackets go over the studs and are screwed to it, and the two
 * long rails are screwed into the brackets. Two dowels go into the end rails, the frame is lowered onto the
 * upside-down top and screwed to it with ten long screws, the bracket nuts are tightened and the glides go on.
 */

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, ...(on ? { on } : {}), ...o };
}

/** A straight piece of a part centred on c, from a to b (any direction), w across. */
function bar(a: Vec3, b: Vec3, w: number, c: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return { shape: "box", size: [w, len, w], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / len)] };
}

/** A part made of pieces given in finished-product mm, centred on its bounding box. */
function framed(id: string, name: string, abs: (c: Vec3) => PartPiece[], lo: Vec3, hi: Vec3): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces: abs(c), material: "wood" };
}

function chair(): CustomParams {
  // IKEA: 43 wide, 53 deep, 85 high, seat 46 high
  const W = 430, D = 530, H = 850, L = 34;
  const xs = W / 2 - L / 2, xi = W / 2 - L;
  const ySeat = 460, seatT = 35, yRail = ySeat - seatT - 25; // side rails and cross rails under the seat
  const zF = D / 2 - 45, zB0 = -D / 2 + 60, zBt = -D / 2 + L / 2; // front leg, back leg at the floor and at the top
  const zB = (y: number) => zB0 + ((zBt - zB0) * y) / H;
  const side = (id: string, sx: number) =>
    framed(
      id,
      "Side frame",
      (c) => [
        bar([sx * xs, 0, zF], [sx * xs, yRail + 25, zF], L, c),
        bar([sx * xs, 0, zB0], [sx * xs, H, zBt], L, c),
        { shape: "box", size: [L, 50, zF - zB(yRail)], pos: [sx * xs - c[0], yRail - c[1], (zF + zB(yRail)) / 2 - c[2]] },
        bar([sx * xs, 150, zB(150) + 10], [sx * xs, yRail - 25, zB(yRail) + 120], 26, c),
      ],
      [sx * xs - L / 2, 0, zB0 - L / 2],
      [sx * xs + L / 2, H, zF + L / 2],
    );
  const yBack = 690, hBack = 300;
  const parts: CustomPart[] = [
    side("SL", -1),
    { id: "RF", name: "Cross rail", size: [2 * xi, 50, 24], pos: [0, yRail - 10, zF], material: "wood" },
    { id: "RB", name: "Cross rail", size: [2 * xi, 50, 24], pos: [0, yRail - 10, zB(yRail) + L / 2 + 12], material: "wood" },
    side("SR", 1),
    // between the uprights, in line with them, so the bolts through the uprights go into its edges
    { id: "BACK", name: "Backrest", size: [2 * xi, hBack, 30], pos: [0, yBack, zB(yBack)], rot: [Math.atan2(zBt - zB0, H), 0, 0], material: "fiber" },
    { id: "SEAT", name: "Seat", size: [W + 20, seatT, D - 70], pos: [0, ySeat - seatT / 2, 20], material: "fiber" },
  ];
  const long = (sx: number) => fx("bolt", [parts[1], parts[2]].map((r): Vec3 => [sx * W / 2, r.pos[1], r.pos[2]]), [-sx, 0, 0], sx < 0 ? "SL" : "SR", { len: 80, dia: 6, name: "Long Allen screw" });
  const zb = zB(yBack) + L / 2;
  const backBolts = [-1, 1].map((sx) => fx("bolt", [yBack - 80, yBack + 80].map((y): Vec3 => [sx * W / 2, y, zB(y)]), [-sx, 0, 0], sx < 0 ? "SL" : "SR", { len: 40, dia: 6, mate: "BACK" }));
  const front = [-110, 110].map((x): Vec3 => [x, yRail - 35, zF]);
  return {
    parts,
    steps: [
      { title: "Push the dowels into the cross rails", detail: "One into each end of both rails.", fix: [...["RF", "RB"].flatMap((id) => [-1, 1].map((sx) => fx("dowel", [[sx * xi, yRail - 10, parts.find((p) => p.id === id)!.pos[2]]], [sx, 0, 0], id, { mate: sx < 0 ? "SL" : "SR" })))], wait: ["RF", "RB"] },
      { title: "Screw the rails into one side frame", detail: "Lay the side frame upside down on a rug. One long Allen screw through it into each rail.", add: ["SL", "RF", "RB"], fix: [long(-1)], pose: "-y", warnings: ["floor"] },
      { title: "Fit the other side frame onto the rails", detail: "Turn it the right way round and push it over the dowels.", add: ["SR"], from: { SR: [0, 0, 0] } },
      { title: "Screw that side to the rails", detail: "Two more long Allen screws. Not fully tight yet.", fix: [long(1)] },
      { title: "Stand it up and slide in the back", detail: "Push the woven back down between the uprights from behind.", add: ["BACK"], pose: "+y", from: { BACK: [0, 0, -300] } },
      { title: "Bolt the back to the uprights", detail: "Four bolts, two through each upright, with the big Allen key.", fix: backBolts },
      { title: "Turn it over and slide the seat in", detail: "Rest it upside down. The seat's brackets at the back slide under the back rail.", add: ["SEAT"], pose: "-y", from: { SEAT: [0, 0, 300] } },
      { title: "Screw the seat to the back rail", detail: "One screw through each bracket.", fix: [fx("screw", [-120, 120].map((x): Vec3 => [x, yRail - 35, zb + 24]), [0, 1, 0], "RB", { len: 16, dia: 4, mate: "SEAT" })], tools: ["screwdriver"] },
      {
        title: "Bolt the front of the seat",
        detail: "A sleeve nut from above and a bolt from below at each side of the front rail.",
        fix: [fx("bolt", front, [0, 1, 0], "RF", { len: 50, dia: 6, mate: "SEAT" }), fx("nut", front.map((p): Vec3 => [p[0], ySeat - 12, p[2]]), [0, -1, 0], "SEAT", { name: "Sleeve nut", len: 12, dia: 10 })],
      },
      { title: "Stand it up and tighten every bolt", detail: "All ten, firmly, with the chair on its legs. Check them again after a couple of weeks.", pose: "+y", tools: ["allen"], kind: "bolts" },
    ],
  };
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 180 x 90, 75 high
  const W = Math.round(s.size.w * 10) || 1800, D = Math.round(s.size.d * 10) || 900, H = Math.round(s.size.h * 10) || 750;
  const tT = 25, under = H - tT, L = 45, hA = 65, yA = under - hA / 2;
  const xF = W / 2 - 260; // the end frames
  const zT = D / 2 - 90, zFoot = D / 2 - 50; // legs at the top and at the floor
  const yC = under - hA - 20; // the curved crosspiece under the end rail
  const zL = (y: number) => zFoot + ((zT - zFoot) * y) / under;
  const frame = (id: string, sx: number) =>
    framed(
      id,
      "End frame",
      (c) => [
        ...[-1, 1].map((sz) => bar([sx * xF, 0, sz * zFoot], [sx * xF, under, sz * zT], L, c)),
        { shape: "box", size: [L - 10, 40, 2 * zL(yC)], pos: [sx * xF - c[0], yC - c[1], -c[2]] },
        ...[-1, 1].map((sz) => bar([sx * xF, yC - 20, sz * (zL(yC) - 70)], [sx * xF, yC - 140, sz * zL(yC - 140)], 30, c)),
      ],
      [sx * xF - L / 2, 0, -zFoot - L / 2],
      [sx * xF + L / 2, under, zFoot + L / 2],
    );
  const zIn = zT - L / 2; // inside faces of the legs at the top
  const zR = zIn - 40; // the long rails, inside the brackets
  const parts: CustomPart[] = [
    frame("FL", -1),
    frame("FR", 1),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `E${i}`, name: "End rail", size: [24, hA, 2 * zIn], pos: [sx * xF, yA, 0], material: "wood" })),
    ...[1, -1].map((sz, i): CustomPart => ({ id: `R${i}`, name: "Long rail", size: [2 * xF - 140, hA, 24], pos: [0, yA, sz * zR], material: "wood" })),
    { id: "TOP", name: "Table top", size: [W, tT, D], pos: [0, under + tT / 2, 0], material: "wood" },
  ];
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz): [number, number] => [sx, sz]));
  const fr = (sx: number) => (sx < 0 ? "FL" : "FR");
  const brk = legs.map(([sx, sz]): Vec3 => [sx * (xF - 40), yA, sz * (zIn - 30)]);
  const inward = (sx: number, sz: number): Vec3 => [-sx * Math.SQRT1_2, 0, -sz * Math.SQRT1_2]; // the studs point into the corner
  const bracketScrews = (into: "end" | "long", sxs: number[], szs: number[]) =>
    legs
      .filter(([sx, sz]) => sxs.includes(sx) && szs.includes(sz))
      .map(([sx, sz]) =>
        into === "end"
          ? fx("screw", [yA - 15, yA + 15].map((y): Vec3 => [sx * (xF - 12), y, sz * (zIn - 50)]), [sx, 0, 0], undefined, { len: 14, dia: 4, mate: sx < 0 ? "E0" : "E1" })
          : fx("screw", [yA - 15, yA + 15].map((y): Vec3 => [sx * (xF - 70), y, sz * (zR + 12)]), [0, 0, -sz], undefined, { len: 14, dia: 4, mate: sz > 0 ? "R0" : "R1" }),
      );
  const topScrews = [
    ...[-1, 1].map((sz) => fx("bolt", [-0.55, 0, 0.55].map((f): Vec3 => [f * xF, under - hA, sz * zR]), [0, 1, 0], undefined, { len: 80, dia: 6, name: "Long screw", mate: "TOP" })),
    ...[-1, 1].map((sx) => fx("bolt", [-0.4, 0.4].map((f): Vec3 => [sx * xF, under - hA, f * zIn]), [0, 1, 0], undefined, { len: 80, dia: 6, name: "Long screw", mate: "TOP" })),
  ];
  return {
    parts,
    steps: [
      {
        title: "Fit the barrel nuts and studs into the legs",
        detail: "In both end frames: a barrel nut down into the top of each leg, slot lined up, then two studs screwed in from the inside until they stop.",
        add: ["FL", "FR"],
        fix: [
          ...[-1, 1].map((sx) => fx("pin", legs.filter((l) => l[0] === sx).map(([, sz]): Vec3 => [sx * xF, under - 20, sz * zT]), [0, -1, 0], fr(sx), { name: "Barrel nut", len: 40, dia: 10 })),
          ...legs.map(([sx, sz]) => fx("stud", [yA - 15, yA + 15].map((y): Vec3 => [sx * xF, y, sz * zT]), inward(sx, sz), fr(sx), { len: 40, dia: 8 })),
        ],
        tools: ["screwdriver"],
      },
      { title: "Turn the frames over and lay on the end rails", detail: "Upside down on a rug. Each end rail rests on its crosspiece, screw holes facing the inside.", add: ["E0", "E1"], pose: "-y", warnings: ["floor"] },
      { title: "Push the corner brackets over the studs", detail: "Two on each end frame, one at each leg.", fix: legs.map(([sx, sz], i) => fx("angle", [brk[i]], inward(sx, sz), undefined, { name: "Corner bracket", len: 120, dia: 60 })) },
      { title: "Screw the brackets to the end rails", detail: "Two screws through each bracket into the end rail.", fix: bracketScrews("end", [-1, 1], [-1, 1]), tools: ["screwdriver"] },
      { title: "Screw in the first long rail", detail: "It slots into the brackets on one side, holes the right way up. Two screws at each end.", add: ["R0"], fix: bracketScrews("long", [-1, 1], [1]), tools: ["screwdriver"] },
      { title: "Screw in the other long rail", detail: "The same on the other side.", add: ["R1"], fix: bracketScrews("long", [-1, 1], [-1]), tools: ["screwdriver"] },
      { title: "Turn it over and push in the dowels", detail: "One into the top edge of each end rail.", fix: [-1, 1].map((sx, i) => fx("dowel", [[sx * xF, under, 0]], [0, 1, 0], `E${i}`, { mate: "TOP", len: 20 })), pose: "+y" },
      { title: "Lower the frame onto the top", detail: "Lay the top upside down on a rug and turn the frame over onto it, dowels into the holes.", add: ["TOP"], pose: "-y", people: 2 },
      { title: "Screw the rails to the top", detail: "Ten long screws up through the rails, with the Allen key.", fix: topScrews, tools: ["allen"] },
      { title: "Tighten the nuts on the studs", detail: "A spring washer and a nut on each stud inside the brackets, tightened with the box spanner.", fix: legs.flatMap(([sx, sz], i) => {
          const at = [-15, 15].map((dy): Vec3 => [brk[i][0], brk[i][1] + dy, brk[i][2]]);
          return [fx("washer", at, inward(sx, sz), undefined, { name: "Spring washer", dia: 10 }), fx("nut", at, inward(sx, sz), undefined, { dia: 8 })];
        }),
        tools: ["wrench"] },
      { title: "Tap the glides into the legs", detail: "One into the foot of each leg, then turn the table over together.", fix: [fx("glide", legs.map(([sx, sz]): Vec3 => [sx * xF, 0, sz * zFoot]), [0, 1, 0], undefined, { name: "Glide" })], people: 2, tools: ["hammer"] },
    ],
  };
}

const recipe = (s: ProductSpec) => {
  const slug = s.slug ?? "";
  if (/voxlov-chair/.test(slug)) return chair();
  if (/voxlov-dining-table/.test(slug)) return table(s);
  return null;
};

/** The recipe, with each step's tools as the manual shows them. */
function build(b: PlanBuilder, s: ProductSpec): boolean {
  const r = recipe(s);
  if (!r) return false;
  const start = b.steps.length;
  buildCustom(b, { ...s, custom: r });
  r.steps.forEach((st, i) => {
    const bs = b.steps[start + i];
    if (bs && st.tools && bs.title === st.title) bs.tools = [...st.tools];
  });
  return true;
}

const family: Family = { names: ["VOXLÖV"], recipe, build };
export default family;
