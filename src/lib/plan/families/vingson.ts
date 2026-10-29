import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VINGSÖN, read from the wing chair's manual. Each leg takes a barrel nut and a threaded rod; with the seat frame
 * upside down the rods go through its corner brackets and take a spring washer and a nut, tightened with the
 * spanner. The rope back comes in three woven sections: the narrow middle one is bolted to the right shell and the
 * left shell to that, three bolts each, left loose. The back stands on the frame and six long bolts with washers and
 * nuts hold it. The slatted seat drops in and, with the chair on its back, takes eight screws from below. Upright,
 * the six back bolts are tightened. No cushions in the box.
 */

const BOLT = { name: "Allen bolt", len: 30, dia: 6 };

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function chair(s: ProductSpec): CustomParams {
  // IKEA: 104 wide (across the wings), 87 deep, 144 high; the seat 62 wide and deep, 31 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const fw = 700, fd = 690, seatY = 310, railH = 80, rail = 40;
  const zF = D / 2 - fd / 2; // the frame sits to the front; the back leans out behind it
  const zBack = zF - fd / 2; // back edge of the frame
  const legH = seatY - railH;
  // the shells: sides lean out from the frame to the wings' full width, the back leans back
  const lean = Math.atan((W / 2 - fw / 2) / (H - seatY)), tilt = Math.atan((D / 2 + zBack) / (H - seatY));
  const sx0 = fw / 2 - 15, t = 25;
  const sideX = (y: number) => sx0 + (W / 2 - 15 - sx0) * ((y - seatY) / (H - seatY));
  const backZ = (y: number) => zBack + 15 - (D / 2 + zBack) * ((y - seatY) / (H - seatY));
  const armTop = 640;
  const sidePieces = (sx: number): PartPiece[] => [
    { shape: "box", size: [t, armTop - seatY, fd - 80], pos: [sx * sideX((seatY + armTop) / 2), (seatY + armTop) / 2, zF - 40], rot: [0, 0, -sx * lean] },
    { shape: "box", size: [t, H - armTop, 320], pos: [sx * sideX((armTop + H) / 2), (armTop + H) / 2, backZ((armTop + H) / 2) + 180], rot: [0, 0, -sx * lean] },
  ];
  const backPiece = (x0: number, x1: number): PartPiece => ({ shape: "box", size: [x1 - x0, (H - seatY) / Math.cos(tilt), t], pos: [(x0 + x1) / 2, (seatY + H) / 2, backZ((seatY + H) / 2)], rot: [-tilt, 0, 0] });
  const xm0 = -30, xm1 = 170; // the narrow middle section
  const wl = sideX(H) + t, top = H, zLo = backZ(H) - t, zHi = zF + fd / 2 - 40;
  const legs = [-1, 1].flatMap((sz) => [-1, 1].map((sx) => ({ sx, sz, id: `LEG${sx}${sz}` })));
  const legPos = (sx: number, sz: number): Vec3 => [sx * (fw / 2 - 30), legH / 2, zF + sz * (fd / 2 - 30)];
  const parts: CustomPart[] = [
    ...legs.map(({ sx, sz, id }): CustomPart => ({ id, name: sz < 0 ? "Back leg" : "Front leg", size: [50, legH, 50], pos: legPos(sx, sz), rot: sz < 0 ? [-0.12, 0, 0] : [0, 0, 0], material: "wood" })),
    part(
      "FRAME",
      "Seat frame",
      [
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [rail, railH, fd], pos: [sx * (fw / 2 - rail / 2), legH + railH / 2, zF] })),
        ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [fw - 2 * rail, railH, rail], pos: [0, legH + railH / 2, zF + sz * (fd / 2 - rail / 2)] })),
        // the ledges inside the side rails the slatted seat rests on and is screwed through
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [20, 20, fd - 2 * rail], pos: [sx * (fw / 2 - rail - 10), seatY - 30, zF] })),
      ],
      [-fw / 2, legH, zF - fd / 2],
      [fw / 2, seatY, zF + fd / 2],
      "wood",
    ),
    part(
      "SEAT",
      "Slatted seat",
      Array.from({ length: 6 }, (_, i): PartPiece => ({ shape: "box", size: [fw - 2 * rail - 10, 20, 85], pos: [0, seatY - 10, zF - fd / 2 + rail + 50 + i * 101] })),
      [-fw / 2 + rail + 5, seatY - 20, zF - fd / 2 + rail + 7],
      [fw / 2 - rail - 5, seatY, zF + fd / 2 - rail - 7],
      "wood",
    ),
    part("SHELL_R", "Right shell", [...sidePieces(1), backPiece(xm1, sideX((seatY + H) / 2))], [xm1, seatY, zLo], [wl, top, zHi], "soft"),
    part("MID", "Middle back section", [backPiece(xm0, xm1)], [xm0, seatY, zLo], [xm1, top, zBack + 40], "soft"),
    part("SHELL_L", "Left shell", [...sidePieces(-1), backPiece(-sideX((seatY + H) / 2), xm0)], [-wl, seatY, zLo], [xm0, top, zHi], "soft"),
  ];

  // each leg: the barrel nut drops into its top, the threaded rod goes in from the inside corner
  const barrel = legs.map(({ sx, sz, id }) => fx("nut", [[legPos(sx, sz)[0], legH, legPos(sx, sz)[2]]], [0, -1, 0], id, { name: "Barrel nut", dia: 10, len: 20 }));
  const rods = legs.map(({ sx, sz, id }) => {
    const p = legPos(sx, sz);
    return fx("stud", [[p[0] - sx * 18, legH - 40, p[2] - sz * 18]], [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2], id, { name: "Threaded rod", len: 60, dia: 8 });
  });
  const inner = (list: typeof legs) => list.map(({ sx, sz }): Vec3 => [sx * (fw / 2 - 110), legH + 40, zF + sz * (fd / 2 - 110)]);
  const back = legs.filter((l) => l.sz < 0), front = legs.filter((l) => l.sz > 0);
  const cornerNuts = (list: typeof legs): CustomFix[] =>
    list.flatMap(({ sx, sz, id }) => {
      const at = inner([{ sx, sz, id }]);
      const d: Vec3 = [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2];
      return [fx("washer", at, d, "FRAME", { name: "Spring washer", dia: 8, mate: id }), fx("nut", at, d, "FRAME", { dia: 8, mate: id })];
    });
  // the joints between the sections: three bolts down each seam
  const seam = (x: number, z0: number): Vec3[] => [450, 850, 1250].map((y): Vec3 => [x, y, backZ(y) + z0]);
  const backBolts: Vec3[] = [...[-1, 1].map((sz): Vec3 => [-(fw / 2 - rail / 2), seatY, zF + sz * 180]), ...[-1, 1].map((sz): Vec3 => [fw / 2 - rail / 2, seatY, zF + sz * 180]), [-200, seatY, zBack + rail / 2], [200, seatY, zBack + rail / 2]];
  const seatScrews: Vec3[] = [-1, 1].flatMap((sx) => [0, 1, 2, 3].map((i): Vec3 => [sx * (fw / 2 - rail - 12), seatY - 40, zF - fd / 2 + rail + 50 + i * 170]));
  const steps: CustomStep[] = [
    {
      title: "Fit a barrel nut and a threaded rod into each leg",
      detail: "Drop the barrel nut into the hole in the top, slot facing the side hole, then screw the rod into the side until it bites.",
      fix: [...barrel, ...rods],
      tools: ["allen"],
      wait: legs.map((l) => l.id),
    },
    {
      title: "Fix the back legs to the upside-down frame",
      detail: "Lay the frame upside down on a rug. Each rod goes through a corner bracket, then a spring washer and a nut, tightened with the spanner. The splayed legs lean out to the back.",
      add: ["FRAME", ...back.map((l) => l.id)],
      fix: cornerNuts(back),
      tools: ["wrench"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Fix the front legs the same way", detail: "Straight legs at the front, a spring washer and a nut on each rod.", add: front.map((l) => l.id), fix: cornerNuts(front), tools: ["wrench"] },
    {
      title: "Bolt the middle section to the right shell",
      detail: "Three bolts through the seam, turned in only part way for now.",
      add: ["SHELL_R", "MID"],
      fix: [fx("bolt", seam(xm1, 0), [-1, 0, 0], "SHELL_R", { ...BOLT, mate: "MID" })],
      tools: ["allen"],
      pose: "+y",
      warnings: ["loose"],
    },
    {
      title: "Bolt on the left shell",
      detail: "Three more bolts down the other seam, also loose.",
      add: ["SHELL_L"],
      fix: [fx("bolt", seam(xm0, 0), [1, 0, 0], "SHELL_L", { ...BOLT, mate: "MID" })],
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Bolt the back onto the seat frame",
      detail: "Stand the frame on its legs and set the back on it. Six long bolts down through the tabs and the frame, a washer above and below, and a nut held with the spanner.",
      fix: [
        fx("bolt", backBolts, [0, -1, 0], "FRAME", { name: "Allen bolt", len: 100, dia: 6 }),
        fx("washer", backBolts, [0, -1, 0], "FRAME", { dia: 6 }),
        fx("washer", backBolts.map((p): Vec3 => [p[0], legH, p[2]]), [0, 1, 0], "FRAME", { dia: 6 }),
        fx("nut", backBolts.map((p): Vec3 => [p[0], legH - 2, p[2]]), [0, 1, 0], "FRAME", { dia: 6 }),
      ],
      tools: ["allen", "wrench"],
      pose: "+y",
    },
    { title: "Drop the slatted seat into the frame", detail: "It sits on the ledges inside the frame, slats running across.", add: ["SEAT"], from: { SEAT: [0, 300, 0] } },
    {
      title: "Screw the seat on from below",
      detail: "Lay the chair on its back on a rug. Eight screws up through the frame's ledges into the seat.",
      fix: [fx("screw", seatScrews, [0, 1, 0], "FRAME", { len: 40, dia: 4, mate: "SEAT" })],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Stand it up and tighten the back bolts", detail: "All six bolts in the seams, firmly with the Allen key.", tools: ["allen"], pose: "+y" },
    { title: "Level the feet", detail: "If the chair rocks, turn the adjustable foot under each leg until all four touch the floor." },
  ];
  return { parts, steps };
}

/** Parts built on their own are shown in their own scene for steps `from` to `until`, and come in at `join`. */
function apart(b: PlanBuilder, r: CustomParams, ids: string[], scene: string, from: number, until: number, join: number, off: Vec3) {
  for (let i = from; i < until; i++) if (b.steps[i]) b.steps[i].scene = scene;
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (!it) continue;
    it.states = it.states.filter((st) => st.step < join).map((st) => ({ ...st, scene }));
    it.states.push({ step: join, scene: "main", pos: it.final.pos, rot: it.final.rot, from: off, delay: 0.2 });
  }
}

const family: Family = {
  names: ["VINGSÖN", "VINGSON"],
  build(b, s) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chair(s);
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    apart(b, r, ["SHELL_R", "MID", "SHELL_L"], "back", idx(/middle section/), idx(/back onto the seat frame/), idx(/back onto the seat frame/), [0, 400, 0]);
    return true;
  },
};
export default family;
