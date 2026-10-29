import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SMEDSTORP, read from its manuals. The 2- and 3-seat sofas share one manual and are built lying on their back: a
 * hook plate is screwed to each end of the backrest, four studs go into its front, the sprung seat is lowered onto
 * them and held from inside with four clamp nuts. Two people hook the armrests onto the plates and push them flush,
 * and two bolts with washers go through each side of the seat into the armrest. Upside down, the four tapered legs
 * are screwed on by their plates (two screws each) and get felt pads, then it is turned up for its cushions.
 * The sectional is that 3-seat frame with one armrest, built the same way, and a chaise section: its backrest is
 * bolted to the long seat on its side, it gets four legs, and its short armrest is hooked onto a plate on the backrest
 * and bolted. Two U brackets on the chaise catch a hook plate on the end of the sofa's backrest.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r = (n: number) => Math.round(n);

const LEG = 180; // free height under the frame
const SEAT = 320; // top of the sprung seat frame
const CUSH = 450; // top of the seat cushions
const BACK = 700; // top of the backrest frame
const ARM = 670;
const AW = 130;
const BT = 200; // backrest frame, back to front
const D = 940;
const LEG_D = 45;

const HOOK = { len: 70, dia: 30, name: "Hook plate" };
const HOOK_SCREW = { len: 16, dia: 6 };
const STUD = { len: 90, dia: 8 };
const CLAMP = { len: 20, dia: 40, name: "Clamp nut" };
const BOLT = { len: 60, dia: 8 };
const LONG_BOLT = { len: 110, dia: 8 };
const WASHER = { len: 2, dia: 20 };
const LEG_SCREW = { len: 20, dia: 6 };
const PAD = { len: 4, dia: 28, name: "Felt pad" };

const legPieces: PartPiece[] = [
  { shape: "box", size: [70, 6, 70], pos: [0, LEG / 2 - 3, 0], material: "metal" },
  { shape: "cyl", size: [LEG_D, LEG / 2, LEG_D], pos: [0, LEG / 4 - 6, 0] },
  { shape: "cyl", size: [LEG_D - 16, LEG / 2, LEG_D - 16], pos: [0, -LEG / 4, 0] },
];
const leg = (id: string, x: number, z: number): CustomPart => ({ id, name: "Leg", size: [70, LEG, 70], pos: [r(x), LEG / 2, r(z)], material: "wood", pieces: legPieces });

const armPart = (id: string, xc: number, z0: number, depth: number, name = "Armrest"): CustomPart => ({
  id,
  name,
  size: [AW, ARM - LEG, depth],
  pos: [r(xc), (ARM + LEG) / 2, r(z0 + depth / 2)],
  material: "soft",
  pieces: [
    { shape: "box", size: [AW, ARM - LEG - AW / 2, depth], pos: [0, -AW / 4, 0] },
    { shape: "cyl", size: [AW, depth, AW], pos: [0, (ARM - LEG) / 2 - AW / 2, 0], rot: [Math.PI / 2, 0, 0] },
  ],
});

/** Backrest, sprung seat, studs and clamp nuts of one sofa frame between x0 and x1 (the arms' inner faces), back at z0. */
function frameParts(p: string, x0: number, x1: number, z0: number) {
  const w = x1 - x0, xc = (x0 + x1) / 2, zB = z0 + BT, zF = z0 + D;
  const back: CustomPart = { id: `${p}B`, name: "Backrest", size: [w, BACK - LEG, BT], pos: [r(xc), (BACK + LEG) / 2, r(z0 + BT / 2)], material: "soft" };
  const seat: CustomPart = { id: `${p}S`, name: "Seat frame", size: [w, SEAT - LEG, zF - zB], pos: [r(xc), (SEAT + LEG) / 2, r((zB + zF) / 2)], material: "soft" };
  const yJ = LEG + 70;
  const studX = [0.12, 0.38, 0.62, 0.88].map((t) => r(x0 + t * w));
  const studs: Vec3[] = studX.map((x) => [x, yJ, zB]);
  const clamps: Vec3[] = studX.map((x) => [x, yJ, zB + 50]);
  const bolts = (x: number): Vec3[] => [zB + 120, zF - 120].map((z) => [x, yJ, r(z)]);
  const hookAt = (x: number): Vec3 => [x, LEG + 120, r(z0 + BT / 2)];
  return { back, seat, studs, clamps, bolts, hookAt, zB, zF };
}

const cushionParts = (p: string, x0: number, x1: number, n: number, zB: number, zF: number) => {
  const cw = (x1 - x0) / n;
  const seats: CustomPart[] = [], backs: CustomPart[] = [];
  for (let i = 0; i < n; i++) {
    const xc = r(x0 + cw * (i + 0.5));
    seats.push({ id: `${p}C${i}`, name: "Seat cushion", size: [r(cw - 6), CUSH - SEAT, r(zF - zB - 20)], pos: [xc, (CUSH + SEAT) / 2, r((zB + 20 + zF) / 2)], material: "soft" });
    backs.push({ id: `${p}K${i}`, name: "Back cushion", size: [r(cw - 10), 470, 170], pos: [xc, 880 - 235, r(zB + 85)], material: "soft", rot: [-0.12, 0, 0] });
  }
  return { seats, backs };
};

/** The sofa frame's own steps, from the backrest on the floor to the bolts into the armrests. */
function frameSteps(f: ReturnType<typeof frameParts>, arms: { id: string; x: number; sx: number }[], hookOn: number[]): CustomStep[] {
  const { back, seat } = f;
  const two = arms.length === 2;
  return [
    {
      title: two ? "Screw a hook plate onto each end of the backrest" : "Screw a hook plate onto the armrest end of the backrest",
      detail: "Lay the backrest on its back on a rug. One screw holds each plate; use the hole the drawing shows, not the slot.",
      add: [back.id],
      fix: [
        ...hookOn.map((x) => fx("hook", [f.hookAt(x)], [x < back.pos[0] ? 1 : -1, 0, 0], { ...HOOK, on: back.id })),
        // each screw goes through its plate into the end of the backrest
        ...hookOn.map((x) => fx("screw", [f.hookAt(x)], [x < back.pos[0] ? 1 : -1, 0, 0], { ...HOOK_SCREW, on: back.id })),
      ],
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Screw four studs into the backrest",
      detail: "Into the holes along the face the seat goes against, by hand until they stop.",
      fix: [fx("stud", f.studs, [0, 0, -1], { ...STUD, on: back.id, mate: seat.id })],
      warnings: ["hand"],
    },
    {
      title: "Lower the seat onto the studs",
      detail: "Stand the sprung seat on its back edge so the studs go through the holes in its rail.",
      add: [seat.id],
      from: { [seat.id]: [0, 0, 450] },
    },
    {
      title: "Fit a clamp nut on each stud",
      detail: "From inside the seat frame: push each one down over its stud, then turn it until it locks.",
      fix: [fx("nut", f.clamps, [0, 0, -1], { ...CLAMP, on: seat.id, mate: back.id })],
      warnings: ["hand"],
    },
    {
      title: two ? "Hook the armrests onto the plates" : "Hook the armrest onto its plate",
      detail: two ? "One of you at each end: hold the armrest upright and slide it down until the plate drops into its slot." : "Hold the armrest upright and slide it down until the plate drops into its slot.",
      add: arms.map((a) => a.id),
      people: two ? 2 : 1,
      warnings: two ? ["two"] : undefined,
    },
    {
      title: two ? "Push the armrests flush" : "Push the armrest flush",
      detail: "Press it in against the backrest and the seat until the edges line up with no gap.",
    },
    {
      title: "Bolt the seat to the armrest" + (two ? "s" : ""),
      detail: "A washer on each bolt, through the side rail of the seat into the armrest. Tighten them with the Allen key.",
      fix: arms.flatMap((a) => [
        fx("bolt", f.bolts(a.x - a.sx * AW / 2), [a.sx, 0, 0], { ...BOLT, on: seat.id, mate: a.id }),
        fx("washer", f.bolts(a.x - a.sx * AW / 2), [a.sx, 0, 0], { ...WASHER, on: seat.id }),
      ]),
      tools: ["allen"],
    },
  ];
}

const legScrews = (legs: CustomPart[], on: string): CustomFix[] =>
  legs.map((l) => fx("screw", [-18, 18].map((dx) => [l.pos[0] + dx, LEG, l.pos[2]] as Vec3), [0, 1, 0], { ...LEG_SCREW, on: l.id, mate: on }));
const pads = (legs: CustomPart[]): CustomFix => fx("glide", legs.map((l) => [l.pos[0], 0, l.pos[2]] as Vec3), [0, 1, 0], { ...PAD });

function sofa(s: ProductSpec): CustomParams {
  const W = s.size.w * 10;
  const z0 = -D / 2;
  const xi = W / 2 - AW;
  const f = frameParts("", -xi, xi, z0);
  const arms = [
    { id: "L", x: -W / 2 + AW / 2, sx: -1 },
    { id: "R", x: W / 2 - AW / 2, sx: 1 },
  ];
  const legs = [leg("G1", -xi + 50, f.zB + 50), leg("G2", xi - 50, f.zB + 50), leg("G3", -xi + 50, f.zF - 50), leg("G4", xi - 50, f.zF - 50)];
  const c = cushionParts("", -xi, xi, 2, f.zB, f.zF);
  const parts: CustomPart[] = [f.back, f.seat, ...arms.map((a) => armPart(a.id, a.x, z0, D)), ...legs, ...c.seats, ...c.backs];
  const steps: CustomStep[] = [
    ...frameSteps(f, arms, [-xi, xi]),
    {
      title: "Turn it upside down and screw on the legs",
      detail: "Two of you tip it over onto the rug. Each leg's plate goes on a corner of the seat frame with two screws.",
      add: legs.map((l) => l.id),
      fix: legScrews(legs, f.seat.id),
      tools: ["allen"],
      pose: "-y",
      people: 2,
      warnings: ["two", "floor"],
    },
    { title: "Stick a felt pad under each leg", detail: "Press them firmly onto the ends of the legs.", fix: [pads(legs)] },
    {
      title: "Turn it over and lay in the seat cushions",
      detail: "Two of you stand it on its legs, then push the cushions in, back edge first.",
      add: c.seats.map((x) => x.id),
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    { title: "Stand the back cushions against the backrest", detail: "Press them down onto the seat cushions so they sit straight.", add: c.backs.map((x) => x.id) },
  ];
  return { parts, steps };
}

/** The sectional: a 3-seat frame with its armrest on the left and the chaise section on the right. */
function sectional(s: ProductSpec): CustomParams {
  const W = s.size.w * 10;
  const DC = 1610; // chaise depth from IKEA's measurements
  const z0 = -DC / 2;
  const xl = -W / 2, xs = xl + AW, xj = xs + 1780, xr = W / 2, xa = xr - AW;
  const f = frameParts("s", xs, xj, z0);
  const sArm = armPart("sL", xl + AW / 2, z0, D);
  const sLegs = [leg("sG1", xs + 50, f.zB + 50), leg("sG2", xs + 50, f.zF - 50)];
  const sc = cushionParts("s", xs, xj, 2, f.zB, f.zF);

  // the chaise section: backrest across its back, the long sprung seat, a short armrest on the outer side
  const cB: CustomPart = { id: "cB", name: "Chaise backrest", size: [xa - xj, BACK - LEG, BT], pos: [r((xj + xa) / 2), (BACK + LEG) / 2, r(z0 + BT / 2)], material: "soft" };
  const cS: CustomPart = { id: "cS", name: "Chaise seat frame", size: [xa - xj, SEAT - LEG, DC - BT], pos: [r((xj + xa) / 2), (SEAT + LEG) / 2, r(z0 + BT + (DC - BT) / 2)], material: "soft" };
  const cA = armPart("cA", xa + AW / 2, z0, D, "Chaise armrest");
  const cLegs = [leg("cG1", xj + 50, f.zB + 50), leg("cG2", xa - 50, f.zB + 50), leg("cG3", xj + 50, DC / 2 - 50), leg("cG4", xa - 50, DC / 2 - 50)];
  const cSeat: CustomPart = { id: "cC", name: "Chaise cushion", size: [r(xa - xj - 6), CUSH - SEAT, DC - BT - 20], pos: [r((xj + xa) / 2), (CUSH + SEAT) / 2, r(z0 + BT + 20 + (DC - BT - 20) / 2)], material: "soft" };
  const cBack: CustomPart = { ...sc.backs[0], id: "cK", size: [r(xa - xj - 10), 470, 170], pos: [r((xj + xa) / 2), sc.backs[0].pos[1], sc.backs[0].pos[2]] };

  const yJ = LEG + 70;
  const cBoltAt = (t: number): Vec3 => [r(xj + t * (xa - xj)), yJ, z0 + BT];
  const armHook: Vec3 = [xa, LEG + 120, r(z0 + BT / 2)];
  const armBolts: Vec3[] = [z0 + BT + 120, z0 + D - 120].map((z) => [xa, yJ, r(z)]);
  const uAt: Vec3[] = [z0 + 50, z0 + 150].map((z) => [xj, LEG + 120, r(z)]);

  const parts: CustomPart[] = [cS, cB, ...cLegs, cA, f.back, f.seat, sArm, ...sLegs, ...sc.seats, cSeat, ...sc.backs, cBack];
  const frame = frameSteps(f, [{ id: "sL", x: xl + AW / 2, sx: -1 }], [xs]);
  const steps: CustomStep[] = [
    {
      title: "Bolt the backrest to the chaise seat",
      detail: "Stand the long seat on its inner side on a rug, the backrest against its end. Two bolts with washers; use the shorter bolts here.",
      add: ["cS", "cB"],
      fix: [fx("bolt", [cBoltAt(0.3), cBoltAt(0.7)], [0, 0, -1], { ...BOLT, on: "cS", mate: "cB" }), fx("washer", [cBoltAt(0.3), cBoltAt(0.7)], [0, 0, -1], { ...WASHER, on: "cS" })],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw the legs onto the chaise",
      detail: "One plate at each corner of the seat frame, two screws in each.",
      add: cLegs.map((l) => l.id),
      fix: legScrews(cLegs, "cS"),
      tools: ["allen"],
    },
    { title: "Stick a felt pad under each leg", detail: "Press them firmly onto the ends of the legs.", fix: [pads(cLegs)] },
    {
      title: "Screw a hook plate onto the chaise backrest",
      detail: "On the outer end, facing up. One screw, in the hole the drawing shows.",
      fix: [fx("hook", [armHook], [-1, 0, 0], { ...HOOK, on: "cB", mate: "cA" }), fx("screw", [armHook], [-1, 0, 0], { ...HOOK_SCREW, on: "cB" })],
      tools: ["allen"],
    },
    ...frame,
    {
      title: "Screw two legs onto the sofa",
      detail: "At the armrest end only: the other end will rest on the chaise. Two screws in each plate.",
      add: sLegs.map((l) => l.id),
      fix: legScrews(sLegs, f.seat.id),
      tools: ["allen"],
    },
    { title: "Stick a felt pad under each leg", detail: "Press them firmly onto the ends of the legs.", fix: [pads(sLegs)] },
    {
      title: "Hook the armrest onto the chaise",
      detail: "With the chaise on its side again, lower the armrest onto the top so the plate drops into its slot.",
      add: ["cA"],
      pose: "+x",
    },
    { title: "Slide the armrest up to the backrest", detail: "Push it along until its edges line up with the backrest, with no gap." },
    {
      title: "Bolt the armrest to the chaise",
      detail: "Two long bolts with washers through the side of the seat frame into the armrest.",
      fix: [fx("bolt", armBolts, [1, 0, 0], { ...LONG_BOLT, on: "cS", mate: "cA" }), fx("washer", armBolts, [1, 0, 0], { ...WASHER, on: "cS" })],
      tools: ["allen"],
    },
    {
      title: "Stand the chaise up and screw on the U brackets",
      detail: "On its inner side, at the back, where the sofa will meet it. One screw in each.",
      fix: [
        fx("bracket", uAt, [1, 0, 0], { name: "U bracket", len: 50, dia: 30, on: "cB" }),
        fx("screw", uAt, [1, 0, 0], { len: 16, dia: 6, on: "cB" }),
      ],
      tools: ["allen"],
      pose: "+y",
      wall: false,
    },
    {
      title: "Screw a hook plate onto the open end of the sofa",
      detail: "Lay the sofa on its back again. The plate goes on the end of the backrest without an armrest.",
      fix: [fx("hook", [f.hookAt(xj)], [-1, 0, 0], { ...HOOK, on: f.back.id, mate: "cB" }), fx("screw", [f.hookAt(xj)], [-1, 0, 0], { ...HOOK_SCREW, on: f.back.id })],
      tools: ["allen"],
      pose: "+z",
    },
    {
      title: "Hook the sofa onto the chaise",
      detail: "Stand the sofa up, lift its open end and lower it so the hook drops into the brackets. The fronts of the backrests line up.",
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    { title: "Lay in the seat cushions", detail: "Back edge first, then press the fronts down.", add: [...sc.seats.map((x) => x.id), "cC"] },
    { title: "Stand the back cushions against the backrest", detail: "Press them down onto the seat cushions so they sit straight.", add: [...sc.backs.map((x) => x.id), "cK"] },
  ];
  // the frame's first step lays the sofa's backrest down: say so, now that the chaise is done
  const first = steps.indexOf(frame[0]);
  steps[first] = { ...frame[0], title: "Screw a hook plate onto the sofa backrest", detail: "Lay the sofa's backrest on its back on a rug. One screw holds the plate at the armrest end; use the hole the drawing shows." };
  return { parts, steps };
}

const family: Family = {
  names: ["SMEDSTORP"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/sectional|chaise/.test(slug)) return s.size.w > 250 ? sectional(s) : null;
    if (/[23]-seat-sofa/.test(slug)) return sofa(s);
    return null;
  },
};
export default family;
