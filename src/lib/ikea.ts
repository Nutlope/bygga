import type { Kind, X } from "./products";
import { fold } from "./fold";
import { IKEA_GUARD } from "@/data/ikea-guard";

/**
 * IKEA's public product data, compacted by scripts/ikea/build.ts:
 * - rows we can draw (src/data/ikea-rows.ts), one per line: name|kind|variant|w|h|d|params|keywords|slug
 * - real names we can't draw that look like a typo of one we can (src/data/ikea-guard.ts, small)
 * - every IKEA family name with its main product types (src/data/ikea-names.ts), loaded on demand
 * - article numbers per slug (src/data/ikea-items.ts), loaded only when someone types a number
 */

export interface IkeaRow {
  name: string;
  kind: Kind;
  variant: string;
  w: number;
  h: number;
  d: number;
  x: X;
  keywords?: string[];
  /** only stored when it differs from the slug the name and variant give */
  slug?: string;
}

const X_KEYS = ["rows", "cols", "knobs", "plinth", "doors", "shelves", "c", "m", "l", "f", "seats", "arms", "legs", "attach", "shelf", "min", "round", "seatH", "chaise", "corner", "open", "sd", "drawer", "leaves", "leaf", "under", "mats", "dtop", "rail", "slides", "n", "of", "hinge", "use", "z", "basin", "hung", "uf", "ins", "blind", "inner", "u", "v", "cu", "rock", "cat", "cast", "mods", "dr", "foot", "st", "low", "box", "t", "mirror", "up", "us", "ah", "aw", "bk", "lg", "sdp"] as const;
const FLAGS = new Set<string>(["plinth", "shelf", "round", "open", "drawer", "dtop", "rail", "hinge", "hung", "rock", "cast", "foot", "mirror", "us"]);
const WORDS = new Set<string>(["knobs", "arms", "legs", "attach", "chaise", "corner", "under", "of", "use", "z", "inner", "u", "v", "cat"]);

export function encodeX(x: X): string {
  const out: string[] = [];
  for (const k of X_KEYS) {
    const v = x[k];
    if (v === undefined) continue;
    out.push(`${k}=${typeof v === "boolean" ? (v ? 1 : 0) : v}`);
  }
  return out.join(",");
}

export function decodeX(s: string): X {
  const x: Record<string, unknown> = {};
  if (!s) return x as X;
  for (const pair of s.split(",")) {
    const [k, v] = pair.split("=");
    x[k] = FLAGS.has(k) ? v === "1" : WORDS.has(k) ? v : Number(v);
  }
  return x as X;
}

export function encodeRow(r: IkeaRow): string {
  const cells = [r.name, r.kind, r.variant, r.w, r.h, r.d, encodeX(r.x), (r.keywords ?? []).join(" "), r.slug ?? ""].map(String);
  for (const c of cells) if (/[|\n`\\]|\$\{/.test(c)) throw new Error(`can't store ${JSON.stringify(c)}`);
  while (cells.length && !cells[cells.length - 1]) cells.pop();
  return cells.join("|");
}

export function decodeRows(text: string): IkeaRow[] {
  const out: IkeaRow[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const [name, kind, variant, w, h, d, x = "", kw = "", slug = ""] = line.split("|");
    out.push({ name, kind: kind as Kind, variant, w: Number(w), h: Number(h), d: Number(d), x: decodeX(x), keywords: kw ? kw.split(" ") : undefined, slug: slug || undefined });
  }
  return out;
}

/* ---------- names ---------- */

const guard = new Set(IKEA_GUARD.split(" "));

/** A real IKEA name we can't draw, which search must not read as a typo of one we can (FRÖSÖN is not FRÖSET). */
export function isGuardedName(word: string) {
  return guard.has(fold(word).replace(/\s+/g, ""));
}

let names: Promise<Map<string, string[]>> | null = null;

function nameMap() {
  names ??= import("@/data/ikea-names").then(({ IKEA_NAMES }) => {
    const map = new Map<string, string[]>();
    for (const line of IKEA_NAMES.split("\n")) {
      if (!line) continue;
      const [n, t = ""] = line.split("|");
      map.set(fold(n), t ? t.split(";") : []);
    }
    return map;
  });
  return names;
}

/** True when this is the name of a real IKEA product family, drawable or not. */
export async function isIkeaName(name: string) {
  return (await nameMap()).has(fold(name));
}

/** IKEA's own product types for a family name, most common first ("BESTÅ" gives ["TV bench", "TV bench with doors"]). */
export async function ikeaTypes(name: string): Promise<string[]> {
  return (await nameMap()).get(fold(name)) ?? [];
}

/**
 * The main IKEA product type for a family name ("MARKUS" gives "Office chair"), or null when it isn't
 * a name we know. Also takes a whole query and uses its first word: "markus chair" works too.
 */
export async function ikeaType(name: string): Promise<string | null> {
  const map = await nameMap();
  const f = fold(name);
  return (map.get(f) ?? map.get(f.split(" ")[0]) ?? [])[0] ?? null;
}

/* ---------- article numbers ---------- */

let items: Map<string, string> | null = null;
let loading: Promise<void> | null = null;

/** "802.758.87", "80275887", "802 758 87" or the "S" combination form, as 8 digits. */
export function articleNo(q: string): string | null {
  const m = q.trim().match(/^s?\s*(\d{3})[\s.\-]*(\d{3})[\s.\-]*(\d{2})$/i);
  if (m) return m[1] + m[2] + m[3];
  // a product link from any IKEA site ends in its article number: .../p/idanaes-sideboard-white-80496025/
  const link = q.match(/ikea\.[a-z.]+\/.*\/p\/[^?#\s]*?-s?(\d{8})\b/i);
  return link ? link[1] : null;
}

/** Loads the article number index (a separate chunk, so pages don't pay for it until someone types digits). */
export function loadArticles(): Promise<void> {
  loading ??= import("@/data/ikea-items").then(({ IKEA_ITEMS }) => {
    const map = new Map<string, string>();
    for (const line of IKEA_ITEMS.split("\n")) {
      const [slug, list] = line.split("|");
      if (list) for (const no of list.split(" ")) if (!map.has(no)) map.set(no, slug);
    }
    items = map;
  });
  return loading;
}

export function articlesReady() {
  return items !== null;
}

/** The slug printed under this article number; undefined while the index is still loading. */
export function articleSlug(no: string): string | null | undefined {
  if (!items) return undefined;
  return items.get(no) ?? null;
}

/** Article numbers for a slug (needs loadArticles first). */
export function articlesFor(slug: string): string[] {
  if (!items) return [];
  const out: string[] = [];
  for (const [no, s] of items) if (s === slug) out.push(no);
  return out;
}
