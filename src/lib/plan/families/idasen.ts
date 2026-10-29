import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * IDÅSEN, read from the desk underframe's manual (the desk with A-shaped legs set by hand from 65 to 79 cm, no motor).
 * The telescopic beam slides together and is bolted at the length for the top, the two columns and the end brackets
 * are screwed to its ends, and the whole frame is laid on the top, face down on a rug, and bolted to it. The A legs
 * slide over the columns at the chosen height and are bolted through, the feet screw into their ends, the cable net
 * clips under the top, and two people turn the desk over.
 * The drawer unit on castors, from its manual: the two side shells click onto the bottom frame and its two rear
 * posts, the rails across the top and the tray floor are screwed in, the runners go on lying on its back, then
 * upside down the castors and the back panel. Each drawer is a steel box of three sheets hooked together, with a
 * bottom dropped in, set on its front and screwed, then the runner couplings, label holder and handle go on; the
 * deep file drawer also gets a support wheel. Both slide onto the runners last.
 */

const TOP_T = 25;
const BEAM_H = 40, BEAM_D = 80;
const COL = 50;

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yU = H - TOP_T; // underside of the top
  const yB = yU - BEAM_H / 2; // beam centre
  const xc = W / 2 - 110; // columns and legs
  const xe = xc + COL / 2 + 20; // beam ends
  const xj = W / 2 > 700 ? 280 : 200; // where the beam's sections meet
  const parts: CustomPart[] = [
    { id: "BEAM_L", name: "Beam end", size: [xe - xj, BEAM_H - 4, BEAM_D - 6], pos: [-(xe + xj) / 2, yB, 0], material: "metal" },
    { id: "BEAM_C", name: "Beam centre", size: [2 * xj, BEAM_H, BEAM_D], pos: [0, yB, 0], material: "metal" },
    { id: "BEAM_R", name: "Beam end", size: [xe - xj, BEAM_H - 4, BEAM_D - 6], pos: [(xe + xj) / 2, yB, 0], material: "metal" },
  ];
  const colY0 = 140, colY1 = yU - BEAM_H;
  const cols = ["COL_L", "COL_R"];
  [-1, 1].forEach((sx, i) => parts.push({ id: cols[i], name: "Column", size: [COL, colY1 - colY0, COL], pos: [sx * xc, (colY0 + colY1) / 2, 0], shape: "cyl", material: "metal" }));
  const brackets = ["BR_L", "BR_R"];
  const brD = D - 160;
  [-1, 1].forEach((sx, i) => parts.push({ id: brackets[i], name: "End bracket", size: [30, BEAM_H, brD], pos: [sx * (xe + 15), yB, 0], material: "metal" }));
  parts.push({ id: "TOP", name: "Table top", size: [W, TOP_T, D], pos: [0, H - TOP_T / 2, 0], material: "board" });
  // each A leg: a sleeve over the column, two struts splayed to the feet and a bar across low down
  const legs = ["LEG_L", "LEG_R"];
  const yS0 = 110, yS1 = Math.min(400, colY1 - 40); // sleeve
  const zFoot = D / 2 - 70, yBar = 110;
  const ang = Math.atan2(zFoot, yS1 - 20);
  const strutLen = Math.hypot(zFoot, yS1 - 20);
  const legC: Vec3 = [0, (yS1 + 15) / 2, 0];
  const legPieces: PartPiece[] = [
    { shape: "cyl", size: [COL + 12, yS1 - yS0, COL + 12], pos: [0, (yS0 + yS1) / 2 - legC[1], 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [36, strutLen, 36], pos: [0, (yS1 + 20) / 2 - legC[1], (sz * zFoot) / 2], rot: [-sz * ang, 0, 0] })),
    { shape: "box", size: [30, 30, 2 * zFoot * ((yS1 - yBar) / (yS1 - 20))], pos: [0, yBar - legC[1], 0] },
  ];
  [-1, 1].forEach((sx, i) => parts.push({ id: legs[i], name: "A leg", size: [56, yS1 - 15, 2 * zFoot + 56], pos: [sx * xc, legC[1], 0], pieces: legPieces, material: "metal" }));
  // the cable net hangs under the top, behind the beam
  const netW = 2 * xc - 260, netD = 200, netH = 60, zNet = -(BEAM_D / 2 + 20 + netD / 2);
  parts.push({
    id: "NET",
    name: "Cable net",
    size: [netW, netH, netD],
    pos: [0, yU - netH / 2, zNet],
    pieces: [
      { shape: "box", size: [netW, 3, netD], pos: [0, -netH / 2 + 1.5, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [netW, netH, 3], pos: [0, 0, (sz * (netD - 3)) / 2] })),
    ],
    material: "metal",
  });

  const joints = [-1, 1].flatMap((j) => [j * (xj - 40), j * (xj + 40)].flatMap((x) => [yB - 10, yB + 10].map((y): Vec3 => [x, y, BEAM_D / 2])));
  // two through each side wall of the beam end, going in towards the column
  const colScrews = (sx: number, i: number) => [-1, 1].map((sz) => fx("screw", [yB - 12, yB + 12].map((y): Vec3 => [sx * xc, y, sz * (BEAM_D / 2 - 3)]), [0, 0, -sz], i ? "BEAM_R" : "BEAM_L", { len: 12, dia: 6, mate: cols[i] }));
  const brScrews = (sx: number, i: number) => fx("screw", [-14, 14].map((z): Vec3 => [sx * (xe + 30), yB, z]), [-sx, 0, 0], brackets[i], { len: 12, dia: 6, mate: i ? "BEAM_R" : "BEAM_L" });
  const topBolts = (sx: number, i: number) => fx("bolt", [-1, 1].flatMap((sz) => [brD / 2 - 30, brD / 2 - 90].map((z): Vec3 => [sx * (xe + 15), yB - BEAM_H / 2, sz * z])), [0, 1, 0], brackets[i], { len: 20, dia: 6, mate: "TOP" });
  const feet = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xc, 0, sz * zFoot]));
  const netPts = [-0.4, 0, 0.4].flatMap((t) => [-1, 1].map((sz): Vec3 => [t * netW, yU, zNet + (sz * (netD - 10)) / 2]));

  const steps: CustomStep[] = [
    {
      title: "Slide the beam together",
      detail: "Lay the three parts of the beam upside down on a rug and push the two ends into the middle one.",
      add: ["BEAM_C", "BEAM_L", "BEAM_R"],
      from: { BEAM_L: [-260, 0, 0], BEAM_R: [260, 0, 0] },
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: `Bolt it at the length for a ${Math.round(W / 10)} cm top`,
      detail: "Four bolts through each joint, with a nut on the inside. The holes for the longer top are the outer ones.",
      fix: [fx("bolt", joints, [0, 0, -1], "BEAM_C", { len: 20, dia: 6 }), fx("nut", joints.map((p): Vec3 => [p[0], p[1], -BEAM_D / 2]), [0, 0, -1], "BEAM_C", { dia: 10 })],
      tools: ["allen"],
    },
    { title: "Turn the beam over and fit the columns", detail: "Push one column into the bracket at each end, the flat side to the end.", add: cols },
    { title: "Screw the columns to the beam", detail: "Four screws for each, two through each side of the beam end.", fix: [...colScrews(-1, 0), ...colScrews(1, 1)], tools: ["allen"] },
    { title: "Screw on the end brackets", detail: "One across each end of the beam, two screws each. Their curved edges face out.", add: brackets, fix: [brScrews(-1, 0), brScrews(1, 1)], tools: ["allen"] },
    {
      title: "Lay the frame on the top and bolt it on",
      detail: "Put the top face down on the rug, lay the frame on it columns up and line up the holes. Four bolts through each bracket.",
      add: ["TOP"],
      fix: [topBolts(-1, 0), topBolts(1, 1)],
      tools: ["allen"],
      from: { TOP: [0, -260, 0] },
    },
    { title: "Slide the A legs over the columns", detail: "Pick the height first: the same hole on both legs. The legs only go on one way round.", add: legs, from: { LEG_L: [0, -300, 0], LEG_R: [0, -300, 0] } },
    {
      title: "Bolt the legs at that height",
      detail: "A washer on each bolt, two through each leg into its column. Tighten them firmly.",
      fix: [-1, 1].flatMap((sx, i) =>
        [-1, 1].flatMap((sz) => {
          const p: Vec3 = [sx * xc, 300, sz * (COL / 2 + 6)];
          return [fx("washer", [p], [0, 0, -sz], legs[i], { dia: 16 }), fx("bolt", [p], [0, 0, -sz], legs[i], { len: 20, dia: 8, mate: cols[i] })];
        }),
      ),
      tools: ["allen"],
    },
    { title: "Screw a foot into each end of the legs", detail: "Turn them in by hand until they stop.", fix: [fx("foot", feet, [0, 1, 0], undefined, { dia: 56, len: 20 })] },
    {
      title: "Clip the cable net under the top",
      detail: "Push the six holders into the holes behind the beam, hook the net on and knock in the six pins.",
      add: ["NET"],
      fix: [fx("clip", netPts, [0, 1, 0], "NET", { name: "Net holder", mate: "TOP" }), fx("nail", netPts.map((p): Vec3 => [p[0] + 25, p[1], p[2]]), [0, 1, 0], "NET", { name: "Pin", len: 14, dia: 5, mate: "TOP" })],
      tools: ["hammer"],
    },
    { title: "Turn the desk over and level it", detail: "Lift it together onto its feet. Turn the feet to stop it rocking.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

// ---------- the drawer unit on castors ----------

const SHELL = 18; // side shells
const CAST_H = 60;
const SMALL_SCREW: HwDef = { kind: "screw", len: 8, dia: 4 };
const PAN_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };

function unitDims(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xi = W / 2 - SHELL; // inside of the shells
  const trayY = H - 110;
  const fw = 2 * xi - 4; // drawer fronts sit between the shells
  const zf = D / 2 - 10; // front faces' centre
  const dd = D - 70; // drawer box depth
  const dw = 2 * xi - 26; // drawer box width, runners either side
  const drawers = [
    { key: "S", y0: trayY - 125, fh: 115, bh: 90 },
    { key: "F", y0: CAST_H + 20, fh: trayY - 125 - CAST_H - 25, bh: trayY - 125 - CAST_H - 70 },
  ];
  return { W, H, D, xi, trayY, fw, zf, dd, dw, drawers };
}

function carcass(s: ProductSpec): CustomParams {
  const { W, H, D, xi, trayY, drawers } = unitDims(s);
  const parts: CustomPart[] = [
    { id: "BASE", name: "Bottom frame", size: [2 * xi, 25, D - 20], pos: [0, CAST_H + 12.5, 0], material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `POST${i}`, name: "Rear post", size: [20, trayY - CAST_H - 25, 20], pos: [sx * (xi - 10), (CAST_H + 25 + trayY) / 2, -(D / 2 - 40)], material: "metal" })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `SIDE${i}`, name: "Side shell", size: [SHELL, H - CAST_H, D], pos: [sx * (W / 2 - SHELL / 2), (CAST_H + H) / 2, 0], material: "metal" })),
    { id: "RAIL_F", name: "Top rail", size: [2 * xi, 40, 20], pos: [0, H - 20, D / 2 - 10], material: "metal" },
    { id: "RAIL_B", name: "Top rail", size: [2 * xi, 40, 20], pos: [0, H - 20, -(D / 2 - 10)], material: "metal" },
    { id: "TRAY", name: "Tray floor", size: [2 * xi, 15, D - 40], pos: [0, trayY, 0], material: "metal" },
    { id: "BACK", name: "Back panel", size: [2 * xi, trayY - 7.5 - CAST_H - 25, 6], pos: [0, (trayY - 7.5 + CAST_H + 25) / 2, -(D / 2 - 6)], material: "metal" },
  ];
  const sides = ["SIDE0", "SIDE1"];
  const shellScrews = (y: number, z: number) => [-1, 1].map((sx, i) => fx("screw", [[sx * (W / 2 - SHELL), y, z]], [sx, 0, 0], undefined, { ...SMALL_SCREW, mate: sides[i] }));
  const panScrews = (y: number, z: number) => [-1, 1].map((sx, i) => fx("screw", [[sx * (W / 2 - SHELL), y, z]], [sx, 0, 0], undefined, { ...PAN_SCREW, mate: sides[i] }));
  const runnerAt = (sx: number, y: number): Vec3 => [sx * (xi - 6), y, 0];
  const runners = (sx: number, i: number) => [
    fx("runner", drawers.map((d) => runnerAt(sx, d.y0 + 10)), [0, 1, 0], sides[i], { len: D - 70, dia: 40 }),
    fx("screw", drawers.flatMap((d) => [-1, 1].map((sz): Vec3 => [sx * xi, d.y0 + 20, sz * (D / 2 - 60)])), [sx, 0, 0], sides[i], { len: 10, dia: 5 }),
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (xi - 35), CAST_H, sz * (D / 2 - 45)]));
  const steps: CustomStep[] = [
    {
      title: "Click the rear posts into the bottom frame",
      detail: "Lay the frame on a rug. Each post clicks into a back corner.",
      add: ["BASE", "POST0", "POST1"],
      warnings: ["floor"],
    },
    { title: "Click a side shell onto the frame", detail: "Lower it over the frame's edge until both pegs click into place.", add: ["SIDE0"], from: { SIDE0: [0, 300, 0] } },
    { title: "Lower the other side shell on", detail: "The same way, on the other side.", add: ["SIDE1"], from: { SIDE1: [0, 300, 0] } },
    { title: "Screw the shells to the posts", detail: "One small screw at the top of each post, then bend the two tabs at the bottom over.", fix: shellScrews(trayY - 40, -(D / 2 - 40)), tools: ["screwdriver"] },
    { title: "Fit the front top rail", detail: "Hook it in under the top edge and swing it up into place.", add: ["RAIL_F"] },
    { title: "Screw it to the shells", detail: "One screw at each end.", fix: panScrews(H - 20, D / 2 - 10), tools: ["screwdriver"] },
    { title: "Drop in the back top rail and screw it", detail: "One small screw at each end.", add: ["RAIL_B"], fix: shellScrews(H - 20, -(D / 2 - 10)), tools: ["screwdriver"] },
    { title: "Fit the tray floor", detail: "Slide it in at the back, under the top rails, and swing the front up.", add: ["TRAY"] },
    { title: "Screw the tray floor in", detail: "One screw through each shell.", fix: panScrews(trayY, 0), tools: ["screwdriver"] },
    { title: "Lay it on its back and screw on the left runners", detail: "Both runners on this side, two screws each, wheels at the front.", fix: runners(-1, 0), pose: "+z" },
    { title: "Screw on the right runners", detail: "The same on the other side. The runners are marked left and right.", fix: runners(1, 1) },
    { title: "Turn it upside down and screw in the castor plates", detail: "One screw in each corner of the bottom frame.", fix: [fx("screw", corners.map((p): Vec3 => [p[0] + 20, p[1], p[2]]), [0, 1, 0], "BASE", PAN_SCREW)], pose: "-y", tools: ["screwdriver"] },
    { title: "Screw in the castors", detail: "Turn each one in by hand, then tighten with the spanner.", fix: [fx("castor", corners, [0, 1, 0], "BASE", { len: CAST_H, dia: 50 })], tools: ["wrench"] },
    { title: "Slide in the back panel", detail: "Down the grooves at the back of the shells, as far as the tray floor.", add: ["BACK"], from: { BACK: [0, -320, 0] } },
    { title: "Press in the four rivets", detail: "Through the back panel into the posts, two each side.", fix: [fx("clip", [-1, 1].flatMap((sx) => [0.3, 0.75].map((t): Vec3 => [sx * (xi - 10), CAST_H + 25 + t * (trayY - CAST_H - 25), -(D / 2)])), [0, 0, 1], "BACK", { name: "Plastic rivet", len: 14, dia: 8 })] },
  ];
  return { parts, steps };
}

/** One drawer, built on its front in its own scene, then left to slide in with the other one at the end. */
function unitDrawer(b: PlanBuilder, s: ProductSpec, d: ReturnType<typeof unitDims>["drawers"][number], file: boolean) {
  const { D, fw, zf, dd, dw } = unitDims(s);
  const scene = file ? "file" : "drawer";
  const zb = zf - 10; // back of the front
  const yb = d.y0 + 25; // underside of the box
  const front = b.place(b.part("Drawer front", [fw, d.fh, 20]), [0, d.y0 + d.fh / 2, zf]);
  const sideT = b.part(file ? "File drawer side" : "Drawer side", [10, d.bh, dd], { material: "metal" });
  const sides = [-1, 1].map((g) => b.place(sideT, [g * (dw / 2 - 5), yb + d.bh / 2, zb - dd / 2]));
  const back = b.place(b.part(file ? "File drawer back" : "Drawer back", [dw - 20, d.bh, 10], { material: "metal" }), [0, yb + d.bh / 2, zb - dd + 5]);
  const bottom = b.place(b.part(file ? "File drawer bottom" : "Drawer bottom", [dw - 20, 6, dd - 10], { material: "metal" }), [0, yb + 3, zb - dd / 2 - 5]);
  const wheel = file ? b.place(b.part("Support wheel", [40, 45, 40], { material: "metal" }), [0, yb - 22.5, zb - dd + 40]) : undefined;
  const all = [front, ...sides, back, bottom, ...(wheel ? [wheel] : [])];
  const c0: Vec3 = [0, yb + d.bh / 2, zb - dd / 2];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const st = (title: string, detail: string, body: () => void, o: { tools?: ("screwdriver" | "wrench")[]; pose?: "-z" | "-y" | "+z" } = {}) =>
    b.step({ title, detail, tools: o.tools, scene, pose: o.pose ?? "+z", kind: "drawer" }, body);
  const tabs = file ? 6 : 4;
  const boxScrews: FitOpts[] = [-1, 1].flatMap((g) => Array.from({ length: tabs / 2 }, (_, k) => ({ on: sides[g < 0 ? 0 : 1], at: [g * (dw / 2 - 10), yb + ((k + 1) * d.bh) / (tabs / 2 + 1), zb] as Vec3, dir: [0, 0, 1] as Vec3, mate: front })));
  // each coupling is held by two short screws from below, through its plate into the drawer bottom
  const couplings: FitOpts[] = [-1, 1].map((g) => ({ on: bottom, at: [g * (dw / 2 - 30), yb, zb - 80], dir: [0, 1, 0], hole: false }));
  const couplingScrews: FitOpts[] = [-1, 1].flatMap((g) => [-24, 24].map((dz): FitOpts => ({ on: bottom, at: [g * (dw / 2 - 30), yb - 10, zb - 80 + dz], dir: [0, 1, 0] })));
  const name = file ? "the file drawer" : "the small drawer";

  st(`Hook a side onto the back of ${name}`, "Slide the hooks on the side's edge into the slots in the back and push it down.", () => {
    stage(back, [0, 0, -200]);
    b.then(0.1);
    stage(sides[0], [-200, 0, 0]);
  });
  st("Hook on the other side and turn it round", "The same at the other end of the back, so the three sheets make a U.", () => stage(sides[1], [200, 0, 0]));
  st("Drop the bottom in", "From the open front, down onto the ledges inside.", () => stage(bottom, [0, 220, 0]));
  st(`Press the ${tabs} tabs down`, "Push each tab under the bottom's edge so it can't lift.", () => b.wait(0.4));
  st("Set the box on the front", "Lay the front face down on the rug and stand the box on it, inside the rim.", () => stage(front, [0, 0, 200]), { pose: "-z" });
  st("Screw the box to the front", `${tabs} small screws through the box's flanges into the front.`, () => b.fits(SMALL_SCREW, boxScrews, 0.08), { tools: ["screwdriver"], pose: "-z" });
  st("Screw on the runner couplings", "Turn the drawer upside down. One under each front corner, the left and right ones are marked.", () => {
    b.fits({ kind: "clip", len: 40, dia: 30, name: "Runner coupling" }, couplings, 0.15);
    b.then(0.1);
    b.fits({ kind: "screw", len: 14, dia: 4 }, couplingScrews, 0.1);
  }, { tools: ["screwdriver"], pose: "-y" });
  st("Clip in the label holder", "Window first, then the card and the frame, pressed into the square hole in the front.", () => b.fit({ kind: "clip", len: 6, dia: 40, name: "Label holder" }, { on: front, at: [-fw / 2 + 50, d.y0 + d.fh - 45, zf + 10], dir: [0, 0, -1], hole: false }), { pose: "+z" });
  st("Screw on the handle", "Two screws from inside the front.", () => {
    b.fit(HW.handle, { on: front, at: [40, d.y0 + d.fh - 45, zf + 10], dir: [0, 0, -1], hole: false });
    b.then(0.1);
    b.fits({ kind: "screw", len: 10, dia: 4 }, [-50, 130].map((x): FitOpts => ({ on: front, at: [x, d.y0 + d.fh - 45, zf - 10], dir: [0, 0, 1] })), 0.1);
  }, { tools: ["screwdriver"], pose: "+z" });
  if (wheel)
    st("Screw the support wheel under the back", "Turn the drawer over again. Two screws through its plate into the bottom.", () => {
      stage(wheel, [0, -160, 0]);
      b.then(0.1);
      b.fits(PAN_SCREW, [-12, 12].map((x): FitOpts => ({ on: wheel, at: [x, yb - 6, zb - dd + 40], dir: [0, 1, 0], mate: bottom })), 0.1);
    }, { tools: ["screwdriver"], pose: "-y" });
  void D;
  return all;
}

function buildUnit(b: PlanBuilder, s: ProductSpec) {
  buildCustom(b, { ...s, custom: carcass(s) });
  const dims = unitDims(s);
  const file = unitDrawer(b, s, dims.drawers[1], true);
  const small = unitDrawer(b, s, dims.drawers[0], false);
  b.step({ title: "Slide the drawers onto the runners", detail: "Pull the runners out, set each drawer on them and push it in until the couplings click. The deep one goes at the bottom.", kind: "drawer", pose: "+y" }, () => {
    for (const set of [file, small]) {
      b.stagger(0);
      for (const k of set) b.add(k, [0, 0, 420]);
      b.wait(0.25);
    }
  });
}

const family: Family = {
  names: ["IDÅSEN", "IDASEN"],
  recipe(s) {
    if (s.archetype !== "table" || !/desk/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    // the sit/stand desk with a motor has its own manual
    if (/sit|stand|electric/i.test(s.variant)) return null;
    return desk(s);
  },
  build(b, s) {
    if (!/drawer unit/i.test(`${s.variant} ${s.slug?.replace(/-/g, " ") ?? ""}`)) return false;
    buildUnit(b, s);
    return true;
  },
};
export default family;
