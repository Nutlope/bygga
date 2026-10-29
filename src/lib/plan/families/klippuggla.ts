import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KLIPPUGGLA, read from the storage bed's manual, the branch with the open compartment at the foot end on the right
 * (as IKEA's photo shows it). The two long bottom boards and the compartment's bottom get their feet upside down,
 * the front one takes the lower door track, and dowels and cam bolts go into the boards and dividers. The two cross
 * dividers are cam-locked onto the bottom boards, the top rails go on over dowels and cams, and the centre beam is
 * screwed together from two layers and screwed onto the dividers. The back (two halves joined first) slides in,
 * the end panels are bolted on with barrel nuts and long bolts, the two sliding doors go into their tracks between
 * the ends, and the slatted base is rolled out on its stops.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const DOWEL = { len: 30, dia: 8 };
const BIG_DOWEL = { len: 40, dia: 10, name: "Large dowel" };
const CAM_BOLT = { len: 34, dia: 7 };
const CAM = { len: 12, dia: 15 };

function recipe(s: ProductSpec): CustomParams | null {
  if (!/klippuggla/i.test(s.slug ?? s.name) || !/bed/i.test(s.variant)) return null;
  // IKEA's measures: 206 x 96 (90x200) or 196 x 102 (US twin); the box height is read off the photo
  const twin = /twin/i.test(`${s.slug ?? ""} ${s.variant}`);
  const L = twin ? 1960 : 2060, W = twin ? 1020 : 960;
  const H = 420; // top of the frame, under the slats
  const lip = 40; // the ends and back stand this far above the slats
  const t = 18, feet = 30;
  const bw = 250; // bottom boards, front to back
  const cw = 420; // the open compartment
  const xL = -L / 2 + t, xR = L / 2 - t;
  const xC = xR - cw - t / 2; // the compartment's divider
  const x1 = (xL + xC - t / 2) / 2; // the middle divider behind the doors
  const yb = feet + t; // top of the bottom boards
  const parts: CustomPart[] = [];
  const P = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, material: "board", ...o });

  P("FB", "Bottom board", [L - 2 * t, t, bw], [0, feet + t / 2, W / 2 - bw / 2]);
  P("KB", "Bottom board", [L - 2 * t, t, bw], [0, feet + t / 2, -W / 2 + t + bw / 2]);
  P("CB", "Compartment bottom", [cw, t, W - 2 * bw - t], [xR - cw / 2, feet + t / 2, t / 2]);
  const doorL = xC - t / 2 - xL;
  P("TRK", "Door track", [doorL, 8, 44], [(xL + xC - t / 2) / 2, yb + 4, W / 2 - 46], { material: "metal" });
  const divD = W - t - 60;
  const divH = H - 60 - yb;
  P("D1", "Divider", [t, divH, divD], [x1, yb + divH / 2, -W / 2 + t + divD / 2]);
  P("D2", "Divider", [t, divH, divD], [xC, yb + divH / 2, -W / 2 + t + divD / 2]);
  P("TF", "Top rail", [L - 2 * t, 60, 30], [0, H - 30, W / 2 - 15]);
  P("TK", "Top rail", [L - 2 * t, 60, 30], [0, H - 30, -W / 2 + t + 15]);
  const beam: PartPiece[] = [
    { shape: "box", size: [L - 2 * t, 60, 30], pos: [0, 0, -15] },
    { shape: "box", size: [L - 2 * t, 60, 30], pos: [0, 0, 15] },
  ];
  P("BM", "Centre beam", [L - 2 * t, 60, 60], [0, H - 30, 0], { pieces: beam });
  const backH = H + lip - feet;
  P("BK1", "Back panel", [(L - 2 * t) / 2, backH, t], [-(L - 2 * t) / 4, feet + backH / 2, -W / 2 + t / 2]);
  P("BK2", "Back panel", [(L - 2 * t) / 2, backH, t], [(L - 2 * t) / 4, feet + backH / 2, -W / 2 + t / 2]);
  P("ER", "End panel", [t, backH, W], [L / 2 - t / 2, feet + backH / 2, 0]);
  P("EL", "End panel", [t, backH, W], [-L / 2 + t / 2, feet + backH / 2, 0]);
  const dw = doorL / 2 + 30, dh = H - 60 - yb - 8;
  P("DR1", "Sliding door", [dw, dh, t], [xL + dw / 2, yb + 8 + dh / 2, W / 2 - 34], { material: "wood" });
  P("DR2", "Sliding door", [dw, dh, t], [xC - t / 2 - dw / 2, yb + 8 + dh / 2, W / 2 - 58], { material: "wood" });
  const nSlat = 17;
  const sl = L - 2 * t - 30;
  const slatXs = Array.from({ length: nSlat }, (_, i) => -sl / 2 + 35 + ((sl - 70) * i) / (nSlat - 1));
  parts.push({
    id: "SL",
    name: "Slatted base",
    size: [sl, 14, W - 2 * t - 70],
    pos: [0, H + 7, -t / 2 - 15],
    pieces: slatXs.map((x) => ({ shape: "box" as const, size: [68, 14, W - 2 * t - 70] as Vec3, pos: [x, 0, 0] as Vec3 })),
    material: "wood",
  });
  parts.push({ id: "MAT", name: "Mattress", size: [L - 60, 150, W - 60], pos: [0, H + 14 + 75, 0], material: "soft", extra: true });

  // where things go
  const zF = W / 2 - bw / 2, zK = -W / 2 + t + bw / 2;
  const footXs = [-L / 2 + 120, -L / 6, L / 6, L / 2 - cw - 60];
  const feetPts: Vec3[] = [...footXs.map((x) => [x, feet, zF] as Vec3), ...footXs.map((x) => [x, feet, zK] as Vec3)];
  const endDowels = (x: number): Vec3[] => [zF - 80, zF, zF + 80, zK - 60, zK + 60].map((z) => [x, feet + t / 2, z] as Vec3);
  const endPegs = (sx: number) => at("dowel", [H - 30, feet + 80, H / 2].flatMap((y) => [-W / 2 + 60, W / 2 - 60].map((z) => [sx * (L / 2 - t), y, z] as Vec3)), [sx, 0, 0], sx < 0 ? "EL" : "ER", undefined, DOWEL);
  const divFoot = (x: number): Vec3[] => [zF, zK].map((z) => [x, yb, z] as Vec3);
  const divTop = (x: number): Vec3[] => [W / 2 - 50, -W / 2 + t + 30].map((z) => [x, H - 60, z] as Vec3);
  const steps: CustomStep[] = [
    {
      title: "Lay out the bottom boards and fit two glides",
      detail: "On a rug: the two long boards and the small compartment bottom. Press the two glides into the small one.",
      add: ["FB", "KB", "CB"],
      fix: [at("glide", [[xR - cw / 2 - 120, feet, 0], [xR - cw / 2 + 120, feet, 0]], [0, 1, 0], "CB", undefined, { len: 6, dia: 20, name: "Glide" })],
      warnings: ["floor"],
    },
    {
      title: "Screw the feet in",
      detail: "Boards upside down. Four feet in each long board and one in the compartment bottom.",
      fix: [at("foot", [...feetPts, [xR - cw / 2, feet, 0]], [0, 1, 0], undefined, undefined, { len: feet, dia: 40, name: "Adjustable foot" })],
      pose: "-y",
    },
    { title: "Turn the boards back over", detail: "Feet down, holes up.", pose: "+y" },
    { title: "Click the door track into the front board", detail: "Into the groove along its top, the right way round: the two channels face up.", add: ["TRK"] },
    {
      title: "Tap dowels into the board ends",
      detail: "Ten small dowels, five in each end of the long boards, where the end panels go.",
      fix: [at("dowel", endDowels(-L / 2 + t), [-1, 0, 0], undefined, undefined, DOWEL), at("dowel", endDowels(L / 2 - t), [1, 0, 0], undefined, undefined, DOWEL)],
      tools: ["hammer"],
    },
    { title: "Screw in the long connector", detail: "One, by hand into the front board, next to the compartment.", fix: [at("camScrew", [[xC + 60, yb, zF]], [0, -1, 0], "FB", undefined, { len: 60, dia: 8, name: "Long connector" })] },
    { title: "Fit two cam locks", detail: "Arrows towards the edge, in the compartment bottom.", fix: [at("cam", [[xR - cw / 2 - 100, yb, 60], [xR - cw / 2 + 100, yb, 60]], [0, -1, 0], "CB", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw cam bolts into the bottom boards",
      detail: "Seven, by hand, in the holes where the dividers stand.",
      fix: [at("camScrew", [...divFoot(x1), ...divFoot(xC), [xC, yb, zF - 60], [x1, yb, zF - 60], [x1, yb, zK + 60]], [0, -1, 0], "FB", undefined, CAM_BOLT)],
    },
    {
      title: "Tap dowels into the dividers",
      detail: "Small ribbed dowels along their top edges. Six more go into each end panel when you fit it.",
      fix: [
        at("dowel", [-W / 2 + t + 80, -W / 2 + t + 300, 120, W / 2 - 160].map((z) => [x1, H - 60, z] as Vec3), [0, -1, 0], "D1", undefined, DOWEL),
        at("dowel", [-W / 2 + t + 80, 0, W / 2 - 160].map((z) => [xC, H - 60, z] as Vec3), [0, -1, 0], "D2", undefined, DOWEL),
      ],
      tools: ["hammer"],
    },
    { title: "Screw cam bolts into the dividers", detail: "Four, by hand, in the top edges where the rails go. Mind the marked hole: it stays empty.", fix: [at("camScrew", [...divTop(x1), ...divTop(xC)], [0, -1, 0], "D1", undefined, CAM_BOLT)] },
    {
      title: "Stand the middle divider on the bottom boards",
      detail: "Over its cam bolts, then two cam locks, turned with the screwdriver.",
      add: ["D1"],
      fix: [at("cam", divFoot(x1).map((p) => [p[0] - t / 2, p[1] + 40, p[2]] as Vec3), [1, 0, 0], "D1", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Stand the compartment divider up",
      detail: "Next to the compartment bottom. Two more cam locks.",
      add: ["D2"],
      fix: [at("cam", divFoot(xC).map((p) => [p[0] + t / 2, p[1] + 40, p[2]] as Vec3), [-1, 0, 0], "D2", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the bracket under the compartment",
      detail: "The small angle bracket joins the divider to the compartment bottom: two small screws.",
      fix: [at("angle", [[xC + t / 2, yb, 0]], [1, 0, 0], "D2", "CB", { len: 40, dia: 30 }), at("screw", [[xC + t / 2 + 2, yb + 20, 0]], [-1, 0, 0], "D2", undefined, { len: 12, dia: 3.5 }), at("screw", [[xC + 30, yb + 2, 0]], [0, -1, 0], "CB", undefined, { len: 12, dia: 3.5 })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the large dowels into the top rails",
      detail: "Eight, four in each rail, along the underside where the dividers meet it.",
      fix: [at("dowel", [x1, xC, xL + 40, xR - 40].map((x) => [x, H - 60, W / 2 - 15] as Vec3), [0, 1, 0], "TF", undefined, BIG_DOWEL), at("dowel", [x1, xC, xL + 40, xR - 40].map((x) => [x, H - 60, -W / 2 + t + 15] as Vec3), [0, 1, 0], "TK", undefined, BIG_DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Lay the top rails on the dividers",
      detail: "The front one has the upper door track. Lock each joint with cam locks: eight in all.",
      add: ["TF", "TK"],
      fix: [at("cam", [x1, xC].flatMap((x) => [-1, 1].flatMap((sx) => [W / 2 - 15, -W / 2 + t + 15].map((z) => [x + sx * 60, H - 40, z] as Vec3))), [0, -1, 0], undefined, undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the centre beam together",
      detail: "Its two layers side by side, fourteen screws along the top.",
      add: ["BM"],
      fix: [at("screw", Array.from({ length: 14 }, (_, i) => [-(L - 2 * t) / 2 + 80 + ((L - 2 * t - 160) * i) / 13, H, 0] as Vec3), [0, -1, 0], "BM", undefined, { len: 50, dia: 5 })],
      tools: ["screwdriver"],
      from: { BM: [0, 300, 0] },
    },
    {
      title: "Screw the beam onto the dividers",
      detail: "Three screws down through the beam: one into each divider and one into the compartment end.",
            // behind the beam's seam screws, so they don't meet them
      fix: [at("screw", [[x1, H, -22], [xC, H, -22], [xR - 30, H, -22]], [0, -1, 0], "BM", undefined, { len: 70, dia: 6 })],
      tools: ["screwdriver"],
    },
    {
      title: "Join the two back panels",
      detail: "Edge to edge, four connectors, then six cam bolts in the holes along their edges.",
      add: ["BK1", "BK2"],
      fix: [
        at("connector", [0.2, 0.4, 0.6, 0.8].map((f) => [0, feet + backH * f, -W / 2 + t / 2] as Vec3), [1, 0, 0], "BK1", "BK2", { len: 30, dia: 10 }),
        at("camScrew", [x1, 0, xC].flatMap((x) => [feet + 80, H - 60].map((y) => [x, y, -W / 2 + t] as Vec3)), [0, 0, -1], "BK1", undefined, CAM_BOLT),
      ],
      from: { BK1: [0, 0, -400], BK2: [0, 0, -400] },
    },
    {
      title: "Slide the back on and lock it",
      detail: "Its cam bolts into the dividers and the beam. Three cam locks.",
      fix: [at("cam", [[x1 + 40, feet + 80, -W / 2 + t + 40], [xC + 40, feet + 80, -W / 2 + t + 40], [x1 + 40, H - 60, -W / 2 + t + 40]], [0, -1, 0], undefined, undefined, CAM)],
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt on the end panel at the compartment",
      detail: "Six dowels into its inside face first. Barrel nuts into the rails and boards, four long bolts through the end with the cranked key, and one cam lock.",
      add: ["ER"],
      fix: [
        endPegs(1),
        at("nut", [[xR - 40, feet + t / 2, zF + 40], [xR - 40, feet + t / 2, zK], [xR - 40, H - 30, W / 2 - 15], [xR - 40, H - 30, -W / 2 + t + 15]], [0, -1, 0], undefined, undefined, { len: 12, dia: 10, name: "Barrel nut" }),
        at("bolt", [[L / 2, feet + t / 2, zF + 40], [L / 2, feet + t / 2, zK], [L / 2, H - 30, W / 2 - 15], [L / 2, H - 30, -W / 2 + t + 15]], [-1, 0, 0], "ER", undefined, { len: 90, dia: 6 }),
        at("cam", [[xR - 40, H - 30, 0]], [0, -1, 0], "BM", undefined, CAM),
      ],
      tools: ["allen", "screwdriver"],
    },
    {
      title: "Slide the doors into their tracks",
      detail: "Top edge up into the upper track first, then drop the bottom into the lower one. The back door goes in the inner track.",
      add: ["DR2", "DR1"],
      from: { DR2: [0, 0, 300], DR1: [0, 0, 300] },
    },
    {
      title: "Bolt on the other end panel",
      detail: "The same way: six dowels, four barrel nuts, four long bolts and one cam lock.",
      add: ["EL"],
      fix: [
        endPegs(-1),
        at("nut", [[xL + 40, feet + t / 2, zF + 40], [xL + 40, feet + t / 2, zK], [xL + 40, H - 30, W / 2 - 15], [xL + 40, H - 30, -W / 2 + t + 15]], [0, -1, 0], undefined, undefined, { len: 12, dia: 10, name: "Barrel nut" }),
        at("bolt", [[-L / 2, feet + t / 2, zF + 40], [-L / 2, feet + t / 2, zK], [-L / 2, H - 30, W / 2 - 15], [-L / 2, H - 30, -W / 2 + t + 15]], [1, 0, 0], "EL", undefined, { len: 90, dia: 6 }),
        at("cam", [[xL + 40, H - 30, 0]], [0, -1, 0], "BM", undefined, CAM),
      ],
      tools: ["allen", "screwdriver"],
    },
    {
      title: "Stick the slat stops along the rails",
      detail: "Six stops on the top rails and the beam. Cut the tape where the drawing shows.",
      fix: [at("clip", [-1, 1].flatMap((sx) => [W / 2 - 15, 0, -W / 2 + t + 15].map((z) => [sx * (L / 2 - 200), H, z] as Vec3)), [0, -1, 0], undefined, undefined, { len: 10, dia: 30, name: "Slat stop" })],
      tools: ["knife"],
    },
    {
      title: "Roll out the slatted base",
      detail: "From the head end. Hook its ends into the holders, two at each end, and keep it straight, not bowed.",
      add: ["SL", "MAT"],
      fix: [at("cap", [-1, 1].flatMap((sx) => [-W / 4, W / 4].map((z) => [sx * (sl / 2), H + 14, z] as Vec3)), [0, -1, 0], "SL", undefined, { len: 10, dia: 30, name: "Slat holder" })],
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["KLIPPUGGLA"], recipe };
export default family;
