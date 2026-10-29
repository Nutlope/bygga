import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ÄSPERÖD, read from its manuals. A black steel top frame lies on its edge while the four legs are screwed into
 * its corner plates, three screws each, by hand. Stood up, those screws are tightened, four brackets clip onto the
 * legs and the lower frame is screwed onto them. Clear pads go on both frames, the smoked glass shelf slides in at
 * an angle and the glass top is laid on last. The feet come fitted and only need levelling.
 */

const BAR = 16; // flat steel bar of the frames, seen from above
const BH = 22; // its height
const LEG = 25; // round leg tube
const GLASS = 6;
const PAD = { name: "Glass pad", len: 2, dia: 12 };

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

/** A rectangular frame of flat bar with cross bars, as one part. */
function rectFrame(id: string, name: string, W: number, D: number, y: number, cross: number): CustomPart {
  const pieces: PartPiece[] = [
    { shape: "box", size: [W, BH, BAR], pos: [0, 0, -D / 2 + BAR / 2] },
    { shape: "box", size: [W, BH, BAR], pos: [0, 0, D / 2 - BAR / 2] },
    { shape: "box", size: [BAR, BH, D - 2 * BAR], pos: [-W / 2 + BAR / 2, 0, 0] },
    { shape: "box", size: [BAR, BH, D - 2 * BAR], pos: [W / 2 - BAR / 2, 0, 0] },
  ];
  for (let i = 1; i <= cross; i++) pieces.push({ shape: "box", size: [BAR, BH, D - 2 * BAR], pos: [-W / 2 + (i * W) / (cross + 1), 0, 0] });
  return { id, name, size: [W, BH, D], pos: [0, y, 0], pieces, material: "metal" };
}

/** A round frame: a ring of short bar pieces. */
function ringFrame(id: string, name: string, dia: number, y: number): CustomPart {
  const n = 20, r = dia / 2 - BAR / 2;
  const seg = 2 * r * Math.tan(Math.PI / n) + 2;
  const pieces: PartPiece[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return { shape: "box", size: [seg, BH, BAR], pos: [r * Math.sin(a), 0, r * Math.cos(a)], rot: [0, a, 0] };
  });
  return { id, name, size: [dia, BH, dia], pos: [0, y, 0], pieces, material: "metal" };
}

function table(s: ProductSpec, round: boolean): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10;
  const D = round ? W : s.size.d * 10;
  const yTop = H - GLASS - BH / 2; // top frame centre
  const yLow = 170 + BH / 2; // free height under the shelf frame
  const foot = 12;
  const legTop = H - GLASS - BH;
  // legs sit under the corner plates, just inside the frame
  const legs: Vec3[] = round
    ? [45, 135, 225, 315].map((deg) => {
        const a = (deg * Math.PI) / 180, r = W / 2 - LEG / 2 - 4;
        return [r * Math.sin(a), 0, r * Math.cos(a)];
      })
    : [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (W / 2 - LEG / 2 - 4), 0, sz * (D / 2 - LEG / 2 - 4)]);
  const top = round ? ringFrame("A", "Top frame", W, yTop) : rectFrame("A", "Top frame", W, D, yTop, 2);
  // the corner plates the legs screw up into, flush with the frame's underside
  top.pieces!.push(...legs.map((p): PartPiece => ({ shape: "box", size: [LEG + 6, 4, LEG + 6], pos: [p[0], -BH / 2 + 2, p[2]] })));
  const parts: CustomPart[] = [top];
  legs.forEach((p, i) =>
    parts.push({ id: `L${i + 1}`, name: "Leg", shape: "cyl", size: [LEG, legTop - foot, LEG], pos: [p[0], foot + (legTop - foot) / 2, p[2]], material: "metal" }),
  );
  // shelf brackets clip onto the inside of each leg; the lower frame rests on them
  const inward = (p: Vec3, by: number): Vec3 => {
    const l = Math.hypot(p[0], p[2]);
    return round ? [p[0] - (p[0] / l) * by, 0, p[2] - (p[2] / l) * by] : [p[0] - Math.sign(p[0]) * by, 0, p[2] - Math.sign(p[2]) * by];
  };
  legs.forEach((p, i) => {
    const q = inward(p, LEG / 2 + 14);
    parts.push({ id: `K${i + 1}`, name: "Shelf bracket", size: [28, 6, 28], pos: [q[0], yLow - BH / 2 - 3, q[2]], material: "metal" });
  });
  const lowW = round ? W - 2 * (LEG + 10) : W - 2 * (LEG + 10);
  const lowD = round ? lowW : D - 2 * (LEG + 10);
  const low = round ? ringFrame("B", "Shelf frame", lowW, yLow) : rectFrame("B", "Shelf frame", lowW, lowD, yLow, 1);
  // a tab at the bottom of the frame over each bracket, for its two screws
  low.pieces!.push(...legs.map((p): PartPiece => {
    const q = inward(p, LEG / 2 + 14);
    return { shape: "box", size: [26, 4, 26], pos: [q[0], -BH / 2 + 2, q[2]] };
  }));
  parts.push(low);
  const glass = (id: string, name: string, w: number, d: number, y: number): CustomPart =>
    round
      ? { id, name, shape: "cyl", size: [w, GLASS, w], pos: [0, y, 0], material: "glass" }
      : { id, name, size: [w, GLASS, d], pos: [0, y, 0], material: "glass" };
  parts.push(glass("G", "Glass shelf", lowW - 2 * BAR + 10, lowD - 2 * BAR + 10, yLow + BH / 2 + GLASS / 2 + 1));
  parts.push(glass("T", "Glass top", W - 4, D - 4, H - GLASS / 2));

  // three screws through each corner plate into the end of the leg
  const legScrews = (ids: number[]): CustomFix =>
    fx(
      "bolt",
      ids.flatMap((i) => {
        const p = legs[i];
        // spread as far as the tube allows, so the engine keeps them apart without moving them
        return [[p[0] - 12, legTop + 4, p[2] - 12], [p[0] + 12, legTop + 4, p[2] - 12], [p[0], legTop + 4, p[2] + 12]] as Vec3[];
      }),
      [0, -1, 0],
      { len: 12, dia: 6, on: "A", to: ids.map((i) => `L${i + 1}`) },
    );
  // the two legs along the edge on the floor go in first, then the frame is turned for the other two
  const firstPair = [0, 1], secondPair = [2, 3];
  const shelfScrews = fx(
    "screw",
    legs.flatMap((p) => {
      const q = inward(p, LEG / 2 + 14);
      return [[q[0] - 12, yLow - BH / 2 + 4, q[2]], [q[0] + 12, yLow - BH / 2 + 4, q[2]]] as Vec3[];
    }),
    [0, -1, 0],
    { len: 10, dia: 5, on: "B", to: ["K1", "K2", "K3", "K4"] },
  );
  const padsOn = (pts: Vec3[], on: string): CustomFix => fx("glide", pts, [0, -1, 0], { ...PAD, on });
  const yt = H - GLASS, yl = yLow + BH / 2;
  const ringPts = (dia: number, y: number): Vec3[] =>
    [0, 90, 180, 270].map((deg) => {
      const a = ((deg + 45) * Math.PI) / 180, r = dia / 2 - BAR / 2;
      return [r * Math.sin(a), y, r * Math.cos(a)];
    });
  const rectPts = (w: number, d: number, y: number, cross: number, extra: number): Vec3[] => {
    const x = w / 2 - BAR / 2, z = d / 2 - BAR / 2;
    const pts: Vec3[] = [[-x, y, -z], [x, y, -z], [-x, y, z], [x, y, z]];
    for (let i = 1; i <= cross; i++) {
      const cx = -w / 2 + (i * w) / (cross + 1);
      pts.push([cx, y, -z + 40], [cx, y, z - 40]);
    }
    if (extra >= 2) pts.push([0, y, -z], [0, y, z]);
    if (extra % 2) pts.push([0, y, 0]);
    return pts;
  };
  const pads = round
    ? [padsOn(ringPts(W, yt), "A"), padsOn(ringPts(lowW, yl), "B")]
    : [padsOn(rectPts(W, D, yt, 2, 2), "A"), padsOn(rectPts(lowW, lowD, yl, 1, 1), "B")];

  const L = (ids: number[]) => ids.map((i) => `L${i + 1}`);
  const steps: CustomStep[] = [
    {
      title: "Screw two legs into the top frame",
      detail: `Stand the frame on its edge on a rug, with the corner plates facing you${round ? "" : " and the plates' holes the right way round"}. Three screws in each leg, by hand only for now.`,
      add: ["A", ...L(firstPair)],
      fix: [legScrews(firstPair)],
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor", "hand"],
    },
    {
      title: "Screw in the other two legs",
      detail: "The same way, three screws each, still only by hand.",
      add: L(secondPair),
      fix: [legScrews(secondPair)],
      tools: ["allen"],
      warnings: ["hand"],
    },
    {
      title: "Stand it up and tighten the leg screws",
      detail: "All twelve, with the Allen key, once the frame stands level on all four legs.",
      pose: "+y",
      tools: ["allen"],
    },
    {
      title: "Clip a shelf bracket onto each leg",
      detail: "Hook the bracket into the slot on the inside of the leg, then press it down until it sits flat.",
      add: ["K1", "K2", "K3", "K4"],
    },
    {
      title: "Lay the shelf frame on the brackets",
      detail: round ? "Turn it so its holes line up over the brackets." : "Tilt it in between the legs, then lower it onto the brackets.",
      add: ["B"],
      fix: [shelfScrews],
      warnings: ["hand"],
    },
    { title: "Tighten the shelf screws", detail: "Two in each bracket. Stop when the head is flush, so it won't scratch the glass.", tools: ["screwdriver"] },
    { title: "Stick the clear pads onto both frames", detail: "Peel them off the sheets and press them on where the glass will rest.", fix: pads },
    {
      title: "Slide in the glass shelf",
      detail: round ? "Hold it by the edges and lower it onto the pads of the shelf frame." : "Tilt it in from one end between the legs, then lower it onto the pads.",
      add: ["G"],
      warnings: ["hand"],
    },
    { title: "Lay the glass top on", detail: "Lower it flat onto the pads, holding it by the edges.", add: ["T"], warnings: ["hand"] },
    { title: "Level the feet", detail: "Turn the foot under each leg until the table stands steady and doesn't rock." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ÄSPERÖD", "ASPEROD"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    if (/console/.test(v)) return table(s, false);
    if (/side table/.test(v)) return table(s, true);
    return null;
  },
};
export default family;
