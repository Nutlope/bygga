import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VATTENKAR, from IKEA's two manuals. The desktop shelf is two square steel posts with a cap pushed into the top and
 * a foot insert into the bottom; a desk clamp is screwed onto the back of each (two screws, into the upper or lower
 * holes by the desk's thickness), and two steel trays are screwed between the posts, two screws and washers through
 * each end. The laptop/monitor stand is two bent birch pieces, the shelf nested under the top, held by four bolts
 * through the feet with an Allen key.
 */

function deskShelf(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = 360; // IKEA's height, clamps included
  const P = 20; // square post
  const clampH = 130, foot = 60; // the clamp reaches below the post, which stands on the desk
  const postH = H - foot;
  const tw = W - 2 * P, td = D, th = 40, t = 2;
  const pz = -D / 2 + P / 2; // posts at the back, the "against a wall" position
  const tray: PartPiece[] = [
    { shape: "box", size: [tw, t, td], pos: [0, -th / 2 + t / 2, 0] },
    { shape: "box", size: [tw, th, t], pos: [0, 0, -td / 2 + t / 2] },
    { shape: "box", size: [tw, th, t], pos: [0, 0, td / 2 - t / 2] },
    { shape: "box", size: [t, th, td], pos: [-tw / 2 + t / 2, 0, 0] },
    { shape: "box", size: [t, th, td], pos: [tw / 2 - t / 2, 0, 0] },
  ];
  const clamp: PartPiece[] = [
    { shape: "box", size: [P, clampH, 4], pos: [0, 0, 0] },
    { shape: "box", size: [P, 4, 40], pos: [0, -clampH / 2 + 22, 18] },
    { shape: "cyl", size: [8, 40, 8], pos: [0, -clampH / 2 + 22, 30] },
    { shape: "cyl", size: [30, 6, 30], pos: [0, -clampH / 2 + 3, 30] },
  ];
  const yLow = foot + 150, yTop = H - th / 2;
  const parts: CustomPart[] = [];
  for (const [i, sx] of [-1, 1].entries()) {
    const x = sx * (W / 2 - P / 2);
    parts.push({ id: `P${i}`, name: "Post", size: [P, postH, P], pos: [x, foot + postH / 2, pz], material: "metal" });
    parts.push({ id: `C${i}`, name: "Desk clamp", size: [P, clampH, 44], pos: [x, clampH / 2, pz - P / 2 - 2], pieces: clamp, material: "metal" });
  }
  parts.push({ id: "T0", name: "Tray", size: [tw, th, td], pos: [0, yLow, 0], pieces: tray, material: "metal" });
  parts.push({ id: "T1", name: "Tray", size: [tw, th, td], pos: [0, yTop, 0], pieces: tray, material: "metal" });
  const sides = [-1, 1];
  const trayScrews = (y: number): Vec3[] => sides.flatMap((sx) => [y - 12, y + 12].map((yy) => [sx * (tw / 2 - t), yy, pz] as Vec3));
  return {
    parts,
    steps: [
      {
        title: "Push a cap into the top of each post",
        detail: "Press it in until its rim sits on the post.",
        add: ["P0", "P1"],
        fix: [{ kind: "cap", count: 2, at: sides.map((sx) => [sx * (W / 2 - P / 2), H, pz] as Vec3), dir: [0, -1, 0] }],
        warnings: ["hand"],
      },
      {
        title: "Push a foot into the bottom of each post",
        detail: "Its toe points to the front, where the desk will be.",
        fix: [{ kind: "foot", name: "Foot insert", count: 2, at: sides.map((sx) => [sx * (W / 2 - P / 2), foot, pz] as Vec3), dir: [0, 1, 0] }],
        warnings: ["hand"],
      },
      {
        title: "Screw a clamp onto each post",
        detail: "Two screws each. Use the upper holes for a desk up to 25 mm thick, the lower ones for 25 to 50 mm.",
        add: ["C0", "C1"],
        fix: [{ kind: "screw", count: 4, len: 10, dia: 4, dir: [0, 0, 1], at: sides.flatMap((sx) => [foot + 25, foot + 55].map((y) => [sx * (W / 2 - P / 2), y, pz - P / 2 - 4] as Vec3)) }],
        tools: ["screwdriver"],
      },
      {
        title: "Screw the trays between the posts",
        detail: "From inside each tray, a washer on each screw, two screws at each end. Pick the holes for where the posts should sit.",
        add: ["T0", "T1"],
        fix: (["washer", "screw"] as const).flatMap((kind) =>
          sides.map((sx) => ({
            kind,
            count: 4,
            ...(kind === "screw" ? { len: 12, dia: 4 } : {}),
            at: [...trayScrews(yLow), ...trayScrews(yTop)].filter((p) => Math.sign(p[0]) === sx),
            dir: [sx, 0, 0] as Vec3,
          })),
        ),
        tools: ["screwdriver"],
      },
      {
        title: "Clamp it to the back of the desk",
        detail: "Hook the clamps under the desk top and turn the knobs by hand until the shelf sits firm.",
        warnings: ["hand"],
      },
    ],
  };
}

function stand(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = 140; // IKEA's height
  const t = 10;
  const shelfY = 80;
  const outer: PartPiece[] = [
    { shape: "box", size: [W, t, D], pos: [0, H / 2 - t / 2, 0] },
    { shape: "box", size: [t, H - t, D], pos: [-W / 2 + t / 2, -t / 2, 0] },
    { shape: "box", size: [t, H - t, D], pos: [W / 2 - t / 2, -t / 2, 0] },
  ];
  const iw = W - 2 * t;
  const inner: PartPiece[] = [
    { shape: "box", size: [iw, t, D], pos: [0, shelfY / 2 - t / 2, 0] },
    { shape: "box", size: [t, shelfY - t, D], pos: [-iw / 2 + t / 2, -t / 2, 0] },
    { shape: "box", size: [t, shelfY - t, D], pos: [iw / 2 - t / 2, -t / 2, 0] },
  ];
  const bolts = (sx: number): Vec3[] => [-1, 1].map((sz) => [sx * (W / 2), 25, sz * (D / 2 - 30)] as Vec3);
  return {
    parts: [
      { id: "A", name: "Top", size: [W, H, D], pos: [0, H / 2, 0], pieces: outer, material: "wood" },
      { id: "B", name: "Shelf", size: [iw, shelfY, D], pos: [0, shelfY / 2, 0], pieces: inner, material: "wood" },
    ],
    steps: [
      { title: "Stand the top on its feet", detail: "On a soft surface, so the edges don't get marked.", add: ["A"], warnings: ["floor"] },
      { title: "Slide the shelf in under the top", detail: "Its feet go inside the top's feet, holes lined up.", add: ["B"], from: { B: [0, 0, 300] } },
      {
        title: "Bolt the feet together",
        detail: "Four bolts, two at each end, with the Allen key. Tighten them all once every bolt is in.",
        fix: [-1, 1].map((sx) => ({ kind: "bolt" as const, count: 2, len: 12, dia: 6, at: bolts(sx), dir: [-sx, 0, 0] as Vec3, on: "A", mate: "B" })),
        tools: ["allen"],
      },
    ],
  };
}

const family: Family = {
  names: ["VATTENKAR"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/desktop-shelf/.test(slug) || /desktop shelf/i.test(s.variant)) return deskShelf(s);
    if (/monitor-stand|laptop/.test(slug) || /stand/i.test(s.variant)) return stand(s);
    return null;
  },
};
export default family;
