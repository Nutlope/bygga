import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VIKHAMMER, read from its manual (one manual for the 40 and the 60 wide; only the widths change). A box with a
 * drawer under the top and an open shelf below it, on a steel frame. The bottom panel gets cam bolts and dowels, the
 * sides (each with a drawer runner screwed inside) stand on it and lock with cam locks, the back slides down their
 * grooves and the top presses onto dowels. Upside down, two U-shaped leg frames are screwed to the bottom and the
 * floor ring is bolted onto the legs, its holes capped. The drawer is built on its front: cam bolts, sides, cam
 * locks, the bottom down the grooves, the back knocked on, two catches underneath, then it clicks onto the runners.
 */

const T = 18; // box panels
const TUBE = 20; // steel frame
const FRAME_H = 350; // floor to the box
const CAM_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 6, name: "Euro screw" };
const PIN: HwDef = { kind: "nail", len: 40, dia: 6, name: "Ribbed pin" };
const CATCH: HwDef = { kind: "clip", len: 30, dia: 22, name: "Runner catch" };

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

function dims(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const y0 = FRAME_H; // underside of the box
  const Wi = W - 2 * T;
  // the drawer: its front fills the opening under the top, its box sits on the runners
  const fTop = H - T - 3, fH = 130;
  const yd = fTop - fH + 25; // underside of the drawer box
  const sh = 85;
  const Dw = Wi - 10;
  const dd = Math.min(340, D - 50);
  const zf = D / 2 - 16; // back face of the drawer front
  return { W, H, D, y0, Wi, fTop, fH, yd, sh, Dw, dd, zf };
}

function boxRecipe(s: ProductSpec): { parts: CustomPart[]; steps: CustomStep[] } {
  const { W, H, D, y0, Wi, yd } = dims(s);
  const boxH = H - y0;
  const parts: CustomPart[] = [
    { id: "BOT", name: "Bottom panel", size: [W, T, D], pos: [0, y0 + T / 2, 0] },
    { id: "SIDE_L", name: "Side panel", size: [T, boxH - 2 * T, D], pos: [-(W / 2 - T / 2), y0 + boxH / 2, 0] },
    { id: "SIDE_R", name: "Side panel", size: [T, boxH - 2 * T, D], pos: [W / 2 - T / 2, y0 + boxH / 2, 0] },
    { id: "BACK", name: "Back panel", size: [Wi + 16, boxH - 2 * T, 8], pos: [0, y0 + boxH / 2, -D / 2 + 20] },
    { id: "TOP", name: "Top panel", size: [W, T, D], pos: [0, H - T / 2, 0] },
  ];
  // two U-shaped leg frames (front leg, back leg and the rail across their tops) and the ring on the floor
  const legH = FRAME_H - 2 * TUBE;
  const uPieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [TUBE, legH, TUBE], pos: [0, -TUBE / 2, sz * (D / 2 - TUBE / 2)] })),
    { shape: "box", size: [TUBE, TUBE, D], pos: [0, (FRAME_H - TUBE) / 2 - TUBE / 2, 0] },
  ];
  const frames = ["FRAME_L", "FRAME_R"];
  [-1, 1].forEach((sx, i) => parts.push({ id: frames[i], name: "Leg frame", size: [TUBE, FRAME_H - TUBE, D], pos: [sx * (W / 2 - TUBE / 2), TUBE + (FRAME_H - TUBE) / 2, 0], pieces: uPieces, material: "metal" }));
  const ringPieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [W, TUBE, TUBE], pos: [0, 0, sz * (D / 2 - TUBE / 2)] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [TUBE, TUBE, D - 2 * TUBE], pos: [sx * (W / 2 - TUBE / 2), 0, 0] })),
  ];
  parts.push({ id: "RING", name: "Floor frame", size: [W, TUBE, D], pos: [0, TUBE / 2, 0], pieces: ringPieces, material: "metal" });

  const sides = ["SIDE_L", "SIDE_R"];
  const xs = (sx: number) => sx * (W / 2 - T / 2);
  const camBolts = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [xs(sx), y0 + T, sz * (D / 2 - 45)]));
  const dowelsLow = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [xs(sx), y0 + T, sz * (D / 2 - 130)]));
  const dowelsTop = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [xs(sx), H - T, sz * (D / 2 - 60)]));
  const runnerZ = D / 2 - 16 - 170;
  const legCorners = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (W / 2 - TUBE / 2), 0, sz * (D / 2 - TUBE / 2)]));

  const steps: CustomStep[] = [
    {
      title: "Screw four cam bolts into the bottom panel",
      detail: "Lay it on a rug, holes up. The bottom is the panel with holes for the frame screws underneath; the top has none.",
      add: ["BOT"],
      fix: [fx("camScrew", camBolts, [0, -1, 0], "BOT", { len: CAM_BOLT.len, dia: CAM_BOLT.dia })],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw a drawer runner inside each side",
      detail: "Lay the sides down, inside face up. The runners are marked left and right; two screws each, through the front and back holes.",
      fix: [
        ...[-1, 1].map((sx, i) => fx("runner", [[sx * (Wi / 2 - 7), yd - 2, runnerZ]], [0, 1, 0], sides[i], { len: 320, dia: 40 })),
        ...[-1, 1].map((sx, i) => fx("screw", [runnerZ - 130, runnerZ + 130].map((z): Vec3 => [sx * (W / 2 - T), yd - 12, z]), [sx, 0, 0], sides[i], { len: RUNNER_SCREW.len, dia: RUNNER_SCREW.dia, name: RUNNER_SCREW.name })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap in four dowels and stand the sides on the bottom",
      detail: "The runners face in, towards each other. Push each side down onto its dowels and cam bolts.",
      add: sides,
      // straight down onto the dowels and cam bolts
      from: { SIDE_L: [0, 300, 0], SIDE_R: [0, 300, 0] },
      fix: [fx("dowel", dowelsLow, [0, -1, 0], "BOT")],
      tools: ["hammer"],
    },
    {
      title: "Lock the sides with cam locks",
      detail: "Four in all, low on the inside of the sides. Arrow towards the bolt, then turn clockwise.",
      fix: [-1, 1].map((sx, i) => fx("cam", [-1, 1].map((sz): Vec3 => [sx * (W / 2 - T), y0 + T + 28, sz * (D / 2 - 45)]), [sx, 0, 0], sides[i], { dia: 15 })),
      tools: ["screwdriver"],
    },
    { title: "Slide the back panel down the grooves", detail: "From the top, until it rests on the bottom panel.", add: ["BACK"], from: { BACK: [0, 320, 0] } },
    { title: "Tap dowels into the tops of the sides", detail: "Two in each side's top edge.", fix: [-1, 1].map((sx, i) => fx("dowel", dowelsTop.filter((q) => q[0] * sx > 0), [0, -1, 0], sides[i], { mate: "TOP" })), tools: ["hammer"] },
    { title: "Press the top panel on", detail: "Line it up with the dowels and press down evenly until it sits tight.", add: ["TOP"] },
    {
      title: "Turn it over and screw on the leg frames",
      detail: "Lay the box upside down on the rug. Each U frame lies across the bottom along a side, two screws through it.",
      add: frames,
      fix: [-1, 1].map((sx, i) => fx("screw", [-1, 1].map((sz): Vec3 => [sx * (W / 2 - TUBE / 2), FRAME_H - TUBE, sz * (D / 2 - 45)]), [0, 1, 0], frames[i], { len: 40, dia: 5, mate: "BOT" })),
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the floor frame onto the legs",
      detail: "Its corners sit flush on the ends of the legs. One bolt into each.",
      add: ["RING"],
      fix: [-1, 1].map((sx, i) => fx("bolt", legCorners.filter((q) => q[0] * sx > 0), [0, 1, 0], "RING", { len: 16, dia: 6, mate: frames[i] })),
      tools: ["allen"],
    },
    { title: "Press a cap into each corner and turn it over", detail: "The caps hide the bolt heads. Then stand it up on the frame.", fix: [fx("cap", legCorners, [0, 1, 0], "RING", { dia: 18 })] },
  ];
  return { parts, steps };
}

function drawer(b: PlanBuilder, s: ProductSpec) {
  const { D, Wi, fTop, fH, yd, sh, Dw, dd, zf } = dims(s);
  const xd = Dw / 2 - 6; // drawer side centres
  const front = b.place(b.part("Drawer front", [Wi - 4, fH, 16]), [0, fTop - fH / 2, D / 2 - 8]);
  const sideT = b.part("Drawer side", [12, sh, dd]);
  const sides = [-1, 1].map((g) => b.place(sideT, [g * xd, yd + sh / 2, zf - dd / 2]));
  const bottom = b.place(b.part("Drawer bottom", [Dw - 12, 3, dd - 6], { material: "fiber" }), [0, yd + 8, zf - dd / 2 + 3]);
  const zBack = zf - dd - 6;
  const back = b.place(b.part("Drawer back", [Dw, sh, 12]), [0, yd + sh / 2, zBack]);
  const all = [front, ...sides, bottom, back];
  const per = (fn: (g: number, sd: string) => FitOpts[]) => [-1, 1].flatMap((g) => fn(g, sides[g < 0 ? 0 : 1]));
  const bolts = per((g, sd) => [yd + 22, yd + sh - 22].map((y): FitOpts => ({ on: front, at: [g * xd, y, zf], dir: [0, 0, 1], mate: sd, mateHole: 4 })));
  const cams = per((g, sd) => [yd + 22, yd + sh - 22].map((y): FitOpts => ({ on: sd, at: [g * (xd - 6), y, zf - 30], dir: [g, 0, 0] })));
  const pins = per((g, sd) => [yd + 20, yd + sh - 20].map((y): FitOpts => ({ on: back, at: [g * xd, y, zBack - 6], dir: [0, 0, 1], mate: sd, hole: false })));
  const catches = [-1, 1].map((g): FitOpts => ({ on: bottom, at: [g * (Dw / 2 - 40), yd + 6, zf - 40], dir: [0, 1, 0], hole: false }));

  const c0: Vec3 = [0, yd + sh / 2, zf - dd / 2];
  const rel = (k: string): Vec3 => {
    const it = b.partItem(k);
    return [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]];
  };
  const stage = (k: string, from: Vec3) => b.stage(k, rel(k), b.partItem(k).final.rot, from);
  const dstep = (title: string, detail: string, body: () => void, o: { tools?: ("screwdriver" | "hammer")[]; kind?: "dowels" | "cams" | "drawer" | "nails"; pose?: "-z" | "-y" } = {}) =>
    b.step({ title, detail, tools: o.tools, scene: "drawer", pose: o.pose ?? "-z", kind: o.kind ?? "drawer" }, body);

  dstep(
    "Screw four cam bolts into the drawer front",
    "Lay the front face down on the rug, two bolts near each end.",
    () => {
      stage(front, [0, 0, -160]);
      b.then(0.15);
      b.fits(CAM_BOLT, bolts, 0.1);
    },
    { tools: ["screwdriver"], kind: "cams" },
  );
  dstep("Stand the drawer sides on the front", "Grooves facing in, at the bottom, so the drawer bottom can slide in.", () => {
    b.stagger(0.25);
    for (const sd of sides) stage(sd, [0, 0, -300]);
  });
  dstep("Lock the sides with cam locks", "Two in each side. Arrow towards the bolt, then turn clockwise.", () => b.fits(HW.cam, cams, 0.12), { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide in the drawer bottom", "Down the grooves, smooth side up, until it reaches the front.", () => stage(bottom, [0, 0, -420]));
  dstep(
    "Knock the drawer back on",
    "Lay it over the ends of the sides and knock the four pins through it, with a scrap of wood under the hammer.",
    () => {
      stage(back, [0, 0, -250]);
      b.then(0.15);
      b.fits(PIN, pins, 0.12);
    },
    { tools: ["hammer"], kind: "nails" },
  );
  dstep("Clip the catches under the front", "Turn the drawer upside down. One catch under each front corner, pressed onto the runner pegs' holes.", () => b.fits(CATCH, catches, 0.15), { pose: "-y" });

  b.step(
    { title: "Slide the drawer onto the runners", detail: "Pull the runners out, set the drawer on them and push it in until the catches click. The catches also adjust the front's height.", kind: "drawer", pose: "+y" },
    () => {
      b.stagger(0);
      for (const k of all) b.add(k, [0, 0, 420]);
    },
  );
}

const family: Family = {
  names: ["VIKHAMMER"],
  build(b, s) {
    if (!/bedside|nightstand/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = boxRecipe(s);
    const W = s.size.w * 10;
    const sideStep = r.steps.findIndex((x) => /runner inside each side/.test(x.title));
    const keyOf = (id: string) => {
      const p = r.parts.find((q) => q.id === id)!.pos;
      return b.items.find((it) => it.kind === "part" && it.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5))?.key;
    };
    const step = b.step.bind(b);
    // the sides lie flat beside the bottom panel, inside face up, while their runners go on
    b.step = (def, body) =>
      step(def, () => {
        if (b.steps.length - 1 === sideStep) {
          b.stagger(0.15);
          [-1, 1].forEach((sx, i) => {
            const id = i ? "SIDE_R" : "SIDE_L";
            const k = keyOf(id);
            if (k) b.stage(k, [sx * (W / 2 + 60 + (r.parts.find((q) => q.id === id)!.size[1]) / 2), FRAME_H + T / 2, 0], [0, 0, sx * (-Math.PI / 2)], [0, 200, 0]);
          });
          b.then(0.15);
        }
        body();
      });
    try {
      buildCustom(b, { ...s, custom: r });
    } finally {
      b.step = step;
    }
    drawer(b, s);
    return true;
  },
};
export default family;
