import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartMaterial, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * KRONÖREN, read from its manuals. Solid pine sticks held by Allen-head wood screws, no cam locks. Each side frame is
 * built flat on a rug: feet into the legs, dowels in the legs' notches, rails screwed across the legs on both faces
 * (hand-tight, then all tightened). A back board on dowels and long screws joins the two frames, the top and the
 * shelf screw down onto the rails, and the drawers are built standing on their backs and slid in.
 * The bedside table has its drawer over an open shelf.
 */

const r = (n: number) => Math.round(n * 10) / 10;
const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({
  kind,
  count: at.length,
  on,
  dir,
  at: at.map((p) => p.map(r) as Vec3),
  ...o,
});
const SCREW: Partial<CustomFix> = { len: 40, dia: 6 };
const LONG: Partial<CustomFix> = { len: 90, dia: 6 };
const FOOT: Partial<CustomFix> = { len: 8, dia: 22, name: "Foot" };
const SCREW_HW: HwDef = { kind: "screw", len: 40, dia: 6 };
const DOWEL_HW: HwDef = { kind: "dowel", len: 30, dia: 8 };

/* ---------- parts built off to one side (a drawer, a box), then pushed in ---------- */

interface SubPart {
  id: string;
  name: string;
  size: Vec3;
  pos: Vec3;
  material?: PartMaterial;
}
interface SubFix {
  def: HwDef;
  on: string;
  at: Vec3[];
  dir: Vec3;
  mate?: string;
  hole?: false;
}
interface SubStep {
  title: string;
  detail?: string;
  kind: StepKind;
  tools?: ToolId[];
  warnings?: WarnId[];
  stage?: Record<string, [Vec3, Vec3]>; // part -> [offset from its spot, arrival offset]
  fix?: SubFix[];
}

function placeAll(b: PlanBuilder, parts: SubPart[]) {
  const types = new Map<string, string>();
  const keys: Record<string, string> = {};
  for (const p of parts) {
    const tk = `${p.name}|${p.size.map(Math.round).join("x")}`;
    let ref = types.get(tk);
    if (!ref) {
      ref = b.part(p.name, p.size, { material: p.material ?? "wood" });
      types.set(tk, ref);
    }
    keys[p.id] = b.place(ref, p.pos);
  }
  return keys;
}

function subSteps(b: PlanBuilder, scene: string, pose: Pose, parts: SubPart[], keys: Record<string, string>, steps: SubStep[]) {
  const lo = [0, 1, 2].map((k) => Math.min(...parts.map((p) => p.pos[k] - p.size[k] / 2)));
  const hi = [0, 1, 2].map((k) => Math.max(...parts.map((p) => p.pos[k] + p.size[k] / 2)));
  const c0 = lo.map((v, k) => (v + hi[k]) / 2);
  for (const st of steps) {
    b.step({ title: st.title, detail: st.detail, kind: st.kind, tools: st.tools ?? [], warnings: st.warnings ?? [], scene, pose }, () => {
      if (st.stage) {
        b.stagger(0.25);
        for (const [id, [off, from]] of Object.entries(st.stage)) {
          const it = b.partItem(keys[id]);
          b.stage(keys[id], [0, 1, 2].map((k) => it.final.pos[k] - c0[k] + off[k]) as Vec3, it.final.rot, from);
        }
        b.then(0.15);
      }
      for (const f of st.fix ?? []) {
        const list: FitOpts[] = f.at.map((at) => ({ on: keys[f.on], at: at.map(r) as Vec3, dir: f.dir, mate: f.mate ? keys[f.mate] : undefined, hole: f.hole }));
        b.fits(f.def, list, 0.08);
        b.then(0.1);
      }
    });
  }
}

function pushIn(b: PlanBuilder, keys: Record<string, string>, title: string, detail: string) {
  b.step({ title, detail, kind: "drawer", pose: "+y", tools: [] }, () => {
    b.stagger(0);
    for (const k of Object.values(keys)) b.add(k, [0, 0, 480]);
  });
}


/** One side frame: two legs, rails on its faces. `rails` gives each rail: id, name, x centre, y centre, size. */
interface Rail {
  id: string;
  name: string;
  x: number;
  y: number;
  size: Vec3;
}

function bedside(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 18, L = 32;
  const yU = H - TT;
  const xl = W / 2 - 40, zl = D / 2 - 35;
  const xo = xl + L / 2 + 10; // outer rails
  const xn = xl - L / 2 - 10; // inner rails
  const yD = 330, yS = 130, yT = yU - 20, yB = 290;
  const rl = D - 20;
  const parts: CustomPart[] = [];
  const legId = (sx: number, sz: number) => `${sx < 0 ? "L" : "R"}${sz > 0 ? "F" : "B"}`;
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const rails = (sx: number): Rail[] => [
    { id: `${side(sx)}D`, name: "Drawer rail", x: sx * xn, y: yD, size: [20, 30, rl] },
    { id: `${side(sx)}T`, name: "Top rail", x: sx * xo, y: yT, size: [20, 40, rl] },
    { id: `${side(sx)}S`, name: "Shelf rail", x: sx * xo, y: yS, size: [20, 40, rl] },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push({ id: legId(sx, sz), name: "Leg", size: [L, yU, L], pos: [sx * xl, yU / 2, sz * zl], material: "wood" });
    for (const rr of rails(sx)) parts.push({ id: rr.id, name: rr.name, size: rr.size, pos: [rr.x, rr.y, 0], material: "wood" });
  }
  const iw = 2 * (xl - L / 2);
  parts.push(
    { id: "BB", name: "Back rail", size: [iw, 60, 18], pos: [0, yB, -zl], material: "wood" },
    { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    { id: "S", name: "Shelf", size: [2 * (xo + 10), 18, rl], pos: [0, yS + 20 + 9, 0], material: "wood" },
  );
  const frameFits = (sx: number) => {
    const [rd, rt, rs] = rails(sx);
    const legs = [-1, 1].map((sz) => legId(sx, sz));
    return {
      feet: legs.map((id, i) => fx("glide", id, [0, 1, 0], [[sx * xl, 0, (i ? 1 : -1) * zl]], FOOT)),
      legDowels: legs.map((id, i) => fx("dowel", id, [sx, 0, 0], [-12, 12].map((dz) => [sx * (xl - L / 2), yD, (i ? 1 : -1) * zl + dz] as Vec3), { mate: rd.id })),
      railDowels: [fx("dowel", rd.id, [-sx, 0, 0], [[sx * (xn - 10), yD, -40]]), fx("dowel", rs.id, [0, -1, 0], [[sx * xo, yS + 20, 0]], { mate: "S" })],
      drawerScrews: fx("screw", rd.id, [sx, 0, 0], [-1, 1].map((sz) => [sx * (xn - 10), yD + 10, sz * zl] as Vec3), SCREW),
      topScrews: fx("screw", rt.id, [-sx, 0, 0], [-1, 1].map((sz) => [sx * (xo + 10), yT, sz * zl] as Vec3), SCREW),
      shelfScrews: fx("screw", rs.id, [-sx, 0, 0], [-1, 1].map((sz) => [sx * (xo + 10), yS, sz * zl] as Vec3), SCREW),
      long: fx("screw", legId(sx, -1), [-sx, 0, 0], [[sx * (xl + L / 2), yB, -zl]], { ...LONG, mate: "BB" }),
      all: [...legs, rd.id, rt.id, rs.id],
    };
  };
  const fl = frameFits(-1), fr = frameFits(1);
  const steps: CustomStep[] = [
    { title: "Tap the feet into the legs", detail: "Lay the two legs for one side on a rug and push a foot into the bottom end of each.", add: [fl.all[0], fl.all[1]], fix: fl.feet, pose: "+x", warnings: ["floor"], repeat: 2 },
    { title: "Tap dowels into the notches in the legs", detail: "Two in the notch of each leg, all on the same side.", fix: fl.legDowels, tools: ["hammer"], repeat: 2 },
    { title: "Tap a dowel into each drawer rail", detail: "Into the hole in the middle of its face.", fix: [fl.railDowels[0]], tools: ["hammer"], repeat: 2 },
    {
      title: "Screw the drawer rails across the legs",
      detail: "One rail across each pair of legs, onto the dowels, dowel facing in. Screw them in by hand only for now.",
      add: [fl.all[2]],
      fix: [fl.drawerScrews],
      tools: ["allen"],
      repeat: 2,
    },
    { title: "Turn the frames over and screw on the top rails", detail: "Across the top ends of the legs. Check both frames match before you screw. Hand-tight for now.", add: [fl.all[3]], fix: [fl.topScrews], tools: ["allen"], pose: "-x", repeat: 2 },
    { title: "Tap a dowel into each shelf rail", detail: "Into the hole in its top edge.", fix: [fl.railDowels[1]], tools: ["hammer"], repeat: 2 },
    { title: "Screw on the shelf rails", detail: "Across the bottom ends of the legs, dowel up. Hand-tight for now.", add: [fl.all[4]], fix: [fl.shelfScrews], tools: ["allen"], repeat: 2 },
    { title: "Tighten all the screws", detail: "Twelve in all on the two frames. Turn each one in firmly with the Allen key.", tools: ["allen"], check: "square" },
    {
      title: "Tap dowels into the back rail",
      detail: "Two in each end. Turn the first frame back over, inside up.",
      pose: "+x",
      fix: [-1, 1].map((sx) => fx("dowel", "BB", [sx, 0, 0], [-15, 15].map((dy) => [sx * (iw / 2), yB + dy, -zl] as Vec3), { mate: legId(sx, -1) })),
      tools: ["hammer"],
    },
    { title: "Fix the back rail to one frame", detail: "Lay the frame inside up and push the rail onto its back leg. One long screw through the leg into it.", add: ["BB"], fix: [fl.long], pose: "+x", tools: ["allen"] },
    {
      title: "Lay the other frame on and screw it",
      detail: "The second frame is built the same way. Lower it onto the rail, inside down, and drive the other long screw through its back leg.",
      add: fr.all,
      fix: [...fr.feet, ...fr.legDowels, ...fr.railDowels, fr.drawerScrews, fr.topScrews, fr.shelfScrews, fr.long],
      tools: ["allen", "hammer"],
      from: Object.fromEntries(fr.all.map((id) => [id, [300, 0, 0] as Vec3])),
    },
    {
      title: "Stand it up and screw on the top",
      detail: "Four screws down through the top into the top rails.",
      add: ["T"],
      fix: [-1, 1].map((sx) => fx("screw", "T", [0, -1, 0], [-1, 1].map((sz) => [sx * xo, H, sz * (zl - 40)] as Vec3), { ...SCREW, mate: `${side(sx)}T` })),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Screw on the shelf",
      detail: "It drops in around the legs onto the shelf rails. Four screws down into the rails.",
      add: ["S"],
      fix: [-1, 1].map((sx) => fx("screw", "S", [0, -1, 0], [-1, 1].map((sz) => [sx * xo, yS + 38, sz * (zl - 40)] as Vec3), { ...SCREW, mate: `${side(sx)}S` })),
      tools: ["allen"],
    },
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });

  // the drawer, built standing on its back
  const xd = xl - L / 2 - 11; // drawer side centres
  const yd = 418, dh = 140;
  const zf = zl + L / 2 - 20; // front centre, set back a little from the legs
  const sl = zf + 9 + zl + L / 2;
  const zs = zf + 9 - sl / 2;
  const zbk = zf + 9 - sl + 9;
  const bw = 2 * (xd - 9);
  const dk = drawerIn(b, {
    front: { size: [bw, dh, 18], pos: [0, yd, zf] },
    side: { size: [18, dh, sl], x: xd, z: zs },
    back: { size: [bw, dh, 18], z: zbk },
    bottom: { size: [bw, 4, zf - zbk - 18], y: yd - dh / 2 + 12, z: (zf + zbk) / 2 },
    y: yd,
  });
  pushIn(b, dk, "Slide the drawer in", "Its sides run on the drawer rails. Push it in until the front sits flush.");
  return true;
}

interface DrawerGeo {
  front: { size: Vec3; pos: Vec3 };
  side: { size: Vec3; x: number; z: number };
  back: { size: Vec3; z: number };
  bottom: { size: Vec3; y: number; z: number };
  y: number;
}

/** A drawer from the manual: a dowel in each side, the sides screwed to the back standing up, the bottom down the grooves, the front screwed on top. */
function drawerIn(b: PlanBuilder, g: DrawerGeo, o: { n?: number; scene?: string } = {}) {
  const { front, side, back, bottom, y } = g;
  const xs = side.x, t = side.size[0];
  const zf = front.pos[2];
  const parts: SubPart[] = [
    { id: "F", name: "Drawer front", size: front.size, pos: front.pos },
    { id: "SL", name: "Drawer side", size: side.size, pos: [-xs, y, side.z] },
    { id: "SR", name: "Drawer side", size: side.size, pos: [xs, y, side.z] },
    { id: "B", name: "Drawer back", size: back.size, pos: [0, y, back.z] },
    { id: "BT", name: "Drawer bottom", size: bottom.size, pos: [0, bottom.y, bottom.z], material: "fiber" },
  ];
  const k = placeAll(b, parts);
  const sds = [-1, 1] as const;
  const sid = (sx: number) => (sx < 0 ? "SL" : "SR");
  const ys = [y - side.size[1] / 4, y + side.size[1] / 4];
  const n = o.n ?? 1;
  const word = n > 1 ? "each drawer" : "the drawer";
  subSteps(b, o.scene ?? "drawer", "+z", parts, k, [
    {
      title: n > 1 ? "Tap a dowel into each drawer side" : "Tap a dowel into each drawer side",
      detail: `Into the outside face, near the back. It stops ${word} coming out too far.`,
      kind: "dowels",
      tools: ["hammer"],
      stage: { SL: [[-200, 0, 0], [0, 160, 0]], SR: [[200, 0, 0], [0, 160, 0]] },
      fix: sds.map((sx) => ({ def: DOWEL_HW, on: sid(sx), at: [[sx * (xs + t / 2), y, side.z - side.size[2] / 2 + 40]] as Vec3[], dir: [-sx, 0, 0] as Vec3 })),
    },
    {
      title: "Screw the sides to the back",
      detail: "Stand the sides up with the back between them at the bottom, grooves facing in. Two screws through each side.",
      kind: "screws",
      tools: ["allen"],
      stage: { B: [[0, 0, 0], [0, 0, 200]], SL: [[0, 0, 0], [-200, 0, 0]], SR: [[0, 0, 0], [200, 0, 0]] },
      fix: sds.map((sx) => ({ def: SCREW_HW, on: sid(sx), at: ys.map((yy) => [sx * (xs + t / 2), yy, back.z] as Vec3), dir: [-sx, 0, 0] as Vec3, mate: "B" })),
    },
    { title: "Slide the bottom down the grooves", detail: "Smooth side in, until it rests on the back.", kind: "drawer", stage: { BT: [[0, 0, 0], [0, 0, 420]] } },
    {
      title: "Screw on the front",
      detail: "Push it down between the top ends of the sides, over the bottom. Two screws through each side into it.",
      kind: "screws",
      tools: ["allen"],
      stage: { F: [[0, 0, 0], [0, 0, 300]] },
      fix: sds.map((sx) => ({ def: SCREW_HW, on: sid(sx), at: ys.map((yy) => [sx * (xs + t / 2), yy, zf] as Vec3), dir: [-sx, 0, 0] as Vec3, mate: "F" })),
    },
  ]);
  return k;
}

function chest(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 18, L = 40;
  const yU = H - TT;
  const xl = W / 2 - 45, zl = D / 2 - 35;
  const xo = xl + L / 2 + 10, xn = xl - L / 2 - 10;
  const yLo = 70, yMid = 300, yT = yU - 20;
  const rl = D - 20;
  const parts: CustomPart[] = [];
  const legId = (sx: number, sz: number) => `${sx < 0 ? "L" : "R"}${sz > 0 ? "F" : "B"}`;
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const rails = (sx: number): Rail[] => [
    { id: `${side(sx)}T`, name: "Top rail", x: sx * xo, y: yT, size: [20, 40, rl] },
    { id: `${side(sx)}M`, name: "Drawer rail", x: sx * xn, y: yMid, size: [20, 40, rl] },
    { id: `${side(sx)}O`, name: "Drawer rail", x: sx * xn, y: yLo, size: [20, 40, rl] },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push({ id: legId(sx, sz), name: "Leg", size: [L, yU, L], pos: [sx * xl, yU / 2, sz * zl], material: "wood" });
    for (const rr of rails(sx)) parts.push({ id: rr.id, name: rr.name, size: rr.size, pos: [rr.x, rr.y, 0], material: "wood" });
  }
  const iw = 2 * (xl - L / 2);
  parts.push({ id: "BB", name: "Back rail", size: [iw, 40, 18], pos: [0, yMid, -zl], material: "wood" });
  const topPart: CustomPart = { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" };
  const ANGLE: Partial<CustomFix> = { len: 40, dia: 30, name: "Angle bracket" };
  const SMALL: Partial<CustomFix> = { len: 12, dia: 4 };
  const frame = (sx: number) => {
    const [rt, rm, ro] = rails(sx);
    const legs = [-1, 1].map((sz) => legId(sx, sz));
    const z = (i: number) => (i ? 1 : -1) * zl;
    return {
      legs,
      feet: legs.map((id, i) => fx("glide", id, [0, 1, 0], [[sx * xl, 0, z(i)]], FOOT)),
      legDowels: legs.map((id, i) => fx("dowel", id, [sx, 0, 0], [-12, 12].map((dz) => [sx * (xl - L / 2), yLo, z(i) + dz] as Vec3), { mate: ro.id })),
      angles: legs.map((id, i) => fx("angle", id, [sx, 0, 0], [[sx * (xl - L / 2), yU - 20, z(i) - (i ? 30 : -30)]], ANGLE)),
      angleScrews: legs.map((id, i) => fx("screw", id, [sx, 0, 0], [[sx * (xl - L / 2), yU - 30, z(i) - (i ? 30 : -30)]], SMALL)),
      railDowels: [fx("dowel", rm.id, [0, -1, 0], [-1, 1].map((sz) => [sx * xn, yMid - 20, sz * (zl - 60)] as Vec3)), fx("dowel", ro.id, [0, -1, 0], [-1, 1].map((sz) => [sx * xn, yLo - 20, sz * (zl - 60)] as Vec3))],
      topScrews: fx("screw", rt.id, [-sx, 0, 0], [-1, 1].map((sz) => [sx * (xo + 10), yT, sz * zl] as Vec3), SCREW),
      drawerScrews: [rm, ro].map((rr) => fx("screw", rr.id, [sx, 0, 0], [-1, 1].map((sz) => [sx * (xn - 10), rr.y, sz * zl] as Vec3), SCREW)),
      rails: [rt.id, rm.id, ro.id],
    };
  };
  const fl = frame(-1), fr = frame(1);
  const steps: CustomStep[] = [
    { title: "Tap the feet into the legs", detail: "Lay the two legs for one side on a rug and push a foot into the bottom end of each.", add: fl.legs, fix: fl.feet, pose: "+x", warnings: ["floor"], repeat: 2 },
    { title: "Tap dowels into the legs", detail: "Two in the notch near the bottom of each leg.", fix: fl.legDowels, tools: ["hammer"], repeat: 2 },
    { title: "Screw an angle bracket onto each leg", detail: "Near the top end, on the same face as the dowels. One small screw each.", fix: [...fl.angles, ...fl.angleScrews], tools: ["screwdriver"], repeat: 2 },
    { title: "Turn the legs over", detail: "Brackets down, so the other face of each pair is up.", pose: "-x" },
    { title: "Tap dowels into the drawer rails", detail: "Two in the bottom edge of each.", fix: fl.railDowels, tools: ["hammer"], repeat: 2 },
    { title: "Screw on the top rails", detail: "Across the top ends of the legs. By hand only for now.", add: [fl.rails[0]], fix: [fl.topScrews], tools: ["allen"], repeat: 2 },
    { title: "Screw on the drawer rails", detail: "One across the bottom, one across the middle, on the dowels. By hand only for now.", add: fl.rails.slice(1), fix: fl.drawerScrews, tools: ["allen"], repeat: 2 },
    { title: "Tighten all the screws", detail: "Twelve in all on the two frames. Check each frame is square, then turn them in firmly.", tools: ["allen"], check: "square" },
    {
      title: "Tap dowels into the back rail",
      detail: "Two in each end.",
      fix: [-1, 1].map((sx) => fx("dowel", "BB", [sx, 0, 0], [-10, 10].map((dy) => [sx * (iw / 2), yMid + dy, -zl] as Vec3), { mate: legId(sx, -1) })),
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Screw the back rail to one frame",
      detail: "Stand the frame up and push the rail onto its back leg. Two long screws through the leg into it.",
      add: ["BB"],
      fix: [fx("screw", legId(-1, -1), [1, 0, 0], [-12, 12].map((dy) => [-(xl + L / 2), yMid + dy, -zl] as Vec3), { ...LONG, mate: "BB" })],
      tools: ["allen"],
    },
    {
      title: "Fit the other frame",
      detail: "Built the same way. Push it onto the back rail and screw it on with four screws through its back leg.",
      add: [...fr.legs, ...fr.rails],
      fix: merge([
        ...fr.feet,
        ...fr.legDowels,
        ...fr.angles,
        ...fr.angleScrews,
        ...fr.railDowels,
        fr.topScrews,
        ...fr.drawerScrews,
        fx("screw", legId(1, -1), [-1, 0, 0], [-1, 1].flatMap((dz) => [-10, 10].map((dy) => [xl + L / 2, yMid + dy, -zl + dz * 6] as Vec3)), SCREW),
      ]),
      tools: ["allen", "hammer"],
      from: Object.fromEntries([...fr.legs, ...fr.rails].map((id) => [id, [300, 0, 0] as Vec3])),
    },
  ];
  const top: CustomStep[] = [
    {
      title: "Screw two angle brackets under the top",
      detail: "Lay the top face down. One bracket near the middle of each long edge, a small screw in each.",
      add: ["T"],
      fix: [fx("angle", "T", [0, 1, 0], [-1, 1].map((sz) => [0, yU, sz * (zl - 20)] as Vec3), ANGLE), fx("screw", "T", [0, 1, 0], [-1, 1].map((sz) => [0, yU, sz * (zl - 30)] as Vec3), SMALL)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the top onto the frame",
      detail: "Six screws down through the top into the top rails, three on each side.",
      fix: [-1, 1].map((sx) => fx("screw", "T", [0, -1, 0], [-1, 0, 1].map((f) => [sx * xo, H, f * (zl - 40)] as Vec3), { ...SCREW, mate: `${side(sx)}T` })),
      tools: ["allen"],
    },
    {
      title: "Screw two more brackets to the back rail",
      detail: "Lay it on its front. Two brackets inside the back rail, a small screw each.",
      fix: [fx("angle", "BB", [0, 0, 1], [-1, 1].map((sx) => [sx * iw * 0.25, yMid, -zl + 9] as Vec3), ANGLE), fx("screw", "BB", [0, 0, -1], [-1, 1].map((sx) => [sx * iw * 0.25, yMid, -zl + 9] as Vec3), SMALL)],
      pose: "-z",
      tools: ["screwdriver"],
    },
    {
      title: "Screw the leg brackets up into the top",
      detail: "Turn it upside down. One small screw through each leg bracket into the top.",
      fix: [-1, 1].map((sx) => fx("screw", "T", [0, 1, 0], [-1, 1].map((sz) => [sx * (xl - L / 2 - 15), yU, sz * (zl - 30)] as Vec3), SMALL)),
      pose: "-y",
      tools: ["screwdriver"],
    },
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });

  // two drawers, built standing on their fronts; the lower one is the same
  const xd = xn;
  const dh = 185;
  const zf = zl + L / 2 - 20 - 9;
  const sl = zf + 9 + zl + L / 2;
  const bw = 2 * (xd - 9);
  const ys = [yLo + 20 + dh / 2 + 2, yMid + 20 + dh / 2 + 2];
  const dk = ys.map((y) => chestDrawer(b, { y, h: dh, xs: xd, zf, sl, bw }));
  subSteps(b, "drawer", "-z", dk[1].parts, dk[1].keys, dk[1].steps.map((st) => ({ ...st, title: st.title, detail: st.detail })));
  b.step({ title: "Slide the drawers in", detail: "Build the second drawer the same way. Each runs on its pair of rails; push them in until the fronts sit flush.", kind: "drawer", pose: "+y", tools: [] }, () => {
    b.stagger(0);
    for (const k of Object.values(dk[1].keys)) b.add(k, [0, 0, 520]);
    b.wait(0.3);
    for (const k of Object.values(dk[0].keys)) b.add(k, [0, 0, 520]);
    for (const [def, list] of dk[0].fits) for (const o of list) b.preset(def, o);
  });

  // the top, then the wall
  const wx = W / 2 - 140, zW = -D / 2;
  top.push(
    {
      title: "Screw the wall brackets under the top",
      detail: "At the back, near each end: a small screw and a washer each, loose for now so they can slide.",
      fix: [
        fx("bracket", "T", [0, 1, 0], [-1, 1].map((sx) => [sx * wx, yU, zW + 30] as Vec3), { len: 60, dia: 24, name: "Wall bracket", included: true }),
        fx("washer", "T", [0, 1, 0], [-1, 1].map((sx) => [sx * wx, yU - 2, zW + 40] as Vec3)),
        fx("screw", "T", [0, 1, 0], [-1, 1].map((sx) => [sx * wx, yU - 3, zW + 40] as Vec3), { len: 12, dia: 4 }),
      ],
      pose: "+y",
      tools: ["screwdriver"],
    },
    {
      title: "Fix it to the wall",
      detail: "Push it against the wall, mark through the brackets and drill. A washer on each wall screw, then tighten the bracket screws. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: [-1, 1].map((sx) => [sx * wx, yU - 40, zW - 20] as Vec3), dir: [0, 0, -1] },
        { kind: "washer", count: 2, at: [-1, 1].map((sx) => [sx * wx, yU - 40, zW + 4] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: [-1, 1].map((sx) => [sx * wx, yU - 40, zW + 6] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  );
  buildCustom(b, { ...s, custom: { parts: [topPart], steps: top } });
  return true;
}

function wardrobe(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const L = 36;
  const xl = W / 2 - 30, zl = D / 2 - 30;
  const xn = xl - L / 2 - 10; // inner rails
  const xi = xl - L / 2; // legs' inner faces
  const yBand = 1150, yRail = [H - 30, 430, 240];
  const parts: CustomPart[] = [];
  const legId = (sx: number, sz: number) => `${sx < 0 ? "L" : "R"}${sz > 0 ? "F" : "B"}`;
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push({ id: legId(sx, sz), name: "Leg", size: [L, H, L], pos: [sx * xl, H / 2, sz * zl], material: "wood" });
    parts.push({ id: `${side(sx)}N`, name: "Side board", size: [18, 120, 2 * zl - L], pos: [sx * xl, yBand, 0], material: "wood" });
    yRail.forEach((y, i) => parts.push({ id: `${side(sx)}R${i}`, name: "Rail", size: [20, 30, D - 20], pos: [sx * xn, y, 0], material: "wood" }));
  }
  const tw = 2 * xi;
  parts.push(
    ...[-1, 1].map((sz) => ({ id: sz > 0 ? "TF" : "TB", name: "Top board", size: [tw, 18, 100] as Vec3, pos: [0, H - 9, sz * (zl - 50 + L / 2)] as Vec3, material: "wood" as const })),
    { id: "FB", name: "Front board", size: [tw, 120, 18], pos: [0, yBand, zl], material: "wood" },
    { id: "CR", name: "Clothes rail", size: [W + 40, 30, 30], pos: [0, H - 30 - 15 - 15, 0], shape: "cyl", material: "wood" },
    { id: "S0", name: "Shelf", size: [2 * (xn + 10), 18, D - 20], pos: [0, yRail[1] + 15 + 9, 0], material: "wood" },
    { id: "S1", name: "Shelf", size: [2 * (xn + 10), 18, D - 20], pos: [0, yRail[2] + 15 + 9, 0], material: "wood" },
  );
  const ld = (sz: number) => sz * zl;
  const frame = (sx: number) => {
    const legs = [-1, 1].map((sz) => legId(sx, sz));
    const band = `${side(sx)}N`;
    const rails = yRail.map((_, i) => `${side(sx)}R${i}`);
    return {
      legs,
      band,
      rails,
      feet: legs.map((id, i) => fx("glide", id, [0, 1, 0], [[sx * xl, 0, ld(i ? 1 : -1)]], FOOT)),
      bandDowels: [-1, 1].map((sz) => fx("dowel", band, [0, 0, sz], [-30, 30].map((dy) => [sx * xl, yBand + dy, sz * (zl - L / 2)] as Vec3), { len: 40, dia: 8, mate: legId(sx, sz) })),
      bandScrews: [-1, 1].map((sz) => fx("screw", legId(sx, sz), [0, 0, -sz], (sz > 0 ? [-30, 30] : [0]).map((dy) => [sx * xl, yBand + dy, sz * (zl + L / 2)] as Vec3), { ...LONG, mate: band })),
      // a leg's dowel and the screw beside it sit apart across the leg, so neither lands on the other
      legDowels: legs.map((id, i) => fx("dowel", id, [sx, 0, 0], yRail.map((y) => [sx * xi, y, ld(i ? 1 : -1) - (i ? 9 : -9)] as Vec3), { len: 30, dia: 6, mate: rails[0] })),
      railDowels: rails.map((id, i) => fx("dowel", id, [0, -1, 0], [-1, 1].map((sz) => [sx * xn, yRail[i] - 15, sz * (zl - 70)] as Vec3), { len: 30, dia: 6 })),
      railScrews: rails.map((id, i) => fx("screw", id, [sx, 0, 0], [-1, 1].map((sz) => [sx * (xn - 10), yRail[i], ld(sz) + sz * 9] as Vec3), SCREW)),
      topScrews: (["TF", "TB"] as const).map((id) => fx("screw", legId(sx, id === "TF" ? 1 : -1), [-sx, 0, 0], [-20, 20].map((dz) => [sx * (xl + L / 2), H - 9, (id === "TF" ? 1 : -1) * (zl - 50 + L / 2) + dz] as Vec3), { ...LONG, mate: id })),
    };
  };
  const fl = frame(-1), fr = frame(1);
  const SHORT_DOWEL = "Small dowel";
  const steps: CustomStep[] = [
    { title: "Tap the feet into the legs", detail: "Lay the two legs for one side on a rug and push a foot into the bottom end of each.", add: fl.legs, fix: fl.feet, pose: "+x", warnings: ["floor"], repeat: 2 },
    { title: "Tap dowels into the side boards", detail: "Two big dowels in each end.", fix: fl.bandDowels, tools: ["hammer"], repeat: 2 },
    { title: "Screw the side board between the legs", detail: "Halfway up, onto its dowels. Long screws through the legs into its ends.", add: [fl.band], fix: fl.bandScrews, tools: ["allen"], repeat: 2, warnings: ["floor"] },
    { title: "Tap small dowels into the legs", detail: "Three in the inside face of each leg: at the top and at the two shelf heights.", fix: fl.legDowels.map((f) => ({ ...f, name: SHORT_DOWEL })), tools: ["hammer"], repeat: 2 },
    { title: "Tap small dowels into the rails", detail: "Two in the bottom edge of each rail.", fix: fl.railDowels.map((f) => ({ ...f, name: SHORT_DOWEL })), tools: ["hammer"], repeat: 2 },
    { title: "Screw the rails across the legs", detail: "Three on each side frame, onto the leg dowels. By hand only for now, then tighten them all.", add: fl.rails, fix: fl.railScrews, tools: ["allen"], repeat: 2, check: "square" },
    {
      title: "Tap dowels into the top boards",
      detail: "Two big dowels in each end of both.",
      fix: (["TF", "TB"] as const).flatMap((id) => [-1, 1].map((sx) => fx("dowel", id, [sx, 0, 0], [-20, 20].map((dz) => [sx * xi, H - 9, (id === "TF" ? 1 : -1) * (zl - 50 + L / 2) + dz] as Vec3), { len: 40, dia: 8, mate: legId(sx, id === "TF" ? 1 : -1) }))),
      tools: ["hammer"],
    },
    { title: "Screw the top boards to one frame", detail: "Stand them up on the frame's top end and screw through the legs into them.", add: ["TF", "TB"], fix: fl.topScrews, tools: ["allen"] },
    {
      title: "Lay the other frame on and screw it",
      detail: "Build it the same way first: feet, side board, dowels and rails. Then lower it onto the top boards and screw through its legs.",
      add: [...fr.legs, fr.band, ...fr.rails],
      fix: merge([...fr.feet, ...fr.bandDowels, ...fr.bandScrews, ...fr.legDowels.map((f) => ({ ...f, name: SHORT_DOWEL })), ...fr.railDowels.map((f) => ({ ...f, name: SHORT_DOWEL })), ...fr.railScrews, ...fr.topScrews]),
      tools: ["allen", "hammer"],
      people: 2,
      from: Object.fromEntries([...fr.legs, fr.band, ...fr.rails].map((id) => [id, [400, 0, 0] as Vec3])),
    },
    {
      title: "Fit the front board",
      detail: "Lay it on its back. Four dowels in the board's ends, then push it in between the front legs, level with the side boards. Four screws through each leg.",
      add: ["FB"],
      fix: [
        ...[-1, 1].map((sx) => fx("dowel", "FB", [sx, 0, 0], [-30, 30].map((dy) => [sx * xi, yBand + dy, zl] as Vec3), { len: 40, dia: 8, mate: legId(sx, 1) })),
        ...[-1, 1].map((sx) => fx("screw", legId(sx, 1), [-sx, 0, 0], [-45, -15, 15, 45].map((dy) => [sx * (xl + L / 2), yBand + dy, zl] as Vec3), { ...SCREW, mate: "FB" })),
      ],
      tools: ["allen", "hammer"],
      pose: "+z",
    },
    {
      title: "Fit the clothes rail",
      detail: "Push it through under the top rails so both ends stick out as hooks. One long screw down through each top rail into it.",
      add: ["CR"],
      fix: [-1, 1].map((sx) => fx("screw", `${side(sx)}R0`, [0, -1, 0], [[sx * xn, H - 15, 0]], { ...LONG, mate: "CR" })),
      tools: ["allen"],
      from: { CR: [700, 0, 0] },
    },
    {
      title: "Screw on the upper shelf",
      detail: "Rest it on the middle rails. Four screws up through each rail into it.",
      add: ["S0"],
      fix: [-1, 1].map((sx) => fx("screw", `${side(sx)}R1`, [0, 1, 0], [-0.75, -0.25, 0.25, 0.75].map((f) => [sx * xn, yRail[1] - 15, (f * (D - 60)) / 2] as Vec3), { ...SCREW, mate: "S0" })),
      tools: ["allen"],
    },
    {
      title: "Screw on the lower shelf",
      detail: "The same way, on the bottom rails.",
      add: ["S1"],
      fix: [-1, 1].map((sx) => fx("screw", `${side(sx)}R2`, [0, 1, 0], [-0.75, -0.25, 0.25, 0.75].map((f) => [sx * xn, yRail[2] - 15, (f * (D - 60)) / 2] as Vec3), { ...SCREW, mate: "S1" })),
      tools: ["allen"],
    },
  ];
  const wx = W / 2 - 150, zW = -D / 2;
  const zTB = -(zl - 50 + L / 2);
  steps.push(
    {
      title: "Stand it up and screw on the wall brackets",
      detail: "Lift it upright together. Two brackets on the back top board, a small screw and washer each, loose for now.",
      fix: [
        fx("bracket", "TB", [0, -1, 0], [-1, 1].map((sx) => [sx * wx, H, zTB - 30] as Vec3), { len: 60, dia: 24, name: "Wall bracket", included: true }),
        fx("washer", "TB", [0, -1, 0], [-1, 1].map((sx) => [sx * wx, H + 2, zTB] as Vec3)),
        fx("screw", "TB", [0, -1, 0], [-1, 1].map((sx) => [sx * wx, H + 3, zTB] as Vec3), { len: 12, dia: 4 }),
      ],
      pose: "+y",
      people: 2,
      tools: ["screwdriver"],
      warnings: ["two"],
    },
    {
      title: "Fix it to the wall",
      detail: "Push it against the wall, mark through the brackets and drill. A washer on each wall screw, then tighten the bracket screws. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: [-1, 1].map((sx) => [sx * wx, H - 30, zW - 30] as Vec3), dir: [0, 0, -1] },
        { kind: "washer", count: 2, at: [-1, 1].map((sx) => [sx * wx, H - 30, zW - 6] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: [-1, 1].map((sx) => [sx * wx, H - 30, zW - 4] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  );
  buildCustom(b, { ...s, custom: { parts, steps } });
  return true;
}

/** One fitting list per kind, so a step that fits a whole frame stays under the custom builder's ten. */
function merge(fixes: CustomFix[]): CustomFix[] {
  const out = new Map<string, CustomFix>();
  for (const f of fixes) {
    const k = `${f.kind}|${f.name ?? ""}|${f.len ?? ""}|${f.dir?.join(",")}`;
    const o = out.get(k);
    if (o) {
      o.at = [...(o.at ?? []), ...(f.at ?? [])];
      o.count = o.at.length;
    } else out.set(k, { ...f, on: undefined, mate: undefined });
  }
  return [...out.values()];
}

interface ChestDrawer {
  keys: Record<string, string>;
  parts: SubPart[];
  fits: [HwDef, FitOpts[]][];
  steps: SubStep[];
}

function chestDrawer(b: PlanBuilder, g: { y: number; h: number; xs: number; zf: number; sl: number; bw: number }): ChestDrawer {
  const { y, h, xs, zf, sl, bw } = g;
  const zs = zf + 9 - sl / 2, zb = zf + 9 - sl + 9;
  const parts: SubPart[] = [
    { id: "F", name: "Drawer front", size: [bw, h, 18], pos: [0, y, zf] },
    { id: "SL", name: "Drawer side", size: [18, h, sl], pos: [-xs, y, zs] },
    { id: "SR", name: "Drawer side", size: [18, h, sl], pos: [xs, y, zs] },
    { id: "K", name: "Drawer strip", size: [bw, 30, 18], pos: [0, y - h / 2 + 15, zb + 18] },
    { id: "BT", name: "Drawer bottom", size: [bw, 4, zf - zb - 18], pos: [0, y - h / 2 + 34, (zf + zb) / 2], material: "fiber" },
    { id: "B", name: "Drawer back", size: [bw, h, 18], pos: [0, y, zb] },
  ];
  const keys = placeAll(b, parts);
  const sds = [-1, 1] as const;
  const sid = (sx: number) => (sx < 0 ? "SL" : "SR");
  const yy = [y - h / 4, y + h / 4];
  const steps: SubStep[] = [
    {
      title: "Tap dowels into the drawer front and back",
      detail: "Two in each end of both.",
      kind: "dowels",
      tools: ["hammer"],
      stage: { F: [[0, 0, 0], [0, 0, -160]], B: [[0, -320, 0], [0, 0, -160]] },
      fix: (["F", "B"] as const).flatMap((id) => sds.map((sx) => ({ def: DOWEL_HW, on: id, at: yy.map((v) => [sx * (bw / 2), v, id === "F" ? zf : zb] as Vec3), dir: [sx, 0, 0] as Vec3, mate: sid(sx) }))),
    },
    {
      title: "Screw the sides onto the front",
      detail: "Front standing on its face, sides onto its dowels, grooves facing in. Two screws through each side.",
      kind: "screws",
      tools: ["allen"],
      warnings: ["face"],
      stage: { SL: [[0, 0, 0], [-200, 0, 0]], SR: [[0, 0, 0], [200, 0, 0]] },
      fix: sds.map((sx) => ({ def: SCREW_HW, on: sid(sx), at: yy.map((v) => [sx * (xs + 9), v, zf] as Vec3), dir: [-sx, 0, 0] as Vec3, mate: "F" })),
    },
    {
      title: "Fit the strip",
      detail: "A dowel in each end, then slide it down the sides' grooves to the back.",
      kind: "dowels",
      tools: ["hammer"],
      stage: { K: [[0, 0, 0], [0, 0, -360]] },
      fix: sds.map((sx) => ({ def: DOWEL_HW, on: "K", at: [[sx * (bw / 2), y - h / 2 + 15, zb + 18]] as Vec3[], dir: [sx, 0, 0] as Vec3, mate: sid(sx) })),
    },
    { title: "Slide the bottom down the grooves", detail: "Smooth side in, until it reaches the front.", kind: "drawer", stage: { BT: [[0, 0, 0], [0, 0, -420]] } },
    {
      title: "Screw on the back",
      detail: "Onto the top ends of the sides, over the bottom. Two screws through each side.",
      kind: "screws",
      tools: ["allen"],
      stage: { B: [[0, 0, 0], [0, 0, -300]] },
      fix: sds.map((sx) => ({ def: SCREW_HW, on: sid(sx), at: yy.map((v) => [sx * (xs + 9), v, zb] as Vec3), dir: [-sx, 0, 0] as Vec3, mate: "B" })),
    },
  ];
  const fits: [HwDef, FitOpts[]][] = steps.flatMap((st) => (st.fix ?? []).map((f) => [f.def, f.at.map((at) => ({ on: keys[f.on], at, dir: f.dir, mate: f.mate ? keys[f.mate] : undefined }))] as [HwDef, FitOpts[]]));
  return { keys, parts, fits, steps };
}

const family: Family = {
  names: ["KRONÖREN"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/bedside-table/.test(slug)) return bedside(b, s);
    if (/chest-2-drawers/.test(slug)) return chest(b, s);
    if (/open-wardrobe/.test(slug)) return wardrobe(b, s);
    return false;
  },
};
export default family;
