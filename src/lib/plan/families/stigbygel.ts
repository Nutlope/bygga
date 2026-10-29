import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STIGBYGEL, read from the swivel chair's manual. The base is built upside down on a rug: four legs pushed into the
 * hub and locked with four grub screws, the footrest ring screwed to the legs with four bolts, then all eight given a
 * last turn. It is turned over and the gas lift dropped in. The woven seat shell lies upside down on a table for the
 * plate (four bolts), and each armrest goes on with its back end in a socket on the shell (one small screw) and its
 * front end under the seat (two bolts). Last, the seat is pressed onto the gas lift.
 */

const TUBE = 24;

/** A round tube from a to b, as a piece of a part centred at c. */
function seg(a: Vec3, b: Vec3, c: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const h = Math.hypot(d[0], d[2]);
  const rot: Vec3 = [0, h ? Math.atan2(-d[2], d[0]) : 0, -Math.atan2(h, d[1])];
  return { shape: "cyl", size: [dia, Math.hypot(...d), dia], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot };
}
/** A part made of tubes through the given points, its box around them. */
function tubes(id: string, name: string, paths: Vec3[][], material: CustomPart["material"], dia = TUBE): CustomPart {
  const pts = paths.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - dia / 2) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + dia / 2) as Vec3;
  const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const pieces = paths.flatMap((p) => p.slice(1).map((q, i) => seg(p[i], q, c, dia)));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, material, pieces };
}

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 65 wide, 70 deep, 103 high, seat 52 x 45 at 47 to 57
  const W = Math.round(s.size.w * 10) || 650, H = Math.round(s.size.h * 10) || 1030;
  const yHub = 400, rTop = 42, rFoot = 300;
  const yS = 470, yM = 425; // top of the seat at the front, underside of the plate
  const legR = (y: number) => rTop + ((rFoot - rTop) * (yHub - 10 - y)) / (yHub - 10 - 40);
  const az = [1, 3, 5, 7].map((k) => (k * Math.PI) / 4);
  const at = (a: number, r: number, y: number): Vec3 => [r * Math.sin(a), y, r * Math.cos(a)];
  const legs = az.map((a, i) => tubes(`L${i + 1}`, "Leg", [[at(a, rTop, yHub - 10), at(a, rFoot, 40), at(a, rFoot + 8, 0)]], "metal"));
  const yRing = 170, rRing = legR(yRing) - TUBE;
  const ringPts = Array.from({ length: 13 }, (_, k) => at((k * Math.PI) / 6, rRing, yRing));
  const xa = W / 2 - 30;
  const parts: CustomPart[] = [
    { id: "HB", name: "Hub", shape: "cyl", size: [80, 130, 80], pos: [0, yHub - 55, 0], material: "metal" },
    ...legs,
    tubes("RG", "Footrest ring", [ringPts], "metal", 20),
    { id: "G", name: "Gas lift", shape: "cyl", size: [50, yM - yHub + 120, 50], pos: [0, (yM + yHub - 120) / 2, 0], material: "metal" },
    { id: "M", name: "Seat plate", size: [200, 25, 220], pos: [0, yM + 12, 0], material: "metal" },
    {
      id: "S",
      name: "Seat shell",
      size: [520, H - yM - 25, 520],
      pos: [0, (H + yM + 25) / 2, -30],
      material: "wood",
      pieces: [
        { shape: "box", size: [500, 22, 460], pos: [0, yS - 11 - (H + yM + 25) / 2, 30 + 20] },
        { shape: "box", size: [480, H - yS + 20, 22], pos: [0, (H + yS) / 2 - 10 - (H + yM + 25) / 2, -230 + 30], rot: [-0.14, 0, 0] },
      ],
    },
    ...[-1, 1].map((sx, i) =>
      tubes(`A${i + 1}`, "Armrest", [[[sx * 240, 660, -190], [sx * xa, 680, -170], [sx * xa, 680, 140], [sx * xa, yS - 10, 160], [sx * 160, yS - 36, 160]]], "wood", 28),
    ),
  ];
  const base = ["HB", "L1", "L2", "L3", "L4", "RG"];
  const aside: Record<string, Vec3> = Object.fromEntries([...base, "G"].map((id) => [id, [500, 0, 0] as Vec3]));
  const grubs: CustomFix = { kind: "screw", name: "Grub screw", count: 4, len: 10, dia: 8, at: az.map((a) => at(a, 40, yHub - 30)), dir: [0, -1, 0], on: "HB" };
  const ringBolts: CustomFix[] = az.map((a, i) => ({ kind: "bolt", count: 1, len: 16, dia: 6, at: [at(a, rRing + TUBE / 2, yRing)], dir: [-Math.sin(a), 0, -Math.cos(a)], on: "RG", mate: `L${i + 1}` }));
  const up: Vec3 = [0, 1, 0];
  return {
    parts,
    steps: [
      {
        title: "Push the legs into the hub",
        detail: "Upside down on a rug. Each leg slides into its socket in the hub.",
        wait: base,
        from: aside,
        pose: "-y",
        warnings: ["floor"],
      },
      { title: "Lock the legs with grub screws", detail: "One in each socket, turned in with the small Allen key. The screw sits below the surface.", fix: [grubs], tools: ["allen"] },
      { title: "Screw the footrest ring to the legs", detail: "Lay it on the legs and fit a bolt into each one, by hand first.", fix: ringBolts, tools: ["allen"] },
      { title: "Tighten all eight", detail: "The four grub screws and the four ring bolts, firmly." },
      { title: "Stand the gas lift in the base", detail: "Turn the base over and drop the gas lift into the hub, narrow end up.", wait: ["G"], from: aside, pose: "+y" },
      {
        title: "Bolt the plate under the seat",
        detail: "Lay the seat upside down on a table with a cloth under it. Four bolts with the large Allen key.",
        add: ["S", "M"],
        fix: [{ kind: "bolt", count: 4, len: 16, dia: 8, at: [-1, 1].flatMap((g) => [-75, 75].map((z): Vec3 => [g * 75, yM, z])), dir: up, on: "M", mate: "S" }],
        tools: ["allen"],
        pose: "-y",
      },
      ...[-1, 1].flatMap((sx, i): CustomStep[] => {
        const id = `A${i + 1}`;
        return [
          {
            title: `Push the ${sx < 0 ? "left" : "right"} armrest into its socket`,
            detail: "The back end goes into the socket on the side of the shell. One small screw holds it.",
            add: [id],
            fix: [{ kind: "screw", count: 1, len: 10, dia: 5, at: [[sx * 240, 650, -190]], dir: up, on: id, mate: "S" } as CustomFix],
            tools: ["allen"],
            from: { [id]: [0, 0, -250] as Vec3 },
          },
          {
            title: "Bolt its front end under the seat",
            detail: "Two bolts through the flat end into the seat.",
            fix: [{ kind: "bolt", count: 2, len: 16, dia: 6, at: [175, 220].map((x): Vec3 => [sx * x, yS - 30, 160]), dir: up, on: id, mate: "S" } as CustomFix],
            tools: ["allen"],
          },
        ];
      }),
      {
        title: "Press the seat onto the gas lift",
        detail: "Turn the seat over, set the plate on the top of the gas lift and push down hard.",
        add: [...base, "G"],
        from: Object.fromEntries([...base, "G"].map((id) => [id, [0, -300, 0] as Vec3])),
        pose: "+y",
      },
    ],
  };
}

const family: Family = { names: ["STIGBYGEL"], recipe };
export default family;
