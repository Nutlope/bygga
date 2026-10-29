import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * MYDAL bunk bed (solid pine), read from its two manuals: the US twin (pine) and the 90x200 (white).
 * Each end frame is built flat on a rug: the top board is bolted to one post with two long bolts into barrel nuts,
 * the guard boards and the two lower boards go on with dowels and one bolt each, then the second post is bolted
 * on (six bolts). Two people stand the ends up; the lower rails go in on dowels and short bolts at each end, then
 * the upper rails. The ladder is one upright bolted to the front rails, with two rungs doweled and bolted between it
 * and the post. Guard boards close the back and the front of the top bunk (the front one stops at the ladder),
 * three short uprights stiffen them, and the slats are pinned to the ledges with push-in pins (twin: 14 slats a
 * bed; 90x200: 17). The two manuals do the same work in a different order; each guide follows its own.
 * IKEA's sizes: twin 196 x 104 x 157; 90x200 206 x 97 x 157.
 */

const H = 1570;
const PX = 35, PZ = 57; // posts: along the bed, across it
const BT = 22; // boards
const RT = 25, RH = 140; // side rails
const LOW = 200, UP = 1110; // bottoms of the lower and upper rails
const GUARD: [number, number][] = [[1290, 1370], [1440, 1520]];

const LONG = { kind: "bolt" as const, name: "Long bolt", len: 120, dia: 6 };
const SHORT = { kind: "bolt" as const, name: "Bolt", len: 100, dia: 6 };
const NUT = { kind: "nut" as const, name: "Barrel nut", len: 14, dia: 10 };
const SBOLT = { kind: "bolt" as const, name: "Ladder bolt", len: 45, dia: 6 };
const SLEEVE = { kind: "nut" as const, name: "Sleeve nut", len: 16, dia: 12 };
const DOWEL = { kind: "dowel" as const, len: 30, dia: 8 };
const PIN = { kind: "nail" as const, name: "Slat pin", len: 30, dia: 8 };

function recipe(s: ProductSpec) {
  const slug = s.slug ?? "";
  if (!/^mydal-bunk-bed-frame/.test(slug)) return null;
  const gb = /90-x-200/.test(slug);
  const L = gb ? 2060 : 1960, W = gb ? 970 : 1040;
  const nSlats = gb ? 17 : 14;
  const xp = L / 2 - PX / 2, zp = W / 2 - PZ / 2;
  const xi = L / 2 - PX; // posts' inner faces along the bed
  const zb = W / 2 - PZ; // where the end boards meet the posts
  const parts: CustomPart[] = [];
  const wood = "wood" as const;

  // the end frames: two posts, a top board, two guard boards, the upper base board and two lower boards
  const BOARDS: { id: string; name: string; y: [number, number]; bolts: number; dowels: number }[] = [
    { id: "T", name: "Top board", y: [1450, 1570], bolts: 2, dowels: 0 },
    { id: "B2", name: "End board", y: [1300, 1390], bolts: 1, dowels: 2 },
    { id: "B3", name: "End rail", y: [UP, UP + RH], bolts: 1, dowels: 2 },
    { id: "B5", name: "End board", y: [400, 490], bolts: 1, dowels: 1 },
    { id: "B4", name: "End rail", y: [LOW, LOW + RH], bolts: 1, dowels: 1 },
  ];
  for (const ex of [-1, 1]) {
    for (const ez of [-1, 1]) parts.push({ id: `P${ex}${ez}`, name: "Post", size: [PX, H, PZ], pos: [ex * xp, H / 2, ez * zp], material: wood });
    for (const b of BOARDS) parts.push({ id: `${b.id}${ex}`, name: b.name, size: [BT, b.y[1] - b.y[0], 2 * zb], pos: [ex * xp, (b.y[0] + b.y[1]) / 2, 0], material: wood });
  }
  const mid = (y: [number, number]) => (y[0] + y[1]) / 2;
  const boltYs = (b: (typeof BOARDS)[number]) => (b.bolts === 2 ? [b.y[0] + 30, b.y[1] - 30] : [mid(b.y)]);
  const dowelYs = (b: (typeof BOARDS)[number]) => (b.dowels === 2 ? [mid(b.y) - 30, mid(b.y) + 30] : [mid(b.y) + 30]);
  const endBolts = (ex: number, ez: number, ids: string[]): CustomFix[] => {
    const bs = BOARDS.filter((b) => ids.includes(b.id));
    const ys = bs.flatMap(boltYs);
    const at = ys.map((y): Vec3 => [ex * xp, y, ez * (W / 2)]);
    return [
      { ...LONG, count: at.length, at, dir: [0, 0, -ez], on: `P${ex}${ez}` },
      { ...NUT, count: at.length, at: ys.map((y): Vec3 => [ex * xp - (ex * BT) / 2, y, ez * (zb - 40)]), dir: [ex, 0, 0] },
    ];
  };
  const endDowels = (ex: number, ez: number, ids: string[], inPost: boolean): CustomFix[] =>
    BOARDS.filter((b) => ids.includes(b.id)).map((b) => {
      const at = dowelYs(b).map((y): Vec3 => [ex * xp, y, ez * zb]);
      return { ...DOWEL, count: at.length, at, dir: [0, 0, inPost ? ez : -ez], on: inPost ? `P${ex}${ez}` : `${b.id}${ex}` };
    });

  // side rails with a ledge along the inside for the slats; the back one is the same rail turned round
  const rail = (id: string, y0: number, sz: number): CustomPart => ({
    id,
    name: "Side rail",
    size: [2 * xi, RH, RT + 22],
    pos: [0, y0 + RH / 2, sz * (W / 2 - (RT + 22) / 2)],
    material: wood,
    rot: sz < 0 ? [0, Math.PI, 0] : undefined,
    pieces: [
      { shape: "box", size: [2 * xi, RH, RT], pos: [0, 0, 11], material: wood },
      { shape: "box", size: [2 * xi - 40, 34, 22], pos: [0, -RH / 2 + 17, -RT / 2], material: wood },
    ],
  });
  parts.push(rail("LB", LOW, -1), rail("LF", LOW, 1), rail("UB", UP, -1), rail("UF", UP, 1));
  const railFix = (ids: string[], ex: number, withDowels: boolean): CustomFix[] => {
    const rs = ids.map((id) => ({ id, y0: id[0] === "L" ? LOW : UP, sz: id[1] === "B" ? -1 : 1 }));
    const bolts = rs.flatMap((r) => [r.y0 + 40, r.y0 + RH - 40].map((y): Vec3 => [ex * (L / 2), y, r.sz * (W / 2 - RT / 2)]));
    const out: CustomFix[] = [
      { ...SHORT, count: bolts.length, at: bolts, dir: [-ex, 0, 0] },
      { ...NUT, count: bolts.length, at: bolts.map((p): Vec3 => [ex * (xi - 45), p[1], p[2]]), dir: [0, -1, 0] },
    ];
    if (withDowels) out.unshift({ ...DOWEL, count: rs.length, at: rs.map((r): Vec3 => [ex * xi, r.y0 + RH / 2, r.sz * (W / 2 - RT / 2)]), dir: [ex, 0, 0] });
    return out;
  };

  // slats on the ledges
  const slatLen = W - 2 * (RT + 22) + 40;
  const slatY = (y0: number) => y0 + 34 + 9;
  const slatX = (i: number) => -xi + 60 + ((2 * xi - 120) * i) / (nSlats - 1);
  const midSlat = Math.floor(nSlats / 2);
  for (const [bed, y0] of [["U", UP], ["L", LOW]] as const)
    for (let i = 0; i < nSlats; i++) parts.push({ id: `S${bed}${i}`, name: "Slat", size: [70, 18, slatLen], pos: [slatX(i), slatY(y0), 0], material: wood });
  const slatIds = (bed: "U" | "L", skipMid: boolean) => Array.from({ length: nSlats }, (_, i) => i).filter((i) => !skipMid || i !== midSlat).map((i) => `S${bed}${i}`);
  const pins = (idx: number[], beds: number[], ends: number[]): CustomFix => {
    const at = beds.flatMap((y0) => idx.flatMap((i) => ends.map((ez): Vec3 => [slatX(i), slatY(y0) + 9, ez * (slatLen / 2 - 18)])));
    return { ...PIN, count: at.length, at, dir: [0, -1, 0] };
  };
  const allIdx = Array.from({ length: nSlats }, (_, i) => i);
  const restIdx = allIdx.filter((i) => i !== midSlat);

  // the ladder: an upright in front of the rails, two rungs between it and the right-hand post
  const sx = L / 2 - 430;
  const zl = W / 2 + BT / 2;
  parts.push({ id: "LD", name: "Ladder upright", size: [70, GUARD[1][1], BT], pos: [sx, GUARD[1][1] / 2, zl], material: wood });
  const rungY = [LOW + RH + (UP - LOW - RH) / 3, LOW + RH + (2 * (UP - LOW - RH)) / 3];
  const rx0 = sx - 35, rx1 = xi;
  for (const [i, y] of rungY.entries()) parts.push({ id: `R${i}`, name: "Rung", size: [rx1 - rx0, 70, BT], pos: [(rx0 + rx1) / 2, y, W / 2 - BT / 2], material: wood });

  // guard boards: the back between the posts, the front from the left post to the ladder
  for (const [i, y] of GUARD.entries()) {
    parts.push({ id: `GB${i}`, name: "Back guard board", size: [2 * xi, y[1] - y[0], BT], pos: [0, mid(y), -(W / 2 - BT / 2)], material: wood });
    parts.push({ id: `GF${i}`, name: "Front guard board", size: [sx + 35 + xi, y[1] - y[0], BT], pos: [(sx + 35 - xi) / 2, mid(y), W / 2 - BT / 2], material: wood });
  }
  const ups = [
    { id: "VF", x: (sx - 35 - xi) / 2, z: W / 2 + BT / 2 },
    { id: "VB0", x: -L / 6, z: -(W / 2 + BT / 2) },
    { id: "VB1", x: L / 6, z: -(W / 2 + BT / 2) },
  ];
  for (const u of ups) parts.push({ id: u.id, name: "Guard upright", size: [70, GUARD[1][1] - UP - 20, BT], pos: [u.x, (GUARD[1][1] + UP + 20) / 2, u.z], material: wood });
  const upBolts = (u: (typeof ups)[number], rail: boolean, guards: boolean): CustomFix[] => {
    const ys = [...(rail ? (guards ? [UP + RH / 2] : [UP + 35, UP + RH / 2, UP + RH - 35]) : []), ...(guards ? GUARD.map(mid) : [])];
    const sz = Math.sign(u.z);
    const at = ys.map((y): Vec3 => [u.x, y, u.z + (sz * BT) / 2]);
    return [
      { ...SBOLT, count: at.length, at, dir: [0, 0, -sz], on: u.id },
      { ...SLEEVE, count: at.length, at: at.map((p): Vec3 => [p[0], p[1], -sz * (W / 2 - RT)]), dir: [0, 0, sz] },
    ];
  };

  const stileBolts = (ys: number[]): CustomFix[] => {
    const at = ys.map((y): Vec3 => [sx, y, W / 2 + BT]);
    return [
      { ...SBOLT, count: at.length, at, dir: [0, 0, -1], on: "LD" },
      { ...SLEEVE, count: at.length, at: at.map((p): Vec3 => [p[0], p[1], W / 2 - BT]), dir: [0, 0, 1] },
    ];
  };
  const postBolts = (ex: number, ys: number[], z: number): CustomFix[] => {
    const at = ys.map((y): Vec3 => [ex * (L / 2), y, z]);
    return [
      { ...SHORT, count: at.length, at, dir: [-ex, 0, 0] },
      { ...NUT, count: at.length, at: at.map((p): Vec3 => [ex * (xi - 45), p[1], p[2]]), dir: [0, -1, 0] },
    ];
  };
  const zf = W / 2 - BT / 2, zbk = -(W / 2 - BT / 2);

  const ids = (ex: number, b: string[]) => b.map((x) => `${x}${ex}`);
  const lower = ["B2", "B3", "B5", "B4"];
  const steps: CustomStep[] = [
    {
      title: "Bolt the top board to a post",
      detail: "Lay the post flat on a rug. Drop two barrel nuts into the board, slots facing the holes, and turn the long bolts in with the crank key. You build two end frames the same way.",
      add: ["P-1-1", "T-1"],
      fix: endBolts(-1, -1, ["T"]),
      tools: ["wrench", "flathead"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Tap dowels into the post", detail: "Four, into the holes for the two boards under the top board.", fix: endDowels(-1, -1, ["B2", "B3"], true), tools: ["hammer"] },
    { title: "Fit the other boards", detail: "Tap a dowel into the end of each lower board, then push all four boards onto the post.", add: ids(-1, lower), fix: endDowels(-1, -1, ["B5", "B4"], false), tools: ["hammer"] },
    { title: "Bolt the boards to the post", detail: "One barrel nut in each board, one long bolt through the post into it.", fix: endBolts(-1, -1, lower), tools: ["wrench", "flathead"] },
    { title: "Tap dowels into the free ends", detail: "Six dowels: two in each guard board, one in each lower board.", fix: endDowels(-1, 1, ["B2", "B3", "B5", "B4"], false), tools: ["hammer"] },
    { title: "Bolt on the second post", detail: "Barrel nuts in all five boards, then six long bolts through the post.", add: ["P-11"], fix: endBolts(-1, 1, ["T", ...lower]), tools: ["wrench", "flathead"] },
    {
      title: "Start the second end frame the same way",
      detail: "Lay its post flat on the rug and bolt the top board to it with two barrel nuts and long bolts.",
      add: ["P1-1", "T1"],
      fix: endBolts(1, -1, ["T"]),
      tools: ["wrench", "flathead"],
      pose: "-x",
      warnings: ["floor"],
    },
    {
      title: "Fit and bolt its other boards",
      detail: "Dowels in the post and the lower boards, push the four boards on, then one barrel nut and bolt each.",
      add: ids(1, lower),
      fix: [...endDowels(1, -1, ["B2", "B3"], true), ...endDowels(1, -1, ["B5", "B4"], false), ...endBolts(1, -1, lower)],
      tools: ["wrench", "hammer"],
    },
    {
      title: "Bolt on its second post",
      detail: "Dowels in the free ends, barrel nuts in the boards, six long bolts. Then stand both frames up.",
      add: ["P11"],
      fix: [...endDowels(1, 1, ["B2", "B3", "B5", "B4"], false), ...endBolts(1, 1, ["T", ...lower])],
      tools: ["wrench", "hammer"],
    },
    {
      title: "Push the lower rails onto an end frame",
      detail: "Tap a dowel into each end of both rails, ledges facing in. One person holds the frame upright.",
      add: ["LB", "LF"],
      fix: [-1, 1].map((ex): CustomFix => ({ ...DOWEL, count: 2, at: [-1, 1].map((sz): Vec3 => [ex * xi, LOW + RH / 2, sz * (W / 2 - RT / 2)]), dir: [ex, 0, 0] })),
      tools: ["hammer"],
      pose: "+y",
      people: 2,
    },
    { title: "Bolt the lower rails to it", detail: "A barrel nut in each rail end, then two bolts through the post into each rail.", fix: railFix(["LB", "LF"], -1, false), tools: ["wrench", "flathead"], people: 2 },
    { title: "Bolt on the other end frame", detail: "Push it onto the rails' dowels and bolt it the same way.", fix: railFix(["LB", "LF"], 1, false), tools: ["wrench", "flathead"], people: 2 },
    { title: "Fit the upper back rail", detail: "Dowels in its ends, barrel nuts, and two bolts at each end.", add: ["UB"], fix: [...railFix(["UB"], -1, true), ...railFix(["UB"], 1, true)], tools: ["wrench", "hammer"], people: 2 },
    { title: "Fit the upper front rail", detail: "The same way, ledge facing in.", add: ["UF"], fix: [...railFix(["UF"], -1, true), ...railFix(["UF"], 1, true)], tools: ["wrench", "hammer"], people: 2 },
  ];

  const ladder: CustomStep[] = [
    { title: "Bolt the ladder upright to the front rails", detail: "On the outside of both rails, one bolt and sleeve nut into each.", add: ["LD"], fix: stileBolts([LOW + RH / 2, UP + RH / 2]), tools: ["wrench"] },
    { title: "Push in the rungs", detail: "Tap a dowel into each rung's end, then push it into the post. The other end goes behind the upright.", add: ["R0", "R1"], fix: [{ ...DOWEL, count: 2, at: rungY.map((y): Vec3 => [xi, y, W / 2 - BT / 2]), dir: [1, 0, 0] }], tools: ["hammer"] },
    { title: "Bolt the upright to the rungs", detail: "One bolt and sleeve nut through the upright into each rung.", fix: stileBolts(rungY), tools: ["wrench"] },
    { title: "Bolt the rungs to the post", detail: "A barrel nut in each rung, a bolt through the post into it.", fix: postBolts(1, rungY, W / 2 - BT / 2), tools: ["wrench", "flathead"] },
  ];
  const backGuard: CustomStep[] = [
    {
      title: "Fit the back guard boards",
      detail: "Tap a dowel into each end of both boards, then press them in between the posts above the upper rail.",
      add: ["GB0", "GB1"],
      fix: [-1, 1].map((ex): CustomFix => ({ ...DOWEL, count: 2, at: GUARD.map((y): Vec3 => [ex * xi, mid(y), zbk]), dir: [ex, 0, 0] })),
      tools: ["hammer"],
    },
    { title: "Bolt the back guard boards", detail: "Barrel nuts in the boards, one bolt through each post into each board.", fix: [-1, 1].flatMap((ex) => postBolts(ex, GUARD.map(mid), zbk)), tools: ["wrench", "flathead"] },
  ];
  const frontGuard: CustomStep[] = [
    {
      title: "Fit the front guard boards",
      detail: "A dowel in the end of each that goes into the post; the other end sits behind the ladder upright.",
      add: ["GF0", "GF1"],
      fix: [{ ...DOWEL, count: 2, at: GUARD.map((y): Vec3 => [-xi, mid(y), zf]), dir: [-1, 0, 0] }],
      tools: ["hammer"],
    },
    { title: "Bolt them to the ladder upright", detail: "One bolt and sleeve nut into each board.", fix: stileBolts(GUARD.map(mid)), tools: ["wrench"] },
    { title: "Bolt them to the post", detail: "Barrel nuts in the boards, then a bolt through the post into each.", fix: postBolts(-1, GUARD.map(mid), zf), tools: ["wrench", "flathead"] },
  ];

  if (!gb) {
    steps.push(
      { title: "Lay in the slats and pin the middle ones", detail: "Spread the slats out on both beds. Pin the middle slat of each bed at both ends first.", add: [...slatIds("U", false), ...slatIds("L", false)], fix: [pins([midSlat], [UP, LOW], [-1, 1])], tools: ["hammer"] },
      { title: "Pin the front ends of the slats", detail: "Tap a pin through each slat into the ledge, on both beds. Don't hit the rail.", fix: [pins(restIdx, [UP, LOW], [1])], tools: ["hammer"] },
      { title: "Pin the back ends of the slats", detail: "The same along the back ledges.", fix: [pins(restIdx, [UP, LOW], [-1])], tools: ["hammer"] },
      ...backGuard,
      { title: "Tighten all the rail bolts", detail: "All sixteen, with the crank key, until the heads sit flat.", tools: ["wrench"] },
      ...ladder,
      ...frontGuard,
      {
        title: "Bolt on the guard uprights",
        detail: "One on the front guard, two on the back. Three bolts and sleeve nuts each, through the upright into the rail and both boards.",
        add: ups.map((u) => u.id),
        fix: ups.flatMap((u) => upBolts(u, true, true)),
        tools: ["wrench"],
      },
    );
  } else {
    steps.push(
      ...ladder,
      { title: "Bolt the front upright to the upper rail", detail: "Three bolts and sleeve nuts, halfway between the left post and the ladder.", add: ["VF"], fix: upBolts(ups[0], true, false), tools: ["wrench"] },
      { title: "Lay in the slats and pin them", detail: "Both beds. A pin through each end of every slat into the ledge; don't hit the rail.", add: [...slatIds("U", false), ...slatIds("L", false)], fix: [pins(allIdx, [UP, LOW], [-1, 1])], tools: ["hammer"] },
      ...backGuard,
      ...frontGuard,
      { title: "Bolt on the back uprights", detail: "Three bolts and sleeve nuts each, into the rail and both guard boards.", add: ["VB0", "VB1"], fix: [...upBolts(ups[1], true, true), ...upBolts(ups[2], true, true)], tools: ["wrench"] },
    );
  }
  steps.push({ title: "Tighten every bolt", detail: "Go round the whole bed once more. Check them again every few months.", tools: ["wrench"], check: "square" });
  return { parts, steps };
}

const family: Family = {
  names: ["MYDAL"],
  recipe,
};
export default family;
