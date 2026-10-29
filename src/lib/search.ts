import { PRODUCTS, catalogEntry, toSpec, type CatalogEntry } from "./catalog";
import { fold } from "./fold";
import { articleNo, articleSlug, isGuardedName, loadArticles } from "./ikea";
import { KIND_DEFAULT_SIZE, KIND_LABELS, specFor, type Kind } from "./products";
import type { Archetype, ProductSpec } from "./types";

export { fold };
export { articleNo, articlesReady, ikeaType, ikeaTypes, isIkeaName, loadArticles } from "./ikea";

// the server answers /api/guide with whatever is loaded, so it keeps the article numbers at hand
if (typeof window === "undefined") loadArticles().catch(() => {});

export function slugify(s: string) {
  return fold(s).replace(/\s+/g, "-").slice(0, 60) || "product";
}

const CATEGORY_WORDS: [Kind, string[]][] = [
  ["office", ["office chair", "desk chair", "swivel chair", "gaming chair", "computer chair"]],
  ["bookrow", ["bookcase combination", "bookshelf combination", "shelving combination", "shelving unit combination", "shelf combination"]],
  ["cabrow", ["tv bench combination", "tv unit combination", "media unit combination", "cabinet combination", "wardrobe combination", "closet combination", "wall cabinet combination"]],
  ["washstand", ["wash stand", "washstand", "vanity", "vanity unit", "bathroom vanity", "basin unit", "basin cabinet", "wash basin cabinet", "washbasin cabinet", "bathroom cabinet", "sink vanity"]],
  ["sinkcab", ["sink cabinet", "sink base", "sink base cabinet", "sink unit", "kitchen sink cabinet", "under sink cabinet", "cabinet for sink", "sink cupboard"]],
  ["appliance", ["appliance cabinet", "oven cabinet", "oven housing", "oven unit", "tall oven unit", "wall oven cabinet", "cabinet for oven", "fridge cabinet", "fridge housing", "refrigerator cabinet", "freezer cabinet", "cabinet for fridge", "microwave cabinet", "hob cabinet", "hob unit", "cooktop cabinet", "hood cabinet", "extractor hood cabinet"]],
  ["cornerrobe", ["corner wardrobe", "corner closet", "corner armoire", "l shaped wardrobe", "l shaped closet", "corner wardrobe unit"]],
  ["cornercab", ["corner cabinet", "corner base cabinet", "corner wall cabinet", "corner cupboard", "corner base unit", "corner wall unit", "corner kitchen cabinet", "corner kitchen unit", "blind corner", "blind corner cabinet", "lazy susan", "lazy susan cabinet", "carousel unit", "carousel cabinet"]],
  ["lidbox", ["storage bench", "storage chest", "storage table", "storage ottoman", "storage footstool", "footstool with storage", "pouffe with storage", "pouf with storage", "storage pouffe", "storage pouf", "storage stool", "blanket box", "toy box", "toy chest", "bench with lid", "hope chest"]],
  ["divider", ["room divider", "room dividers", "folding screen", "privacy screen", "partition screen", "room screen"]],
  ["changing", ["changing table", "changing unit", "baby changing table", "changing station", "diaper changing table", "nappy changing table"]],
  ["airer", ["drying rack", "clothes airer", "airer", "clothes horse", "laundry rack", "clothes drying rack", "drying stand", "laundry drying rack"]],
  ["riser", ["laptop stand", "monitor stand", "monitor riser", "laptop riser", "screen riser", "desk riser", "desktop shelf", "monitor shelf", "computer stand"]],
  ["coatstand", ["coat stand", "hat and coat stand", "hat stand", "clothes stand", "coat tree", "hall tree", "hat tree", "standing coat rack", "coat rack stand"]],
  ["hatrack", ["hat rack", "hat shelf", "wall coat rack", "coat rack with shelf", "wall hat rack", "hat and coat rack", "coat hooks with shelf"]],
  ["clothesrack", ["clothes rack", "clothes rail", "clothing rack", "clothing rail", "garment rack", "garment rail", "coat rack", "coat stand"]],
  ["shoerack", ["shoe rack", "shoe shelf", "shoe stand", "shoe bench", "open shoe storage"]],
  ["shoe", ["shoe", "shoes", "shoe cabinet", "shoe rack"]],
  ["extension", ["height extension", "height extension unit", "extension unit", "top unit", "bookcase topper", "bookshelf topper", "wardrobe top unit", "closet top unit", "top cabinet for wardrobe"]],
  ["nightstand", ["nightstand", "bedside", "night stand"]],
  ["mixed", ["doors and drawers", "cabinet with drawers", "cupboard with drawers", "wardrobe with drawers", "armoire with drawers"]],
  ["chest", ["drawer", "drawers", "chest", "dresser"]],
  ["cube", ["cube", "cubes"]],
  ["wallshelf", ["wall shelf", "wall shelves", "wall shelf unit"]],
  ["wallcab", ["wall cabinet", "wall cupboard", "mirror cabinet"]],
  ["kitchen", ["kitchen cabinet", "base cabinet", "high cabinet", "kitchen unit"]],
  ["bookcase", ["bookcase", "bookshelf", "shelf", "shelving", "shelves"]],
  ["tv", ["tv", "media"]],
  ["coffee", ["coffee"]],
  ["kidstable", ["children s table", "childrens table", "kids table", "kid table"]],
  ["bar", ["bar table", "high table"]],
  ["console", ["console", "console table", "hall table"]],
  ["trolley", ["trolley", "cart", "kitchen island"]],
  ["conftable", ["conference table", "meeting table", "meeting room table", "boardroom table"]],
  ["cornerdesk", ["corner desk", "l shaped desk", "corner workstation", "corner computer desk", "corner office desk", "l desk"]],
  ["deskdraw", ["desk with drawers", "desk with drawer", "writing desk with drawers", "table with drawer", "table with drawers", "work bench with drawers", "dressing table with mirror", "makeup table with mirror"]],
  ["boxdesk", ["desk with storage", "desk with storage boxes", "desk with boxes", "kids desk with storage", "children s desk with storage", "desk with shelves"]],
  ["desk", ["desk"]],
  ["gateleg", ["gateleg", "gateleg table", "gate leg", "gate leg table"]],
  ["dropleaf", ["drop leaf", "drop leaf table"]],
  ["dining", ["dining", "table", "kitchen table"]],
  ["cot", ["cot", "crib", "baby bed"]],
  ["bunk", ["bunk", "bunk bed", "bunkbed"]],
  ["loft", ["loft bed", "high sleeper"]],
  ["daybed", ["daybed", "day bed", "trundle bed"]],
  ["bed", ["bed", "bedframe"]],
  ["slidecab", ["cabinet with sliding doors", "sliding door cabinet", "cupboard with sliding doors", "sliding door cupboard"]],
  ["sliding", ["wardrobe with sliding doors", "sliding wardrobe", "sliding door wardrobe", "sliding door closet", "sliding closet", "sliding doors"]],
  ["wardrobe", ["wardrobe", "closet", "armoire"]],
  ["sideboard", ["sideboard", "buffet"]],
  ["cabinet", ["cabinet", "cupboard", "vitrine", "display"]],
  ["chaise", ["chaise longue", "chaise lounge", "chaise"]],
  ["section", ["sofa section", "seat section", "sofa module", "couch section", "sectional piece"]],
  ["usofa", ["u shaped sofa", "u shaped couch", "u shaped sectional", "u sofa", "u couch", "horseshoe sofa"]],
  ["corner", ["corner sofa", "corner couch", "sectional", "l shaped sofa"]],
  ["sofa", ["sofa", "couch", "loveseat"]],
  ["lounger", ["sun lounger", "sunlounger", "sun bed", "sunbed", "sun lounger chair", "pool lounger", "beach lounger", "garden lounger", "patio lounger"]],
  ["swivel", ["swivel armchair", "swivel easy chair", "swivel lounge chair", "swivel accent chair", "swivel rocker", "rocking armchair", "rocker recliner"]],
  ["conference", ["conference chair", "meeting chair", "meeting room chair", "boardroom chair"]],
  ["lounge", ["lounge chair", "reclining chair", "garden chair", "patio chair", "deck chair", "adirondack chair"]],
  ["chairbed", ["chair bed", "armchair bed", "sleeper chair", "chair sleeper", "fold out chair", "convertible chair"]],
  ["armchair", ["armchair", "wing chair", "recliner"]],
  ["pouffe", ["pouffe", "pouf", "footstool", "foot stool", "ottoman", "footrest"]],
  ["highchair", ["highchair", "high chair", "baby chair", "feeding chair"]],
  ["junior", ["junior chair", "youth chair", "child s dining chair", "toddler chair", "booster chair"]],
  ["kidschair", ["children s chair", "childrens chair", "kids chair", "kid chair"]],
  ["chair", ["chair", "chairs"]],
  ["workbench", ["work bench", "workbench", "work table", "garage bench", "potting bench", "tool bench", "craft table"]],
  ["shelfbench", ["bench with storage", "bench with shelf", "bench with a shelf", "stool with storage", "stool with shelf", "entryway bench", "hallway bench", "mudroom bench"]],
  ["stool", ["stool", "stools"]],
  ["backbench", ["bench with backrest", "garden bench", "bench with back", "outdoor bench", "park bench", "patio bench"]],
  ["bench", ["bench"]],
];
const KIND_WORDS = new Map(CATEGORY_WORDS);
// rows, sections, and kinds drawn later than a family's other pieces, which only come first when asked for
const LESSER = new Set<Kind>(["bookrow", "cabrow", "section", "sinkcab", "appliance", "washstand", "shoerack", "clothesrack", "changing", "divider", "backbench", "junior", "lounge", "highchair", "cornercab", "cornerrobe", "usofa", "lounger", "swivel", "conference", "cornerdesk", "conftable", "lidbox", "shelfbench", "workbench", "extension", "deskdraw", "boxdesk", "hatrack", "coatstand", "pouffe", "chairbed", "airer", "riser"]);

export function kindOf(q: string): Kind | null {
  const f = " " + fold(q) + " ";
  for (const [k, words] of CATEGORY_WORDS) if (words.some((w) => f.includes(" " + w + " ") || f.includes(" " + w + "s "))) return k;
  return null;
}

export function categoryOf(q: string): Archetype | null {
  const k = kindOf(q);
  return k ? specFor(k, "X", "", 1, 1, 1).archetype : null;
}

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export interface Hit {
  entry: CatalogEntry;
  score: number;
  /** the query names this product (or its article number), not just something like it */
  exact?: boolean;
}

/** Folded text per product, worked out once: search runs on every keystroke over a thousand or more rows. */
interface Row {
  e: CatalogEntry;
  name: string;
  nameKey: string;
  nameWords: string[];
  words: string[];
  padded: string;
  kids: boolean;
}
let rows: Row[] | null = null;
const rowOf = new Map<CatalogEntry, Row>();
function index(): Row[] {
  if (rows) return rows;
  rows = PRODUCTS.map((e) => {
    const name = fold(e.name);
    const hay = fold([e.name, e.variant, e.category, ...(e.keywords ?? [])].join(" "));
    const padded = ` ${fold(e.category)} ${hay} `;
    const kids = / (children s|childrens|kids|junior|baby|highchair|cot|changing) /.test(padded);
    const r = { e, name, nameKey: name.replace(/\s+/g, ""), nameWords: name.split(" "), words: hay.split(" "), padded, kids };
    rowOf.set(e, r);
    return r;
  });
  return rows;
}

/** Folded search text of a product (category, name, variant, keywords), for simple filters. */
export function searchText(e: CatalogEntry) {
  index();
  return rowOf.get(e)?.padded ?? ` ${fold([e.category, e.name, e.variant].join(" "))} `;
}

// Words people put before the name, on the box or in a sentence: "IKEA KALLAX", "the billy", "my malm".
// The first word is read as the name, so they matched IKEA PS or MYDAL instead.
const LEAD = new Set(["ikea", "the", "a", "an", "my", "our", "your", "this"]);

/** The folded query without those words in front. A query made only of them stays as it is. */
function leadless(q: string) {
  const words = fold(q).split(" ");
  let at = 0;
  while (at < words.length - 1 && LEAD.has(words[at])) at++;
  return words.slice(at).join(" ");
}

export function searchCatalog(q: string, limit = 8): Hit[] {
  const f = leadless(q);
  if (!f) return [];
  const no = articleNo(q);
  if (no) {
    const slug = articleSlug(no);
    const e = slug ? catalogEntry(slug) : null;
    return e ? [{ entry: e, score: 200, exact: true }] : [];
  }
  const tokens = f.split(" ");
  const kind = kindOf(q);
  const kw = kind ? KIND_WORDS.get(kind)! : null;
  const first = tokens[0];
  // "crib" or "sectional" alone names the type, so it counts like a word in the product's own text
  const firstIsKind = !!kw?.some((w) => w.split(" ").includes(first));
  const kidsQ = /\b(child|children|kid|kids|junior|baby|toddler)/.test(f);
  const joined = f.replace(/\s+/g, "");
  // a real IKEA name we can't draw is not a typo of one we can
  const typos = !isGuardedName(first);
  const byName = new Map<string, number>();
  const nameScore = (r: Row) => {
    let s = byName.get(r.name);
    if (s !== undefined) return s;
    if (r.name === f || r.nameKey === joined) s = 100;
    else if (r.nameWords.includes(first) || r.nameKey === first) s = 80;
    else if (first.length >= 2 && r.nameWords.some((w) => w.startsWith(first))) s = 60;
    else if (typos && first.length >= 4 && lev(first, r.nameKey) === 1) s = 52;
    else if (typos && first.length >= 6 && lev(first, r.nameKey) === 2) s = 42;
    else s = 0;
    byName.set(r.name, s);
    return s;
  };
  const hits: Hit[] = [];
  for (const r of index()) {
    const e = r.e;
    const ns = nameScore(r);
    let score = ns;
    const kwHit = !!kw?.some((w) => r.padded.includes(` ${w} `) || r.padded.includes(` ${w}s `));
    const lit = first.length >= 3 && r.words.some((w) => w.startsWith(first));
    // a type word counts for every product of that type, and a little more where the product says it ("oven cabinet")
    if (!ns && (lit || (firstIsKind && kwHit))) score += firstIsKind && lit ? 20.5 : 20;
    for (const t of tokens.slice(1)) if (t.length && r.words.some((w) => w.startsWith(t) || (t.length > 2 && w.includes(t)))) score += 12;
    if (kw) score += kwHit ? 14 : -30;
    // children's pieces come after the grown-up ones unless the search asks for them
    if (!ns && !kidsQ && r.kids) score -= 1;
    // rows of several units, sofa sections and appliance cabinets come after the plain product, unless the query asks for them
    if (e.kind && (LESSER.has(e.kind) || e.cabinet?.fit) && kind !== e.kind) score -= 1;
    // and rows of frames that aren't all alike after the rows of frames that are
    if (e.row?.units) score -= 0.5;
    // and pieces drawn later under IKEA's own name for them after the family's older ones of the same kind
    if (e.late) score -= kind === e.kind ? 0.5 : 1;
    // and the US range's own pieces after the UK ones of a family, as much as a word of the query is worth
    if (e.us) score -= 13;
    if (e.checked) score += 3;
    if (e.featured) score += 2;
    if (score > 15) hits.push({ entry: e, score, exact: ns >= 80 });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Best confident match, or null. Article numbers work once loadArticles() has run (it always has on the server). */
export function matchCatalog(q: string): ProductSpec | null {
  const [a, b] = searchCatalog(q, 2);
  if (!a || a.score < 50) return null;
  // a real IKEA name we can't draw must not land on a different product
  if (!a.exact && isGuardedName(leadless(q).split(" ")[0] ?? "")) return null;
  // a typo match only counts when it is clearly the best one
  if (a.score < 60 && b && b.score >= a.score - 4 && fold(b.entry.name) !== fold(a.entry.name)) return null;
  return toSpec(a.entry);
}

/** A typical build for a product we don't know, from the kind of furniture it is. */
export function specForKind(kind: Kind, name: string): ProductSpec {
  const [w, h, d] = KIND_DEFAULT_SIZE[kind];
  const label = KIND_LABELS.find((k) => k.kind === kind)?.label;
  const spec = specFor(kind, name.toUpperCase(), label ?? "", w, h, d);
  return { ...spec, variant: label ?? spec.category, source: "guess" };
}

export function guessSpec(q: string): ProductSpec | null {
  const kind = kindOf(q);
  if (!kind) return null;
  const words = q.trim().split(/\s+/);
  const name = words.find((w) => w.length > 2 && !kindOf(w)) ?? words[0];
  return specForKind(kind, name);
}

export const FEATURED = PRODUCTS.filter((e) => e.featured);
export const POPULAR = ["kallax-2x2", "billy-80x202", "malm-3-drawers", "lack-side-table", "linnmon-adils-desk", "malm-bed-160", "brimnes-wardrobe", "hemnes-3-drawers", "frosta-stool"]
  .map((s) => PRODUCTS.find((e) => e.slug === s)!)
  .filter(Boolean);
export const PRODUCT_COUNT = new Set(PRODUCTS.map((p) => fold(p.name) + "|" + p.category)).size;
