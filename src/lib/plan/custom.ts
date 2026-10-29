import type { CustomFix, CustomPart, CustomStep, HwKind, PartMaterial, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "./builder";
import { POSE_EULER, rotate, unrotate } from "./math";

/**
 * Builds a guide from a product someone scanned from their own manual.
 * The AI only describes boxes (where each part sits in the finished product) and which parts each step adds.
 * Everything fiddly is worked out here: where parts touch, where each dowel, bolt or screw goes,
 * which way parts arrive from, and which tools a step needs.
 */

type Box = { min: Vec3; max: Vec3 };
interface Node {
  id: string;
  part: CustomPart;
  key: string;
  box: Box;
}
interface Contact {
  a: Node;
  b: Node;
  n: 0 | 1 | 2;
  plane: number;
  rect: [[number, number], [number, number]];
  uv: [0 | 1 | 2, 0 | 1 | 2];
}

const AXES = [0, 1, 2] as const;
const PRE: HwKind[] = ["dowel", "camScrew", "pin", "legScrew", "plate"];

export function boxOf(p: { size: Vec3; pos: Vec3; rot?: Vec3 }): Box {
  if (p.rot && p.rot.some((r) => r)) {
    const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
          }
        }
    return { min: lo, max: hi };
  }
  return {
    min: [p.pos[0] - p.size[0] / 2, p.pos[1] - p.size[1] / 2, p.pos[2] - p.size[2] / 2],
    max: [p.pos[0] + p.size[0] / 2, p.pos[1] + p.size[1] / 2, p.pos[2] + p.size[2] / 2],
  };
}

const ext = (b: Box, k: number) => b.max[k] - b.min[k];
const mid = (b: Box, k: number) => (b.max[k] + b.min[k]) / 2;
const unit = (k: number, s: number): Vec3 => {
  const v: Vec3 = [0, 0, 0];
  v[k] = s;
  return v;
};

function contactOf(a: Node, b: Node, tol = 4): Contact | null {
  const ov = AXES.map((k) => Math.min(a.box.max[k], b.box.max[k]) - Math.max(a.box.min[k], b.box.min[k]));
  let n = -1;
  let best = Infinity;
  for (const k of AXES) {
    if (Math.abs(ov[k]) > tol) continue;
    const others = AXES.filter((j) => j !== k);
    if (others.every((j) => ov[j] > 2) && Math.abs(ov[k]) < best) {
      best = Math.abs(ov[k]);
      n = k;
    }
  }
  if (n < 0) return null;
  const [u, v] = AXES.filter((j) => j !== n) as [0 | 1 | 2, 0 | 1 | 2];
  const aLow = mid(a.box, n) < mid(b.box, n);
  const plane = aLow ? (a.box.max[n] + b.box.min[n]) / 2 : (a.box.min[n] + b.box.max[n]) / 2;
  return {
    a,
    b,
    n: n as 0 | 1 | 2,
    plane,
    rect: [
      [Math.max(a.box.min[u], b.box.min[u]), Math.min(a.box.max[u], b.box.max[u])],
      [Math.max(a.box.min[v], b.box.min[v]), Math.min(a.box.max[v], b.box.max[v])],
    ],
    uv: [u, v],
  };
}

function nearest(pool: Node[], p: Vec3): Node {
  let best = pool[0], bd = Infinity;
  for (const n of pool) {
    const d = Math.hypot(...([0, 1, 2] as const).map((k) => Math.max(n.box.min[k] - p[k], 0, p[k] - n.box.max[k])));
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

const longLen = (c: Contact) => Math.max(c.rect[0][1] - c.rect[0][0], c.rect[1][1] - c.rect[1][0]);

/** Evenly spaced points along the long side of a contact, centred across the short side. */
function along(c: Contact, count: number, o: { inset?: number; across?: number } = {}): Vec3[] {
  const lu = c.rect[0][1] - c.rect[0][0], lv = c.rect[1][1] - c.rect[1][0];
  const li = lu >= lv ? 0 : 1;
  const L = c.rect[li], S = c.rect[1 - li];
  const len = L[1] - L[0];
  const pad = count === 1 ? 0 : Math.min(len * (o.inset ?? 0.16), 70);
  const out: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const p: Vec3 = [0, 0, 0];
    p[c.n] = c.plane;
    p[c.uv[li]] = L[0] + pad + (len - 2 * pad) * t;
    p[c.uv[1 - li]] = o.across ?? (S[0] + S[1]) / 2;
    out.push(p);
  }
  return out;
}

/** Split a fitting count over contacts, longest contacts first. */
function share(count: number, contacts: Contact[]) {
  if (!contacts.length || count <= 0) return [];
  const sorted = [...contacts].sort((a, b) => longLen(b) - longLen(a));
  if (count <= sorted.length) return sorted.slice(0, count).map((c) => ({ c, k: 1 }));
  const total = sorted.reduce((s, c) => s + longLen(c), 0) || 1;
  const ks = sorted.map((c) => Math.max(1, Math.round((count * longLen(c)) / total)));
  let left = count - ks.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % ks.length, left--) ks[i]++;
  for (let i = ks.length - 1; left < 0; i = (i - 1 + ks.length) % ks.length) {
    if (ks[i] > 1) {
      ks[i]--;
      left++;
    }
  }
  return sorted.map((c, i) => ({ c, k: ks[i] }));
}

function defFor(f: CustomFix, thick?: number): HwDef {
  const base: HwDef = (() => {
    switch (f.kind) {
      case "dowel":
        return HW.dowel;
      case "camScrew":
        return HW.camScrew;
      case "cam":
        return HW.cam;
      case "nail":
        return HW.nail;
      case "pin":
        return HW.pin;
      case "legScrew":
        return HW.legScrew;
      case "bolt":
        return HW.boltS;
      case "plate":
        return HW.plate;
      case "bracket":
        return HW.bracket;
      case "knob":
        return HW.knob;
      case "handle":
        return HW.handle;
      case "hinge":
        return HW.hinge;
      case "glide":
        return HW.glide;
      case "clip":
        return HW.clip;
      case "strap":
        return HW.strap;
      case "nut":
        return HW.nut;
      case "washer":
        return HW.washer;
      case "stud":
        return HW.stud;
      case "clamp":
        return HW.clamp;
      case "angle":
        return HW.angle;
      case "foot":
        return HW.foot;
      case "cap":
        return HW.cap;
      case "spacer":
        return HW.spacer;
      case "runner":
        return HW.runner;
      case "hook":
        return HW.hook;
      case "plug":
        return HW.plug;
      case "connector":
        return HW.connector;
      case "castor":
        return HW.castor;
      case "flatHinge":
        return HW.flatHinge;
      case "roller":
        return HW.roller;
      case "gasLift":
        return HW.gasLift;
      default:
        return HW.screwM;
    }
  })();
  const len = f.len && f.len > 2 && f.len < 400 ? Math.round(f.len) : base.kind === "screw" && thick ? Math.round(Math.min(70, Math.max(14, thick + 16)) / 2) * 2 : base.len;
  const dia = f.dia && f.dia > 0.8 && f.dia < 60 ? Math.round(f.dia * 10) / 10 : base.dia;
  return { ...base, len, dia, ...(f.name ? { name: f.name } : {}), ...(f.included ? { notIncluded: false } : {}) };
}

function inferMaterial(p: CustomPart): PartMaterial {
  if (p.material) return p.material;
  const n = p.name.toLowerCase();
  if (/glass|mirror/.test(n)) return "glass";
  if (/back|hardboard|fibre|fiber/.test(n)) return "fiber";
  if (/cushion|pillow|mattress|seat pad|upholster/.test(n)) return "soft";
  if (/metal|steel|tube|rail|rod|bar/.test(n)) return "metal";
  if (/leg|slat|beam|rail|frame|dowel|post/.test(n)) return "wood";
  return "board";
}

const KIND_OF: Partial<Record<HwKind, StepKind>> = {
  dowel: "dowels",
  camScrew: "cams",
  cam: "cams",
  screw: "screws",
  nail: "nails",
  bolt: "bolts",
  legScrew: "legs",
  pin: "shelves",
  hinge: "hinges",
  knob: "screws",
  handle: "screws",
  bracket: "anchor",
  strap: "anchor",
  angle: "screws",
  nut: "bolts",
  stud: "bolts",
  foot: "legs",
};

const TOOLS_OF: Partial<Record<HwKind, ToolId>> = {
  camScrew: "screwdriver",
  cam: "screwdriver",
  screw: "screwdriver",
  nail: "hammer",
  bolt: "allen",
  hinge: "screwdriver",
  knob: "screwdriver",
  handle: "screwdriver",
  bracket: "drill",
  strap: "drill",
  angle: "screwdriver",
  nut: "allen",
};

export function buildCustom(b: PlanBuilder, s: ProductSpec) {
  const c = s.custom;
  if (!c || !c.parts.length) throw new Error("no parts");
  const nodes = new Map<string, Node>();
  const center: Vec3 = [0, 0, 0];
  const all = c.parts.map((p) => boxOf(p));
  const lo: Vec3 = [Math.min(...all.map((x) => x.min[0])), Math.min(...all.map((x) => x.min[1])), Math.min(...all.map((x) => x.min[2]))];
  const hi: Vec3 = [Math.max(...all.map((x) => x.max[0])), Math.max(...all.map((x) => x.max[1])), Math.max(...all.map((x) => x.max[2]))];
  for (const k of AXES) center[k] = (lo[k] + hi[k]) / 2;

  // one part type per distinct name and size, so identical panels share a letter
  const labelsOk = c.parts.every((p) => p.label && p.label.length <= 3) && new Set(c.parts.map((p) => p.label)).size === new Set(c.parts.map((p) => `${p.name}|${p.size.map(Math.round).join("x")}`)).size;
  const types = new Map<string, string>();
  for (const p of c.parts) {
    const material = inferMaterial(p);
    // a rod lies along x or z; a cylinder as wide as it is deep is a disc (a round top or seat), drawn upright
    const horizontalRod = p.shape === "cyl" && Math.max(p.size[0], p.size[2]) > p.size[1] * 1.5 && Math.abs(p.size[0] - p.size[2]) > 0.3 * Math.max(p.size[0], p.size[2]);
    const tk = `${p.name.toLowerCase()}|${p.size.map((n) => Math.round(n)).join("x")}|${p.shape ?? "box"}|${material}|${p.pieces ? JSON.stringify(p.pieces) : ""}`;
    let ref = types.get(tk);
    const turned = !!p.rot?.some((r) => r);
    const rod = horizontalRod && !turned && !p.pieces;
    if (!ref) {
      const size: Vec3 = p.shape === "cyl" && rod ? [Math.min(p.size[1], p.size[2], p.size[0]), Math.max(p.size[0], p.size[2]), Math.min(p.size[1], p.size[2], p.size[0])] : [p.size[0], p.size[1], p.size[2]];
      ref = b.part(p.name, size, { shape: p.shape ?? "box", material, label: labelsOk ? p.label : undefined, extra: p.extra });
      if (p.pieces?.length) b.parts[b.parts.length - 1].pieces = p.pieces;
      types.set(tk, ref);
    }
    const rot: Vec3 = turned ? p.rot! : rod ? (p.size[0] >= p.size[2] ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]) : [0, 0, 0];
    const key = b.place(ref, p.pos, rot);
    nodes.set(p.id, { id: p.id, part: p, key, box: boxOf(p) });
  }

  const placed: Node[] = [];
  let lastAdded: Node[] = [];
  let stepHosts: Node[] = [];
  const used: Vec3[] = [];
  const ctx: Ctx = { center, lo, hi };
  const isPlaced = (n: Node) => placed.includes(n);
  const steps = normalizeSteps(c.steps, c.parts);
  // a part a step asks to wait (it takes its fittings now, a later step joins it) stands beside the build, then moves in
  const addedAfter = (n: Node, si: number) => steps.slice(si + 1).some((x) => x.add?.includes(n.id));
  const aside = new Set<Node>();
  let pose: Pose = "+y";
  // dowels and cam bolts so far: a part they join has to arrive along them, not slide across them
  const pins: { host: Node; mate: string; dir: Vec3 }[] = [];
  const keep = (groups: Group[]) => {
    for (const g of groups) if (g.def.kind === "dowel" || g.def.kind === "camScrew") for (const f of g.fits) if (f.mate) pins.push({ host: f.host, mate: f.mate, dir: f.dir });
  };
  const arrive = (n: Node, others: Node[], given?: Vec3) => {
    const off = given ?? approach(n, others, pose);
    if (given) return off;
    const keys = new Set(others.map((o) => o.key));
    // a dowel in this part sticks out towards its mate, so the part moves against its direction; one in a part already there, the other way
    const ways = pins.flatMap((p) => (p.host === n && keys.has(p.mate) ? [p.dir] : p.mate === n.key && others.includes(p.host) ? [p.dir.map((v) => -v) as Vec3] : []));
    const axes = new Set(ways.map(major));
    if (axes.size !== 1) return off;
    const k = [...axes][0];
    if (major(off) === k && Math.sign(off[k]) === Math.sign(ways[0][k])) return off;
    return unit(k, Math.sign(ways[0][k]) * Math.hypot(...off));
  };

  steps.forEach((st, si) => {
    const adds = (st.add ?? []).map((id) => nodes.get(id)).filter((n): n is Node => !!n && !isPlaced(n));
    const fixes = (st.fix ?? []).filter((f) => f.count > 0 || f.at?.length).slice(0, 24);
    const nextPose = st.pose ?? pose;
    const turned = nextPose !== pose;
    pose = nextPose;
    const kind: StepKind = st.kind ?? (adds.length
      ? fixes.length
        ? (KIND_OF[fixes.find((f) => !PRE.includes(f.kind))?.kind ?? fixes[0].kind] ?? "join")
        : "join"
      : fixes.length
        ? (KIND_OF[fixes[0].kind] ?? "general")
        : turned
          ? pose === "+y"
            ? "standup"
            : "flip"
          : "general");
    const tools = new Set<ToolId>(st.tools ?? []);
    for (const f of fixes) {
      const t = TOOLS_OF[f.kind];
      // hex bolts tightened with the spanner: a step that names the spanner doesn't also need the Allen key
      if (t && !(t === "allen" && tools.has("wrench"))) tools.add(t);
    }
    const warnings = new Set<WarnId>(st.warnings ?? []);
    const wall = st.wall ?? fixes.some((f) => f.kind === "bracket" || f.kind === "strap");
    if (wall) {
      warnings.add("wall");
      tools.add("pencil");
      tools.add("screwdriver");
    }
    if ((st.people ?? 1) === 2) warnings.add("two");

    b.step(
      {
        title: st.title,
        detail: st.detail,
        tools: [...tools],
        people: st.people ?? 1,
        pose,
        kind,
        wall,
        repeat: st.repeat,
        check: st.check,
        warnings: [...warnings].slice(0, 3),
      },
      () => {
        const targets = new Set(fixes.flatMap((f) => f.to ?? []));
        const hits = (x: Node, y: Node) => !targets.size || targets.has(x.id) || targets.has(y.id);
        const pairs = (pool: Node[], keep: (x: Node, y: Node) => boolean) => {
          const out: Contact[] = [];
          for (let i = 0; i < pool.length; i++)
            for (let j = 0; j < i; j++) {
              if (!keep(pool[i], pool[j])) continue;
              const ct = contactOf(pool[i], pool[j]);
              if (ct) out.push(ct);
            }
          return out;
        };
        // joints made in this step, joints about to be made (dowels go in first), and joints already made (cams, screws)
        const now = adds.length ? pairs([...placed, ...adds], (x, y) => adds.includes(x) || adds.includes(y)) : [];
        const future = adds.length ? [] : lookahead(steps, si, nodes, placed);
        const soon = future.length ? pairs([...placed, ...future], (x, y) => (future.includes(x) || future.includes(y)) && hits(x, y)) : [];
        const recent = lastAdded.length ? lastAdded : placed;
        const made = pairs(placed, (x, y) => (targets.size ? hits(x, y) : recent.includes(x) || recent.includes(y)));
        const jointsFor = (f: CustomFix) => (adds.length ? now : PRE.includes(f.kind) ? (soon.length ? soon : made) : made.length ? made : soon);
        const freshFor = (f: CustomFix) => (adds.length ? adds : PRE.includes(f.kind) && soon.length ? future : recent);

        const pre = fixes.filter((f) => PRE.includes(f.kind));
        const post = fixes.filter((f) => !PRE.includes(f.kind));
        const preGroups = pre.flatMap((f) => planFits(f, jointsFor(f), freshFor(f), placed, ctx, nodes));
        keep(preGroups);

        // a part that receives fittings before it is joined shows up now, so you can see where they go
        const hosts = adds.length ? [] : [...new Set(preGroups.flatMap((g) => g.fits.map((x) => x.host)))].filter((n) => !isPlaced(n));
        const arriving = [...hosts, ...adds];
        b.stagger(arriving.length > 3 ? 0.18 : 0.26);
        const inStep: Node[] = [];
        const waiting: Node[] = [];
        const toWait = (st.wait ?? []).map((id) => nodes.get(id)).filter((n): n is Node => !!n && !isPlaced(n) && !aside.has(n) && !adds.includes(n) && addedAfter(n, si));
        const fresh = [...new Set([...hosts, ...toWait])].filter((n) => !aside.has(n));
        if (fresh.length) {
          for (const n of fresh) {
            const off = arrive(n, [...placed, ...inStep], st.from?.[n.id]);
            if (toWait.includes(n)) {
              const it = b.partItem(n.key);
              b.stage(n.key, beside(n, off, ctx), it.final.rot, off);
              aside.add(n);
              waiting.push(n);
            } else {
              b.add(n.key, off);
              inStep.push(n);
            }
          }
          b.then(0.15);
        }

        b.stagger(0.05);
        if (preGroups.length) {
          emit(b, preGroups, used);
          b.then(0.15);
        }

        b.stagger(adds.length > 3 ? 0.18 : 0.26);
        for (const n of adds) {
          b.add(n.key, arrive(n, [...placed, ...inStep], st.from?.[n.id]));
          inStep.push(n);
        }
        if (adds.length) b.then(0.12);

        b.stagger(0.05);
        for (const f of post) {
          const groups = planFits(f, jointsFor(f), freshFor(f), [...placed, ...inStep], ctx, nodes);
          keep(groups);
          emit(b, groups, used);
          b.then(0.1);
        }
        stepHosts = hosts.filter((n) => !waiting.includes(n) && !aside.has(n));
      },
    );
    placed.push(...stepHosts, ...adds);
    if (adds.length || stepHosts.length) lastAdded = [...stepHosts, ...adds];
    stepHosts = [];
  });
}

/** Where a part waits before it is joined: off to the side of the build, at the height it will end up at. */
function beside(n: Node, off: Vec3, ctx: Ctx): Vec3 {
  const pos = n.part.pos;
  const sideways = Math.abs(off[0]) + Math.abs(off[2]) > Math.abs(off[1]);
  if (sideways) return [pos[0] + off[0] * 1.6, pos[1], pos[2] + off[2] * 1.6];
  // it would arrive from above: hold it next to the build instead, on the side it sits nearest
  const half = (ctx.hi[0] - ctx.lo[0]) / 2;
  const sx = pos[0] >= ctx.center[0] ? 1 : -1;
  return [ctx.center[0] + sx * (half + ext(n.box, 0) / 2 + 180), pos[1], pos[2]];
}

/** Parts the next step attaches, so hardware-only steps ("tap in the dowels") land where those joints will be. */
function lookahead(steps: CustomStep[], si: number, nodes: Map<string, Node>, placed: Node[]): Node[] {
  for (let j = si + 1; j < Math.min(steps.length, si + 4); j++) {
    const next = (steps[j].add ?? []).map((id) => nodes.get(id)).filter((n): n is Node => !!n && !placed.includes(n));
    if (next.length) return next;
  }
  return [];
}

/** The axis a vector mostly points along. */
function major(v: Vec3): number {
  const a = v.map(Math.abs);
  return a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
}

function approach(n: Node, others: Node[], pose: Pose): Vec3 {
  let best: Contact | null = null;
  let bestLen = 0;
  for (const o of others) {
    const ct = contactOf(n, o);
    if (ct && longLen(ct) > bestLen) {
      best = ct;
      bestLen = longLen(ct);
    }
  }
  const size = Math.max(...n.part.size);
  const d = Math.min(520, Math.max(240, size * 0.45));
  if (!best) return unrotate([0, d, 0], POSE_EULER[pose]).map((x) => Math.round(x)) as Vec3;
  const k = best.n;
  const away = mid(n.box, k) < mid(best.b.box, k) ? -1 : 1;
  return unit(k, away * d);
}

interface Fit extends FitOpts {
  host: Node;
  slide?: number;
}
interface Group {
  def: HwDef;
  fits: Fit[];
}
interface Ctx {
  center: Vec3;
  lo: Vec3;
  hi: Vec3;
}

/** Work out where each fitting of one kind goes. Nothing is emitted yet, so the step can show the host parts first. */
function planFits(f: CustomFix, contacts: Contact[], fresh: Node[], placed: Node[], ctx: Ctx, nodes?: Map<string, Node>): Group[] {
  if (f.at?.length && nodes) {
    // placed by hand: each point, going in the given way (down by default), in the named part or the nearest one
    const dir: Vec3 = f.dir ?? [0, -1, 0];
    const pool = [...fresh, ...placed];
    const fits: Fit[] = f.at.map((at) => {
      const host = (f.on && nodes.get(f.on)) || nearest(pool.length ? pool : [...nodes.values()], at);
      const mate = f.mate ? nodes.get(f.mate) : undefined;
      return { on: host.key, host, at, dir, mate: mate?.key, twist: f.twist, hole: f.kind === "nail" || f.kind === "glide" || f.kind === "clip" ? false : undefined };
    });
    return [{ def: defFor(f), fits }];
  }
  const count = Math.min(48, Math.max(1, Math.round(f.count)));
  const to = new Set(f.to ?? []);
  const pick = to.size ? contacts.filter((c) => to.has(c.a.id) || to.has(c.b.id)) : contacts;
  const list = pick.length ? pick : contacts;
  const thinner = (c: Contact) => (ext(c.a.box, c.n) <= ext(c.b.box, c.n) ? c.a : c.b);
  const otherOf = (c: Contact, x: Node) => (x === c.a ? c.b : c.a);
  const into = (c: Contact, x: Node) => unit(c.n, mid(x.box, c.n) > c.plane ? 1 : -1);
  const fits: Fit[] = [];
  let slide: number | undefined;
  const one = (host: Node, o: FitOpts) => fits.push({ ...o, on: host.key, host, slide });
  const longAxis = (c: Contact) => (c.rect[0][1] - c.rect[0][0] >= c.rect[1][1] - c.rect[1][0] ? c.uv[0] : c.uv[1]);

  switch (f.kind) {
    case "dowel":
    case "camScrew": {
      for (const { c, k } of share(count, list)) {
        // dowels go into the part already standing (or the panel whose edge meets the joint), cam bolts into the face
        slide = longAxis(c);
        const named = to.has(c.a.id) ? c.a : to.has(c.b.id) ? c.b : null;
        const host = named ?? (f.kind === "camScrew" ? thinner(c) : placed.includes(c.b) && !placed.includes(c.a) ? c.b : thinner(c));
        for (const p of along(c, k, { inset: f.kind === "dowel" ? 0.3 : 0.1 })) one(host, { at: p, dir: into(c, host), mate: otherOf(c, host).key });
      }
      break;
    }
    case "cam": {
      for (const { c, k } of share(count, list)) {
        slide = longAxis(c);
        const face = thinner(c);
        const edge = otherOf(c, face);
        const t = ([0, 1, 2] as const).filter((x) => x !== c.n).reduce((a, x) => (ext(edge.box, x) < ext(edge.box, a) ? x : a), c.uv[0]);
        const inward = mid(edge.box, t) > ctx.center[t];
        for (const p of along(c, k, { inset: 0.1 })) {
          const q: Vec3 = [...p];
          const depth = Math.min(30, ext(edge.box, c.n) / 3);
          q[c.n] += mid(edge.box, c.n) > c.plane ? depth : -depth;
          q[t] = inward ? edge.box.min[t] : edge.box.max[t];
          one(edge, { at: q, dir: unit(t, inward ? 1 : -1) });
        }
      }
      break;
    }
    case "pin": {
      for (const { c, k } of share(count, list)) {
        // a shelf rests on pins pushed into the side it touches
        const shelf = ext(c.a.box, 1) <= ext(c.b.box, 1) ? c.a : c.b;
        const side = otherOf(c, shelf);
        for (const q of along(c, k, { inset: 0.12 })) {
          if (c.n !== 1) q[1] = shelf.box.min[1] - 4;
          one(side, { at: q, dir: into(c, side), hole: false });
        }
      }
      break;
    }
    case "legScrew":
    case "plate": {
      for (const { c } of share(count, list)) {
        const leg = ext(c.a.box, c.n) >= ext(c.b.box, c.n) ? c.a : c.b;
        const top = otherOf(c, leg);
        const p = along(c, 1)[0];
        if (f.kind === "legScrew") one(leg, { at: p, dir: into(c, leg), mate: top.key });
        else one(top, { at: p, dir: into(c, top), hole: false });
      }
      break;
    }
    case "knob":
    case "handle": {
      const pool = to.size ? [...fresh, ...placed].filter((n) => to.has(n.id)) : fresh.length ? fresh : placed;
      const fronts = pool.filter((n) => n.box.max[2] >= ctx.hi[2] - 30);
      for (const n of (fronts.length ? fronts : pool).slice(0, count)) {
        const tall = ext(n.box, 1) > ext(n.box, 0) * 1.3;
        const x = tall ? (mid(n.box, 0) > ctx.center[0] ? n.box.min[0] + 40 : n.box.max[0] - 40) : mid(n.box, 0);
        const y = tall ? n.box.min[1] + ext(n.box, 1) * 0.55 : mid(n.box, 1);
        one(n, { at: [x, y, n.box.max[2]], dir: [0, 0, -1], hole: false, twist: f.kind === "handle" && tall ? Math.PI / 2 : 0 });
      }
      break;
    }
    case "hinge": {
      for (const { c, k } of share(count, list)) {
        const door = thinner(c);
        for (const q of along(c, Math.max(2, k), { inset: 0.12 }).slice(0, k)) one(door, { at: q, dir: into(c, door), twist: mid(door.box, 0) > ctx.center[0] ? Math.PI : 0 });
      }
      break;
    }
    case "glide": {
      // felt pads go under the corners of the whole footprint
      const floor = [...fresh, ...placed].filter((n, i, a) => n.box.min[1] < 3 && a.indexOf(n) === i);
      const corners: [number, number][] = [
        [ctx.lo[0], ctx.lo[2]],
        [ctx.hi[0], ctx.lo[2]],
        [ctx.hi[0], ctx.hi[2]],
        [ctx.lo[0], ctx.hi[2]],
      ];
      for (const [cx, cz] of corners.slice(0, count)) {
        let best: { n: Node; p: Vec3; d: number } | null = null;
        for (const n of floor) {
          const ix = Math.min(25, ext(n.box, 0) / 4), iz = Math.min(25, ext(n.box, 2) / 4);
          const p: Vec3 = [Math.min(n.box.max[0] - ix, Math.max(n.box.min[0] + ix, cx)), 0, Math.min(n.box.max[2] - iz, Math.max(n.box.min[2] + iz, cz))];
          const d = Math.hypot(p[0] - cx, p[2] - cz);
          if (!best || d < best.d) best = { n, p, d };
        }
        if (best) one(best.n, { at: best.p, dir: [0, 1, 0], hole: false });
      }
      break;
    }
    case "bracket":
    case "strap": {
      const top = [...placed, ...fresh].reduce<Node | null>((a, n) => (!a || n.box.max[1] > a.box.max[1] ? n : a), null);
      if (top) {
        const n = Math.min(count, ext(top.box, 0) > 1000 ? 2 : 1);
        for (let i = 0; i < n; i++) {
          const x = n === 1 ? mid(top.box, 0) : top.box.min[0] + (ext(top.box, 0) * (i + 1)) / 3;
          one(top, { at: [x, top.box.max[1], top.box.min[2] + 16], dir: [0, -1, 0], travel: 60 });
        }
      }
      break;
    }
    default: {
      // screws, bolts and nails go through the thinner part into the other one
      const groups: Group[] = [];
      for (const { c, k } of share(count, list)) {
        const through = thinner(c);
        const other = otherOf(c, through);
        const dir = into(c, other);
        const face = dir[c.n] > 0 ? through.box.min[c.n] : through.box.max[c.n];
        const g: Group = { def: defFor(f, ext(through.box, c.n)), fits: [] };
        const sl = longAxis(c);
        for (const p of along(c, k, { inset: 0.14 })) {
          const q: Vec3 = [...p];
          q[c.n] = face;
          g.fits.push({ on: through.key, host: through, slide: sl, at: q, dir, mate: other.key, hole: f.kind === "nail" ? false : undefined });
        }
        groups.push(g);
      }
      return groups;
    }
  }
  return fits.length ? [{ def: defFor(f), fits }] : [];
}

const STACKS: HwKind[] = ["washer", "nut", "cap", "clamp"];

/** Emit fittings, nudging any that would sit on top of one placed earlier. */
function emit(b: PlanBuilder, groups: Group[], used: Vec3[]) {
  const total = groups.reduce((s, g) => s + g.fits.length, 0);
  for (const g of groups) {
    const list: FitOpts[] = g.fits.map(({ host, slide, ...o }) => {
      const at: Vec3 = [...o.at];
      // moved along the joint, a fitting has to stay on the part it goes into
      const onHost = (p: Vec3) => [0, 1, 2].every((k) => o.dir[k] !== 0 || (p[k] >= host.box.min[k] - 1 && p[k] <= host.box.max[k] + 1));
      const free = (p: Vec3) => used.every((u) => Math.hypot(u[0] - p[0], u[1] - p[1], u[2] - p[2]) > 22);
      // washers, nuts and caps go on the bolt already there, so they share its point
      if (!STACKS.includes(g.def.kind) && !free(at)) {
        const axis = slide !== undefined ? [slide] : [0, 1, 2].filter((k) => !o.dir[k]);
        search: for (const step of [36, -36, 72, -72]) {
          for (const k of axis) {
            const p: Vec3 = [...at];
            p[k] += step;
            if (free(p) && onHost(p)) {
              at[0] = p[0];
              at[1] = p[1];
              at[2] = p[2];
              break search;
            }
          }
        }
      }
      // a washer, nut or cap shares its bolt's point, so it never pushes the bolt listed after it off that point
      if (!STACKS.includes(g.def.kind)) used.push(at);
      return { ...o, at };
    });
    b.fits(g.def, list, Math.min(0.07, 2.4 / Math.max(1, total)));
  }
}

/** Every part gets added exactly once, in order, and steps stay short enough to follow. */
function normalizeSteps(steps: CustomStep[], parts: CustomPart[]): CustomStep[] {
  const seen = new Set<string>();
  const ids = new Set(parts.map((p) => p.id));
  const out: CustomStep[] = steps.slice(0, 80).map((s) => {
    const add = (s.add ?? []).filter((id) => ids.has(id) && !seen.has(id));
    add.forEach((id) => seen.add(id));
    return { ...s, add };
  });
  const missing = parts.filter((p) => !seen.has(p.id)).map((p) => p.id);
  if (missing.length) {
    const last = [...out].reverse().find((s) => s.add && s.add.length);
    if (last && missing.length <= 2) last.add = [...(last.add ?? []), ...missing];
    else out.push({ title: "Fit the remaining parts", detail: "Check each one against the drawing before you fix it.", add: missing });
  }
  if (!out.length) out.push({ title: "Put it together", add: parts.map((p) => p.id) });
  return out;
}
