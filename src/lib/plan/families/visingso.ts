import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VISINGSÖ, read from the table's manual (powder-coated steel). The top comes with its small cross held on under it
 * by two nuts: those come off first. The cross is bolted onto the column with one long bolt, then the column is
 * turned over and the four-armed base takes four short bolts. Upside down on the top, the cross goes over the eight
 * studs under the top and takes eight washers and nuts, and the table is stood up and its feet adjusted.
 * The chair with armrests has no manual (its frame is welded in one piece): its guide only unpacks it.
 * The plant stand, from its manual: four steel mesh panels hook together at their corners into a box that narrows
 * towards the top at the front. Upside down, a plate goes in each corner with two screws, an adjustable foot screws
 * into each plate, and the stand is turned over and the shelf dropped in onto the middle bars.
 */

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, ...(on ? { on } : {}), ...o };
}

/** Four arms along the diagonals, as pieces: each a flat bar from r0 to r1 out from the middle. */
function arms(r0: number, r1: number, h: number, w: number, y: number): PartPiece[] {
  const r = (r0 + r1) / 2;
  return [1, 3, 5, 7].map((q): PartPiece => {
    const a = (q * Math.PI) / 4;
    return { shape: "box", size: [r1 - r0, h, w], pos: [r * Math.cos(a), y, -r * Math.sin(a)], rot: [0, a, 0] };
  });
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 70 x 70, 74 high
  const W = Math.round(s.size.w * 10) || 700, D = Math.round(s.size.d * 10) || 700, H = Math.round(s.size.h * 10) || 740;
  const tT = 25, under = H - tT;
  const sT = 12, ySp = under - sT; // the cross under the top
  const hubT = 60, yCol0 = hubT + 10, yCol1 = ySp - 20;
  const diag = (r: number, q: number): Vec3 => [r * Math.cos((q * Math.PI) / 4), 0, -r * Math.sin((q * Math.PI) / 4)];
  const parts: CustomPart[] = [
    { id: "TOP", name: "Table top", size: [W, tT, D], pos: [0, under + tT / 2, 0], material: "metal" },
    {
      id: "SP",
      name: "Top cross",
      size: [420, sT + 20, 420],
      pos: [0, ySp - 4, 0],
      pieces: [...arms(30, 300, sT, 40, 10), { shape: "cyl", size: [80, sT + 20, 80], pos: [0, 0, 0] }],
      material: "metal",
    },
    { id: "COL", name: "Column", size: [60, yCol1 - yCol0, 60], pos: [0, (yCol0 + yCol1) / 2, 0], shape: "cyl", material: "metal" },
    {
      id: "BASE",
      name: "Base",
      size: [470, hubT + 10, 470],
      pos: [0, (hubT + 10) / 2, 0],
      pieces: [
        { shape: "cyl", size: [100, hubT, 100], pos: [0, 5, 0] },
        ...arms(40, 320, 35, 45, -2),
        ...[1, 3, 5, 7].map((q): PartPiece => {
          const p = diag(320, q);
          return { shape: "cyl", size: [45, 22, 45], pos: [p[0], -(hubT + 10) / 2 + 11, p[2]] };
        }),
      ],
      material: "metal",
    },
  ];
  const studs = [1, 3, 5, 7].flatMap((q) => [120, 260].map((r): Vec3 => {
    const p = diag(r, q);
    return [p[0], ySp, p[2]];
  }));
  return {
    parts,
    steps: [
      {
        title: "Take the cross off the top",
        detail: "Lay the top upside down on the box. Undo the two nuts holding the small cross and lift it off. Keep the nuts and washers.",
        add: ["TOP"],
        pose: "-y",
        tools: ["wrench"],
        warnings: ["floor"],
      },
      {
        title: "Bolt the cross onto the column",
        detail: "The long bolt with the big washer and a spring washer, down through the cross into the column. Tighten with the Allen key.",
        add: ["COL", "SP"],
        fix: [
          // the bolt first, so its washers stack on it
          fx("bolt", [[0, under - 2, 0]], [0, -1, 0], "SP", { len: 90, dia: 8, mate: "COL" }),
          fx("washer", [[0, under - 4, 0]], [0, -1, 0], "SP", { name: "Large washer", dia: 24 }),
          fx("washer", [[0, under - 3, 0]], [0, -1, 0], "SP", { name: "Spring washer", dia: 10 }),
        ],
        pose: "+y",
        tools: ["allen"],
      },
      {
        title: "Turn it over and bolt on the base",
        detail: "Four short bolts, each with a spring washer, up through the base into the column. Use the Allen key, not a drill.",
        add: ["BASE"],
        fix: [
          fx("bolt", [-1, 1].flatMap((a) => [-1, 1].map((b): Vec3 => [a * 22, 8, b * 22])), [0, 1, 0], "BASE", { len: 60, dia: 8, mate: "COL" }),
          fx("washer", [-1, 1].flatMap((a) => [-1, 1].map((b): Vec3 => [a * 22, 9, b * 22])), [0, 1, 0], "BASE", { name: "Spring washer", dia: 10 }),
        ],
        pose: "-y",
        tools: ["allen"],
      },
      {
        title: "Fix the stand to the top",
        detail: "Lower the stand onto the upside-down top so the cross fits over the eight studs. A washer and a nut on each, tightened with the box spanner.",
        fix: [fx("washer", studs, [0, 1, 0], "SP", { dia: 14 }), fx("nut", studs.map((p): Vec3 => [p[0], p[1] - 2, p[2]]), [0, 1, 0], "SP", { dia: 8 })],
        people: 2,
        tools: ["wrench"],
      },
      { title: "Stand it up and adjust the feet", detail: "Turn the table onto its feet, then screw each foot in or out until it stops rocking.", pose: "+y", people: 2, tools: [], kind: "legs" },
    ],
  };
}

/** The chair with armrests is welded in one piece and has no manual: unpack it and it's ready. */
function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const ys = 450, t = 22, xl = W / 2 - 60, yc = H / 2;
  const leg = (x: number, z0: number, z1: number, y1: number): PartPiece => {
    const len = Math.hypot(y1, z1 - z0);
    return { shape: "cyl", size: [t, len, t], pos: [x, y1 / 2 - yc, (z0 + z1) / 2], rot: [Math.atan2(z1 - z0, y1), 0, 0] };
  };
  const pieces: PartPiece[] = [
    ...[-1, 1].flatMap((sx) => [leg(sx * xl, D / 2 - 40, D / 2 - 70, ys), leg(sx * xl, -D / 2 + 30, -D / 2 + 70, ys)]),
    { shape: "slab", size: [W - 120, 14, D - 120], pos: [0, ys + 7 - yc, 10], outline: [[-(W - 120) / 2, -(D - 120) / 2], [(W - 120) / 2, -(D - 120) / 2], [(W - 120) / 2, (D - 120) / 2], [-(W - 120) / 2, (D - 120) / 2]], round: 60 },
    { shape: "box", size: [W - 140, 260, 14], pos: [0, H - 150 - yc, -D / 2 + 60], rot: [-0.15, 0, 0] },
    // the armrests: a tube up from each front leg, along to the back and down to the backrest
    ...[-1, 1].flatMap((sx): PartPiece[] => [
      { shape: "cyl", size: [t, 240, t], pos: [sx * (W / 2 - t / 2), ys + 120 - yc, D / 2 - 90] },
      { shape: "cyl", size: [t, D - 150, t], pos: [sx * (W / 2 - t / 2), ys + 240 - yc, -15], rot: [Math.PI / 2, 0, 0] },
      { shape: "cyl", size: [t, H - ys - 200, t], pos: [sx * (W / 2 - 50), (ys + H - 200) / 2 + 100 - yc, -D / 2 + 70] },
    ]),
  ];
  return {
    parts: [{ id: "C", name: "Chair", size: [W, H, D], pos: [0, yc, 0], material: "metal", pieces }],
    steps: [
      { title: "Take the chair out of its packaging", detail: "It comes welded in one piece, with its glides already on. There's nothing to put together.", add: ["C"] },
      { title: "Check it stands steady", detail: "Set it on a flat surface. The chairs stack, so you can store them on top of each other." },
    ],
  };
}

/** A steel mesh panel: a tube frame round a sheet of mesh, with a bar across where the shelf rests. */
function panelPieces(len: number, h: number, yBar: number): PartPiece[] {
  const t = 14;
  return [
    { shape: "box", size: [len, t, t], pos: [0, -h / 2 + t / 2, 0] },
    { shape: "box", size: [len, t, t], pos: [0, h / 2 - t / 2, 0] },
    { shape: "box", size: [t, h, t], pos: [-len / 2 + t / 2, 0, 0] },
    { shape: "box", size: [t, h, t], pos: [len / 2 - t / 2, 0, 0] },
    { shape: "box", size: [len - 2 * t, 10, t], pos: [0, yBar - h / 2, 0] },
    { shape: "box", size: [len - 2 * t, h - 2 * t, 2], pos: [0, 0, 0] },
  ];
}

function plantStand(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 700, D = Math.round(s.size.d * 10) || 430, H = Math.round(s.size.h * 10) || 740;
  const FOOT = 16, PL = 4;
  const y0 = FOOT + PL; // bottom of the panels
  const ph = H - y0;
  const lean = 150; // the front comes in this much towards the top
  const zB = -D / 2 + 7, zF0 = D / 2 - 7;
  const yBar = 0.55 * ph; // the shelf bars, up from the panels' foot
  const tilt = Math.atan2(lean, ph);
  const zF = (y: number) => zF0 - (lean * (y - y0)) / ph;
  const yc = y0 + ph / 2;
  const sidePart = (id: string, g: number): CustomPart => {
    const x = g * (W / 2 - 7);
    const t = 14, zt = zF(H);
    // a side is a trapezoid: square at the back, sloping at the front
    const pieces: PartPiece[] = [
      { shape: "box", size: [t, t, zF0 - zB], pos: [x, y0 + t / 2, (zB + zF0) / 2] },
      { shape: "box", size: [t, t, zt - zB], pos: [x, H - t / 2, (zB + zt) / 2] },
      { shape: "box", size: [t, ph, t], pos: [x, yc, zB] },
      { shape: "box", size: [t, Math.hypot(ph, lean), t], pos: [x, yc, (zF0 + zt) / 2], rot: [-tilt, 0, 0] },
      { shape: "box", size: [t, 10, zF(y0 + yBar) - zB], pos: [x, y0 + yBar, (zB + zF(y0 + yBar)) / 2] },
    ];
    // the mesh, in strips that follow the sloping front
    const n = 14, sh = (ph - 2 * t) / n;
    for (let k = 0; k < n; k++) {
      const y = y0 + t + (k + 0.5) * sh, z1 = zF(y) - t;
      pieces.push({ shape: "box", size: [2, sh, z1 - zB - t], pos: [x, y, (zB + t + z1) / 2] });
    }
    return { id, name: "Side panel", size: [t, ph, zF0 - zB], pos: [x, yc, (zB + zF0) / 2], material: "metal", pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - x, p.pos[1] - yc, p.pos[2] - (zB + zF0) / 2] })) };
  };
  const len = W - 28;
  const parts: CustomPart[] = [
    { id: "BK", name: "Back panel", size: [len, ph, 14], pos: [0, yc, zB], material: "metal", pieces: panelPieces(len, ph, yBar) },
    sidePart("SL", -1),
    sidePart("SR", 1),
    { id: "FR", name: "Front panel", size: [len, Math.hypot(ph, lean), 14], pos: [0, yc, (zF0 + zF(H)) / 2], rot: [-tilt, 0, 0], material: "metal", pieces: panelPieces(len, Math.hypot(ph, lean), yBar * (Math.hypot(ph, lean) / ph)) },
    { id: "SH", name: "Shelf", size: [len - 10, 8, zF(y0 + yBar) - zB - 20], pos: [0, y0 + yBar + 9, (zB + zF(y0 + yBar)) / 2], material: "metal" },
  ];
  const corners: [number, number][] = [[-1, zB], [1, zB], [1, zF0], [-1, zF0]];
  const plateAt = corners.map(([g, z]): Vec3 => [g * (W / 2 - 40), FOOT, z - Math.sign(z) * 33]);
  const screws = corners.flatMap(([g, z]): Vec3[] => [[g * (W / 2 - 7), FOOT, z - Math.sign(z) * 45], [g * (W / 2 - 45), FOOT, z]]);
  const sideOf = (p: Vec3) => (Math.abs(Math.abs(p[0]) - (W / 2 - 7)) < 1 ? (p[0] < 0 ? "SL" : "SR") : p[2] < 0 ? "BK" : "FR");
  return {
    parts,
    steps: [
      { title: "Hook a side panel onto the back panel", detail: "Stand them on a rug at a right angle and slide the two hooks down into the slots.", add: ["BK", "SL"], from: { SL: [0, 60, 0] }, warnings: ["floor"] },
      { title: "Hook on the front panel", detail: "Its two hooks go into the other edge of the side panel. The sloping side faces the front.", add: ["FR"], from: { FR: [0, 60, 0] } },
      { title: "Close the box with the other side", detail: "Four hooks this time, two into the back and two into the front.", add: ["SR"], from: { SR: [0, 60, 0] } },
      {
        title: "Turn it upside down and lay in the corner plates",
        detail: "One in each corner, across the ends of the two panels.",
        fix: [fx("plate", plateAt, [0, 1, 0], undefined, { name: "Corner plate", len: 4, dia: 70 })],
        pose: "-y",
      },
      {
        title: "Screw down the corner plates",
        detail: "Two screws through each plate, one into each panel.",
        fix: screws.map((p) => fx("screw", [p], [0, 1, 0], undefined, { len: 12, dia: 5, mate: sideOf(p) })),
        tools: ["screwdriver"],
      },
      { title: "Screw a foot into each plate", detail: "By hand, into the hole in the middle of the plate.", fix: [fx("foot", plateAt.map((p): Vec3 => [p[0], 0, p[2]]), [0, 1, 0], undefined, { len: FOOT, dia: 35 })], warnings: ["hand"] },
      {
        title: "Turn it over and drop in the shelf",
        detail: "It rests on the bars across the middle. Turn the feet to stop it rocking. It holds 20 kg at most.",
        add: ["SH"],
        from: { SH: [0, 500, 0] },
        pose: "+y",
      },
    ],
  };
}

const recipe = (s: ProductSpec) =>
  /visingso-table/.test(s.slug ?? "") ? table(s) : /chair/i.test(s.variant) ? chair(s) : /plant stand/i.test(s.variant) ? plantStand(s) : null;

/** The top waits upside down beside the stand while the column, cross and base go together. */
function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (!/visingso-table/.test(s.slug ?? "")) return false;
  const r = table(s);
  const start = b.steps.length;
  buildCustom(b, { ...s, custom: r });
  r.steps.forEach((st, i) => {
    const bs = b.steps[start + i];
    if (bs && st.tools && bs.title === st.title) bs.tools = [...st.tools];
  });
  const top = r.parts[0];
  const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - top.pos[k]) < 0.5));
  const st = it?.states.find((x) => x.step === start);
  if (it && st) {
    const away: Vec3 = [top.size[0] + 250, 0, 0];
    it.states.push(
      { ...st, step: start + 1, pos: [top.pos[0] + away[0], top.pos[1], top.pos[2]], from: undefined },
      { ...st, step: start + 3, pos: top.pos, from: [-away[0], 0, 0] },
    );
    it.states.sort((a, c) => a.step - c.step);
  }
  return true;
}

const family: Family = { names: ["VISINGSÖ"], recipe, build };
export default family;
