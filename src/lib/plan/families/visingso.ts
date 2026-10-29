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

const recipe = (s: ProductSpec) => (/visingso-table/.test(s.slug ?? "") ? table(s) : /chair/i.test(s.variant) ? chair(s) : null);

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
