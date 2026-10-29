/**
 * Checks the whole offline catalog and prints how much of IKEA's range it covers.
 *
 *   npm run ikea:check
 *
 * Fails when a product doesn't build a plan, has no steps, has an odd size or broken numbers,
 * when two products share a slug or a name and variant, or when a slug in scripts/ikea/slugs.json
 * (every slug ever handed out, hand made ones included) no longer opens the same product.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { BASE, PRODUCTS, catalogEntry, toSpec } from "@/lib/catalog";
import { SAME } from "@/data/fixes";
import { fold } from "@/lib/fold";
import { buildPlan } from "@/lib/plan";
import { articleNo, articleSlug, ikeaType, loadArticles } from "@/lib/ikea";
import { matchCatalog, searchCatalog } from "@/lib/search";
import type { Plan } from "@/lib/types";
import { classify, measure, type Fact } from "./classify";

const DIR = import.meta.dirname;
const problems: string[] = [];
const fail = (s: string) => problems.push(s);

function finite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === "object") return Object.values(v).every(finite);
  return true;
}

/** Every part's final position stays near the product's outer size. */
function fits(plan: Plan) {
  const { w, h, d } = plan.spec.size;
  const sizeOf = new Map(plan.parts.map((p) => [p.id, p.size]));
  for (const it of plan.items) {
    if (it.kind !== "part") continue;
    const s = sizeOf.get(it.ref);
    if (!s || s.some((v) => !(v > 0))) return `part ${it.ref} has no size`;
    const [x, y, z] = it.final.pos;
    if (Math.abs(x) > w * 5 + 300 || y < -300 || y > h * 10 + 600 || Math.abs(z) > d * 5 + 600) return `part ${it.ref} sits outside the product`;
  }
  return null;
}

async function main() {
  // plans
  const t0 = performance.now();
  for (const e of PRODUCTS) {
    const label = `${e.slug} (${e.name} ${e.variant})`;
    const { w, h, d } = e.size;
    // a long modular sofa can run to nearly 5 m; a trolley for boxes is a platform 9 cm high
    if (!(w >= 15 && w <= (e.archetype === "sofa" ? 480 : 320) && h >= 8 && h <= 260 && d >= 12 && d <= (e.archetype === "sofa" ? 400 : 240))) fail(`${label}: size ${w}x${h}x${d} cm is out of range`);
    try {
      const plan = buildPlan(toSpec(e));
      if (!plan.steps.length) fail(`${label}: no steps`);
      if (!plan.parts.length) fail(`${label}: no parts`);
      if (!finite(plan.items) || !finite(plan.parts)) fail(`${label}: a number in the plan is not finite`);
      const off = fits(plan);
      if (off) fail(`${label}: ${off}`);
    } catch (err) {
      fail(`${label}: buildPlan threw ${(err as Error).message}`);
    }
  }
  const ms = performance.now() - t0;

  // slugs and names
  const slugs = new Map<string, string>();
  const keys = new Set<string>();
  for (const e of PRODUCTS) {
    const key = fold(e.name) + "|" + fold(e.variant);
    if (slugs.has(e.slug)) fail(`slug ${e.slug} is used twice`);
    if (keys.has(key)) fail(`${e.name} ${e.variant} is listed twice`);
    // slugs.json knows a product by its listing's name, also when src/data/fixes.ts gives it its own
    slugs.set(e.slug, e.name + "|" + (e.listed ?? e.variant));
    keys.add(key);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) fail(`slug ${e.slug} has odd characters`);
  }
  const lockFile = path.join(DIR, "slugs.json");
  const lock: Record<string, string> = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};
  const baseLock = path.join(DIR, "base-slugs.json");
  const base: Record<string, string> = existsSync(baseLock) ? JSON.parse(readFileSync(baseLock, "utf8")) : {};
  // (a guide that is the same product as another opens that one)
  for (const [key, slug] of Object.entries(base)) if (slugs.get(slug) !== key && !(SAME[slug] && catalogEntry(slug))) fail(`hand made slug ${slug} no longer opens ${key}`);
  let gone = 0;
  for (const [key, slug] of Object.entries(lock)) {
    const now = slugs.get(slug);
    if (now === undefined) {
      if (SAME[slug] && !catalogEntry(slug)) fail(`slug ${slug} is the same product as ${SAME[slug]}, which isn't a guide`);
      else if (!SAME[slug]) gone++;
    }
    else if (now !== key) fail(`slug ${slug} was ${key}, now opens ${now}`);
  }

  // search
  await loadArticles();
  const expect = (q: string, slug: string | null) => {
    const got = matchCatalog(q)?.slug ?? null;
    if (got !== slug) fail(`search "${q}" gave ${got}, expected ${slug}`);
  };
  expect("kallax", "kallax-2x2");
  expect("MALM 3 drawers", "malm-3-drawers");
  expect("billy", "billy-80x202");
  expect("markus", "markus-office-chair");
  expect("markus office chair", "markus-office-chair");
  // a real name we don't draw (chair cushions) must not land on a near miss (FRÖSET)
  expect("froson", null);
  expect("froson chair", null);
  // conference chairs and sun loungers are drawn now
  expect("laktare", "laktare-conference-chair");
  expect("nammaro sun lounger", "nammaro-sun-lounger");
  expect("marius", "marius-stool");
  // a day-bed is its own kind, and doesn't take over the family's bed
  expect("hemnes daybed", "hemnes-day-bed-frame-3-drawers-80-x-200");
  expect("hemnes bed", "hemnes-bed-frame-160-x-200");
  // doors and drawers together, without taking the chests of drawers
  expect("hemnes cabinet with drawers", "hemnes-glass-door-cabinet-3-drawers-90-x-197");
  expect("hemnes chest of drawers", "hemnes-3-drawers");
  // sliding doors only when the query says so
  expect("hauga sliding wardrobe", "hauga-wardrobe-sliding-doors-118-x-55-x-199");
  expect("hauga wardrobe", "hauga-wardrobe-70-x-199");
  // a row of frames when asked for, the single frame otherwise
  expect("billy bookcase combination", "billy-bookcase-160-x-28-x-202");
  expect("pax bergsbo", "pax-bergsbo-wardrobe");
  // a corner wardrobe when asked for, the frame otherwise
  expect("pax corner wardrobe", "pax-corner-wardrobe-161-188-x-201");
  expect("pax wardrobe", "pax-frame");
  expect("vihals gateleg table", "vihals-gateleg-table-39-95-151-x-90");
  // a wash-stand when asked for, US words too, without taking the family's cabinets
  expect("hemnes wash-stand", "hemnes-wash-stand-2-drawers-60-x-47-x-83");
  expect("hemnes vanity", "hemnes-wash-stand-2-drawers-60-x-47-x-83");
  expect("hemnes glass door cabinet", "hemnes-glass-door-cabinet-3-drawers-90-x-197");
  // the same for a kitchen's sink cabinet
  expect("enhet sink cabinet", "enhet-base-cb-f-sink-60-x-60-x-75");
  expect("metod base cabinet", "metod-base-cabinet-shelves-60-x-60");
  // and for appliance cabinets: a hob unit when asked for, the plain high cabinet otherwise
  expect("metod hob unit", "metod-knivshult-base-cab-f-hob-2-fronts-3-drawer");
  expect("metod high cabinet", "metod-high-cabinet-shelves-40-x-37-x-200");
  // a corner cabinet when asked for, without taking the family's wall cabinets
  expect("metod corner base cabinet", "metod-corner-base-cabinet-carousel-88-x-88");
  expect("metod wall cabinet", "metod-wall-cabinet-w-shelves-glass-door-30-x-80");
  // a storage bench with a lid when asked for, the family's bench or table otherwise
  expect("kallso storage bench", "kallso-storage-bench-80-x-38-x-56");
  expect("kallso bench shoe storage", "kallso-bench-shoe-storage-80-x-38-x-56");
  expect("hol storage table", "hol-storage-table-98-x-50");
  expect("hol", "hol-side-table-50-x-50");
  // a work bench when asked for, the family's shelving otherwise
  expect("bror work bench", "bror-work-bench-110-x-55");
  expect("bror", "bror-shelving-unit-85-x-190");
  // a height extension unit or a TV bench with drawers when asked for, the family's own otherwise
  expect("billy height extension unit", "billy-height-extension-unit-40-x-28-x-35");
  expect("besta tv bench with drawers", "besta-tv-bench-drawers-120-x-42-x-48");
  expect("besta tv bench", "besta-tv-bench-120-x-40");
  // a hat rack or a coat stand when asked for, the family's bench otherwise
  expect("tjusig hat rack", "tjusig-hat-rack-79");
  expect("nipasen coat stand", "nipasen-hat-and-coat-stand-181");
  expect("nipasen bench", "nipasen-bench-shoe-storage-79-x-35-x-52");
  // an armchair with its footstool when asked for, the armchair alone otherwise; a new piece after the family's sofa
  expect("poang armchair and footstool", "poang-armchair-and-footstool");
  expect("poang", "poang-armchair");
  expect("viskafors", "viskafors-2-seat-sofa");
  if (articleNo("S292.975.72") !== "29297572") fail("article numbers with an S in front don't parse");
  // the US range's measures, in inches with fractions, or in inches and cm, are read in cm
  for (const [text, cm] of [['30 3/8x15 3/8 "', "77 × 39 cm"], ['55 1/8x18 7/8x29 1/2 "', "140 × 48 × 75 cm"], ['29 ½ "', "75 cm"], ['15 3/4 "/40 cm', "40 cm"], ["80x202 cm", "80 × 202 cm"]] as const)
    if (measure(text)?.text !== cm) fail(`measure "${text}" gave ${measure(text)?.text}, expected ${cm}`);
  // a US-only product comes after the family's UK pieces, and is found by its own words
  expect("hemnes bed", "hemnes-bed-frame-160-x-200");
  expect("sektion corner base cabinet", "sektion-corner-base-cabinet-carousel-96-5-x-61-x");
  for (const [no, slug] of [["60324520", "kallax-2x2"]] as const) {
    if (articleSlug(no) !== slug) fail(`article ${no} gave ${articleSlug(no)}, expected ${slug}`);
    for (const q of [no, `${no.slice(0, 3)}.${no.slice(3, 6)}.${no.slice(6)}`, `${no.slice(0, 3)} ${no.slice(3, 6)} ${no.slice(6)}`]) expect(q, slug);
  }
  if ((await ikeaType("MARKUS")) !== "Office chair") fail(`ikeaType("MARKUS") gave ${await ikeaType("MARKUS")}`);
  const s0 = performance.now();
  const queries = ["kallax", "hemnes chest", "malm", "bed 160", "wardrobe", "billy bookcase", "lisabo table", "poang", "brimnes", "x"];
  for (let i = 0; i < 20; i++) for (const q of queries) searchCatalog(q, 6);
  const perQuery = (performance.now() - s0) / (20 * queries.length);

  // coverage
  const factsFile = path.join(DIR, "facts.json");
  if (existsSync(factsFile)) {
    const facts: Fact[] = JSON.parse(readFileSync(factsFile, "utf8")).products;
    const skipType = new Map<string, number>();
    const skipWhy = new Map<string, number>();
    let drawn = 0;
    for (const f of facts) {
      const v = classify(f, () => undefined);
      if ("draw" in v) {
        drawn++;
        continue;
      }
      if (["fb", "tl", "kt", "li", "pp", "de", "wt", "he", "hs", "lc", "pt", "sp"].includes(f.cats[0]?.slice(0, 2) ?? "")) {
        skipWhy.set("not furniture (food, textiles, lamps, kitchenware, decor...)", (skipWhy.get("not furniture (food, textiles, lamps, kitchenware, decor...)") ?? 0) + 1);
        continue;
      }
      skipWhy.set(v.skip, (skipWhy.get(v.skip) ?? 0) + 1);
      skipType.set(f.type, (skipType.get(f.type) ?? 0) + 1);
    }
    console.log(`\nIKEA products seen: ${facts.length} (${drawn} drawable before merging colours)`);
    console.log("\nskipped, by reason:");
    for (const [k, n] of [...skipWhy].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
    console.log("\nskipped furniture, by IKEA type (top 60):");
    for (const [k, n] of [...skipType].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(`  ${String(n).padStart(5)}  ${k}`);
  }
  const perKind = new Map<string, [number, number]>();
  const baseSet = new Set(BASE.map((e) => e.slug));
  for (const e of PRODUCTS) {
    const k = e.kind ?? e.category;
    const [all, ikea] = perKind.get(k) ?? [0, 0];
    perKind.set(k, [all + 1, ikea + (baseSet.has(e.slug) ? 0 : 1)]);
  }
  console.log(`\nguides: ${PRODUCTS.length} (${BASE.length} hand made, ${PRODUCTS.length - BASE.length} from IKEA data)`);
  console.log("per kind (all / from IKEA data):");
  for (const [k, [all, ikea]] of [...perKind].sort((a, b) => b[1][0] - a[1][0])) console.log(`  ${k.padEnd(18)} ${String(all).padStart(4)} / ${ikea}`);
  console.log(`\nbuilt ${PRODUCTS.length} plans in ${Math.round(ms)} ms, search ${perQuery.toFixed(2)} ms a query`);
  if (gone) console.log(`${gone} slugs in slugs.json belong to products IKEA no longer lists (kept reserved)`);

  if (problems.length) {
    console.log(`\n${problems.length} problems:`);
    for (const p of problems.slice(0, 80)) console.log("  " + p);
    process.exit(1);
  }
  console.log("\nall good");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
