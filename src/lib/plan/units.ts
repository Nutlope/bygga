import type { HwItem, HwType, PartItem, PartType, ProductSpec, RowUnit, Step, Vec3 } from "../types";
import { HW, PlanBuilder, defOf, type FitOpts } from "./builder";
import { rotate, toLocal, toWorld } from "./math";
import { slidingDoors } from "./sliding";
import { jointFits, type RowOpts } from "./row";

const UNIT: Record<string, [string, string]> = {
  bookcase: ["bookcase", "bookcases"],
  tv: ["TV bench", "TV benches"],
  wardrobe: ["wardrobe", "wardrobes"],
  wallcab: ["wall cabinet", "wall cabinets"],
  cabinet: ["cabinet", "cabinets"],
  open: ["shelving unit", "shelving units"],
};
const COUNT = ["", "", "two", "three", "four"];
const SIZE = [[], [""], ["narrow", "wide"], ["narrow", "medium", "wide"], ["narrowest", "narrow", "wide", "widest"]];

/** The row's unit a frame's spec was made for, so a family can tell the add-on corner unit from a plain frame. */
const UNIT_OF = new WeakMap<ProductSpec, RowUnit>();
export const unitOf = (s: ProductSpec): RowUnit | undefined => UNIT_OF.get(s);

/** Where a frame stands: the middle of its footprint, and how far it is turned about the vertical. */
interface Place {
  pos: Vec3;
  a: number;
}

const ry = (v: Vec3, a: number): Vec3 => (a ? [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)] : v);
const at = (p: Place, v: Vec3): Vec3 => {
  const r = ry(v, p.a);
  return [r[0] + p.pos[0], r[1] + p.pos[1], r[2] + p.pos[2]];
};

/** An XYZ Euler turned about the world vertical first: the Euler of Ry(a) times R(e), as three.js reads it. */
function turnY(e: Vec3, a: number): Vec3 {
  if (!a) return e;
  const X = ry(rotate([1, 0, 0], e), a), Y = ry(rotate([0, 1, 0], e), a), Z = ry(rotate([0, 0, 1], e), a);
  const y = Math.asin(Math.max(-1, Math.min(1, Z[0])));
  if (Math.abs(Z[0]) < 0.9999999) return [Math.atan2(-Z[1], Z[2]), y, Math.atan2(-Y[0], X[0])];
  return [Math.atan2(Y[2], Y[1]), y, 0];
}

/** The builder's own estimate of a step's work, before minutes are shared out. */
function weightOf(b: PlanBuilder, s: Step) {
  if (s.minutes) return s.minutes;
  if (s.quiet) return 1.6;
  const parts = b.items.filter((i) => i.kind === "part" && i.states[0]?.step === s.n).length + b.items.filter((i) => i.kind === "part" && i.states.length > 1 && i.states.some((x, k) => k > 0 && x.step === s.n)).length * 0.5;
  const hws = b.items.filter((i) => i.kind === "hw" && i.step === s.n && !i.preset).length;
  return (0.8 + parts * 0.6 + hws * 0.12) * (s.repeat ?? 1);
}

/** A frame's guide, built on its own: what it is made of, its fittings, and its wall fixing kept apart. */
interface Built {
  parts: PartItem[];
  types: PartType[];
  fitted: HwItem[];
  hw: Map<string, HwType>;
  anchor?: { def: Step; items: HwItem[] };
  weight: number;
}

/** Takes the last step off when it fixes the frame to the wall: that waits until every frame stands in place. */
function takeAnchor(b: PlanBuilder): Built["anchor"] {
  const last = b.steps[b.steps.length - 1];
  if (!last || (last.kind !== "anchor" && !last.wall) || b.items.some((it) => it.kind === "part" && it.states.some((x) => x.step === last.n))) return undefined;
  const items = b.items.filter((it): it is HwItem => it.kind === "hw" && it.step === last.n);
  b.items = b.items.filter((it) => !(it.kind === "hw" && it.step === last.n));
  for (const it of items) b.map.delete(it.key);
  b.steps.pop();
  return { def: last, items };
}

/**
 * Frames that aren't all alike, side by side (a wide BILLY and a narrow one, PAX frames of 100 and 50 cm),
 * or standing in a corner around an add-on corner unit. The commonest frame is built step by step exactly
 * as its own guide does; each of the others is built the same way off to the side, one step per size.
 * Then they're pushed together (screwed to each other through their sides when IKEA joins them),
 * sliding doors go across when there are any, and every frame is fixed to the wall last.
 */
export function buildUnits(b: PlanBuilder, s: ProductSpec, one: (b: PlanBuilder, s: ProductSpec) => void, opts: RowOpts = {}) {
  const row = s.row!;
  const units: RowUnit[] = row.units!;
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const join = !!row.join;
  const slide = row.slide;
  const of = row.of ?? (s.archetype === "shelf" ? "bookcase" : "cabinet");
  const [what, whats] = UNIT[of] ?? ["one", "others"];
  const { row: r0, cabinet: c0, shelf: s0, ...rest } = s;
  void r0;
  void c0;
  void s0;
  const specOf = (u: RowUnit): ProductSpec => {
    const spec: ProductSpec = {
      ...rest,
      size: { w: u.w, h: s.size.h, d: u.d ?? (slide ? s.size.d - 8 : s.size.d) },
      ...(u.cabinet ? { cabinet: u.cabinet } : {}),
      ...(u.shelf ? { shelf: u.shelf } : {}),
    };
    UNIT_OF.set(spec, u);
    return spec;
  };
  const keyOf = (u: RowUnit) => JSON.stringify(specOf(u));

  // side by side from the left with their backs in line, unless the row says where each one stands
  let x0 = -W / 2;
  const places: Place[] = units.map((u) => {
    const uw = u.w * 10, ud = (u.d ?? (slide ? s.size.d - 8 : s.size.d)) * 10;
    if (u.at) return { pos: [u.at[0] * 10, 0, u.at[1] * 10], a: u.turn ? Math.PI / 2 : 0 };
    const p: Place = { pos: [x0 + uw / 2, 0, -D / 2 + ud / 2], a: 0 };
    x0 += uw;
    return p;
  });

  // the commonest frame first (the widest of those, when it's a tie), never the corner unit or one that is turned
  const groups = new Map<string, number[]>();
  units.forEach((u, i) => groups.set(keyOf(u), [...(groups.get(keyOf(u)) ?? []), i]));
  const first = [...groups.values()]
    .filter((g) => !units[g[0]].corner && !units[g[0]].turn)
    .sort((a, c) => c.length - a.length || units[c[0]].w - units[a[0]].w)[0][0];

  /* ---------- the first frame, step by step ---------- */
  one(b, specOf(units[first]));
  const firstAnchor = takeAnchor(b);
  const p0 = places[first];
  const ownParts = b.items.filter((it): it is PartItem => it.kind === "part");
  for (const it of ownParts) {
    const old = it.final.pos;
    it.final = { pos: at(p0, old), rot: turnY(it.final.rot, p0.a) };
    for (const st of it.states)
      if (st.scene === "main") {
        st.pos = st.pos === old ? it.final.pos : at(p0, st.pos);
        st.rot = turnY(st.rot, p0.a);
      }
  }
  for (const it of b.items) if (it.kind === "hw" && !it.parent && it.scene === "main") it.pos = at(p0, it.pos);
  const own: Built = {
    parts: ownParts,
    types: b.parts,
    fitted: b.items.filter((it): it is HwItem => it.kind === "hw" && !!it.parent),
    hw: b.hw,
    anchor: firstAnchor,
    weight: b.steps.reduce((sum, st) => sum + weightOf(b, st), 0),
  };
  // the first frame's parts now stand where it goes: in its own frame of reference for copying
  const ownLocal = new Map(own.parts.map((it) => [it.key, { pos: toLocal(it.final.pos, p0.pos, [0, p0.a, 0]), rot: turnY(it.final.rot, -p0.a) }]));

  /* ---------- every other size, built on its own to copy from ---------- */
  const builtFor = new Map<string, Built>();
  const builtOf = (u: RowUnit): Built => {
    const k = keyOf(u);
    if (k === keyOf(units[first])) return own;
    let got = builtFor.get(k);
    if (!got) {
      const sb = new PlanBuilder(specOf(u));
      one(sb, specOf(u));
      const anchor = takeAnchor(sb);
      got = {
        parts: sb.items.filter((it): it is PartItem => it.kind === "part"),
        types: sb.parts,
        fitted: sb.items.filter((it): it is HwItem => it.kind === "hw" && !!it.parent),
        hw: sb.hw,
        anchor,
        weight: sb.steps.reduce((sum, st) => sum + weightOf(sb, st), 0),
      };
      builtFor.set(k, got);
    }
    return got;
  };

  // parts of the same name, size and shape are one part, whichever frame they come from
  const typeKey = (p: PartType) => JSON.stringify([p.name, p.size, p.shape, p.material, p.extra ?? false, p.pieces ?? null]);
  const typeIds = new Map<string, string>();
  for (const p of b.parts) if (!typeIds.has(typeKey(p))) typeIds.set(typeKey(p), p.id);
  const typeFor = (p: PartType) => {
    const k = typeKey(p);
    let id = typeIds.get(k);
    if (!id) {
      id = b.part(p.name, p.size, { shape: p.shape, material: p.material, extra: p.extra });
      if (p.pieces) b.parts[b.parts.length - 1].pieces = p.pieces;
      typeIds.set(k, id);
    }
    return id;
  };

  /** Each frame's parts in the finished product, by the key of the part it copies. */
  const frameParts: Map<string, string>[] = units.map(() => new Map());
  own.parts.forEach((it) => frameParts[first].set(it.key, it.key));
  const added: string[][] = units.map(() => []);

  /** Places a copy of a frame where it stands, its fittings already in. */
  const copy = (i: number) => {
    const u = units[i], p = places[i];
    const src = builtOf(u);
    const local = (it: PartItem) => (src === own ? ownLocal.get(it.key)! : it.final);
    for (const it of src.parts) {
      const type = src.types.find((t) => t.id === it.ref)!;
      const l = local(it);
      const key = b.place(typeFor(type), at(p, l.pos), turnY(l.rot, p.a));
      b.partItem(key).holes = it.holes.map((h) => ({ p: [...h.p] as Vec3, n: [...h.n] as Vec3, r: h.r }));
      frameParts[i].set(it.key, key);
      added[i].push(key);
    }
    for (const h of src.fitted) {
      const ht = src.hw.get(h.ref)!;
      const key = frameParts[i].get(h.parent!);
      if (!key) continue;
      const f = b.partItem(key).final;
      const k2 = b.preset(defOf(ht), { on: key, at: toWorld(h.pos, f.pos, f.rot), dir: rotate(h.dir, f.rot), twist: h.twist, scale: h.scale, hole: false });
      const c = b.map.get(k2) as HwItem;
      c.spin = h.spin;
      c.turn = h.turn;
    }
  };

  /* ---------- the others, one step per size ---------- */
  const sized = [...new Set(units.filter((u) => !u.corner).map((u) => u.w))].sort((a, c) => a - c);
  const adj = (u: RowUnit) => (sized.length > 1 ? SIZE[Math.min(4, sized.length)][sized.indexOf(u.w)] + " " : "");
  // where each one waits while it is built: out to the side, or out into the room for a frame on the side wall
  const waitOff = (i: number): Vec3 => (units[i].turn || units[i].corner ? [0, 0, 320] : [(places[i].pos[0] - places[first].pos[0]) * 0.25 + 220, 0, 0]);
  const order = [...groups.values()].sort((g1, g2) => (g1.includes(first) ? -1 : g2.includes(first) ? 1 : 0));
  for (const g of order) {
    const others = g.filter((i) => i !== first);
    if (!others.length) continue;
    const u = units[others[0]];
    const k = others.length;
    let title: string, detail: string;
    if (u.corner) {
      title = "Build the corner unit";
      detail = "Every step of its own guide, lying down, then stand it up. Its shelves go on pins.";
    } else if (g.includes(first)) {
      title = k > 1 ? `Build ${COUNT[k]} more ${adj(u)}${whats} the same way` : `Build another ${adj(u)}${what} the same way`;
      detail = k > 1 ? "Every step as for the first one. Stand each one next to the last." : "Every step as for the first one. Stand it next to the first.";
    } else {
      title = k > 1 ? `Build the ${COUNT[k]} ${adj(u)}${whats} the same way` : `Build the ${adj(u)}${what} the same way`;
      detail = `Every step as for the first one, ${u.w < units[first].w ? "just narrower" : "just wider"}.`;
    }
    b.step({ title, detail, kind: "general", people: s.people, weight: builtOf(u).weight * k * 0.85 }, () => {
      for (const i of others) {
        b.stagger(0);
        copy(i);
        const off = waitOff(i);
        for (const key of added[i]) {
          const f = b.partItem(key).final;
          b.stage(key, [f.pos[0] + off[0], f.pos[1] + off[1], f.pos[2] + off[2]], f.rot, [off[0] > 0 ? 520 : 0, 0, off[2] > 0 ? 520 : 0]);
        }
        b.wait(0.35);
      }
    });
  }

  /* ---------- pushed together ---------- */
  const partName = (key: string) => b.parts.find((p) => p.id === b.partItem(key).ref)?.name;
  const sidesOf = (i: number) => [...frameParts[i].values()].filter((key) => partName(key) === "Side panel");
  const extreme = (i: number, axis: 0 | 2, max: boolean) =>
    sidesOf(i).reduce<string | undefined>((a, key) => (!a || (max ? b.partItem(key).final.pos[axis] > b.partItem(a).final.pos[axis] : b.partItem(key).final.pos[axis] < b.partItem(a).final.pos[axis]) ? key : a), undefined);
  const corner = units.some((u) => u.turn || u.corner);
  const ys = (H > 1500 ? [0.12, 0.38, 0.62, 0.88] : H > 700 ? [0.2, 0.5, 0.8] : [0.3, 0.7]).map((f) => Math.round(H * f));
  const tOf = (key: string) => Math.min(...b.parts.find((p) => p.id === b.partItem(key).ref)!.size);
  const screws: FitOpts[] = [];
  // a family's own joint between frames side by side, each kind of fitting in its own list
  const joint = join ? opts.joint : undefined;
  const jointLists: FitOpts[][] = (joint?.fits ?? []).map(() => []);
  const frontOf = (key: string, axis: 0 | 2) => {
    const p = b.parts.find((t) => t.id === b.partItem(key).ref)!;
    return b.partItem(key).final.pos[axis] + Math.max(p.size[0], p.size[2]) / 2;
  };
  const addJoint = (a: string, c: string, at: Vec3, dir: Vec3) => jointFits(joint!, a, c, at, dir, tOf(a) + tOf(c)).forEach((f, i) => jointLists[i].push(f.o));
  if (join) {
    const backRun = units.map((u, i) => i).filter((i) => !units[i].turn && !units[i].corner).sort((a, c) => places[a].pos[0] - places[c].pos[0]);
    const sideRun = units.map((u, i) => i).filter((i) => units[i].turn && !units[i].corner).sort((a, c) => places[a].pos[2] - places[c].pos[2]);
    const depth = (i: number) => (units[i].d ?? s.size.d) * 10;
    for (let k = 0; k + 1 < backRun.length; k++) {
      const [l, r] = [backRun[k], backRun[k + 1]];
      const a = extreme(l, 0, true), c = extreme(r, 0, false);
      if (!a || !c) continue;
      const xj = places[l].pos[0] + (units[l].w * 10) / 2 - tOf(a);
      const zf = -D / 2 + Math.min(depth(l), depth(r)) - 60;
      if (joint) for (const y of joint.ys(H)) addJoint(a, c, [xj, y, Math.min(frontOf(a, 2), frontOf(c, 2)) - joint.back], [1, 0, 0]);
      else for (const y of ys) screws.push({ on: a, at: [xj, y, zf], dir: [1, 0, 0], mate: c });
    }
    for (let k = 0; k + 1 < sideRun.length; k++) {
      const [l, r] = [sideRun[k], sideRun[k + 1]];
      const a = extreme(l, 2, true), c = extreme(r, 2, false);
      if (!a || !c) continue;
      const zj = places[l].pos[2] + (units[l].w * 10) / 2 - tOf(a);
      const xf = -W / 2 + Math.min(depth(l), depth(r)) - 60;
      if (joint) for (const y of joint.ys(H)) addJoint(a, c, [Math.min(frontOf(a, 0), frontOf(c, 0)) - joint.back, y, zj], [0, 0, 1]);
      else for (const y of ys) screws.push({ on: a, at: [xf, y, zj], dir: [0, 0, 1], mate: c });
    }
    // the corner unit: its own joining brackets hold it to the first frame along the back wall (they're in its own
    // steps); here it's screwed to the first one on the side wall
    const cu = units.findIndex((u) => u.corner);
    if (cu >= 0) {
      const cz1 = places[cu].pos[2] + (units[cu].w * 10) / 2;
      const cx1 = -W / 2 + depth(cu);
      const s0 = sideRun[0];
      const cs = extreme(cu, 2, true), fs = s0 !== undefined ? extreme(s0, 2, false) : undefined;
      if (cs && fs) for (const y of ys) screws.push({ on: cs, at: [Math.min(cx1, -W / 2 + depth(s0)) - 60, y, cz1 - tOf(cs)], dir: [0, 0, 1], mate: fs });
    }
  }
  const ownJoint = jointLists.some((l) => l.length > 0);
  const glue = screws.length > 0 || ownJoint;
  b.step(
    {
      title: ownJoint && !corner ? joint!.title : corner ? (glue ? "Stand them in the corner and screw them together" : "Stand them in the corner") : glue ? "Push them together and screw them to each other" : "Push them together",
      detail: ownJoint ? joint!.detail : glue ? "Line up the fronts and the tops, then screw through the sides." : "Line up the fronts and the tops, side by side against the wall.",
      tools: ownJoint ? joint!.tools : glue ? ["screwdriver"] : [],
      people: 2,
      kind: "join",
      warnings: ["two"],
      weight: glue ? 1.2 + 0.4 * (units.length - 1) : 1,
    },
    () => {
      b.stagger(0);
      for (const list of added) for (const key of list) b.add(key);
      if (!glue) return;
      b.then(0.15);
      jointLists.forEach((list, i) => {
        if (!list.length) return;
        if (i) b.then(0.05);
        b.fits(joint!.fits[i].def, list, 0.08);
      });
      if (screws.length) {
        if (ownJoint) b.then(0.05);
        b.fits(HW.screwM, screws, 0.08);
      }
    },
  );

  /* ---------- sliding doors across the whole row ---------- */
  if (slide) slidingDoors(b, { span: W, n: slide, topY: H, botY: 0, zFront: -D / 2 + (s.size.d - 8) * 10, front: true });

  /* ---------- every frame fixed to the wall ---------- */
  const fixings: { def: HwType; o: FitOpts }[] = [];
  units.forEach((u, i) => {
    const src = builtOf(u);
    if (!src.anchor) return;
    for (const h of src.anchor.items) {
      const ht = src.hw.get(h.ref)!;
      const def = defOf(ht);
      if (h.parent) {
        // fittings sit on their part, wherever the part now stands
        const key = frameParts[i].get(h.parent);
        if (!key) continue;
        const f = b.partItem(key).final;
        fixings.push({ def: def as HwType, o: { on: key, at: toWorld(h.pos, f.pos, f.rot), dir: rotate(h.dir, f.rot), travel: h.travel, spin: h.spin, twist: h.twist, hole: false } });
      } else {
        // the plugs and screws in the wall were placed where the frame stood when it was built
        fixings.push({ def: def as HwType, o: { at: at(places[i], h.pos), dir: ry(h.dir, places[i].a), travel: h.travel, spin: h.spin, twist: h.twist } });
      }
    }
  });
  const a = own.anchor ?? [...builtFor.values()].find((x) => x.anchor)?.anchor;
  if (a && fixings.length) {
    b.step(
      { title: a.def.title.replace(/\bit\b/, "them"), detail: a.def.detail, tools: a.def.tools, people: a.def.people, kind: a.def.kind, warnings: a.def.warnings, wall: a.def.wall },
      () => {
        b.stagger(0.12);
        for (const f of fixings) b.fit({ kind: f.def.kind, len: f.def.len, dia: f.def.dia, notIncluded: f.def.notIncluded }, f.o);
      },
    );
  }
}
