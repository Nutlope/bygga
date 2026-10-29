import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import { buildCustom } from "../custom";

/**
 * INGOLF, read from the junior chair's manual. Each side comes in one piece: a front leg and the curved back leg
 * (which rises into the backrest) joined by a low stretcher. One side lies flat on a rug; the footrest and the back
 * stretcher plug into it, then the front and back aprons with their dowels, and the other side goes on top and is
 * screwed to all four rails. Stood up, the first side gets its four screws, the seat drops on, the two crossed back
 * slats spring into the slots of the uprights, and the top rail is screwed on from behind. Last, upside down, three
 * screws go up through the aprons into the seat. The adult INGOLF chair has no manual to check, so it keeps its guide.
 */

const LEG = 35;
const SCREW = { name: "Allen screw", len: 70, dia: 6 };

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

/** A square leg from one end to the other, leaning front to back. */
function post(a: Vec3, b: Vec3): PartPiece {
  const dy = b[1] - a[1], dz = b[2] - a[2];
  return { shape: "box", size: [LEG, Math.hypot(dy, dz), LEG], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

function junior(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xl = W / 2 - LEG / 2 - 25; // leg centres
  const xi = xl - LEG / 2; // inside faces of the sides
  const seatTop = 520, seatT = 25, top = seatTop - seatT; // tops of the aprons and front legs
  const zf0 = D / 2 - 25, zf1 = zf0 - 80; // front leg at the floor and at the top
  const zb0 = -D / 2 + 20, zb1 = zb0 + 80, zbTop = zb1 - 45; // back leg at the floor, at the seat and at the top
  const upTop = H - 20;
  const zF = (y: number) => zf0 + ((zf1 - zf0) * y) / top;
  const zB = (y: number) => (y <= top ? zb0 + ((zb1 - zb0) * y) / top : zb1 + ((zbTop - zb1) * (y - top)) / (upTop - top));
  const yS = 155; // side stretcher

  const side = (id: string, sx: number): CustomPart => {
    const x = sx * xl;
    const abs: PartPiece[] = [
      post([x, 0, zf0], [x, top, zf1]),
      post([x, 0, zb0], [x, top, zb1]),
      post([x, top, zb1], [x, upTop, zbTop]),
      { shape: "box", size: [22, 40, zF(yS) - zB(yS) - LEG], pos: [x, yS, (zF(yS) + zB(yS)) / 2] },
    ];
    const lo = [x - LEG / 2, 0, zb0 - LEG], hi = [x + LEG / 2, upTop, zf0 + LEG / 2];
    const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
    return { id, name: "Side frame", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material: "wood" };
  };
  const yA = top - 35; // aprons, 70 high
  const yFoot = 290, yBs = 350;
  const rail = (id: string, name: string, h: number, t: number, y: number, z: number): CustomPart => ({ id, name, size: [2 * xi, h, t], pos: [0, y, z], material: "wood" });
  const parts: CustomPart[] = [
    side("SIDE_L", -1),
    rail("FOOT", "Footrest", 40, 25, yFoot, zF(yFoot)),
    rail("BSTR", "Back stretcher", 40, 25, yBs, zB(yBs)),
    rail("APRON_F", "Apron", 70, 20, yA, zF(yA)),
    rail("APRON_B", "Apron", 70, 20, yA, zB(yA)),
    side("SIDE_R", 1),
  ];
  // the seat, cut back between the uprights
  const sw = W / 2 - 15, sz0 = zb1 + LEG / 2 + 2, sz1 = D / 2 - 30;
  parts.push({
    id: "SEAT",
    name: "Seat",
    size: [2 * sw, seatT, sz1 - (zb1 - LEG / 2)],
    pos: [0, seatTop - seatT / 2, (sz1 + zb1 - LEG / 2) / 2],
    pieces: [
      { shape: "box", size: [2 * sw, seatT, sz1 - sz0], pos: [0, 0, (sz1 - sz0) / 2 - (sz1 - (zb1 - LEG / 2)) / 2 + (sz0 - (zb1 - LEG / 2))] },
      { shape: "box", size: [2 * xi - 4, seatT, sz0 - (zb1 - LEG / 2)], pos: [0, 0, (sz0 - (zb1 - LEG / 2)) / 2 - (sz1 - (zb1 - LEG / 2)) / 2] },
    ],
    material: "wood",
  });
  // two back slats crossing between the uprights, and the top rail in front of their tops
  const ys0 = seatTop + 20, ys1 = upTop - 90;
  const span = 2 * xi, rise = ys1 - ys0;
  const ang = Math.atan2(rise, span), len = Math.hypot(span, rise);
  const zs = zB((ys0 + ys1) / 2);
  [1, -1].forEach((g, i) => parts.push({ id: `SLAT${i}`, name: "Back slat", size: [len, 40, 15], pos: [0, (ys0 + ys1) / 2, zs + (i ? 9 : -9)], rot: [0, 0, g * ang], material: "wood" }));
  const yT = upTop - 35;
  parts.push({ id: "TOP", name: "Top rail", size: [W - 30, 70, 22], pos: [0, yT, zB(yT) + LEG / 2 + 11], material: "wood" });

  // dowels in the aprons' ends, two at each end (one big one in two of them)
  const ends = (id: string, z: number, g: number, ys: number[]) => fx("dowel", ys.map((y): Vec3 => [g * xi, y, z]), [-g, 0, 0], id, { mate: g < 0 ? "SIDE_L" : "SIDE_R" });
  const big = { len: 40, dia: 10 };
  const screwsThrough = (sx: number): CustomFix => {
    const pts: Vec3[] = [
      [sx * (xl + LEG / 2), yA, zF(yA)],
      [sx * (xl + LEG / 2), yFoot, zF(yFoot)],
      [sx * (xl + LEG / 2), yA, zB(yA)],
      [sx * (xl + LEG / 2), yBs, zB(yBs)],
    ];
    return fx("screw", pts, [-sx, 0, 0], sx < 0 ? "SIDE_L" : "SIDE_R", SCREW);
  };
  const steps: CustomStep[] = [
    {
      title: "Plug the footrest and back stretcher into a side",
      detail: "Lay one side flat on a rug, holes up. The footrest goes into the straight front leg, the back stretcher into the curved one.",
      add: ["SIDE_L", "FOOT", "BSTR"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Push a big dowel into each apron", detail: "The thicker dowels go into the big hole at one end of each apron.", fix: [ends("APRON_F", zF(yA), -1, [yA - 15]), ends("APRON_B", zB(yA), -1, [yA - 15])].map((f) => ({ ...f, ...big })) },
    {
      title: "Push the thin dowels into the aprons",
      detail: "Six in all, filling the rest of the holes at the ends.",
      fix: [ends("APRON_F", zF(yA), -1, [yA + 15]), ends("APRON_B", zB(yA), -1, [yA + 15]), ends("APRON_F", zF(yA), 1, [yA - 15, yA + 15]), ends("APRON_B", zB(yA), 1, [yA - 15, yA + 15])],
    },
    { title: "Stand the aprons in the side", detail: "Dowels down into the holes at the top of the legs. The holes for the seat screws face the inside.", add: ["APRON_F", "APRON_B"] },
    { title: "Lay the other side on top", detail: "Lower it so all four rails find their holes, then press it down.", add: ["SIDE_R"], from: { SIDE_R: [300, 0, 0] } },
    { title: "Screw it to the four rails", detail: "One screw at each rail. Stop when the heads sit about 5 mm deep, don't tighten yet.", fix: [screwsThrough(1)], tools: ["allen"] },
    { title: "Stand it up and screw on the first side", detail: "Turn it onto its legs. Four more screws through the other side, the same depth.", fix: [screwsThrough(-1)], pose: "+y", tools: ["allen"] },
    { title: "Lay the seat on the frame", detail: "The cut-out goes at the back, around the uprights.", add: ["SEAT"], from: { SEAT: [0, 260, 0] } },
    { title: "Spring the first back slat into the uprights", detail: "Pull the tops of the uprights apart a little and slide its ends into the slots.", add: ["SLAT0"], from: { SLAT0: [0, 0, 240] }, people: 2 },
    { title: "Fit the second slat across it", detail: "The same way, into the other slots, so the two form a cross.", add: ["SLAT1"], from: { SLAT1: [0, 0, 240] }, people: 2 },
    { title: "Tighten all eight screws", detail: "Firmly now, with the Allen key, until the frame doesn't move.", tools: ["allen"], check: "square" },
    {
      title: "Screw the top rail on",
      detail: "Its dowels go into the tops of the uprights. One screw through each upright from behind.",
      add: ["TOP"],
      fix: [fx("screw", [-1, 1].map((sx): Vec3 => [sx * xl, yT, zB(yT) - LEG / 2]), [0, 0, 1], undefined, { len: 40, dia: 6, name: "Allen screw", mate: "TOP" })],
      tools: ["allen"],
    },
    {
      title: "Turn it over and screw the seat on",
      detail: "Rest it upside down on a table edge, seat flat. Three screws up through the aprons into the seat.",
      fix: [fx("screw", [[-90, yA - 35, zF(yA)], [90, yA - 35, zF(yA)], [0, yA - 35, zB(yA)]], [0, 1, 0], undefined, { len: 60, dia: 4, mate: "SEAT" })],
      pose: "-y",
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["INGOLF"],
  build(b, s) {
    if (!/junior/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = junior(s);
    buildCustom(b, { ...s, custom: r });
    // the aprons lie on the rug while their dowels go in, and only stand up in the side two steps later
    const first = r.steps.findIndex((x) => /big dowel/.test(x.title));
    const stand = r.steps.findIndex((x) => /Stand the aprons/.test(x.title));
    const xo = -(s.size.w * 5 - 25) + 10;
    ["APRON_F", "APRON_B"].forEach((id, i) => {
      const p = r.parts.find((q) => q.id === id)!;
      const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
      const st = it?.states.find((x) => x.step === first);
      if (!it || !st) return;
      it.states.splice(it.states.indexOf(st), 1, { ...st, pos: [xo, 280 + i * 110, s.size.d * 5 + 160], rot: [0, Math.PI / 2, 0], from: [0, 0, 250] }, { ...st, step: stand, from: [200, 0, 0] });
      it.states.sort((a, c) => a.step - c.step);
    });
    return true;
  },
};
export default family;
