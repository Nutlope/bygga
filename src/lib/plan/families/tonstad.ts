import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { POSE_EULER, unrotate } from "../math";

/**
 * TONSTAD, read from its manuals. The cabinets, bookcases, shelving units, sideboards and TV benches share one
 * system: the panels come with click connectors already in them, so a side, the top and the bottom just hook
 * together on a rug, the back slides into grooves and is held by screws and plastic clips, and nothing needs cam
 * locks. The oak pieces (and the off-white sliding door cabinets and shelving unit) stand on a plinth built from
 * four rails with dowels and cam locks and fixed on with four angle plates; the other off-white pieces stand on
 * adjustable feet screwed into the bottom. Everything is fixed to the wall with brackets at the top.
 */

/* ---------- a small engine: parts where they end up, steps that show, add and fix them ---------- */

interface Part {
  id: string;
  name: string;
  size: Vec3; // mm; a cylinder is [dia, length, dia] along its own y
  pos: Vec3;
  mat?: PartMaterial;
  cyl?: boolean;
  rot?: Vec3;
  pieces?: PartPiece[];
  extra?: boolean; // not in the box
}
interface Fit {
  def: HwDef;
  at: Vec3[];
  dir: Vec3;
  on?: string;
  mate?: string;
  hole?: false;
  twist?: number;
  travel?: number;
}
interface Stage {
  id: string;
  pos: Vec3; // in the step's scene
  rot?: Vec3;
  from?: Vec3;
}
interface St {
  title: string;
  detail?: string;
  kind: StepKind;
  stage?: Stage[];
  pre?: Fit[]; // before the parts arrive
  add?: string[];
  from?: Vec3 | Record<string, Vec3>;
  fit?: Fit[];
  preset?: Fit[]; // already in place on parts that arrive built (the other drawers, doors)
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  scene?: string;
  warnings?: WarnId[];
  repeat?: number;
  check?: "square";
  wall?: boolean;
}

function run(b: PlanBuilder, parts: Part[], steps: St[]) {
  const keys = new Map<string, string>();
  const types = new Map<string, string>();
  for (const p of parts) {
    const tk = `${p.name}|${p.size.map((n) => Math.round(n)).join("x")}|${p.cyl ? "c" : "b"}|${p.mat ?? "board"}|${p.pieces ? JSON.stringify(p.pieces) : ""}|${p.extra ? "x" : ""}`;
    let ref = types.get(tk);
    if (!ref) {
      ref = b.part(p.name, p.size, { shape: p.cyl ? "cyl" : "box", material: p.mat ?? "board", extra: p.extra });
      if (p.pieces) b.parts[b.parts.length - 1].pieces = p.pieces;
      types.set(tk, ref);
    }
    keys.set(p.id, b.place(ref, p.pos, p.rot ?? [0, 0, 0]));
  }
  const key = (id: string) => {
    const k = keys.get(id);
    if (!k) throw new Error(`TONSTAD: no part ${id}`);
    return k;
  };
  const added = new Set<string>();
  const opts = (f: Fit): FitOpts[] =>
    f.at.map((at) => ({ on: f.on ? key(f.on) : undefined, at, dir: f.dir, mate: f.mate ? key(f.mate) : undefined, hole: f.hole, twist: f.twist, travel: f.travel }));
  const emit = (list: Fit[] | undefined) => {
    if (!list?.length) return;
    const n = list.reduce((s, f) => s + f.at.length, 0);
    b.stagger(0.05);
    for (const f of list) {
      b.fits(f.def, opts(f), Math.min(0.08, 2.4 / Math.max(1, n)));
      b.then(0.08);
    }
  };
  let pose: Pose = "+y";
  for (const st of steps) {
    pose = st.pose ?? pose;
    const up = unrotate([0, 1, 0], POSE_EULER[pose]).map((v) => Math.round(v)) as Vec3;
    b.step(
      {
        title: st.title,
        detail: st.detail,
        kind: st.kind,
        tools: st.tools,
        people: st.people,
        pose,
        scene: st.scene,
        warnings: [...new Set([...(st.warnings ?? []), ...(st.people === 2 ? (["two"] as WarnId[]) : [])])].slice(0, 3),
        repeat: st.repeat,
        check: st.check,
        wall: st.wall,
      },
      () => {
        if (st.stage?.length) {
          b.stagger(st.stage.length > 3 ? 0.16 : 0.24);
          for (const g of st.stage) {
            const it = b.partItem(key(g.id));
            b.stage(key(g.id), g.pos, g.rot ?? it.final.rot, g.from ?? [up[0] * 260, up[1] * 260, up[2] * 260]);
          }
          b.then(0.15);
        }
        emit(st.pre);
        if (st.add?.length) {
          b.stagger(st.add.length > 3 ? 0.16 : 0.26);
          for (const id of st.add) {
            if (added.has(id)) throw new Error(`TONSTAD: ${id} added twice`);
            added.add(id);
            const fr = st.from;
            const from = Array.isArray(fr) ? fr : fr?.[id] ?? ([up[0] * 300, up[1] * 300, up[2] * 300] as Vec3);
            b.add(key(id), from);
          }
          b.then(0.12);
        }
        for (const f of st.preset ?? []) for (const o of opts(f)) b.preset(f.def, o);
        emit(st.fit);
      },
    );
  }
  const left = parts.filter((p) => !added.has(p.id)).map((p) => p.id);
  if (left.length) throw new Error(`TONSTAD: never added ${left.join(", ")}`);
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const fit = (def: HwDef, at: Vec3[], dir: Vec3, o: Partial<Fit> = {}): Fit => ({ def, at, dir, ...o });
const box = (id: string, name: string, size: Vec3, pos: Vec3, mat: PartMaterial = "board"): Part => ({ id, name, size, pos, mat });

/* ---------- fittings ---------- */

const FOOT: HwDef = { kind: "foot", len: 24, dia: 30 };
const GLIDE_BAR: HwDef = { kind: "glide", len: 8, dia: 36 };
const BUMPER: HwDef = { kind: "glide", len: 4, dia: 10 };
const BACK_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const COVER: HwDef = { kind: "cap", len: 2, dia: 12 };
const BACK_CLIP: HwDef = { kind: "clip", len: 14, dia: 14 };
const BACK_CONNECTOR: HwDef = { kind: "clip", len: 20, dia: 18 };
const LONG_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const RAIL_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const DRUM_BRACKET: HwDef = { kind: "bracket", len: 50, dia: 44 };
const WALL_ANGLE: HwDef = { kind: "bracket", len: 110, dia: 30 };
const SMALL_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const PLATE: HwDef = { kind: "angle", len: 40, dia: 30 };
const PLATE_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const ROLLER: HwDef = { kind: "roller", len: 44, dia: 26 };
const GUIDE: HwDef = { kind: "roller", len: 30, dia: 18 };
const DOOR_STOP: HwDef = { kind: "glide", len: 6, dia: 14 };
const WALL_SCREW: HwDef = HW.wallScrew;
const WALL_PLUG: HwDef = HW.plug;

/* ---------- cabinets, bookcases, shelving units, sideboards, TV benches, chests ---------- */

interface PlinthCfg {
  bolts: number; // cam bolts
  dowels: number;
  cams: number;
  plates: number; // angle plates, two screws into the plinth and two into the bottom each
  feet: number; // adjustable feet in the plinth
  glides?: number; // glide bars under the back rail
}
const OAK_PLINTH: PlinthCfg = { bolts: 6, dowels: 7, cams: 6, plates: 4, feet: 4 };
const WHITE_PLINTH: PlinthCfg = { bolts: 8, dowels: 5, cams: 8, plates: 4, feet: 3, glides: 3 };

interface CaseCfg {
  W: number;
  H: number;
  D: number;
  plinth?: PlinthCfg;
  feet?: number; // adjustable feet screwed into the bottom (no plinth)
  dividers?: number; // full-height uprights inside
  fixed?: number[]; // fixed shelves, mm up from the floor
  backs: number; // back panels
  backSplit?: "h" | "v"; // stacked, or side by side at the uprights
  backScrews?: number; // screws (with cover caps) through the back into the uprights or fixed shelf
  backConnectors?: number; // clips joining two back panels at a fixed shelf
  backClips: number;
  rail?: number; // a rail across the top of the back, held by this many screws
  topScrews?: number; // long screws down through the top into the uprights
  bottomOn?: { dowels: number; screws: number }; // the bottom goes on last, on dowels, with long screws
  shelves: number; // loose shelves on four pins each
  wall: "drum" | "angle";
  bracketsLate?: boolean; // the wall brackets go on after the plinth
  doors?: { kind: "hinged" | "sliding"; glass?: boolean; n: number; handles?: boolean };
  drawers?: { rows: number; cols: number; frontH?: number; at: "top" | "all" };
  stops?: number; // door stops under the top
  shelfFirst?: boolean; // the fixed shelf goes into the first side, the top goes on last
}

const T = 18;
const PH = 60; // plinth height

interface Geo {
  c: CaseCfg;
  Dc: number;
  zc: number;
  ySide: number;
  yB: number;
  Wi: number;
  yTopU: number;
  yBotU: number;
  hIn: number;
  zBack: number;
  dIn: number;
  zIn: number;
  cols: number;
  cw: number;
  colX: (i: number) => number;
  divX: (i: number) => number;
  zFront: number;
}

function geoOf(c: CaseCfg): Geo {
  const front = c.doors?.kind === "hinged" || c.drawers?.at === "all";
  const Dc = front ? c.D - T : c.D; // hinged doors and drawer fronts sit in front of the carcass
  const zc = front ? -T / 2 : 0;
  const ySide = c.plinth ? PH : 10;
  const yB = c.plinth ? PH : 30;
  const Wi = c.W - 2 * T;
  const nDiv = c.dividers ?? 0;
  const cols = nDiv + 1;
  const cw = (Wi - nDiv * T) / cols;
  const yTopU = c.H - T, yBotU = yB + T;
  return {
    c,
    Dc,
    zc,
    ySide,
    yB,
    Wi,
    yTopU,
    yBotU,
    hIn: yTopU - yBotU,
    zBack: zc - Dc / 2 + 10,
    dIn: Dc - 14,
    zIn: zc + 7,
    cols,
    cw,
    colX: (i) => -Wi / 2 + cw / 2 + i * (cw + T),
    divX: (i) => -Wi / 2 + (i + 1) * cw + i * T + T / 2,
    zFront: zc + Dc / 2,
  };
}

/** Where each drawer goes: its front, its box and the runners under it. */
interface Dw {
  i: number;
  col: number;
  fx: number; // front centre x
  fy: number; // bottom of the front
  fw: number;
  fh: number;
  bx: number; // box centre x
  bw: number;
  by: number; // underside of the box
  sideH: number;
}
function drawersOf(g: Geo): Dw[] {
  const { c } = g;
  const dr = c.drawers;
  if (!dr) return [];
  const out: Dw[] = [];
  const all = dr.at === "all";
  const fh = all ? (c.H - g.ySide - 3 * (dr.rows + 1)) / dr.rows : dr.frontH!;
  const fw = all ? (c.W - 3 * (dr.cols + 1)) / dr.cols : g.cw - 4;
  let i = 0;
  for (let r = 0; r < dr.rows; r++)
    for (let ci = 0; ci < dr.cols; ci++) {
      const fy = all ? g.ySide + 3 + (dr.rows - 1 - r) * (fh + 3) : g.yTopU - fh - 2;
      const fx = all ? -c.W / 2 + 3 + fw / 2 + ci * (fw + 3) : g.colX(ci);
      const sideH = Math.max(60, Math.min(fh - 50, 150));
      out.push({ i: i++, col: ci, fx, fy, fw, fh, bx: g.colX(ci), bw: g.cw - 30, by: all ? Math.max(fy + 25, g.yBotU + 6) : fy + 15, sideH }); // a box never sinks into the bottom panel
    }
  return out;
}

function caseBuild(b: PlanBuilder, c: CaseCfg) {
  const g = geoOf(c);
  const { W, H } = c;
  const { Dc, zc, ySide, yB, Wi, yTopU, yBotU, hIn, zBack, dIn, zIn, cols, cw, colX, divX } = g;
  const nDiv = c.dividers ?? 0;
  const dws = drawersOf(g);
  const big = H > 1000 || W > 1100;

  const parts: Part[] = [];
  const steps: St[] = [];
  parts.push(box("SL", "Side panel", [T, H - ySide, Dc], [-W / 2 + T / 2, (H + ySide) / 2, zc]));
  parts.push(box("SR", "Side panel", [T, H - ySide, Dc], [W / 2 - T / 2, (H + ySide) / 2, zc]));
  parts.push(box("TP", "Top panel", [Wi, T, Dc], [0, H - T / 2, zc]));
  parts.push(box("BT", "Bottom panel", [Wi, T, Dc], [0, yB + T / 2, zc]));
  const divIds = range(nDiv).map((i) => {
    parts.push(box(`DV${i}`, "Upright", [T, hIn, dIn], [divX(i), yBotU + hIn / 2, zIn]));
    return `DV${i}`;
  });
  const fixed = (c.fixed ?? []).map((y, i) => {
    parts.push(box(`FX${i}`, "Fixed shelf", [Wi, T, dIn], [0, y, zIn]));
    return `FX${i}`;
  });
  // a sideboard's drawers run over a fixed shelf in each section
  const yDrawerShelf = c.drawers?.at === "top" ? yTopU - c.drawers.frontH! - 4 - T / 2 : 0;
  const drawerShelves = c.drawers?.at === "top"
    ? range(cols).map((i) => {
        parts.push(box(`DS${i}`, "Fixed shelf", [cw, T, dIn], [colX(i), yDrawerShelf, zIn]));
        return `DS${i}`;
      })
    : [];

  // back panels: stacked halves split at the fixed shelf, or side by side split at the upright
  const backIds: string[] = [];
  if (c.backs > 1 && c.backSplit === "v") {
    const xs = [-Wi / 2 - 8, ...range(nDiv).map((i) => divX(i)), Wi / 2 + 8];
    for (let i = 0; i < c.backs; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      parts.push(box(`BK${i}`, "Back panel", [x1 - x0, hIn + 16, 3], [(x0 + x1) / 2, yBotU + hIn / 2, zBack], "fiber"));
      backIds.push(`BK${i}`);
    }
  } else {
    const cuts = [yBotU - 8, ...(c.backs > 1 ? (c.fixed?.length ? c.fixed : [yBotU + hIn / 2]) : []), yTopU + 8];
    for (let i = 0; i < c.backs; i++) {
      const y0 = cuts[i], y1 = cuts[i + 1];
      parts.push(box(`BK${i}`, "Back panel", [Wi + 16, y1 - y0, 3], [0, (y0 + y1) / 2, zBack], "fiber"));
      backIds.push(`BK${i}`);
    }
  }
  const behind = zBack - 1.5;
  const rel = (id: string, c0: Vec3): Vec3 => {
    const p = parts.find((q) => q.id === id)!;
    return [p.pos[0] - c0[0], p.pos[1] - c0[1], p.pos[2] - c0[2]];
  };

  // runners for the drawers go onto the sides (and uprights) first, flat on the rug
  if (dws.length) {
    const hostAt = (x: number) => (x < -Wi / 2 + 1 ? "SL" : x > Wi / 2 - 1 ? "SR" : divIds[Math.max(0, Math.min(nDiv - 1, Math.round((x + Wi / 2 - cw) / (cw + T))))]);
    const runner: HwDef = { kind: "runner", len: Math.round(Dc - 60), dia: 40 };
    const pts = dws.flatMap((d) => [-1, 1].map((sx) => ({ x: d.bx + sx * (cw / 2), y: d.by - 4, sx })));
    const zr = zc + 10;
    const hosts = [...new Set(pts.map((p) => hostAt(p.x)))];
    steps.push({
      title: hosts.length > 2 ? "Screw the runners onto the sides and uprights" : "Screw the runners onto the side panels",
      detail: "Lay them on the rug, insides up. The runners are marked left and right; two screws hold each one.",
      kind: "runners",
      scene: "sides",
      pose: "+y",
      stage: hosts.map((id, k) => ({ id, pos: [(k - (hosts.length - 1) / 2) * (H - ySide + 80), 0, 0], rot: [0, 0, (id === "SR" ? -1 : 1) * (Math.PI / 2)] })),
      fit: hosts.flatMap((id) => {
        const mine = pts.filter((p) => hostAt(p.x) === id);
        // each screw starts inside the drawer's opening and goes out into the panel the runner sits on
        return [
          fit(runner, mine.map((p) => [p.x, p.y, zr] as Vec3), [0, 1, 0], { on: id, hole: false }),
          ...[-1, 1].flatMap((sx) => {
            const pp = mine.filter((p) => p.sx === sx);
            return pp.length ? [fit(RUNNER_SCREW, pp.flatMap((p) => [zr - Dc / 3, zr + Dc / 3].map((z) => [p.x - sx * 6, p.y + 10, z] as Vec3)), [sx, 0, 0], { on: id })] : [];
          }),
        ];
      }),
      tools: ["screwdriver"],
      warnings: ["floor"],
    });
  }

  // feet in the bottom panel, screwed in first, on the rug
  const spread = (n: number, half: number) => (n === 1 ? [0] : range(n).map((i) => -half + (2 * half * i) / (n - 1)));
  if (c.feet) {
    const zf = Dc / 2 - 50;
    const pts: Vec3[] =
      c.feet === 4
        ? [-1, 1].flatMap((sz) => [-1, 1].map((sx) => [sx * (Wi / 2 - 50), yB, zc + sz * zf] as Vec3))
        : [...spread(c.feet - 2, Wi / 2 - 50).map((x) => [x, yB, zc + zf] as Vec3), ...[-1, 1].map((sx) => [sx * (Wi / 2 - 50), yB, zc - zf] as Vec3)];
    steps.push({
      title: `Screw the ${c.feet} feet into the bottom panel`,
      detail: "Lay it on the rug, underside up, and turn each foot in by hand until it stops.",
      kind: "legs",
      stage: [{ id: "BT", pos: [0, 0, 0], rot: [Math.PI, 0, 0] }],
      fit: [fit(FOOT, pts, [0, 1, 0], { on: "BT" })],
      scene: "bottom",
      pose: "+y",
      warnings: ["floor"],
    });
  }

  // the frame, lying on its front so the back can slide in from above
  const firstIn = fixed.length ? fixed : [...divIds, ...drawerShelves];
  const frameStart: St = {
    title: "",
    kind: "join",
    from: [0, 0, -260],
    pose: "-z",
    scene: "main",
    warnings: ["floor"],
  };
  const otherSide: St = {
    title: "Click on the other side panel",
    detail: big ? "Lower it onto the connectors together, one person at each end." : "Lower it onto the connectors and press until it clicks.",
    kind: "join",
    add: ["SR"],
    from: [0, 0, -260],
    people: big ? 2 : 1,
  };
  const bottom: St = {
    title: "Click in the bottom panel",
    detail: c.plinth ? "Holes for the plinth face out." : "Feet facing out. Hook it in and press it down until it clicks.",
    kind: "join",
    add: ["BT"],
    from: [0, 0, -260],
  };
  if (c.shelfFirst) {
    steps.push({ ...frameStart, title: "Click the fixed shelf into a side panel", detail: "Stand the side on its long edge on a rug. Hook the connectors in the shelf into the slots and push down until they click.", add: ["SL", ...fixed] });
    steps.push(otherSide, bottom);
    steps.push({ title: "Click in the top panel", detail: "At the other end, the same way.", kind: "join", add: ["TP"], from: [0, 0, -260] });
  } else {
    steps.push({ ...frameStart, title: "Click the top into a side panel", detail: "Stand the side on its long edge on a rug. Hook the connectors in the top into the slots and push down until they click.", add: ["SL", "TP"] });
    if (firstIn.length)
      steps.push({
        title: fixed.length ? "Click in the fixed shelf" : divIds.length > 1 ? `Click in the ${divIds.length} uprights` : drawerShelves.length ? "Click in the upright and the shelves" : "Click in the upright",
        detail: fixed.length ? "Same as the top: hook it into the slots and press down." : "Hook each one in and press it down until it clicks.",
        kind: "join",
        add: firstIn,
        from: [0, 0, -260],
      });
    steps.push(otherSide);
    if (!c.bottomOn) steps.push(bottom);
  }

  // back
  steps.push({
    title: c.backs > 1 ? "Slide in the back panels" : "Slide in the back panel",
    detail: c.backs > 1 ? "Each one runs in the grooves in the sides, smooth side into the cabinet." : "It runs in the grooves in the sides until it meets the far end.",
    kind: "join",
    add: backIds,
    from: c.backSplit === "v" ? [0, 0, -60] : [0, -0.4 * (H - yB), -40],
  });
  if (c.backScrews) {
    const pts: Vec3[] = [];
    if (divIds.length) {
      const per = Math.ceil(c.backScrews / divIds.length);
      for (let i = 0; i < nDiv; i++) for (let k = 0; k < per; k++) pts.push([divX(i), yBotU + (hIn * (k + 1)) / (per + 1), behind]);
    } else {
      const rows = c.fixed?.length ? c.fixed : [yBotU + hIn / 2];
      const per = Math.ceil(c.backScrews / rows.length);
      for (const y of rows) for (let k = 0; k < per; k++) pts.push([-Wi / 2 + (Wi * (k + 1)) / (per + 1), y, behind]);
    }
    pts.splice(c.backScrews);
    const into = divIds[0] ?? fixed[0] ?? drawerShelves[0];
    steps.push({
      title: divIds.length ? "Screw the back to the uprights" : "Screw the back to the fixed shelf",
      detail: "Through the holes in the back. Press a cover cap onto each screw head.",
      kind: "screws",
      fit: [fit(BACK_SCREW, pts, [0, 0, 1], { on: backIds[0], mate: into }), fit(COVER, pts.map((p) => [p[0], p[1], p[2] - 1] as Vec3), [0, 0, 1], { on: backIds[0], hole: false })],
      tools: ["screwdriver"],
    });
  }
  if (c.backConnectors) {
    const y = (c.fixed ?? [yBotU + hIn / 2])[0];
    steps.push({
      title: "Clip the back panels together",
      detail: "Push each connector over the joint between the two panels and turn it a quarter turn.",
      kind: "general",
      fit: [fit(BACK_CONNECTOR, spread(c.backConnectors, Wi / 3).map((x) => [x, y, behind] as Vec3), [0, 0, 1], { on: fixed[0] ?? "TP", hole: false })],
    });
  }
  if (c.backClips) {
    // clips round the edges: a quarter on each side, the rest along the top and bottom
    const n = c.backClips;
    const nSide = Math.max(1, Math.round(n / 4));
    const pts: Vec3[] = [];
    for (const x of [-Wi / 2 - 4, Wi / 2 + 4]) for (const y of spread(nSide, hIn / 2 - 80)) pts.push([x, yBotU + hIn / 2 + y, behind]);
    const left = n - pts.length;
    const nTop = Math.ceil(left / 2);
    for (const x of spread(nTop, Wi / 2 - 80)) pts.push([x, yTopU + 4, behind]);
    for (const x of spread(left - nTop, Wi / 2 - 80)) pts.push([x, yBotU - 4, behind]);
    steps.push({
      title: `Clip the back in with the ${n} clips`,
      detail: "Push each clip into its hole along the edges, then press its cap on until it clicks over the back.",
      kind: "general",
      fit: [fit(BACK_CLIP, pts.slice(0, n), [0, 0, 1], { on: "TP", hole: false })],
    });
  }
  if (c.rail) {
    parts.push(box("RL", "Back rail", [Wi, 60, T], [0, yTopU - 32, zBack + 1.5 + T / 2]));
    const n = c.rail;
    steps.push({
      title: "Screw the rail across the back",
      detail: "It sits against the back panel just under the top and holds the panel flat.",
      kind: "screws",
      add: ["RL"],
      from: [0, -200, 0],
      fit: [-1, 1].map((sx) => fit(RAIL_SCREW, spread(Math.ceil(n / 2), 20).map((dy) => [sx * (Wi / 2 - 15), yTopU - 32 + dy, zBack + 12] as Vec3), [sx, 0, 0], { on: "RL", mate: sx < 0 ? "SL" : "SR" })),
      tools: ["screwdriver"],
    });
  }
  if (c.bottomOn) {
    const ups = [-Wi / 2 - T / 2, ...range(nDiv).map((i) => divX(i)), Wi / 2 + T / 2];
    const dw: Vec3[] = ups.flatMap((x) => [zc - Dc / 4, zc + Dc / 4].map((z) => [x, yBotU, z] as Vec3)).slice(0, c.bottomOn.dowels);
    const sc: Vec3[] = ups.map((x) => [x, yB, zc] as Vec3).slice(0, c.bottomOn.screws);
    steps.push({
      title: "Turn it over and tap in the dowels",
      detail: "Lay it on its top on the rug. One dowel goes into each end of the sides and uprights.",
      kind: "dowels",
      pose: "-y",
      fit: [fit(HW.dowel, dw, [0, 1, 0], { on: "TP" })].map((f) => ({ ...f, on: undefined })),
      tools: ["hammer"],
    });
    steps.push({
      title: big ? "Lay the bottom panel on together" : "Lay the bottom panel on",
      detail: "Feet up. Let it drop onto all the dowels, then screw it down with the long screws.",
      kind: "screws",
      add: ["BT"],
      from: [0, -260, 0],
      fit: [fit(LONG_SCREW, sc, [0, 1, 0], { on: "BT" })],
      people: big ? 2 : 1,
      tools: ["allen"],
    });
  }
  if (c.topScrews) {
    const xs = divIds.length ? divIds.map((_, i) => divX(i)) : [0];
    const per = Math.ceil(c.topScrews / xs.length);
    const pts: Vec3[] = xs.flatMap((x) => spread(per, dIn / 3).map((z) => [x, H, zIn + z] as Vec3)).slice(0, c.topScrews);
    steps.push({
      title: "Screw down through the top into the uprights",
      detail: "Long screws, with the Allen key. Keep the uprights straight while you tighten.",
      kind: "screws",
      fit: [fit(LONG_SCREW, pts, [0, -1, 0], { on: "TP", mate: divIds[0] })],
      tools: ["allen"],
    });
  }
  const xw = [-Wi / 2 + 40, Wi / 2 - 40];
  const brackets: St | null =
    c.wall === "drum"
      ? {
          title: "Screw the wall brackets under the top",
          detail: "One in each back corner, pointing at the wall. They let you pull it tight against the wall later.",
          kind: "anchor",
          fit: [fit(DRUM_BRACKET, xw.map((x) => [x, yTopU, behind - 1] as Vec3), [0, 1, 0], { on: "TP", travel: 60 })],
          tools: ["screwdriver"],
        }
      : null;
  if (brackets && !c.bracketsLate) steps.push(brackets);

  // plinth: built on the rug, then pushed onto the bottom of the frame
  if (c.plinth) {
    const pl = c.plinth;
    const r = 20;
    const pw = W - 2 * r, pd = Dc - r;
    const zpf = zc + Dc / 2 - r - T / 2, zpb = zc - Dc / 2 + T / 2;
    const zm = (zpf + zpb) / 2;
    parts.push(box("PF", "Plinth rail, long", [pw, PH, T], [0, PH / 2, zpf]));
    parts.push(box("PB", "Plinth rail, long", [pw, PH, T], [0, PH / 2, zpb]));
    parts.push(box("PL", "Plinth rail, short", [T, PH, pd - 2 * T], [-pw / 2 + T / 2, PH / 2, zm]));
    parts.push(box("PR", "Plinth rail, short", [T, PH, pd - 2 * T], [pw / 2 - T / 2, PH / 2, zm]));
    const xe = pw / 2 - T / 2;
    // corners round-robin, so odd counts land where they can
    const corners: { long: string; short: string; sx: number; z: number; sz: number }[] = [
      { long: "PF", short: "PL", sx: -1, z: zpf, sz: -1 },
      { long: "PF", short: "PR", sx: 1, z: zpf, sz: -1 },
      { long: "PB", short: "PL", sx: -1, z: zpb, sz: 1 },
      { long: "PB", short: "PR", sx: 1, z: zpb, sz: 1 },
    ];
    const atCorners = (n: number, at: (k: (typeof corners)[number], j: number) => Vec3) => {
      const out = new Map<string, Vec3[]>();
      for (let i = 0; i < n; i++) {
        const k = corners[i % 4];
        const id = k.short;
        out.set(id, [...(out.get(id) ?? []), at(k, Math.floor(i / 4))]);
      }
      return out;
    };
    const byHost = (def: HwDef, m: Map<string, Vec3[]>, dir: (id: string) => Vec3) => [...m].map(([id, pts]) => fit(def, pts, dir(id), { on: id }));
    const dowels = atCorners(pl.dowels, (k, j) => [k.sx * xe, PH / 2 - 14 + j * 28, k.z + k.sz * (T / 2)]);
    const bolts = atCorners(pl.bolts, (k, j) => [k.sx * xe, PH / 2 + 14 - j * 28, k.z + k.sz * (T / 2)]);
    const cams = atCorners(pl.cams, (k, j) => [k.sx * (xe + T / 2), PH / 2 + 14 - j * 28, k.z + k.sz * (T / 2 + 30)]);
    const pc: Vec3 = [0, PH / 2, zm];
    const ids = ["PF", "PB", "PL", "PR"];
    steps.push({
      title: "Tap the dowels and cam bolts into the short rails",
      detail: "Lay the four rails out on the rug the way they go together. Screw the cam bolts in by hand.",
      kind: "dowels",
      scene: "plinth",
      pose: "+y",
      stage: ids.map((id) => {
        const p = rel(id, pc);
        return { id, pos: [p[0] * 1.3, p[1], p[2] * 1.35] as Vec3 };
      }),
      fit: [...byHost(HW.dowel, dowels, (id) => [id === "PL" ? -1 : 1, 0, 0].map((v) => -v) as Vec3), ...byHost(HW.camScrew, bolts, (id) => [id === "PL" ? 1 : -1, 0, 0] as Vec3)].map((f) => ({
        ...f,
        dir: [0, 0, 0] as Vec3,
      })).map((f) => ({ ...f, dir: [0, 0, f.at[0][2] > zm ? -1 : 1] as Vec3 })),
      tools: ["hammer", "screwdriver"],
      warnings: ["floor"],
    });
    steps.push({
      title: "Push the rails together and lock the cams",
      detail: "Arrow towards the bolt, then turn each cam lock clockwise until the corner pulls tight.",
      kind: "cams",
      scene: "plinth",
      stage: ids.map((id) => ({ id, pos: rel(id, pc) })),
      fit: [...cams].map(([id, pts]) => fit(HW.cam, pts.map((p) => [p[0], p[1], p[2]] as Vec3), [id === "PL" ? 1 : -1, 0, 0], { on: id === "PL" ? "PF" : "PB" })).map((f) => ({ ...f, on: undefined })),
      tools: ["screwdriver"],
    });
    steps.push({
      title: big ? "Push the plinth onto the bottom together" : "Push the plinth onto the bottom",
      detail: "With the frame still on its front, set the plinth against the bottom panel, back edges in line.",
      kind: "join",
      pose: "-z",
      scene: "main",
      add: ids,
      from: [0, -240, 0],
      people: big ? 2 : 1,
    });
    const cp = corners.slice(0, pl.plates).map((k) => [k.sx * (pw / 2 - T - 22), PH, k.z + k.sz * (T / 2 + 30)] as Vec3);
    steps.push({
      title: `Fix the plinth with the ${pl.plates} angle plates`,
      detail: "One in each inside corner: two screws into the plinth, then two up into the bottom panel.",
      kind: "screws",
      fit: [
        fit(PLATE, cp, [0, 1, 0], { on: "BT", hole: false }),
        fit(PLATE_SCREW, cp.flatMap((p) => [-10, 10].map((dz) => [p[0] + Math.sign(p[0]) * 20, p[1] - 22, p[2] + dz] as Vec3)), [1, 0, 0]),
        fit(PLATE_SCREW, cp.flatMap((p) => [-10, 10].map((dz) => [p[0] - Math.sign(p[0]) * 6, p[1], p[2] + dz] as Vec3)), [0, 1, 0], { on: "BT" }),
      ].map((f, k) => (k === 1 ? { ...f, at: f.at, dir: [1, 0, 0] as Vec3 } : f)),
      tools: ["screwdriver"],
    });
    const feet: Vec3[] =
      pl.feet === 4
        ? [-1, 1].flatMap((sx) => [zpf, zpb].map((z) => [sx * (pw / 2 - 40), 0, z] as Vec3))
        : [...spread(pl.feet, pw / 2 - 40).map((x) => [x, 0, zpf] as Vec3)];
    steps.push({
      title: `Screw in the ${pl.feet} feet`,
      detail: pl.glides ? "Into the front rail of the plinth, by hand. The glides press into the back rail." : "Into the holes under the plinth, by hand.",
      kind: "legs",
      fit: [
        fit(FOOT, feet, [0, 1, 0], { on: "PF" }),
        ...(pl.glides ? [fit(GLIDE_BAR, spread(pl.glides, pw / 2 - 60).map((x) => [x, 0, zpb] as Vec3), [0, 1, 0], { on: "PB", hole: false })] : []),
      ],
    });
  }
  if (brackets && c.bracketsLate) steps.push(brackets);

  steps.push({
    title: big ? "Stand it up together" : "Stand it up",
    detail: "Lift it upright, don't pull it up by one corner. Then turn the feet with the spanner until it stands level.",
    kind: "standup",
    pose: "+y",
    people: big ? 2 : 1,
    tools: ["wrench", "level"],
  });

  // wall
  if (c.wall === "drum")
    steps.push({
      title: "Fix it to the wall",
      detail: "Mark through the brackets, drill, and screw it on with the washers. Turn the drums to pull it tight. Wall screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      wall: true,
      fit: [fit(WALL_PLUG, xw.map((x) => [x, yTopU - 25, zc - Dc / 2] as Vec3), [0, 0, -1]), fit(WALL_SCREW, xw.map((x) => [x, yTopU - 25, zc - Dc / 2 + 30] as Vec3), [0, 0, -1])],
      tools: ["drill", "screwdriver", "pencil"],
      warnings: ["wall", "tip"],
    });
  else
    steps.push({
      title: "Fix it to the wall",
      detail: "Screw the two angle brackets under the top, mark the wall through them, then screw them on. Wall screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      wall: true,
      fit: [
        fit(WALL_ANGLE, xw.map((x) => [x, yTopU, zc - Dc / 2 + 30] as Vec3), [0, 1, 0], { on: "TP", travel: 60 }),
        fit(SMALL_SCREW, xw.flatMap((x) => [x - 10, x + 10].map((xx) => [xx, yTopU, zc - Dc / 2 + 60] as Vec3)), [0, 1, 0], { on: "TP" }),
        fit(WALL_PLUG, xw.map((x) => [x, yTopU - 30, zc - Dc / 2] as Vec3), [0, 0, -1]),
        fit(WALL_SCREW, xw.map((x) => [x, yTopU - 30, zc - Dc / 2 + 4] as Vec3), [0, 0, -1]),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      warnings: ["wall", "tip"],
    });

  // loose shelves on pins
  if (c.shelves) {
    const levels = [yBotU, ...(c.fixed ?? []).map((y) => y), c.drawers?.at === "top" ? yDrawerShelf : yTopU];
    const bands: [number, number][] = [];
    for (let i = 0; i + 1 < levels.length; i++) bands.push([levels[i] + (i ? T / 2 : 0), levels[i + 1] - (i + 1 < levels.length - 1 || c.drawers ? T / 2 : 0)]);
    const perCol = Math.ceil(c.shelves / cols);
    const perBand = Math.ceil(perCol / bands.length);
    const ys: number[] = [];
    for (const [lo, hi] of bands) for (let k = 1; k <= perBand; k++) ys.push(lo + ((hi - lo) * k) / (perBand + 1));
    const ids: string[] = [];
    const pins = new Map<string, Vec3[]>();
    const push = (id: string, p: Vec3) => pins.set(id, [...(pins.get(id) ?? []), p]);
    let n = 0;
    for (let ci = 0; ci < cols; ci++)
      for (const y of ys.slice(0, perCol)) {
        if (n >= c.shelves) break;
        parts.push(box(`SH${n}`, "Shelf", [cw - 2, T, dIn - 6], [colX(ci), y + T / 2, zIn]));
        ids.push(`SH${n}`);
        for (const sx of [-1, 1]) {
          const host = sx < 0 ? (ci === 0 ? "SL" : divIds[ci - 1]) : ci === cols - 1 ? "SR" : divIds[ci];
          for (const z of [zIn - dIn / 2 + 50, zIn + dIn / 2 - 50]) push(host, [colX(ci) + (sx * cw) / 2, y, z]);
        }
        n++;
      }
    const total = [...pins.values()].reduce((s, l) => s + l.length, 0);
    steps.push({
      title: `Push in the ${total} shelf pins`,
      detail: "Four at the same height for each shelf. Pick the holes for the heights you want.",
      kind: "shelves",
      fit: [...pins].map(([id, pts]) => fit(HW.pin, pts, [pts[0][0] < parts.find((p) => p.id === id)!.pos[0] ? 1 : -1, 0, 0], { on: id, hole: false })),
    });
    steps.push({ title: ids.length > 1 ? "Lay the shelves on the pins" : "Lay the shelf on the pins", detail: "Tilt each one in, then lower it flat onto all four pins.", kind: "shelves", add: ids, from: [0, 0, 380] });
  }

  run(b, parts, steps);
  if (c.doors?.kind === "sliding") slidingDoors(b, c, g);
  if (c.doors?.kind === "hinged") hingedDoors(b, c, g, dws.length ? yDrawerShelf - T / 2 : H);
  if (dws.length) drawerSteps(b, g, dws);
}

/* ---------- sliding doors: tracks in the top and bottom, rollers under each door, guides on top ---------- */

function slidingDoors(b: PlanBuilder, c: CaseCfg, g: Geo) {
  const { Wi, yBotU, yTopU, zFront } = g;
  const n = c.doors!.n;
  const zs = [zFront - 14, zFront - 36]; // front track, back track
  const dh = yTopU - yBotU - 16;
  const dw = Wi / n + 20;
  const parts: Part[] = [];
  for (const [i, z] of zs.entries()) {
    parts.push(box(`TT${i}`, "Door track", [Wi, 6, 18], [0, yTopU - 3, z], "metal"));
    parts.push(box(`TB${i}`, "Door track", [Wi, 6, 18], [0, yBotU + 3, z], "metal"));
  }
  const doors = range(n).map((i) => {
    const x = -Wi / 2 + dw / 2 + (i * (Wi - dw)) / Math.max(1, n - 1);
    const z = zs[i % 2 ? 0 : 1];
    const id = `DR${i}`;
    const pos: Vec3 = [x, yBotU + 8 + dh / 2, z];
    if (c.doors!.glass) {
      const f = 45;
      parts.push({
        id,
        name: "Glass door",
        size: [dw, dh, 18],
        pos,
        pieces: [
          { shape: "box", size: [f, dh, 18], pos: [-dw / 2 + f / 2, 0, 0] },
          { shape: "box", size: [f, dh, 18], pos: [dw / 2 - f / 2, 0, 0] },
          { shape: "box", size: [dw - 2 * f, f, 18], pos: [0, dh / 2 - f / 2, 0] },
          { shape: "box", size: [dw - 2 * f, f, 18], pos: [0, -dh / 2 + f / 2, 0] },
          { shape: "box", size: [dw - 2 * f, dh - 2 * f, 4], pos: [0, 0, 0], material: "fiber" },
        ],
      });
    } else parts.push(box(id, "Sliding door", [dw, dh, 18], pos));
    return { id, x, z, sx: i === 0 ? -1 : 1 };
  });
  const yb = yBotU + 8, yt = yBotU + 8 + dh;
  const HANDLE: HwDef = { kind: "handle", len: 120, dia: 26 };
  const kit = (d: (typeof doors)[number]): Fit[] => [
    fit(ROLLER, [-1, 1].map((sx) => [d.x + sx * (dw / 2 - 50), yb, d.z] as Vec3), [0, 1, 0], { on: d.id, hole: false }),
    fit(GUIDE, [-1, 1].map((sx) => [d.x + sx * (dw / 2 - 50), yt, d.z] as Vec3), [0, -1, 0], { on: d.id, hole: false }),
    ...(c.doors!.handles ? [fit(HANDLE, [[d.x + d.sx * (dw / 2 - 40), yb + dh / 2, d.z + 9] as Vec3], [0, 0, -1], { on: d.id, twist: Math.PI / 2 })] : []),
  ];
  const order = [...doors].reverse(); // the back door goes in first
  const steps: St[] = [
    {
      title: "Fit the door tracks",
      detail: "Slide the end stops onto each track, then press the tracks into the grooves under the top and on the bottom, starting at one end. Screw them down.",
      kind: "screws",
      scene: "main",
      pose: "+y",
      add: ["TT0", "TT1", "TB0", "TB1"],
      from: [0, 0, 300],
      fit: [
        fit(SMALL_SCREW, zs.flatMap((z) => [-Wi / 2 + 60, Wi / 2 - 60].map((x) => [x, yBotU + 6, z] as Vec3)), [0, -1, 0], { on: "TB0" }),
        fit(SMALL_SCREW, zs.flatMap((z) => [-Wi / 2 + 60, Wi / 2 - 60].map((x) => [x, yTopU - 6, z] as Vec3)), [0, 1, 0], { on: "TT0" }),
      ],
      tools: ["screwdriver"],
    },
    ...(c.stops
      ? [
          {
            title: "Press in the door stops",
            detail: "Under the top at each end, so the doors stop softly.",
            kind: "general",
            fit: [fit(DOOR_STOP, [-1, 1].map((sx) => [sx * (Wi / 2 - 12), yTopU, zFront - 4] as Vec3), [0, 1, 0], { hole: false })],
          } satisfies St,
        ]
      : []),
    {
      title: n > 1 ? "Fit the rollers and guides to the doors" : "Fit the rollers and guides to the door",
      detail: c.doors!.handles
        ? "Lay the doors on the rug. A roller clicks into each bottom corner and a guide into each top corner; press the handle into its hole near the outer edge."
        : "Lay the doors on the rug. A roller clicks into each bottom corner and a guide into each top corner. The rollers are marked: mind which way up.",
      kind: "doors",
      scene: "doors",
      pose: "+z",
      stage: doors.map((d, i) => ({ id: d.id, pos: [(i - (n - 1) / 2) * (dw + 80), 0, 0] as Vec3, rot: [0, 0, 0] as Vec3 })),
      fit: kit(order[0]),
      repeat: n > 1 ? n : undefined,
      warnings: ["floor", "face"],
    },
    ...order.map(
      (d, i): St => ({
        title: n === 1 ? "Hang the door" : i === 0 ? "Hang the back door" : "Hang the front door",
        detail: "Tip the top into its track first, then lower the bottom onto the track and push the rollers up until they click.",
        kind: "doors",
        pose: "+y",
        scene: "main",
        add: [d.id],
        from: [0, 0, 340],
        preset: i === 0 ? [] : kit(d),
      }),
    ),
    {
      title: "Adjust the doors",
      detail: "Turn the dial on each roller until the gaps along the edges are even and the doors meet straight.",
      kind: "doors",
      tools: ["screwdriver"],
    },
  ];
  run(b, parts, steps);
}

/* ---------- hinged doors ---------- */

function hingedDoors(b: PlanBuilder, c: CaseCfg, g: Geo, yTop: number) {
  const n = c.doors!.n;
  const { W } = c;
  const y0 = g.ySide + 3, y1 = yTop - 3;
  const dh = y1 - y0;
  const dw = (W - (n + 1) * 3) / n;
  const z = g.zFront + T / 2;
  const parts: Part[] = range(n).map((i) => box(`DR${i}`, "Door", [dw, dh, T], [-W / 2 + 3 + dw / 2 + i * (dw + 3), (y0 + y1) / 2, z]));
  const hy = [y1 - 90, y0 + 90];
  const hinge = (i: number) => {
    const p = parts[i].pos;
    const sx = i < n / 2 ? -1 : 1; // hinges on the outer edge
    return hy.map((y) => [p[0] + sx * (dw / 2 - 22), y, z - T / 2] as Vec3);
  };
  const steps: St[] = [
    {
      title: n > 1 ? "Screw the hinges onto the doors" : "Screw the hinges onto the door",
      detail: "Lay the doors face down on the rug. Each hinge cup drops into its round hole; two screws hold it.",
      kind: "hinges",
      scene: "doors",
      pose: "-z",
      stage: parts.map((p, i) => ({ id: p.id, pos: [(i - (n - 1) / 2) * (dw + 80), 0, 0] as Vec3, rot: [0, 0, 0] as Vec3 })),
      fit: range(n).map((i) => fit(HW.hinge, hinge(i), [0, 0, 1], { on: `DR${i}`, twist: i < n / 2 ? 0 : Math.PI })),
      tools: ["screwdriver"],
      warnings: ["floor", "face"],
    },
    {
      title: n > 1 ? "Hang the doors" : "Hang the door",
      detail: "Hold each door against the cabinet, hook the hinges onto the plates inside and tighten the screws.",
      kind: "doors",
      scene: "main",
      pose: "+y",
      add: parts.map((p) => p.id),
      from: [0, 0, 340],
      tools: ["screwdriver"],
    },
    {
      title: "Line up the doors",
      detail: "Turn the screws on the hinges until the gaps are even and the doors close flush.",
      kind: "doors",
      tools: ["screwdriver"],
    },
  ];
  run(b, parts, steps);
}

/* ---------- drawers: the sides click into the front, the bottom slides in, the back is cam-locked ---------- */

function drawerSteps(b: PlanBuilder, g: Geo, dws: Dw[]) {
  const all = g.c.drawers!.at === "all";
  const dd = g.Dc - 50;
  const zf = all ? g.zFront + T / 2 : g.zFront - T / 2 - 2; // front centre
  const zb = zf - T / 2 - dd; // back of the box
  const parts: Part[] = [];
  for (const d of dws) {
    const zm = zf - T / 2 - dd / 2;
    parts.push(box(`F${d.i}`, "Drawer front", [d.fw, d.fh, T], [d.fx, d.fy + d.fh / 2, zf]));
    parts.push(box(`L${d.i}`, "Drawer side", [14, d.sideH, dd], [d.bx - d.bw / 2 + 7, d.by + d.sideH / 2, zm]));
    parts.push(box(`R${d.i}`, "Drawer side", [14, d.sideH, dd], [d.bx + d.bw / 2 - 7, d.by + d.sideH / 2, zm]));
    parts.push(box(`B${d.i}`, "Drawer bottom", [d.bw - 16, 3, dd - 16], [d.bx, d.by + 10, zm - 6], "fiber"));
    parts.push(box(`K${d.i}`, "Drawer back", [d.bw - 28, d.sideH - 16, 14], [d.bx, d.by + 16 + (d.sideH - 16) / 2, zb + 7]));
  }
  const bolts = (d: Dw, sx: number): Vec3[] => [d.by + 40, d.by + d.sideH - 30].map((y) => [d.bx + sx * (d.bw / 2 - 14), y, zb + 7] as Vec3);
  const cams = (d: Dw): Vec3[] => [-1, 1].flatMap((sx) => [d.by + 40, d.by + d.sideH - 30].map((y) => [d.bx + sx * (d.bw / 2 - 34), y, zb] as Vec3));
  const boltFits = (d: Dw, preset = false) => [
    fit(HW.camScrew, bolts(d, -1), [1, 0, 0], { on: `L${d.i}`, mate: `K${d.i}`, ...(preset ? { hole: false as const } : {}) }),
    fit(HW.camScrew, bolts(d, 1), [-1, 0, 0], { on: `R${d.i}`, mate: `K${d.i}`, ...(preset ? { hole: false as const } : {}) }),
  ];
  const d0 = dws[0];
  const c0: Vec3 = [d0.bx, d0.by, zf - dd / 2];
  const rel = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!;
    return [p.pos[0] - c0[0], p.pos[1] - c0[1], p.pos[2] - c0[2]];
  };
  const n = dws.length;
  const rep = n > 1 ? n : undefined;
  const steps: St[] = [
    {
      title: "Click the drawer sides onto the front",
      detail: "Lay the front face down on the rug. Hook each side into its slots and press down until it clicks.",
      kind: "drawer",
      scene: "drawer",
      pose: "-z",
      stage: ["F0", "L0", "R0"].map((id) => ({ id, pos: rel(id) })),
      repeat: rep,
      warnings: ["floor", "face"],
    },
    { title: "Slide in the drawer bottom", detail: "It runs down the grooves in the sides until it reaches the front.", kind: "drawer", scene: "drawer", stage: [{ id: "B0", pos: rel("B0"), from: [0, 0, -400] }], repeat: rep },
    { title: "Screw the cam bolts into the sides", detail: "Two at the back end of each side, by hand.", kind: "cams", scene: "drawer", fit: boltFits(d0), tools: ["screwdriver"], repeat: rep },
    {
      title: "Put the back on and lock the cams",
      detail: "Its lower edge sits over the drawer bottom. Turn the four cam locks clockwise.",
      kind: "cams",
      scene: "drawer",
      stage: [{ id: "K0", pos: rel("K0"), from: [0, 0, -260] }],
      fit: [fit(HW.cam, cams(d0), [0, 0, 1], { on: "K0" })],
      tools: ["screwdriver"],
      repeat: rep,
    },
    {
      title: n > 2 ? `Put in all ${n} drawers` : n === 2 ? "Put in both drawers" : "Put in the drawer",
      detail: "Pull the runners out, set the drawer on them and push it in until it clicks. Only open one drawer at a time.",
      kind: "drawer",
      scene: "main",
      pose: "+y",
      add: dws.flatMap((d) => [`F${d.i}`, `L${d.i}`, `R${d.i}`, `B${d.i}`, `K${d.i}`]),
      from: [0, 0, 460],
      preset: dws.slice(1).flatMap((d) => [...boltFits(d, true), fit(HW.cam, cams(d), [0, 0, 1], { on: `K${d.i}`, hole: false })]),
      warnings: ["tip"],
    },
  ];
  run(b, parts, steps);
}

/* ---------- dining tables and desks: an apron frame on four corner brackets, the top screwed on, legs bolted into the brackets ---------- */

const BRACKET: HwDef = { kind: "angle", len: 100, dia: 60 };
const BRACKET_BOLT: HwDef = { kind: "bolt", len: 16, dia: 6 };
const HANGER: HwDef = { kind: "legScrew", len: 80, dia: 8 };
const BARREL: HwDef = { kind: "nut", len: 30, dia: 10 };
const NUT: HwDef = { kind: "nut", len: 6, dia: 10 };
const TOP_SCREW: HwDef = { kind: "screw", len: 45, dia: 5 };
const LEG_GLIDE: HwDef = { kind: "glide", len: 6, dia: 24 };
const TABLE_LOCK: HwDef = { kind: "clip", len: 30, dia: 24 };
const LEG_SCREW: HwDef = { kind: "screw", len: 40, dia: 5 };

interface TableCfg {
  W: number;
  D: number;
  H: number;
  dowels: number;
  screws: number;
  midRail?: boolean;
  leaf?: number; // extendable: width of the loose leaf
  drawer?: number; // desks: width of the drawer in the front rail
}

function tableBuild(b: PlanBuilder, c: TableCfg) {
  const { W, D, H } = c;
  const t = 22, ah = 80, at = 20, e = 35, ld = 45;
  const yU = H - t, ya = yU - ah / 2;
  const lx = W / 2 - e - ld / 2, lz = D / 2 - e - ld / 2;
  const xr = W / 2 - e - at / 2, zr = D / 2 - e - at / 2;
  const longL = 2 * lx - ld, shortL = 2 * lz - ld;
  const parts: Part[] = [];
  const steps: St[] = [];
  const ext = !!c.leaf;
  if (ext) {
    parts.push(box("T0", "Table top half", [W / 2, t, D], [-W / 4, H - t / 2, 0]));
    parts.push(box("T1", "Table top half", [W / 2, t, D], [W / 4, H - t / 2, 0]));
  } else parts.push(box("T0", "Table top", [W, t, D], [0, H - t / 2, 0]));
  const rails: string[] = [];
  const rail = (id: string, name: string, size: Vec3, pos: Vec3) => {
    parts.push(box(id, name, size, pos));
    rails.push(id);
  };
  const dw = c.drawer ?? 0;
  for (const sz of [-1, 1]) {
    if (ext) for (const sx of [-1, 1]) rail(`R${sz}${sx}`, "Long rail, half", [longL / 2, ah, at], [(sx * longL) / 4, ya, sz * zr]);
    else if (dw && sz > 0) for (const sx of [-1, 1]) rail(`RF${sx}`, "Front rail", [(longL - dw) / 2, ah, at], [(sx * (longL + dw)) / 4, ya, zr]);
    else rail(`RL${sz}`, "Long rail", [longL, ah, at], [0, ya, sz * zr]);
  }
  for (const sx of [-1, 1]) rail(`RS${sx}`, "Short rail", [at, ah, shortL], [sx * xr, ya, 0]);
  if (c.midRail) rail("RM", "Middle rail", [at, ah, 2 * (zr - at / 2)], [0, ya, 0]);
  const slides: string[] = [];
  if (ext) {
    for (const sz of [-1, 1]) {
      parts.push(box(`SL${sz}`, "Extension slide", [longL - 40, 40, 40], [0, yU - 20, sz * (zr - at / 2 - 60)], "wood"));
      slides.push(`SL${sz}`);
    }
    for (const sx of [-1, 1]) {
      parts.push(box(`CB${sx}`, "Cross bar", [60, 22, 2 * (zr - at / 2)], [sx * (longL / 2 - 140), yU - 11 - 40, 0], "wood"));
      slides.push(`CB${sx}`);
    }
    parts.push(box("LF", "Leaf", [c.leaf!, t, D - 2 * e - 2 * at - 20], [0, yU - 40 - 22 - t / 2 - 2, 0]));
  }
  const dsup: string[] = [];
  if (dw) {
    for (const sx of [-1, 1]) {
      parts.push(box(`DS${sx}`, "Drawer support", [18, ah, 2 * zr - at - 60], [sx * (dw / 2 + 9), ya, -30 + at / 2]));
      dsup.push(`DS${sx}`);
    }
  }
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ id: `LG${sx}${sz}`, sx, sz })));
  for (const l of legs) parts.push({ id: l.id, name: "Leg", size: [ld, yU, ld], pos: [l.sx * lx, yU / 2, l.sz * lz], cyl: true, mat: "wood" });

  // the frame, upside down on the rug as the manual builds it
  const corner = (l: (typeof legs)[number]): Vec3 => [l.sx * (lx - ld / 2 - 30), ya, l.sz * (lz - ld / 2 - 30)];
  const frameIds = [...rails, ...slides, ...dsup];
  const fc: Vec3 = [0, ya, 0];
  const relOf = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!;
    return [p.pos[0] - fc[0], fc[1] - p.pos[1], p.pos[2] - fc[2]];
  };
  const shortHost = (sx: number) => `RS${sx}`;
  const longHost = (sx: number, sz: number) => (ext ? `R${sz}${sx}` : dw && sz > 0 ? `RF${sx}` : `RL${sz}`);
  if (ext) {
    steps.push({
      title: "Tap the dowels into the cross bars and slides",
      detail: "Lay the slides and cross bars on the rug as they go together and push them onto the dowels.",
      kind: "dowels",
      scene: "frame",
      pose: "+y",
      stage: slides.map((id) => ({ id, pos: relOf(id), rot: [0, 0, 0] })),
      fit: slides.filter((s) => s.startsWith("CB")).map((id) => {
        const x = parts.find((p) => p.id === id)!.pos[0];
        return fit(HW.dowel, [-1, 1].flatMap((sz) => [-1, 0, 1].map((k) => [x + k * 18, yU - 40, sz * (zr - at / 2 - 60)] as Vec3)), [0, 1, 0], { on: id });
      }),
      tools: ["hammer"],
      warnings: ["floor"],
    });
    steps.push({
      title: "Screw the cam bolts into the slides",
      detail: "One at each end of both slides, by hand.",
      kind: "cams",
      scene: "frame",
      fit: [-1, 1].map((sz) => fit(HW.camScrew, [-1, 1].map((sx) => [(sx * (longL - 40)) / 2, yU - 20, sz * (zr - at / 2 - 60)] as Vec3), [0, 1, 0], { on: `SL${sz}` })),
      tools: ["screwdriver"],
    });
  }
  steps.push({
    title: ext ? "Join the slides to the rails" : c.midRail ? "Tap the dowels into the rails" : "Bolt the corner brackets to the short rails",
    detail: ext
      ? "Push each rail half onto the ends of the slides and turn the cam locks clockwise."
      : c.midRail
        ? "Two dowels into each end of the middle rail and the matching holes in the long rails."
        : "Lay the rails on the rug. Each bracket takes two bolts and inserts into the end of its rail.",
    kind: ext ? "cams" : c.midRail ? "dowels" : "bolts",
    scene: "frame",
    pose: "+y",
    stage: frameIds.map((id) => ({ id, pos: relOf(id), rot: [0, 0, 0] })),
    fit: ext
      ? [-1, 1].map((sz) => fit(HW.cam, [-1, 1].map((sx) => [(sx * (longL - 40)) / 2 - sx * 30, yU - 20, sz * (zr - at / 2 - 40)] as Vec3), [0, 1, 0], { on: `SL${sz}` }))
      : c.midRail
        ? [fit(HW.dowel, [-1, 1].flatMap((sz) => [-15, 15].map((dy) => [0, ya + dy, sz * (zr - at / 2)] as Vec3)), [0, 0, 1], { on: "RM" })]
        : [-1, 1].map((sx) => fit(BRACKET_BOLT, [-1, 1].flatMap((sz) => [-14, 14].map((dy) => [sx * (xr - at / 2), ya + dy, sz * (lz - ld / 2 - 40)] as Vec3)), [sx, 0, 0], { on: shortHost(sx) })),
    tools: ext ? ["screwdriver"] : c.midRail ? ["hammer"] : ["screwdriver"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Bolt the corner brackets into the frame",
    detail: "One bracket in each corner, its bolts and inserts into the long rails. Leave them a little loose until all four are in.",
    kind: "bolts",
    scene: "frame",
    pre: legs.map((l) => fit(BRACKET, [corner(l)], [-l.sx * Math.SQRT1_2, 0, -l.sz * Math.SQRT1_2], { hole: false, on: shortHost(l.sx) })),
    fit: [
      ...legs.map((l) => fit(BRACKET_BOLT, [-14, 14].map((dy) => [l.sx * (lx - ld / 2 - 40), ya + dy, l.sz * (zr - at / 2)] as Vec3), [0, 0, l.sz], { on: longHost(l.sx, l.sz) })),
      ...(c.midRail ? [-1, 1].map((sx) => fit(BRACKET_BOLT, [-1, 1].flatMap((sz) => [-14, 14].map((dy) => [sx * (xr - at / 2), ya + dy, sz * (lz - ld / 2 - 40)] as Vec3)), [sx, 0, 0], { on: shortHost(sx) })) : []),
    ],
    tools: ["screwdriver"],
  });
  const dowelPts: Vec3[] = [];
  const dowelHost: string[] = [];
  const along = (id: string, n: number) => {
    const p = parts.find((q) => q.id === id)!;
    const longX = p.size[0] > p.size[2];
    const L = longX ? p.size[0] : p.size[2];
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + 60 + ((L - 120) * (n === 1 ? 0.5 : k / (n - 1)));
      dowelPts.push(longX ? [p.pos[0] + u, yU, p.pos[2]] : [p.pos[0], yU, p.pos[2] + u]);
      dowelHost.push(id);
    }
  };
  const nDowels = ext ? Math.min(c.dowels, 10) : c.dowels;
  const longs = rails.filter((r) => !r.startsWith("RS") && r !== "RM");
  const perLong = Math.ceil(nDowels / (longs.length + 2));
  for (const r of longs) along(r, perLong);
  for (const r of ["RS-1", "RS1"]) along(r, Math.max(1, Math.floor((nDowels - perLong * longs.length) / 2)));
  steps.push({
    title: "Tap the dowels into the top edge of the frame",
    detail: "Into the holes along the rails. They line the frame up with the top.",
    kind: "dowels",
    scene: "frame",
    fit: [...new Set(dowelHost.slice(0, nDowels))].map((id) => fit(HW.dowel, dowelPts.slice(0, nDowels).filter((_, k) => dowelHost[k] === id), [0, -1, 0], { on: id })),
    tools: ["hammer"],
  });
  steps.push({
    title: ext ? "Lay the two top halves face down" : "Lay the top face down on the rug",
    detail: ext ? "Side by side, the joint between them in the middle. Clip the table locks onto the underside, two across the joint." : "On a rug or the box, so the top doesn't get scratched.",
    kind: "general",
    scene: "main",
    pose: "-y",
    add: ext ? ["T0", "T1"] : ["T0"],
    from: [0, 200, 0],
    fit: ext ? [fit(TABLE_LOCK, [-1, 1].map((sz) => [0, yU, sz * (D / 2 - 80)] as Vec3), [0, 1, 0], { on: "T0", hole: false })] : [],
    warnings: ["floor", "face"],
  });
  steps.push({
    title: "Set the frame on the top",
    detail: "Let the dowels drop into their holes.",
    kind: "join",
    add: frameIds,
    from: [0, -220, 0],
    people: W > 1300 ? 2 : 1,
  });
  // screws up through the rails into the top
  const screwPts: Vec3[] = [];
  const screwHost: string[] = [];
  const nS = c.screws;
  const ids = [...longs, "RS-1", "RS1", ...(c.midRail ? ["RM"] : []), ...dsup];
  const per = Math.ceil(nS / ids.length);
  for (const id of ids) {
    const p = parts.find((q) => q.id === id)!;
    const longX = p.size[0] > p.size[2];
    const L = longX ? p.size[0] : p.size[2];
    for (let k = 0; k < per; k++) {
      const u = -L / 2 + 40 + ((L - 80) * (per === 1 ? 0.5 : k / (per - 1)));
      const off = (longX ? p.pos[2] : p.pos[0]) > 0 ? -at / 2 - 4 : at / 2 + 4;
      screwPts.push(longX ? [p.pos[0] + u, yU - 30, p.pos[2] + (id.startsWith("DS") ? 0 : off)] : [p.pos[0] + (id.startsWith("DS") ? 0 : off), yU - 30, p.pos[2] + u]);
      screwHost.push(id);
    }
  }
  steps.push({
    title: `Screw the frame to the top with ${nS} screws`,
    detail: "Through the angled holes inside the rails. Snug, not so hard that they come through.",
    kind: "screws",
    fit: [...new Set(screwHost.slice(0, nS))].map((id) => fit(TOP_SCREW, screwPts.slice(0, nS).filter((_, k) => screwHost[k] === id), [0, 1, 0], { on: id, mate: ext && parts.find((q) => q.id === id)!.pos[0] > 0 ? "T1" : "T0" })),
    tools: ["screwdriver"],
  });
  if (ext)
    steps.push({
      title: "Put the leaf in its place",
      detail: "Tap the two pins into its edge and lay it in the frame under the top, where it waits until you pull the table out.",
      kind: "join",
      add: ["LF"],
      from: [0, -200, 0],
      fit: [fit(HW.dowel, [-1, 1].map((sz) => [c.leaf! / 2, yU - 40 - 22 - t / 2 - 2, sz * (D / 4)] as Vec3), [1, 0, 0], { on: "LF" })],
      tools: ["hammer"],
    });

  // legs: barrel nuts and hanger bolts first, then onto the brackets
  const hang = (l: (typeof legs)[number]): Vec3[] => [ya - 14, ya + 14].map((y) => [l.sx * (lx - ld / 2), y, l.sz * (lz - ld / 2)] as Vec3);
  steps.push({
    title: "Fit the barrel nuts and hanger bolts into the legs",
    detail: "Barrel nut into the side hole, slot lined up. Then turn two hanger bolts in with the tool until they stop.",
    kind: "legs",
    scene: "legs",
    pose: "+y",
    stage: legs.map((l, i) => ({ id: l.id, pos: [0, 0, (i - 1.5) * 140], rot: [0, 0, Math.PI / 2] })),
    fit: [
      fit(BARREL, legs.slice(0, 1).map((l) => [l.sx * lx, yU - 60, l.sz * lz + ld / 2] as Vec3), [0, 0, -1], { on: legs[0].id }),
      fit(HANGER, hang(legs[0]), [l0dir(legs[0])[0], 0, l0dir(legs[0])[2]], { on: legs[0].id }),
    ],
    repeat: 4,
  });
  steps.push({
    title: "Bolt the legs to the brackets",
    detail: "Push each leg's bolts through its bracket, then a washer and nut on each. Tighten with the tool.",
    kind: "legs",
    scene: "main",
    pose: "-y",
    add: legs.map((l) => l.id),
    from: [0, -300, 0],
    preset: legs.slice(1).flatMap((l) => [fit(BARREL, [[l.sx * lx, yU - 60, l.sz * lz + ld / 2] as Vec3], [0, 0, -1], { on: l.id, hole: false }), fit(HANGER, hang(l), l0dir(l), { on: l.id, hole: false })]),
    fit: legs.flatMap((l) => {
      const out = l0dir(l).map((v) => -v) as Vec3;
      return [fit(HW.washer, hang(l).map((p) => [p[0] - l.sx * 40, p[1], p[2] - l.sz * 40] as Vec3), out), fit(NUT, hang(l).map((p) => [p[0] - l.sx * 42, p[1], p[2] - l.sz * 42] as Vec3), out)];
    }),
    tools: ["wrench"],
  });
  steps.push({
    title: "Tap the glides into the legs",
    detail: "One into the end of each leg, gently with a hammer.",
    kind: "legs",
    fit: [fit(LEG_GLIDE, legs.map((l) => [l.sx * lx, 0, l.sz * lz] as Vec3), [0, 1, 0], { hole: false })],
    tools: ["hammer"],
  });
  steps.push({
    title: W > 1000 ? "Turn it over together" : "Turn it over",
    detail: ext ? "Lift it, don't roll it over on two legs. To make it longer, open the locks, pull the halves apart and drop the leaf in between." : "Lift it, don't roll it over on two legs.",
    kind: "standup",
    pose: "+y",
    people: W > 1000 ? 2 : 1,
  });
  run(b, parts, steps);
  if (dw) deskDrawer(b, { W, D, dw, yU, ah, zr, at });
}

function l0dir(l: { sx: number; sz: number }): Vec3 {
  return [-l.sx * Math.SQRT1_2, 0, -l.sz * Math.SQRT1_2];
}

/** The desk's drawer: runners on the two supports, the box built on its front, slid in. */
function deskDrawer(b: PlanBuilder, g: { W: number; D: number; dw: number; yU: number; ah: number; zr: number; at: number }) {
  const { dw, yU, ah, zr, at } = g;
  const fh = ah - 6, sh = ah - 26, dd = 2 * zr - at - 80;
  const zf = zr; // the front sits in the rail line
  const y0 = yU - ah + 3;
  const bw = dw - 30;
  const zm = zf - at / 2 - dd / 2;
  const parts: Part[] = [
    box("F", "Drawer front", [dw - 6, fh, at], [0, y0 + fh / 2, zf]),
    box("L", "Drawer side", [12, sh, dd], [-bw / 2 + 6, y0 + 8 + sh / 2, zm]),
    box("R", "Drawer side", [12, sh, dd], [bw / 2 - 6, y0 + 8 + sh / 2, zm]),
    box("B", "Drawer bottom", [bw - 12, 3, dd - 12], [0, y0 + 12, zm - 6], "fiber"),
    box("K", "Drawer back", [bw - 24, sh - 12, 12], [0, y0 + 14 + (sh - 12) / 2, zf - at / 2 - dd + 6]),
  ];
  const c0: Vec3 = [0, y0, zm];
  const rel = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!;
    return [p.pos[0] - c0[0], p.pos[1] - c0[1], p.pos[2] - c0[2]];
  };
  const runner: HwDef = { kind: "runner", len: Math.round(dd - 20), dia: 40 };
  const zb = zf - at / 2 - dd;
  const steps: St[] = [
    {
      title: "Screw the runners to the drawer supports",
      detail: "Inside faces of the two supports, two screws each.",
      kind: "runners",
      scene: "main",
      pose: "-y",
      fit: [fit(runner, [-1, 1].map((sx) => [sx * (dw / 2), y0 + 4, zm] as Vec3), [0, 1, 0], { hole: false }), ...[-1, 1].map((sx) => fit(RUNNER_SCREW, [zm - dd / 3, Math.min(zm + dd / 3, zr - 75)].map((z) => [sx * (dw / 2 - 4), y0 + 14, z] as Vec3), [sx, 0, 0]))],
      tools: ["screwdriver"],
    },
    {
      title: "Build the drawer on its front",
      detail: "Sides onto the front with their dowels and cam bolts, then lock the cams.",
      kind: "cams",
      scene: "drawer",
      pose: "-z",
      stage: ["F", "L", "R"].map((id) => ({ id, pos: rel(id) })),
      fit: [fit(HW.camScrew, [-1, 1].map((sx) => [sx * (bw / 2 - 6), y0 + 8 + sh / 2, zf - at / 2] as Vec3), [0, 0, -1], { on: "F" }), fit(HW.cam, [-1, 1].map((sx) => [sx * (bw / 2 - 6), y0 + 8 + sh / 2, zf - at / 2 - 30] as Vec3), [1, 0, 0], { on: "L" })],
      tools: ["screwdriver"],
      warnings: ["floor", "face"],
    },
    { title: "Slide in the bottom and fit the back", detail: "Bottom down the grooves, back over it, then two screws through each side.", kind: "drawer", scene: "drawer", stage: [{ id: "B", pos: rel("B"), from: [0, 0, -300] }, { id: "K", pos: rel("K"), from: [0, 0, -200] }], fit: [-1, 1].map((sx) => fit(RUNNER_SCREW, [[sx * (bw / 2), y0 + 8 + sh / 2, zb + 6]], [-sx, 0, 0], { on: "K" })), tools: ["screwdriver"] },
    { title: "Turn the desk over and slide the drawer in", detail: "Set it on the runners and push until it clicks.", kind: "drawer", scene: "main", pose: "+y", add: ["F", "L", "R", "B", "K"], from: [0, 0, 420] },
  ];
  run(b, parts, steps);
}

/* ---------- bedside table, side table, coffee table: round legs, panels on cam locks, a shelf, drawers ---------- */

interface LegCfg {
  W: number;
  D: number;
  H: number;
  shelfY: number;
  drawers: 1 | 2; // 2: one at the front and one at the back
}

function legTableBuild(b: PlanBuilder, c: LegCfg) {
  const { W, D, H } = c;
  const t = 22, ld = 40, pt = 16, ah = Math.min(150, H * 0.26);
  const yU = H - t;
  const lx = W / 2 - 30, lz = D / 2 - 30;
  const ya = yU - ah / 2;
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ id: `LG${sx}${sz}`, sx, sz })));
  const parts: Part[] = [box("TP", "Top", [W, t, D], [0, H - t / 2, 0])];
  for (const l of legs) parts.push({ id: l.id, name: "Leg", size: [ld, yU, ld], pos: [l.sx * lx, yU / 2, l.sz * lz], cyl: true, mat: "wood" });
  const inX = 2 * lx - ld, inZ = 2 * lz - ld;
  for (const sx of [-1, 1]) parts.push(box(`EP${sx}`, "End panel", [pt, ah, inZ], [sx * lx, ya, 0]));
  const two = c.drawers === 2;
  if (!two) parts.push(box("BP", "Back panel", [inX, ah, pt], [0, ya, -lz]));
  parts.push(box("SH", "Shelf", [inX, 18, 2 * lz], [0, c.shelfY, 0]));

  const steps: St[] = [];
  const endFrame = (sx: number) => [`LG${sx}-1`, `LG${sx}1`, `EP${sx}`];
  const centre: Vec3 = [0, yU / 2, 0];
  const lay = (id: string, k: number): Stage => {
    const p = parts.find((q) => q.id === id)!;
    return { id, pos: [(k * 2 - 1) * 260 + (p.pos[2]) * 0.0, p.pos[1] - centre[1], p.pos[2] - centre[2]] };
  };
  steps.push({
    title: "Tap the pins into the legs",
    detail: "Lay the legs on the rug. A pin goes into the top of each pair of legs for the end panels.",
    kind: "dowels",
    scene: "ends",
    pose: "+x",
    stage: [...endFrame(-1).map((id) => lay(id, 0)), ...endFrame(1).map((id) => lay(id, 1))],
    fit: legs.map((l) => fit(HW.dowel, [[l.sx * lx, ya, l.sz * (lz - ld / 2)]], [0, 0, l.sz], { on: l.id })),
    tools: ["hammer"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Screw the legs to the end panels",
    detail: "Two screws through each leg into the panel, with the Allen key.",
    kind: "screws",
    scene: "ends",
    fit: legs.map((l) => fit(LEG_SCREW, [ya - 30, ya + 30].map((y) => [l.sx * lx, y, l.sz * (lz + ld / 2)] as Vec3), [0, 0, -l.sz], { on: l.id, mate: `EP${l.sx}` })),
    tools: ["allen"],
  });
  const camB = (sx: number, z: number, y: number): Vec3 => [sx * (lx - ld / 2), y, z];
  steps.push({
    title: "Screw the cam bolts into the legs",
    detail: two ? "For the shelf: two in each end frame, by hand." : "For the back panel and the shelf, by hand.",
    kind: "cams",
    scene: "ends",
    fit: [-1, 1].flatMap((sx) => [
      ...[-1, 1].map((sz) => fit(HW.camScrew, [camB(sx, sz * (lz - 10), c.shelfY)], [-sx, 0, 0], { on: `LG${sx}${sz}` })),
      ...(two ? [] : [fit(HW.camScrew, [camB(sx, -lz, ya - 25), camB(sx, -lz, ya + 25)], [-sx, 0, 0], { on: `LG${sx}-1` })]),
    ]),
    tools: ["screwdriver"],
  });
  const runner: HwDef = { kind: "runner", len: Math.round(two ? inZ / 2 - 60 : inZ - 40), dia: 40 };
  const zDr = two ? [-1, 1] : [1];
  const yr = ya - ah / 2 + 20;
  steps.push({
    title: two ? "Screw the runners onto the end panels" : "Screw a runner onto each end panel",
    detail: "Inside faces, marked left and right. Two screws each.",
    kind: "runners",
    scene: "ends",
    fit: [-1, 1].flatMap((sx) => [fit(runner, zDr.map((sz) => [sx * (lx - pt / 2), yr, two ? (sz * inZ) / 4 : 0] as Vec3), [0, 1, 0], { on: `EP${sx}`, hole: false }), fit(RUNNER_SCREW, zDr.flatMap((sz) => [-60, 60].map((dz) => [sx * (lx - pt / 2), yr + 8, (two ? (sz * inZ) / 4 : 0) + dz] as Vec3)), [sx, 0, 0], { on: `EP${sx}` })]),
    tools: ["screwdriver"],
  });
  const backIds = two ? [] : ["BP"];
  steps.push({
    title: two ? "Stand up one end frame" : "Push the back panel into one end frame",
    detail: two ? "On its legs, inside face towards you." : "Onto its cam bolts, then turn the two cam locks.",
    kind: "cams",
    scene: "main",
    pose: "+y",
    add: [...endFrame(-1), ...backIds],
    from: { [`LG-1-1`]: [-200, 0, 0], [`LG-11`]: [-200, 0, 0], [`EP-1`]: [-200, 0, 0], BP: [0, 0, -200] },
    fit: two ? [] : [fit(HW.cam, [[-inX / 2 + 30, ya, -lz] as Vec3, [-inX / 2 + 30, ya + 40, -lz] as Vec3], [0, 0, 1], { on: "BP" })],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Slide in the shelf",
    detail: "Onto its cam bolts, then lock the cams underneath.",
    kind: "cams",
    add: ["SH"],
    from: [0, 0, 300],
    fit: [fit(HW.cam, [[-inX / 2 + 30, c.shelfY - 9, -(lz - 10)] as Vec3, [-inX / 2 + 30, c.shelfY - 9, lz - 10] as Vec3], [0, 1, 0], { on: "SH" })],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Fit the other end frame",
    detail: "Onto the cam bolts in the back panel and shelf. Turn the remaining cam locks.",
    kind: "cams",
    add: endFrame(1),
    from: [220, 0, 0],
    fit: [fit(HW.cam, [...(two ? [] : [[inX / 2 - 30, ya, -lz] as Vec3, [inX / 2 - 30, ya + 40, -lz] as Vec3]), [inX / 2 - 30, c.shelfY - 9, -(lz - 10)] as Vec3, [inX / 2 - 30, c.shelfY - 9, lz - 10] as Vec3], [0, 1, 0], { on: "SH" })],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Stick the glides under the legs",
    detail: "Turn it upside down and press one onto the end of each leg.",
    kind: "legs",
    pose: "-y",
    fit: [fit(LEG_GLIDE, legs.map((l) => [l.sx * lx, 0, l.sz * lz] as Vec3), [0, 1, 0], { hole: false })],
  });
  const clipPts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (lx - ld), yU, sz * (inZ / 2 - 40)] as Vec3));
  steps.push({
    title: "Clip the top on",
    detail: "Screw the four brackets under the top, then lower the frame onto it and press until the clips catch.",
    kind: "screws",
    pose: "+y",
    add: ["TP"],
    from: [0, 220, 0],
    pre: [fit(TABLE_LOCK, clipPts, [0, 1, 0], { hole: false })],
    fit: [fit(RUNNER_SCREW, clipPts.map((p) => [p[0], p[1], p[2]] as Vec3), [0, 1, 0], { on: "TP" })],
    tools: ["screwdriver"],
  });
  run(b, parts, steps);

  // drawers, built on their fronts
  const dws = zDr.map((sz, i) => ({ i, sz }));
  const dd = two ? inZ / 2 - 30 : inZ - 30;
  const fh = ah - 8, sh = ah - 40, bw = inX - 40;
  const dp: Part[] = [];
  const zfOf = (sz: number) => sz * (lz + ld / 2 - pt / 2);
  for (const d of dws) {
    const zf = zfOf(d.sz), zm = zf - d.sz * (pt / 2 + dd / 2), y0 = ya - ah / 2 + 4;
    dp.push(box(`F${d.i}`, "Drawer front", [inX - 4, fh, pt], [0, y0 + fh / 2, zf]));
    dp.push(box(`L${d.i}`, "Drawer side", [12, sh, dd], [-bw / 2 + 6, y0 + 16 + sh / 2, zm]));
    dp.push(box(`R${d.i}`, "Drawer side", [12, sh, dd], [bw / 2 - 6, y0 + 16 + sh / 2, zm]));
    dp.push(box(`B${d.i}`, "Drawer bottom", [bw - 12, 3, dd - 12], [0, y0 + 20, zm], "fiber"));
    dp.push(box(`K${d.i}`, "Drawer back", [bw - 24, sh - 12, 12], [0, y0 + 22 + (sh - 12) / 2, zf - d.sz * (pt / 2 + dd - 6)]));
  }
  const d0 = dws[0];
  const c0 = dp.find((p) => p.id === "F0")!.pos;
  const rel = (id: string): Vec3 => {
    const p = dp.find((q) => q.id === id)!;
    return [p.pos[0] - c0[0], p.pos[1] - c0[1], p.pos[2] - c0[2]];
  };
  const camsOf = (i: number, sz: number): Fit[] => {
    const f = dp.find((p) => p.id === `F${i}`)!.pos;
    const k = dp.find((p) => p.id === `K${i}`)!.pos;
    return [
      fit(HW.camScrew, [-1, 1].map((sx) => [sx * (bw / 2 - 6), f[1], f[2] - sz * (pt / 2)] as Vec3), [0, 0, sz], { on: `F${i}` }),
      fit(HW.cam, [-1, 1].flatMap((sx) => [f[2] - sz * (pt / 2 + 30), k[2] + sz * 20].map((z) => [sx * (bw / 2 - 12), f[1], z] as Vec3)), [0, 1, 0], { on: `L${i}` }),
    ];
  };
  const rep = dws.length > 1 ? 2 : undefined;
  const drawerIds = dws.flatMap((d) => [`F${d.i}`, `L${d.i}`, `R${d.i}`, `B${d.i}`, `K${d.i}`]);
  const dsteps: St[] = [
    {
      title: "Screw the cam bolts into the drawer front",
      detail: "Lay it face down on the rug and turn the bolts in by hand.",
      kind: "cams",
      scene: "drawer",
      pose: "-z",
      stage: [{ id: "F0", pos: rel("F0") }],
      fit: [camsOf(0, d0.sz)[0]],
      tools: ["screwdriver"],
      repeat: rep,
      warnings: ["floor", "face"],
    },
    { title: "Stand the sides on the front", detail: "Grooves facing in, at the bottom.", kind: "drawer", scene: "drawer", stage: ["L0", "R0"].map((id) => ({ id, pos: rel(id) })), repeat: rep },
    { title: "Slide in the bottom and put the back on", detail: "Bottom down the grooves, back across the ends of the sides.", kind: "drawer", scene: "drawer", stage: [{ id: "B0", pos: rel("B0"), from: [0, 0, -300] }, { id: "K0", pos: rel("K0"), from: [0, 0, -200] }], repeat: rep },
    { title: "Lock the cams", detail: "Four cam locks, clockwise until the corners pull tight.", kind: "cams", scene: "drawer", fit: [camsOf(0, d0.sz)[1]], tools: ["screwdriver"], repeat: rep },
    {
      title: two ? "Put in both drawers" : "Put in the drawer",
      detail: two ? "One from each side. Rest it on the runners and push until it clicks." : "Rest it on the runners and push until it clicks.",
      kind: "drawer",
      scene: "main",
      pose: "+y",
      add: drawerIds,
      from: Object.fromEntries(dws.flatMap((d) => [`F${d.i}`, `L${d.i}`, `R${d.i}`, `B${d.i}`, `K${d.i}`].map((id) => [id, [0, 0, d.sz * 380] as Vec3]))),
      preset: dws.slice(1).flatMap((d) => camsOf(d.i, d.sz).map((f) => ({ ...f, hole: false as const }))),
    },
  ];
  run(b, dp, dsteps);
}

/* ---------- beds: four round posts, a headboard and footboard on cam locks, side rails, slat strips and a centre beam ---------- */

const BED_GLIDE: HwDef = { kind: "glide", len: 6, dia: 30 };
const CAM_COVER: HwDef = { kind: "cap", len: 2, dia: 20 };
const SLAT_HOLDER: HwDef = { kind: "clip", len: 30, dia: 22 };
const STRIP_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };

interface BedCfg {
  W: number;
  D: number;
  H: number;
  slats: boolean; // a slatted base comes with it
  storage: boolean;
  beamLegs: number; // legs under the centre beam
  drawers4?: boolean; // the king: four drawers, two each side, on runners on the head and foot rails and two hung bars
}

function bedBuild(b: PlanBuilder, c: BedCfg) {
  const { W, D, H } = c;
  const pd = 60, ft = 450, rt = 22, rh = 160, y0 = 200;
  const px = W / 2 - pd / 2, pz = D / 2 - pd / 2;
  const ry = y0 + rh / 2;
  const inW = 2 * px - pd, inD = 2 * pz - pd;
  const parts: Part[] = [];
  const posts = [
    { id: "PH-1", x: -px, z: -pz, h: H },
    { id: "PH1", x: px, z: -pz, h: H },
    { id: "PF-1", x: -px, z: pz, h: ft },
    { id: "PF1", x: px, z: pz, h: ft },
  ];
  for (const p of posts) parts.push({ id: p.id, name: p.h > ft ? "Head post" : "Foot post", size: [pd, p.h, pd], pos: [p.x, p.h / 2, p.z], cyl: true, mat: "wood" });
  parts.push(box("HB", "Headboard", [inW, H - 120 - (y0 + rh + 40), rt], [0, (H - 120 + y0 + rh + 40) / 2, -pz]));
  // with four drawers the head rail and footboard reach down so the end runners have something to screw into
  const eh = c.drawers4 ? rh + y0 - 40 : rh, ey = c.drawers4 ? 40 + eh / 2 : ry;
  parts.push(box("HR", "Head rail", [inW, eh, rt], [0, ey, -pz]));
  parts.push(box("FB", "Footboard", [inW, eh, rt], [0, ey, pz]));
  for (const sx of [-1, 1]) parts.push(box(`SR${sx}`, "Side rail", [rt, rh, inD], [sx * px, ry, 0]));
  const stx = c.drawers4 ? 6 : 0; // room for the hanging brackets between the rail and the strip
  for (const sx of [-1, 1]) parts.push(box(`ST${sx}`, "Slat strip", [20, 30, inD - 20], [sx * (px - rt / 2 - 10 - stx), y0 + 25, 0], "wood"));
  parts.push(box("BM", "Centre beam", [40, 40, inD - 10], [0, y0 + 20, 0], "metal"));
  const legIds = range(c.beamLegs).map((i) => {
    const z = -inD / 2 + (inD * (i + 1)) / (c.beamLegs + 1);
    parts.push({ id: `BL${i}`, name: "Beam leg", size: [30, y0, 30], pos: [0, y0 / 2, z], cyl: true, mat: "metal" });
    return `BL${i}`;
  });
  const nSlats = Math.round(inD / 110);
  const slatW = 2 * (px - rt / 2 - 20);
  parts.push({
    id: "SB",
    name: c.slats ? "Slatted base" : "Slatted base (sold separately)",
    size: [slatW, 12, inD - 20],
    pos: [0, y0 + 46, 0],
    mat: "wood",
    extra: !c.slats,
    pieces: range(nSlats).map((i) => ({ shape: "box", size: [slatW, 10, 60], pos: [0, 0, -(inD - 20) / 2 + 30 + ((inD - 80) * i) / (nSlats - 1)] })),
  });

  const steps: St[] = [];
  const pc = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!.pos;
    return id === "HR" || id === "FB" ? [p[0], ry, p[2]] : p; // fittings stay at the rail height
  };
  const lay = (ids: string[]) => ids.map((id, k) => ({ id, pos: [(k - (ids.length - 1) / 2) * 140, 0, 0] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 }));
  steps.push({
    title: "Tap the glides into the posts",
    detail: "Lay the four posts on the rug and tap a glide into the bottom of each.",
    kind: "legs",
    scene: "posts",
    pose: "+y",
    stage: lay(posts.map((p) => p.id)),
    fit: posts.map((p) => fit(BED_GLIDE, [[p.x, 0, p.z]], [0, 1, 0], { on: p.id, hole: false })),
    tools: ["hammer"],
    warnings: ["floor"],
  });
  const postBolts = (p: (typeof posts)[number]): Fit[] => {
    const into = p.h > ft ? [ry - 40, ry + 40, y0 + rh + 120] : [ry - 40, ry + 40];
    return [
      fit(HW.camScrew, into.slice(0, p.h > ft ? 2 : 2).map((y) => [p.x, y, p.z - Math.sign(p.z) * (pd / 2)] as Vec3), [0, 0, Math.sign(p.z)], { on: p.id }),
      fit(HW.camScrew, [ry - 40, ry + 40].map((y) => [p.x - Math.sign(p.x) * (pd / 2), y, p.z] as Vec3), [Math.sign(p.x), 0, 0], { on: p.id }),
    ];
  };
  steps.push({
    title: "Screw the cam bolts into the posts",
    detail: "By hand, into the holes on the inner faces. The head posts take an extra pair for the headboard.",
    kind: "cams",
    scene: "posts",
    fit: [
      ...posts.flatMap(postBolts),
      ...posts.filter((p) => p.h > ft).map((p) => fit(HW.camScrew, [y0 + rh + 160, H - 200].map((y) => [p.x - Math.sign(p.x) * (pd / 2), y, p.z] as Vec3), [Math.sign(p.x), 0, 0], { on: p.id })),
    ],
    tools: ["screwdriver"],
  });
  const ends = ["HB", "HR", "FB"];
  steps.push({
    title: "Tap the dowels into the head and foot panels",
    detail: "Lay the headboard, head rail and footboard on the rug. Dowels go into both ends of each.",
    kind: "dowels",
    scene: "panels",
    stage: ends.map((id, k) => ({ id, pos: [0, 0, (k - 1) * 600] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 })),
    fit: ends.map((id) => {
      const p = pc(id);
      const n = id === "HB" ? 6 : 4;
      return fit(HW.dowel, range(n).map((i) => [(i % 2 ? 1 : -1) * (inW / 2), p[1] + (Math.floor(i / 2) - (n / 2 - 1) / 2) * 40, p[2]] as Vec3), [1, 0, 0], { on: id });
    }),
    tools: ["hammer"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Press the cam locks into the panels",
    detail: "Arrows pointing to the ends, where the bolts will come in.",
    kind: "cams",
    scene: "panels",
    fit: ends.map((id) => {
      const p = pc(id);
      return fit(HW.cam, [-1, 1].flatMap((sx) => [-1, 1].map((k) => [sx * (inW / 2 - 30), p[1] + k * 40, p[2] + rt / 2] as Vec3)), [0, 0, -1], { on: id });
    }),
    tools: ["screwdriver"],
  });
  const headIds = ["PH-1", "PH1", "HB", "HR"];
  steps.push({
    title: "Fit the head posts to the headboard",
    detail: "Lay the headboard and head rail on the rug, push the posts onto their ends and turn the cam locks clockwise.",
    kind: "cams",
    scene: "main",
    pose: "+z",
    add: headIds,
    from: { "PH-1": [-260, 0, 0], PH1: [260, 0, 0], HB: [0, 0, 200], HR: [0, 0, 200] },
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Fit the foot posts to the footboard",
    detail: "The same way: posts onto the ends, then tighten the cam locks.",
    kind: "cams",
    add: ["PF-1", "PF1", "FB"],
    from: { "PF-1": [-260, 0, 0], PF1: [260, 0, 0], FB: [0, 0, 200] },
    tools: ["screwdriver"],
  });
  const covers: Vec3[] = ends.flatMap((id) => {
    const p = pc(id);
    return [-1, 1].map((sx) => [sx * (inW / 2 - 30), p[1], p[2] + rt / 2] as Vec3);
  });
  steps.push({
    title: "Press the cover caps over the cam locks",
    detail: "They hide the locks on the side that faces the room.",
    kind: "general",
    fit: [fit(CAM_COVER, [...covers, ...covers.slice(0, 2).map((p) => [p[0], p[1] + 60, p[2]] as Vec3)].slice(0, 8), [0, 0, -1], { hole: false })],
  });
  steps.push({
    title: "Get the side rails ready",
    detail: "Dowels into both ends, then the cam locks into the holes near each end.",
    kind: "dowels",
    scene: "rails",
    pose: "+y",
    stage: ["SR-1", "SR1"].map((id, k) => ({ id, pos: [(k * 2 - 1) * 200, 0, 0] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 })),
    fit: [-1, 1].flatMap((sx) => [
      fit(HW.dowel, [-1, 1].flatMap((sz) => [-50, 0, 50].map((dy) => [sx * px, ry + dy, sz * (inD / 2)] as Vec3)), [0, 0, 1], { on: `SR${sx}` }),
      fit(HW.cam, [-1, 1].flatMap((sz) => [-40, 40].map((dy) => [sx * px - sx * (rt / 2), ry + dy, sz * (inD / 2 - 30)] as Vec3)), [sx, 0, 0], { on: `SR${sx}` }),
    ]),
    tools: ["hammer", "screwdriver"],
  });
  steps.push({
    title: "Fit a side rail to the headboard together",
    detail: "Stand the headboard up. One person holds it while the other pushes the rail onto the bolts and turns the cam locks.",
    kind: "cams",
    scene: "main",
    pose: "+y",
    add: ["SR-1"],
    from: [-240, 0, 0],
    people: 2,
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Fit the other rail and the footboard together",
    detail: "Second rail on the other side, then the foot end onto both rails. Tighten all the cam locks.",
    kind: "cams",
    add: ["SR1"],
    from: [240, 0, 0],
    people: 2,
    tools: ["screwdriver"],
    check: "square",
  });
  if (c.drawers4) steps.push(...kingSupports(parts, { px, pz, rt }));
  steps.push({
    title: "Screw the slat strips inside the side rails",
    detail: "Along the bottom inside edge of each rail, eight screws each.",
    kind: "screws",
    add: ["ST-1", "ST1"],
    from: [0, 200, 0],
    fit: [-1, 1].map((sx) => fit(STRIP_SCREW, range(8).map((i) => [sx * (px - rt / 2 - 20), y0 + 25, -inD / 2 + 80 + ((inD - 160) * i) / 7] as Vec3), [sx, 0, 0], { on: `ST${sx}`, mate: `SR${sx}` })),
    tools: ["screwdriver"],
  });
  steps.push({
    title: legIds.length ? "Hang the centre beam and stand it on its legs" : "Hang the centre beam",
    detail: "Hook its ends over the head rail and footboard, pull it out to length and fix it with the small screws.",
    kind: "screws",
    add: ["BM", ...legIds],
    from: [0, 200, 0],
    fit: [fit(STRIP_SCREW, [-1, 1].flatMap((sz) => [-10, 10].map((dx) => [dx, y0 + 40, sz * (inD / 2 - 20)] as Vec3)), [0, -1, 0], { on: "BM" }), fit(SMALL_SCREW, [[0, y0 + 40, 0], [12, y0 + 40, 30], [-12, y0 + 40, -30]], [0, -1, 0], { on: "BM" })],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Screw in the slat holders",
    detail: "Two on each side rail, near the ends. They keep the slats from sliding.",
    kind: "screws",
    fit: [fit(SLAT_HOLDER, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (px - rt / 2), y0 + 50, sz * (inD / 2 - 150)] as Vec3)), [0, -1, 0], { hole: false }), fit(STRIP_SCREW, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (px - rt / 2 - 6), y0 + 50, sz * (inD / 2 - 150)] as Vec3)), [0, -1, 0])],
    tools: ["screwdriver"],
  });
  const slatStep: St = {
    title: c.slats ? "Roll out the slatted base" : "Roll out a slatted base",
    detail: c.slats ? "Straps down, from the head to the foot, so every slat rests on the strips." : "It isn't included with the frame. Roll it out from the head to the foot, onto the strips.",
    kind: "slats",
    add: ["SB"],
    from: [0, 0, -500],
  };
  run(b, c.storage ? parts.filter((p) => p.id !== "SB") : parts, c.storage ? steps : [...steps, slatStep]);
  if (c.storage && c.drawers4) kingDrawers(b, { px, pz, inW, y0, rt });
  else if (c.storage) bedDrawers(b, { px, pz, inD, y0, rt, pd });
  if (c.storage) run(b, [{ ...parts.find((p) => p.id === "SB")!, id: "SB2" }], [{ ...slatStep, add: ["SB2"] }]);
}

/*
 * The king storage bed: four drawers, two under each side rail, staggered so they never meet. Each drawer runs on two
 * metal runners: the head drawer on the left between the head rail and the first bar, the foot drawer on the right
 * between the second bar and the footboard, the middle ones between the bars. The two bars hang from the side rails
 * on a bracket at each end.
 */
const KING_RUNNER_Y = 100;
const ARM_SCREW: HwDef = { kind: "screw", len: 16, dia: 5 };
const HANG_STUD: HwDef = { kind: "stud", len: 12, dia: 10, name: "Hanging stud" };
const RUNNER_CLIP: HwDef = { kind: "clip", len: 30, dia: 20, name: "Runner lock" };
const DRAWER_PIN: HwDef = { kind: "camScrew", len: 30, dia: 8 };

function kingLayout(g: { px: number; pz: number; rt: number }) {
  const zH = -g.pz + g.rt / 2, zF = g.pz - g.rt / 2; // inner faces of the head rail and footboard
  const span = (zF - zH - 40) / 3;
  const z1 = zH + span + 10, z2 = z1 + 20 + span;
  // each drawer: its side, and the two support faces it runs between (support id, face z, which way the drawer is)
  type Face = { on: string; z: number; g: 1 | -1 };
  const dws: { i: number; sx: number; a: Face; c: Face }[] = [
    { i: 0, sx: -1, a: { on: "HR", z: zH, g: 1 }, c: { on: "BAR0", z: z1 - 10, g: -1 } },
    { i: 1, sx: -1, a: { on: "BAR0", z: z1 + 10, g: 1 }, c: { on: "BAR1", z: z2 - 10, g: -1 } },
    { i: 2, sx: 1, a: { on: "BAR0", z: z1 + 10, g: 1 }, c: { on: "BAR1", z: z2 - 10, g: -1 } },
    { i: 3, sx: 1, a: { on: "BAR1", z: z2 + 10, g: 1 }, c: { on: "FB", z: zF, g: -1 } },
  ];
  return { z1, z2, dws };
}

function kingRunners(g: { px: number; pz: number; rt: number; inW: number }) {
  const xo = g.px + g.rt / 2;
  const bd = Math.min(600, g.inW / 2 - 60);
  const runLen = Math.round((bd - 40) / 10) * 10;
  const { dws } = kingLayout(g);
  const runner: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const list = dws.flatMap((d) => [d.a, d.c].map((f) => {
    const xc = d.sx * (xo - 18 - bd / 2);
    const n = f.on === "HR" || f.on === "FB" ? 3 : 5;
    return {
      on: f.on,
      runner: fit(runner, [[xc, KING_RUNNER_Y, f.z + f.g * 7]], [0, 1, 0], { on: f.on, hole: false, twist: Math.PI / 2 }),
      screws: fit(RUNNER_SCREW, range(n).map((k) => [xc + (k - (n - 1) / 2) * (runLen / n), KING_RUNNER_Y, f.z + f.g * 2] as Vec3), [0, 0, -f.g], { on: f.on }),
    };
  }));
  return { xo, bd, list };
}

/** The steps that fit the runners and hang the bars, between joining the frame and the slat strips. Adds the bars and brackets to `parts`. */
function kingSupports(parts: Part[], g: { px: number; pz: number; rt: number }): St[] {
  const inW = 2 * g.px - 60;
  const { z1, z2 } = kingLayout(g);
  const { list } = kingRunners({ ...g, inW });
  const xa = g.px - g.rt / 2 - 3; // bracket centre, against the rail's inner face
  const barW = 2 * (xa - 3);
  const armH = 230, armY = KING_RUNNER_Y - 20 + armH / 2;
  const zs = [z1, z2];
  zs.forEach((z, i) => {
    parts.push(box(`BAR${i}`, "Drawer bar", [barW, 40, 20], [0, KING_RUNNER_Y, z], "metal"));
    for (const sx of [-1, 1]) parts.push(box(`ARM${i}${sx}`, "Hanging bracket", [6, armH, 50], [sx * xa, armY, z], "metal"));
  });
  const barIds = [0, 1].flatMap((i) => [`BAR${i}`, `ARM${i}-1`, `ARM${i}1`]);
  const scene = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!.pos;
    const i = Number(id.replace(/\D/g, "").slice(0, 1));
    return [p[0], p[1], (i - 0.5) * 320];
  };
  const ends = list.filter((r) => r.on === "HR" || r.on === "FB");
  const onBars = list.filter((r) => r.on.startsWith("BAR"));
  const hangY = 280, screwY = 240;
  return [
    {
      title: "Screw a runner inside the head rail",
      detail: "On the left, low down, its front end at the side rail. Three screws.",
      kind: "runners",
      fit: [ends[0].runner, ends[0].screws],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a runner inside the footboard",
      detail: "The same way, on the right.",
      kind: "runners",
      fit: [ends[1].runner, ends[1].screws],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hanging brackets onto the bars",
      detail: "Lay both bars on the rug. One bracket on each end, two screws each.",
      kind: "screws",
      scene: "bars",
      stage: barIds.map((id) => ({ id, pos: scene(id) })),
      fit: zs.flatMap((z, i) => [-1, 1].map((sx) => fit(ARM_SCREW, [-8, 8].map((dy) => [sx * (xa + 3), KING_RUNNER_Y + dy, z] as Vec3), [-sx, 0, 0], { on: `ARM${i}${sx}`, mate: `BAR${i}` }))),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw the runners onto the bars",
      detail: "Six runners: the first bar takes three, the second bar three, each facing the drawer it carries.",
      kind: "runners",
      scene: "bars",
      fit: onBars.flatMap((r) => [r.runner, r.screws]),
      tools: ["screwdriver"],
    },
    {
      title: "Hang the bars inside the side rails",
      detail: "Screw the hanging studs into the rails, hook each bracket over its stud, then fix it with a screw.",
      kind: "screws",
      pre: [-1, 1].map((sx) => fit(HANG_STUD, zs.map((z) => [sx * (g.px - g.rt / 2), hangY, z] as Vec3), [sx, 0, 0], { on: `SR${sx}` })),
      add: barIds,
      from: [0, 260, 0],
      fit: [-1, 1].flatMap((sx) => zs.map((z, i) => fit(ARM_SCREW, [[sx * (xa - 3), screwY, z]], [sx, 0, 0], { on: `ARM${i}${sx}`, mate: `SR${sx}` }))),
      tools: ["screwdriver"],
    },
  ];
}

/** The king's four drawers: built on their fronts, then pushed onto the runners from the sides of the bed. */
function kingDrawers(b: PlanBuilder, g: { px: number; pz: number; inW: number; y0: number; rt: number }) {
  const { dws } = kingLayout(g);
  const { xo, bd } = kingRunners(g);
  const dh = g.y0 - 30, sh = dh - 40;
  const lim = g.pz - 34; // the fronts stay clear of the posts
  const parts: Part[] = [];
  const geo = dws.map((d) => {
    const z0 = d.a.z + 14, z1 = d.c.z - 14, bw = z1 - z0, zc = (z0 + z1) / 2;
    const f0 = Math.max(d.a.z - 6, -lim), f1 = Math.min(d.c.z + 6, lim);
    const xin = (o: number) => d.sx * (xo - o); // o mm in from the bed's side
    parts.push(box(`F${d.i}`, "Drawer front", [18, dh - 6, f1 - f0], [xin(9), 30 + dh / 2, (f0 + f1) / 2]));
    parts.push(box(`L${d.i}`, "Drawer side", [bd, sh, 12], [xin(18 + bd / 2), 40 + sh / 2, z0 + 6]));
    parts.push(box(`R${d.i}`, "Drawer side", [bd, sh, 12], [xin(18 + bd / 2), 40 + sh / 2, z1 - 6]));
    parts.push(box(`B${d.i}`, "Drawer bottom", [bd - 12, 3, bw - 12], [xin(18 + bd / 2), 44, zc], "fiber"));
    parts.push(box(`K${d.i}`, "Drawer back", [12, sh - 12, bw - 24], [xin(18 + bd - 6), 46 + (sh - 12) / 2, zc]));
    return { ...d, z0, z1, xin };
  });
  const ys = [40 + sh / 2 - 30, 40 + sh / 2 + 30];
  const joins = (d: (typeof geo)[number]): Fit[] => [
    fit(DRAWER_PIN, [d.z0 + 6, d.z1 - 6].flatMap((z) => ys.map((y) => [d.xin(18), y, z] as Vec3)), [d.sx, 0, 0], { on: `F${d.i}` }),
    fit(HW.cam, [d.z0 + 6, d.z1 - 6].flatMap((z) => ys.map((y) => [d.xin(48), y, z] as Vec3)), [0, 1, 0], { on: `L${d.i}` }),
  ];
  const c0 = parts.find((p) => p.id === "F0")!.pos;
  const rel = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!.pos;
    return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
  };
  const ids = (i: number) => [`F${i}`, `L${i}`, `R${i}`, `B${i}`, `K${i}`];
  const from: Record<string, Vec3> = {};
  for (const d of geo) for (const id of ids(d.i)) from[id] = [d.sx * 520, 0, 0];
  const steps: St[] = [
    {
      title: "Build the drawers on their fronts",
      detail: "Pins into the front, sides onto them, bottom down the grooves, back across the ends. Turn the four cam locks.",
      kind: "cams",
      scene: "drawer",
      pose: "+y",
      stage: ids(0).map((id) => ({ id, pos: rel(id) })),
      fit: joins(geo[0]),
      tools: ["screwdriver"],
      repeat: 4,
      warnings: ["floor"],
    },
    {
      title: "Put in all four drawers",
      detail: "From the sides of the bed: pull the runners out, set each drawer on them and push it in until the locks click.",
      kind: "drawer",
      scene: "main",
      pose: "+y",
      add: geo.flatMap((d) => ids(d.i)),
      from,
      preset: geo.slice(1).flatMap((d) => joins(d).map((f) => ({ ...f, hole: false as const }))),
      fit: geo.map((d) => fit(RUNNER_CLIP, [d.z0 + 6, d.z1 - 6].map((z) => [d.xin(40), 40, z] as Vec3), [0, 1, 0], { on: `B${d.i}`, hole: false })),
    },
  ];
  run(b, parts, steps);
}

/** Two drawers under one side rail, at the foot end, on runners screwed to three supports. */
function bedDrawers(b: PlanBuilder, g: { px: number; pz: number; inD: number; y0: number; rt: number; pd: number }) {
  const { px, inD, y0, rt } = g;
  const depth = 560, dh = y0 - 30;
  const xo = px + rt / 2; // outer face of the right rail
  const len = inD / 2 - 60; // two drawers along the foot half
  const z0 = inD / 2 - 60 - len; // the last support stays clear of the footboard and under the beam
  const zs = [z0, z0 + len / 2 + 9, z0 + len + 18];
  // each support runs from the side rail to under the centre beam, so both ends have something to screw into
  const sl = Math.max(depth, xo - rt + 20);
  const parts: Part[] = zs.map((z, i) => box(`SP${i}`, "Drawer support", [sl, dh, 18], [xo - rt - sl / 2, 30 + dh / 2, z]));
  const dws = [0, 1].map((i) => ({ i, z: (zs[i] + zs[i + 1]) / 2, w: zs[i + 1] - zs[i] - 18 - 20 }));
  for (const d of dws) {
    const sh = dh - 40, bw = d.w, bd = depth - 40;
    const xm = xo - rt - bd / 2;
    parts.push(box(`F${d.i}`, "Drawer front", [18, dh - 6, d.w + 16], [xo - 9, 30 + dh / 2, d.z]));
    parts.push(box(`L${d.i}`, "Drawer side", [bd, sh, 12], [xm, 40 + sh / 2, d.z - bw / 2 + 6]));
    parts.push(box(`R${d.i}`, "Drawer side", [bd, sh, 12], [xm, 40 + sh / 2, d.z + bw / 2 - 6]));
    parts.push(box(`B${d.i}`, "Drawer bottom", [bd - 12, 3, bw - 12], [xm, 44, d.z], "fiber"));
    parts.push(box(`K${d.i}`, "Drawer back", [12, sh - 12, bw - 24], [xo - rt - bd + 6, 46 + (sh - 12) / 2, d.z]));
  }
  const runner: HwDef = { kind: "runner", len: depth - 60, dia: 40 };
  const d0 = dws[0];
  const c0 = parts.find((p) => p.id === "F0")!.pos;
  const rel = (id: string): Vec3 => {
    const p = parts.find((q) => q.id === id)!;
    return [p.pos[0] - c0[0], p.pos[1] - c0[1], p.pos[2] - c0[2]];
  };
  const cams = (d: { i: number; z: number; w: number }): Fit[] => [
    fit(HW.camScrew, [-1, 1].map((sz) => [xo - 18, 40 + (dh - 40) / 2, d.z + sz * (d.w / 2 - 6)] as Vec3), [-1, 0, 0], { on: `F${d.i}` }),
    fit(HW.cam, [-1, 1].map((sz) => [xo - 48, 40 + (dh - 40) / 2, d.z + sz * (d.w / 2 - 6)] as Vec3), [0, 1, 0], { on: `L${d.i}` }),
  ];
  const steps: St[] = [
    {
      title: "Screw the runners onto the drawer supports",
      detail: "Lay the three supports on the rug. The middle one takes a runner on each face.",
      kind: "runners",
      scene: "supports",
      pose: "+y",
      stage: zs.map((_, i) => ({ id: `SP${i}`, pos: [0, 0, (i - 1) * 260] as Vec3 })),
      fit: dws.flatMap((d) => [-1, 1].map((sz) => fit(runner, [[xo - rt - depth / 2, 40, d.z + sz * (d.w / 2 + 4)]], [0, 1, 0], { on: `SP${sz < 0 ? d.i : d.i + 1}`, hole: false, twist: Math.PI / 2 }))),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Fix the supports under the side rail",
      detail: "Each one hangs from the rail and the centre beam on its bracket; screw them on.",
      kind: "screws",
      scene: "main",
      pose: "+y",
      add: zs.map((_, i) => `SP${i}`),
      from: [0, -200, 0],
      fit: [fit(STRIP_SCREW, zs.flatMap((z) => [[xo - rt - 10, 30 + dh - 12, z], [0, 30 + dh - 12, z]] as Vec3[]), [0, 1, 0])],
      tools: ["screwdriver"],
    },
    {
      title: "Build the drawers on their fronts",
      detail: "Sides onto the front, bottom down the grooves, back across the ends. Then the cam bolts and locks.",
      kind: "cams",
      scene: "drawer",
      pose: "+x",
      stage: ["F0", "L0", "R0", "B0", "K0"].map((id) => ({ id, pos: rel(id) })),
      fit: cams(d0),
      tools: ["screwdriver"],
      repeat: 2,
      warnings: ["floor", "face"],
    },
    {
      title: "Put in both drawers",
      detail: "From the side of the bed: rest them on the runners and push until they click.",
      kind: "drawer",
      scene: "main",
      pose: "+y",
      add: dws.flatMap((d) => [`F${d.i}`, `L${d.i}`, `R${d.i}`, `B${d.i}`, `K${d.i}`]),
      from: [420, 0, 0],
      preset: cams(dws[1]).map((f) => ({ ...f, hole: false as const })),
    },
  ];
  run(b, parts, steps);
}

/* ---------- the chair: four legs and the back bolted under the seat, then the cover pulled on ---------- */

function chairBuild(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const sy = 440, st = 50;
  const parts: Part[] = [box("SE", "Seat", [W - 20, st, D - 140], [0, sy + st / 2, 20], "soft")];
  const lx = W / 2 - 50, lzF = D / 2 - 110, lzB = -D / 2 + 130;
  const legs = [
    { id: "LF-1", x: -lx, z: lzF },
    { id: "LF1", x: lx, z: lzF },
    { id: "LB-1", x: -lx, z: lzB },
    { id: "LB1", x: lx, z: lzB },
  ];
  for (const l of legs)
    parts.push({ id: l.id, name: "Leg", size: [34, sy + 6, 34], pos: [l.x + Math.sign(l.x) * 18, sy / 2, l.z + Math.sign(l.z) * 18], cyl: true, mat: "wood", rot: [Math.sign(l.z) * 0.08, 0, -Math.sign(l.x) * 0.08] });
  const backH = H - sy - st - 20;
  parts.push({ id: "BK", name: "Backrest", size: [W - 40, backH, 40], pos: [0, sy + st + 20 + backH / 2, -D / 2 + 70], mat: "soft", rot: [-0.1, 0, 0] });
  parts.push({ id: "BF", name: "Back support", size: [W - 120, 30, 120], pos: [0, sy - 15, -D / 2 + 120], mat: "metal" });
  const plate = (l: (typeof legs)[number]): Vec3[] => [-16, 0, 16].map((d, k) => [l.x + (k === 1 ? 0 : d), sy, l.z + (k === 1 ? Math.sign(l.z) * 20 : 0)] as Vec3);
  const LEG_BOLT: HwDef = { kind: "bolt", len: 30, dia: 6 };
  const BACK_BOLT: HwDef = { kind: "bolt", len: 40, dia: 6 };
  const steps: St[] = [
    {
      title: "Bolt the front legs under the seat",
      detail: "Lay the seat upside down on a table or rug. Each leg's plate takes three bolts.",
      kind: "bolts",
      pose: "-y",
      add: ["SE", "LF-1", "LF1"],
      from: { SE: [0, 150, 0], "LF-1": [0, -250, 0], LF1: [0, -250, 0] },
      fit: legs.slice(0, 2).map((l) => fit(LEG_BOLT, plate(l), [0, 1, 0], { on: l.id, mate: "SE" })),
      tools: ["allen"],
      warnings: ["floor"],
    },
    {
      title: "Bolt on the back legs and the back support",
      detail: "The back support goes on with the back legs, two bolts through it into the seat.",
      kind: "bolts",
      add: ["BF", "LB-1", "LB1"],
      from: [0, -250, 0],
      fit: [...legs.slice(2).map((l) => fit(LEG_BOLT, plate(l), [0, 1, 0], { on: l.id, mate: "SE" })), fit(BACK_BOLT, [-1, 1].map((sx) => [sx * (W / 2 - 100), sy, -D / 2 + 150] as Vec3), [0, 1, 0], { on: "BF", mate: "SE" })],
      tools: ["allen"],
    },
    {
      title: "Fix the backrest",
      detail: "Slide it onto the back support and turn in the last bolt with the Allen key.",
      kind: "bolts",
      add: ["BK"],
      from: [0, -200, -100],
      fit: [fit(BACK_BOLT, [[0, sy, -D / 2 + 90]], [0, 1, 0], { on: "BF", mate: "BK" })],
      tools: ["allen"],
    },
    { title: "Stand the chair up", detail: "Check that all four legs touch the floor.", kind: "standup", pose: "+y" },
  ];
  const coverBack: Part = { id: "CB", name: "Cover, back", size: [W - 30, backH + 10, 50], pos: [0, sy + st + 20 + backH / 2, -D / 2 + 70], mat: "soft", rot: [-0.1, 0, 0] };
  const coverSeat: Part = { id: "CS", name: "Cover, seat", size: [W - 10, st + 10, D - 130], pos: [0, sy + st / 2, 20], mat: "soft" };
  parts.push(coverBack, coverSeat);
  steps.push(
    { title: "Pull the cover over the backrest", detail: "Inside out first is easier: start at the top corners and work it down evenly.", kind: "cushions", add: ["CB"], from: [0, 300, 0] },
    { title: "Pull the cover over the seat", detail: "Ease it over the front corners, then smooth it towards the back.", kind: "cushions", add: ["CS"], from: [0, 0, 300] },
    { title: "Close the cover under the seat", detail: "Turn the chair over, pull the edges tight and press the fastening strip down all the way round.", kind: "cushions", pose: "-y", warnings: ["floor"] },
    { title: "Stand it up", kind: "standup", pose: "+y" },
  );
  run(b, parts, steps);
}

/* ---------- drawer unit on castors: panels on cam locks and dowels, a cable tray at the top, a drawer, castors ---------- */

function drawerUnitBuild(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const cy = 60; // castors
  const t = 16;
  const Wi = W - 2 * t;
  const parts: Part[] = [];
  for (const sx of [-1, 1]) parts.push(box(`S${sx}`, "Side panel", [t, H - cy, D], [sx * (W / 2 - t / 2), cy + (H - cy) / 2, 0]));
  parts.push(box("BT", "Bottom panel", [Wi, t, D], [0, cy + t / 2, 0]));
  const yShelf = cy + (H - cy) * 0.42, yTray = H - 90;
  parts.push(box("SH", "Fixed shelf", [Wi, t, D - t], [0, yShelf, t / 2]));
  parts.push(box("TS", "Fixed shelf", [Wi, t, D - t], [0, yTray - t / 2, t / 2]));
  parts.push(box("BK", "Back panel", [Wi, H - cy - t, t], [0, cy + t + (H - cy - t) / 2, -D / 2 + t / 2]));
  parts.push({ id: "TR", name: "Cable tray", size: [Wi - 4, 80, D - t - 4], pos: [0, yTray + 40, t / 2], mat: "metal", pieces: [{ shape: "box", size: [Wi - 4, 2, D - t - 4], pos: [0, -39, 0] }, { shape: "box", size: [2, 80, D - t - 4], pos: [-(Wi - 4) / 2 + 1, 0, 0] }, { shape: "box", size: [2, 80, D - t - 4], pos: [(Wi - 4) / 2 - 1, 0, 0] }] });
  const steps: St[] = [];
  const runner: HwDef = { kind: "runner", len: D - 80, dia: 40 };
  const yDr = yShelf + t / 2 + 10;
  const GROMMET: HwDef = { kind: "cap", len: 10, dia: 60 };
  const CASTOR_PLATE: HwDef = { kind: "plate", len: 50, dia: 50 };
  steps.push({
    title: "Screw the runners onto the side panels",
    detail: "Lay the sides on the rug, insides up. Three screws each.",
    kind: "runners",
    scene: "sides",
    pose: "+y",
    stage: [-1, 1].map((sx) => ({ id: `S${sx}`, pos: [sx * 300, 0, 0] as Vec3, rot: [0, 0, (-sx * Math.PI) / 2] as Vec3 })),
    fit: [-1, 1].flatMap((sx) => [fit(runner, [[sx * (Wi / 2), yDr, 0]], [0, 1, 0], { on: `S${sx}`, hole: false }), fit(RUNNER_SCREW, [-1, 0, 1].map((k) => [sx * (Wi / 2), yDr + 10, (k * (D - 140)) / 2] as Vec3), [sx, 0, 0], { on: `S${sx}` })]),
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Screw the cam bolts into the sides",
    detail: "Ten in all, by hand, for the bottom, the shelves and the back.",
    kind: "cams",
    scene: "sides",
    fit: [-1, 1].map((sx) =>
      fit(
        HW.camScrew,
        [
          [sx * (Wi / 2), cy + t / 2, -D / 4],
          [sx * (Wi / 2), cy + t / 2, D / 4],
          [sx * (Wi / 2), yShelf, 0],
          [sx * (Wi / 2), yTray - t / 2, 0],
          [sx * (Wi / 2), (cy + H) / 2, -D / 2 + t / 2],
        ],
        [-sx, 0, 0],
        { on: `S${sx}` },
      ),
    ),
    tools: ["screwdriver"],
  });
  const panelDowels = (id: string, y: number, z0: number): Fit => fit(HW.dowel, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (Wi / 2), y, z0 + sz * (D / 3)] as Vec3)).slice(0, 4), [1, 0, 0], { on: id });
  steps.push({
    title: "Tap the dowels into the panels",
    detail: "Into the ends of the bottom, the two shelves and the back.",
    kind: "dowels",
    scene: "panels",
    stage: ["BT", "SH", "TS", "BK"].map((id, k) => ({ id, pos: [(k - 1.5) * (Wi + 80), 0, 0] as Vec3, rot: [id === "BK" ? Math.PI / 2 : 0, 0, 0] as Vec3 })),
    fit: [panelDowels("BT", cy + t / 2, 0), panelDowels("SH", yShelf, t / 2), panelDowels("TS", yTray - t / 2, t / 2), fit(HW.dowel, [-1, 1].map((sx) => [sx * (Wi / 2), (cy + H) / 2, -D / 2 + t / 2] as Vec3), [1, 0, 0], { on: "BK" })],
    tools: ["hammer"],
  });
  steps.push({
    title: "Press the cable grommet into the back",
    detail: "Into the round hole near the top.",
    kind: "general",
    scene: "panels",
    fit: [fit(GROMMET, [[0, H - 140, -D / 2 + t]], [0, 0, -1], { on: "BK", hole: false })],
  });
  const castorAt: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (Wi / 2 - 40), cy, sz * (D / 2 - 50)] as Vec3));
  steps.push({
    title: "Screw the castor plates under the bottom",
    detail: "One in each corner, four screws each. Then click a castor into each plate: the two with brakes go at the front.",
    kind: "screws",
    scene: "panels",
    fit: [
      fit(CASTOR_PLATE, castorAt, [0, 1, 0], { on: "BT", hole: false }),
      fit({ kind: "screw", len: 16, dia: 4 }, castorAt.flatMap((p) => [-1, 1].flatMap((a) => [-1, 1].map((c2) => [p[0] + a * 16, cy, p[2] + c2 * 16] as Vec3))), [0, 1, 0], { on: "BT" }),
      fit(HW.castor, castorAt, [0, 1, 0], { on: "BT", hole: false }),
    ],
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Push the panels into one side",
    detail: "Lay the side on the rug. Bottom, shelves and back go onto its dowels and bolts; turn the cam locks.",
    kind: "cams",
    scene: "main",
    pose: "+x",
    add: ["S-1", "BT", "SH", "TS", "BK"],
    from: { "S-1": [-200, 0, 0], BT: [200, 0, 0], SH: [200, 0, 0], TS: [200, 0, 0], BK: [200, 0, 0] },
    fit: [fit(HW.cam, [[-Wi / 2 + 30, cy + t / 2, -D / 4], [-Wi / 2 + 30, cy + t / 2, D / 4], [-Wi / 2 + 30, yShelf, 0], [-Wi / 2 + 30, yTray - t / 2, 0], [-Wi / 2 + 30, (cy + H) / 2, -D / 2 + t / 2]], [0, 1, 0])],
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  steps.push({
    title: "Fit the other side",
    detail: "Lower it onto all the dowels and bolts, then turn the last five cam locks.",
    kind: "cams",
    add: ["S1"],
    from: [300, 0, 0],
    fit: [fit(HW.cam, [[Wi / 2 - 30, cy + t / 2, -D / 4], [Wi / 2 - 30, cy + t / 2, D / 4], [Wi / 2 - 30, yShelf, 0], [Wi / 2 - 30, yTray - t / 2, 0], [Wi / 2 - 30, (cy + H) / 2, -D / 2 + t / 2]], [0, 1, 0])],
    tools: ["screwdriver"],
  });
  steps.push({ title: "Stand it on its castors", detail: "Lock the front brakes while you finish.", kind: "standup", pose: "+y" });
  steps.push({ title: "Drop in the cable tray", detail: "It rests on the top shelf, its holes towards the back.", kind: "general", add: ["TR"], from: [0, 260, 0] });
  run(b, parts, steps);

  // the drawer
  const fh = yTray - t - yShelf - t / 2 - 10, bw = Wi - 30, dd = D - 60, sh = fh - 50;
  const y0 = yShelf + t / 2 + 4;
  const zf = D / 2 - t / 2;
  const zm = zf - t / 2 - dd / 2;
  const dp: Part[] = [
    box("F", "Drawer front", [Wi - 4, fh, t], [0, y0 + fh / 2, zf]),
    box("L", "Drawer side", [12, sh, dd], [-bw / 2 + 6, y0 + 12 + sh / 2, zm]),
    box("R", "Drawer side", [12, sh, dd], [bw / 2 - 6, y0 + 12 + sh / 2, zm]),
    box("B", "Drawer bottom", [bw - 12, 3, dd - 12], [0, y0 + 16, zm], "fiber"),
    box("K", "Drawer back", [bw - 24, sh - 12, 12], [0, y0 + 18 + (sh - 12) / 2, zf - t / 2 - dd + 6]),
  ];
  const c0 = dp[0].pos;
  const rel = (id: string): Vec3 => {
    const p = dp.find((q) => q.id === id)!;
    return [p.pos[0] - c0[0], p.pos[1] - c0[1], p.pos[2] - c0[2]];
  };
  const dsteps: St[] = [
    {
      title: "Tap the dowels and cam bolts into the drawer front",
      detail: "Lay it face down on the rug.",
      kind: "dowels",
      scene: "drawer",
      pose: "-z",
      stage: [{ id: "F", pos: rel("F") }],
      fit: [fit(HW.dowel, [-1, 1].flatMap((sx) => [-20, 20].map((dy) => [sx * (bw / 2 - 6), y0 + 12 + sh / 2 + dy, zf - t / 2] as Vec3)), [0, 0, 1], { on: "F" }), fit(HW.camScrew, [-1, 1].map((sx) => [sx * (bw / 2 - 6), y0 + 12 + sh / 2, zf - t / 2] as Vec3), [0, 0, 1], { on: "F" })],
      tools: ["hammer", "screwdriver"],
      warnings: ["floor", "face"],
    },
    { title: "Stand the sides on the front and lock them", detail: "Grooves in, at the bottom. Turn the cam locks.", kind: "cams", scene: "drawer", stage: ["L", "R"].map((id) => ({ id, pos: rel(id) })), fit: [fit(HW.cam, [-1, 1].map((sx) => [sx * (bw / 2 - 6), y0 + 12 + sh / 2, zf - t / 2 - 30] as Vec3), [1, 0, 0], { on: "L" })], tools: ["screwdriver"] },
    { title: "Slide in the bottom and fit the back", detail: "Bottom down the grooves, then the back with two dowels, locked with its cams.", kind: "cams", scene: "drawer", stage: [{ id: "B", pos: rel("B"), from: [0, 0, -300] }, { id: "K", pos: rel("K"), from: [0, 0, -200] }], fit: [fit(HW.dowel, [-1, 1].map((sx) => [sx * (bw / 2 - 12), y0 + 30, zf - t / 2 - dd + 6] as Vec3), [1, 0, 0], { on: "K" })], tools: ["hammer"] },
    { title: "Put in the drawer", detail: "Rest it on the runners and push until it clicks.", kind: "drawer", scene: "main", pose: "+y", add: ["F", "L", "R", "B", "K"], from: [0, 0, 400] },
  ];
  run(b, dp, dsteps);
}

function bedCfg(s: ProductSpec): BedCfg | null {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  switch (s.slug) {
    case "tonstad-bed-frame-standard-single-90-x-190":
    case "tonstad-bed-frame-twin-97-x-191":
      return { W, D, H, slats: false, storage: false, beamLegs: 0 };
    case "tonstad-bed-frame-storage-standard-single-90-x-1":
      return { W, D, H, slats: false, storage: true, beamLegs: 0 };
    case "tonstad-bed-frame-standard-double-135-x-190":
      return { W, D, H, slats: true, storage: false, beamLegs: 1 };
    case "tonstad-bed-frame-storage-standard-king-150-x-20":
      return { W, D, H, slats: true, storage: true, beamLegs: 1, drawers4: true };
  }
  return null;
}

/* ---------- which case is which ---------- */

const SLIDING_WHITE = { plinth: WHITE_PLINTH, backs: 1, backScrews: 3, backClips: 8, shelves: 2, wall: "drum" as const, stops: 2 };
const SLIDING_OAK = { plinth: OAK_PLINTH, backs: 1, backScrews: 3, backClips: 8, shelves: 2, wall: "drum" as const, stops: 2, bracketsLate: true };

function caseCfg(s: ProductSpec): CaseCfg | null {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const base = { W, H, D };
  const mid = (PH + H) / 2;
  switch (slug) {
    case "tonstad-bookcase-81-x-37-x-201":
      return { ...base, feet: 4, fixed: [H / 2 + 50], backs: 2, backConnectors: 3, backClips: 16, shelves: 3, wall: "drum", shelfFirst: true };
    case "tonstad-bookcase-82-x-37-x-201":
      return { ...base, plinth: OAK_PLINTH, fixed: [H / 2 + 50], backs: 1, backScrews: 6, backClips: 10, shelves: 3, wall: "drum", bracketsLate: true, shelfFirst: true };
    case "tonstad-cabinet-doors-81-x-47-x-91":
      return { ...base, feet: 4, fixed: [mid], backs: 2, rail: 4, backClips: 0, shelves: 2, wall: "angle", doors: { kind: "hinged", n: 2 } };
    case "tonstad-cabinet-doors-82-x-47-x-90":
      return { ...base, plinth: OAK_PLINTH, fixed: [mid], backs: 1, backScrews: 3, backClips: 0, shelves: 2, wall: "angle", doors: { kind: "hinged", n: 2 } };
    case "tonstad-cabinet-sliding-doors-81-x-37-x-116":
      return { ...base, ...SLIDING_WHITE, fixed: [mid], doors: { kind: "sliding", n: 2 } };
    case "tonstad-cabinet-sliding-glass-doors-81-x-37-x-11":
      return { ...base, ...SLIDING_WHITE, fixed: [mid], doors: { kind: "sliding", n: 2, glass: true } };
    case "tonstad-cabinet-sliding-doors-82-x-37-x-120":
      return { ...base, ...SLIDING_OAK, fixed: [mid], doors: { kind: "sliding", n: 2, handles: true } };
    case "tonstad-cabinet-sliding-glass-doors-82-x-37-x-12":
      return { ...base, ...SLIDING_OAK, fixed: [mid], doors: { kind: "sliding", n: 2, glass: true, handles: true } };
    case "tonstad-cabinet-sliding-glass-doors-120-x-37-x-1":
      return { ...base, ...SLIDING_WHITE, dividers: 1, backs: 2, backSplit: "v", backScrews: 3, backClips: 12, shelves: 4, doors: { kind: "sliding", n: 2, glass: true } };
    case "tonstad-cabinet-sliding-glass-doors-121-x-37-x-1":
      return { ...base, ...SLIDING_OAK, dividers: 1, backs: 2, backSplit: "v", backScrews: 3, backClips: 12, shelves: 4, doors: { kind: "sliding", n: 2, glass: true, handles: true } };
    case "tonstad-shelving-unit-120-x-37-x-116":
      return { ...base, plinth: WHITE_PLINTH, dividers: 1, backs: 1, backScrews: 6, backClips: 14, shelves: 4, wall: "drum" };
    case "tonstad-shelving-unit-121-x-37-x-120":
      return { ...base, plinth: OAK_PLINTH, dividers: 1, backs: 1, backScrews: 6, backClips: 14, shelves: 4, wall: "drum", bracketsLate: true };
    case "tonstad-tv-bench-177-x-37-x-56":
      return { ...base, feet: 5, dividers: 3, backs: 1, backScrews: 6, backClips: 12, bottomOn: { dowels: 8, screws: 5 }, shelves: 4, wall: "drum", doors: { kind: "sliding", n: 2 } };
    case "tonstad-tv-bench-178-x-37-x-55":
      return { ...base, plinth: { ...OAK_PLINTH, dowels: 8, plates: 4, feet: 5, glides: 1 }, dividers: 3, backs: 1, backScrews: 9, backClips: 5, topScrews: 6, shelves: 4, wall: "drum", bracketsLate: true, doors: { kind: "sliding", n: 2, handles: true } };
    case "tonstad-sideboard-120-x-47-x-91":
      return { ...base, feet: 5, dividers: 1, backs: 2, backSplit: "v", rail: 8, backClips: 0, shelves: 2, wall: "angle", doors: { kind: "hinged", n: 2 }, drawers: { rows: 1, cols: 2, frontH: 150, at: "top" } };
    case "tonstad-sideboard-121-x-47-x-90":
      return { ...base, plinth: { ...OAK_PLINTH, feet: 5, glides: 1 }, dividers: 1, backs: 2, backSplit: "v", topScrews: 4, backClips: 0, shelves: 2, wall: "angle", doors: { kind: "hinged", n: 2 }, drawers: { rows: 1, cols: 2, frontH: 150, at: "top" } };
    case "tonstad-chest-4-drawers-82-x-47-x-91":
      return { ...base, feet: 4, backs: 2, rail: 4, backClips: 0, shelves: 0, wall: "angle", drawers: { rows: 4, cols: 1, at: "all" } };
    case "tonstad-chest-4-drawers-82-x-47-x-90":
      return { ...base, plinth: OAK_PLINTH, backs: 2, backClips: 8, shelves: 0, wall: "angle", drawers: { rows: 4, cols: 1, at: "all" } };
    case "tonstad-chest-6-drawers-120-x-47-x-91":
      return { ...base, feet: 5, dividers: 1, backs: 2, backSplit: "v", rail: 6, backClips: 0, shelves: 0, wall: "angle", drawers: { rows: 3, cols: 2, at: "all" } };
    case "tonstad-chest-6-drawers-120-x-47-x-90":
      return { ...base, plinth: { ...OAK_PLINTH, feet: 5, glides: 1 }, dividers: 1, backs: 2, backSplit: "v", backClips: 8, topScrews: 3, shelves: 0, wall: "angle", drawers: { rows: 3, cols: 2, at: "all" } };
  }
  return null;
}

function tableCfg(s: ProductSpec): TableCfg | null {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  switch (s.slug) {
    case "tonstad-table-150-x-80":
      return { W, D, H, dowels: 8, screws: 14 };
    case "tonstad-table-200-x-85":
      return { W, D, H, dowels: 14, screws: 16, midRail: true };
    case "tonstad-extendable-table-80-120-x-70":
      return { W, D, H, dowels: 24, screws: 14, leaf: 400 };
    case "tonstad-extendable-table-140-196-x-85":
      return { W, D, H, dowels: 22, screws: 16, leaf: 560 };
    case "tonstad-desk-75-x-60":
    case "tonstad-desk-120-x-47":
    case "tonstad-desk-140-x-75":
      return { W, D, H, dowels: 16, screws: 20, drawer: Math.min(560, W * 0.45) };
  }
  return null;
}

function legCfg(s: ProductSpec): LegCfg | null {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  switch (s.slug) {
    case "tonstad-bedside-table-40-x-40-x-59":
      return { W, D, H, shelfY: 120, drawers: 1 };
    case "tonstad-side-table-64-x-40":
      return { W, D, H, shelfY: 110, drawers: 1 };
    case "tonstad-coffee-table-84-x-82":
      return { W, D, H, shelfY: 70, drawers: 2 };
  }
  return null;
}

const family: Family = {
  names: ["TONSTAD"],
  build(b, s) {
    const c = caseCfg(s);
    if (c) {
      caseBuild(b, c);
      return true;
    }
    const t = tableCfg(s);
    if (t) {
      tableBuild(b, t);
      return true;
    }
    const l = legCfg(s);
    if (l) {
      legTableBuild(b, l);
      return true;
    }
    const bed = bedCfg(s);
    if (bed) {
      bedBuild(b, bed);
      return true;
    }
    if (s.slug === "tonstad-chair") {
      chairBuild(b, s);
      return true;
    }
    if (s.slug === "tonstad-drawer-unit-on-castors-35-x-60") {
      drawerUnitBuild(b, s);
      return true;
    }
    return false;
  },
};
export default family;
