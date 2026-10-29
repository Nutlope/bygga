import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SYVDE, read from the dressing table's manual. The frame is built lying on its back on a rug: the back panel takes
 * dowels, the divider is screwed to it with two long Allen screws, the two front rails go on with cam bolts and
 * dowels, then both sides, and eight cam locks pull it all tight. Glides go under the sides, it is stood up, the
 * four drawer runners are screwed in, and the top goes on with cam bolts, dowels and six cam locks. The glass top is
 * laid on and held at the back by two clips. Each drawer is built on its own (cam bolts and locks at the front,
 * plastic pins and locks at the back, a knob), the deep one gets a divider on two wire hangers, and both are hung on
 * their runners.
 */

type Fx = Omit<CustomFix, "count"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 100.3 wide, 48.2 deep, 78 high
  const W = Math.round(s.size.w * 10) || 1003, D = Math.round(s.size.d * 10) || 482, H = Math.round(s.size.h * 10) || 780;
  const t = 18, gl = 4;
  const yT = H - gl - t; // underside of the top
  const xi = W / 2 - t; // inside faces of the sides
  const zB = -D / 2 + t, zF = D / 2; // front of the back panel, front edge
  const yC = 390; // bottom of the back panel, the divider and the deep drawer's opening
  const yRail = 625; // underside of the rail under the shallow drawer
  const cw = 400; // the deep drawer's opening
  const xV = xi - cw - t / 2; // divider
  const xs0 = xV - t / 2, xs1 = xV + t / 2;
  const box = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({ id, name, size, pos, material });
  const parts: CustomPart[] = [
    box("SL", "Side panel", [t, yT, D], [-W / 2 + t / 2, yT / 2, 0]),
    box("SR", "Side panel", [t, yT, D], [W / 2 - t / 2, yT / 2, 0]),
    box("BP", "Back panel", [2 * xi, yT - yC, t], [0, (yT + yC) / 2, zB - t / 2]),
    box("V", "Divider", [t, yT - yC, D - t], [xV, (yT + yC) / 2, t / 2]),
    box("RL", "Long rail", [xs0 + xi, t, 80], [(xs0 - xi) / 2, yRail + t / 2, zF - 40]),
    box("RS", "Short rail", [cw, t, 80], [(xs1 + xi) / 2, yC + t / 2, zF - 40]),
    box("T", "Top", [W, t, D], [0, yT + t / 2, 0]),
    box("G", "Glass top", [W, gl, D], [0, H - gl / 2, 0], "glass"),
  ];

  /** A drawer as one piece, front and box, centred in its opening (x0..x1), front from fy0 to fy1. */
  const drawer = (id: string, name: string, x0: number, x1: number, fy0: number, fy1: number, bh: number, divider: boolean): CustomPart => {
    const fw = x1 - x0 - 4, bw = x1 - x0 - 26, bd = 400, zf0 = zF - t;
    const yb0 = fy0 + 12;
    const c: Vec3 = [(x0 + x1) / 2, (fy0 + fy1) / 2, (zF - t - bd + zF) / 2];
    const at = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const pieces: PartPiece[] = [
      { shape: "box", size: [fw, fy1 - fy0, t], pos: at([c[0], c[1], zF - t / 2]) },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [t, bh, bd - t], pos: at([c[0] + sx * (bw / 2 - t / 2), yb0 + bh / 2, zf0 - (bd - t) / 2]) })),
      { shape: "box", size: [bw - 2 * t, bh - 12, t], pos: at([c[0], yb0 + 12 + (bh - 12) / 2, zf0 - bd + t + t / 2]) },
      { shape: "box", size: [bw - 2 * t, 3, bd - t], pos: at([c[0], yb0 + 8, zf0 - (bd - t) / 2]), material: "fiber" },
    ];
    if (divider) pieces.push({ shape: "box", size: [bw - 2 * t, bh - 40, t], pos: at([c[0], yb0 + 20 + (bh - 40) / 2, zf0 - bd / 2]) });
    return { id, name, size: [fw, fy1 - fy0, bd], pos: c, material: "board", pieces };
  };
  const DS = drawer("DS", "Shallow drawer", -xi, xs0, yRail + t + 2, yT - 2, 80, false);
  const DL = drawer("DL", "Deep drawer", xs1, xi, yC + t + 4, yT - 4, 280, true);
  parts.push(DS, DL);

  // the drawers' own joints, in finished-product points
  const dj = (d: CustomPart, bh: number) => {
    const bw = d.size[0] - 22, y0 = d.pos[1] - d.size[1] / 2 + 14;
    const xsd = [-1, 1].map((sx) => d.pos[0] + sx * (bw / 2 - t / 2));
    const ys = [y0 + 20, y0 + bh - 20];
    const zf = zF - t, zb = zF - t - d.size[2] + t;
    return { xsd, ys, zf, zb, bw, y0 };
  };
  const ds = dj(DS, 80), dl = dj(DL, 280);
  const grid = (xs: number[], ys: number[], z: number): Vec3[] => xs.flatMap((x) => ys.map((y): Vec3 => [x, y, z]));
  const camsFront = (d: CustomPart, j: typeof ds): CustomFix => fx({ kind: "camScrew", at: grid(j.xsd, j.ys, j.zf), dir: [0, 0, 1], on: d.id });
  // cam locks go into the inside face of each side
  const locks = (d: CustomPart, j: typeof ds, z: number): CustomFix[] =>
    j.xsd.map((x, i) => fx({ kind: "cam", dia: 15, at: j.ys.map((y): Vec3 => [x + (i ? -t / 2 : t / 2), y, z]), dir: [i ? 1 : -1, 0, 0], on: d.id }));
  const pins = (d: CustomPart, j: typeof ds, bh: number): CustomFix =>
    fx({ kind: "dowel", name: "Plastic pin", at: j.xsd.flatMap((x) => [j.y0 + bh, j.y0 + bh - 30].map((y): Vec3 => [x, y, j.zb])), dir: [0, 0, 1], on: d.id });
  const knob = (d: CustomPart): CustomFix[] => {
    const y = d.id === "DS" ? d.pos[1] : d.pos[1] + d.size[1] / 2 - 50;
    return [
      fx({ kind: "knob", at: [[d.pos[0], y, zF]], dir: [0, 0, -1], on: d.id, dia: 24 }),
      // just off the inside face: closer and the builder would nudge it away from the knob
      fx({ kind: "screw", len: 30, dia: 4, at: [[d.pos[0], y, zF - t - 5]], dir: [0, 0, 1], on: d.id }),
    ];
  };

  const yBP = (yT + yC) / 2;
  const runner = (x: number, y: number, sx: number, on: string): CustomFix[] => [
    fx({ kind: "runner", len: 400, dia: 30, at: [[x, y, 20]], dir: [sx, 0, 0], on }),
    fx({ kind: "screw", len: 12, dia: 4, at: [[x, y, -140], [x, y, 180]], dir: [sx, 0, 0], on }),
  ];
  const topXs = [-W / 2 + t / 2, xV, W / 2 - t / 2];
  const topIds = ["SL", "V", "SR"];

  return {
    parts,
    steps: [
      {
        title: "Tap dowels into the ends of the back panel",
        detail: "Lay it flat on a rug. Two dowels go into each end.",
        add: ["BP"],
        fix: [-1, 1].map((sx) => fx({ kind: "dowel", at: [yBP - 120, yBP + 120].map((y): Vec3 => [sx * xi, y, zB - t / 2]), dir: [-sx, 0, 0], on: "BP", mate: sx < 0 ? "SL" : "SR" })),
        pose: "+z",
        warnings: ["floor"],
      },
      {
        title: "Screw the divider to the back panel",
        detail: "Stand it on its back edge on the panel and turn the two long screws in from behind with the Allen key.",
        add: ["V"],
        fix: [fx({ kind: "screw", name: "Allen screw", len: 50, dia: 7, at: [yBP - 110, yBP + 110].map((y): Vec3 => [xV, y, -D / 2]), dir: [0, 0, 1], on: "BP", mate: "V" })],
        tools: ["allen"],
      },
      {
        title: "Screw two cam bolts into the divider",
        detail: "One on each face at its front edge, for the two rails.",
        fix: [
          fx({ kind: "camScrew", at: [[xs0, yRail + t / 2, zF - 40]], dir: [1, 0, 0], on: "V", mate: "RL" }),
          fx({ kind: "camScrew", at: [[xs1, yC + t / 2, zF - 40]], dir: [-1, 0, 0], on: "V", mate: "RS" }),
        ],
        tools: ["screwdriver"],
      },
      {
        title: "Tap a dowel into each end of the rails",
        detail: "One in each end of the long rail and the short rail.",
        fix: [
          fx({ kind: "dowel", at: [[-xi, yRail + t / 2, zF - 25]], dir: [1, 0, 0], on: "RL", mate: "SL" }),
          fx({ kind: "dowel", at: [[xs0, yRail + t / 2, zF - 60]], dir: [-1, 0, 0], on: "RL", mate: "V" }),
          fx({ kind: "dowel", at: [[xs1, yC + t / 2, zF - 25]], dir: [1, 0, 0], on: "RS", mate: "V" }),
          fx({ kind: "dowel", at: [[xi, yC + t / 2, zF - 60]], dir: [-1, 0, 0], on: "RS", mate: "SR" }),
        ],
        wait: ["RL", "RS"],
      },
      { title: "Push the short rail onto the divider", detail: "Its dowel goes into the divider beside the cam bolt.", add: ["RS"] },
      {
        title: "Screw cam bolts into both sides",
        detail: "Three in each side: two for the back panel and one for a rail.",
        fix: [-1, 1].map((sx) =>
          fx({ kind: "camScrew", at: [[sx * xi, yBP - 50, zB - t / 2], [sx * xi, yBP + 50, zB - t / 2], [sx * xi, (sx < 0 ? yRail : yC) + t / 2, zF - 60]], dir: [-sx, 0, 0], on: sx < 0 ? "SL" : "SR" }),
        ),
        wait: ["SL", "SR"],
        tools: ["screwdriver"],
      },
      { title: "Fit the right side", detail: "Onto the back panel and the short rail, bolts into their holes.", add: ["SR"] },
      { title: "Push the long rail onto the divider", detail: "On the other side of the divider, dowel and bolt into their holes.", add: ["RL"] },
      { title: "Fit the left side", detail: "Swing it up onto the back panel and the long rail.", add: ["SL"] },
      {
        title: "Turn the eight cam locks",
        detail: "Four in the back panel and one at each end of the rails. Arrow towards the bolt, then turn clockwise until tight.",
        fix: [
          fx({ kind: "cam", at: [-1, 1].flatMap((sx) => [yBP - 50, yBP + 50].map((y): Vec3 => [sx * (xi - 30), y, zB])), dir: [0, 0, -1], on: "BP", dia: 15 }),
          fx({ kind: "cam", at: [[-xi + 30, yRail + t, zF - 60], [xs0 - 30, yRail + t, zF - 40]], dir: [0, -1, 0], on: "RL", dia: 15 }),
          fx({ kind: "cam", at: [[xs1 + 30, yC + t, zF - 40], [xi - 30, yC + t, zF - 60]], dir: [0, -1, 0], on: "RS", dia: 15 }),
        ],
        tools: ["screwdriver"],
      },
      {
        title: "Push the glides into the sides",
        detail: "Two under each side, into the holes in the bottom edge.",
        fix: [-1, 1].map((sx) => fx({ kind: "glide", name: "Glide", len: 6, dia: 16, at: [[sx * (W / 2 - t / 2), 0, -D / 2 + 60], [sx * (W / 2 - t / 2), 0, D / 2 - 60]], dir: [0, 1, 0], on: sx < 0 ? "SL" : "SR" })),
      },
      { title: "Stand it up", detail: "Lift it onto its feet, holding both sides.", pose: "+y" },
      {
        title: "Screw in the drawer runners",
        detail: "The short runners go high in the left opening, the others low in the right one. Two screws in each.",
        fix: [...runner(-xi, yRail + t + 18, -1, "SL"), ...runner(xs0, yRail + t + 18, 1, "V"), ...runner(xs1, yC + t + 20, -1, "V"), ...runner(xi, yC + t + 20, 1, "SR")],
        tools: ["screwdriver"],
      },
      {
        title: "Screw cam bolts into the top",
        detail: "Lay it upside down beside the frame and turn in six bolts, two over each side and two over the divider.",
        fix: [fx({ kind: "camScrew", at: topXs.flatMap((x) => [-150, 150].map((z): Vec3 => [x, yT, z])), dir: [0, 1, 0], on: "T" })],
        wait: ["T"],
        tools: ["screwdriver"],
      },
      {
        title: "Tap dowels into the top edges",
        detail: "Two in each side and two in the divider.",
        fix: topIds.map((id, i) => fx({ kind: "dowel", at: [-80, 80].map((z): Vec3 => [topXs[i], yT, z + (id === "V" ? t / 2 : 0)]), dir: [0, -1, 0], on: id, mate: "T" })),
      },
      { title: "Lower the top onto the frame", detail: "Turn it over and press it down onto the dowels and bolts.", add: ["T"] },
      {
        title: "Turn the six cam locks under the top",
        detail: "In the sides and the divider, just under the top.",
        fix: [
          fx({ kind: "cam", at: [-150, 150].map((z): Vec3 => [-xi, yT - 30, z]), dir: [1, 0, 0], on: "SL", dia: 15 }),
          fx({ kind: "cam", at: [-150, 150].map((z): Vec3 => [xs0, yT - 30, z]), dir: [1, 0, 0], on: "V", dia: 15 }),
          fx({ kind: "cam", at: [-150, 150].map((z): Vec3 => [xi, yT - 30, z]), dir: [-1, 0, 0], on: "SR", dia: 15 }),
        ],
        tools: ["screwdriver"],
      },
      { title: "Lay the glass top on", detail: "Lower it flat onto the top, lined up with the edges.", add: ["G"], warnings: ["hand"] },
      {
        title: "Fit the glass clips at the back",
        detail: "Hook one over each back corner of the glass and screw it into the back edge of the top.",
        fix: [
          fx({ kind: "bracket", name: "Glass clip", len: 30, dia: 20, at: [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 40), H, -D / 2]), dir: [0, -1, 0], on: "T" }),
          fx({ kind: "screw", len: 12, dia: 4, at: [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 40), yT + t / 2, -D / 2]), dir: [0, 0, 1], on: "T" }),
        ],
        tools: ["screwdriver"],
      },
      {
        title: "Screw cam bolts into the shallow drawer front",
        detail: "Lay the front face down and turn four bolts in, two at each end.",
        fix: [camsFront(DS, ds)],
        wait: ["DS"],
        from: { DS: [-450, 0, 250] },
        tools: ["screwdriver"],
      },
      {
        title: "Fit the sides and lock them",
        detail: "Push both sides onto the bolts, then turn the four cam locks in them.",
        fix: locks(DS, ds, ds.zf - 30),
        tools: ["screwdriver"],
      },
      {
        title: "Slide in the bottom and fit the back",
        detail: "The bottom goes into the grooves in the sides, then the back on top with four plastic pins.",
        fix: [pins(DS, ds, 80)],
      },
      { title: "Lock the back", detail: "Turn the four cam locks in the sides at the back.", fix: locks(DS, ds, ds.zb + 30), tools: ["screwdriver"] },
      { title: "Screw on the knob", detail: "The screw goes in from inside the drawer.", fix: knob(DS), tools: ["screwdriver"] },
      {
        title: "Screw cam bolts into the deep drawer front",
        detail: "Four, two at each end.",
        fix: [camsFront(DL, dl)],
        wait: ["DL"],
        from: { DL: [450, 0, 250] },
        tools: ["screwdriver"],
      },
      {
        title: "Tap dowels into the sides",
        detail: "Two in each end of both sides.",
        fix: [fx({ kind: "dowel", at: [...grid(dl.xsd, [dl.ys[0] + 60, dl.ys[1] - 60], dl.zf), ...grid(dl.xsd, [dl.ys[0] + 60, dl.ys[1] - 60], dl.zb)], dir: [0, 0, -1], on: "DL" })],
      },
      { title: "Fit the sides and lock them", detail: "Push the sides onto the front, then turn the four cam locks.", fix: locks(DL, dl, dl.zf - 30), tools: ["screwdriver"] },
      {
        title: "Slide in the bottom and fit the back",
        detail: "Bottom into the grooves, then the back on with four plastic pins.",
        fix: [pins(DL, dl, 280)],
      },
      { title: "Lock the back", detail: "Turn the four cam locks at the back.", fix: locks(DL, dl, dl.zb + 30), tools: ["screwdriver"] },
      { title: "Screw on the knob", detail: "Near the top of the front, screwed from inside.", fix: knob(DL), tools: ["screwdriver"] },
      {
        title: "Hang the divider in the deep drawer",
        detail: "Hook the two wire hangers into the sides, then drop the divider down onto them.",
        fix: [fx({ kind: "hook", name: "Wire hanger", len: 40, dia: 10, at: dl.xsd.map((x): Vec3 => [x + (x > DL.pos[0] ? -t / 2 : t / 2), dl.y0 + 250, DL.pos[2] - 40]), dir: [0, -1, 0], on: "DL" })],
      },
      { title: "Hang the deep drawer on its runners", detail: "Rest it on the runners, push it in until the catches click.", add: ["DL"], from: { DL: [0, 0, 420] } },
      { title: "Hang the shallow drawer on its runners", detail: "The same way, in the opening on the left.", add: ["DS"], from: { DS: [0, 0, 420] } },
      { title: "Line up the drawer fronts", detail: "If a front sits crooked, turn the two adjusters on its runners until the gaps are even." },
    ],
  };
}

const family: Family = { names: ["SYVDE"], recipe };
export default family;
