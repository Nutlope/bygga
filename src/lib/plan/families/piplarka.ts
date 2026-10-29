import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * PIPLÄRKA tiltable desk, read from its manual. Feet screw into the four lower legs, which slide into the two leg
 * frames at the chosen height. Upside down, a stretcher is bolted between the frames and the legs are screwed to
 * the steel top frame. Stood up, two hinges go on and the tilting top is screwed to them. The shelf unit is built
 * on its own: a small riser on dowels and cams, the bottom board, two ends and the back, cams locked from below.
 * It sits on five spacers at the back and is bolted up through the frame; a book stop slides onto the front edge
 * and a strap under the top stops it tilting too far. Drawn at the lowest height (desk top at 50 cm).
 */

const SHORT = { name: "Allen screw", len: 12, dia: 6 };
const CONN = { name: "Connector screw", len: 50, dia: 7 };

function part(id: string, name: string, abs: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...abs.map((p) => p.pos[k] - p.size[k] / 2)));
  const hi = [0, 1, 2].map((k) => Math.max(...abs.map((p) => p.pos[k] + p.size[k] / 2)));
  const c = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: lo.map((v, k) => hi[k] - v) as Vec3,
    pos: c,
    material,
    pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })),
  };
}

const box = (lo: Vec3, hi: Vec3): PartPiece => ({ shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] });
const panel = (id: string, name: string, lo: Vec3, hi: Vec3): CustomPart => ({ id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], material: "board" });

/** A square steel tube from a to b, leaning front to back. */
function bar(a: Vec3, b: Vec3, t: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return { shape: "box", size: [t, Math.hypot(...d), t], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, 0] };
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

const HUTCH = ["RT", "RL", "HB", "HSL", "HSR", "HBK"];

function desk(): CustomParams {
  const XF = 380, ZF = 315, yF0 = 450, yF1 = 480; // steel top frame
  const zMid = -130; // cross tube under the hinges
  const xL = 365, zTop = 200, zFoot = 290, barY = 210;
  const zAt = (y: number) => zTop + ((zFoot - zTop) * (yF0 - 6 - y)) / (yF0 - 6 - 15);
  const legFrame = (sx: number): PartPiece[] => [
    ...[-1, 1].map((sz) => bar([sx * xL, yF0 - 6, sz * zTop], [sx * xL, 200, sz * zAt(200)], 36)),
    ...[-1, 1].map((sz) => box([sx * xL - 30, yF0 - 6, sz * zTop - 40], [sx * xL + 30, yF0, sz * zTop + 40])),
    box([sx * xL - 15, barY - 15, -zAt(barY)], [sx * xL + 15, barY + 15, zAt(barY)]),
  ];
  const lower = (sx: number, sz: number) => part(`LL${sx < 0 ? 0 : 1}${sz < 0 ? 0 : 1}`, "Lower leg", [bar([sx * xL, 280, sz * zAt(280)], [sx * xL, 15, sz * zAt(15)], 28)], "metal");
  const yT0 = 495, yT1 = 513;
  const yH0 = 495, yH1 = 513, zH0 = -ZF, zH1 = -115, top = 703;
  const xR0 = 102, xR1 = 382, yR = 600;
  const parts: CustomPart[] = [
    part("LFL", "Leg frame", legFrame(-1), "metal"),
    part("LFR", "Leg frame", legFrame(1), "metal"),
    lower(-1, -1), lower(-1, 1), lower(1, -1), lower(1, 1),
    { id: "ST", name: "Stretcher", size: [2 * xL - 30, 30, 30], pos: [0, barY, 0], material: "metal" },
    part("FR", "Top frame", [
      ...[-1, 1].map((sx) => box([sx * XF - 15, yF0, -ZF], [sx * XF + 15, yF1, ZF])),
      ...[ZF - 15, zMid, -ZF + 15].map((z) => box([-XF + 15, yF0, z - 15], [XF - 15, yF1, z + 15])),
      ...[-1, 1].map((sx) => box([sx * (XF + 15), yF0 - 40, -60], [sx * (XF + 25), yF0, -40])),
    ], "metal"),
    ...[-1, 1].map((sx): CustomPart => ({ ...panel(sx < 0 ? "HGL" : "HGR", "Hinge", [sx * 300 - 40, yF1, zMid - 20], [sx * 300 + 40, yT0, zMid + 60]), material: "metal" })),
    panel("TOP", "Desk top", [-400, yT0, -105], [400, yT1, ZF]),
    // the shelf unit at the back
    panel("HB", "Shelf bottom", [-400, yH0, zH0], [400, yH1, zH1]),
    panel("HSL", "End panel", [-400, yH1, zH0], [-382, top, zH1]),
    panel("HSR", "End panel", [382, yH1, zH0], [400, top, zH1]),
    panel("HBK", "Back panel", [-382, yH1, zH0], [382, top - 20, zH0 + 16]),
    panel("RT", "Riser shelf", [xR0, yR, zH0 + 16], [xR1, yR + 16, zH1 - 10]),
    panel("RL", "Riser leg", [xR0, yH1, zH0 + 16], [xR0 + 16, yR, zH1 - 10]),
    { id: "STOP", name: "Book stop", size: [300, 30, 16], pos: [150, (yT0 + yT1) / 2, ZF + 8], material: "metal" },
  ];

  const feet: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xL, 0, sz * zAt(15)]));
  const legId = (sx: number, sz: number) => `LL${sx < 0 ? 0 : 1}${sz < 0 ? 0 : 1}`;
  const legScrews = (sx: number) => [-1, 1].flatMap((sz) => [230, 265].map((y) => fx("screw", [[sx * (xL + 18), y, sz * zAt(y)]], [-sx, 0, 0], sx < 0 ? "LFL" : "LFR", { ...SHORT, mate: legId(sx, sz) })));
  const plateScrews = (sx: number) => fx("screw", [-1, 1].flatMap((sz) => [-25, 25].map((dz): Vec3 => [sx * xL, yF0 - 6, sz * zTop + dz])), [0, 1, 0], sx < 0 ? "LFL" : "LFR", { ...SHORT, mate: "FR" });
  // the hinge reaches forward from the cross tube to under the top's back edge
  const hingeTop = (sx: number) => fx("screw", [-30, 0, 30].map((dx): Vec3 => [sx * 300 + dx, yT0, zMid + 45]), [0, 1, 0], sx < 0 ? "HGL" : "HGR", { ...SHORT, mate: "TOP" });
  const spacers: Vec3[] = [[-300, yF1, -ZF + 15], [0, yF1, -ZF + 15], [300, yF1, -ZF + 15], [-200, yF1, zMid], [200, yF1, zMid]];
  const yM = (yH0 + yH1) / 2;
  const steps: CustomStep[] = [
    {
      title: "Screw the feet into the lower legs",
      detail: "One adjustable foot into the end of each lower leg, by hand.",
      fix: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => fx("foot", [feet[(sx < 0 ? 0 : 2) + (sz < 0 ? 0 : 1)]], [0, 1, 0], legId(sx, sz), { len: 15, dia: 30 }))),
      wait: ["LL00", "LL01", "LL10", "LL11"],
    },
    {
      title: "Slide the lower legs into the leg frames",
      detail: "Pick the height that suits your child first: every leg on the same holes. Two screws hold each one.",
      add: ["LFL", "LFR", "LL00", "LL01", "LL10", "LL11"],
      fix: [...legScrews(-1), ...legScrews(1)],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the stretcher between the leg frames",
      detail: "One long bolt through each side bar into the stretcher's end.",
      add: ["ST"],
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (xL + 15), barY, 0]], [-sx, 0, 0], sx < 0 ? "LFL" : "LFR", { len: 70, dia: 8, mate: "ST" })),
      tools: ["allen"],
    },
    {
      title: "Screw the legs to the top frame",
      detail: "Lay the frame upside down on a rug, hooks out, and set the legs on it. Two screws through each leg plate.",
      add: ["FR"],
      fix: [plateScrews(-1), plateScrews(1)],
      tools: ["allen"],
    },
    {
      title: "Turn it over and fit the hinges",
      detail: "Stand the desk on its feet. One screw holds each hinge on the cross tube.",
      add: ["HGL", "HGR"],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * 300, yT0, zMid]], [0, -1, 0], sx < 0 ? "HGL" : "HGR", { ...SHORT, mate: "FR" })),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Screw the desk top to the hinges",
      detail: "Rounded corners to the front. Three screws up through each hinge.",
      add: ["TOP"],
      fix: [hingeTop(-1), hingeTop(1)],
      tools: ["allen"],
    },
    {
      title: "Tap the dowels into the riser",
      detail: "Two into the top of the small leg, three into the end of the riser shelf, two into the leg's foot.",
      fix: [
        fx("dowel", [[xR0 + 8, yR, -250], [xR0 + 8, yR, -165]], [0, -1, 0], "RL", { len: 30, dia: 8, mate: "RT" }),
        fx("dowel", [[xR0 + 8, yH1, -250], [xR0 + 8, yH1, -165]], [0, 1, 0], "RL", { len: 30, dia: 8, mate: "HB" }),
        fx("dowel", [-270, -210, -150].map((z): Vec3 => [xR1, yR + 8, z]), [-1, 0, 0], "RT", { len: 30, dia: 8, mate: "HSR" }),
      ],
      tools: ["hammer"],
      wait: ["RT", "RL"],
      from: { RT: [0, 0, 520], RL: [0, 0, 520] },
    },
    {
      title: "Screw two cam bolts into the riser shelf",
      detail: "Into the holes underneath, near the end that takes the leg.",
      fix: [fx("camScrew", [[xR0 + 8, yR, -270], [xR0 + 8, yR, -145]], [0, 1, 0], "RT", { mate: "RL" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the leg onto the riser shelf",
      detail: "Push the leg onto the bolts and dowels, then turn its two cams clockwise.",
      fix: [fx("cam", [[xR0 + 8, yR - 30, -270], [xR0 + 8, yR - 30, -145]], [-1, 0, 0], "RL")],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the shelf bottom",
      detail: "Two into each end and two into the top face. Its holes face up, as in the picture.",
      fix: [
        ...[-1, 1].map((sx) => fx("dowel", [-270, -160].map((z): Vec3 => [sx * 400, yM, z]), [-sx, 0, 0], "HB", { len: 30, dia: 8, mate: sx < 0 ? "HSL" : "HSR" })),
        fx("dowel", [[-200, yH1, zH0 + 8], [200, yH1, zH0 + 8]], [0, -1, 0], "HB", { len: 30, dia: 8, mate: "HBK" }),
      ],
      tools: ["hammer"],
    },
    { title: "Set the riser on the shelf bottom", detail: "Its leg's dowels go into the holes, the shelf end to the right.", add: ["RT", "RL"] },
    {
      title: "Screw the cam bolts into the end panels",
      detail: "Three into each end panel's bottom edge.",
      fix: [-1, 1].map((sx) => fx("camScrew", [-290, -215, -140].map((z): Vec3 => [sx * 391, yH1, z]), [0, 1, 0], sx < 0 ? "HSL" : "HSR", { mate: "HB" })),
      tools: ["screwdriver"],
      wait: ["HSL", "HSR"],
      from: { HSL: [-360, 0, 0], HSR: [360, 0, 0] },
    },
    { title: "Push the end panels on", detail: "Rounded corners to the top front. The right one takes the riser's dowels too.", add: ["HSL", "HSR"] },
    {
      title: "Lock the front cams",
      detail: "Two cams into the shelf bottom, turned clockwise until they grip.",
      fix: [-1, 1].map((sx) => fx("cam", [[sx * 360, yH1, zH1 + 20]], [0, 0, -1], "HB")),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the cam bolts into the back panel",
      detail: "Three into its bottom edge.",
      fix: [fx("camScrew", [-250, 0, 250].map((x): Vec3 => [x, yH1, zH0 + 8]), [0, 1, 0], "HBK", { mate: "HB" })],
      tools: ["screwdriver"],
      wait: ["HBK"],
      from: { HBK: [0, 0, -420] },
    },
    {
      title: "Screw the back panel on",
      detail: "Onto the dowels and cam bolts, then six connector screws through it into the ends and the riser.",
      add: ["HBK"],
      fix: [
        ...[-1, 1].map((sx) => fx("screw", [560, 660].map((y): Vec3 => [sx * 391, y, zH0]), [0, 0, 1], "HBK", { ...CONN, mate: sx < 0 ? "HSL" : "HSR" })),
        fx("screw", [[xR0 + 8, 560, zH0], [240, yR + 8, zH0]], [0, 0, 1], "HBK", { ...CONN, mate: "RL" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Turn it over and lock the cams",
      detail: "Seven cams into the shelf bottom, each turned clockwise until it's tight.",
      fix: [fx("cam", [[-391, yH0, -215], [391, yH0, -215], [-391, yH0, -140], [391, yH0, -140], [-250, yH0, zH0 + 30], [0, yH0, zH0 + 30], [250, yH0, zH0 + 30]], [0, 1, 0], "HB")],
      tools: ["screwdriver"],
      pose: "-y",
    },
    {
      title: "Screw the riser to the back",
      detail: "Stand it up again. One more connector screw through the back into the riser shelf.",
      fix: [fx("screw", [[320, yR + 8, zH0]], [0, 0, 1], "HBK", { ...CONN, mate: "RT" })],
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Press the spacers onto the frame",
      detail: "Five rubber spacers onto the studs at the back of the top frame.",
      fix: [fx("glide", spacers, [0, -1, 0], "FR", { name: "Spacer", len: 15, dia: 20 })],
    },
    {
      title: "Bolt the shelf unit on",
      detail: "Set it on the spacers, then five bolts up through the frame into its bottom.",
      add: HUTCH,
      fix: [fx("bolt", spacers.map((p): Vec3 => [p[0], yF0, p[2]]), [0, 1, 0], "FR", { len: 60, dia: 6, mate: "HB" })],
      tools: ["allen"],
    },
    { title: "Slide the book stop on", detail: "Onto the front edge of the desk top. It keeps things from sliding off when it tilts.", add: ["STOP"], from: { STOP: [400, 0, 0] } },
    {
      title: "Screw the strap under the top",
      detail: "One end to the underside of the desk top, the other to the frame, each with a washer. It stops the top tilting too far.",
      fix: [
        fx("strap", [[0, yT0, 40]], [0, 1, 0], "TOP", { name: "Tilt strap" }),
        fx("washer", [[0, yT0 - 2, 40], [0, yF1, zMid]], [0, 1, 0], "TOP"),
        fx("screw", [[0, yT0 - 3, 40]], [0, 1, 0], "TOP", { len: 12, dia: 4 }),
        fx("screw", [[0, yF1 + 3, zMid]], [0, -1, 0], "FR", { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Try the tilt", detail: "Lift the front of the top: the stays on each side lock it in its tilted positions. Lift it all the way to fold it flat again." },
  ];
  return { parts, steps };
}

/** Parts built on their own are shown in their own scene for steps `from` to `until`, and come in at `join`. */
function apart(b: PlanBuilder, r: CustomParams, ids: string[], scene: string, from: number, until: number, join: number, off: Vec3) {
  for (let i = from; i < until; i++) if (b.steps[i]) b.steps[i].scene = scene;
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (!it) continue;
    it.states = it.states.filter((st) => st.step < join).map((st) => ({ ...st, scene }));
    it.states.push({ step: join, scene: "main", pos: it.final.pos, rot: it.final.rot, from: off, delay: 0.2 });
  }
}

const family: Family = {
  names: ["PIPLÄRKA", "PIPLARKA"],
  build(b: PlanBuilder, s: ProductSpec) {
    if (!/desk/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = desk();
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    apart(b, r, HUTCH, "hutch", idx(/dowels into the riser/), idx(/spacers/), idx(/shelf unit on/), [0, 320, 0]);
    return true;
  },
};
export default family;
