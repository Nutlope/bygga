import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * FAGERBACKEN armchair, read from the frame's manual. The covers go on first: pulled down over the shell (back and
 * arms in one) and zipped or hooked underneath, then the seat cushion's. Each leg gets two dowels beside its
 * threaded stud and screws by hand into the upside-down wooden base. Stood up, the base takes four mounting studs on
 * top; upside down again, two back bolts with washers go in part way, the base hooks into the upturned shell, four
 * more bolts with washers join them, the back two are tightened, felt pads go on the feet and the cushion drops in.
 * IKEA's page gives no measurements, so the guide's own size is used.
 */

function armchair(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 750, H = Math.round(s.size.h * 10) || 900, D = Math.round(s.size.d * 10) || 800;
  const legH = 150, baseT = 40, yB = legH + baseT; // underside of the shell
  const arm = 140, armTop = 600, back = 180, seatTop = 440;
  const bw = W - 40, bd = D - 40;
  const lx = bw / 2 - 50, lzF = bd / 2 - 60, lzB = -bd / 2 + 60;

  const parts: CustomPart[] = [
    {
      id: "SH",
      name: "Back and arms",
      size: [W, H - yB, D],
      pos: [0, (H + yB) / 2, 0],
      material: "soft",
      pieces: [
        // the back runs full width to the top (its sides are the wings); the arms are rounded on top
        { shape: "box", size: [W, H - yB, back], pos: [0, 0, -D / 2 + back / 2] },
        ...[-1, 1].flatMap((sx) => [
          { shape: "box" as const, size: [arm, armTop - yB - arm / 2, D - back] as Vec3, pos: [sx * (W / 2 - arm / 2), (armTop - arm / 2 + yB) / 2 - (H + yB) / 2, back / 2] as Vec3 },
          { shape: "cyl" as const, size: [arm, D - back, arm] as Vec3, pos: [sx * (W / 2 - arm / 2), armTop - arm / 2 - (H + yB) / 2, back / 2] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 },
        ]),
        // a soft front panel under the seat cushion
        { shape: "box", size: [W - 2 * arm, 110, 60], pos: [0, yB + 55 - (H + yB) / 2, D / 2 - 30] },
      ],
    },
    { id: "BA", name: "Base", size: [bw, baseT, bd], pos: [0, legH + baseT / 2, 0], material: "wood" },
    // the cushion sits on the deck, level with the top of the front panel, between the arms
    { id: "CU", name: "Seat cushion", size: [W - 2 * arm, seatTop - yB - 110, D - back - 40], pos: [0, (seatTop + yB + 110) / 2, back / 2 - 20], material: "soft" },
  ];
  const legs: [string, number, number][] = [["L1", -1, lzF], ["L2", 1, lzF], ["L3", -1, lzB], ["L4", 1, lzB]];
  for (const [id, sx, z] of legs) {
    const front = z > 0;
    parts.push({ id, name: front ? "Front leg" : "Back leg", size: [45, legH + 4, 45], pos: [sx * (lx + 8), legH / 2, z + (front ? 10 : -14)], rot: [front ? 0.12 : -0.18, 0, sx * -0.1], material: "wood" });
  }

  const legIds = legs.map(([id]) => id);
  const legAt = (y: number): Vec3[] => legs.map(([, sx, z]): Vec3 => [sx * lx, y, z]);
  const backAt: Vec3[] = [[-200, legH, -D / 2 + back / 2], [200, legH, -D / 2 + back / 2]];
  const sideAt: Vec3[] = [-1, 1].flatMap((sx) => [[sx * (W / 2 - arm / 2), legH, -60], [sx * (W / 2 - arm / 2), legH, D / 2 - 120]] as Vec3[]);
  const washers = (at: Vec3[]): CustomFix => ({ kind: "washer", count: at.length, len: 2, dia: 18, at, dir: [0, 1, 0], on: "BA" });
  const bolts = (at: Vec3[]): CustomFix => ({ kind: "bolt", count: at.length, len: 70, dia: 6, at, dir: [0, 1, 0], on: "BA", mate: "SH" });

  return {
    parts,
    steps: [
      {
        title: "Pull the cover over the back and arms",
        detail: "Start at the top of the back and work it down over both arms, seams on the edges.",
        wait: ["SH"],
      },
      { title: "Close the cover underneath", detail: "Zip it up at the back and hook the flaps under the arms, all the way round." },
      {
        title: "Put the cover on the seat cushion",
        detail: "Fold the cushion so it slips in, then fit the corners and close the zip underneath.",
        wait: ["CU"],
      },
      {
        title: "Tap two dowels into the top of each leg",
        detail: "They go into the two small holes beside the threaded stud.",
        fix: legs.map(([id, sx, z]): CustomFix => ({ kind: "dowel", count: 2, at: [[sx * lx - 12, legH, z], [sx * lx + 12, legH, z]], dir: [0, -1, 0], on: id })),
        wait: legIds,
        tools: ["hammer"],
      },
      {
        title: "Screw the legs into the base",
        detail: "Lay the base upside down on a rug. Each leg has its own corner, marked on the base; turn them in by hand until the dowels sit flush.",
        add: ["BA", ...legIds],
        pose: "-y",
        warnings: ["floor"],
        from: Object.fromEntries(legIds.map((id) => [id, [0, -220, 0] as Vec3])),
      },
      {
        title: "Screw four mounting studs into the top",
        detail: "Turn the base over. The studs go into the four holes along the sides, tight with the Allen key.",
        fix: [{ kind: "stud", name: "Mounting stud", count: 4, len: 14, dia: 20, at: sideAt.map(([x, , z]): Vec3 => [x, yB, z]), dir: [0, -1, 0], on: "BA" }],
        tools: ["allen"],
        pose: "+y",
      },
      {
        title: "Start two bolts in the back of the base",
        detail: "Turn the base upside down again. A washer on each bolt, turned in by hand a few turns only.",
        fix: [{ ...bolts(backAt), mate: undefined }, washers(backAt)],
        pose: "-y",
      },
      {
        title: "Hook the base into the shell",
        detail: "Lay the shell upside down on the rug. Set the base in so the studs drop into the slots in the shell, then turn the two back bolts a little by hand.",
        add: ["SH"],
        from: { SH: [0, -500, 0] },
        warnings: ["floor"],
      },
      {
        title: "Bolt the base to the arms",
        detail: "Four more bolts, each with a washer, through the base into the arms.",
        fix: [bolts(sideAt), washers(sideAt)],
        tools: ["allen"],
      },
      { title: "Tighten the two back bolts", detail: "Now turn the first two bolts tight with the Allen key.", tools: ["allen"] },
      {
        title: "Stick a felt pad under each leg",
        detail: "Press them on firmly, centred on the feet.",
        fix: [{ kind: "glide", name: "Felt pad", count: 4, len: 3, dia: 40, at: legAt(0), dir: [0, 1, 0], to: legIds }],
      },
      {
        title: "Turn the chair over and drop in the cushion",
        detail: "Stand it on its feet. Push the cushion in between the arms and press the two hook-and-loop strips together at the back.",
        add: ["CU"],
        pose: "+y",
      },
    ],
  };
}

const family: Family = {
  names: ["FAGERBACKEN"],
  recipe(s) {
    if (/^fagerbacken-armchair/.test(s.slug ?? "")) return armchair(s);
    return null;
  },
};
export default family;
