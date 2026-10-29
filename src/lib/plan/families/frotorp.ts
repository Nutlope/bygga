import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FRÖTORP, read from the coffee and side tables' manuals (the same build, three legs or four). The bottom ring lies
 * on a rug and the bent steel legs are pushed into the holes in its side, two screws from above hold each one, loose
 * for now. The top ring goes onto the legs' tabs and takes two screws a leg, fully tightened, then the bottom ring's
 * screws are tightened. Self-adhesive bumpers go on the bottom ring's ledge and the marble-effect shelf is laid in;
 * adhesive strips go on the leg tabs (and round the ring on the coffee table) and the glass top is lowered on, by two
 * people for the coffee table, and pressed down.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

/** A ring of radius r (to the middle of its wall), as boxes round a circle. */
function ring(r: number, wall: number, h: number, n = 32): PartPiece[] {
  const len = 2 * (r + wall / 2) * Math.sin(Math.PI / n) + 1;
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * (i + 0.5)) / n;
    return { shape: "box", size: [len, h, wall], pos: [r * Math.cos(t), 0, r * Math.sin(t)], rot: [0, -t - Math.PI / 2, 0] };
  });
}

function table(s: ProductSpec): CustomParams {
  const coffee = /coffee/.test(s.slug ?? s.variant.toLowerCase());
  // IKEA: coffee table 88 across and 35 high, side table 48 across and 45 high
  const Dm = Math.round(s.size.w * 10) || (coffee ? 880 : 480), H = Math.round(s.size.h * 10) || (coffee ? 350 : 450);
  const R = Dm / 2;
  const n = coffee ? 3 : 4;
  const wall = 24;
  const topH = coffee ? 70 : 60, lowH = coffee ? 50 : 60;
  const rLow = R - (coffee ? 60 : 50); // outer edge of the bottom ring
  const yLow = 15; // the bottom ring stands just clear of the floor
  const rLeg = R - wall - 10;
  const yStub = yLow + lowH / 2;
  const yTopRing = H - topH;
  const L = coffee ? 20 : 22;
  const ang = (i: number) => Math.PI / 2 + (2 * Math.PI * i) / n + (coffee ? 0 : Math.PI / 4);
  const polar = (r: number, y: number, i: number): Vec3 => [Math.round(r * Math.cos(ang(i))), y, Math.round(r * Math.sin(ang(i)))];

  const legPieces = (i: number, c: Vec3): PartPiece[] => {
    const a = ang(i);
    const rel = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const stubLen = rLeg - rLow + 20;
    const mid = (rLeg + rLow - 20) / 2;
    return [
      { shape: "cyl", size: [L, yTopRing - yStub, L], pos: rel(polar(rLeg, (yTopRing + yStub) / 2, i)) },
      { shape: "cyl", size: [L, stubLen, L], pos: rel(polar(mid, yStub, i)), rot: [0, Math.PI - a, Math.PI / 2] },
      { shape: "box", size: [L + 10, yStub, L + 10], pos: rel(polar(rLeg, yStub / 2, i)), rot: [0, -a, 0] },
      { shape: "box", size: [36, 4, 50], pos: rel(polar(rLeg - 10, yTopRing - 2, i)), rot: [0, -a, 0] },
    ];
  };
  const parts: CustomPart[] = [
    { id: "B", name: "Bottom ring", size: [2 * rLow, lowH, 2 * rLow], pos: [0, yLow + lowH / 2, 0], pieces: ring(rLow - wall / 2, wall, lowH), material: "board" },
  ];
  const legs = Array.from({ length: n }, (_, i) => `L${i}`);
  legs.forEach((id, i) => {
    const xs = [rLeg + L / 2 + 5, rLow - 20].map((r) => polar(r, 0, i));
    const lo = [Math.min(xs[0][0], xs[1][0]) - L, 0, Math.min(xs[0][2], xs[1][2]) - L];
    const hi = [Math.max(xs[0][0], xs[1][0]) + L, yTopRing, Math.max(xs[0][2], xs[1][2]) + L];
    const pos: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    parts.push({ id, name: "Leg", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos, pieces: legPieces(i, pos), material: "metal" });
  });
  parts.push(
    { id: "T", name: "Top ring", size: [Dm, topH, Dm], pos: [0, yTopRing + topH / 2, 0], pieces: ring(R - wall / 2, wall, topH, 40), material: "board" },
    { id: "S", name: "Shelf", size: [2 * (rLow - wall) + 4, 10, 2 * (rLow - wall) + 4], pos: [0, yLow + lowH - 12, 0], shape: "cyl", material: "board" },
    { id: "G", name: "Glass top", size: [Dm - 2 * wall + 6, 6, Dm - 2 * wall + 6], pos: [0, H - 5, 0], shape: "cyl", material: "glass" },
  );

  // two screws a leg, side by side, going down
  const pair = (r: number, y: number, i: number): Vec3[] => {
    const a = ang(i), t: Vec3 = [-Math.sin(a), 0, Math.cos(a)];
    const p = polar(r, y, i);
    return [-1, 1].map((k) => [Math.round(p[0] + k * 12 * t[0]), y, Math.round(p[2] + k * 12 * t[2])] as Vec3);
  };
  const lowScrews = legs.map((id, i) => at("screw", pair(rLow - wall / 2, yLow + lowH, i), [0, -1, 0], "B", id, { len: 16, dia: 6 }));
  const topScrews = legs.map((id, i) => at("screw", pair(rLeg - 10, yTopRing + 10, i), [0, -1, 0], "T", id, { len: 12, dia: 6 }));
  const bumpers = Array.from({ length: n * 2 }, (_, k) => {
    const t = (2 * Math.PI * (k + 0.5)) / (n * 2);
    return [Math.round((rLow - wall - 8) * Math.cos(t)), yLow + lowH - 17, Math.round((rLow - wall - 8) * Math.sin(t))] as Vec3;
  });
  const tabStrips = legs.map((_, i) => polar(rLeg - 10, yTopRing, i));
  const ringStrips = coffee
    ? Array.from({ length: 6 }, (_, k) => {
        const t = (2 * Math.PI * (k + 0.5)) / 6;
        return [Math.round((R - wall) * Math.cos(t)), H - 8, Math.round((R - wall) * Math.sin(t))] as Vec3;
      })
    : [];

  const steps: CustomStep[] = [
    {
      title: "Push the legs into the bottom ring",
      detail: `Lay the ring on a rug. The short bent end of each leg goes into a hole in the side of the ring, ${n} legs in all, tabs at the top.`,
      add: ["B", ...legs],
      warnings: ["floor"],
    },
    {
      title: "Screw each leg to the ring, loosely",
      detail: "Two of the longer screws from above into each leg end. Turn them in but don't tighten yet, so the top ring will fit.",
      fix: lowScrews,
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Screw the top ring onto the legs",
      detail: `Lower it onto the tabs at the top of the legs, holes over holes. Two of the shorter screws a leg, tightened all the way until the heads sit flush.`,
      add: ["T"],
      fix: topScrews,
      tools: ["allen"],
    },
    {
      title: "Tighten the bottom screws",
      detail: "Go back to the screws in the bottom ring and tighten every one until its head sits flush.",
      tools: ["allen"],
      kind: "bolts",
    },
    {
      title: "Stick the bumpers on the bottom ring",
      detail: "Peel them off the sheet and press them onto the ledge inside the ring, spread evenly.",
      fix: [at("glide", bumpers, [0, -1, 0], "B", undefined, { name: "Bumper", len: 3, dia: 10 })],
    },
    { title: "Lay the shelf in the bottom ring", detail: "Marble side up. It rests on the bumpers.", add: ["S"], from: { S: [0, 260, 0] } },
    {
      title: "Stick on the adhesive strips",
      detail: coffee ? "Peel the backing off each strip: six round the ledge of the top ring and one on each leg tab." : "Peel the backing off each strip and press one onto each leg tab.",
      fix: [at("glide", [...ringStrips, ...tabStrips], [0, -1, 0], "T", undefined, { name: "Adhesive strip", len: 2, dia: 30 })],
    },
    {
      title: "Lower the glass top on",
      detail: coffee ? "Lift it together and lay it into the top ring, smooth side up, then press it down all round so the strips hold." : "Lay it into the top ring, smooth side up, and press it down so the strips hold.",
      add: ["G"],
      from: { G: [0, 300, 0] },
      people: coffee ? 2 : 1,
      warnings: coffee ? ["two"] : undefined,
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FRÖTORP", "FROTORP"],
  recipe(s) {
    if (/frotorp-(coffee|side)-table/.test(s.slug ?? "")) return table(s);
    return null;
  },
};
export default family;
