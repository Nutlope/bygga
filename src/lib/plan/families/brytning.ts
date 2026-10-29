import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, PartMaterial, ProductSpec, Vec3 } from "../../types";

/**
 * BRYTNING, read from IKEA's manuals. The desks start with four solid legs: dowels and cam bolts go into them, then
 * each pair is pushed onto a grooved side panel and a low rail and locked with cams. Upside down, the back rail, the
 * shelf support with its back panel and the long stretcher go between the two side frames, held by long screws
 * through the sides. Turned over, the top is cam-locked on, the shelf slides in on four locks and two more screws
 * go in through the back legs. The 110 desk adds a drawer on runners under the top. The storage unit is built lying
 * on its side, gets its castors upside down and its shelf and handle standing up. The swivel chair is a star base,
 * castors, gas lift, then the seat and its back bracket bolted on underneath. The 135 desk is its own manual: a back
 * frame and two side frames joined lying on its back, two cupboards (walls, bottoms, strips) built in upside down,
 * the top cam-locked on, a shelf in the right cupboard and two doors on hinges.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

const P = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: PartMaterial = "board", o: Partial<CustomPart> = {}): CustomPart => ({
  id,
  name,
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material,
  ...o,
});

// the fittings, by what they look like on the fittings pages
const DOWEL = { len: 30, dia: 8 };
const BIG_DOWEL = { len: 40, dia: 10, name: "Large dowel" };
const CAM_BOLT = { len: 34, dia: 7 };
const SHORT_BOLT = { len: 14, dia: 7, name: "Short cam bolt" };
const CAM = { len: 13, dia: 15 };
const BIG_CAM = { len: 15, dia: 20, name: "Large cam lock" };
const HALF_CAM = { len: 12, dia: 15, name: "Half cam lock" };
const SHELF_LOCK = { len: 14, dia: 24, name: "Shelf lock" };
const LONG_SCREW = { len: 70, dia: 6, name: "Long screw" };
const GLIDE = { len: 6, dia: 26, name: "Floor glide" };

const sides = [-1, 1] as const;

/* ---------- desks ---------- */

function desk(s: ProductSpec, drawer: boolean): CustomParams {
  const W = s.size.w * 10, H = 750, T = 22;
  const yT = H - T; // underside of the top
  const cx = W / 2 - 50, cz = 215, L = 22.5; // legs: centres and half width
  const fz = cz - L; // the legs' inner faces, front and back
  const xi = cx - 9; // the side panels' inner faces
  const parts: CustomPart[] = [];
  const leg = (sx: number, sz: number) => `L${sx > 0 ? "R" : "L"}${sz > 0 ? "F" : "B"}`;
  for (const sx of sides) for (const sz of sides) parts.push(P(leg(sx, sz), "Leg", sx * cx - L, sx * cx + L, 0, yT, sz * cz - L, sz * cz + L, "wood"));
  const sp = (sx: number) => (sx > 0 ? "SPR" : "SPL");
  const sr = (sx: number) => (sx > 0 ? "SRR" : "SRL");
  for (const sx of sides) {
    parts.push(P(sp(sx), "Side panel", sx * cx - 9, sx * cx + 9, 520, yT, -fz, fz));
    parts.push(P(sr(sx), "Side rail", sx * cx - 17.5, sx * cx + 17.5, 130, 175, -fz, fz, "wood"));
  }
  parts.push(P("BR", "Back rail", -xi, xi, 650, yT, -fz, -fz + 18));
  parts.push(P("SB", "Shelf support", -xi, xi, 542, 560, -fz, -80));
  parts.push(P("BP", "Back panel", -xi, xi, 560, 650, -fz, -fz + 18));
  parts.push(P("ST", "Back strip", -xi, xi, 632, 650, -fz + 18, -120));
  parts.push(P("LS", "Stretcher", -(cx - 17.5), cx - 17.5, 130, 175, -25, 25, "wood"));
  parts.push(P("TOP", "Desk top", -W / 2, W / 2, yT, H, -265, 265));
  parts.push(P("SH", "Shelf", -xi, xi, 542, 560, -80, fz));

  const perLeg = (kind: Kind, ys: number[], o: { len?: number; dia?: number; name?: string }) =>
    sides.flatMap((sx) => sides.map((sz) => at(kind, ys.map((y) => [sx * cx, y, sz * fz] as Vec3), [0, 0, sz], leg(sx, sz), sp(sx), o)));
  const inner = (sx: number, ys: number[], zs: number[]): Vec3[] => ys.flatMap((y) => zs.map((z) => [sx * xi, y, z] as Vec3));

  // the legs, the back panel and the back rail all join the side panel near its back edge: their holes are at
  // different heights (legs 528-650, back panel 575 and 630, back rail 670-718)
  const steps: CustomStep[] = [
    { title: "Tap two dowels into each leg", detail: "Lay the legs on a rug. The short dowels go into the two holes high up on the inner face.", fix: perLeg("dowel", [552, 612], DOWEL), tools: ["hammer"], warnings: ["floor"] },
    { title: "Tap a large dowel into each leg", detail: "Into the single hole low down, for the side rail.", fix: perLeg("dowel", [140], BIG_DOWEL), tools: ["hammer"] },
    { title: "Screw three cam bolts into each leg", detail: "Two high up beside the dowels, one low down. By hand or with a screwdriver until they stop.", fix: perLeg("camScrew", [528, 650, 165], CAM_BOLT), tools: ["screwdriver"] },
    {
      title: "Push a floor glide into each leg's foot",
      detail: "Tap it in until its rim sits flat.",
      fix: [at("glide", sides.flatMap((sx) => sides.map((sz) => [sx * cx, 0, sz * cz] as Vec3)), [0, 1, 0], undefined, undefined, GLIDE)],
    },
    { title: "Push the side panels and rails onto the legs", detail: "Two legs to each side frame, the grooved face of the panel outwards. Push them together over the dowels and cam bolts.", add: [sp(-1), sr(-1), sp(1), sr(1)] },
    { title: "Turn the large cam locks in the rails", detail: "Arrow towards the bolt, then clockwise until the rail pulls tight against the leg.", fix: sides.map((sx) => at("cam", sides.map((sz) => [sx * (cx - 17.5), 165, sz * (fz - 30)] as Vec3), [sx, 0, 0], sr(sx), undefined, BIG_CAM)), tools: ["screwdriver"] },
    { title: "Turn the cam locks in the side panels", detail: "Four in each panel, the same way.", fix: sides.map((sx) => at("cam", inner(sx, [528, 650], [-(fz - 34), fz - 34]), [sx, 0, 0], sp(sx), undefined, CAM)), tools: ["screwdriver"] },
    { title: "Screw two short cam bolts into each side panel", detail: "Into the holes low down on the inside: the shelf locks onto these.", fix: sides.map((sx) => at("camScrew", inner(sx, [551], [-40, 150]), [sx, 0, 0], sp(sx), undefined, SHORT_BOLT)), tools: ["screwdriver"] },
    { title: "Screw a cam bolt into each side panel for the back rail", detail: "Into the hole high up at the back.", fix: sides.map((sx) => at("camScrew", [[sx * xi, 718, -fz + 9]], [sx, 0, 0], sp(sx), "BR", CAM_BOLT)), tools: ["screwdriver"] },
    { title: "Tap four dowels into the back rail", detail: "Two into each end.", fix: sides.map((sx) => at("dowel", [[sx * xi, 670, -fz + 9], [sx * xi, 694, -fz + 9]], [-sx, 0, 0], "BR", sp(sx), DOWEL)), tools: ["hammer"] },
    { title: "Stand the back panel on the shelf support", detail: "The narrow strip goes along the top of the back panel, on its front side. Just lay them together for now.", add: ["SB", "BP", "ST"] },
    {
      title: "Tap three dowels into each end of it",
      detail: "Two into the shelf support, one into the back panel.",
      fix: sides.flatMap((sx) => [at("dowel", [[sx * xi, 551, -160], [sx * xi, 551, -105]], [-sx, 0, 0], "SB", sp(sx), DOWEL), at("dowel", [[sx * xi, 575, -fz + 9]], [-sx, 0, 0], "BP", sp(sx), DOWEL)]),
      tools: ["hammer"],
    },
    { title: "Tap a large dowel into each end of the stretcher", fix: sides.map((sx) => at("dowel", [[sx * (cx - 17.5), 152, -12]], [-sx, 0, 0], "LS", sr(sx), BIG_DOWEL)), tools: ["hammer"] },
    { title: "Fit the boards between the side frames, upside down", detail: "Lay one side frame on its edge, legs up. Push in the back rail, the shelf support and the stretcher, then press the other side frame on.", pose: "-y", people: 2, warnings: ["two", "floor"] },
    {
      title: "Screw the sides to the boards with six long screws",
      detail: "Two through each side panel into the shelf support and back panel, one through each rail into the stretcher.",
      fix: sides.flatMap((sx) => [
        at("screw", [[sx * (cx + 9), 551, -132]], [-sx, 0, 0], sp(sx), "SB", LONG_SCREW),
        at("screw", [[sx * (cx + 9), 630, -fz + 9]], [-sx, 0, 0], sp(sx), "BP", LONG_SCREW),
        at("screw", [[sx * (cx + 17.5), 152, 12]], [-sx, 0, 0], sr(sx), "LS", LONG_SCREW),
      ]),
      tools: ["allen"],
    },
    { title: "Turn the two cam locks in the back rail", detail: "One at each end, clockwise until tight.", fix: [at("cam", sides.map((sx) => [sx * (xi - 34), yT, -fz + 9] as Vec3), [0, -1, 0], "BR", undefined, HALF_CAM)], tools: ["screwdriver"] },
    { title: "Turn it over and tap dowels into the side panels", detail: "Stand it on its feet. Two dowels in the top edge of each side panel.", fix: sides.map((sx) => at("dowel", [[sx * cx, yT, -120], [sx * cx, yT, 120]], [0, -1, 0], sp(sx), "TOP", DOWEL)), pose: "+y", tools: ["hammer"], people: 2, warnings: ["two"] },
    {
      title: "Screw seven cam bolts into the underside of the top",
      detail: "Lay the top face down on a rug and screw them into the marked holes.",
      fix: [at("camScrew", [...sides.flatMap((sx) => [[sx * cx, yT, -60], [sx * cx, yT, 60]] as Vec3[]), ...[-W / 4, 0, W / 4].map((x) => [x, yT, -fz + 9] as Vec3)], [0, 1, 0], "TOP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      from: { TOP: [0, 400, 0] },
    },
    { title: "Lower the top onto the frame", detail: "Guide the bolts and dowels into their holes, then press it down flat.", people: 2, warnings: ["two"] },
    {
      title: "Lock the top with seven cam locks",
      detail: "Two in each side panel and three in the back rail, each turned clockwise until tight.",
      fix: [...sides.map((sx) => at("cam", inner(sx, [694], [-60, 60]), [sx, 0, 0], sp(sx), undefined, CAM)), at("cam", [-W / 4, 0, W / 4].map((x) => [x, 694, -fz + 18] as Vec3), [0, 0, -1], "BR", undefined, CAM)],
      tools: ["screwdriver"],
    },
  ];

  const shelf: CustomStep[] = [
    { title: "Press four shelf locks into the shelf", detail: "Into the round holes near each end, flush with the surface.", add: ["SH"], fix: [at("cam", sides.flatMap((sx) => [[sx * (xi - 25), 560, -40], [sx * (xi - 25), 560, 150]] as Vec3[]), [0, -1, 0], "SH", undefined, SHELF_LOCK)], from: { SH: [0, 0, 450] } },
    { title: "Slide the shelf in and turn the locks", detail: "Push it in from the front onto the short cam bolts, then turn each lock until it grips.", tools: ["screwdriver"] },
    { title: "Screw two long screws in through the back legs", detail: "Into the ends of the back rail.", fix: [at("screw", sides.map((sx) => [sx * (cx - 15), 690, -cz - L] as Vec3), [0, 0, 1], undefined, "BR", LONG_SCREW)], tools: ["allen"] },
  ];

  if (!drawer) return { parts, steps: [...steps, ...shelf] };

  // the drawer: runners under the top, a box with a middle divider and a front with two handles
  const rx = xi - 12, dx = rx - 18; // runners' inner faces, the drawer sides' inner faces
  const zb = -fz + 26, zf = 170;
  for (const sx of sides) {
    parts.push(P(sx > 0 ? "RR" : "RL", "Drawer runner", sx > 0 ? rx : -xi, sx > 0 ? xi : -rx, 690, yT, zb, fz, "metal"));
    parts.push(P(sx > 0 ? "DSR" : "DSL", "Drawer side", sx > 0 ? dx : -rx, sx > 0 ? rx : -dx, 586, 688, zb, zf));
  }
  parts.push(P("DB", "Drawer back", -dx, dx, 586, 688, zb, zb + 18));
  parts.push(P("DM", "Drawer divider", -9, 9, 586, 688, zb + 18, zf));
  parts.push(P("DBt", "Drawer bottom", -dx, dx, 580, 586, zb, zf, "fiber"));
  parts.push(P("DF", "Drawer front", -xi + 4, xi - 4, 566, 722, zf, zf + 18));
  const drawerSteps: CustomStep[] = [
    {
      title: "Screw the drawer runners under the top",
      detail: "The marked left and right runners, against the side panels. Two screws up into the top for each.",
      add: ["RL", "RR"],
      fix: [at("screw", sides.flatMap((sx) => [[sx * (xi - 6), 690, -100], [sx * (xi - 6), 690, 120]] as Vec3[]), [0, 1, 0], undefined, "TOP", { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    shelf[0],
    shelf[1],
    shelf[2],
    { title: "Clip the runner strips onto the drawer sides", detail: "Along the outside of each side, the stop at the back.", add: ["DSL", "DSR"], fix: sides.map((sx) => at("runner", [[sx * rx, 637, 0]], [-sx, 0, 0], sx > 0 ? "DSR" : "DSL", undefined, { len: 300, dia: 20, name: "Runner strip" })), from: { DSL: [0, 0, 500], DSR: [0, 0, 500] } },
    {
      title: "Screw the sides to the drawer back",
      detail: "Two screws through each side into the back's ends.",
      add: ["DB"],
      fix: sides.map((sx) => at("screw", [[sx * rx, 610, zb + 9], [sx * rx, 676, zb + 9]], [-sx, 0, 0], sx > 0 ? "DSR" : "DSL", "DB", { len: 40, dia: 5 })),
      tools: ["screwdriver"],
      from: { DB: [0, 0, 500] },
    },
    { title: "Screw the divider to the back", detail: "One screw through the back into the end of the divider.", add: ["DM"], fix: [at("screw", [[0, 637, zb]], [0, 0, 1], "DB", "DM", { len: 40, dia: 5 })], tools: ["screwdriver"], from: { DM: [0, 0, 500] } },
    { title: "Slide the bottom into the grooves", detail: "Smooth side up, all the way to the back.", add: ["DBt"], from: { DBt: [0, 0, 500] } },
    { title: "Screw the bottom to the back", fix: [at("screw", [[-dx / 2, 580, zb + 9], [dx / 2, 580, zb + 9]], [0, 1, 0], "DBt", "DB", { len: 16, dia: 4 })], tools: ["screwdriver"] },
    {
      title: "Tap dowels and screw cam bolts into the drawer front",
      detail: "Lay it face down. Four dowels and three cam bolts on its back, in line with the sides and the divider.",
      fix: [
        at("dowel", [[-(dx + 9), 610, zf], [dx + 9, 610, zf], [0, 610, zf], [0, 670, zf]], [0, 0, 1], "DF", undefined, DOWEL),
        at("camScrew", [[-(dx + 9), 660, zf], [dx + 9, 660, zf], [0, 645, zf]], [0, 0, 1], "DF", undefined, CAM_BOLT),
      ],
      tools: ["hammer", "screwdriver"],
      from: { DF: [0, 0, 450] },
    },
    { title: "Press the drawer box onto the front", detail: "Stand the box on its front end, over the dowels and bolts." },
    {
      title: "Turn the three cam locks",
      detail: "One in each side, one in the divider, clockwise until the front sits tight.",
      fix: [at("cam", [[-dx, 660, zf - 34]], [-1, 0, 0], "DSL", undefined, CAM), at("cam", [[dx, 660, zf - 34]], [1, 0, 0], "DSR", undefined, CAM), at("cam", [[9, 645, zf - 34]], [-1, 0, 0], "DM", undefined, CAM)],
      tools: ["screwdriver"],
    },
    { title: "Screw the runner strips to the sides", detail: "Two small screws through each strip.", fix: sides.map((sx) => at("screw", [[sx * rx, 637, -100], [sx * rx, 637, 100]], [-sx, 0, 0], sx > 0 ? "DSR" : "DSL", undefined, { len: 12, dia: 3.5 })), tools: ["screwdriver"] },
    {
      title: "Screw on the two handles",
      detail: "Two screws for each, from inside the drawer.",
      fix: [at("handle", [[-W / 4, 644, zf + 18], [W / 4, 644, zf + 18]], [0, 0, -1], "DF"), at("screw", [-W / 4 - 48, -W / 4 + 48, W / 4 - 48, W / 4 + 48].map((x) => [x, 644, zf] as Vec3), [0, 0, 1], "DF", undefined, { len: 25, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Slide the drawer in until it clicks", detail: "Lift the front a little over the stops. To take it out, press the two catches under the runners." },
  ];
  return { parts, steps: [...steps, ...drawerSteps] };
}

/* ---------- the 135 desk: two cupboards with doors ---------- */

function cupboardDesk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = 750, T = 22;
  const yT = H - T;
  const cx = W / 2 - 50, cz = 215, L = 22.5;
  const fz = cz - L; // the legs' inner faces, front and back
  const zbF = -cz + 9; // the back board's front face
  const leg = (sx: number, sz: number) => `L${sx > 0 ? "R" : "L"}${sz > 0 ? "F" : "B"}`;
  const sp = (sx: number) => (sx > 0 ? "SPR" : "SPL");
  const sr = (sx: number) => (sx > 0 ? "SRR" : "SRL");
  const wall = (sx: number) => (sx > 0 ? "IWR" : "IWL");
  const bot = (sx: number) => (sx > 0 ? "CBR" : "CBL");
  const xw = cx - 9 - 400; // the inner walls' outer faces (towards the middle)
  const yBot = (sx: number) => (sx > 0 ? 420 : 480); // top of each cupboard's bottom; the right one is deeper
  const parts: CustomPart[] = [];
  for (const sx of sides) for (const sz of sides) parts.push(P(leg(sx, sz), "Leg", sx * cx - L, sx * cx + L, 0, yT, sz * cz - L, sz * cz + L, "wood"));
  parts.push(P("BB", "Back board", -(cx - L), cx - L, 470, yT, -cz - 9, zbF));
  parts.push(P("LS", "Stretcher", -(cx - L), cx - L, 130, 175, -cz - 17.5, -cz + 17.5, "wood"));
  for (const sx of sides) {
    parts.push(P(sp(sx), "Side panel", sx * cx - 9, sx * cx + 9, 400, yT, -fz, fz));
    parts.push(P(sr(sx), "Side rail", sx * cx - 17.5, sx * cx + 17.5, 130, 175, -fz, fz, "wood"));
  }
  for (const sx of sides) {
    const x0 = sx * xw, x1 = sx * (xw + 18);
    parts.push(P(wall(sx), "Cupboard wall", Math.min(x0, x1), Math.max(x0, x1), yBot(sx), yT, zbF, fz));
  }
  // each bottom runs under its wall: the wall stands on it, joined by dowels and cam bolts in the bottom's top face
  for (const sx of sides) {
    const a = sx * xw, b = sx * (cx - 9);
    parts.push(P(bot(sx), "Cupboard bottom", Math.min(a, b), Math.max(a, b), yBot(sx) - 18, yBot(sx), zbF, fz));
  }
  parts.push(P("ST1", "Top strip", -xw, xw, yT - 80, yT, zbF, zbF + 18));
  parts.push(P("ST2", "Front strip", -xw, xw, yT - 18, yT, fz - 80, fz));
  parts.push(P("TOP", "Desk top", -W / 2, W / 2, yT, H, -265, 265));
  parts.push(P("CS", "Cable shelf", -xw, xw, 560, 578, zbF, zbF + 110));
  parts.push(P("SH", "Shelf", xw + 18, cx - 9, 575, 593, zbF, fz - 20));
  const doorX = (sx: number): [number, number] => {
    const a = sx * (cx - L), b = sx * (xw + 18);
    return [Math.min(a, b) + 2, Math.max(a, b) - 2];
  };
  for (const sx of sides) {
    const [a, b] = doorX(sx);
    parts.push(P(sx > 0 ? "DR" : "DL", "Door", a, b, yBot(sx) - 16, yT - 4, fz + 2, fz + 20));
  }

  const inLeg = (kind: Kind, sz: number, ys: number[], o: { len?: number; dia?: number; name?: string }) =>
    sides.map((sx) => at(kind, ys.map((y) => [sx * cx, y, sz * fz] as Vec3), [0, 0, sz], leg(sx, sz), sp(sx), o));
  const backLegX = (kind: Kind, ys: number[], o: { len?: number; dia?: number; name?: string }) =>
    sides.map((sx) => at(kind, ys.map((y) => [sx * (cx - L), y, -cz] as Vec3), [sx, 0, 0], leg(sx, -1), undefined, o));
  const camsIn = (id: string, pts: Vec3[], dir: Vec3, o: { len?: number; dia?: number; name?: string } = CAM) => at("cam", pts, dir, id, undefined, o);
  const wallX = (sx: number) => sx * (xw + 9);

  const steps: CustomStep[] = [
    { title: "Tap dowels into the back legs", detail: "Lay the two back legs on a rug. Two small dowels into each, on the face for the back board.", fix: backLegX("dowel", [560, 660], DOWEL), tools: ["hammer"], pose: "+z", warnings: ["floor"] },
    { title: "Tap a large dowel into each end of the stretcher", fix: sides.map((sx) => at("dowel", [[sx * (cx - L), 152, -cz]], [sx, 0, 0], "LS", leg(sx, -1), BIG_DOWEL)), tools: ["hammer"] },
    { title: "Fit the back board and stretcher between the back legs", detail: "Lay them on the rug and push the legs onto the dowels at both ends.", add: ["BB", "LS"] },
    {
      title: "Screw the back legs on with six long screws",
      detail: "Two through each leg into the back board, one into the stretcher. Tighten with the Allen key.",
      fix: sides.map((sx) => at("screw", [[sx * (cx + L), 530, -cz], [sx * (cx + L), 690, -cz], [sx * (cx + L), 152, -cz]], [-sx, 0, 0], leg(sx, -1), undefined, { len: 90, dia: 7, name: "Long screw" })),
      tools: ["allen"],
    },
    { title: "Tap a large dowel into each back leg", detail: "Low down on the inner face, for the side rail.", fix: inLeg("dowel", -1, [140], BIG_DOWEL), tools: ["hammer"] },
    { title: "Tap two small dowels into each back leg", detail: "High up on the same face, for the side panel.", fix: inLeg("dowel", -1, [450, 690], DOWEL), tools: ["hammer"] },
    { title: "Screw three cam bolts into each back leg", detail: "Two beside the dowels up high, one low down.", fix: inLeg("camScrew", -1, [420, 640, 165], CAM_BOLT), tools: ["screwdriver"] },
    { title: "Tap two small dowels into each front leg", detail: "Lay the front legs on the rug, holes up.", fix: inLeg("dowel", 1, [450, 690], DOWEL), tools: ["hammer"] },
    { title: "Tap a large dowel into each front leg", fix: inLeg("dowel", 1, [140], BIG_DOWEL), tools: ["hammer"] },
    { title: "Screw three cam bolts into each front leg", fix: inLeg("camScrew", 1, [420, 640, 165], CAM_BOLT), tools: ["screwdriver"] },
    { title: "Push a side panel and a side rail onto each front leg", detail: "The grooved face of the panel faces out; the cam holes face in.", add: [sp(-1), sr(-1), sp(1), sr(1)] },
    { title: "Turn the large cam locks in the rails", detail: "Clockwise until each rail pulls tight against its leg.", fix: sides.map((sx) => at("cam", [[sx * (cx - 17.5), 165, fz - 30]], [sx, 0, 0], sr(sx), undefined, BIG_CAM)), tools: ["screwdriver"] },
    { title: "Turn the cam locks in the side panels", detail: "Two in each panel, near the front leg.", fix: sides.map((sx) => camsIn(sp(sx), [[sx * (cx - 9), 420, fz - 34], [sx * (cx - 9), 640, fz - 34]], [sx, 0, 0])), tools: ["screwdriver"] },
    { title: "Tap dowels into the panels' free ends", detail: "Two in the back end of each side panel.", fix: sides.map((sx) => at("dowel", [[sx * cx, 470, -fz], [sx * cx, 670, -fz]], [0, 0, 1], sp(sx), leg(sx, -1), DOWEL)), tools: ["hammer"] },
    { title: "Screw cam bolts into the panels", detail: "Two on the inner face of each panel, near the back end.", fix: sides.map((sx) => at("camScrew", [[sx * (cx - 9), 500, -fz + 30], [sx * (cx - 9), 700, -fz + 30]], [sx, 0, 0], sp(sx), undefined, CAM_BOLT)), tools: ["screwdriver"] },
    {
      title: "Stand both sides onto the back frame",
      detail: "Lay the back frame flat, legs on the rug, and push a side frame onto each end over the dowels and bolts.",
      people: 2,
      warnings: ["two", "floor"],
    },
    { title: "Turn the large cam locks at the back", fix: sides.map((sx) => at("cam", [[sx * (cx - 17.5), 165, -fz + 30]], [sx, 0, 0], sr(sx), undefined, BIG_CAM)), tools: ["screwdriver"] },
    { title: "Turn the cam locks in the side panels", detail: "Two in each panel, at the back legs.", fix: sides.map((sx) => camsIn(sp(sx), [[sx * (cx - 9), 420, -fz + 34], [sx * (cx - 9), 640, -fz + 34]], [sx, 0, 0])), tools: ["screwdriver"] },
    { title: "Push a floor glide into each leg", detail: "Into the foot, until the rim sits flat.", fix: [at("glide", sides.flatMap((sx) => sides.map((sz) => [sx * cx, 0, sz * cz] as Vec3)), [0, 1, 0], undefined, undefined, GLIDE)] },
    { title: "Stand the two cupboard walls on the back board", detail: "Against the back board, one at each inner end of a cupboard, their cam holes facing the back.", add: [wall(-1), wall(1)] },
    { title: "Lock the walls to the back board", detail: "Two cam locks in each wall, near the back edge.", fix: sides.map((sx) => camsIn(wall(sx), [[wallX(sx), 520, zbF + 34], [wallX(sx), 680, zbF + 34]], [-sx, 0, 0])), tools: ["screwdriver"] },
    { title: "Screw cam bolts into the cupboard bottoms", detail: "Two in each, in the top face at the end that goes under the wall.", fix: sides.map((sx) => at("camScrew", [[wallX(sx), yBot(sx), -100], [wallX(sx), yBot(sx), 100]], [0, -1, 0], bot(sx), wall(sx), CAM_BOLT)), tools: ["screwdriver"], wait: [bot(-1), bot(1)] },
    { title: "Tap dowels into the cupboard bottoms", detail: "Two in each, beside the cam bolts.", fix: sides.map((sx) => at("dowel", [[wallX(sx), yBot(sx), -160], [wallX(sx), yBot(sx), 160]], [0, -1, 0], bot(sx), wall(sx), DOWEL)), tools: ["hammer"] },
    { title: "Push the bottoms up under the walls", detail: "Between the side panel and the wall, the dowels and bolts into the wall's lower edge.", add: [bot(-1), bot(1)], from: { [bot(-1)]: [0, -250, 0], [bot(1)]: [0, -250, 0] } },
    { title: "Lock the bottoms to the walls", detail: "Two cam locks in each wall, low down.", fix: sides.map((sx) => camsIn(wall(sx), [[wallX(sx), yBot(sx) + 34, -100], [wallX(sx), yBot(sx) + 34, 100]], [-sx, 0, 0])), tools: ["screwdriver"] },
    { title: "Turn it upside down and screw the bottoms to the sides", detail: "Four medium screws, two through each side panel into the end of a bottom.", fix: sides.map((sx) => at("screw", [[sx * (cx + 9), yBot(sx) - 9, -110], [sx * (cx + 9), yBot(sx) - 9, 110]], [-sx, 0, 0], sp(sx), bot(sx), { len: 50, dia: 6, name: "Medium screw" })), pose: "-y", tools: ["allen"], people: 2, warnings: ["two"] },
    { title: "Tap dowels into the top strip", detail: "Two in each end.", fix: sides.map((sx) => at("dowel", [[sx * xw, yT - 60, zbF + 9], [sx * xw, yT - 20, zbF + 9]], [-sx, 0, 0], "ST1", wall(sx), DOWEL)), tools: ["hammer"] },
    { title: "Fit the top strip between the walls", detail: "At the back, along the back board.", add: ["ST1"] },
    { title: "Fit the front strip between the walls", detail: "Along their front edges.", add: ["ST2"] },
    { title: "Knock in the push-in fasteners", detail: "Two through each wall into the front strip.", fix: sides.map((sx) => at("nail", [[sx * (xw + 18), yT - 9, fz - 60], [sx * (xw + 18), yT - 9, fz - 20]], [-sx, 0, 0], wall(sx), "ST2", { len: 40, dia: 8, name: "Push-in fastener" })), tools: ["hammer"] },
    {
      title: "Screw twelve cam bolts into the underside of the top",
      detail: "Lay the top face down on a rug.",
      fix: [at("camScrew", [...sides.flatMap((sx) => [[sx * cx, yT, -100], [sx * cx, yT, 100]] as Vec3[]), ...sides.flatMap((sx) => [[wallX(sx), yT, -60], [wallX(sx), yT, 120]] as Vec3[]), ...[-W / 3, -W / 9, W / 9, W / 3].map((x) => [x, yT, zbF - 9] as Vec3)], [0, 1, 0], "TOP", undefined, CAM_BOLT)],
      wait: ["TOP"],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Tap ten dowels into the top", detail: "Into the holes beside the bolts.", fix: [at("dowel", [...sides.flatMap((sx) => [[sx * cx, yT, -170], [sx * cx, yT, 170]] as Vec3[]), ...sides.flatMap((sx) => [[wallX(sx), yT, -130], [wallX(sx), yT, 60]] as Vec3[]), [-W / 4, yT, zbF - 9], [W / 4, yT, zbF - 9]], [0, 1, 0], "TOP", undefined, DOWEL)], tools: ["hammer"] },
    { title: "Knock in the two door stop sleeves", detail: "Into the holes over each cupboard, with the hammer.", fix: [at("spacer", sides.map((sx) => [sx * (xw + 60), yT, fz - 20] as Vec3), [0, 1, 0], "TOP", undefined, { len: 14, dia: 10, name: "Stop sleeve" })], tools: ["hammer"] },
    {
      title: "Lower the frame onto the top and lock it",
      detail: "Upside down, over all the bolts and dowels. Then twelve cam locks: in the side panels, the walls and the back board.",
      add: ["TOP"],
      fix: [
        ...sides.map((sx) => camsIn(sp(sx), [[sx * (cx - 9), yT - 34, -100], [sx * (cx - 9), yT - 34, 100]], [sx, 0, 0])),
        ...sides.map((sx) => camsIn(wall(sx), [[wallX(sx), yT - 34, -60], [wallX(sx), yT - 34, 120]], [-sx, 0, 0])),
        camsIn("BB", [-W / 3, -W / 9, W / 9, W / 3].map((x) => [x, yT - 34, zbF] as Vec3), [0, 0, -1]),
      ],
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
      from: { TOP: [0, -400, 0] },
    },
    { title: "Lay the cable shelf between the walls", detail: "Its back edge against the back board.", add: ["CS"] },
    { title: "Screw it to the walls", detail: "One medium screw through each wall.", fix: sides.map((sx) => at("screw", [[sx * (xw + 18), 569, zbF + 55]], [-sx, 0, 0], wall(sx), "CS", { len: 50, dia: 6, name: "Medium screw" })), tools: ["allen"] },
    { title: "Stand it up and push in the shelf pins", detail: "Four, in the right-hand cupboard.", fix: [at("pin", [[xw + 18, 573, -120], [xw + 18, 573, 120], [cx - 9, 573, -120], [cx - 9, 573, 120]], [1, 0, 0], undefined, undefined, { len: 16, dia: 5 })], pose: "+y", people: 2, warnings: ["two"] },
    { title: "Slide the shelf in", detail: "From the front, onto the pins.", add: ["SH"], from: { SH: [0, 0, 450] } },
    {
      title: "Screw on the shelf catches",
      detail: "One on the wall and one on the side panel, just over the shelf, so it can't tip.",
      fix: [
        at("clip", [[xw + 18, 602, fz - 40]], [-1, 0, 0], wall(1), undefined, { len: 30, dia: 16, name: "Shelf catch" }),
        at("clip", [[cx - 9, 602, fz - 40]], [1, 0, 0], sp(1), undefined, { len: 30, dia: 16, name: "Shelf catch" }),
        at("screw", [[xw + 18, 602, fz - 66]], [-1, 0, 0], wall(1), undefined, { len: 14, dia: 4 }),
        at("screw", [[cx - 9, 602, fz - 66]], [1, 0, 0], sp(1), undefined, { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hinges onto the doors",
      detail: "Two on each door, into the round holes. Lay the doors face down.",
      fix: sides.map((sx) => {
        const [a, b] = doorX(sx);
        const x = sx < 0 ? a + 30 : b - 30;
        return at("hinge", [[x, yBot(sx) + 60, fz + 2], [x, yT - 60, fz + 2]], [0, 0, -1], sx > 0 ? "DR" : "DL", undefined, { len: 50, dia: 35 });
      }),
      tools: ["screwdriver"],
      wait: ["DL", "DR"],
      warnings: ["floor"],
    },
    {
      title: "Screw a handle onto each door",
      detail: "Two screws from the back.",
      fix: sides.flatMap((sx) => {
        const [a, b] = doorX(sx);
        const x = sx < 0 ? b - 50 : a + 50;
        const y = (yBot(sx) + yT) / 2;
        return [at("handle", [[x, y, fz + 20]], [0, 0, -1], sx > 0 ? "DR" : "DL", undefined, { len: 90, dia: 14 }), at("screw", [[x, y - 40, fz + 2], [x, y + 40, fz + 2]], [0, 0, 1], sx > 0 ? "DR" : "DL", undefined, { len: 16, dia: 4, name: "Handle screw" })];
      }),
      tools: ["screwdriver"],
    },
    { title: "Hang the doors", detail: "Clip each hinge onto its plate inside the cupboard. Turn the hinge screws to line the doors up.", add: ["DL", "DR"], tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

/* ---------- storage unit ---------- */

function storage(): CustomParams {
  const hx = 145, xi = 127, zf = 200, y0 = 60, yt = 448;
  const parts: CustomPart[] = [
    P("SL", "Side panel", -hx, -xi, y0, 470, -zf, zf),
    P("SR", "Side panel", xi, hx, y0, 470, -zf, zf),
    P("TP", "Top", -xi, xi, yt - 18, yt, -zf, zf),
    P("BT", "Bottom", -xi, xi, y0, y0 + 18, -zf, zf),
    P("FT", "Top front rail", -xi, xi, 380, yt - 18, zf - 18, zf),
    P("BK", "Top back rail", -xi, xi, 380, yt - 18, -zf, -zf + 18),
    P("FB", "Bottom front rail", -xi, xi, y0 + 18, 118, zf - 18, zf),
    P("BB", "Bottom back rail", -xi, xi, y0 + 18, 118, -zf, -zf + 18),
    P("FL", "Front lip", -xi, xi, yt, 470, zf - 18, zf),
    P("BL", "Back lip", -xi, xi, yt, 470, -zf, -zf + 18),
    P("M1", "Back strip", -xi, xi, 230, 258, -zf, -zf + 18),
    P("M2", "Back strip", -xi, xi, 320, 348, -zf, -zf + 18),
    P("SH", "Shelf", -xi + 1, xi - 1, 240, 258, -zf + 18, zf - 18),
  ];
  const side = (sx: number) => (sx > 0 ? "SR" : "SL");
  const ends = (sx: number, ys: number[], zs: number[]) => ys.flatMap((y) => zs.map((z) => [sx * xi, y, z] as Vec3));
  const strip = (id: string, y: number, z: number, o: { len?: number; dia?: number; name?: string }) => sides.map((sx) => at("dowel", [[sx * xi, y, z]], [-sx, 0, 0], id, side(sx), o));
  const strips4 = (ids: string[], o: typeof DOWEL) => ids.flatMap((id) => {
    const p = parts.find((q) => q.id === id)!;
    return strip(id, p.pos[1], p.pos[2], o);
  });
  const castor = (zs: number[], name: string) => [
    at("castor", zs.flatMap((z) => sides.map((sx) => [sx * 95, y0, z] as Vec3)), [0, 1, 0], "BT", undefined, { len: 58, dia: 50, name }),
    at("screw", zs.flatMap((z) => sides.flatMap((sx) => [[sx * 95 - 22, y0, z], [sx * 95 + 22, y0, z]] as Vec3[])), [0, 1, 0], "BT", undefined, { len: 16, dia: 4 }),
  ];
  const steps: CustomStep[] = [
    { title: "Screw four cam bolts into each side panel", detail: "Lay both on a rug, grooved face down. Into the holes near the top and bottom edges.", fix: sides.map((sx) => at("camScrew", ends(sx, [yt - 9, y0 + 9], [-150, 150]), [sx, 0, 0], side(sx), undefined, CAM_BOLT)), tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Tap dowels into the top and the bottom", detail: "Two into each end of both.", fix: [...sides.map((sx) => at("dowel", ends(sx, [yt - 9], [-80, 80]), [-sx, 0, 0], "TP", side(sx), DOWEL)), ...sides.map((sx) => at("dowel", ends(sx, [y0 + 9], [-80, 80]), [-sx, 0, 0], "BT", side(sx), DOWEL))], tools: ["hammer"] },
    { title: "Push the top and the bottom into one side panel", detail: "Lay the left side flat, then stand both on it over the bolts and dowels.", pose: "+x" },
    { title: "Turn four cam locks", detail: "Two in the top, two in the bottom, clockwise until tight.", fix: [at("cam", [[-xi + 34, yt - 18, -150], [-xi + 34, yt - 18, 150]], [0, 1, 0], "TP", undefined, CAM), at("cam", [[-xi + 34, y0 + 18, -150], [-xi + 34, y0 + 18, 150]], [0, -1, 0], "BT", undefined, CAM)], tools: ["screwdriver"] },
    { title: "Tap large dowels into the four rails", detail: "Two into each end.", fix: strips4(["FT", "BK", "FB", "BB"], BIG_DOWEL), tools: ["hammer"] },
    { title: "Tap dowels into the four strips", detail: "The two lips and the two narrow back strips, two into each end.", fix: strips4(["FL", "BL", "M1", "M2"], DOWEL), tools: ["hammer"] },
    { title: "Push the rails and strips into the side panel", detail: "Rails along the top and bottom, front and back, the lips along the top edge and the strips across the back." },
    { title: "Press the other side panel on", detail: "Over all the dowels and bolts at once." },
    { title: "Turn four more cam locks", fix: [at("cam", [[xi - 34, yt - 18, -150], [xi - 34, yt - 18, 150]], [0, 1, 0], "TP", undefined, CAM), at("cam", [[xi - 34, y0 + 18, -150], [xi - 34, y0 + 18, 150]], [0, -1, 0], "BT", undefined, CAM)], tools: ["screwdriver"] },
    { title: "Turn it upside down and screw on the castors with brakes", detail: "At the front. Two screws each.", fix: castor([150], "Castor with brake"), pose: "-y", tools: ["screwdriver"] },
    { title: "Screw on the other two castors", detail: "At the back, the same way.", fix: castor([-150], "Castor"), tools: ["screwdriver"] },
    { title: "Stand it up and push in the shelf pins", detail: "Four, at the height you want the shelf.", fix: sides.map((sx) => at("pin", ends(sx, [238], [-150, 150]), [sx, 0, 0], side(sx), undefined, { len: 16, dia: 5 })), pose: "+y" },
    { title: "Lay the shelf on the pins", detail: "Slide it in from the front.", add: ["SH"], from: { SH: [0, 0, 400] } },
    { title: "Screw a bracket inside each side panel", detail: "Under the top rail at the front, one screw each.", fix: [
        ...sides.map((sx) => at("angle", [[sx * xi, 365, zf - 40]], [sx, 0, 0], side(sx), undefined, { len: 40, dia: 20, name: "Bracket" })),
        ...sides.map((sx) => at("screw", [[sx * (xi - 6), 365, zf - 40]], [sx, 0, 0], side(sx), undefined, { len: 14, dia: 4 })),
      ], tools: ["screwdriver"] },
    { title: "Screw on the handle", detail: "Two screws from behind the top front rail.", fix: [at("handle", [[0, 405, zf]], [0, 0, -1], "FT"), at("screw", [[-48, 405, zf - 18], [48, 405, zf - 18]], [0, 0, 1], "FT", undefined, { len: 25, dia: 4 })], tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

/* ---------- swivel chair ---------- */

function chair(): CustomParams {
  const parts: CustomPart[] = [];
  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const R = 345;
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  parts.push({ id: "HUB", name: "Hub", size: [80, 50, 80], pos: [0, 85, 0], shape: "cyl", material: "metal" });
  angles.forEach((a, i) => {
    const [dx, dz] = dirOf(a);
    parts.push({ id: `A${i}`, name: "Base leg", size: [305, 30, 46], pos: [dx * 192, 85, dz * 192], rot: [0, a, 0], material: "metal" });
  });
  parts.push({ id: "BUSH", name: "Bushing", size: [56, 20, 56], pos: [0, 120, 0], shape: "cyl", material: "metal" });
  parts.push({ id: "GAS", name: "Gas lift", size: [50, 260, 50], pos: [0, 260, 0], shape: "cyl", material: "metal" });
  parts.push({ id: "MEC", name: "Seat mechanism", size: [220, 50, 220], pos: [0, 415, -20], material: "metal" });
  parts.push({ id: "BRK", name: "Back bracket", size: [60, 12, 210], pos: [0, 384, -135], material: "metal" });
  parts.push({ id: "BRV", name: "Back bracket upright", size: [60, 260, 14], pos: [0, 508, -247], material: "metal" });
  parts.push({ id: "SEAT", name: "Seat", size: [490, 90, 460], pos: [0, 485, 0], material: "soft" });
  parts.push({ id: "BACK", name: "Backrest", size: [480, 520, 70], pos: [0, 680, -275], rot: [-0.08, 0, 0], material: "soft" });
  const legScrews: Vec3[] = angles.flatMap((a) => [60, 95].map((r) => [dirOf(a)[0] * r, 100, dirOf(a)[1] * r] as Vec3));
  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * R, 70, dirOf(a)[1] * R]);
  const seatBolts: Vec3[] = [[-70, 390, -90], [70, 390, -90], [-70, 390, 50], [70, 390, 50]];
  const backBolts: Vec3[] = [[-18, 378, -60], [18, 378, -60], [-18, 378, -110], [18, 378, -110]];
  const steps: CustomStep[] = [
    { title: "Push the five legs into the hub", detail: "On a rug, each leg straight into its socket until it stops.", add: ["HUB", "A0", "A1", "A2", "A3", "A4"], warnings: ["floor"] },
    { title: "Screw the legs to the hub", detail: "Two screws with washers in each leg, with the Allen key.", fix: [at("washer", legScrews, [0, -1, 0], "HUB", undefined, { len: 1.5, dia: 16 }), at("bolt", legScrews, [0, -1, 0], "HUB", undefined, { len: 16, dia: 6, name: "Screw" })], tools: ["allen"] },
    { title: "Turn the base over and push in the castors", detail: "Push each castor's pin into the end of a leg until it clicks.", fix: [at("castor", tips, [0, 1, 0], undefined, undefined, { len: 58, dia: 50 })], pose: "-y" },
    { title: "Stand the base up and fit the bushing", detail: "Press it into the top of the hub.", add: ["BUSH"], pose: "+y" },
    { title: "Push the gas lift into the hub", detail: "Thin end up. Don't take it apart: it is under pressure.", add: ["GAS"] },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on a table with a rug. Four bolts with lock washers, the lever to the right.",
      add: ["SEAT", "MEC"],
      fix: [at("washer", seatBolts, [0, 1, 0], "MEC", undefined, { len: 2, dia: 14, name: "Lock washer" }), at("bolt", seatBolts, [0, 1, 0], "MEC", "SEAT", { len: 16, dia: 8 })],
      tools: ["allen"],
      from: { SEAT: [0, 500, 0], MEC: [0, 600, 0] },
    },
    { title: "Bolt the back bracket on", detail: "Four bolts through the bracket into the mechanism, tight with the Allen key.", add: ["BRK", "BRV", "BACK"], fix: [at("bolt", backBolts, [0, 1, 0], "BRK", "MEC", { len: 16, dia: 8 })], tools: ["allen"] },
    { title: "Lower the seat onto the gas lift", detail: "Stand the base on the floor and press the seat straight down onto the lift." },
    { title: "Sit down to seat the gas lift", detail: "Sit on it once and turn from side to side: your weight locks the taper." },
    { title: "Check the height lever", detail: "Lift the lever with no weight on the seat: it should rise. Sit and lift it to lower the seat." },
    { title: "Close the cover's zips", detail: "Pull the back cover down, close the two zips at the back and the strap under the seat." },
  ];
  return { parts, steps };
}

/** Parts that first show up holding their dowels or bolts are listed on the last step too, so none is added twice. */
function finish(c: CustomParams): CustomParams {
  const added = new Set(c.steps.flatMap((st) => st.add ?? []));
  const rest = c.parts.filter((p) => !added.has(p.id)).map((p) => p.id);
  const last = c.steps[c.steps.length - 1];
  last.add = [...(last.add ?? []), ...rest];
  return c;
}

function recipe(s: ProductSpec): CustomParams | null {
  const v = s.variant.toLowerCase();
  if (/swivel chair/.test(v)) return finish(chair());
  if (/storage unit/.test(v)) return finish(storage());
  if (/^desk/.test(v)) {
    if (s.size.w >= 130) return finish(cupboardDesk(s));
    return finish(desk(s, s.size.w > 100));
  }
  return null;
}

const family: Family = { names: ["BRYTNING"], recipe };
export default family;
