import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * KALLSÖ, read from its manuals. The hat rack: two triangular brackets on dowels and one screw each against the
 * back panel, the shelf on top on dowels and screws, then upside down for the rail holders, the rail and the three
 * hooks, and three keyhole plates on the back; it hangs on three screws in the wall. The bench with shoe storage:
 * each end is an A of two legs joined at the top with a double cam bolt, two dowels and two cam locks; both slatted
 * shelves screw to one end, pins go in their other ends for the second; the seat is screwed down onto four rails on
 * dowels, and long screws go through the legs into the rails. The storage bench: a carcass of cam locks and dowels
 * built lying on its side, the top with its wall brackets, then a drawer and a box on castors, each built on its
 * front in a scene of its own and pushed in.
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
const LONG: Partial<CustomFix> = { len: 50, dia: 6 };
const MACHINE: Partial<CustomFix> = { len: 10, dia: 6, name: "Machine screw" };

function hatRack(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 18;
  const Hp = H - T; // back panel, under the shelf
  const zP = -D / 2 + T / 2;
  const zF = -D / 2 + T; // its front face
  const Db = D - T - 60;
  const zB = zF + Db / 2;
  const xb = W / 2 - 50;
  const diag = Math.hypot(Db, Hp);
  const brace: PartPiece[] = [
    { shape: "box", size: [T, 50, Db], pos: [0, Hp / 2 - 25, 0] },
    { shape: "box", size: [T, Hp, 40], pos: [0, 0, -Db / 2 + 20] },
    { shape: "box", size: [T, 46, diag - 60], pos: [0, 0, 0], rot: [-Math.atan2(Hp, Db), 0, 0] },
  ];
  const yR = Hp - 30, zR = D / 2 - 30;
  const parts: CustomPart[] = [
    { id: "P", name: "Back panel", size: [W, Hp, T], pos: [0, Hp / 2, zP], material: "wood" },
    { id: "BL", name: "Bracket", size: [T, Hp, Db], pos: [-xb, Hp / 2, zB], pieces: brace, material: "wood" },
    { id: "BR", name: "Bracket", size: [T, Hp, Db], pos: [xb, Hp / 2, zB], pieces: brace, material: "wood" },
    { id: "S", name: "Shelf", size: [W, T, D], pos: [0, H - T / 2, 0], material: "wood" },
    { id: "R", name: "Rail", size: [W - 90, 25, 25], pos: [0, yR, zR], shape: "cyl", material: "wood" },
  ];
  const br = (sx: number) => (sx < 0 ? "BL" : "BR");
  const holder = (sx: number): CustomFix[] => [
    fx("clamp", br(sx), [-sx, 0, 0], [[sx * (xb + T / 2), yR, zR - 40]], { len: 60, dia: 30, name: "Rail holder" }),
    fx("screw", br(sx), [-sx, 0, 0], [yR + 12, yR - 12].map((y) => [sx * (xb + T / 2), y, zR - 60] as Vec3), MACHINE),
  ];
  const hookX = [-W * 0.29, 0, W * 0.29];
  const plateX = [-W / 2 + 90, 0, W / 2 - 90];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the brackets",
      detail: "Two along the back edge of each, on a rug.",
      fix: [-1, 1].map((sx) => fx("dowel", br(sx), [0, 0, -1], [0.3, 0.7].map((f) => [sx * xb, Hp * f, zF] as Vec3), { mate: "P" })),
      warnings: ["floor"],
      tools: ["hammer"],
    },
    {
      title: "Screw the brackets to the back panel",
      detail: "Push each bracket onto its dowels, then one long screw through the back of the panel into it.",
      add: ["P"],
      fix: [-1, 1].map((sx) => fx("screw", "P", [0, 0, 1], [[sx * xb, Hp / 2, -D / 2]], { ...LONG, mate: br(sx) })),
      tools: ["allen"],
      from: { P: [0, 0, -260] },
    },
    { title: "Tap two dowels into the top of the panel", detail: "Into the holes along its top edge.", fix: [fx("dowel", "P", [0, 1, 0], [-W / 4, W / 4].map((x) => [x, Hp, zP] as Vec3), { mate: "S" })], tools: ["hammer"] },
    {
      title: "Screw on the shelf",
      detail: "Press it down onto the dowels, then four long screws down through it, two into the panel and one into each bracket.",
      add: ["S"],
      fix: [
        fx("screw", "S", [0, -1, 0], [-W / 6, W / 6].map((x) => [x, H, zP] as Vec3), { ...LONG, mate: "P" }),
        ...[-1, 1].map((sx) => fx("screw", "S", [0, -1, 0], [[sx * xb, H, zB]], { ...LONG, mate: br(sx) })),
      ],
      tools: ["allen"],
    },
    { title: "Turn it upside down and fit a rail holder", detail: "Onto the outside of one bracket at the front, with two machine screws.", fix: holder(-1), tools: ["allen"], pose: "-y" },
    { title: "Push the rail into the holder", detail: "All the way in, until it stops.", add: ["R"], from: { R: [W * 0.5, 0, 0] } },
    {
      title: "Fit the second holder on the rail's end",
      detail: "Hold the rail level while you screw the holder onto the other bracket.",
      fix: holder(1),
      tools: ["allen"],
    },
    {
      title: "Screw on the three hooks",
      detail: "Along the front of the back panel, two machine screws each, from behind. The hooks point down.",
      fix: [
        fx("hook", "P", [0, 0, -1], hookX.map((x) => [x, Hp * 0.4, zF] as Vec3), { len: 55, dia: 30 }),
        fx("screw", "P", [0, 0, 1], hookX.flatMap((x) => [x - 10, x + 10].map((xx) => [xx, Hp * 0.4, -D / 2] as Vec3)), { ...MACHINE, mate: "P" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw the hanging plates on the back",
      detail: "Three plates along the top of the back, keyholes up, two small screws each.",
      fix: [
        fx("plate", "P", [0, 0, 1], plateX.map((x) => [x, Hp - 20, -D / 2] as Vec3), { len: 60, dia: 22, name: "Hanging plate" }),
        fx("screw", "P", [0, 0, 1], plateX.flatMap((x) => [Hp - 30, Hp - 55].map((y) => [x, y, -D / 2] as Vec3)), { len: 16, dia: 3.5 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Mark the wall through the keyholes",
      detail: "Hold it level where it will hang and mark the three keyholes with a pencil.",
      pose: "+y",
      tools: ["level", "pencil"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Put three screws in the wall",
      detail: "Leave each one standing out a little. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 3, at: plateX.map((x) => [x, Hp - 8, -D / 2 - 20] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 3, len: 50, dia: 5, at: plateX.map((x) => [x, Hp - 8, -D / 2 - 4] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
    },
    { title: "Hang it on the screws", detail: "Each keyhole over its screw, then let it drop down onto them.", warnings: ["wall"] },
    { title: "Tighten the wall screws", detail: "Turn each one in through its keyhole until the rack sits tight against the wall.", tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

function shoeBench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 18, ST = 28;
  const yTop = H - ST;
  const xa = W / 2 - 90;
  const lw = 70;
  const zBot = D / 2 - 40, zTop = 25;
  const run = zBot + zTop;
  const len = Math.hypot(yTop, run) - 10;
  const lean = Math.atan2(run, yTop);
  const parts: CustomPart[] = [];
  const legs: Record<"L" | "R", string[]> = { L: [], R: [] };
  for (const sx of [-1, 1]) {
    const side = sx < 0 ? "L" : "R";
    for (const sz of [-1, 1]) {
      const id = `${side}${sz > 0 ? "F" : "B"}`;
      const x = sx * (xa + (sz > 0 ? T / 2 : -T / 2));
      parts.push({ id, name: "Leg", size: [T, len, lw], pos: [x, yTop / 2, sz * (zBot - run / 2)], rot: [-sz * lean, 0, 0], material: "wood" });
      legs[side].push(id);
    }
  }
  const zAt = (sz: number, y: number) => sz * (zBot - (run * y) / yTop);
  const shelf = (id: string, y: number, d: number): CustomPart => {
    const L = 2 * (xa - T);
    const n = 5;
    const pieces: PartPiece[] = [
      ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [20, 30, d] as Vec3, pos: [sx * (L / 2 - 10), 0, 0] as Vec3 })),
      ...Array.from({ length: n }, (_, i) => ({ shape: "box" as const, size: [L - 40, 18, 34] as Vec3, pos: [0, 6, -d / 2 + 17 + ((d - 34) * i) / (n - 1)] as Vec3 })),
    ];
    return { id, name: "Slatted shelf", size: [L, 30, d], pos: [0, y, 0], pieces, material: "wood" };
  };
  parts.push(shelf("S0", 120, 300), shelf("S1", 300, 250));
  const rh = 60, yr = yTop - rh / 2;
  const xr = xa - T - 11;
  const zr = 120;
  parts.push(
    ...[-1, 1].map((sx) => ({ id: sx < 0 ? "EL" : "ER", name: "End rail", size: [22, rh, 2 * zr + 22] as Vec3, pos: [sx * xr, yr, 0] as Vec3, material: "wood" as const })),
    ...[-1, 1].map((sz) => ({ id: sz < 0 ? "QB" : "QF", name: "Long rail", size: [2 * xr - 22, rh, 22] as Vec3, pos: [0, yr, sz * zr] as Vec3, material: "wood" as const })),
    { id: "T", name: "Seat", size: [W, ST, D], pos: [0, H - ST / 2, 0], material: "wood" },
  );
  const joint = (side: "L" | "R") => {
    const sx = side === "L" ? -1 : 1;
    const y = yTop - 70;
    return {
      bolt: fx("camScrew", `${side}F`, [-sx, 0, 0], [[sx * xa, y, 0]], { len: 44, dia: 7, name: "Double cam bolt", mate: `${side}B` }),
      dowels: fx("dowel", `${side}F`, [-sx, 0, 0], [y - 60, y + 30].map((yy) => [sx * xa, yy, 0] as Vec3), { mate: `${side}B` }),
      cams: [fx("cam", `${side}F`, [-sx, 0, 0], [[sx * (xa + T), y, 18]], { dia: 15 }), fx("cam", `${side}B`, [sx, 0, 0], [[sx * (xa - T), y, -18]], { dia: 15 })],
      feet: [-1, 1].map((sz) => fx("cap", `${side}${sz > 0 ? "F" : "B"}`, [0, 1, 0], [[sx * (xa + (sz > 0 ? T / 2 : -T / 2)), 0, sz * (zBot + 8)]], { len: 20, dia: 60, name: "Foot block" })),
    };
  };
  const jl = joint("L"), jr = joint("R");
  const shelfScrews = (sx: number): CustomFix[] =>
    (["S0", "S1"] as const).map((id, i) => {
      const y = i ? 300 : 120;
      const sz = i ? -1 : 1;
      return fx("screw", `${sx < 0 ? "L" : "R"}${sz > 0 ? "F" : "B"}`, [-sx, 0, 0], [[sx * (xa + T), y, zAt(sz, y) * 0.6]], { len: 40, dia: 6, mate: id });
    });
  const steps: CustomStep[] = [
    { title: "Fit the foot blocks onto two legs", detail: "Lay the legs for one end on a rug and press a block onto the bottom of each.", add: legs.L, fix: jl.feet, pose: "+x", warnings: ["floor"], repeat: 2 },
    { title: "Fit the double cam bolt", detail: "Into the top of one leg, by hand until it stops.", fix: [jl.bolt], repeat: 2 },
    { title: "Tap in the dowels", detail: "Two beside the bolt, so the legs line up when they meet.", fix: [jl.dowels], tools: ["hammer"], repeat: 2 },
    { title: "Join the legs with the cam locks", detail: "Push the legs together into an A, then turn a cam lock in each leg until it pulls tight.", fix: jl.cams, tools: ["screwdriver"], repeat: 2 },
    {
      title: "Screw both shelves to one end",
      detail: "Stand the A on its feet and hold each shelf against it. One screw through the leg into the end of each shelf.",
      add: ["S0", "S1"],
      fix: shelfScrews(-1),
      tools: ["allen"],
      pose: "+y",
      from: { S0: [300, 0, 0], S1: [300, 0, 0] },
    },
    {
      title: "Push the pins into the free ends",
      detail: "Two in the open end of each shelf.",
      fix: (["S0", "S1"] as const).map((id, i) => fx("dowel", id, [1, 0, 0], [-1, 1].map((sz) => [xa - T, i ? 300 : 120, sz * 50] as Vec3), { len: 30, dia: 5, name: "Pin", mate: i ? "RB" : "RF" })),
    },
    { title: "Turn it onto the first end", detail: "Lay it down on the rug, so the shelves stand up with their pins on top.", pose: "+x", warnings: ["floor"] },
    {
      title: "Build the second end and screw it on",
      detail: "Make the other A the same way, with its foot blocks, bolt, dowels and cam locks. Lower it onto the pins and screw it to the shelves.",
      add: legs.R,
      fix: [...jr.feet, jr.bolt, jr.dowels, ...jr.cams, ...shelfScrews(1)],
      tools: ["allen", "screwdriver"],
    },
    {
      title: "Join the seat rails on dowels",
      detail: "Two in each end of both long rails, then push the end rails on. Stand the bench up first.",
      add: ["QB", "QF", "EL", "ER"],
      from: { QB: [0, 300, 0], QF: [0, 300, 0], EL: [0, 300, 0], ER: [0, 300, 0] },
      fix: [-1, 1].flatMap((sz) => [-1, 1].map((sx) => fx("dowel", sz < 0 ? "QB" : "QF", [sx, 0, 0], [-15, 15].map((dy) => [sx * (xr - 11), yr + dy, sz * zr] as Vec3), { mate: sx < 0 ? "EL" : "ER" }))),
      pose: "+y",
      tools: ["hammer"],
    },
    {
      title: "Screw the seat onto the rails",
      detail: "Put the rails together on the seat, upside down on a rug. Two long screws through the seat into each rail.",
      add: ["T"],
      fix: [
        ...[-1, 1].map((sz) => fx("screw", "T", [0, -1, 0], [-xr / 2, xr / 2].map((x) => [x, H, sz * zr] as Vec3), { len: 60, dia: 6, mate: sz < 0 ? "QB" : "QF" })),
        ...[-1, 1].map((sx) => fx("screw", "T", [0, -1, 0], [-zr / 2, zr / 2].map((z) => [sx * xr, H, z] as Vec3), { len: 60, dia: 6, mate: sx < 0 ? "EL" : "ER" })),
      ],
      tools: ["allen"],
    },
    {
      title: "Lower the frame onto the seat and screw it on",
      detail: "Turn the frame upside down onto the rails, then two long screws through the top of each end into its rail. Turn it the right way up.",
      fix: [-1, 1].map((sx) => fx("screw", `${sx < 0 ? "L" : "R"}F`, [-sx, 0, 0], [-1, 1].map((sz) => [sx * (xa + T), yr, sz * 40] as Vec3), { len: 70, dia: 6, mate: sx < 0 ? "EL" : "ER" })),
      tools: ["allen"],
      check: "square",
    },
  ];
  return { parts, steps };
}

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

const CAM_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const STOP: HwDef = { kind: "clip", len: 40, dia: 8, name: "Stop wire" };

function storageBench(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 18, TT = 24;
  const xs = W / 2 - 20; // side centres
  const xi = xs - T / 2; // their inner faces
  const yU = H - TT; // under the top
  const yF = 377; // fixed shelf centre, under the drawer
  const yr = yU - 25;
  const zRF = D / 2 - 29, zRB = -D / 2 + 14;
  const zs = [-D / 2 + 70, D / 2 - 70];
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, yU, D - 10], pos: [-xs, yU / 2, 0], material: "wood" },
    { id: "R", name: "Side panel", size: [T, yU, D - 10], pos: [xs, yU / 2, 0], material: "wood" },
    { id: "F", name: "Fixed shelf", size: [2 * xi, T, D - 30], pos: [0, yF, -5], material: "wood" },
    { id: "RF", name: "Top rail", size: [2 * xi, 50, T], pos: [0, yr, zRF], material: "wood" },
    { id: "RB", name: "Top rail", size: [2 * xi, 50, T], pos: [0, yr, zRB], material: "wood" },
    { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
  ];
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const sideFits = (sx: number): CustomFix[] => [
    fx("cap", side(sx), [0, 1, 0], [-1, 1].map((sz) => [sx * xs, 0, sz * (D / 2 - 45)] as Vec3), { len: 20, dia: 50, name: "Foot block" }),
    fx("runner", side(sx), [sx, 0, 0], [[sx * xi, 400, 10]], { len: D - 60, dia: 30, hole: false } as Partial<CustomFix>),
    fx("screw", side(sx), [sx, 0, 0], [-100, 10, 120].map((z) => [sx * xi, 400, z] as Vec3), { len: 12, dia: 4 }),
    fx("camScrew", side(sx), [sx, 0, 0], [...zs.map((z) => [sx * xi, yF, z * 0.8] as Vec3), [sx * xi, yr, zRF], [sx * xi, yr, zRB]], { mate: "F" }),
  ];
  const camsAt = (sx: number, what: "F" | "rails"): CustomFix[] =>
    what === "F"
      ? [fx("cam", "F", [0, -1, 0], zs.map((z) => [sx * (xi - 25), yF + T / 2, z * 0.8] as Vec3), { dia: 15 })]
      : [fx("cam", "RF", [0, 0, 1], [[sx * (xi - 25), yr, zRF - T / 2]], { dia: 15 }), fx("cam", "RB", [0, 0, -1], [[sx * (xi - 25), yr, zRB + T / 2]], { dia: 15 })];
  const wallX = W / 2 - 120, zW = -D / 2;
  const steps: CustomStep[] = [
    { title: "Press the foot blocks onto a side", detail: "Lay both sides on a rug, insides up. Two blocks along the bottom edge of each.", add: ["L"], fix: [sideFits(-1)[0]], pose: "+x", warnings: ["floor"], repeat: 2 },
    { title: "Screw a drawer runner inside each side", detail: "Its wheel at the front, three screws each.", fix: sideFits(-1).slice(1, 3), tools: ["screwdriver"], repeat: 2 },
    { title: "Screw in the cam bolts", detail: "Four in each side, by hand until they stop.", fix: [sideFits(-1)[3]], repeat: 2 },
    {
      title: "Fit the fixed shelf on its dowels",
      detail: "Two dowels in each end, then push it onto the cam bolts in the side.",
      add: ["F"],
      fix: [-1, 1].map((sx) => fx("dowel", "F", [sx, 0, 0], [-1, 1].map((sz) => [sx * xi, yF, sz * D * 0.3] as Vec3), { mate: side(sx) })),
      tools: ["hammer"],
    },
    { title: "Lock the shelf with two cam locks", detail: "Arrow towards the bolt, then clockwise until it pulls tight.", fix: camsAt(-1, "F"), tools: ["screwdriver"] },
    {
      title: "Fit the two top rails",
      detail: "A dowel in each end of both, then onto their cam bolts at the top of the side.",
      add: ["RF", "RB"],
      fix: (["RF", "RB"] as const).map((id) => fx("dowel", id, [-1, 0, 0], [[-xi, yr - 12, id === "RF" ? zRF : zRB]], { mate: "L" })),
      tools: ["hammer"],
    },
    { title: "Lock the rails", detail: "One cam lock in each.", fix: camsAt(-1, "rails"), tools: ["screwdriver"] },
    {
      title: "Lay the other side on",
      detail: "Fit its foot blocks, runner and cam bolts first, the same as the first side. Then lower it onto the shelf and the rails.",
      add: ["R"],
      fix: [...sideFits(1), ...(["RF", "RB"] as const).map((id) => fx("dowel", id, [1, 0, 0], [[xi, yr - 12, id === "RF" ? zRF : zRB]], { mate: "R" }))],
      tools: ["screwdriver", "hammer"],
    },
    { title: "Lock the other side", detail: "Four cam locks: two in the shelf, one in each rail.", fix: [...camsAt(1, "F"), ...camsAt(1, "rails")], tools: ["screwdriver"] },
    {
      title: "Stand it up and tap in four dowels",
      detail: "Two in the top edge of each side.",
      fix: [-1, 1].map((sx) => fx("dowel", side(sx), [0, 1, 0], [-1, 1].map((sz) => [sx * xs, yU, sz * D * 0.3] as Vec3), { mate: "T" })),
      pose: "+y",
      tools: ["hammer"],
    },
    {
      title: "Fit the wall brackets and cam bolts under the top, then press it on",
      detail: "Lay the top face down. Screw the two brackets loosely at the back with a washer each, and four cam bolts over the sides. Then turn it over onto the dowels.",
      add: ["T"],
      fix: [
        fx("plate", "T", [0, 1, 0], [-1, 1].map((sx) => [sx * wallX, yU, zW + 25] as Vec3), { len: 70, dia: 30, name: "Wall bracket" }),
        fx("washer", "T", [0, 1, 0], [-1, 1].map((sx) => [sx * wallX, yU - 2, zW + 40] as Vec3)),
        fx("screw", "T", [0, 1, 0], [-1, 1].map((sx) => [sx * wallX, yU - 3, zW + 40] as Vec3), { len: 16, dia: 4 }),
        fx("camScrew", "T", [0, 1, 0], [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, yU, sz * D * 0.18] as Vec3)), { mate: "L" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the top with four cam locks",
      detail: "Two inside the top of each side.",
      fix: [-1, 1].map((sx) => fx("cam", side(sx), [-sx, 0, 0], [-1, 1].map((sz) => [sx * xi, yU - 25, sz * D * 0.18] as Vec3), { dia: 15 })),
      tools: ["screwdriver"],
    },
    { title: "Mark the wall through the brackets", detail: "Push it against the wall where it will stand and mark through both brackets. Then pull it out to drill.", tools: ["pencil", "drill"], wall: true, warnings: ["wall"] },
    {
      title: "Screw it to the wall",
      detail: "A washer on each wall screw, then tighten the bracket screws under the top. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: [-1, 1].map((sx) => [sx * wallX, yU - 30, zW - 20] as Vec3), dir: [0, 0, -1] },
        { kind: "washer", count: 2, at: [-1, 1].map((sx) => [sx * wallX, yU - 30, zW + 4] as Vec3), dir: [0, 0, -1], on: "T" },
        { kind: "screw", count: 2, len: 50, dia: 5, at: [-1, 1].map((sx) => [sx * wallX, yU - 30, zW + 6] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });

  // the drawer, built on its front
  const xd = xi - 21; // drawer sides
  const zfB = D / 2 - 20; // back face of the drawer front
  const yd = 435, dl = D - 60, zd = zfB - dl / 2;
  const bw = 2 * (xd - 8);
  // the back lies over the ends of the sides, like the front: everything joins along the depth, from above
  const zdE = zd - dl / 2;
  const zDB = zdE - 8;
  const dParts: SubPart[] = [
    { id: "DF", name: "Drawer front", size: [2 * xi - 4, 150, T], pos: [0, 455, D / 2 - 11] },
    { id: "DSL", name: "Drawer side", size: [16, 90, dl], pos: [-xd, yd, zd] },
    { id: "DSR", name: "Drawer side", size: [16, 90, dl], pos: [xd, yd, zd] },
    { id: "DB", name: "Drawer back", size: [2 * xd + 16, 90, 16], pos: [0, yd, zDB] },
    { id: "DD", name: "Drawer bottom", size: [bw, 3, zfB - zdE], pos: [0, yd - 40, (zfB + zdE) / 2], material: "fiber" },
  ];
  const dk = placeAll(b, dParts);
  const sds = [-1, 1] as const;
  const dside = (sx: number) => (sx < 0 ? "DSL" : "DSR");
  subSteps(b, "drawer", "-z", dParts, dk, [
    {
      title: "Screw the cam bolts into the drawer front and back",
      detail: "Lay the front face down on the rug. Two bolts in each, by hand until they stop.",
      kind: "cams",
      warnings: ["face"],
      stage: { DF: [[0, 0, 0], [0, 0, -160]], DB: [[0, -320, 0], [0, 0, -160]] },
      fix: [
        ...sds.map((sx) => ({ def: CAM_BOLT, on: "DF", at: [[sx * xd, yd, zfB]] as Vec3[], dir: [0, 0, 1] as Vec3, mate: dside(sx) })),
        ...sds.map((sx) => ({ def: CAM_BOLT, on: "DB", at: [[sx * xd, yd, zdE]] as Vec3[], dir: [0, 0, -1] as Vec3, mate: dside(sx) })),
      ],
    },
    { title: "Tap the stop wire into the back", detail: "Into the two holes in the middle of its top edge, until it sits flat.", kind: "general", tools: ["hammer"], fix: [{ def: STOP, on: "DB", at: [[0, yd + 45, zDB]], dir: [0, -1, 0], hole: false }] },
    {
      title: "Tap the dowels into the drawer sides",
      detail: "Two at each end of both sides, grooves facing in.",
      kind: "dowels",
      tools: ["hammer"],
      stage: { DSL: [[-260, 0, 0], [0, 0, -160]], DSR: [[260, 0, 0], [0, 0, -160]] },
      fix: sds.flatMap((sx) => [
        { def: DOWEL, on: dside(sx), at: [yd - 25, yd + 25].map((y) => [sx * xd, y, zfB] as Vec3), dir: [0, 0, -1] as Vec3, mate: "DF" },
        { def: DOWEL, on: dside(sx), at: [yd - 25, yd + 25].map((y) => [sx * xd, y, zdE] as Vec3), dir: [0, 0, 1] as Vec3, mate: "DB" },
      ]),
    },
    { title: "Push the sides onto the front", detail: "Stand them down onto its dowels and bolts, grooves facing in.", kind: "join", stage: { DSL: [[0, 0, 0], [0, 0, -200]], DSR: [[0, 0, 0], [0, 0, -200]] } },
    { title: "Lock the front with two cam locks", detail: "One in each side, near the front.", kind: "cams", tools: ["screwdriver"], fix: [{ def: CAM, on: "DSL", at: [[-xd - 8, yd, zfB - 25]], dir: [1, 0, 0] }, { def: CAM, on: "DSR", at: [[xd + 8, yd, zfB - 25]], dir: [-1, 0, 0] }] },
    { title: "Slide the bottom into the grooves", detail: "Smooth side up, all the way to the front.", kind: "drawer", stage: { DD: [[0, 0, 0], [0, 0, -420]] } },
    { title: "Fit the back", detail: "Lower it onto the ends of the sides, over the end of the bottom, onto its dowels.", kind: "join", stage: { DB: [[0, 0, 0], [0, 0, -300]] } },
    { title: "Lock the back with two cam locks", detail: "One in each side, at the back.", kind: "cams", tools: ["screwdriver"], fix: [{ def: CAM, on: "DSL", at: [[-xd - 8, yd, zdE + 25]], dir: [1, 0, 0] }, { def: CAM, on: "DSR", at: [[xd + 8, yd, zdE + 25]], dir: [-1, 0, 0] }] },
    {
      title: "Screw the runner parts onto the drawer",
      detail: "One along the bottom of each side, two screws each.",
      kind: "runners",
      tools: ["screwdriver"],
      fix: sds.map((sx) => ({ def: { kind: "screw", len: 12, dia: 4 } as HwDef, on: dside(sx), at: [-80, 90].map((z) => [sx * (xd + 8), yd - 35, z] as Vec3), dir: [-sx, 0, 0] as Vec3 })),
    },
  ]);
  pushIn(b, dk, "Put the drawer in", "Set its wheels into the runners and push it in until it closes.");

  // the box on castors, built on its front
  const xb = xi - 24;
  const zbF = D / 2 - 20;
  const bl = D - 90;
  const zb = zbF - bl / 2;
  // the back lies over the ends of the sides, joined along the depth like the front
  const zE = zb - bl / 2;
  const zXB = zE - T / 2;
  const iw = 2 * (xb - 9);
  const zc = [zbF - 20, zE + 38];
  const bParts: SubPart[] = [
    { id: "XF", name: "Box front", size: [2 * xi - 4, 335, T], pos: [0, 197.5, D / 2 - 11] },
    { id: "XSL", name: "Box side", size: [T, 330, bl], pos: [-xb, 185, zb] },
    { id: "XSR", name: "Box side", size: [T, 330, bl], pos: [xb, 185, zb] },
    { id: "XD", name: "Box bottom", size: [iw, 3, zbF - zE], pos: [0, 52, (zbF + zE) / 2], material: "fiber" },
    { id: "XC0", name: "Castor batten", size: [iw, 30, 40], pos: [0, 35, zc[0]] },
    { id: "XC1", name: "Castor batten", size: [iw, 30, 40], pos: [0, 35, zc[1]] },
    { id: "XB", name: "Box back", size: [2 * xb + T, 300, T], pos: [0, 200, zXB] },
  ];
  const bk = placeAll(b, bParts);
  const bside = (sx: number) => (sx < 0 ? "XSL" : "XSR");
  const castorAt = zc.flatMap((z) => sds.map((sx) => [sx * (xb - 60), 20, z] as Vec3));
  subSteps(b, "box", "-z", bParts, bk, [
    {
      title: "Screw the cam bolts into the box front",
      detail: "Lay it face down on the rug. Four bolts, two near each end.",
      kind: "cams",
      warnings: ["face"],
      stage: { XF: [[0, 0, 0], [0, 0, -160]] },
      fix: [{ def: CAM_BOLT, on: "XF", at: sds.flatMap((sx) => [120, 280].map((y) => [sx * xb, y, zbF] as Vec3)), dir: [0, 0, 1] }],
    },
    {
      title: "Tap the dowels into the box sides",
      detail: "Two at each end of both sides.",
      kind: "dowels",
      tools: ["hammer"],
      stage: { XSL: [[-260, 0, 0], [0, 0, -160]], XSR: [[260, 0, 0], [0, 0, -160]] },
      fix: sds.flatMap((sx) => [
        { def: DOWEL, on: bside(sx), at: [70, 320].map((y) => [sx * xb, y, zbF] as Vec3), dir: [0, 0, -1] as Vec3, mate: "XF" },
        { def: DOWEL, on: bside(sx), at: [160, 240].map((y) => [sx * xb, y, zE] as Vec3), dir: [0, 0, 1] as Vec3, mate: "XB" },
      ]),
    },
    { title: "Push the sides onto the front", detail: "Stand them down onto the dowels and bolts, grooves facing in.", kind: "join", stage: { XSL: [[0, 0, 0], [0, 0, -200]], XSR: [[0, 0, 0], [0, 0, -200]] } },
    { title: "Lock them with four cam locks", detail: "Two in each side, near the front.", kind: "cams", tools: ["screwdriver"], fix: sds.map((sx) => ({ def: CAM, on: bside(sx), at: [120, 280].map((y) => [sx * (xb + 9), y, zbF - 25] as Vec3), dir: [-sx, 0, 0] as Vec3 })) },
    { title: "Slide the bottom into the grooves", detail: "Smooth side in, down to the front.", kind: "drawer", stage: { XD: [[0, 0, 0], [0, 0, -420]] } },
    {
      title: "Screw the castors onto the battens",
      detail: "Two castors on each batten, two screws each.",
      kind: "screws",
      tools: ["screwdriver"],
      stage: { XC0: [[0, -380, 0], [0, 0, -160]], XC1: [[0, -460, 0], [0, 0, -160]] },
      fix: [
        { def: { kind: "castor", len: 20, dia: 30 }, on: "XC0", at: castorAt.slice(0, 2), dir: [0, 1, 0], hole: false },
        { def: { kind: "castor", len: 20, dia: 30 }, on: "XC1", at: castorAt.slice(2), dir: [0, 1, 0], hole: false },
        { def: { kind: "screw", len: 14, dia: 4 }, on: "XC0", at: castorAt.slice(0, 2).flatMap((p) => [-12, 12].map((dx) => [p[0] + dx, 20, p[2]] as Vec3)), dir: [0, 1, 0] },
        { def: { kind: "screw", len: 14, dia: 4 }, on: "XC1", at: castorAt.slice(2).flatMap((p) => [-12, 12].map((dx) => [p[0] + dx, 20, p[2]] as Vec3)), dir: [0, 1, 0] },
      ],
    },
    {
      title: "Tap the dowels into the battens",
      detail: "Two in each end.",
      kind: "dowels",
      tools: ["hammer"],
      fix: (["XC0", "XC1"] as const).flatMap((id, i) => sds.map((sx) => ({ def: DOWEL, on: id, at: [-10, 10].map((dz) => [sx * (xb - 9), 35, zc[i] + dz] as Vec3), dir: [sx, 0, 0] as Vec3, mate: bside(sx) }))),
    },
    { title: "Push the battens in between the sides", detail: "Castors facing out, along the bottom edges.", kind: "join", stage: { XC0: [[0, 0, 0], [0, 0, -260]], XC1: [[0, 0, 0], [0, 0, -260]] } },
    {
      title: "Screw the cam bolts into the box back",
      detail: "Two in each end, by hand.",
      kind: "cams",
      stage: { XB: [[0, -420, 0], [0, 0, -160]] },
      fix: sds.map((sx) => ({ def: CAM_BOLT, on: "XB", at: [100, 300].map((y) => [sx * xb, y, zE] as Vec3), dir: [0, 0, -1] as Vec3 })),
    },
    { title: "Tap the stop wire into the back", detail: "Into the holes in the middle of its top edge.", kind: "general", tools: ["hammer"], fix: [{ def: STOP, on: "XB", at: [[0, 350, zXB]], dir: [0, -1, 0], hole: false }] },
    { title: "Press the back on", detail: "Lower it onto the ends of the sides, onto the dowels, its edge over the bottom.", kind: "join", stage: { XB: [[0, 0, 0], [0, 0, -300]] } },
    { title: "Lock the back with four cam locks", detail: "Two in each side, at the back.", kind: "cams", tools: ["screwdriver"], fix: sds.map((sx) => ({ def: CAM, on: bside(sx), at: [100, 300].map((y) => [sx * (xb + 9), y, zE + 25] as Vec3), dir: [-sx, 0, 0] as Vec3 })) },
    { title: "Press the bumpers into the top edges", detail: "Two along the top of each side.", kind: "general", fix: sds.map((sx) => ({ def: { kind: "glide", len: 6, dia: 12, name: "Bumper" } as HwDef, on: bside(sx), at: [-60, 120].map((z) => [sx * xb, 350, z] as Vec3), dir: [0, -1, 0] as Vec3, hole: false })) },
    { title: "Fit the pivots", detail: "One low on the outside of each side, at the back. They let the box tip out.", kind: "hinges", tools: ["screwdriver"], fix: sds.map((sx) => ({ def: { kind: "hinge", len: 30, dia: 24, name: "Pivot" } as HwDef, on: bside(sx), at: [[sx * (xb + 9), 70, zE + 30]], dir: [-sx, 0, 0] as Vec3 })) },
  ]);
  pushIn(b, bk, "Roll the box in", "Tip it slightly so the pivots find their place, then roll it in under the drawer.");
  return true;
}

const family: Family = {
  names: ["KALLSÖ"],
  build(b, s) {
    if (/storage-bench/.test(s.slug ?? "") && !/shoe/.test(s.slug ?? "")) return storageBench(b, s);
    return false;
  },
  recipe(s) {
    const slug = s.slug ?? "";
    if (/hat-rack/.test(slug)) return hatRack(s);
    if (/shoe-storage/.test(slug)) return shoeBench(s);
    return null;
  },
};
export default family;
