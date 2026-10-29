import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * NEIDEN (solid pine), read from its two manuals: the single (also the twin and the 90x200) and the double.
 * The headboard's top rail is two boards, doweled and screwed face to face. Dowels go into the board ends and the
 * legs, a block is screwed onto each leg, and the head and foot ends are screwed together with long screws through
 * the legs. Dowels in the blocks take the side rails, each bolted through its leg into a barrel nut. Four screws
 * lock the rails from inside, a cross beam hangs between them on two brackets, and four dowels on the rails keep
 * the slats in place. The double adds a centre rail, pinned and bolted to both ends, and has two cross beams on
 * four brackets and eight slat dowels.
 * IKEA's sizes: 96 x 195 (single), 101 x 195 (twin), 139 x 195 (double); headboard 65 cm, footboard 30 cm.
 */

const LX = 40, LZ = 70; // legs
const BT = 20; // boards

/** Outside width and length of the frame, in mm, from IKEA's measurements. */
function dims(s: ProductSpec): [number, number] {
  const slug = s.slug ?? "";
  if (/double/.test(slug)) return [1390, 1950];
  if (/twin/.test(slug)) return [1010, 1950];
  if (/90-x-200/.test(slug)) return [960, 2050];
  return [960, 1950];
}

const DOWEL_S = { kind: "dowel" as const, len: 25, dia: 8 };
const DOWEL_L = { kind: "dowel" as const, len: 40, dia: 10 };

function slatRoll(w: number, len: number): PartPiece[] {
  const n = Math.max(12, Math.round(len / 110));
  const pitch = (len - 60) / (n - 1);
  return [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [w, 9, 55], pos: [0, 2, -len / 2 + 30 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [sx * (w / 2 - 90), -4, 0], material: "fiber" })),
  ];
}

function recipe(s: ProductSpec) {
  if (!/^neiden-bed-frame/.test(s.slug ?? "")) return null;
  const dbl = /double/.test(s.slug ?? "");
  const [W, L] = dims(s);
  const H = 650, FH = 300;
  const xl = W / 2 - LX / 2, zh = -L / 2 + LZ / 2, zf = L / 2 - LZ / 2;
  const xi = W / 2 - LX; // inside faces of the legs
  const yr0 = 200, yr1 = 320; // side rails
  const ySl = 290; // slats rest here
  const parts: CustomPart[] = [];
  const wood = "wood" as const;
  for (const sx of [-1, 1]) {
    parts.push({ id: `HL${sx}`, name: "Head leg", size: [LX, H, LZ], pos: [sx * xl, H / 2, zh], material: wood });
    parts.push({ id: `FL${sx}`, name: "Foot leg", size: [LX, FH, LZ], pos: [sx * xl, FH / 2, zf], material: wood });
  }
  // the top rail, two boards face to face
  for (const [id, dz] of [["TB", -BT / 2], ["TF", BT / 2]] as const) parts.push({ id, name: "Top rail board", size: [2 * xi, 80, BT], pos: [0, H - 45, zh + dz], material: wood });
  parts.push({ id: "HB", name: "Headboard rail", size: [2 * xi, 130, BT], pos: [0, 285, zh], material: wood });
  parts.push({ id: "FB", name: "Footboard", size: [2 * xi, 120, BT], pos: [0, FH - 70, zf], material: wood });
  // a block on each leg, facing into the bed, takes the side rail's end
  const bz = (sz: number) => (sz < 0 ? zh + LZ / 2 + 15 : zf - LZ / 2 - 15);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ id: `BK${sx}${sz}`, name: "Rail block", size: [LX, yr1 - yr0, 30], pos: [sx * xl, (yr0 + yr1) / 2, bz(sz)], material: wood });
  const z0 = bz(-1) + 15, z1 = bz(1) - 15;
  for (const sx of [-1, 1])
    parts.push({
      id: `SR${sx}`,
      name: "Side rail",
      size: [LX, yr1 - yr0, z1 - z0],
      pos: [sx * xl, (yr0 + yr1) / 2, (z0 + z1) / 2],
      material: wood,
      // the inner lip the slats rest on; both rails are the same part, the left one turned round
      rot: sx < 0 ? [0, Math.PI, 0] : undefined,
      pieces: [
        { shape: "box", size: [BT, yr1 - yr0, z1 - z0], pos: [LX / 2 - BT / 2, 0, 0] },
        { shape: "box", size: [LX - BT, 24, z1 - z0], pos: [-BT / 2, ySl - 12 - (yr0 + yr1) / 2, 0] },
      ],
    });
  const xr = xi; // inside face of the side rails' boards
  if (dbl) parts.push({ id: "CR", name: "Centre rail", size: [LX, 100, zf - zh - BT], pos: [0, ySl - 50, (zh + zf) / 2], material: wood });
  const beams = dbl ? [-1, 1].map((sx) => ({ id: `CB${sx}`, x0: sx < 0 ? -xr : LX / 2, x1: sx < 0 ? -LX / 2 : xr })) : [{ id: "CB", x0: -xr, x1: xr }];
  for (const b of beams) parts.push({ id: b.id, name: "Cross beam", size: [b.x1 - b.x0 - 4, 40, 60], pos: [(b.x0 + b.x1) / 2, ySl - 20, 0], material: wood });
  const extra = /twin/.test(s.slug ?? ""); // the US frame comes without slats
  const rollL = z1 - z0 - 10;
  const rolls = dbl ? [-1, 1].map((sx) => ({ id: `SL${sx}`, x: (sx * (xr + LX / 2)) / 2, w: xr - LX / 2 - 8 })) : [{ id: "SL", x: 0, w: 2 * xr - 8 }];
  for (const r of rolls) parts.push({ id: r.id, name: "Slatted bed base", size: [r.w, 14, rollL], pos: [r.x, ySl + 7, (z0 + z1) / 2], material: wood, pieces: slatRoll(r.w, rollL), extra });

  const sides = [-1, 1];
  const ends = (sx: number) => sx * xi;
  const boardDowels: CustomFix[] = [
    { ...DOWEL_L, count: 4, at: sides.flatMap((sx) => [-1, 1].map((d): Vec3 => [ends(sx), H - 45, zh + (d * BT) / 2])), dir: [-1, 0, 0] },
    { ...DOWEL_L, count: 4, at: sides.flatMap((sx) => [250, 320].map((y): Vec3 => [ends(sx), y, zh])), dir: [-1, 0, 0], on: "HB" },
    { ...DOWEL_L, count: 2, at: sides.map((sx): Vec3 => [ends(sx), FH - 70, zf]), dir: [-1, 0, 0], on: "FB" },
  ];
  // dowels point out of each board's end, so each side goes its own way
  const outward = (f: CustomFix): CustomFix[] => sides.map((sx) => ({ ...f, count: f.at!.length / 2, at: f.at!.filter((p) => Math.sign(p[0]) === sx), dir: [-sx, 0, 0] as Vec3 }));
  const legDowels: CustomFix[] = sides.flatMap((sx) =>
    [-1, 1].map((sz): CustomFix => ({ ...DOWEL_S, count: 2, at: [235, 285].map((y): Vec3 => [sx * xl, y, sz < 0 ? zh + LZ / 2 : zf - LZ / 2]), dir: [0, 0, -sz] as Vec3, on: sz < 0 ? `HL${sx}` : `FL${sx}` })),
  );
  const blockScrews: CustomFix[] = sides.flatMap((sx) => [-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 1, len: 30, dia: 7, at: [[sx * xl, 260, bz(sz) - sz * 15]], dir: [0, 0, sz] as Vec3, on: `BK${sx}${sz}` })));
  const legScrews: CustomFix[] = sides.flatMap((sx) =>
    [
      { on: `HL${sx}`, ys: [H - 65, H - 25], z: zh },
      { on: `HL${sx}`, ys: [250, 320], z: zh },
      { on: `FL${sx}`, ys: [FH - 100, FH - 40], z: zf },
    ].map((g): CustomFix => ({ kind: "screw", count: 2, len: 70, dia: 7, at: g.ys.map((y): Vec3 => [sx * (W / 2), y, g.z]), dir: [-sx, 0, 0] as Vec3, on: g.on })),
  );
  const railDowels: CustomFix[] = sides.flatMap((sx) => [-1, 1].map((sz): CustomFix => ({ ...DOWEL_L, count: 1, at: [[sx * xl, 290, sz < 0 ? z0 : z1]], dir: [0, 0, -sz] as Vec3, on: `BK${sx}${sz}` })));
  const BOLT = { kind: "bolt" as const, len: 140, dia: 8 };
  const BOLT_C = { kind: "bolt" as const, len: 110, dia: 8 };
  const NUT = { kind: "nut" as const, name: "Barrel nut", len: 14, dia: 10 };
  const railBolts = (sz: number): CustomFix[] => [
    { ...BOLT, count: 2, at: sides.map((sx): Vec3 => [sx * xl, 240, sz * (L / 2)]), dir: [0, 0, -sz] },
    ...sides.map((sx): CustomFix => ({ ...NUT, count: 1, at: [[sx * xi, 240, sz < 0 ? z0 + 90 : z1 - 90]], dir: [sx, 0, 0], on: `SR${sx}` })),
  ];
  const centreBolts = (sz: number): CustomFix[] => [
    { ...BOLT_C, count: 2, at: [215, 265].map((y): Vec3 => [0, y, sz < 0 ? zh - BT / 2 : zf + BT / 2]), dir: [0, 0, -sz], on: sz < 0 ? "HB" : "FB", mate: "CR" },
    { ...NUT, count: 2, at: [-1, 1].map((d): Vec3 => [0, ySl, (sz < 0 ? zh + 80 : zf - 80) + d * 25]), dir: [0, -1, 0], on: "CR" },
  ];
  const bracketsOn = beams.flatMap((b) => [b.x0, b.x1].map((x) => ({ id: b.id, x, sx: x > (b.x0 + b.x1) / 2 ? 1 : -1 })));
  const steps: CustomStep[] = [
    { title: "Tap two dowels into a top rail board", detail: "Into the holes in its face, the one without the rounded edge.", add: ["TB"], fix: [{ ...DOWEL_S, count: 2, at: [-1, 1].map((sx): Vec3 => [sx * (xi - 200), H - 45, zh]), dir: [0, 0, -1], on: "TB", mate: "TF" }], warnings: ["floor"] },
    { title: "Lay the other board on top", detail: "Press it down over the dowels so the edges line up.", add: ["TF"], from: { TF: [0, 0, 200] } },
    {
      title: "Screw the two boards together",
      detail: "Then turn the top rail over.",
      fix: [{ kind: "screw", count: dbl ? 4 : 2, len: 30, dia: 7, at: Array.from({ length: dbl ? 4 : 2 }, (_, i): Vec3 => [-xi + 200 + ((2 * xi - 400) * i) / (dbl ? 3 : 1), H - 45, zh - BT]), dir: [0, 0, 1], on: "TB", mate: "TF" }],
      tools: ["allen"],
    },
    { title: "Tap dowels into the board ends", detail: "Into both ends of the top rail, the headboard rail and the footboard.", fix: boardDowels.flatMap(outward), tools: ["hammer"] },
    { title: "Tap dowels into the legs", detail: "Two in each leg, on the inside face where the block goes.", fix: legDowels, tools: ["hammer"] },
    { title: "Screw a block onto each leg", detail: "Over the two dowels, with its holes facing into the bed.", add: ["BK-1-1", "BK1-1", "BK-11", "BK11"], fix: blockScrews, tools: ["allen"] },
    {
      title: "Screw the head and foot ends together",
      detail: "Lay the legs and boards out flat on a rug. Two long screws through the leg into each board end.",
      add: ["HB", "FB", "HL-1", "HL1", "FL-1", "FL1"],
      fix: legScrews,
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Tap dowels into the blocks", detail: "One in each block, for the side rails.", fix: railDowels, tools: ["hammer"] },
    {
      title: "Bolt the side rails to the headboard",
      detail: "Drop a barrel nut into the hole in each rail, slot facing the bolt. Push the rail onto the dowel and bolt it through the leg.",
      add: ["SR-1", "SR1"],
      fix: railBolts(-1),
      tools: ["allen", "flathead"],
      people: 2,
    },
  ];
  if (dbl)
    steps.push(
      {
        title: "Push the pins into the centre rail",
        detail: "Two in each end.",
        fix: [-1, 1].map((sz): CustomFix => ({ kind: "dowel", name: "Metal pin", count: 2, len: 40, dia: 8, at: [-1, 1].map((d): Vec3 => [d * 10, 205, sz < 0 ? zh + BT / 2 : zf - BT / 2]), dir: [0, 0, sz], on: "CR" })),
      },
      { title: "Bolt the centre rail to the headboard", detail: "Two shorter bolts through the headboard rail into the barrel nuts in the centre rail.", add: ["CR"], fix: centreBolts(-1), tools: ["allen", "flathead"] },
      { title: "Bolt on the footboard", detail: "Push it onto the side rails' dowels together, then a long bolt through each leg into its barrel nut.", fix: railBolts(1), tools: ["allen", "flathead"], people: 2 },
      { title: "Bolt the centre rail to the footboard", detail: "Two shorter bolts, the same way as at the head.", fix: centreBolts(1), tools: ["allen", "flathead"] },
    );
  else steps.push({ title: "Bolt on the footboard", detail: "Push it onto the side rails' dowels together, then a long bolt through each leg into its barrel nut.", fix: railBolts(1), tools: ["allen", "flathead"], people: 2 });
  steps.push(
    {
      title: "Screw the rails to the blocks from inside",
      detail: "One screw at each corner.",
      fix: sides.flatMap((sx) => [-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 1, len: 30, dia: 7, at: [[sx * xi, 300, sz < 0 ? z0 + 30 : z1 - 30]], dir: [sx, 0, 0], on: `SR${sx}` }))),
      tools: ["allen"],
    },
    {
      title: dbl ? "Screw the brackets onto the cross beams" : "Screw the brackets onto the cross beam",
      detail: "One bracket on each end, one screw down into the beam.",
      add: beams.map((b) => b.id),
      fix: [
        { kind: "angle", name: "Beam bracket", count: bracketsOn.length, len: 60, dia: 50, at: bracketsOn.map((b): Vec3 => [b.x - b.sx * 4, ySl, 0]), dir: [0, -1, 0] },
        { kind: "screw", count: bracketsOn.length, len: 16, dia: 5, at: bracketsOn.map((b): Vec3 => [b.x - b.sx * 34, ySl, 0]), dir: [0, -1, 0] },
      ],
      tools: ["screwdriver"],
      from: Object.fromEntries(beams.map((b) => [b.id, [0, 250, 0] as Vec3])),
    },
    {
      title: dbl ? "Hang the beams in the middle" : "Hang the beam across the middle",
      detail: dbl ? "Between each side rail and the centre rail. Two screws through each bracket." : "Between the side rails, two screws through each bracket.",
      fix: [{ kind: "screw", count: 2 * bracketsOn.length, len: 16, dia: 4, at: bracketsOn.flatMap((b) => [-1, 1].map((d): Vec3 => [b.x, ySl - 20, d * 22])), dir: [0, 0, 1] }],
      tools: ["screwdriver"],
    },
    {
      title: "Tap in the slat dowels and roll out the slats",
      detail: dbl ? "Eight dowels into the tops of the rails near the ends, then one slat roll each side of the centre rail. Skip the dowels if you use a sprung base." : "Four dowels into the tops of the side rails near the ends, then roll out the slats. Skip the dowels if you use a sprung base.",
      add: rolls.map((r) => r.id),
      fix: [
        {
          ...DOWEL_L,
          count: dbl ? 8 : 4,
          at: [...sides.map((sx): [number, number] => [sx * (xi - 10), yr1]), ...(dbl ? sides.map((sx): [number, number] => [sx * 12, ySl]) : [])].flatMap(([x, y]) => [z0 + 40, z1 - 40].map((z): Vec3 => [x, y, z])),
          dir: [0, -1, 0],
        },
      ],
      tools: ["hammer"],
      from: Object.fromEntries(rolls.map((r) => [r.id, [0, 250, -600] as Vec3])),
    },
  );
  return { parts, steps };
}

const family: Family = {
  names: ["NEIDEN"],
  recipe,
};
export default family;
