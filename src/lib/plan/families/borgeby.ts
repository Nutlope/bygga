import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * BORGEBY, read from the side table's manual. The round top lies upside down on a rug and the four bent legs are
 * screwed to it, two screws each. Laid on its side, the storage bowl slides in between the legs and is screwed
 * through the two lower legs, then rolled over for the other two. Every screw is tightened last. The coffee table
 * is sold assembled (its page has care advice but no assembly instructions), so its guide only unpacks it.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

/** The top, the four bent legs and the storage bowl between them, as they stand finished. */
function tableParts(s: ProductSpec, bh: number) {
  const W = s.size.w * 10, H = s.size.h * 10;
  const tt = 20; // top
  const lw = Math.round(Math.max(80, W * 0.13)), lt = 16; // leg strip: width, thickness (wide bent ply, as photographed)
  const ret = 90; // the leg's return under the top
  const free = 60; // under the bowl
  const r = W / 2 - 40; // leg centre line from the middle
  const yU = H - tt;
  const bowlR = r - lt / 2;
  const parts: CustomPart[] = [{ id: "T", name: "Table top", shape: "cyl", size: [W, tt, W], pos: [0, H - tt / 2, 0], material: "wood" }];
  // legs on the four axes: +x, -x, +z, -z
  const axes: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  axes.forEach(([ax, , az], i) => {
    const along = ax !== 0;
    const leg: Vec3 = [ax * r, yU / 2, az * r];
    const vert: Vec3 = along ? [lt, yU, lw] : [lw, yU, lt];
    const rr = r - ret / 2 + lt / 2; // the return, under the top
    const retSize: Vec3 = along ? [ret, lt, lw] : [lw, lt, ret];
    const retPos: Vec3 = [ax * rr - leg[0], yU - lt / 2 - leg[1], az * rr - leg[2]];
    const lo = (k: 0 | 2) => Math.min(-vert[k] / 2, retPos[k] - retSize[k] / 2);
    const hi = (k: 0 | 2) => Math.max(vert[k] / 2, retPos[k] + retSize[k] / 2);
    const cx = (lo(0) + hi(0)) / 2, cz = (lo(2) + hi(2)) / 2;
    parts.push({
      id: `L${i + 1}`,
      name: "Leg",
      size: [hi(0) - lo(0), yU, hi(2) - lo(2)],
      pos: [leg[0] + cx, leg[1], leg[2] + cz],
      material: "wood",
      pieces: [
        { shape: "box", size: vert, pos: [-cx, 0, -cz] },
        { shape: "box", size: retSize, pos: [retPos[0] - cx, retPos[1], retPos[2] - cz] },
      ],
    });
  });
  parts.push({ id: "B", name: "Storage bowl", shape: "cyl", size: [2 * bowlR, bh, 2 * bowlR], pos: [0, free + bh / 2, 0], material: "wood" });
  return { parts, axes, r, yU, ret, lt, free, bh };
}

function sideTable(s: ProductSpec): CustomParams {
  const { parts, axes, r, yU, ret, lt, free, bh } = tableParts(s, 140);

  const topScrews: Vec3[] = axes.flatMap(([ax, , az]) => {
    const rr = r - ret / 2 + 10;
    return [-1, 1].map((k) => [ax * rr + (ax ? 0 : k * 15), yU - lt, az * rr + (az ? 0 : k * 15)] as Vec3);
  });
  const bowlScrew = (i: number): CustomFix => {
    const [ax, , az] = axes[i];
    return fx("bolt", [[ax * (r + lt / 2), free + bh / 2, az * (r + lt / 2)]], [-ax, 0, -az], { on: `L${i + 1}`, mate: "B", len: 16, dia: 6 });
  };
  const steps: CustomStep[] = [
    {
      title: "Screw the legs to the underside of the top",
      detail: "Lay the top upside down on a rug. Two screws through each leg's foot, just snug for now.",
      add: ["T", "L1", "L2", "L3", "L4"],
      fix: [fx("bolt", topScrews, [0, 1, 0], { len: 16, dia: 6, on: "T" })],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Lay it on its side and slide in the bowl",
      detail: "Push the bowl in between the legs until its holes line up with the holes in the legs.",
      add: ["B"],
      pose: "+z",
    },
    {
      title: "Screw the bowl to the legs underneath",
      detail: "One screw through each of the two legs you can reach, just snug.",
      fix: [bowlScrew(3), bowlScrew(0)],
      tools: ["allen"],
    },
    {
      title: "Roll it over and screw the other two",
      detail: "Turn the table onto its other side and fit the last two screws.",
      fix: [bowlScrew(2), bowlScrew(1)],
      tools: ["allen"],
      pose: "-z",
    },
    { title: "Tighten all the screws", detail: "All twelve, with the Allen key, then stand the table up.", tools: ["allen"], pose: "+y" },
  ];
  return { parts, steps };
}

/** The coffee table: IKEA's page has no assembly instructions, only care advice, so it comes put together. */
function coffeeTable(s: ProductSpec): CustomParams {
  const { parts } = tableParts(s, 160);
  const ids = parts.map((p) => p.id);
  return {
    parts,
    steps: [
      {
        title: "Lift the table out of its box",
        detail: "It comes assembled. Take off all the packaging and lift it by the top, not by the bowl.",
        add: ids,
        from: Object.fromEntries(ids.map((id) => [id, [0, 400, 0] as Vec3])),
      },
      { title: "Check it over", detail: "Look over the top, the legs and the bowl for any damage from the journey before you use it." },
      { title: "Set it down where it will stand", detail: "On a flat floor, so all four legs touch. Wipe it with a damp cloth, then a dry one." },
    ],
  };
}

const family: Family = {
  names: ["BORGEBY"],
  recipe(s) {
    if (/side table/i.test(s.variant) || /side-table/.test(s.slug ?? "")) return sideTable(s);
    if (/coffee/i.test(s.variant) || /coffee-table/.test(s.slug ?? "")) return coffeeTable(s);
    return null;
  },
};
export default family;
