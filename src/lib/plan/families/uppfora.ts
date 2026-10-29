import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";
import { HW, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * UPPFÖRA frame on its own, read from its two manuals (76 cm, and 136/196 cm). It goes together the same way as the
 * UPPFÖRA frames inside SMÅSTAD sets (smastad.ts): the plinth first (eight dowels, four feet), the bottom panel
 * dowelled and screwed onto it, then the top hooks onto a side and the other side onto both, lying on its back, the
 * back slides in, the base is pushed into the open end and the back is clipped on standing up (ten clips on the low
 * frame, six on the tall ones). Two spacers screw onto the back edge of the sides low down and two into the top, it
 * is levelled on its feet with the spanner, and two screws through washers fix it to the wall; plugs and screws are
 * in the box.
 */

const FEET = 10;
const PH = 132; // plinth height under the bottom panel
const T = 18;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const fixAt = (d: HwDef, at: Vec3[], dir: Vec3, on?: string, mate?: string): CustomFix => ({ kind: d.kind, len: d.len, dia: d.dia, count: at.length, at, dir, on, mate, ...(d.name ? { name: d.name } : {}) });

const DOWEL: HwDef = HW.dowel;
const FOOT: HwDef = { kind: "foot", len: 30, dia: 24 };
const LONG_SCREW: HwDef = { kind: "screw", len: 50, dia: 6 };
const CLIP: HwDef = { kind: "clip", len: 14, dia: 14 };
const CLIP_PIN: HwDef = { kind: "clip", len: 10, dia: 6 };
const LOW_SPACER: HwDef = { kind: "stud", len: 22, dia: 28, name: "Wall spacer" };
const SMALL_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const SPACER: HwDef = { kind: "stud", len: 22, dia: 30, name: "Wall spacer" };
const SPACER_CAP: HwDef = { kind: "cap", len: 18, dia: 26 };
const PLUG: HwDef = { kind: "plug", len: 50, dia: 8, notIncluded: false };
const WALL_SCREW: HwDef = { kind: "screw", len: 80, dia: 5 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 22 };
const COVER: HwDef = { kind: "cap", len: 6, dia: 20 };

function keyAt(b: PlanBuilder, pos: Vec3) {
  return b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - pos[i]) < 0.5))?.key;
}

function frame(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, df = s.size.d * 10;
  const t = T, z0 = -df / 2;
  const tall = H > 1000;
  const yb = FEET + PH; // underside of the bottom panel
  const py = FEET + PH / 2;
  const pd = df - 3, zm = z0 + 3 + pd / 2;
  const xp = W / 2 - t - t / 2;
  const plD = pd - 20;
  const zpf = z0 + 3 + plD;
  const parts: CustomPart[] = [
    { id: "PB", name: "Plinth back", size: [W - 4 * t, PH, t], pos: [0, py, z0 + 3 + t / 2], material: "board" },
    { id: "PC", name: "Plinth rail", size: [W - 4 * t, 60, t], pos: [0, yb - 30, z0 + 3 + t * 1.5], material: "board" },
    { id: "PL", name: "Plinth side", size: [t, PH, plD], pos: [-xp, py, z0 + 3 + plD / 2], material: "board" },
    { id: "PR", name: "Plinth side", size: [t, PH, plD], pos: [xp, py, z0 + 3 + plD / 2], material: "board" },
    { id: "BT", name: "Bottom panel", size: [W - 2 * t, t, pd], pos: [0, yb + t / 2, zm], material: "board" },
    { id: "SL", name: "Side panel", size: [t, H - FEET, df], pos: [-(W / 2 - t / 2), FEET + (H - FEET) / 2, 0], material: "board" },
    { id: "TP", name: "Top panel", size: [W - 2 * t, t, pd], pos: [0, H - t / 2, zm], material: "board" },
    { id: "SR", name: "Side panel", size: [t, H - FEET, df], pos: [W / 2 - t / 2, FEET + (H - FEET) / 2, 0], material: "board" },
    { id: "BK", name: "Back panel", size: [W - 2 * t + 12, H - yb - t, 3], pos: [0, yb + t + (H - yb - t) / 2, z0 + 1.5], material: "fiber" },
  ];
  const xj = W / 2 - 2 * t;
  const rail = (id: string, ys: number[], z: number) => [-1, 1].map((sx) => fixAt(DOWEL, ys.map((y): Vec3 => [sx * xj, y, z]), [sx, 0, 0], id, sx < 0 ? "PL" : "PR"));
  const footPts = (sx: number): Vec3[] => [z0 + 3 + 40, zpf - 40].map((z): Vec3 => [sx * xp, FEET, z]);
  const screwPts = (sx: number): Vec3[] => [z0 + 3 + 70, zpf - 70].map((z): Vec3 => [sx * xp, yb + t, z]);
  const clips = tall ? 3 : 5;
  const clipRows: [number, string][] = [[H - t / 2, "TP"], [yb + t / 2, "BT"]];
  const clipXs = spread(-W / 2 + 90, W / 2 - 90, clips);
  const sx2 = [-W / 2 + 120, W / 2 - 120];
  const lowY = yb + 60;
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the plinth rails",
      detail: "Lay the plinth back and the rail on a rug. Two dowels in each end.",
      fix: [...rail("PB", [py - 35, py + 35], z0 + 3 + t / 2), ...rail("PC", [yb - 45, yb - 15], z0 + 3 + t * 1.5)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Push the plinth sides onto them", detail: "The holes for the feet face down.", add: ["PB", "PC", "PL", "PR"] },
    { title: "Turn it over and screw in the feet", detail: "Four feet, one near each end of the plinth sides. Turn them in by hand.", pose: "-y", fix: [fixAt(FOOT, footPts(-1), [0, 1, 0], "PL"), fixAt(FOOT, footPts(1), [0, 1, 0], "PR")] },
    {
      title: "Turn it back and tap in two dowels",
      detail: "One into the top of each plinth side, at the front end.",
      pose: "+y",
      fix: [fixAt(DOWEL, [[-xp, yb, zpf - 30]], [0, 1, 0], "PL", "BT"), fixAt(DOWEL, [[xp, yb, zpf - 30]], [0, 1, 0], "PR", "BT")],
      tools: ["hammer"],
    },
    { title: "Lay the bottom panel on", detail: "Onto the dowels, flush with the plinth at the back.", add: ["BT"] },
    {
      title: "Screw the bottom panel to the plinth",
      detail: "Four long screws down into the plinth sides, with the Allen key.",
      fix: [fixAt(LONG_SCREW, screwPts(-1), [0, -1, 0], "BT", "PL"), fixAt(LONG_SCREW, screwPts(1), [0, -1, 0], "BT", "PR")],
      tools: ["allen"],
    },
    {
      title: "Hook the top panel onto a side panel",
      detail: "Lay the side on a rug on its back edge, the warning label inside. Push the top's three fittings into the keyholes and press down until it locks.",
      add: ["SL", "TP"],
      pose: "+z",
      people: tall ? 2 : 1,
      warnings: tall ? ["two", "floor"] : ["floor"],
    },
    { title: "Hook on the other side panel", detail: "Three fittings again. Press it down until it locks.", add: ["SR"] },
    { title: "Slide in the back panel", detail: "White side in, along the grooves in both sides, until it reaches the top.", add: ["BK"], from: { BK: [0, -Math.min(600, H * 0.4), 0] } },
    { title: "Push the base into the frame", detail: "Plinth first, into the open end, until the bottom's fittings drop into the keyholes in both sides. The back rests on the bottom panel." },
    {
      title: tall ? "Stand it up together and clip on the back" : "Stand it up and clip on the back",
      detail: "Push a clip through each hole in the back, then a pin into each clip until it clicks.",
      pose: "+y",
      people: tall ? 2 : 1,
      warnings: tall ? ["two"] : [],
      fix: [...clipRows.map(([y, mate]) => fixAt(CLIP, clipXs.map((x): Vec3 => [x, y, z0]), [0, 0, 1], "BK", mate)), fixAt(CLIP_PIN, clipRows.flatMap(([y]) => clipXs.map((x): Vec3 => [x + 24, y, z0])), [0, 0, 1], "BK")],
    },
    {
      title: "Screw the low spacers onto the sides",
      detail: "One on the back edge of each side, just above the plinth. They keep the bottom clear of the skirting board.",
      fix: [
        // the spacer sits on the back edge; its screw goes through it, the head down in its hole
        fixAt(LOW_SPACER, [-1, 1].map((sx): Vec3 => [sx * (W / 2 - t / 2), lowY, z0 - 22]), [0, 0, 1]),
        fixAt(SMALL_SCREW, [-1, 1].map((sx): Vec3 => [sx * (W / 2 - t / 2), lowY, z0 + 1]), [0, 0, 1]),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the spacers into the top",
      detail: "Press one into each hole in the back edge of the top, then screw a cap on each by hand.",
      fix: [fixAt(SPACER, sx2.map((x): Vec3 => [x, H - t / 2, z0]), [0, 0, 1], "TP"), fixAt(SPACER_CAP, sx2.map((x): Vec3 => [x, H - t / 2, z0 - 24]), [0, 0, 1], "TP")],
    },
    { title: "Push it against the wall", detail: "Turn the caps in or out until it stands straight and clear of the skirting board.", warnings: ["tip"] },
    { title: "Level it on the feet", detail: "Turn the four feet with the spanner until it stands level and steady.", tools: ["wrench", "level"] },
  ];
  return { parts, steps, H, W, z0, tall };
}

/** Mark through the two holes, move it away, drill and plug, then screws through washers and click the covers on. */
function wallStep(b: PlanBuilder, host: string, pts: Vec3[], two: boolean) {
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Mark the wall through the two holes near the top of the back, move the frame away and drill. Tap in the plugs, push it back and drive the screws through the washers, then click the covers on. The plugs suit solid walls: for others, use fixings made for your wall.",
      tools: ["screwdriver", "drill", "pencil", "hammer"],
      kind: "anchor",
      wall: true,
      people: two ? 2 : 1,
      warnings: ["wall", "tip"],
    },
    () => {
      b.stagger(0.12);
      for (const at of pts) b.fit(PLUG, { at: [at[0], at[1], at[2] - 30], dir: [0, 0, -1] });
      b.then(0.1);
      for (const at of pts) b.fit(WASHER, { on: host, at, dir: [0, 0, -1], hole: false });
      b.then(0.05);
      for (const at of pts) b.fit(WALL_SCREW, { on: host, at: [at[0], at[1], at[2] + 2], dir: [0, 0, -1], hole: false });
      b.then(0.1);
      for (const at of pts) b.fit(COVER, { on: host, at: [at[0], at[1], at[2] + 4], dir: [0, 0, -1], hole: false });
    },
  );
}

const family: Family = {
  names: ["UPPFÖRA"],
  build(b, s) {
    if (!/^uppfora-frame-/.test(s.slug ?? "")) return false;
    const f = frame(s);
    buildCustom(b, { ...s, custom: { parts: f.parts, steps: f.steps } });
    const back = keyAt(b, f.parts.find((p) => p.id === "BK")!.pos);
    if (back) wallStep(b, back, [-1, 1].map((sx): Vec3 => [sx * (f.W / 2 - 90), f.H - T - 40, f.z0 + 3]), f.tall);
    return true;
  },
};
export default family;
