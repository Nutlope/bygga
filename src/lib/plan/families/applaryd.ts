import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ÄPPLARYD, read from its manuals. A sofa is built lying on its back: four studs go into the backrest, the sprung
 * seat is lowered onto them and nutted from inside, the two armrests hook on and are pulled tight with long bolts,
 * then the steel underframe is bolted to the bottom and the four legs screwed into it before it is tipped up.
 * A sofa with a chaise longue is the chaise section plus a sofa package: the chaise is built on its side with one of
 * the sofa's armrests on its outer end, the sofa gets only the other armrest, and the two are hooked together on
 * connector plates. IKEA's photos show the chaise on the left (as you face the sofa), the manual's first layout.
 */

type Fx = Omit<CustomFix, "count" | "at"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });

const D = 930, Z0 = -D / 2, BT = 180; // depth, back of the frame, backrest thickness
const YB = 200, YS = 470, YBK = 700, YA = 720, YC = 820; // bottom of the upholstery, seat, backrest, armrest, cushions
const AW = 170, CW = 910, CD = 1620, LEG = YB - 30;
const STUD = { kind: "stud", len: 90, dia: 8 } as const;
const NUT = { kind: "nut", len: 7, dia: 8 } as const;
const ARM_BOLT = { kind: "bolt", len: 120, dia: 8 } as const;
const BIG_WASHER = { kind: "washer", len: 2, dia: 30 } as const;
const FRAME_BOLT = { kind: "bolt", len: 40, dia: 6 } as const;
const WASHER = { kind: "washer", len: 1.5, dia: 14 } as const;
const LEG_STUD = { kind: "legScrew", len: 30, dia: 8 } as const;
const PLATE = { kind: "plate", name: "Connector plate", len: 4, dia: 60 } as const;
const PLATE_BOLT = { kind: "bolt", len: 60, dia: 6 } as const;

interface Mod {
  parts: CustomPart[];
  id: (k: string) => string;
}

/** The steel underframe: two long tubes and two end tubes, welded in one piece. */
function frame(id: string, cx: number, cz: number, L: number, Dp: number): CustomPart {
  const t = 25;
  const pieces: PartPiece[] = [
    { shape: "box", size: [L, t, t], pos: [0, 0, -Dp / 2 + t / 2] },
    { shape: "box", size: [L, t, t], pos: [0, 0, Dp / 2 - t / 2] },
    { shape: "box", size: [t, t, Dp - 2 * t], pos: [-L / 2 + t / 2, 0, 0] },
    { shape: "box", size: [t, t, Dp - 2 * t], pos: [L / 2 - t / 2, 0, 0] },
  ];
  return { id, name: "Underframe", size: [L, t, Dp], pos: [cx, YB - t / 2 + 0.5, cz], material: "metal", pieces };
}

const legPts = (cx: number, cz: number, L: number, Dp: number): Vec3[] =>
  [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [cx + sx * (L / 2 - 30), LEG, cz + sz * (Dp / 2 - 30)] as Vec3));

/** The frame steps every module shares: underframe on, bolted, legs in. */
function frameSteps(p: string, cx: number, cz: number, L: number, Dp: number, seat: string, nLegs = 4): CustomStep[] {
  const bolts = [-1, 1].flatMap((sz) => [-1, 0, 1].map((k) => [cx + (k * L) / 3, YB, cz + sz * (Dp / 2 - 12)] as Vec3));
  const legs = Array.from({ length: nLegs }, (_, i) => `${p}leg${i}`);
  return [
    {
      title: "Lay the underframe on together",
      detail: "Its six brackets go over the holes in the bottom, flat side against the frame.",
      add: [`${p}frame`],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt the underframe on by hand",
      detail: "A washer on each bolt, through the brackets into the bottom. Only a few turns for now.",
      fix: [fx({ ...WASHER, at: bolts, dir: [0, 1, 0], on: `${p}frame` }), fx({ ...FRAME_BOLT, at: bolts, dir: [0, 1, 0], on: `${p}frame`, mate: seat })],
    },
    { title: "Tighten the frame bolts", detail: "All six, with the Allen key.", tools: ["allen"] },
    {
      title: "Screw the legs on",
      detail: "A stud into the top of each leg first, by hand, then each leg into a corner of the underframe until it stops.",
      add: legs,
      fix: legPts(cx, cz, L, Dp).map((q, i) => fx({ ...LEG_STUD, at: [q], dir: [0, -1, 0], on: legs[i], mate: `${p}frame` })),
      warnings: ["hand"],
    },
  ];
}

/** A sofa module: backrest, seat, the armrests it has, its underframe and legs, and its back cushions. */
function sofaParts(p: string, x0: number, seatL: number, arms: { left: boolean; right: boolean }, nCush: number): CustomPart[] {
  const cx = x0 + seatL / 2;
  const parts: CustomPart[] = [
    { id: `${p}back`, name: "Backrest", size: [seatL, YBK - YB, BT], pos: [cx, (YB + YBK) / 2, Z0 + BT / 2], material: "soft" },
    { id: `${p}seat`, name: "Seat frame", size: [seatL, YS - YB, D - BT], pos: [cx, (YB + YS) / 2, Z0 + BT + (D - BT) / 2], material: "soft" },
    frame(`${p}frame`, cx, 0, seatL - 40, D - 80),
    ...legPts(cx, 0, seatL - 40, D - 80).map((q, i): CustomPart => ({ id: `${p}leg${i}`, name: "Leg", size: [35, LEG, 35], pos: [q[0], LEG / 2, q[2]], shape: "cyl", material: "metal" })),
  ];
  if (arms.left) parts.push({ id: `${p}armL`, name: "Armrest", size: [AW, YA - YB, D], pos: [x0 - AW / 2, (YB + YA) / 2, 0], material: "soft" });
  if (arms.right) parts.push({ id: `${p}armR`, name: "Armrest", size: [AW, YA - YB, D], pos: [x0 + seatL + AW / 2, (YB + YA) / 2, 0], material: "soft" });
  const cw = seatL / nCush;
  for (let i = 0; i < nCush; i++)
    parts.push({ id: `${p}cush${i}`, name: "Back cushion", size: [cw - 10, YC - YS, 200], pos: [x0 + cw * (i + 0.5), (YS + YC) / 2, Z0 + BT + 100], material: "soft" });
  return parts;
}

const hookAt = (x: number): Vec3[] => [[x, YB + 60, 0]];
const armBolts = (x: number): Vec3[] => [[x, YB + 130, -200], [x, YB + 130, 250]];

function sofaBody(p: string, x0: number, seatL: number, side: "both" | "right"): { steps: CustomStep[] } {
  const cx = x0 + seatL / 2;
  const studs = [0.15, 0.38, 0.62, 0.85].map((t) => [x0 + seatL * t, YB + 120, Z0 + BT] as Vec3);
  const xs = side === "both" ? [x0, x0 + seatL] : [x0 + seatL];
  const armIds = side === "both" ? [`${p}armL`, `${p}armR`] : [`${p}armR`];
  const bolts = xs.flatMap((x) => armBolts(x).map((q) => [x === x0 ? x + 40 : x - 40, q[1], q[2]] as Vec3));
  const dirOf = (q: Vec3): Vec3 => [q[0] < cx ? -1 : 1, 0, 0];
  const boltFix = (def: typeof ARM_BOLT | typeof BIG_WASHER) =>
    [-1, 1].map((sx) => bolts.filter((q) => Math.sign(q[0] - cx) === sx)).filter((a) => a.length).map((at) => fx({ ...def, at, dir: dirOf(at[0]), on: `${p}seat` }));
  const steps: CustomStep[] = [
    {
      title: "Screw four studs into the backrest",
      detail: "Lay it on its back on a rug. The long studs, by hand, into the holes along its front face until they stop.",
      add: [`${p}back`],
      fix: [fx({ ...STUD, at: studs, dir: [0, 0, -1], on: `${p}back` })],
      pose: "+z",
      warnings: ["floor", "hand"],
    },
    { title: "Lower the seat onto the studs", detail: "Stand it on its back edge, springs facing you, so every stud goes through its hole.", add: [`${p}seat`] },
    {
      title: "Nut the studs from inside the seat",
      detail: "One nut on each, tightened with the box spanner.",
      fix: [fx({ ...NUT, at: studs.map((q) => [q[0], q[1], q[2] + 40] as Vec3), dir: [0, 0, -1], on: `${p}seat` })],
      tools: ["wrench"],
    },
    {
      title: side === "both" ? "Hook the armrests on together" : "Hook the armrest onto the other end together",
      detail: "Hold it against the end and slide it down so the hook drops into the slot in the frame.",
      ...(side === "right" ? { add: armIds, fix: [fx({ kind: "hook", name: "Hook plate", len: 60, dia: 30, at: hookAt(x0 + seatL), dir: [-1, 0, 0], on: `${p}armR` }), fx({ kind: "screw", len: 16, dia: 4, at: hookAt(x0 + seatL - 3), dir: [1, 0, 0], on: `${p}armR` })] } : {}),
      ...(side === "both" ? { add: armIds } : {}),
      people: 2,
      warnings: ["two"],
    },
    {
      title: side === "both" ? "Bolt the armrests on by hand" : "Bolt the armrest on by hand",
      detail: "A big washer on each long bolt, through the end of the seat frame into the armrest.",
      fix: [...boltFix(BIG_WASHER), ...boltFix(ARM_BOLT)],
    },
    { title: "Tighten the armrest bolts", detail: "With the box spanner, until the armrest sits tight against the frame.", tools: ["wrench"] },
    ...frameSteps(p, cx, 0, seatL - 40, D - 80, `${p}seat`),
  ];
  return { steps };
}

/** The chaise section: backrest, long seat, underframe, legs and its back cushion; with an armrest on its outer end in a sofa. */
function chaiseParts(p: string, x0: number, w: number, arm: boolean): CustomPart[] {
  const cx = x0 + w / 2, cz = Z0 + CD / 2;
  const parts: CustomPart[] = [
    { id: `${p}back`, name: "Chaise backrest", size: [w, YBK - YB, BT], pos: [cx, (YB + YBK) / 2, Z0 + BT / 2], material: "soft" },
    { id: `${p}seat`, name: "Chaise seat frame", size: [w, YS - YB, CD - BT], pos: [cx, (YB + YS) / 2, Z0 + BT + (CD - BT) / 2], material: "soft" },
    frame(`${p}frame`, cx, cz, w - 60, CD - 80),
    ...legPts(cx, cz, w - 60, CD - 80).map((q, i): CustomPart => ({ id: `${p}leg${i}`, name: "Leg", size: [35, LEG, 35], pos: [q[0], LEG / 2, q[2]], shape: "cyl", material: "metal" })),
    { id: `${p}cush0`, name: "Back cushion", size: [w - 10, YC - YS, 200], pos: [cx, (YS + YC) / 2, Z0 + BT + 100], material: "soft" },
  ];
  if (arm) parts.push({ id: `${p}armL`, name: "Armrest", size: [AW, YA - YB, D], pos: [x0 - AW / 2, (YB + YA) / 2, 0], material: "soft" });
  return parts;
}

const platePts = (x: number): Vec3[] => [[x, YB + 70, -150], [x, YB + 70, 300]];

function chaiseBody(p: string, x0: number, w: number, arm: boolean): CustomStep[] {
  const cx = x0 + w / 2, cz = Z0 + CD / 2;
  const studs: Vec3[] = [x0 + w * 0.3, x0 + w * 0.7].map((x) => [x, YB + 120, Z0 + BT]);
  const fr = frameSteps(p, cx, cz, w - 60, CD - 80, `${p}seat`);
  const xr = x0 + w; // inner end, where the sofa goes
  const steps: CustomStep[] = [
    {
      title: "Screw two studs into the chaise backrest",
      detail: "Stand it on its end on a rug. The long studs, by hand, into the holes in its front face.",
      add: [`${p}back`],
      fix: [fx({ ...STUD, at: studs, dir: [0, 0, -1], on: `${p}back` })],
      pose: "-x",
      warnings: ["floor", "hand"],
    },
    { title: "Push the chaise seat onto the studs", detail: "Lay it on its side too, springs facing you, and slide it on so both studs go through.", add: [`${p}seat`] },
    { title: "Nut the studs from inside the seat", detail: "One nut on each, with the box spanner.", fix: [fx({ ...NUT, at: studs.map((q) => [q[0], q[1], q[2] + 40] as Vec3), dir: [0, 0, -1], on: `${p}seat` })], tools: ["wrench"] },
    ...fr.slice(0, 3),
    ...(arm
      ? [
          {
            title: "Screw the hook plates onto both armrests",
            detail: "From the sofa's box: one plate and one screw on each armrest. One goes on the chaise now, the other on the sofa later.",
            wait: [`${p}armL`],
            fix: [fx({ kind: "hook", name: "Hook plate", len: 60, dia: 30, at: hookAt(x0), dir: [1, 0, 0], on: `${p}armL` }), fx({ kind: "screw", len: 16, dia: 4, at: hookAt(x0 + 3), dir: [-1, 0, 0], on: `${p}armL` })],
            tools: ["screwdriver"],
          } as CustomStep,
          { title: "Lower an armrest onto the end of the chaise", detail: "On the end facing up, at the backrest. Slide it so the hook drops into the slot.", add: [`${p}armL`] },
          {
            title: "Bolt the armrest on by hand",
            detail: "Two long bolts from the sofa's box, each with a big washer, through the end of the seat frame.",
            fix: [fx({ ...BIG_WASHER, at: armBolts(x0 + 40), dir: [-1, 0, 0], on: `${p}seat` }), fx({ ...ARM_BOLT, at: armBolts(x0 + 40), dir: [-1, 0, 0], on: `${p}seat` })],
          } as CustomStep,
          { title: "Tighten the armrest bolts", detail: "With the box spanner.", tools: ["wrench"] } as CustomStep,
        ]
      : []),
    fr[3],
    { title: "Stand it on its legs together", detail: "Tip it over onto the legs, never by the armrest or backrest alone.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Bolt two connector plates to the inner end",
      detail: "On the end without an armrest, low on the frame. Two Allen bolts in each, the long ones, not the frame bolts.",
      fix: [fx({ ...PLATE, at: platePts(xr), dir: [-1, 0, 0], on: `${p}seat` }), fx({ ...PLATE_BOLT, at: platePts(xr).flatMap((q) => [-25, 25].map((dz) => [q[0], q[1], q[2] + dz] as Vec3)), dir: [-1, 0, 0], on: `${p}seat` })],
      tools: ["allen"],
    },
  ];
  return steps;
}

function sofa(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10;
  const seatL = W - 2 * AW;
  const x0 = -seatL / 2;
  const parts = sofaParts("", x0, seatL, { left: true, right: true }, 2);
  const body = sofaBody("", x0, seatL, "both");
  const steps: CustomStep[] = [
    {
      title: "Screw a hook plate onto each armrest",
      detail: "Lay them on the rug, inside face up. One screw through each plate, hook pointing to the back.",
      wait: ["armL", "armR"],
      fix: [fx({ kind: "hook", name: "Hook plate", len: 60, dia: 30, at: hookAt(x0 - 1), dir: [1, 0, 0], on: "armL" }), fx({ kind: "hook", name: "Hook plate", len: 60, dia: 30, at: hookAt(x0 + seatL + 1), dir: [-1, 0, 0], on: "armR" }), fx({ kind: "screw", len: 16, dia: 4, at: hookAt(x0 + 3), dir: [-1, 0, 0], on: "armL" }), fx({ kind: "screw", len: 16, dia: 4, at: hookAt(x0 + seatL - 3), dir: [1, 0, 0], on: "armR" })],
      tools: ["screwdriver"],
      pose: "+z",
    },
    ...body.steps,
    { title: "Stand it on its legs together", detail: "Tip it forward onto the legs; don't lift it by the backrest.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Put the back cushions on", detail: "Stand them on the seat against the backrest.", add: parts.filter((q) => q.name === "Back cushion").map((q) => q.id) },
  ];
  return { parts, steps };
}

function chaiseSofa(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10;
  const seatL = W - CW - 2 * AW;
  const xC = -W / 2 + AW; // the chaise starts after its armrest
  const xS = xC + CW;
  const parts = [...chaiseParts("c", xC, CW, true), ...sofaParts("s", xS, seatL, { left: false, right: true }, 2)];
  const sb = sofaBody("s", xS, seatL, "right");
  const steps: CustomStep[] = [
    ...chaiseBody("c", xC, CW, true),
    ...sb.steps,
    {
      title: "Bolt two connector plates to the open end",
      detail: "On the end without an armrest, low on the frame. Two Allen bolts in each.",
      fix: [fx({ ...PLATE, at: platePts(xS + 4), dir: [1, 0, 0], on: "sseat" }), fx({ ...PLATE_BOLT, at: platePts(xS + 4).flatMap((q) => [-25, 25].map((dz) => [q[0], q[1] + 20, q[2] + dz] as Vec3)), dir: [1, 0, 0], on: "sseat" })],
      tools: ["allen"],
    },
    {
      title: "Stand it up and push the pin into the end",
      detail: "Tip it onto its legs together, then push the guide pin into the hole high in the open end of the backrest.",
      fix: [fx({ kind: "dowel", name: "Guide pin", len: 80, dia: 10, at: [[xS, YB + 380, Z0 + BT / 2]], dir: [1, 0, 0], on: "sback" })],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Hook the sofa onto the chaise together",
      detail: "Lift the sofa's open end, line the pin up with the chaise's backrest and lower it so its plates drop over the chaise's plates.",
      people: 2,
      warnings: ["two"],
    },
    { title: "Put the back cushions on", detail: "One on the chaise and two on the sofa, against the backrest.", add: parts.filter((q) => q.name === "Back cushion").map((q) => q.id) },
  ];
  return { parts, steps };
}

function chaiseSection(s: ProductSpec): CustomParams {
  const w = s.size.w * 10;
  const parts = chaiseParts("c", -w / 2, w, false);
  const steps: CustomStep[] = [
    ...chaiseBody("c", -w / 2, w, false),
    { title: "Put the back cushion on", detail: "Against the backrest. To join it to a sofa, lift the sofa's end onto the connector plates as its manual shows.", add: ["ccush0"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ÄPPLARYD", "APPLARYD"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    if (/sofa-bed|bed/.test(v)) return null;
    if (/^chaise longue section/.test(v)) return chaiseSection(s);
    if (/seat sofa with chaise/.test(v)) return chaiseSofa(s);
    if (/^[23]-seat sofa$/.test(v)) return sofa(s);
    return null;
  },
};
export default family;
