import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import { rotate } from "../math";

/**
 * BRUSALI, read from the 3-compartment shoe cabinet's manual. Cam bolts go into both sides and three pivots into
 * each. With one side flat on a rug, the two back rails (dowelled) and the open shelf are cammed to it, the other
 * side goes on top, then the bottom, the back strip of the open compartment and the top. Two plinth feet are
 * dowelled and screwed under the bottom. Each tip-out bin is built face down (two brackets screwed to the front, a
 * bottom and a back board) and hung on its pivots with two screwed bushings. Stood up, the rails are screwed to the
 * wall, the middle boards go into the bins and the knobs on.
 */

const T = 18;

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, ...(on ? { on } : {}), ...o };
}

function cabinet(s: ProductSpec): CustomParams {
  // IKEA: 61 wide, 30 deep, 130 high
  const W = 610, D = 300, H = Math.round(s.size.h * 10) || 1300;
  const xi = W / 2 - T, xs = W / 2 - T / 2, zf = D / 2;
  const yBot = 60 + T / 2, yTop = H - T / 2, yShelf = H - T - 190;
  const zRail = -D / 2 + T / 2, yR = [yShelf - T / 2 - 50, 380];
  const zone0 = yBot + T / 2, zone1 = yShelf - T / 2, fh = (zone1 - zone0) / 3;
  const fy = (i: number) => zone1 - fh / 2 - i * fh; // bin centres, top first
  const panel = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({ id, name, size, pos, material });
  const parts: CustomPart[] = [
    panel("SL", "Side", [T, H, D], [-xs, H / 2, 0]),
    panel("R0", "Back rail", [2 * xi, 100, T], [0, yR[0], zRail]),
    panel("R1", "Back rail", [2 * xi, 100, T], [0, yR[1], zRail]),
    panel("SH", "Shelf", [2 * xi, T, D - 10], [0, yShelf, 5]),
    panel("SR", "Side", [T, H, D], [xs, H / 2, 0]),
    panel("BOT", "Bottom", [2 * xi, T, D], [0, yBot, 0]),
    panel("STRIP", "Back strip", [2 * xi, H - T - yShelf - T / 2, 8], [0, (H - T + yShelf + T / 2) / 2, -D / 2 + 14], "fiber"),
    panel("TOP", "Top", [2 * xi, T, D], [0, yTop, 0]),
    ...[-1, 1].map((sx, i) => panel(`FT${i}`, "Plinth foot", [70, 60, 70], [sx * (xi - 35), 30, zf - 40])),
  ];
  for (let i = 0; i < 3; i++) {
    const y0 = fy(i) - fh / 2 + 2;
    parts.push(
      panel(`F${i}`, "Bin front", [2 * xi - 6, fh - 4, T], [0, fy(i), zf - T / 2]),
      ...[-1, 1].map((sx, k) => panel(`K${i}${k}`, "Bin bracket", [12, fh - 30, 220], [sx * (xi - 9), fy(i) - 10, zf - T - 110], "fiber")),
      panel(`A${i}`, "Bin bottom", [2 * xi - 32, 12, 180], [0, y0 + 30, zf - T - 100]),
      panel(`B${i}`, "Bin back", [2 * xi - 32, fh - 90, 12], [0, fy(i) + 15, zf - T - 205]),
      panel(`C${i}`, "Bin shelf", [2 * xi - 32, 12, 140], [0, fy(i) + 20, zf - T - 80]),
    );
  }

  const both = (f: (sx: number) => Vec3[]) => [-1, 1].flatMap(f);
  const bolts = both((sx) => [
    ...yR.map((y): Vec3 => [sx * xi, y, zRail]),
    ...[-1, 1].flatMap((sz) => [yShelf, yBot, yTop].map((y): Vec3 => [sx * xi, y, sz * 100])),
  ]);
  const sideOf = (sx: number) => (sx < 0 ? "SL" : "SR");
  const camRails = (sx: number) => fx("cam", yR.map((y): Vec3 => [sx * (xi - 34), y, zRail + T / 2]), [0, 0, -1], undefined);
  const camFlat = (sx: number, y: number, up: number) => fx("cam", [-1, 1].map((sz): Vec3 => [sx * (xi - 34), y + (up * T) / 2, sz * 100]), [0, -up, 0], undefined);
  const pivots = (i: number) => [-1, 1].map((sx): Vec3 => [sx * xi, fy(i) - fh / 2 + 30, zf - 60]);
  const binScrews = (is: number[]) => fx("screw", is.flatMap((i) => [-1, 1].flatMap((sx) => [-60, 0, 60].map((dy): Vec3 => [sx * (xi - 9), fy(i) + dy, zf - T]))), [0, 0, 1], undefined, { len: 12, dia: 4 });
  // in from the outside of each bracket, so the two sides point opposite ways
  const sideScrews = (pts: (sx: number) => Vec3[]) => [-1, 1].map((sx) => fx("screw", pts(sx), [-sx, 0, 0], undefined, { len: 16, dia: 3.5 }));
  const boardScrews = (is: number[], board: "A" | "B") =>
    sideScrews((sx) => is.map((i): Vec3 => [sx * (xi - 3), board === "A" ? fy(i) - fh / 2 + 32 : fy(i) + 15, board === "A" ? zf - T - 100 : zf - T - 205]));
  const hang = (is: number[]) => [
    fx("cap", is.flatMap(pivots).map((p): Vec3 => [p[0] - Math.sign(p[0]) * 12, p[1], p[2]]), [1, 0, 0], undefined, { name: "Bushing", len: 10, dia: 18 }),
    fx("screw", is.flatMap(pivots).map((p): Vec3 => [p[0] - Math.sign(p[0]) * 20, p[1], p[2]]), [1, 0, 0], undefined, { len: 12, dia: 4 }),
  ];
  const wall = both((sx) => yR.map((y): Vec3 => [sx * 200, y, -D / 2]));
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the sides",
      detail: "Sixteen in all, eight in each side, by hand until they stop.",
      fix: [fx("camScrew", bolts.filter((p) => p[0] < 0), [1, 0, 0], "SL"), fx("camScrew", bolts.filter((p) => p[0] > 0), [-1, 0, 0], "SR")],
      wait: ["SR"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Fit the pivots into the sides",
      detail: "Tap each one into its hole with a hammer, then screw it down. Three in each side.",
      fix: [-1, 1].flatMap((sx) => [
        fx("pin", [0, 1, 2].map((i) => pivots(i)[sx < 0 ? 0 : 1]), [-sx, 0, 0], sideOf(sx), { name: "Pivot", len: 14, dia: 12 }),
        fx("screw", [0, 1, 2].map((i) => pivots(i)[sx < 0 ? 0 : 1]), [sx, 0, 0], sideOf(sx), { len: 12, dia: 3.5 }),
      ]),
      tools: ["hammer", "screwdriver"],
    },
    { title: "Stand the back rails on the side", detail: "A dowel in each end, then push one end of each rail onto the side lying on the rug.", add: ["R0", "R1"], fix: ["R0", "R1"].flatMap((id, j) => [-1, 1].map((sx) => fx("dowel", [[sx * xi, yR[j] + 30, zRail]], [sx, 0, 0], id, { mate: sideOf(sx) }))) },
    { title: "Lock the rails to the side", detail: "A cam lock in each, turned clockwise until tight.", fix: [camRails(-1)] },
    { title: "Stand the open shelf on the side", detail: "The edge with the holes goes towards the top end.", add: ["SH"] },
    { title: "Lock the shelf to the side", detail: "Two cam locks.", fix: [camFlat(-1, yShelf, 1)] },
    { title: "Lay the other side on top", detail: "Its bolts go into the rails and the shelf. Press it down evenly.", add: ["SR"], people: 2 },
    { title: "Lock the rails and shelf to it", detail: "Four cam locks.", fix: [camRails(1), camFlat(1, yShelf, 1)] },
    { title: "Fit the bottom", detail: "Between the sides at the plinth end, front edge flush.", add: ["BOT"] },
    { title: "Lock the bottom", detail: "Four cam locks, two at each side.", fix: [camFlat(-1, yBot, 1), camFlat(1, yBot, 1)] },
    { title: "Slide in the back strip", detail: "It runs in the grooves behind the open shelf.", add: ["STRIP"], from: { STRIP: [0, 300, 0] } },
    { title: "Fit the top", detail: "On the bolts at the top end of both sides.", add: ["TOP"] },
    { title: "Lock the top", detail: "Four cam locks.", fix: [camFlat(-1, yTop, -1), camFlat(1, yTop, -1)] },
    { title: "Fit the plinth feet", detail: "Push a dowel into each foot and press it into the bottom at the front corners.", add: ["FT0", "FT1"], fix: [0, 1].map((i) => fx("dowel", [[parts.find((p) => p.id === `FT${i}`)!.pos[0], 60, zf - 40]], [0, 1, 0], `FT${i}`, { mate: "BOT" })) },
    { title: "Screw the feet to the bottom", detail: "One screw through each foot.", fix: [fx("screw", [0, 1].map((i): Vec3 => [parts.find((p) => p.id === `FT${i}`)!.pos[0] + 20, 0, zf - 40]), [0, 1, 0], undefined, { len: 12, dia: 4 })], tools: ["screwdriver"] },
    { title: "Screw the brackets onto a bin front", detail: "Lay the front face down on the rug. Three screws through each bracket.", add: ["F0", "K00", "K01"], fix: [binScrews([0])], tools: ["screwdriver"] },
    { title: "Slide in the bin bottom", detail: "Pick the right board, it runs into the slots low in the brackets.", add: ["A0"] },
    { title: "Screw the bottom in place", detail: "One screw through each bracket.", fix: boardScrews([0], "A"), tools: ["screwdriver"] },
    { title: "Click in the bin back", detail: "Tilt it in at the top of the brackets and press it down until it clicks.", add: ["B0"] },
    { title: "Screw the back in place", detail: "One screw through each bracket.", fix: boardScrews([0], "B"), tools: ["screwdriver"] },
    { title: "Hang the bin on the top pivots", detail: "Its brackets drop over the pivots in the sides.", tools: [] },
    { title: "Fit the bushings over the pivots", detail: "A bushing and a screw on each pivot, by hand, not with a drill.", fix: hang([0]), tools: ["screwdriver"] },
    {
      title: "Build and hang the other two bins",
      detail: "The same way: brackets, bottom and back, then onto the pivots with their bushings.",
      add: [1, 2].flatMap((i) => [`F${i}`, `K${i}0`, `K${i}1`, `A${i}`, `B${i}`]),
      fix: [binScrews([1, 2]), ...boardScrews([1, 2], "A"), ...boardScrews([1, 2], "B"), ...hang([1, 2])],
      from: Object.fromEntries([1, 2].flatMap((i) => [`F${i}`, `K${i}0`, `K${i}1`, `A${i}`, `B${i}`].map((id): [string, Vec3] => [id, [0, 0, 400]]))),
      tools: ["screwdriver"],
    },
    {
      title: "Stand it up and fix it to the wall",
      detail: "Level it against the wall and screw both back rails to it, two screws in each. Wall screws aren't included: pick ones made for your wall.",
      fix: [fx("plug", wall.map((p): Vec3 => [p[0], p[1], p[2] - 2]), [0, 0, -1]), fx("screw", wall.map((p): Vec3 => [p[0], p[1], p[2] + T]), [0, 0, -1], undefined, { len: 50, dia: 5 })],
      pose: "+y",
      wall: true,
      people: 2,
      tools: ["level", "drill", "screwdriver"],
      warnings: ["tip"],
    },
    { title: "Fit the middle shelves into the bins", detail: "Open each bin, lay the shelf on its ledges and screw it through both brackets.", add: ["C0", "C1", "C2"], fix: sideScrews((sx) => [0, 1, 2].map((i): Vec3 => [sx * (xi - 3), fy(i) + 20, zf - T - 80])), tools: ["screwdriver"] },
    { title: "Screw on the knobs", detail: "One near the top of each bin front, the screw from inside.", fix: [fx("knob", [0, 1, 2].map((i): Vec3 => [0, fy(i) + fh / 2 - 45, zf + 5]), [0, 0, -1]), fx("screw", [0, 1, 2].map((i): Vec3 => [0, fy(i) + fh / 2 - 45, zf - T]), [0, 0, 1], undefined, { len: 25, dia: 4 })], tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

const recipe = (s: ProductSpec) => (/brusali-shoe-cabinet-3/.test(s.slug ?? "") ? cabinet(s) : null);

/** The first bin is built face down in front of the cabinet, then swings up onto its pivots. */
function build(b: PlanBuilder, s: ProductSpec): boolean {
  const r = recipe(s);
  if (!r) return false;
  const start = b.steps.length;
  buildCustom(b, { ...s, custom: r });
  r.steps.forEach((st, i) => {
    const bs = b.steps[start + i];
    if (bs && st.tools && bs.title === st.title) bs.tools = [...st.tools];
  });
  const at = (t: RegExp) => start + r.steps.findIndex((x) => t.test(x.title));
  const hangStep = at(/Hang the bin/);
  const front = r.parts.find((p) => p.id === "F0")!;
  const pivot: Vec3 = [0, front.pos[1], 30];
  const rot: Vec3 = [0, -Math.PI / 2, 0]; // face down while the cabinet lies on its left side
  const target: Vec3 = [-305 + 120, front.pos[1], 600];
  for (const id of ["F0", "K00", "K01", "A0", "B0"]) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    const st = it?.states.find((x) => x.step >= start);
    if (!it || !st) continue;
    const rel = rotate([p.pos[0] - pivot[0], p.pos[1] - pivot[1], p.pos[2] - pivot[2]], rot);
    const pos: Vec3 = [target[0] + rel[0], target[1] + rel[1], target[2] + rel[2]];
    it.states.splice(it.states.indexOf(st), 1, { ...st, pos, rot }, { ...st, step: hangStep, from: [0, 0, 300] });
    it.states.sort((a, c) => a.step - c.step);
  }
  return true;
}

const family: Family = { names: ["BRUSALI"], recipe, build };
export default family;
