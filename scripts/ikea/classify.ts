/**
 * Decides what each IKEA product is in our terms: a Kind plus parameters and an outer size,
 * or a reason we can't draw it believably yet. Used by build.ts and check.ts.
 */
import { KIND_ARCH, KIND_DEFAULT_SIZE, type Kind, type X } from "@/lib/products";
import { metric } from "./us";

/** One IKEA product (all its colours) as fetch.ts keeps it. */
export interface Fact {
  name: string;
  type: string;
  size: string;
  /** article numbers of every colour, single articles first */
  items: string[];
  spr: boolean;
  cats: string[];
  /** the measurements on the product's own page (measure.ts), when it has been read */
  m?: Record<string, string>;
}

export interface Draw {
  kind: Kind;
  x: X;
  w: number;
  h: number;
  d: number;
  /** IKEA's own type name, shown as the start of the variant */
  label: string;
  /** readable size for the variant, e.g. "80 × 28 × 202 cm" */
  size: string;
  kw: string[];
  /** which of w/h/d came from defaults rather than IKEA's measure */
  guessed: { w: boolean; h: boolean; d: boolean };
  /** which of w/h/d the listing left out and the product page filled in: matching treats them as unknown, so a
   * product keeps the guide (and the link) it had before its page was read */
  paged?: { w: boolean; h: boolean; d: boolean };
  /** one of the ADDED products: its own guide, never merged into a hand made entry */
  own?: boolean;
}

export type Verdict = { draw: Draw } | { skip: string };

/** What an existing hand made row of the same family says, used as defaults. */
export interface Hint {
  kind: Kind;
  x: X;
  w: number;
  h: number;
  d: number;
}
export type Hints = (family: string, kind: Kind) => Hint | undefined;

const BEDS: Record<string, [number, number]> = {
  single: [90, 190],
  "standard single": [90, 190],
  "small double": [120, 190],
  double: [135, 190],
  "standard double": [135, 190],
  king: [150, 200],
  "standard king": [150, 200],
  "super king": [180, 200],
};

interface Size {
  n: number[];
  ext: boolean;
  bed?: [number, number];
  text: string;
}

/**
 * IKEA's measure text: "77x147 cm", "80x28x202 cm" (w x d x h), "150/200x80 cm", "Standard Double". The US range's
 * inches ("30 3/8x15 3/8 \"", "29 ½ \"") and inches given with cm are read in cm.
 */
export function measure(s: string): Size | null {
  if (/"/.test(s)) {
    const cm = metric(s);
    return cm === null || /"/.test(cm) ? null : measure(cm);
  }
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return { n: [], ext: false, text: "" };
  const bed = BEDS[t.toLowerCase()];
  if (bed) return { n: [], ext: false, bed, text: t.replace(/\bking\b/, "King") };
  const g = "(\\d+(?:\\.\\d+)?(?:/\\d+(?:\\.\\d+)?)*)";
  const m = t.match(new RegExp(`^${g}(?:x${g})?(?:x${g})? cm$`));
  if (!m) return null;
  const parts = [m[1], m[2], m[3]].filter(Boolean) as string[];
  return { n: parts.map((p) => Number(p.split("/")[0])), ext: parts.some((p) => p.includes("/")), text: parts.join(" × ") + " cm" };
}

const UPRIGHT = new Set<Kind>(["extension", "cube", "bookcase", "open", "chest", "nightstand", "wardrobe", "cabinet", "sideboard", "tv", "shoe", "wallcab", "wallshelf", "kitchen", "mixed", "sliding", "slidecab", "washstand", "sinkcab", "appliance", "shoerack", "clothesrack", "changing", "divider"]);
const FLAT = new Set<Kind>(["desk", "coffee", "side", "dining", "bar", "console", "kidstable", "trolley", "bench", "conftable"]);

/** Stools that are really a pouffe: a padded or woven drum on the floor. */
const POUFFE_STOOL = new Set(["ALSEDA"]);
/** Office chairs IKEA sells with armrests although the type doesn't say so. */
const OFFICE_ARMS = new Set(["MARKUS", "ALEFJÄLL"]);
/** Office chairs with a tall back and a headrest. */
const OFFICE_TALL = new Set(["MARKUS"]);
/** How deep the top of a family's corner desk is along each wall, when it isn't the usual 60 cm. */
const DESK_DEPTH: Record<string, number> = { MICKE: 50 };
/** Swivel easy chairs that are a shell with no armrests. */
const SWIVEL_SHELL = new Set(["DYVLINGE", "IKEA PS LÖMSK"]);
/** Gateleg tables with drawers in the middle, which we can't draw, and ones with a storage shelf and loose leaves. */
const GATE_DRAWERS = new Set(["NORDEN"]);
const GATE_STORAGE = new Set(["VIHALS"]);
/** The frame a family's combinations are rows of, in cm: two BILLY 80s, two BESTÅ 120s, two PAX 100s. */
const ROW_UNITS: Record<string, number> = { BILLY: 80, BESTÅ: 120, IVAR: 80, PAX: 100 };
/** PAX frames under a pair of sliding doors: 150 is two 75s, 200 two 100s. */
const PAX_SLIDE_UNITS = [100, 75];
/** The frame widths a family's combinations are made of, widest first, and the post two IVAR sections share. */
const FRAME_SIZES: Record<string, number[]> = { BILLY: [80, 40], PAX: [100, 75, 50], IVAR: [89, 48], BROR: [85, 65], OMAR: [92, 46] };
const SHARED_POST: Record<string, number> = { IVAR: 3 };

/** Two to four frames of these widths that make up w, give or take 2 cm: the fewest frames, the widest first. */
function framesFor(w: number, sizes: number[], post = 0, most = 4): number[] | null {
  let best: number[] | null = null;
  const walk = (left: number[], from: number) => {
    const n = left.length;
    if (n >= 2) {
      const total = left.reduce((a, v) => a + v, 0) - post * (n - 1);
      if (Math.abs(total - w) <= 2 && (!best || n < best.length)) best = [...left];
    }
    if (n === most) return;
    for (let i = from; i < sizes.length; i++) walk([...left, sizes[i]], i);
  };
  walk([], 0);
  return best;
}

/** Exactly `count` frames of these widths that make up w, give or take 2 cm, the widest first (IVAR's share a post). */
function framesExact(w: number, sizes: number[], count: number, post = 0): number[] | null {
  let found: number[] | null = null;
  const walk = (left: number[], from: number) => {
    if (found) return;
    if (left.length === count) {
      if (Math.abs(left.reduce((a, v) => a + v, 0) - post * (count - 1) - w) <= 2) found = [...left];
      return;
    }
    for (let i = from; i < sizes.length; i++) walk([...left, sizes[i]], i);
  };
  walk([], 0);
  return found;
}

/** Frames for one leg of a corner wardrobe: the frames that come closest to `len` cm, and how far off they are. */
function legFrames(len: number, sizes: number[], least: number): [number[], number] {
  let best: [number[], number] = [[], Infinity];
  const walk = (left: number[], from: number) => {
    const off = Math.abs(left.reduce((a, v) => a + v, 0) - len);
    if (left.length >= least && off < best[1]) best = [[...left], off];
    if (left.length === 3) return;
    for (let i = from; i < sizes.length; i++) walk([...left, sizes[i]], i);
  };
  walk([], 0);
  return best;
}

/**
 * How a PAX corner wardrobe of these two legs (cm) is laid out: frames along the back wall, an add-on corner unit 53 cm wide
 * with its back to the side wall, tucked in beside the first frame, and frames along the side wall after it. The corner unit
 * comes 35 or 58 cm deep. Picks the layout whose frames come closest to IKEA's legs, either way round.
 */
function cornerLayout(a: number, c: number, sizes: number[]) {
  let best: { back: number; side: number; u: number[]; v: number[]; cu: number; off: number } | undefined;
  for (const [back, side] of [[a, c], [c, a]])
    for (const cu of [35, 58]) {
      const [u, offU] = legFrames(back - cu - 0.5, sizes, 1);
      const [v, offV] = legFrames(side - cu - 0.5 - 52.5, sizes, 0);
      const start = back - u.reduce((s, x) => s + x, 0), zc = side - v.reduce((s, x) => s + x, 0) - 53;
      // the corner unit must not run into the first frame along the back wall
      if (zc < 0 || (start < cu - 1 && zc < 57)) continue;
      const off = offU + offV;
      if (!best || off < best.off - 0.01) best = { back, side, u, v, cu, off };
    }
  return best && best.off <= 8 ? best : undefined;
}
/** Wash-stands' own height in cm, to tell how thick a basin from the same box is; and the ones that stand on the floor. */
const WASH_H: Record<string, number> = { HAVBÄCK: 63, ÄNGSJÖN: 63, TÄNNFORSEN: 63, HEMNES: 83, ENHET: 60, NYSJÖN: 65 };
const WASH_FLOOR = new Set(["HEMNES", "NYSJÖN"]);
/** Clothes racks IKEA lists without a size (w, h, d), from its product pages; RIGGA's height is set at its tallest. */
const RACK_SIZE: Record<string, [number, number, number]> = { RIGGA: [111, 175, 51] };
/** Day-beds' outer size (w, h, d) from IKEA's product pages: IKEA's measure is only the mattress size. */
const DAYBED_SIZE: Record<string, [number, number, number]> = { HEMNES: [210, 83, 91], BRIMNES: [205, 58, 87], FLEKKE: [207, 86, 91], VIHALS: [206, 75, 86] };
/** Blind corner base cabinets: how wide the door at the open end is, in cm (IKEA gives only the whole width). */
const BLIND_DOOR: Record<string, number> = { METOD: 60, KNOXHULT: 50 };
/** Corner base cabinets IKEA measures wide by high, with the worktop on top, and how deep they are. */
const CORNER_WH: Record<string, number> = { KNOXHULT: 61 };
/** Modular chests: how wide a column is and how tall a drawer slot is, in cm (a NORDLI chest is 7 cm of top and plinth). */
const MODULE: Record<string, [number, number, number]> = { NORDLI: [40, 23, 7] };
/** Shelving units with a cabinet at the bottom: how high the cabinet is, in cm. */
const CABINET_LOW: Record<string, number> = { BROR: 72, KOLBJÖRN: 81 };
/** Pieces IKEA gives no size for, by type: typical ones (w, h, d). */
const TYPICAL: Record<string, [number, number, number]> = {
  "trolley table with storage": [50, 52, 50],
  "drawer unit w 3 drawers on castors": [42, 61, 51],
  "drawer unit": [30, 56, 34],
  "bedside table": [45, 55, 38],
};
/** Boxes with a lid IKEA gives no size for, or only part of one (w, h, d): typical ones of each kind. */
const LIDBOX_SIZE: Record<string, [number, number, number]> = {
  "Footstool with storage": [62, 42, 42],
  "Pouffe with storage": [38, 38, 38],
  "Storage stool": [36, 46, 36],
  "Storage table": [98, 50, 50],
};

type Pick = { kind: Kind; x?: X } | string;
type Rule = [RegExp, (m: RegExpMatchArray, c: Ctx) => Pick];

interface Ctx {
  f: Fact;
  sz: Size;
  kids: boolean;
  multi: boolean;
}

const n = (s: string | undefined, d: number) => (s ? Number(s) : d);

/** Doors from a type name: none for frames and open shelves, one for "with door", else left to the width. */
function doors(t: string): Pick | X {
  const count = t.match(/\b(\d) (glass )?(doors|drs)\b/);
  if (count && Number(count[1]) > 3) return "more than 3 doors";
  // a frame on its own is sold empty: no shelves in it either
  if (/(^| )frame$/.test(t) && !/doors?$|drs$/.test(t)) return { doors: 0, shelves: 0 };
  if (/shelves$|^open |^frame /.test(t) && !/doors?$|drs$/.test(t)) return { doors: 0 };
  if (/(^| )(glass )?door$/.test(t)) return { doors: 1 };
  return {};
}
const withDoors = (kind: Kind, t: string): Pick => {
  const x = doors(t);
  return typeof x === "string" ? x : { kind, x: x as X };
};

/** METOD combinations whose second name is a drawer system: the fronts are drawers, not doors. */
const DRAWER_SYSTEM = /\b(MAXIMERA|KNIVSHULT)\b/;
const doorsFor = (c: Ctx) => ((c.sz.n[0] ?? 60) >= 80 ? 2 : 1);
/** A high cabinet's front: what's under the appliance, a 60 cm opening, and a door over it when there's room. */
function tallFront(c: Ctx, use: NonNullable<X["use"]>, low: string, top: string): Pick {
  const h = c.sz.n[2] ?? 200;
  return { kind: "appliance", x: { use, z: `${low}+g@60${h - 140 >= 20 ? `+${top}` : ""}` } };
}

/** Most specific first. A string result is the reason to skip. */
const RULES: Rule[] = [
  // kitchen base cabinets for a sink: rails across the top, doors or drawers, and a fixed front that hides the sink
  // (IKEA writes some of these with a "+", which isn't a set here)
  [/^base cabinet for sink(?: \+ (\d) doors)?$/, (m, c) => ({ kind: "sinkcab", x: { z: `d${m[1] ? Math.min(2, Number(m[1])) : doorsFor(c)}` } })],
  [/^base cabinet f sink w (?:(\d) )?doors?\/front$/, (m) => ({ kind: "sinkcab", x: { z: `d${m[1] ? Math.min(2, Number(m[1])) : 1}@60+f@20` } })],
  [/^base cab f tallsjön sink$/, (_m, c) => ({ kind: "sinkcab", x: { z: DRAWER_SYSTEM.test(c.f.name) ? "r1@60+f@20" : `d${doorsFor(c)}@60+f@20` } })],
  // a sink with its own front (HAVSEN) fills the top of the cabinet
  [/^base cab f havsen (single|double) bowl sink$/, (m) => ({ kind: "sinkcab", x: { z: `d${m[1] === "double" ? 2 : 1}@60+a@20` } })],
  [/^base cb f havsen snk\/\d frnts\/(\d) drws$/, (m) => ({ kind: "sinkcab", x: { z: `r${m[1]}@60+a@20` } })],
  [/^base cab f sink\+(\d) fronts\/(\d) drawers$/, (m) => ({ kind: "sinkcab", x: { z: Number(m[1]) > Number(m[2]) ? `r${m[2]}@60+f@20` : `r${m[2]}` } })],
  [/^(?:base cab f sink\/waste sorting|sink cabinet with (?:door|organiser))$/, (_m, c) => ({ kind: "sinkcab", x: { z: `d${doorsFor(c)}` } })],
  // frames sold without fronts
  [/^base cb f (?:built-in appliances\/)?sink$/, () => ({ kind: "sinkcab", x: { z: "o" } })],
  // kitchen base cabinets full of drawers, one per front (a front can hide an inner drawer), and frames sold without fronts
  [/^base cabinet with (\d) drawers$|^base cb w (\d) drawers$/, (m) => ({ kind: "kitchen", x: { z: `r${m[1] ?? m[2]}` } })],
  [/^base (?:cab|cb) (?:with )?(\d) (?:frnts|fronts)\/.*\bdr(?:awers|wrs|w)$/, (m) => ({ kind: "kitchen", x: { z: `r${m[1]}` } })],
  // METOD cabinets with doors over drawers, standing or on the wall (a front can hide an inner drawer)
  [/^hi cab w 2 doors\/(\d) drawers$/, (m) => ({ kind: "kitchen", x: { z: `r${m[1]}@80+d1s1@80+d1s1` } })],
  [/^wall cab(?:inet)? (?:w|with) (?:(\d) )?(?:glass )?doors?\/(\d) drawers$/, (m) => ({ kind: "wallcab", x: { z: `r${m[2]}@40+d${m[1] ? 2 : 1}s1`, hung: true } })],
  [/^hi cab f micro w door\/(\d) drawers$/, (m) => ({ kind: "appliance", x: { use: "microwave", z: `r${m[1]}@80+g@40+d1` } })],
  [/^hi cab w shlvs\/\d drawers\/dr\/(\d) frnts$/, (m) => ({ kind: "kitchen", x: { z: `r${m[1]}@80+d1s3` } })],
  [/^base cabinet$/, () => ({ kind: "kitchen", x: { doors: 0 } })],
  // a kitchen island with a rack, and an outdoor kitchen unit with a back panel, rising from the back of the top
  [/^kitchen island with rack$/, (_m, c) => ({ kind: "trolley", x: { up: Math.max(40, (c.sz.n[2] ?? 190) - 90), cat: "Kitchen island" } })],
  [/^kitchen island w back panel$/, (_m, c) => ({ kind: "kitchen", x: { doors: 0, shelves: 1, up: Math.max(40, (c.sz.n[2] ?? 176) - 90), cat: "Outdoor kitchen unit" } })],
  // open units of an outdoor kitchen: a frame with a shelf and no doors
  [/^(open kitchen unit|kitchen island shelf unit)$/, () => ({ kind: "kitchen", x: { doors: 0, shelves: 1, cat: "Outdoor kitchen unit" } })],
  [/^base cb w shelf$/, () => ({ kind: "kitchen", x: { doors: 0, shelves: 1 } })],
  [/^high fr w shelves$/, () => ({ kind: "kitchen", x: { doors: 0 } })],
  // cabinets with room for an oven, a fridge or a microwave, and base cabinets under a hob: the appliance is fitted afterwards
  [/^high cabinet f built-in appliances$/, (_m, c) =>
    tallFront(c, "appliance", DRAWER_SYSTEM.test(c.f.name) ? "r2@80" : c.f.spr ? "d1@80" : "o@80", c.f.spr ? "d1" : "o")],
  [/^high cab f oven w 2 doors\/shelves$/, (_m, c) => tallFront(c, "oven", "d1s1@80", "d1s1")],
  [/^(?:high cab f oven w door|high cabinet f oven\+door)\/(\d) drawers$/, (m, c) => tallFront(c, "oven", `r${m[1]}@80`, "d1")],
  [/^high cabinet w (\d) drawers for oven$/, (m, c) => tallFront(c, "oven", `r${m[1]}@80`, "d1")],
  [/^hi cab f ov w dr\/(\d) frnts?\//, (m, c) => tallFront(c, "oven", `r${m[1]}@80`, "d1")],
  [/^high cab f micro w 2 doors\/shelves$/, () => ({ kind: "appliance", x: { use: "microwave", z: "d1s2@100+g@40+d1s1" } })],
  // fridges and freezers: the appliance's own door is fixed to the cabinet door, by its own instructions
  [/^(?:hi|high) cab(?:inet)? f(?:or)? fridge(?:(?: or |\/)freezer)?(?: w(?:ith)? (?:(\d) )?(doors?|drs))?$/, (m, c) => {
    const n = m[1] ? Number(m[1]) : m[2] === "door" ? 1 : m[2] ? 2 : c.f.spr ? ((c.sz.n[2] ?? 200) >= 140 ? 2 : 1) : 0;
    if (n > 3) return "fridge cabinet with more than 3 doors";
    return { kind: "appliance", x: { use: "fridge", z: ["g+o@40", "d1", "d1+d1@60", "d1+d1+d1@60"][n] } };
  }],
  [/^base cabinet f built-in appliances$/, (_m, c) => ({ kind: "appliance", x: { use: "appliance", z: DRAWER_SYSTEM.test(c.f.name) ? "r1@20+g@60" : "o@20+g@60" } })],
  [/^base cabinet for oven with drawer$/, () => ({ kind: "appliance", x: { use: "oven", z: "r1@20+g@60" } })],
  [/^base cab for hob\+oven w drawer$/, () => ({ kind: "appliance", x: { use: "ovenhob", z: "r1@20+g@60" } })],
  [/^base cab f hob\/(\d) fronts\/\d drawers$/, (m) => ({ kind: "appliance", x: { use: "hob", z: `r${m[1]}` } })],
  [/^base cab f hob\/.*(wire|extractor)/, (m) => (m[1] === "wire" ? "base cabinet for a hob with wire baskets" : "base cabinet for a hob with a built-in extractor")],
  [/^wall cabinet for microwave oven$/, () => ({ kind: "appliance", x: { use: "microwave", z: "g@40+d1", hung: true } })],
  [/^wall cb f extr hood w shlf\/door$/, () => ({ kind: "appliance", x: { use: "hood", z: "d1s1", hung: true } })],
  [/^wall cabinet f b-in extractor hood$/, () => ({ kind: "appliance", x: { use: "hood", z: "o", hung: true } })],
  [/^top cabinet for fridge\/freezer$/, () => ({ kind: "appliance", x: { use: "fridge", z: "d1", hung: true } })],
  // cabinets with doors and drawers: the drawers under the doors, or one drawer above the door of a kitchen base cabinet
  [/^(glass-door cabinet with|high cabinet w gls-drs and) (\d) drawers?$/, (m) => ({ kind: "mixed", x: { rows: Number(m[2]) } })],
  [/^wardrobe with (\d) doors and (\d) drawers$/, (m) => (Number(m[1]) > 2 ? "wardrobe with more than 2 doors and drawers" : { kind: "mixed", x: { doors: Number(m[1]) as 1 | 2, rows: Number(m[2]), rail: true } })],
  [/^base cabinet with drawer\/(2 )?doors?$/, (m) => ({ kind: "mixed", x: { doors: m[1] ? 2 : 1, rows: 1, dtop: true } })],
  // kitchen corner cabinets: an L with a door that folds at the inner corner, or a long blind corner with a door at its
  // open end, a drawer over it in some (the carousels, shelves and fittings sold alone stay skipped)
  [/^corner (base|wall) cab(?:inet)?(?: (?:with|w) (shelf|shelves|carousel|pull-out fitting|drawer and p-out|drawer and shelf)(?:\/glass dr)?)?$/, (m, c) => {
    const family = c.f.name.split(" / ")[0].trim();
    const what = m[2] ?? "";
    const x: X = {};
    if (m[1] === "wall") x.hung = true;
    else if ((c.sz.n[0] ?? 0) >= 100) x.blind = BLIND_DOOR[family] ?? 60;
    // a METOD frame on its own comes without a door or shelves
    if (!what && family === "METOD" && !c.f.spr) x.doors = 0;
    if (/shel/.test(what) || (!what && x.blind && x.doors !== 0)) x.shelves = x.hung ? Math.max(1, Math.round(((c.sz.n[1] ?? 80) - 20) / 30)) : 1;
    if (what === "carousel") x.inner = "carousel";
    if (/p(ull)?-out/.test(what)) x.inner = "pullout";
    if (/drawer/.test(what)) x.rows = 1;
    return { kind: "cornercab", x };
  }],
  // an armchair with its footstool: one guide for the two of them
  [/^(?:armchair|high-back armchair|wing chair) (?:and|with) footstool$/, () => ({ kind: "armchair", x: { foot: true, cat: "Armchair with footstool" } })],
  // why the last single pieces stay skipped: parts of a system sold alone, folding pieces, and pieces sold with others
  [/^side unit$/, () => "upright of a shelving system sold alone"],
  [/^(adjustable clothes rail|clothes bar)$/, () => "rail that fits inside a wardrobe or a storage system"],
  [/^rack for kitchen island$/, () => "rack sold alone for a kitchen island"],
  [/^(slatted bed base|mattress base|headboard|midbeam|guard rail|chair underframe)$/, () => "part sold alone"],
  [/^storage trunk$/, () => "box or storage trunk"],
  [/^tv bench with underframe$/, () => "cube shelf with door inserts"],
  [/^\d sec\/storage unit w foldable table$|^bookcase with foldable table$|^kitchen island w side table$|^wall-mounted drop-leaf table$|^pull-out desk$|^gateleg desk$/, () => "piece with a table that folds out"],
  [/^changing tbl\/bookshelf w \d shlf ut$/, () => "changing table sold with shelf units"],
  [/^bench with toy storage$|module with storage$/, () => "seat sold with storage boxes"],
  [/^stackable bed with \d mattresses$/, () => "two stackable beds sold together"],
  [/^(trundle bed|underbed|underbed with storage|bed frame with 1 trundle bed|bed frame, \d stor box\/\d trundle bed|extendable bed with storage|extendable bed w stor\/\d mattresses|guest bed)$/, () => "trundle, underbed or folding bed"],
  [/^mini-kitchen$/, () => "appliance, sink, tap or hood"],
  [/^kitchen$/, () => "set or combination"],
  // a hat and coat stand is one piece, whatever its name says
  [/^(hat and coat stand|clothes stand|coat stand)$/, () => ({ kind: "coatstand" })],
  // things that are several products, or only part of one
  // an armchair that rocks as it swivels is one chair, whatever its name says
  [/^rocking and swivel armchair$/, () => ({ kind: "swivel", x: { rock: true } })],
  [/\b(and|set of \d|sets?)\b|\+|combination|\bcomb\b|\bchairs\b|armchairs|benches/, () => "set or combination"],
  // office and swivel chairs: a star base on castors, a gas lift, the seat on top
  [/^(office chair( with armrests| with arm\/headrest)?|swivel chair( with armrests)?|gaming chair|children's desk chair)$/, (m, c) => {
    const family = c.f.name.split(" / ")[0].trim();
    const arms = /arm/.test(m[0]) || /gaming/.test(m[0]) || OFFICE_ARMS.has(family);
    const seatH = c.kids ? 42 : /gaming/.test(m[0]) ? 50 : undefined;
    return { kind: "office", x: { arms: arms ? "slim" : "none", seatH } };
  }],
  // lounge and reclining chairs on a wooden frame: a low chair with armrests (IKEA gives no size: a typical one)
  [/^(lounge chair|reclining chair)$/, (_m, c) => (c.f.spr ? "lounge chair sold with cushions" : { kind: "lounge" })],
  // highchairs: a seat shell on four legs, with a tray (the legs, trays and seat shells sold alone stay skipped)
  [/^highchair with (tray|safety belt)$/, (m) => ({ kind: "highchair", x: m[1] === "tray" ? {} : { shelf: false } })],
  // sun loungers with a backrest that adjusts (their cushions, covers and pads sold alone stay skipped)
  [/^sun lounger$/, () => ({ kind: "lounger" })],
  // easy chairs in one piece on a swivel base (a shell without armrests in some families)
  [/^(children's )?swivel (easy chair|armchair)$/, (m, c) => ({ kind: "swivel", x: { ...(SWIVEL_SHELL.has(c.f.name) ? { arms: "none" } : {}), ...(m[1] ? { seatH: 30 } : {}) } })],
  // conference tables, built like the family's desks
  [/^conference table$/, () => ({ kind: "conftable" })],
  // conference chairs, built like office chairs
  [/^conference chair$/, () => ({ kind: "conference" })],
  [/swivel|office chair|gaming chair|conference|desk chair|highchair|lounge|reclining|lounger|hammock|massage/, () => "office, swivel or lounge chair"],
  // sofas with a chaise longue at one or both ends, and corner sofas (an L of sections)
  [/^(?=.*\bsofa)(?=.*\b(corner|crnr|chaise))/, (m) => {
    const t = m.input ?? "";
    if (/u-shaped/.test(t)) return "U-shaped sofa";
    const count = t.match(/(\d)(,5)?[- ]seat/);
    const n = count ? Number(count[1]) + (count[2] ? 1 : 0) : undefined;
    if (/corner|crnr/.test(t) && n !== undefined) {
      if (n > 6) return "corner sofa with more than 6 seats";
      // a corner sofa with a chaise longue is an L with the chaise at the far end of the back: drawn like a U
      if (/chaise|\bch(?:ai)?se?\b|lng/.test(t) && n >= 4) return { kind: "usofa", x: { seats: n } };
      // IKEA's corner sofas go either way round: draw the return on the left, where the view looks into the L
      return { kind: "corner", x: { seats: n, corner: "left", open: /chaise|open end/.test(t) || undefined } };
    }
    // a corner sofa-bed with no seat count is three seats and a chaise longue (FRIHETEN)
    const seats = n ?? 3;
    const both = /chaise (longue|lng)s\b/.test(t);
    if (seats > 5) return "sofa with more than 5 seats";
    if (both && seats < 3) return "chaise longues with no sofa between";
    return { kind: "chaise", x: { seats, chaise: both ? "both" : /\bleft\b/.test(t) ? "left" : "right" } };
  }],
  // a chaise longue sold alone as a section of a modular sofa: a one-seat section as long as a chaise
  [/^(chaise longue section|chaise longue module(?:, (?:left|right))?|chaise longue, add-on unit|modular chaise longue)$/, () => ({ kind: "section", x: { seats: 1, chaise: "right" } })],
  // U-shaped sofas: a corner sofa with a chaise longue at the other end of the back
  [/^u-shaped sofa, (\d)(?:[.,](5))?[- ]seat$/, (m) => ({ kind: "usofa", x: { seats: Number(m[1]) + (m[2] ? 1 : 0) } })],
  // a corner section sold alone as a piece of a modular sofa: a square seat with a backrest along two sides
  [/^(corner section|corner section with cushion|corner module)$/, () => ({ kind: "section", x: { seats: 1, corner: "left" } })],
  // corner desks: an L-shaped top on five legs
  [/^(corner desk|corner workstation|l-shaped desk)$/, () => ({ kind: "cornerdesk" })],
  // corner wardrobes: frames along both walls around an add-on corner unit, with doors when a door's name comes with them
  [/^corner wardrobe$/, (_m, c) => ({ kind: "cornerrobe", x: c.multi ? {} : { doors: 0 } })],
  // the add-on corner unit sold on its own: a cabinet of shelves
  [/^add-on corner unit with (\d) shelves$/, (m) => ({ kind: "cabinet", x: { doors: 0, shelves: Number(m[1]) } })],
  [/corner|chaise|u-shaped|crnr/, () => "corner or chaise longue sofa"],
  // a straight sofa section sold alone: a seat frame with legs, a backrest and cushions, no armrests
  [/^(\d)-seat (?:sofa-bed )?section( for modular sofa)?$/, (m) => ({ kind: "section", x: { seats: Number(m[1]) } })],
  // the same, as IKEA names them in other families: modules, half a seat wider for a "1.5-seat" one
  [/^(\d)(?:[.,]5)?-seat module$|^one-seat section$/, (m) => ({ kind: "section", x: { seats: Number(m[1] ?? 1) } })],
  // a modular easy chair: a one-seat section with an armrest on each side
  [/^modular easy chair$/, () => ({ kind: "section", x: { seats: 1, arms: "wide" } })],
  // IVAR's sections of open shelving sold together: a shelving unit, or a row of them sharing posts
  [/^(?:(\d) sections?\/shelves|1 section)$/, (m, c) =>
    c.f.name !== "IVAR" ? "sofa or storage section" : Number(m[1] ?? 1) > 1 ? { kind: "open", x: { n: Number(m[1]), cat: "Shelving combination" } } : { kind: "open", x: { cat: "Shelving unit" } }],
  // the open and closed units of an outdoor kitchen
  [/^(add-on unit with shelves|closed kitchen unit)$/, (m, c) =>
    c.f.cats[0] !== "od001" ? "sofa or storage section" : { kind: "kitchen", x: m[1] === "closed kitchen unit" ? { doors: 2, cat: "Outdoor kitchen unit" } : { doors: 0, shelves: 1, cat: "Outdoor kitchen unit" } }],
  [/section|add-on|(?<!with )armrest|backrest for|seat sec|modular (easy chair|chaise)/, () => "sofa or storage section"],
  // bunk beds on four posts, and loft beds with room underneath (KURA turns over to be either)
  [/^(bunk bed frame|loft bed frame|loft bed|reversible bed)$/, (m, c) => {
    if (m[1] === "loft bed" && c.f.spr) return "loft bed with a desk or storage";
    return { kind: m[1] === "bunk bed frame" ? "bunk" : "loft" };
  }],
  [/\b(bunk|loft)\b/, () => "bunk or loft bed with a desk or underbed"],
  [/^cot( with drawer)?$/, (m) => ({ kind: "cot", x: m[1] ? { drawer: true } : {} })],
  [/\b(cot|crib)\b|cradle/, () => "cot bedding, mattress or cradle"],
  // day-beds: a bed that pulls out with drawers in it, a trundle, storage boxes or nothing underneath, with or without mattresses
  [/^day-bed( frame)?(?: (?:with|w) (?:(\d) drawers|(trundle bed)|(storage)|(\d) mattress))?(?:\/(\d) mattress(?:es)?)?$/, (m) => {
    const under: X = m[2] ? { under: "pullout", rows: Number(m[2]) } : m[3] ? { under: "trundle" } : m[4] ? { under: "boxes" } : {};
    return { kind: "daybed", x: { ...under, mats: Number(m[6] ?? m[5] ?? 0) || undefined } };
  }],
  [/day-?bed|divan/, () => "divan, or bedding for a day-bed"],
  // sliding doors on a wardrobe or a cabinet, running in tracks (doors sold alone stay skipped)
  [/^wardrobe with (\d )?sliding doors$/, (m) => (Number(m[1] ?? 2) > 3 ? "more than 3 sliding doors" : { kind: "sliding", x: { slides: Number(m[1] ?? 2) } })],
  [/^cabinet with (2 )?sliding (glass )?doors$/, (_m, c) =>
    c.f.spr ? "cabinet with sliding doors sold as a combination" : c.f.name === "IDÅSEN" ? "steel office cabinet" : { kind: "slidecab", x: { slides: 2 } }],
  [/sliding/, () => "sliding doors"],
  // wash-stands: drawers or doors under a basin, on the wall or on the floor; a basin from the same box goes on top last
  [/^(open )?(?:wash-?st(?:a)?n?d|wsh-stnd)(?: (?:w|with) (.+?))?(\/(?:deep )?wash-basin(?:\/tap)?)?$/, (m, c) => {
    const fronts = m[2] ?? "";
    const dr = fronts.match(/^(?:(\d) )?(drawers?|drw)$/);
    const ds = fronts.match(/^(?:(\d) )?(doors?|drs)$/);
    const sh = fronts.match(/^(\d) shelves$/);
    const wide = (c.sz.n[0] ?? 60) > 45;
    let z: string;
    if (m[1]) z = sh ? `o${sh[1]}` : dr ? "o1+r1@18" : fronts ? "" : "o1";
    else if (dr) z = `r${dr[1] ?? (/s$/.test(dr[2]) ? 2 : 1)}`;
    else if (ds) z = `d${Number(ds[1] ?? (ds[2] === "door" ? 1 : 2)) > 1 && wide ? 2 : 1}`;
    else z = fronts ? "" : "r2";
    if (!z) return "wash-stand we can't read";
    return { kind: "washstand", x: { z, basin: m[3] || c.multi ? 6 : undefined } };
  }],
  [/^wash-basin (?:base )?cabinet(?: w(?:ith)? (\d) doors)?$/, (m, c) =>
    ({ kind: "washstand", x: { z: `d${m[1] ? Math.min(2, Number(m[1])) : (c.sz.n[0] ?? 60) > 50 ? 2 : 1}`, basin: c.multi ? 6 : undefined } })],
  [/^base (?:cb|cabinet) f(?:or)? wash-?basin w(?:ith)? (\d) drawers$/, (m) => ({ kind: "washstand", x: { z: `r${m[1]}` } })],
  [/^base frame for wash-?basin$/, () => ({ kind: "washstand", x: { z: "o" } })],
  // the appliances, sinks, basins, taps and hoods themselves, and the fronts that go on a dishwasher
  [/sink|wash-?basin|wash-?st|hob\b|\boven|fridge|freezer|dishwasher|microwave|extractor|appliances|kitchenette|outdoor kitchen/, (_m, c) =>
    c.f.cats[0] === "od001" ? "outdoor kitchen" : "appliance, sink, tap or hood"],
  [/^(door\/)?drawer front|^drawer (without |with (framed )?(glass )?)front|^(high|medium|low) drawer with front|^fitting for mounting/, () => "door or drawer front sold alone"],
  [/drawers?\b.*\b(doors?|fronts?|shelves|baskets?)\b|\b(doors?|fronts?|shelves|baskets?)\b.*\bdrawers?\b/, () => "mixed doors and drawers"],

  // storage
  [/^bookcase$/, () => ({ kind: "bookcase" })],
  [/^(bookcase|shelving unit|shelf unit|cabinet|glass-door cabinet) with (glass |panel\/glass |panel |glass-)?(door|doors|\d doors)$/, (m, c) => (c.f.name === "KALLAX" ? "cube shelf with door inserts" : withDoors("cabinet", m[0]))],
  [/^(shelving unit|shelf unit|open shelving unit|open storage|storage unit|shelving unit in\/outdoor|shelf section|1 shelf section|shelving unit with (\d+) shelves)$/, (m, c) =>
    c.f.name === "KALLAX" ? { kind: "cube" } : { kind: "open", x: m[2] ? { shelves: Math.min(6, Number(m[2]) - 2) } : {} }],
  [/^(wall shelf unit|wall shelf|wall-mounted shelving unit|wall storage unit)$/, (m, c) => (c.sz.n.length === 3 && c.sz.n[2] >= 25) || (m[1] === "wall shelf unit" && c.sz.n.length >= 2) ? { kind: "wallshelf" } : "single shelf board"],
  // KALLAX on an underframe 17 cm high, sold together: the shelf, then the frame screwed to its bottom
  [/^shelving unit with underframe$/, (_m, c) => (c.f.name === "KALLAX" ? { kind: "cube", x: { uf: 17 } } : "shelving unit on an underframe")],
  // KALLAX sold with inserts: drawn as inserts with a door, from the bottom row up
  [/^shelving unit with (\d+) inserts$/, (m, c) => (c.f.name === "KALLAX" ? { kind: "cube", x: { ins: Number(m[1]) } } : "shelving unit with inserts")],
  // the same pieces under other names
  [/^mini chest (?:of drawers|with (\d) drawers)$/, (m) => ({ kind: "chest", x: { rows: Number(m[1] ?? 3), min: 20 + 5 * Number(m[1] ?? 3) } })],
  [/^(?:cabinet with (\d) drawers|drawer unit with drop-file storage|modular chest of drawers)$/, (m) =>
    ({ kind: "chest", x: m[1] ? { rows: Number(m[1]) } : /drop-file/.test(m[0]) ? { rows: 2 } : {} })],
  [/^cabinet with \d compartments$/, () => ({ kind: "cube" })],
  // boxes with a lid on hinges: storage benches, a storage table, footstools and pouffes with a padded lid (a round
  // basket table and benches built from frames and fronts stay skipped)
  [/^(storage bench|storage table|footstool with storage|pouffe with storage|storage stool)$/, (m, c) => {
    if (c.f.name === "PLATSA") return "storage bench built from frames and fronts";
    if (m[1] === "storage table" && c.sz.n.length === 1) return "round storage table";
    const cat = { "storage table": "Storage table", "footstool with storage": "Footstool with storage", "pouffe with storage": "Pouffe with storage", "storage stool": "Storage stool" }[m[1]];
    return { kind: "lidbox", x: cat ? { cat } : {} };
  }],
  [/^wall cb (?:with (\d) doors?|w (\d) shlf\/door|w (\d) shelves)$/, (m) =>
    ({ kind: "wallcab", x: m[3] ? { doors: 0, shelves: Number(m[3]) } : m[2] ? { doors: 1, shelves: Number(m[2]) } : { doors: Number(m[1]) > 1 ? 2 : 1 } })],
  [/^(?:wall frame with shelves|wall shelf frame|wall-mounted bedside table)$/, () => ({ kind: "wallshelf" })],
  [/^wall storage$/, (_m, c) => (c.f.spr ? "wall storage sold with boxes" : { kind: "wallshelf" })],
  [/^wall open cabinet$/, () => ({ kind: "wallcab", x: { doors: 0 } })],
  [/^wall mounted frame with doors$/, () => ({ kind: "wallcab" })],
  [/^mirror cabinet with (\d) doors?$/, (m) => ({ kind: "wallcab", x: { doors: Number(m[1]) > 1 ? 2 : 1 } })],
  // a mirror cabinet with its lighting built in is hung like any other
  [/^mirror cab (\d) doors?\/built-in lighting$/, (m) => ({ kind: "wallcab", x: { doors: Number(m[1]) > 1 ? 2 : 1, cat: "Wall cabinet" } })],
  // EKET's wall-mounted cube of compartments
  [/^wall-mounted shelving unit w \d comp$/, () => ({ kind: "cube", x: { cat: "Shelving unit" } })],
  // a chest of drawers with an open shelf above them
  [/^chest of (\d) drawers with shelf$/, (m) => ({ kind: "mixed", x: { doors: 0, rows: Number(m[1]), shelves: 1, cat: "Chest of drawers" } })],
  [/^high cabinet with mirror door$/, () => ({ kind: "cabinet", x: { doors: 1 } })],
  [/^high cb w (\d) shelves$/, (m) => ({ kind: "cabinet", x: { doors: 0, shelves: Math.min(5, Number(m[1])) } })],
  [/^sideboard basic unit$/, () => ({ kind: "sideboard" })],
  [/^tv bench with plinth$/, () => ({ kind: "tv" })],
  // a TV bench full of drawers
  [/^tv bench with drawers$/, () => ({ kind: "tv", x: { rows: 1, cat: "TV bench with drawers" } })],
  // a bookcase with a drawer at the bottom, open shelves above it
  [/^bookcase with drawer$/, (_m, c) => ({ kind: "mixed", x: { doors: 0, rows: 1, shelves: (c.sz.n[2] ?? 100) > 150 ? 3 : 1 } })],
  // BILLY with its height extension on top and doors: drawn as one tall bookcase with doors, like the others 237 cm high
  [/^bookcase w (?:height extension ut\/drs|doors\/extension unit|hght ext ut\/pnl\/glss drs)$/, (_m, c) => ({ kind: "cabinet", x: (c.sz.n[0] ?? 80) <= 40 ? { doors: 1 } : {} })],
  // height extension units: a short box on top of a bookcase or wardrobe, with doors in some
  [/^height extension unit( with doors)?$/, (m) => ({ kind: "extension", x: m[1] ? { doors: 2 } : {} })],
  // a media shelf: an open box on the wall
  [/^media shelf$/, () => ({ kind: "wallcab", x: { doors: 0, shelves: 0, cat: "Media shelf" } })],
  // METOD high cabinets full of drawers: 40 cm fronts from the bottom up, a 20 cm one at the top when there's room
  [/^high cabinet with drawers$/, (_m, c) => {
    const h = c.sz.n[2] ?? 200, k = Math.floor(h / 40);
    return { kind: "kitchen", x: { z: h - 40 * k >= 20 ? `r${k}@${40 * k}+r1` : `r${k}`, cat: "High cabinet with drawers" } };
  }],
  [/^shelving unit\/bench$/, () => ({ kind: "open" })],
  // shelving units with a clothes rail, a cabinet at the bottom or a storage box on castors under them (the ones
  // that mix cabinets and drawers, or a box under a row of sections, stay skipped)
  [/^shelving unit with clothes rail$/, () => ({ kind: "open", x: { rail: true, cat: "Shelving unit with clothes rail" } })],
  [/^shelving unit with (?:\d )?(cabinet|cabinets)$/, (m, c) => {
    const low = CABINET_LOW[c.f.name];
    if (!low || (m[1] === "cabinets") !== ((c.sz.n[0] ?? 0) > 100) || /\d/.test(m[0])) return "shelving unit with cabinets of different sizes";
    return { kind: "cabinet", x: { low, cat: "Shelving unit with cabinet" } };
  }],
  [/^shelving unit with storage box$/, (_m, c) => ((c.sz.n[0] ?? 0) > 100 ? "row of shelving sections with a storage box" : { kind: "open", x: { box: 25, cat: "Shelving unit with storage box" } })],
  [/^shelving unit with plinth$/, () => ({ kind: "open", x: { plinth: true } })],
  [/^box shelf with divider$/, () => ({ kind: "cube", x: { t: 18, cat: "Box shelf" } })],
  // a laptop table is a small desk
  [/^laptop table$/, () => ({ kind: "desk" })],
  // desks and tables with drawers under the top, a dressing table with its mirror
  [/^desk with (\d) drawers$/, (m) => ({ kind: "deskdraw", x: { rows: Number(m[1]) } })],
  [/^dressing table with mirror$/, () => ({ kind: "deskdraw", x: { rows: 2, mirror: true, cat: "Dressing table" } })],
  // a dressing table measured taller than a table is, with the mirror that stands on it
  [/^dressing table$/, (_m, c) => ((c.sz.n[2] ?? 0) > 110 ? { kind: "deskdraw", x: { rows: 1, mirror: true, cat: "Dressing table" } } : { kind: "desk" })],
  // BROR's is a steel frame full of drawers under a plywood top, not a desk: drawn as a chest of four
  [/^work bench with drawers$/, () => ({ kind: "chest", x: { rows: 4, knobs: "bar", cat: "Work bench" } })],
  [/^table with drawer$/, () => ({ kind: "deskdraw", x: { rows: 1, cat: "Table" } })],
  // TROFAST's low desk: a top between two storage frames, with boxes, trays or shelves in them
  [/^desk with (?:mesh )?(storage boxes|storage boxes\/trays|shelves)$/, (m, c) =>
    (c.f.name === "TROFAST" ? { kind: "boxdesk", x: m[1] === "shelves" ? { rows: 2, shelf: true } : { rows: 2 } } : "desk with storage")],
  [/^bar stool with backrest, foldable$/, () => ({ kind: "chair", x: { seatH: 63 } })],
  [/^three-seat sofa$/, () => ({ kind: "sofa", x: { seats: 3 } })],
  [/^(modular )?chest of (\d+) drawers$/, (m) => ({ kind: "chest", x: { rows: Number(m[2]) } })],
  [/^(drawer unit|drawer unit on castors|chest of drawers|dresser)$/, () => ({ kind: "chest" })],
  // drawer units, cabinets and open storage on castors (castors drawn on the ones that say so in their name)
  [/^drawer unit w(?:ith)? (\d+) drawers( on castors)?$/, (m) => ({ kind: "chest", x: { rows: Number(m[1]), ...(m[2] ? { cast: true } : {}) } })],
  [/^cabinet on castors$/, () => ({ kind: "cabinet", x: { cast: true, cat: "Cabinet on castors" } })],
  [/^storage unit on castors$/, (_m, c) => ({ kind: "cabinet", x: { doors: 0, shelves: (c.sz.n[1] ?? 60) > 80 ? 2 : 1, cast: true, cat: "Storage unit on castors" } })],
  [/^cabinet with drawers$/, () => ({ kind: "chest", x: { rows: 4 } })],
  [/^(bedside table|nightstand|bedside table with (\d) drawers?)$/, (m) => ({ kind: "nightstand", x: m[2] ? { rows: Number(m[2]) } : {} })],
  // a bedside table with a glass top is put together like any other
  [/^bedside table with glass top$/, () => ({ kind: "nightstand", x: { rows: 1 } })],
  // a wardrobe frame is sold empty: no doors, shelves or rail
  [/^wardrobe frame$/, () => ({ kind: "wardrobe", x: { doors: 0, shelves: 0, rail: false } })],
  [/^(open wardrobe|open clothes hanging unit)$/, () => ({ kind: "wardrobe", x: { doors: 0 } })],
  // two or three wardrobe frames sold together: a row of empty frames
  [/^(\d) wardrobe frames$/, (m) => ({ kind: "wardrobe", x: { doors: 0, shelves: 0, rail: false, n: Number(m[1]), cat: "Wardrobe combination" } })],
  // PLATSA wardrobes are a row of identical frames: one or two doors on each, as many frames as that takes
  [/^wardrobe w(?:ith)? (\d+) doors$/, (m, c) => {
    const doors = Number(m[1]), w = c.sz.n[0] ?? 0;
    if (c.f.name === "PLATSA" && c.f.spr && doors > 2) {
      const per = doors % 2 === 0 && w / (doors / 2) >= 60 ? 2 : 1;
      return doors / per > 4 ? "row of more than 4 wardrobe frames" : { kind: "wardrobe", x: { doors: per as 1 | 2, n: doors / per } };
    }
    if (/ w /.test(m[0])) return "not something we draw yet";
    return doors > 3 ? "more than 3 doors" : { kind: "wardrobe", x: { doors: Math.min(2, doors) as 1 | 2 } };
  }],
  [/^(wardrobe|hinged wardrobe|wardrobe with (door|(\d) doors))$/, (m) => (n(m[3], 2) > 3 ? "more than 3 doors" : { kind: "wardrobe", x: m[2] ? { doors: m[2] === "door" ? 1 : (Math.min(2, Number(m[3])) as 1 | 2) } : {} })],
  [/^(wall(-mounted)? cabinet|wall cabinet frame|top cabinet|mirror cabinet( with doors?)?|wall cabinet with (\d )?(glass )?doors?|wall cabinet with shelves(\/(\d )?(glass )?doors?)?|wall cab(inet)? w shelves\/(\d )?glass (drs?|doors?)|wall cabinet w shelves\/glass door)$/, (m) => withDoors("wallcab", m[0])],
  [/^(base cabinet frame|base cabinet with shelves|base fr w shelves|base cabinet with (\d )?doors?|base cabinet with shelves\/(\d )?doors?|high cabinet frame|high cabinet with shelves(\/(\d )?doors?)?|high cabinet( with (\d )?doors?)?)$/, (m, c) =>
    withDoors(/^high cabinet( with)?/.test(m[0]) && !c.f.cats.includes("ka001") ? "cabinet" : "kitchen", m[0])],
  [/^(cabinet|frame|frame with doors?|cabinet with plinth|cabinet with (\d )?doors?|cabinet with door|glass-door cabinet( with (\d doors|plinth))?|cabinet with (\d )?glass doors?|display cabinet|storage cabinet|cupboard|open cabinet)$/, (m, c) => (m[0] === "frame" && c.f.name === "TROFAST" ? { kind: "open" } : withDoors("cabinet", m[0]))],
  [/^(sideboard|buffet)$/, () => ({ kind: "sideboard" })],
  [/^(tv bench|tv bench with (\d )?doors|tv unit|tv storage unit)$/, (m, c) =>
    c.f.name === "KALLAX" ? "cube shelf with door inserts" : { kind: "tv", x: m[0] === "tv bench" && /^(BESTÅ|LACK)$/.test(c.f.name) ? { doors: 0 } : {} }],
  [/^(shoe rack|open shoe storage unit)$/, () => ({ kind: "shoerack" })],
  [/^room divider$/, () => ({ kind: "divider" })],
  // a freestanding drying rack (one that hangs on a wall system's rail stays skipped)
  [/^drying rack$/, (_m, c) => (c.f.name === "BOAXEL" ? "drying rack that hangs on a wall rail" : { kind: "airer", x: { cat: "Drying rack" } })],
  // laptop and monitor stands: a top on two side panels
  [/^(laptop stand|laptop\/monitor stand|monitor stand|monitor stand, fixed height|gaming monitor stand|desktop shelf)$/, (m) =>
    ({ kind: "riser", x: /monitor stand$|fixed height/.test(m[1]) && !/laptop/.test(m[1]) ? { cat: "Monitor stand" } : m[1] === "desktop shelf" ? { cat: "Desktop shelf" } : {} })],
  // a hat rack on the wall: a shelf over a row of hooks (IKEA gives only the width)
  [/^hat rack$/, () => ({ kind: "hatrack" })],
  // changing tables: a chest of drawers or an open frame with shelves, and a changing top on it
  [/^changing table(?: with drawers|\/chest of drawers|\/bookshelf|\/desk)?$/, (m, c) =>
    c.f.spr ? "changing table sold as a combination" : { kind: "changing", x: /drawers/.test(m[0]) ? { rows: 3 } : { shelves: /desk/.test(m[0]) ? 1 : 2 } }],
  // freestanding clothes racks: two uprights on feet, a rail across the top, a shoe shelf or a lower rail
  [/^(clothes rack|clothes rack with shoe storage|coat rack with shoe storage unit)$/, (m) => ({ kind: "clothesrack", x: /shoe/.test(m[1]) ? { shelf: true } : {} })],
  [/^(shoe cabinet|shoe cabinet\/storage|shoe cabinet with (\d) compartments)$/, (m) => ({ kind: "shoe", x: m[2] ? { c: Number(m[2]) } : {} })],

  // tables
  // a drop-leaf table is measured closed, then open: "74/134x80 cm", or "55/82/109x74 cm" with two leaves
  [/^drop-leaf table$/, (_m, c) => {
    const s = c.f.size.match(/^(\d+)\/(\d+)(?:\/(\d+))?x\d+ cm$/);
    if (!s) return "drop-leaf table with a size we can't read";
    const [closed, open1, open2] = [Number(s[1]), Number(s[2]), s[3] ? Number(s[3]) : undefined];
    const extra = (open2 ?? open1) - closed;
    const leaves = open2 !== undefined || extra >= 50 ? 2 : 1;
    return { kind: "dropleaf", x: { leaves, leaf: Math.round(extra / leaves) } };
  }],
  // a gateleg table, measured like a drop-leaf one: "67/124x75 cm" with one leaf, "39/95/151x90 cm" with two
  [/^gateleg table$/, (_m, c) => {
    const s = c.f.size.match(/^(\d+)\/(\d+)(?:\/(\d+))?x\d+ cm$/);
    if (!s) return "gateleg table with a size we can't read";
    if (GATE_DRAWERS.has(c.f.name)) return "gateleg table with drawers";
    const [closed, open1, open2] = [Number(s[1]), Number(s[2]), s[3] ? Number(s[3]) : undefined];
    const leaves = open2 !== undefined ? 2 : 1;
    const x: X = { leaves, leaf: Math.round(((open2 ?? open1) - closed) / leaves) };
    if (GATE_STORAGE.has(c.f.name)) Object.assign(x, { shelf: true, hinge: true });
    return { kind: "gateleg", x };
  }],
  [/^(gateleg|folding) table$/, () => "gateleg or folding table"],
  [/^(table|dining table|extendable table|kitchen table)$/, (_m, c) => ({ kind: c.kids ? "kidstable" : "dining" })],
  [/^children's table$/, () => ({ kind: "kidstable" })],
  [/^coffee table$/, () => ({ kind: "coffee" })],
  [/^side table( on castors)?$/, () => ({ kind: "side" })],
  [/^(bar table|high table)$/, () => ({ kind: "bar" })],
  [/^(console table|hall table)$/, () => ({ kind: "console" })],
  [/^(desk|computer desk|gaming desk|desk sit\/stand|gaming desk sit\/stand|dressing table|writing desk)$/, () => ({ kind: "desk" })],
  [/^(trolley|kitchen trolley|kitchen island|trolley table|serving trolley|trolley with lid|trolley table with storage)$/, () => ({ kind: "trolley" })],

  // seating
  [/^(chair|dining chair|folding chair|chair with armrests)$/, (m, c) => (/arm/.test(m[0]) && !c.kids ? { kind: "chair", x: { arms: "slim" } } : { kind: c.kids ? "kidschair" : "chair" })],
  [/^children's chair$/, () => ({ kind: "kidschair" })],
  [/^junior chair$/, () => ({ kind: "junior" })],
  [/^(bar stool with backrest|bar chair)$/, () => ({ kind: "chair", x: { seatH: 63 } })],
  // ALSEDA is a woven pouffe on the floor, though IKEA calls it a stool
  [/^stool$/, (_m, c) => (POUFFE_STOOL.has(c.f.name) ? { kind: "pouffe", x: { round: true } } : { kind: "stool" })],
  [/^(bar stool|step stool|folding stool|children's stool|stool, \d+ steps?)$/, () => ({ kind: "stool" })],
  // a bench with shoe storage has a shelf under the seat for the shoes
  [/^bench with shoe storage$/, () => ({ kind: "shelfbench" })],
  [/^bench$/, () => ({ kind: "bench" })],
  // benches and stools with a shelf under the seat
  [/^(bench|stool) with storage$/, (m) => ({ kind: "shelfbench", x: m[1] === "stool" ? { cat: "Stool with storage" } : {} })],
  // work benches: a sturdy table with a shelf low down (one with drawers stays skipped)
  [/^work bench$/, () => ({ kind: "workbench" })],
  // a coffee table that lifts or lowers is put together like any other
  [/^adjustable coffee table$/, () => ({ kind: "coffee" })],
  // the same bench with a pad on it
  [/^bench with pad$/, () => ({ kind: "bench" })],
  // a bench with a backrest and armrests, built like a wide chair (IKEA gives no size: a typical garden bench)
  [/^bench with backrest$/, (_m, c) => (c.f.spr ? "bench with backrest sold with cushions" : { kind: "backbench" })],
  // a rocking chair is drawn as an armchair, and goes by its own name (it is not the family's armchair: POÄNG)
  [/^rocking-chair$/, () => ({ kind: "armchair", x: { cat: "Rocking chair" } })],
  [/^(armchair|easy chair|wing chair|high-back armchair|low-back armchair|children's armchair|armchair with cushion)$/, () => ({ kind: "armchair" })],
  // a modular sofa or armchair with a side table module at the end
  [/^(?:(\d)-seat modular sofa|armchair) with side table$/, (m) =>
    m[1] ? { kind: "sofa", x: { seats: Number(m[1]), st: 45, cat: "Modular sofa with side table" } } : { kind: "armchair", x: { st: 45, cat: "Armchair with side table" } }],
  // a recliner and a wide armchair, built like any other armchair
  [/^recliner$/, () => ({ kind: "armchair", x: { cat: "Recliner" } })],
  [/^1,5-seat armchair$/, () => ({ kind: "armchair", x: { cat: "Armchair" } })],
  // pouffes on legs, and chairs that fold out into a bed
  [/^pouffe$/, () => ({ kind: "pouffe" })],
  [/^(chair-bed|armchair-bed)$/, (m) => ({ kind: "chairbed", x: m[1] === "armchair-bed" ? { arms: "slim" } : {} })],
  [/^((\d)(,5)?-seat (modular )?sofa(-bed)?|sofa|sofa-bed|loveseat)$/, (m) => {
    const seats = m[2] ? Number(m[2]) + (m[3] ? 1 : 0) : 3;
    return seats > 6 ? "sofa with more than 6 seats" : { kind: "sofa", x: { seats } };
  }],

  // beds
  [/^(bed frame|bed frame, high|upholstered bed frame|bed frame with storage|bed frame with (\d) storage boxes|bed frame, high, w (\d) storage boxes|bed frame with slatted bed base|ottoman bed|extendable bed|ext bed frame with slatted bed base|bed frame with (\d) headboards|bed frame with headboard|children's bed)$/, () => ({ kind: "bed" })],
  // the same bed frames under other names: with its storage boxes or its mattress in the box, an upholstered storage
  // or ottoman bed, one headboard, and a low stackable bed with no headboard
  [/^(upholstered bed, (\d) storage boxes|upholstered bed frame with mattress|bed frame with mattress|upholstered ottoman bed|upholstered storage bed|bed frame with 1 headboard)$/, () => ({ kind: "bed", x: { cat: "Bed frame" } })],
  [/^stackable bed$/, () => ({ kind: "bed", x: { f: 46 } })],
];

/** Drawers in one or two columns, each between 7 and 42 cm tall (taller means open sections we can't show). */
function chestShape(total: number, w: number, h: number): { rows: number; cols: 1 | 2 } | null {
  // a narrow drawer unit can hold up to ten shallow drawers (ALEX)
  const ok = (rows: number) => (rows <= 6 || (rows <= 10 && w <= 50)) && h / rows >= 7 && h / rows <= 42;
  if (total % 2 === 0 && w >= 100 && ok(total / 2)) return { rows: total / 2, cols: 2 };
  return ok(total) ? { rows: total, cols: 1 } : null;
}

/** IKEA's top level ranges that hold no furniture: food, textiles, kitchenware, lamps, plants, decoration and so on. */
const NOT_FURNITURE = /^(fb|tl|kt|li|pp|de|wt|he|hs|lc|pt|sp)\d/;

/**
 * Products no rule above draws (fold-out tables, loft beds, stands, sliding doors...) that have a guide written from
 * their manual in src/lib/plan/families. Keyed by one article number of the product; kind and outer size w, h, d in cm,
 * which the product page's measurements replace when it has been read.
 */
const ADDED: Record<string, { kind: Kind; w: number; h: number; d: number; x?: X }> = {
  "00579755": { kind: "bookcase", w: 80, h: 106, d: 33 }, // BILLY bookcase with foldable table
  "10495133": { kind: "lounger", w: 310, h: 110, d: 110 }, // BOCKÖN hammock stand
  "10269168": { kind: "open", w: 160, h: 95, d: 28 }, // BRIMNES headboard with storage
  "60586258": { kind: "trolley", w: 56, h: 62, d: 40 }, // BRÄNNBOLL shelving unit on castors
  "50219044": { kind: "desk", w: 140, h: 146, d: 74 }, // FREDDE gaming desk
  "20575030": { kind: "daybed", w: 207, h: 81, d: 97, x: { m: 90 } }, // GLAMBERGET extendable bed
  "80609683": { kind: "wallshelf", w: 110, h: 31, d: 12 }, // GULLABERG add-on unit
  "40609680": { kind: "desk", w: 84, h: 85, d: 41 }, // GULLABERG gateleg desk
  "70624603": { kind: "wallcab", w: 28, h: 37.5, d: 11 }, // HUSBYÅN wall cabinet
  "20411982": { kind: "desk", w: 146, h: 70, d: 70 }, // IDÅSEN underframe sit/stand
  "80360951": { kind: "slidecab", w: 120, h: 140, d: 45 }, // IDÅSEN cabinet with sliding glass doors
  "40512466": { kind: "dropleaf", w: 80, h: 74, d: 91 }, // IVAR folding table
  "79469527": { kind: "open", w: 89, h: 179, d: 30 }, // IVAR 1 section with foldable table
  "69606577": { kind: "open", w: 134, h: 179, d: 95 }, // IVAR 2 sections with foldable table
  "80562096": { kind: "tv", w: 147, h: 60, d: 39 }, // KALLAX TV bench
  "19552176": { kind: "tv", w: 147, h: 78, d: 39 }, // KALLAX TV bench with underframe
  "19278272": { kind: "cube", w: 77, h: 77, d: 39 }, // KALLAX shelving unit with doors
  "90480401": { kind: "side", w: 44, h: 61, d: 44 }, // KVISTBRO storage table
  "40539263": { kind: "dining", w: 150, h: 72, d: 146 }, // LERHOLMEN picnic table
  "30587080": { kind: "desk", w: 90, h: 80, d: 39 }, // LÄNGDHOPP pull-out desk
  "00492795": { kind: "desk", w: 120, h: 75, d: 58 }, // LÄRANDE desk with pull-out storage
  "30180504": { kind: "dropleaf", w: 74, h: 74, d: 60 }, // NORBERG wall-mounted drop-leaf table
  "80583433": { kind: "daybed", w: 193, h: 40, d: 80, x: { m: 80 } }, // NORRUDDEN guest bed
  "69638111": { kind: "bench", w: 120, h: 63, d: 57 }, // PLATSA storage bench
  "99614255": { kind: "cabinet", w: 180, h: 103, d: 42 }, // PLATSA cabinet with 5 doors
  "20533337": { kind: "dropleaf", w: 63, h: 74, d: 40 }, // RESARÖ mobile drop-leaf table
  "70228325": { kind: "kidstable", w: 79, h: 50, d: 89 }, // RESÖ children's picnic table
  "60569744": { kind: "kidschair", w: 40, h: 50, d: 40 }, // SMÅSKRAKE child chair/table
  "29437483": { kind: "loft", w: 207, h: 182, d: 99, x: { m: 90 } }, // SMÅSTAD loft bed
  "70567805": { kind: "wallcab", w: 36, h: 20, d: 29 }, // STOMSÖ wall-mounted bedside table
  "80371520": { kind: "stool", w: 40, h: 33, d: 38 }, // TROGEN children's step stool
  "00575540": { kind: "side", w: 40, h: 74, d: 40 }, // VISINGSÖ plant stand
  "90620005": { kind: "side", w: 45, h: 60, d: 45 }, // YXSTABY gaming side table on castors
  "10620009": { kind: "stool", w: 40, h: 45, d: 40 }, // YXSTABY gaming thumbstick stool
  "20512660": { kind: "nightstand", w: 40, h: 52, d: 40 }, // TOLKNING bedside table
  "30253067": { kind: "bookcase", w: 33, h: 163, d: 28 }, // RÅGRUND shelving unit
  "80624645": { kind: "shoerack", w: 60, h: 40, d: 27 }, // VASSKÄR shoe rack
  "90600291": { kind: "shoerack", w: 58, h: 17, d: 27 }, // GREJIG shoe rack
  "90609178": { kind: "bench", w: 90, h: 30, d: 30 }, // FLISAT children's bench
  "30609181": { kind: "desk", w: 83, h: 70, d: 58 }, // FLISAT children's desk
  "00290778": { kind: "wallshelf", w: 70, h: 16, d: 9 }, // FLISAT wall storage
  "40586508": { kind: "tv", w: 179, h: 56, d: 42 }, // STOCKHOLM 2025 TV bench with sliding doors
  "00439468": { kind: "wardrobe", w: 120, h: 186, d: 47, x: { doors: 1 } }, // NORDKISA open wardrobe with sliding door
  "19302922": { kind: "bunk", w: 207, h: 161, d: 97, x: { m: 90 } }, // VITVAL bunk bed with underbed
  "10448325": { kind: "daybed", w: 200, h: 25, d: 90, x: { m: 90 } }, // VITVAL underbed
  "99239451": { kind: "daybed", w: 200, h: 25, d: 90, x: { m: 90 } }, // SLÄKT underbed with storage
  "50603263": { kind: "dining", w: 187, h: 74, d: 187 }, // VITTSKÄR table
  "39284998": { kind: "cabinet", w: 60, h: 202, d: 40 }, // BESTÅ cabinet unit
  "99384693": { kind: "bar", w: 42, h: 90, d: 47 }, // BERGMUND bar stool with backrest
  "59471786": { kind: "bar", w: 42, h: 90, d: 47 }, // BERGMUND bar stool with backrest (US)
  "40582044": { kind: "stool", w: 40, h: 45, d: 40 }, // HAUGA stool (US)
  "50606624": { kind: "chair", w: 46, h: 81, d: 53 }, // HÄGERNÄS chair (US)
  "00534903": { kind: "bench", w: 110, h: 45, d: 35 }, // TÄRNÖ bench (US)
  "90503346": { kind: "bar", w: 45, h: 100, d: 50 }, // SEGERÖN bar stool (US)
  "10516772": { kind: "trolley", w: 54, h: 81, d: 40 }, // RULLEBÖR cart (US)
  "20569227": { kind: "cabinet", w: 61, h: 60, d: 30 }, // TITTEBO roll-front cabinet (US)
  "69329764": { kind: "armchair", w: 93, h: 83, d: 99 }, // SÖDERHAMN armchair (US)
  "60427641": { kind: "lounger", w: 60, h: 95, d: 100 }, // KLÖVEN deck chair (US)
  "40613903": { kind: "armchair", w: 84, h: 100, d: 95 }, // GRYTERYD recliner rocker (US)
  "70632684": { kind: "armchair", w: 110, h: 85, d: 90 }, // VENNGARN 1.5-seat armchair (US)
};

export function classify(f: Fact, hints: Hints): Verdict {
  const added = f.items.map((i) => ADDED[i]).find(Boolean);
  if (added) {
    const page = f.m ? fromPage(added.kind, f.m) : null;
    const w = page?.w ?? added.w, h = page?.h ?? added.h, d = page?.d ?? added.d;
    const label = f.type.replace(/\s+/g, " ").trim();
    const size = f.size.replace(/\s*x\s*/g, " × ").trim();
    const outdoor = /outdoor/i.test(label);
    return { draw: { kind: added.kind, x: { ...added.x, ...page?.x }, w: Math.round(w), h: Math.round(h), d: Math.round(d), label, size: /\d/.test(size) ? size : "", kw: outdoor ? ["outdoor", "garden"] : [], guessed: { w: false, h: false, d: false }, own: true } };
  }
  if (NOT_FURNITURE.test(f.cats[0] ?? "")) return { skip: "not furniture" };
  const raw = f.type.replace(/\s+/g, " ").trim();
  let t = raw.toLowerCase();
  const outdoor = /(,|\s)\s*(in\/)?outdoor$/.test(t) || f.cats[0] === "od001";
  t = t.replace(/,?\s*(in\/)?outdoor$/, "").trim();
  const kids = /^(children's|junior) /.test(t) || f.cats[0] === "bc001";
  let sz = measure(f.size);
  const multi = f.name.includes("/");
  let pick: Pick | null = null;
  for (const [re, fn] of RULES) {
    const m = t.match(re);
    if (m) {
      pick = fn(m, { f, sz: sz ?? { n: [], ext: false, text: "" }, kids, multi });
      break;
    }
  }
  if (!pick) return { skip: "not something we draw yet" };
  if (typeof pick === "string") return { skip: pick };
  // office chairs come in "Medium" and "Large" rather than centimetres
  if (!sz && pick.kind === "office" && /^(small|medium|large)$/i.test(f.size.trim())) sz = { n: [], ext: false, text: "" };
  if (!sz) return { skip: "size we can't read" };
  const kind = pick.kind;
  const family = f.name.split(" / ")[0].trim();
  const hint = hints(family, kind);
  const x: X = { ...pick.x };
  for (const k of Object.keys(x) as (keyof X)[]) if (x[k] === undefined) delete x[k];
  const [dw, dh, dd] = KIND_DEFAULT_SIZE[kind];
  const v = sz.n;
  let w = dw, h = dh, d = dd;
  const guessed = { w: true, h: true, d: true };
  const set = (a?: number, b?: number, c?: number) => {
    if (a !== undefined) [w, guessed.w] = [a, false];
    if (b !== undefined) [h, guessed.h] = [b, false];
    if (c !== undefined) [d, guessed.d] = [c, false];
  };

  if (kind === "bed") {
    const mat = sz.bed ?? (v.length === 2 && v[1] >= 140 && v[1] <= 220 ? ([v[0], v[1]] as [number, number]) : null);
    if (!mat) return { skip: "bed without a mattress size" };
    const small = mat[0] <= 80 && mat[1] <= 170;
    x.m = mat[0];
    if (mat[1] !== 200) x.l = mat[1];
    // a stackable bed has a low end at the head as at the foot
    const low = pick.x?.f;
    if (low) x.f = low;
    else if (hint?.x.f !== undefined) x.f = hint.x.f;
    else if (small) x.f = 50;
    const fit = hint?.kind === "bed" && !small && !low;
    set(mat[0] + 16, low ?? (fit ? hint.h : small ? 64 : 100), mat[1] + 9);
    guessed.h = !fit;
  } else if (UPRIGHT.has(kind)) {
    if (sz.ext) return { skip: "corner or extendable unit" };
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length === 2) {
      if ((kind === "kitchen" || kind === "mixed" || kind === "sinkcab" || kind === "appliance") && /^base/.test(t)) set(v[0], 80, v[1]);
      // an outdoor kitchen unit is measured from above, and stands at worktop height
      else if (kind === "kitchen" && /kitchen unit$|shelf unit$|unit with shelves$/.test(t)) set(v[0], 90, v[1]);
      // bedside tables are measured from above, like tables
      else if (kind === "nightstand" && /bedside|nightstand/.test(t)) set(v[0], hint?.kind === kind ? hint.h : 55, v[1]);
      else set(v[0], v[1]);
    } else if (v.length === 1) return { skip: "upright piece with one size" };
    else if (hint?.kind === kind) set(hint.w, hint.h, hint.d);
    else if (kind === "clothesrack" && RACK_SIZE[family]) set(...RACK_SIZE[family]);
    else if (TYPICAL[t]) [w, h, d] = TYPICAL[t];
    else return { skip: "no size given" };
    if (kind === "clothesrack" && h < 100) return { skip: "clothes rack measured in a way we can't read" };
    // a mini chest measured from the front only is a small, shallow box
    if (kind === "chest" && /^mini/.test(t) && guessed.d) d = Math.max(15, Math.round(w * 0.6));
    // a changing table is wider than it's deep, whichever way round IKEA writes it
    if (kind === "changing" && d > w) [w, d] = [d, w];
    if (guessed.d && hint?.kind === kind && Math.abs(hint.w - w) < 60) d = hint.d;
    // a cabinet with drawers is as deep as the family's cabinet
    const twin = kind === "mixed" || kind === "slidecab" ? "cabinet" : kind === "sliding" ? "wardrobe" : undefined;
    const cab = twin ? hints(family, twin) : undefined;
    if (guessed.d && cab && cab.kind === twin && Math.abs(cab.w - w) < 60) d = cab.d;
    if (kind === "washstand") {
      // the measure takes in a basin from the same box: whatever is above the wash-stand's own height is the basin
      if (x.basin) {
        const extra = WASH_H[family] ? h - WASH_H[family] : -1;
        x.basin = extra >= 4 ? Math.min(16, extra) : 6;
      }
      if (h - (x.basin ?? 0) <= 70 && !WASH_FLOOR.has(family)) x.hung = true;
    }
    // IKEA lists one KALLAX on an underframe with its depth and one without: the same thing, so the same row
    if (kind === "cube" && x.uf && v.length === 3) sz = { ...sz, text: `${v[0]} × ${v[2]} cm` };
    // a METOD wall cabinet is 37 deep, except the one over a fridge, which is as deep as the fridge's cabinet
    if (kind === "appliance" && guessed.d) d = x.hung && x.use !== "fridge" ? 37 : 60;
  } else if (FLAT.has(kind)) {
    if (v.length === 3) set(v[0], v[2], v[1]);
    // a conference table with two measures is a round one, across and high
    else if (v.length === 2 && kind === "conftable") {
      set(v[0], v[1], v[0]);
      x.round = true;
    } else if (v.length === 2) set(v[0], undefined, v[1]);
    else if (v.length === 1) {
      if (kind === "bench") set(v[0]);
      else if (kind === "trolley" || kind === "console") return { skip: "trolley or console with one size" };
      else if (v[0] > 160) return { skip: "round table larger than 160 cm" };
      else {
        set(v[0], undefined, v[0]);
        x.round = true;
      }
    } else if (hint?.kind === kind) set(hint.w, hint.h, hint.d);
    else if (TYPICAL[t]) [w, h, d] = TYPICAL[t];
    else if (kind !== "bench") return { skip: "no size given" };
    if (guessed.h && hint?.kind === kind) h = hint.h;
  } else if (kind === "dropleaf" || kind === "gateleg") {
    // drawn with the leaves up: as wide as it opens
    const open = Math.max(...f.size.replace(/x.*$/, "").split("/").map(Number));
    set(open, undefined, v[1]);
    h = hint?.kind === kind ? hint.h : 75;
  } else if (kind === "bunk" || kind === "loft") {
    // IKEA gives the mattress size; the height is a typical one (KURA, which turns over, is low)
    if (v.length !== 2 || v[1] < 180 || v[1] > 210) return { skip: "bunk or loft bed without a mattress size" };
    x.m = v[0];
    if (v[1] !== 200) x.l = v[1];
    set(v[1] + 11, undefined, v[0] + 10);
    h = kind === "bunk" ? 160 : /reversible/.test(t) ? 116 : 195;
  } else if (kind === "daybed") {
    // IKEA gives the mattress size; the outer size comes from IKEA's own pages where we have it
    if (v.length !== 2 || v[1] < 180 || v[1] > 210) return { skip: "day-bed without a mattress size" };
    x.m = v[0];
    if (v[1] !== 200) x.l = v[1];
    const known = DAYBED_SIZE[family];
    if (known) set(...known);
    else [w, h, d] = [v[1] + 7, 83, v[0] + 11];
    const chest = hints(family, "chest");
    if (x.rows && chest?.x.knobs) x.knobs = chest.x.knobs;
  } else if (kind === "cot") {
    // IKEA gives the mattress size: a cot is a little longer and wider, about 85 cm high
    if (v.length !== 2 || v[1] < 100 || v[1] > 150) return { skip: "cot without a mattress size" };
    [x.m, x.l] = [v[0], v[1]];
    set(v[1] + 10, undefined, v[0] + 8);
    h = v[1] >= 140 ? 86 : 82;
  } else if (kind === "chaise" || kind === "corner" || kind === "usofa") {
    // IKEA gives no size: seat width, depth and height from a straight sofa of the same family, else a typical one
    const sofa = hints(family, "sofa");
    const arms = sofa?.x.arms ?? "wide";
    const armCm = arms === "wide" ? 17 : arms === "slim" ? 8 : 0;
    const per = sofa?.kind === "sofa" && sofa.x.seats ? Math.min(75, Math.max(55, (sofa.w - 2 * Math.min(armCm, sofa.w * 0.12)) / sofa.x.seats)) : 64;
    const sd = sofa?.kind === "sofa" && sofa.d <= 110 ? sofa.d : 92;
    if (sofa?.kind === "sofa") h = sofa.h;
    x.arms = arms;
    x.sd = sd;
    const n = x.seats ?? 3;
    if (v.length) return { skip: "corner sofa measured in a way we can't place" };
    if (kind === "chaise") {
      [w, d] = [n * per + 2 * armCm, Math.min(175, Math.max(140, sd + 68))];
    } else if (kind === "usofa") {
      // the chaise longue and the corner seat count among the seats; the back gets the extra seat, and seats shrink
      // a little if the U would be too big to draw
      const n1 = Math.ceil((n - 2) / 2), n2 = n - 2 - n1;
      const front = n2 ? armCm : 0;
      const cw = Math.min(per, (398 - armCm - sd) / (n1 + 1), n2 ? (238 - sd - front) / n2 : Infinity);
      if (cw < 50) return { skip: "U-shaped sofa too large" };
      [w, d] = [armCm + (n1 + 1) * cw + sd, Math.max(Math.min(175, Math.max(140, sd + 68)), sd + n2 * cw + front)];
    } else {
      // the long side gets the extra seat; seats shrink a little if the L would be too big to draw
      const n1 = Math.ceil((n - 1) / 2), n2 = n - 1 - n1;
      const front = x.open || !n2 ? 0 : armCm;
      const cw = Math.min(per, (318 - armCm - sd) / n1, n2 ? (238 - sd - front) / n2 : Infinity);
      if (cw < 50) return { skip: "corner sofa too large" };
      [w, d] = [armCm + n1 * cw + sd, sd + n2 * cw + front];
    }
  } else if (kind === "section") {
    // IKEA gives no size: seat width, depth and height from a straight sofa of the same family, else a typical one
    // a modular easy chair may come measured across
    if (v.length && !(x.arms && v.length === 1)) return { skip: "sofa section measured in a way we can't place" };
    const sofa = hints(family, "sofa");
    const armCm = sofa?.x.arms === "slim" ? 8 : sofa?.x.arms === "none" ? 0 : 17;
    const per = sofa?.kind === "sofa" && sofa.x.seats ? Math.min(75, Math.max(55, (sofa.w - 2 * Math.min(armCm, sofa.w * 0.12)) / sofa.x.seats)) : 64;
    w = (x.seats ?? 1) * per;
    if (/^\d[.,]5-seat/.test(t)) w += per / 2;
    if (x.arms) w = v.length ? v[0] : w + 2 * (sofa?.x.arms === "slim" ? 8 : 17);
    if (sofa?.kind === "sofa") [h, d] = [sofa.h, sofa.d <= 110 ? sofa.d : 92];
    // a chaise longue section reaches forward as far as the family's chaise would
    if (x.chaise) {
      d = Math.min(175, Math.max(140, d + 68));
      delete x.chaise;
    }
    // a corner section is as wide as the family's seats are deep
    if (x.corner) w = d;
  } else if (kind === "cornerdesk") {
    // IKEA gives the two legs of the L, the longer one along the back
    if (v.length !== 2) return { skip: "corner desk with a size we can't read" };
    set(Math.max(v[0], v[1]), hint?.kind === "desk" ? hint.h : 74, Math.min(v[0], v[1]));
    guessed.h = true;
    if (DESK_DEPTH[family]) x.sd = DESK_DEPTH[family];
  } else if (kind === "cornerrobe") {
    // IKEA gives the two legs and the height: "211/161x201 cm"
    const legs = f.size.replace(/\s+/g, "").match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)cm$/);
    if (!legs) return { skip: "corner wardrobe with a size we can't read" };
    const lay = cornerLayout(Number(legs[1]), Number(legs[2]), FRAME_SIZES[family] ?? FRAME_SIZES.PAX);
    if (!lay) return { skip: "corner wardrobe we can't split into frames" };
    set(lay.back, Number(legs[3]), lay.side);
    Object.assign(x, { u: lay.u.join("+"), ...(lay.v.length ? { v: lay.v.join("+") } : {}), ...(lay.cu !== 35 ? { cu: lay.cu } : {}) });
    const robe = hints(family, "wardrobe");
    if (robe?.x.shelves) x.shelves = robe.x.shelves;
  } else if (kind === "cornercab") {
    // an L is measured leg by leg ("88x88"), or as a frame with its leg's depth ("88x60x80"); a blind corner wide by deep;
    // a wall cabinet wide by high; some families wide by high with the worktop on top
    if (sz.ext || v.length < 2) return { skip: "corner cabinet with a size we can't read" };
    const ell = !x.blind;
    if (v.length === 3) {
      set(v[0], v[2], ell ? v[0] : v[1]);
      if (ell) x.sd = v[1];
    } else if (x.hung) set(v[0], v[1], v[0]);
    else if (CORNER_WH[family]) set(v[0], v[1], CORNER_WH[family]);
    else set(v[0], 80, v[1]);
    guessed.h = v.length === 2 && !x.hung && !CORNER_WH[family];
    if (hint?.x.knobs) x.knobs = hint.x.knobs;
  } else if (kind === "riser") {
    // wide by deep, or wide by deep by high; a stand IKEA gives as wide by high stands on the floor
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length === 2 && v[1] > 45) [w, h, d] = [v[0], v[1], 50];
    else if (v.length === 2) set(v[0], undefined, v[1]);
    if (x.cat === "Monitor stand" && guessed.w) [w, d] = [55, 24];
  } else if (kind === "hatrack") {
    // IKEA gives the width, sometimes the depth and height
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length >= 1) set(v[0]);
  } else if (kind === "coatstand") {
    // IKEA gives the height, sometimes the width of the feet after it
    if (v.length === 1) set(undefined, v[0]);
    else if (v.length === 2) set(v[1], v[0], v[1]);
    if (kids && guessed.w) [w, d] = [38, 38];
  } else if (kind === "deskdraw" || kind === "boxdesk") {
    // measured from above, or wide by deep by high; a dressing table's height takes in its mirror
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length === 2) set(v[0], undefined, v[1]);
    if (x.cat === "Work bench" && guessed.h) h = 90;
    if (x.mirror && guessed.h) h += 85;
  } else if (kind === "shelfbench" || kind === "workbench") {
    // IKEA gives the width, sometimes the depth and height too; a stool without a size is a typical one
    if (x.cat === "Stool with storage") [w, h, d] = [44, 46, 36];
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length === 2) set(v[0], undefined, v[1]);
    else if (v.length === 1) set(v[0]);
  } else if (kind === "lidbox") {
    // wide by deep by high; a table measured from above; a stool by its height
    const typical = LIDBOX_SIZE[x.cat ?? ""];
    if (typical) [w, h, d] = typical;
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length === 2) set(v[0], undefined, v[1]);
    else if (v.length === 1) set(undefined, v[0]);
  } else if (kind === "office") {
    // IKEA gives no size for office chairs: a typical one, taller with a headrest, smaller for children
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (kids) [w, h, d] = [52, 86, 52];
    else {
      if (x.arms === "none") w = 60;
      if (/headrest|gaming/.test(t) || OFFICE_TALL.has(family)) h = 128;
    }
  } else {
    // seats: IKEA mostly gives no size, or the seat height for stools
    if (v.length === 3) set(v[0], v[2], v[1]);
    else if (v.length === 1 && (kind === "sofa" || kind === "armchair") && v[0] >= 60) set(v[0]);
    else if (v.length === 1 && v[0] >= 25 && v[0] <= 90) {
      if (kind === "stool") set(undefined, v[0]);
      else if (x.seatH) {
        x.seatH = v[0];
        set(undefined, v[0] + 32);
      }
    } else if (v.length === 2 && kind === "sofa") set(v[0], undefined, v[1]);
    else if (v.length === 2 && kind === "stool") set(v[0], v[1], v[0]);
    if (kind === "stool" && guessed.h) h = /bar/.test(t) ? 74 : /step/.test(t) ? 50 : kids ? 30 : 45;
    if (kind === "chair" && x.seatH && guessed.h) h = x.seatH + 32;
    if (kind === "lounge" && guessed.h && /reclin/.test(t)) [w, h, d] = [66, 102, 84];
    if (kind === "sofa" && guessed.w) w = (x.seats ?? 3) * 60 + 50;
    // a sofa or armchair with a side table module is that much wider, as wide as we draw at most
    if (x.st && guessed.w) w = Math.min(400, (kind === "armchair" ? 75 : (x.seats ?? 3) * 60 + 50) + x.st);
    // more than four seats: two sections side by side, as wide as the family's own seats, or as wide as we draw
    if (kind === "sofa" && guessed.w && (x.seats ?? 3) > 4) w = Math.min(398, w);
    if (kind === "sofa" && guessed.w && (x.seats ?? 3) > 4 && hint?.kind === "sofa" && hint.x.seats) {
      const armCm = hint.x.arms === "wide" ? 17 : hint.x.arms === "slim" ? 8 : hint.x.arms === "none" ? 0 : 17;
      w = (x.seats ?? 3) * ((hint.w - 2 * armCm) / hint.x.seats) + 2 * armCm;
      [h, d] = [hint.h, hint.d];
    }
    if (kind === "armchair" && /wing|high-back/.test(t) && guessed.h) h = 104;
    if (kind === "armchair" && /^1,5-seat/.test(t) && guessed.w) w = 105;
    if (kind === "pouffe" && v.length === 2) [w, d] = [v[0], v[1]];
    if (kind === "armchair" && kids && guessed.w) [w, h, d] = [55, 68, 58];
    if (kind === "swivel" && kids && guessed.w) [w, h, d] = [59, 70, 64];
    if (hint && guessed.w && guessed.h && hint.kind === kind && (kind !== "sofa" || hint.x.seats === x.seats)) {
      [w, h, d] = [hint.w, hint.h, hint.d];
    }
  }

  // parameters from the type name, the size and the family's hand made rows
  if (hint?.x.knobs && ["chest", "nightstand", "wardrobe", "cabinet", "sideboard", "tv", "shoe", "wallcab", "kitchen", "mixed", "washstand", "sinkcab", "appliance"].includes(kind)) x.knobs = hint.x.knobs;
  if (kind === "chest" || kind === "nightstand") {
    const total = x.rows ?? (kind === "nightstand" ? (h >= 60 ? 2 : 1) : Math.min(6, Math.max(2, Math.round(h / 14))));
    if (kind === "chest" && total === 2 && w <= 60 && h <= 65 && !/^mini/.test(t)) return finish("nightstand");
    const shape = kind === "nightstand" ? { rows: Math.min(total, 3), cols: 1 as const } : chestShape(total, w, h);
    // a modular chest: columns of drawer slots, some left open
    const mod = !shape && kind === "chest" ? MODULE[family] : undefined;
    if (mod) {
      const mods = Math.round(w / mod[0]), rows = Math.round((h - mod[2]) / mod[1]);
      if (mods >= 1 && mods <= 4 && rows >= 1 && rows <= 8 && mods * rows >= total) {
        Object.assign(x, { mods, rows, ...(total < mods * rows ? { dr: total } : {}) });
        if (hint?.x.knobs) x.knobs = hint.x.knobs;
        return finish(kind);
      }
    }
    if (!shape) return { skip: "drawers we can't lay out (open sections or 3 columns)" };
    x.rows = shape.rows;
    if (shape.cols === 2) x.cols = 2;
    if (hint?.x.plinth) x.plinth = true;
  }
  if (kind === "wardrobe" && x.doors === 0 && x.shelves === undefined && hint?.x.shelves) x.shelves = hint.x.shelves;
  // a combination this wide is more than one frame, which one carcass can't show: a row of them when the frames are all alike
  const several =
    (kind === "wardrobe" || kind === "sliding") && multi && w > 100
      ? "several wardrobe frames"
      : ((kind === "cabinet" || kind === "bookcase") && multi && w > 100) ||
          (f.spr && w > 125 && ["bookcase", "open", "cabinet", "wardrobe", "shoe", "wallcab", "wallshelf", "kitchen", "sliding", "slidecab"].includes(kind)) ||
          (kind === "tv" && f.spr && w > 200)
        ? "several units side by side"
        : null;
  if (several) {
    // PAX frames (58 or 35 deep) with a pair of sliding doors in front of them all: IKEA's depth includes the doors
    const sliding = family === "PAX" && (kind === "sliding" || (kind === "wardrobe" && (d === 66 || d === 43)));
    if (sliding) {
      const unit = PAX_SLIDE_UNITS.find((u) => w % u === 0 && w / u >= 2 && w / u <= 3);
      // or frames of different widths under the doors
      const mixed = unit ? null : framesFor(w, PAX_SLIDE_UNITS, 0, 3);
      if (!unit && !mixed) return { skip: "PAX with sliding doors over frames of different widths" };
      Object.assign(x, { ...(mixed ? { u: mixed.join("+") } : { n: w / unit! }), of: "wardrobe", slides: 2, doors: undefined, shelves: hints(family, "wardrobe")?.x.shelves });
      for (const k of Object.keys(x) as (keyof X)[]) if (x[k] === undefined) delete x[k];
      return finish("cabrow");
    }
    // a count of frames that can't all be alike (three PAX frames in 200 cm): the family's widths that add up to it
    const sizesOf = FRAME_SIZES[family];
    if (x.n && sizesOf && (kind === "wardrobe" || kind === "open") && !sizesOf.includes(w / x.n)) {
      const exact = framesExact(w, sizesOf, x.n, SHARED_POST[family]);
      if (!exact) return { skip: several };
      delete x.n;
      Object.assign(x, { u: exact.join("+"), of: kind });
      return finish(kind === "open" ? "bookrow" : "cabrow");
    }
    // the rule may already know how many frames there are (PLATSA)
    const unit = x.n ? w / x.n : ROW_UNITS[family];
    const n = unit ? Math.round(w / unit) : 0;
    if (!unit || n < 2 || n > 4 || n * unit !== w || !["bookcase", "cabinet", "tv", "wardrobe", "wallcab"].includes(kind)) {
      // frames of the family's widths that aren't all alike: a wide BILLY and a narrow one, PAX 100 and 50
      const sizes = FRAME_SIZES[family];
      const mixed = !x.n && sizes && ["bookcase", "open", "cabinet", "wardrobe"].includes(kind) ? framesFor(w, sizes, SHARED_POST[family]) : null;
      if (!mixed) return { skip: several };
      x.u = mixed.join("+");
      // PAX frames on their own come without doors, and empty
      if (kind === "wardrobe" && !multi) Object.assign(x, { doors: 0, shelves: 0 });
      for (const k of Object.keys(x) as (keyof X)[]) if (x[k] === undefined) delete x[k];
      x.of = kind as NonNullable<X["of"]>;
      return finish(kind === "bookcase" || kind === "open" ? "bookrow" : "cabrow");
    }
    x.n = n;
    x.of = kind as NonNullable<X["of"]>;
    return finish(kind === "bookcase" ? "bookrow" : "cabrow");
  }
  if (kind === "tv" && h > 100) return { skip: "TV storage wall" };
  if (kind === "shoe" && x.c === undefined) x.c = h < 60 ? 1 : h < 115 ? 2 : 3;
  if (kind === "cube" && (Math.round((w - 6) / 35) > 5 || Math.round((h - (x.uf ?? 0) - 6) / 35) > 5)) return { skip: "cube grid larger than 5 x 5" };
  if (kind === "desk" || kind === "coffee" || kind === "side") {
    if (hint?.x.attach) x.attach = hint.x.attach;
    if (hint?.x.legs) x.legs = hint.x.legs;
    if (kind === "coffee" && hint?.x.shelf !== undefined) x.shelf = hint.x.shelf;
  }
  if (kind === "desk" && h > 100) return { skip: "desk with a shelf unit" };
  if ((kind === "sofa" || kind === "armchair") && hint?.x.arms) x.arms = hint.x.arms;
  return finish(kind);

  function finish(k: Kind): Verdict {
    const arch = KIND_ARCH[k];
    // the product page's measurements: real sizes where the listing gave none, and how a sofa really stands
    const got = f.m ? fromPage(k, f.m, { m: x.m, l: x.l }) : null;
    // a sofa narrower than its seats can be is measured some other way (a sleeper sofa's width is its depth)
    if (got && got.w !== undefined && (k === "sofa" || k === "chaise") && (x.seats ?? 1) >= 2 && got.w < 55 * (x.seats ?? 1)) got.w = undefined;
    // a dressing table its page measures taller than a table is: the mirror standing on it is in that height
    if (k === "desk" && /^dressing table$/.test(t) && (got?.h ?? (guessed.h ? 0 : h)) > 110) {
      Object.assign(x, { rows: 1, mirror: true, cat: "Dressing table" });
      return finish("deskdraw");
    }
    // a "4-seat sofa" IKEA measures as deep as a chaise longue is a sofa with one, at the right-hand end
    if (k === "sofa" && got?.d !== undefined && guessed.d && got.d > 130 && (x.seats ?? 0) >= 3) {
      x.chaise = "right";
      x.sd = got.x.sdp ? Math.min(110, got.x.sdp + 38) : 95;
      return finish("chaise");
    }
    const paged = { w: false, h: false, d: false };
    // a listing that gives two sizes ("48x38 cm") leaves out the third, and doesn't say which: the page does
    if (got && v.length < 3 && PARTIAL_OK.has(k)) {
      const now = { w, h, d };
      for (const key of ["w", "h", "d"] as const) {
        const g = got[key];
        if (g !== undefined && !guessed[key] && Math.abs(g - now[key]) > Math.max(3, now[key] * 0.06)) guessed[key] = true;
      }
      // drawers need room: a page height too low for them is a measure of something else
      if (got.h !== undefined && (x.rows ?? 0) * 9 + 6 > got.h) {
        guessed.h = false;
        got.h = undefined;
      }
    }
    // a bed's frame by its page, rather than a size worked out from its mattress: as known as the mattress it is for
    if (got && arch === "bed") {
      if (got.w !== undefined) [w, guessed.w] = [got.w, false];
      if (got.h !== undefined) [h, guessed.h] = [got.h, false];
      if (got.d !== undefined) [d, guessed.d] = [got.d, false];
    }
    if (got) {
      if (got.w !== undefined && guessed.w) paged.w = true;
      if (got.h !== undefined && guessed.h) paged.h = true;
      if (got.d !== undefined && guessed.d) paged.d = true;
      if (got.w !== undefined && guessed.w) [w, guessed.w] = [got.w, false];
      if (got.h !== undefined && guessed.h) [h, guessed.h] = [got.h, false];
      if (got.d !== undefined && guessed.d) [d, guessed.d] = [got.d, false];
      Object.assign(x, got.x);
    }
    // a long sofa is drawn as sections joined together, so it can be longer than anything else
    if (w < 20 || w > (arch === "sofa" ? 400 : 320) || h < 15 || h > 260 || d < 12 || d > (arch === "sofa" ? 400 : 240)) return { skip: "size out of range" };
    if (arch === "table" && h < 30 && k !== "kidstable" && k !== "riser") return { skip: "size out of range" };
    if (arch === "shelf" && h < 25) return { skip: "size out of range" };
    const kw: string[] = [];
    if (outdoor) kw.push("outdoor", "garden");
    if (kids && !/children/.test(t)) kw.push("kids", "children");
    else if (kids) kw.push("kids");
    const size = sz!.bed ? `${sz!.text}, ${sz!.bed[0]} × ${sz!.bed[1]} cm` : sz!.text;
    return { draw: { kind: k, x, w: Math.round(w), h: Math.round(h), d: Math.round(d), label: raw, size, kw, guessed, ...(paged.w || paged.h || paged.d ? { paged } : {}) } };
  }
}

/** Kinds whose page measures the same outside size we draw, so a page can settle a listing that gives only two sizes. */
const PARTIAL_OK = new Set<Kind>(["nightstand", "open", "chest", "bookcase", "cabinet", "side", "coffee", "desk", "trolley", "stool", "bench", "tv", "sideboard", "shoe", "wardrobe", "cube", "console"]);
const SOFA_KINDS = new Set<Kind>(["sofa", "armchair", "chaise", "corner", "section", "usofa", "chairbed"]);
const SEAT_H_KINDS = new Set<Kind>(["chair", "office", "kidschair", "junior", "conference", "swivel", "lounge"]);

/**
 * A bed frame as its page measures it: the frame's width and length (with a headboard wider than the frame, that), and
 * the headboard's height, or the whole height when it has none; a footboard's height goes in x.f. A bed frame is drawn
 * across our width, a cot, bunk, loft or day-bed lengthways. A page that measures another mattress than the listing's
 * (one size's page shown for another) says nothing about this one.
 */
function bedFromPage(k: Kind, m: Record<string, string>, bed: { m?: number; l?: number }): { w?: number; h?: number; d?: number; x: X } | null {
  const mw = cm(m["Mattress width"]) ?? cm(m["Bed width"]), ml = cm(m["Mattress length"]) ?? cm(m["Bed length"]);
  const want = [bed.m, bed.l ?? (k === "bed" || k === "bunk" || k === "loft" || k === "daybed" ? 200 : undefined)];
  const same = (a?: number, b?: number) => a === undefined || b === undefined || Math.abs(a - b) <= 4;
  // a page can give the mattress the wrong way round (MINNEN): either way is the same mattress
  if (!((same(mw, want[0]) && same(ml, want[1])) || (same(ml, want[0]) && same(mw, want[1])))) return null;
  const r = (n?: number) => (n === undefined ? undefined : Math.round(n));
  const len = cm(m["Length"]), wide = cm(m["Width"]);
  // the frame is larger than its mattress, and not by more than a bedside's worth
  const fits = (v: number | undefined, mat: number | undefined) => v !== undefined && (mat === undefined || (v >= mat - 2 && v <= mat + 45));
  const W = fits(wide, want[0]) ? wide : undefined, L = fits(len, want[1]) ? len : undefined;
  const x: X = {};
  if (k === "bed") {
    const head = cm(m["Headboard width"]);
    const h = cm(m["Headboard height"]) ?? cm(m["Height"]);
    const foot = cm(m["Footboard height"]);
    if (foot !== undefined && foot >= 10 && (h === undefined || foot <= h)) x.f = r(foot);
    else if (h !== undefined && h < 38) x.f = r(h);
    const w = W !== undefined && head !== undefined && head > W && head <= W + 150 ? head : W;
    if (w === undefined && h === undefined && L === undefined) return null;
    return { w: r(w), h: r(h), d: r(L), x };
  }
  const h = cm(m["Height"]);
  if (W === undefined && h === undefined && L === undefined) return null;
  return { w: r(L), h: r(h), d: r(W), x };
}

/** "48 cm" or "48.5 cm" as a number, or undefined. */
function cm(v?: string) {
  const m = v?.match(/^(\d+(?:\.\d+)?) cm$/);
  return m ? Number(m[1]) : undefined;
}

/**
 * What a product page's measurements say about a product drawn as `k`: its outer size in our w, h, d (h is the
 * height with the back cushions on a sofa), and for sofas and armchairs the seat height and depth, the armrests, the
 * backrest frame and the room under it. A bed's page measures its frame, long by wide, for the mattress `bed` gives.
 */
export function fromPage(k: Kind, m: Record<string, string>, bed?: { m?: number; l?: number }): { w?: number; h?: number; d?: number; x: X } | null {
  const arch = KIND_ARCH[k];
  if (arch === "bed") return bedFromPage(k, m, bed ?? {});
  // corner pieces are measured by each leg, where our depth is the other leg
  if (k === "cornercab" || k === "cornerrobe" || k === "cornerdesk") return null;
  const x: X = {};
  const r = (n?: number) => (n === undefined ? undefined : Math.round(n));
  let w = cm(m["Width"]), d = cm(m["Depth"]);
  // a desk or table that goes up and down stands at its lowest
  let h = cm(m["Height including back cushions"]) ?? cm(m["Height"]) ?? cm(m["Min. height"]);
  // a sofa whose frame stands taller than its back cushions is as tall as its frame
  if (SOFA_KINDS.has(k) && cm(m["Height"]) !== undefined && h !== undefined) h = Math.max(h, cm(m["Height"])!);
  // a chair that goes up and down, measured only at its tallest
  if (h === undefined && SEAT_H_KINDS.has(k)) h = cm(m["Max. height"]);
  // tables and benches are measured long by wide: the length runs along our width
  const len = cm(m["Length"]) ?? (k === "dropleaf" || k === "gateleg" ? cm(m["Max. length"]) : cm(m["Min. length"]));
  if (len !== undefined && arch !== "sofa") [w, d] = [len, cm(m["Width"]) ?? d];
  const dia = cm(m["Diameter"]);
  if (dia !== undefined && w === undefined) w = d = dia;
  // a round pouffe
  if (k === "pouffe" && dia !== undefined) {
    w = d = dia;
    x.round = true;
  }
  // a stool's page can measure the seat alone; anything this far off is a different measure, not a size
  if (k === "stool" && h !== undefined && h < 30) h = undefined;
  if (SOFA_KINDS.has(k)) {
    // (the US pages call it the depth of the chaise)
    const chaiseD = cm(m["Depth chaise longue"]) ?? cm(m["Depth chaise"]);
    if (k === "chaise" && chaiseD !== undefined) {
      if (d !== undefined) x.sd = r(d);
      d = chaiseD;
    }
    // a corner sofa measured leg by leg: its depth is then how deep the seats are. We draw the longer leg along the
    // back (our width) and the shorter one as the return (our depth), whichever side IKEA's page names first
    if (k === "corner" && w === undefined && (cm(m["Width left"]) ?? cm(m["Width right"])) !== undefined) {
      if (d !== undefined) x.sd = r(d);
      const a = cm(m["Width left"]) ?? cm(m["Width right"])!, b = cm(m["Width right"]) ?? a;
      [w, d] = [Math.max(a, b), Math.min(a, b)];
    }
    // a U is as deep as its chaise reaches: its depth on the page is how deep the seats are
    if (k === "usofa") {
      // (unless it is the whole footprint's depth)
      if (d !== undefined && d <= 120) {
        x.sd = r(d);
        d = cm(m["Width right"]) ?? chaiseD;
      }
      w = w ?? cm(m["Width left"]);
      // measured leg by leg: the longer leg runs along the back, the shorter one is how deep it is, as for a corner sofa
      const a = cm(m["Width left"]), b = cm(m["Width right"]);
      if (a !== undefined && b !== undefined) [w, d] = [Math.max(a, b), Math.min(a, b)];
    }
    // a sofa-bed measured closed and open can give its depth as its width: a sofa is wider than it is deep
    if ((k === "sofa" || k === "chaise" || k === "corner" || k === "usofa") && w !== undefined && d !== undefined && w < d && k !== "corner") w = d = undefined;
    const seatH = cm(m["Seat height"]) ?? cm(m["Max. seat height"]);
    const seatD = cm(m["Seat depth"]);
    const armH = cm(m["Armrest height"]) ?? cm(m["Max. armrest height"]);
    const armW = cm(m["Armrest width"]);
    const back = cm(m["Height backrest"]) ?? cm(m["Backrest height"]);
    const leg = cm(m["Free height under furniture"]) ?? cm(m["Height under furniture"]);
    if (seatH !== undefined && seatH >= 25 && seatH <= 65) x.seatH = r(seatH);
    if (seatD !== undefined && seatD >= 30 && seatD <= 100 && k !== "chaise") x.sdp = r(seatD);
    if (armH !== undefined && armH >= 35 && armH <= 110) x.ah = r(armH);
    if (armW !== undefined && armW >= 4 && armW <= 45) x.aw = r(armW);
    if (back !== undefined && back >= 40 && back <= 120 && (h === undefined || back <= h)) x.bk = r(back);
    if (leg !== undefined && leg >= 0 && leg <= 40) x.lg = r(leg);
  } else if (SEAT_H_KINDS.has(k)) {
    const seatH = cm(m["Seat height"]) ?? cm(m["Max. seat height"]);
    if (seatH !== undefined && seatH >= 20 && seatH <= 85) x.seatH = r(seatH);
  }
  if (w === undefined && h === undefined && d === undefined && !Object.keys(x).length) return null;
  return { w: r(w), h: r(h), d: r(d), x };
}
