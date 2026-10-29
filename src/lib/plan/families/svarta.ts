import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * SVÄRTA, read from the bunk bed's and the loft bed's manuals. Both start with the 19 connector bolts screwed into
 * their sleeves by hand and plugs knocked into the legs of the two welded end frames. Two people stand the end
 * frames up and join them with the long rails, two connectors at each end, then the guard rails are joined at the
 * post tops and everything is tightened with the Allen key. The ladder is hooked on and bolted (the loft's is tied
 * to a leg with a strap), the centre supports are bolted under each bed, the mesh bases screwed down and anti-slip
 * strips stuck on the rungs. The loft bed is then strapped to the wall at the top.
 */

const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];
const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });

/** One part drawn as several pieces placed where they sit in the product; its box and centre are worked out. */
function compound(id: string, name: string, abs: PartPiece[], material: PartMaterial = "metal"): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], p.pos[k] + v[k]);
            hi[k] = Math.max(hi[k], p.pos[k] + v[k]);
          }
        }
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 }));
  return { id, name, size, pos, pieces, material };
}

/** A round tube from a to b. */
function tube(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  return { shape: "cyl", size: [dia, L, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / L)] };
}

function bed(s: ProductSpec, loft: boolean): CustomParams {
  // IKEA: 208 long, 97 wide, 159 high (bunk) or 186 high with the bed base at 145 (loft)
  const L = 2080, W = 970, H = loft ? 1860 : 1590;
  const xe = L / 2 - 20, zp = W / 2 - 20, xr = L / 2 - 40;
  const bases = loft ? [1450] : [1130, 260]; // top of the side rails, upper bed first
  const top = bases[0];
  const RH = 50, RT = 25; // side rails
  const zl = W / 2 + 15; // the ladder, outside the front rail at the left end
  const lx = [-L / 2 + 70, -L / 2 + 470];
  const xo = -L / 2 + 520; // the front guard starts here, past the ladder

  // end frames: two posts, a rail under each bed, guard bars above the top bed and (bunk) bars above the lower one
  const endBars = (ex: number): PartPiece[] => {
    const across = (y: number, dia = 20): PartPiece => tube([ex, y, -zp + 20], [ex, y, zp - 20], dia);
    const guard = [top + 150, top + 280, H - 20].map((y, i) => across(y, i === 2 ? 34 : 20));
    const low = loft ? [across(780, 34)] : [380, 500, 620].map((y) => across(y));
    const rails = bases.map((y): PartPiece => ({ shape: "box", size: [RT, RH, 2 * zp - 40], pos: [ex, y - RH / 2, 0] }));
    return [...[-1, 1].map((sz) => tube([ex, 0, sz * zp], [ex, H, sz * zp], 40)), ...rails, ...guard, ...low];
  };
  const rail = (y: number, z: number): PartPiece => ({ shape: "box", size: [2 * xr, RH, RT], pos: [0, y - RH / 2, z] });
  const along = (y: number, z: number, x0 = -xr, x1 = xr, dia = 20) => tube([x0, y, z], [x1, y, z], dia);
  const backGuard = compound("GB", "Back guard rail", [
    rail(top, -zp),
    along(top + 150, -zp),
    along(top + 280, -zp),
    along(H - 20, -zp, -xr, xr, 34),
    ...[-L / 4, L / 4].map((x) => tube([x, top, -zp], [x, H - 20, -zp], 20)),
  ]);
  const frontGuard = compound("GF", "Front guard rail", [
    rail(top, zp),
    along(top + 150, zp, xo, xr),
    along(top + 280, zp, xo, xr),
    along(H - 20, zp, xo, xr, 34),
    tube([xo, top, zp], [xo, H - 20, zp], 34),
    tube([L / 4, top, zp], [L / 4, H - 20, zp], 20),
  ]);

  const parts: CustomPart[] = [compound("E1", "End frame", endBars(-xe)), compound("E2", "End frame", endBars(xe))];
  const lowRails: CustomPart[] = loft
    ? [compound("R1", "Long rail", [along(1040, -zp, -xr, xr, 34)]), compound("R2", "Long rail", [along(780, -zp, -xr, xr, 34)])]
    : [compound("R1", "Lower side rail", [rail(bases[1], -zp)]), compound("R2", "Lower side rail", [rail(bases[1], zp)])];
  parts.push(...lowRails, backGuard, frontGuard);

  // the ladder: upright on the bunk, leaning out on the loft, hooked over the top front rail
  const foot = loft ? zl + 520 : zl;
  const ladderTop = top + 60;
  const rungs = loft ? 4 : 3;
  const ladderPieces: PartPiece[] = [
    ...lx.map((x) => tube([x, 0, foot], [x, ladderTop, zl], 30)),
    ...Array.from({ length: rungs }, (_, i) => {
      const f = (i + 1) / (rungs + 1);
      const y = loft ? ladderTop * f : bases[1] + (top - bases[1]) * f;
      const z = foot + (zl - foot) * (y / ladderTop);
      return { shape: "box", size: [lx[1] - lx[0], 20, 45], pos: [(lx[0] + lx[1]) / 2, y, z] } as PartPiece;
    }),
    ...lx.map((x): PartPiece => ({ shape: "box", size: [30, 60, 30], pos: [x, top + 30, zp + 10] })),
  ];
  parts.push(compound("LD", "Ladder", ladderPieces));

  // between the two long rails, at their height, so the bolts go through each rail into its ends
  const supports = bases.map((y, i) => compound(`S${i}`, "Centre support", [{ shape: "box", size: [60, 25, 2 * zp - RT], pos: [0, y - RH / 2, 0] }]));
  parts.push(...supports);
  const meshes = bases.flatMap((y, i) =>
    [-1, 1].map((sx): CustomPart => ({ id: `M${i}${sx < 0 ? "a" : "b"}`, name: "Mesh base", size: [xr - 10, 20, 2 * zp - RT], pos: [sx * (xr / 2 + 2), y + 10, 0], material: "metal" })),
  );
  parts.push(...meshes);

  // two connector bolts through the end frame into each end of a rail
  const conn = (y: number, z: number, ids: [string, string]): CustomFix[] =>
    [-1, 1].map((sx, i) => fx("bolt", [-12, 12].map((dy): Vec3 => [sx * (L / 2), y + dy, z]), { name: "Connector bolt", len: 70, dia: 6, dir: [-sx, 0, 0], on: i ? "E2" : "E1", mate: ids[1] }));
  const tops: Vec3[] = [[-L / 2, H - 20, -zp], [L / 2, H - 20, -zp], [L / 2, H - 20, zp]];
  const topFix: CustomFix[] = [
    // each one in through the post, towards the middle of the bed
    ...tops.map((p) => fx("bolt", [p], { name: "Connector bolt", len: 70, dia: 6, dir: [-Math.sign(p[0]), 0, 0] })),
    fx("screw", [[xo, H - 20, zp]], { len: 20, dia: 6, dir: [0, 0, -1], on: "GF" }),
  ];
  const meshScrews = (y: number): Vec3[] => [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [0.15, 0.85].map((f): Vec3 => [sx * xr * f, y + 20, sz * (zp - 10)])));
  const supportBolts = (y: number): Vec3[] => [-1, 1].map((sz): Vec3 => [0, y - RH / 2, sz * (zp + RT / 2)]);

  const steps: CustomStep[] = [
    { title: "Screw a threaded rod into each sleeve", detail: "All 19 of them, by hand, until the rod stops. You need them ready for every joint." },
  ];
  if (loft)
    steps.push({ title: "Tie a knot in each end of the strap", detail: "Leave 43 cm between the knots. It ties the ladder's foot to the bed later." });
  steps.push({
    title: loft ? "Knock the foot plugs into the legs" : "Push the foot plugs into the legs",
    detail: loft
      ? "Lay the end frames flat. Trap one end of the strap under the plug in the front leg on the ladder side, then tap all four in with a hammer."
      : "Lay the end frames flat on the floor and push a plug into the bottom of each of the four legs.",
    add: ["E1", "E2"],
    fix: [fx("cap", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xe, 0, sz * zp])), { name: "Foot plug", len: 15, dia: 38, dir: UP })],
    tools: loft ? ["hammer"] : undefined,
    pose: "+x",
    warnings: ["floor"],
  });
  const railStep = (id: string, title: string, y: number, z: number, detail: string): CustomStep => ({
    title,
    detail,
    add: [id],
    fix: conn(y, z, [id, id]),
    people: 2,
    pose: "+y",
    warnings: ["two"],
  });
  if (loft) {
    steps.push(railStep("R1", "Join the end frames with a long rail", 1040, -zp, "Stand both end frames up and hold them while the other person turns two connectors in at each end, by hand for now."));
    steps.push(railStep("R2", "Fit the second long rail below it", 780, -zp, "Holes facing the right way, as the drawing shows. Two connectors at each end."));
    steps.push(railStep("GB", "Join the back guard rail", top - RH / 2, -zp, "It holds one long side of the bed base. Two connectors at each end, by hand."));
    steps.push(railStep("GF", "Join the front guard rail", top - RH / 2, zp, "Its open end goes on the side you want the ladder. Two connectors at each end."));
  } else {
    steps.push(railStep("GB", "Join the end frames with the back guard rail", top - RH / 2, -zp, "Stand both end frames up and hold them while the other person turns two connectors in at each end, by hand for now."));
    steps.push(railStep("GF", "Join the front guard rail", top - RH / 2, zp, "Its open end goes on the side you want the ladder. Two connectors at each end."));
    steps.push({ ...railStep("R1", "Fit the two lower side rails", bases[1] - RH / 2, -zp, "Holes facing in, as the drawing shows. Two connectors at each end of each rail."), add: ["R1", "R2"], fix: [...conn(bases[1] - RH / 2, -zp, ["R1", "R1"]), ...conn(bases[1] - RH / 2, zp, ["R2", "R2"])] });
  }
  steps.push({
    title: "Join the guard rails at the post tops",
    detail: "Three connectors into the post tops and one screw where the front guard bends down.",
    fix: topFix,
    tools: ["allen"],
  });
  steps.push({ title: "Tighten every connector", detail: "Go round all of them with the Allen key, with the frame standing square.", tools: ["allen"], check: "square" });
  const spare: Vec3[] = loft ? [] : [-1, 1].map((sx): Vec3 => [L / 2 - 70 - (sx + 1) * 200, bases[1] - RH / 2, zp + RT / 2]);
  const ladderFix: CustomFix[] = [fx("screw", lx.map((x): Vec3 => [x, top + 40, zp + 25]), { name: "Wood screw", len: 16, dia: 4, dir: [0, 0, -1], on: "LD", mate: "GF" })];
  if (loft)
    steps.push(
      { title: "Hook the ladder on", detail: "Over the front rail by the gap in the guard. Push the dome plugs into its feet, one of them over the other end of the strap.", add: ["LD"], fix: [fx("cap", lx.map((x): Vec3 => [x, 0, foot]), { name: "Dome plug", len: 15, dia: 30, dir: UP, on: "LD" })] },
      { title: "Screw the ladder hooks to the rail", detail: "One screw through each hook.", fix: ladderFix, tools: ["screwdriver"] },
    );
  else
    steps.push({
      title: "Fit the ladder",
      detail: "Hook it over the top rail, screw through both hooks, then bolt its feet to the lower rail. Bolt the two spare ladder holes shut too.",
      add: ["LD"],
      fix: [
        ...ladderFix,
        fx("bolt", lx.map((x): Vec3 => [x, bases[1] - RH / 2, zl + 15]), { len: 16, dia: 6, dir: [0, 0, -1], on: "LD", mate: "R2" }),
        fx("bolt", spare, { len: 16, dia: 6, dir: [0, 0, -1], on: "R2" }),
        fx("nut", [...lx.map((x): Vec3 => [x, bases[1] - RH / 2, zp - RT / 2]), ...spare.map((p): Vec3 => [p[0], p[1], zp - RT / 2])], { name: "Sleeve nut", len: 10, dia: 12, dir: [0, 0, 1] }),
      ],
      tools: ["screwdriver", "allen"],
    });
  steps.push({
    title: loft ? "Bolt the centre support under the bed" : "Bolt a centre support under each bed",
    detail: "Across the middle, from the front rail to the back. A bolt, a spacer and a cap nut at each end, plus a wood screw.",
    add: supports.map((p) => p.id),
    fix: bases.flatMap((y, i) => [
      ...supportBolts(y).map((p) => fx("bolt", [p], { len: 20, dia: 6, dir: [0, 0, -Math.sign(p[2])], on: `S${i}` })),
      ...supportBolts(y).map((p) => fx("nut", [[p[0], p[1], p[2] - Math.sign(p[2]) * RT]], { name: "Cap nut", len: 10, dia: 16, dir: [0, 0, -Math.sign(p[2])] })),
      ...supportBolts(y).map((p) => fx("screw", [[p[0] + 24, p[1] - 6, p[2]]], { name: "Wood screw", len: 16, dia: 4, dir: [0, 0, -Math.sign(p[2])], on: `S${i}` })),
    ]),
    tools: ["allen", "screwdriver"],
  });
  steps.push({
    title: loft ? "Screw the two mesh bases down" : "Screw the mesh bases down",
    detail: "Bent edges down, the ends meeting in the middle. Each screw goes into a sleeve from underneath.",
    add: meshes.map((m) => m.id),
    fix: bases.flatMap((y) => [
      fx("screw", meshScrews(y), { len: 12, dia: 5, dir: DOWN, mate: "GB" }),
      fx("nut", meshScrews(y).map((p): Vec3 => [p[0], p[1] - 45, p[2]]), { name: "Sleeve", len: 20, dia: 8, dir: UP }),
    ]),
    tools: ["screwdriver"],
    people: loft ? 2 : 1,
  });
  steps.push({
    title: "Stick the anti-slip strips on the rungs",
    detail: `One on each of the ${rungs} rungs. The mattress can be at most ${loft ? 21 : 22} cm thick so the guard rail stays above it.`,
    fix: [fx("clip", Array.from({ length: rungs }, (_, i): Vec3 => {
      const f = (i + 1) / (rungs + 1);
      const y = loft ? ladderTop * f : bases[1] + (top - bases[1]) * f;
      return [(lx[0] + lx[1]) / 2, y + 10, foot + (zl - foot) * (y / ladderTop)];
    }), { name: "Anti-slip strip", len: 2, dia: 20, dir: DOWN, on: "LD" })],
  });
  if (loft)
    steps.push({
      title: "Strap the bed to the wall",
      detail: "A perforated strap from each back post top to the wall. Wall screws and plugs aren't included: use ones made for your wall.",
      fix: [
        fx("strap", [-1, 1].map((sx): Vec3 => [sx * xe, H - 60, -W / 2]), { dir: [0, 0, -1], to: ["E1", "E2"] }),
        fx("plug", [-1, 1].map((sx): Vec3 => [sx * xe, H - 60, -W / 2 - 40]), { dir: [0, 0, -1] }),
        fx("screw", [-1, 1].map((sx): Vec3 => [sx * xe, H - 60, -W / 2 - 34]), { len: 50, dia: 5, name: "Wall screw", dir: [0, 0, -1] }),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  void s;
  return { parts, steps };
}

const family: Family = {
  names: ["SVÄRTA", "SVARTA"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
    if (/loft/.test(t)) return bed(s, true);
    if (/bunk/.test(t)) return bed(s, false);
    return null;
  },
};
export default family;
