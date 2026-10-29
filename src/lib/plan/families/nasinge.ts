import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NÄSINGE, read from its manuals.
 * The fixed tables: four rails laid out on a rug, a corner bracket pressed onto each end of the long rails and then the
 * short rails, each bracket held by expanding inserts and push pins. Dowels go into the top edge of the frame, the
 * frame is turned over onto the top lying face down (the round top is two halves joined with dowels first) and screwed
 * through the rails into it. Each leg gets a barrel nut and two hanger bolts, goes onto its bracket with spring
 * washers and nuts tightened with the box spanner, and floor protectors are hammered into the feet.
 * The chair is built lying on its back: seat brackets screwed onto the back frame, long bolts into barrel nuts, the two
 * side rails slid onto the bolts and tightened through their windows under a curved washer, then the front frame the
 * same way. Upside down on a table the front bolts are tightened, it is stood up and pressed level, the bolts
 * tightened again, and the seat pad is screwed on through the brackets.
 * The extendable table builds its frame upside down (brackets, an inner frame on dowels and cam locks, the end rails,
 * one with the table lock), presses runners on, slides the two top halves onto them, adds the stops and the catch, then
 * the legs the same way as the fixed tables; the self-storing leaf gets its blocks, supports and catch last.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r1 = (n: number) => Math.round(n * 10) / 10;
const G = [-1, 1] as const;
const box = (size: Vec3, pos: Vec3, rot?: Vec3): PartPiece => ({ shape: "box", size, pos, ...(rot ? { rot } : {}) });

/** A part drawn as pieces placed in product coordinates (none of them turned far): works out its box. */
function built(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const ext = (p: PartPiece): [Vec3, Vec3] => {
    const a = p.rot?.[0] ?? 0;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const h: Vec3 = [p.size[0] / 2, (c * p.size[1] + s * p.size[2]) / 2, (s * p.size[1] + c * p.size[2]) / 2];
    return [p.pos.map((v, i) => v - h[i]) as Vec3, p.pos.map((v, i) => v + h[i]) as Vec3];
  };
  const boxes = pieces.map(ext);
  const lo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[0][i]))) as Vec3;
  const hi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b[1][i]))) as Vec3;
  const mid = lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3;
  return { id, name, size: lo.map((v, i) => r1(hi[i] - v)) as Vec3, pos: mid, material, pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 })) };
}

/* ---------- tables ---------- */

const TOPT = 22;
const LEG = 45;
const RH = 90, RT = 20; // rails
const SCREW = { len: 100, dia: 5, name: "Long screw" };
const INSERT = { kind: "nut" as Kind, len: 12, dia: 12, name: "Expanding insert" };
const PUSH = { len: 14, dia: 8, name: "Push pin" };
const CORNER = { len: 110, dia: 40, name: "Corner bracket" };
const BARREL = { len: 22, dia: 10, name: "Barrel nut" };
const HANGER = { kind: "stud" as Kind, len: 70, dia: 8, name: "Hanger bolt" };
const NUT = { len: 7, dia: 8 };
const LOCK = { len: 2, dia: 14, name: "Spring washer" };
const GLIDE = { len: 6, dia: 22, name: "Floor protector" };

interface TableOpts {
  W: number;
  D: number;
  H: number;
  round: boolean;
  half: number; // leg outer faces at x = ±half (and z = ±halfD)
  halfD: number;
  screws: [number, number]; // per long rail, per short rail
  dowels: number; // into the top edge of the frame
}

function table(o: TableOpts): CustomParams {
  const { W, D, H } = o;
  const yT = H - TOPT; // underside of the top
  const yR = yT - RH / 2;
  const lx = o.half - LEG / 2, lz = o.halfD - LEG / 2; // leg centres
  const xin = o.half - LEG, zin = o.halfD - LEG; // where the rails meet the legs
  const zr = o.halfD - RT / 2, xr = o.half - RT / 2; // rail centres
  const parts: CustomPart[] = [];
  for (const sz of G) parts.push({ id: sz < 0 ? "LB" : "LF", name: "Long rail", size: [2 * xin, RH, RT], pos: [0, yR, sz * zr], material: "wood" });
  for (const sx of G) parts.push({ id: sx < 0 ? "SL" : "SR", name: "Short rail", size: [RT, RH, 2 * zin], pos: [sx * xr, yR, 0], material: "wood" });
  if (o.round) {
    // the round top comes in two halves; a part can't be half a cylinder, so each half is drawn as the whole disc and
    // the two overlap exactly once they are pushed together (they arrive in the same step)
    const r = W / 2;
    for (const sz of G)
      parts.push({
        id: sz < 0 ? "TB" : "TF",
        name: "Table top half",
        size: [W, TOPT, r],
        pos: [0, H - TOPT / 2, (sz * r) / 2],
        material: "wood",
        pieces: [{ shape: "cyl", size: [W, TOPT, W], pos: [0, 0, (-sz * r) / 2] }],
      });
  } else parts.push({ id: "T", name: "Table top", size: [W, TOPT, D], pos: [0, H - TOPT / 2, 0], material: "wood" });
  const legId = (sx: number, sz: number) => `G${sx < 0 ? "L" : "R"}${sz < 0 ? "B" : "F"}`;
  for (const sx of G) for (const sz of G) parts.push({ id: legId(sx, sz), name: "Leg", size: [LEG, yT, LEG], pos: [sx * lx, yT / 2, sz * lz], material: "wood" });

  // corner brackets: across each inner corner, held to each rail by two inserts and two pins
  const d = 0.707;
  const corner = (sx: number, sz: number): Vec3 => [r1(sx * (xin - 45)), yR, r1(sz * (zin - 45))];
  const diag = (sx: number, sz: number): Vec3 => [r1(sx * d), 0, r1(sz * d)];
  const onLong = (sx: number, sz: number): Vec3[] => [-20, 20].map((dy) => [sx * (xin - 25), yR + dy, sz * (zin)] as Vec3);
  const onShort = (sx: number, sz: number): Vec3[] => [-20, 20].map((dy) => [sx * xin, yR + dy, sz * (zin - 25)] as Vec3);
  const brackets = G.flatMap((sx) => G.map((sz) => fx("angle", [corner(sx, sz)], diag(sx, sz), { ...CORNER, twist: 0 })));

  const spread = (a: number, b: number, k: number) => Array.from({ length: k }, (_, i) => (k === 1 ? (a + b) / 2 : a + ((b - a) * (i + 0.5)) / k));
  const screwPts: { on: string; at: Vec3[] }[] = [
    ...G.map((sz) => ({ on: sz < 0 ? "LB" : "LF", at: spread(-xin, xin, o.screws[0]).map((x) => [r1(x), yT - RH, sz * zr] as Vec3) })),
    ...G.map((sx) => ({ on: sx < 0 ? "SL" : "SR", at: spread(-zin, zin, o.screws[1]).map((z) => [sx * xr, yT - RH, r1(z)] as Vec3) })),
  ];
  const nScrews = screwPts.reduce((a, p) => a + p.at.length, 0);
  const top = o.round ? "TB" : "T";
  // dowels in the frame's top edge: one or two in each long rail, or one in every rail of the square frame
  const dowelPts: { on: string; at: Vec3 }[] =
    o.dowels === 2
      ? G.map((sz) => ({ on: sz < 0 ? "LB" : "LF", at: [-sz * xin * 0.6, yT, sz * zr] as Vec3 }))
      : o.round
        ? [...G.map((sz) => ({ on: sz < 0 ? "LB" : "LF", at: [0, yT, sz * zr] as Vec3 })), ...G.map((sx) => ({ on: sx < 0 ? "SL" : "SR", at: [sx * xr, yT, 0] as Vec3 }))]
        : G.flatMap((sz) => G.map((sx) => ({ on: sz < 0 ? "LB" : "LF", at: [sx * xin * 0.6, yT, sz * zr] as Vec3 })));
  const dowelFix = dowelPts.map((p) => fx("dowel", [p.at], [0, -1, 0], { on: p.on, mate: o.round ? (p.at[2] < 0 ? "TB" : "TF") : top }));

  // each leg: a barrel nut across its top and two hanger bolts out of its inner corner, into the bracket
  const hangers = (sx: number, sz: number): Vec3[] => [yR - 18, yR + 18].map((y) => [r1(sx * (lx - 16)), y, r1(sz * (lz - 16))] as Vec3);
  const nuts = (sx: number, sz: number): Vec3[] => [yR - 18, yR + 18].map((y) => [r1(sx * (xin - 38)), y, r1(sz * (zin - 38))] as Vec3);
  const legFix = G.flatMap((sx) =>
    G.flatMap((sz) => [
      fx("nut", [[sx * (lx - LEG / 2), yR, sz * lz]], [sx, 0, 0], { ...BARREL, on: legId(sx, sz) }),
      fx("stud", hangers(sx, sz), diag(sx, sz), { ...HANGER, on: legId(sx, sz) }),
    ]),
  );
  const legNuts = G.flatMap((sx) => G.flatMap((sz) => [fx("washer", nuts(sx, sz), diag(sx, sz), { ...LOCK, on: legId(sx, sz) }), fx("nut", nuts(sx, sz), diag(sx, sz), { ...NUT, on: legId(sx, sz) })]));
  const feet: Vec3[] = G.flatMap((sx) => G.map((sz) => [sx * lx, 0, sz * lz] as Vec3));

  const rails = o.round ? "two of the rails" : "the two long rails";
  const others = o.round ? "the other two rails" : "the two short rails";
  const steps: CustomStep[] = [
    {
      title: `Fit a corner bracket on each end of ${rails}`,
      detail: "Lay the rails on a rug. Press two inserts into the holes at each end, set the bracket on, and push a pin through it into each insert.",
      add: ["LB", "LF"],
      warnings: ["floor"],
      fix: [
        ...brackets,
        // one fitting group per rail: a step only takes ten
        ...G.flatMap((sz) => {
          const at = G.flatMap((sx) => onLong(sx, sz)), on = sz < 0 ? "LB" : "LF";
          return [fx("pin", at, [0, 0, sz], { ...PUSH, on }), fx("nut", at, [0, 0, sz], { ...INSERT, on })];
        }),
      ],
    },
    {
      title: `Stand them up and fit ${others} into the brackets`,
      detail: "Inserts and pins the same way. Each rail goes with its row of holes along the top edge, as the drawing shows.",
      add: ["SL", "SR"],
      fix: G.flatMap((sx) => {
        const at = G.flatMap((sz) => onShort(sx, sz)), on = sx < 0 ? "SL" : "SR";
        return [fx("pin", at, [sx, 0, 0], { ...PUSH, on }), fx("nut", at, [sx, 0, 0], { ...INSERT, on })];
      }),
    },
    {
      title: `Tap ${dowelPts.length} dowels into the top edge of the frame`,
      detail: "By hand, into the holes along the top. Then turn the frame over.",
      fix: dowelFix,
    },
  ];
  if (o.round)
    steps.push({
      title: "Lay the two top halves face down and push them together",
      detail: "On a rug. Six dowels in the edge of one half, into the holes in the other, until the join closes.",
      add: ["TB", "TF"],
      from: { TB: [0, 300, 0], TF: [0, 300, 0] },
      pose: "-y",
      warnings: ["floor"],
      fix: [fx("dowel", [-400, -240, -80, 80, 240, 400].map((x) => [x, H - TOPT / 2, 0] as Vec3), [0, 0, -1], { on: "TB", mate: "TF" })],
    });
  steps.push(
    o.round
      ? { title: "Lower the frame onto the top", detail: "Upside down, with the dowels in the holes underneath the top. Check the join runs across the frame as the drawing shows." }
      : {
          title: "Lay the top face down and lower the frame onto it",
          detail: "On a rug, so it doesn't scratch. The dowels go into the holes underneath the top.",
          add: ["T"],
          pose: "-y",
          warnings: ["floor"],
        },
    {
      title: `Screw the frame to the top with ${nScrews} screws`,
      detail: "Down through the holes in the rails, with the screwdriver. Stop when they are snug, so they don't come through the top.",
      fix: screwPts.map((p) => fx("screw", p.at, [0, 1, 0], { ...SCREW, on: p.on, mate: o.round ? undefined : top })),
      tools: ["screwdriver"],
    },
    {
      title: "Fit a barrel nut and two hanger bolts in each leg",
      detail: "The barrel nut goes in the side hole, slot turned to line up with the bolts. Then turn the two hanger bolts into the top of the leg by hand.",
      add: G.flatMap((sx) => G.map((sz) => legId(sx, sz))),
      fix: legFix,
      tools: ["flathead"],
    },
    {
      title: "Bolt the legs onto the corner brackets",
      detail: "Each leg's two bolts through its bracket, a spring washer and a nut on each, tightened with the box spanner.",
      fix: legNuts,
      tools: ["wrench"],
    },
    {
      title: "Hammer a floor protector into each foot",
      detail: "Tap them in straight, then turn the table over with two people.",
      fix: [fx("glide", feet, [0, 1, 0], GLIDE)],
      tools: ["hammer"],
    },
    { title: "Turn the table over", detail: "Two of you, lifting it, never pivoting on two legs.", pose: "+y", people: 2 },
  );
  return { parts, steps };
}

/* ---------- chair ---------- */

const BOLT = { len: 110, dia: 6, name: "Long bolt" };
const CAP = { kind: "washer" as Kind, len: 4, dia: 22, name: "Curved washer" };
const WOOD = { len: 16, dia: 4, name: "Wood screw" };
const MACHINE = { len: 12, dia: 6, name: "Machine screw" };
const SEATB = { len: 40, dia: 20, name: "Seat bracket" };

function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const L = 40; // legs, square
  const xl = W / 2 - L / 2;
  const yRail = 440; // top of the seat rails
  const rh = 60, rt = 20;
  const zb = -D / 2 + L / 2 + 30, zf = D / 2 - L / 2 - 10; // back and front leg centres
  const xr = xl - 5; // side rails, just inside the legs
  const tilt = -0.13; // the back leans back above the seat
  const up = H - yRail;
  const topZ = zb + up * Math.tan(tilt);
  const backPieces: PartPiece[] = [];
  for (const sx of G) {
    backPieces.push(box([L, yRail, L], [sx * xl, yRail / 2, zb]));
    backPieces.push(box([L, up / Math.cos(tilt), L], [sx * xl, yRail + up / 2, (zb + topZ) / 2], [tilt, 0, 0]));
  }
  const inner = 2 * xl - L;
  const at = (y: number) => zb + (y - yRail) * Math.tan(tilt);
  backPieces.push(box([inner, 95, 24], [0, H - 60, at(H - 60)], [tilt, 0, 0])); // top rail
  backPieces.push(box([inner, 40, 22], [0, 610, at(610)], [tilt, 0, 0])); // lower back rail
  for (let i = 0; i < 6; i++) {
    const x = -inner / 2 + (inner * (i + 0.5)) / 6;
    const y0 = 630, y1 = H - 108;
    backPieces.push(box([i === 0 || i === 5 ? 22 : 14, y1 - y0, 14], [x, (y0 + y1) / 2, at((y0 + y1) / 2)], [tilt, 0, 0]));
  }
  backPieces.push(box([inner, rh, rt], [0, yRail - rh / 2, zb + L / 2 - rt / 2])); // back seat rail
  const parts: CustomPart[] = [
    built("BF", "Back frame", backPieces, "wood"),
    built(
      "FF",
      "Front frame",
      [...G.map((sx) => box([L, yRail, L], [sx * xl, yRail / 2, zf])), box([inner, rh, rt], [0, yRail - rh / 2, zf - L / 2 + rt / 2])],
      "wood",
    ),
  ];
  const sl = zf - zb - L;
  for (const sx of G) parts.push({ id: sx < 0 ? "RL" : "RR", name: "Side rail", size: [rt, rh, sl], pos: [sx * xr, yRail - rh / 2, (zb + zf) / 2], material: "wood" });
  parts.push({ id: "P", name: "Seat pad", size: [W - 10, 45, zf - zb + L - 10], pos: [0, yRail + 22, (zb + zf) / 2], material: "soft" });

  const yb = yRail - rh / 2;
  const rail = (sx: number) => (sx < 0 ? "RL" : "RR");
  // the long bolts sit in a window near each end of the side rail and go out through its end into the leg
  const boltsAt = (z: number): Vec3[] => G.map((sx) => [sx * xr, yb, z]);
  const backWin = zb + BOLT.len - 5, frontWin = zf - BOLT.len + 5; // windows where the bolt tips reach the barrel nuts
  const barrels = (z: number): Vec3[] => G.map((sx) => [sx * (xl - L / 2), yb, z]);
  const brackets = (z: number, dz: number): Vec3[] => G.map((sx) => [sx * 90, yRail - 25, z + dz]);
  const backBr = brackets(zb + L / 2, 6), frontBr = brackets(zf - L / 2, -6);
  const seatScrews: Vec3[] = [...backBr, ...frontBr].map((p) => [p[0], yRail, p[2] + Math.sign(-p[2]) * 18]);

  const steps: CustomStep[] = [
    {
      title: "Screw two seat brackets onto the back frame",
      detail: "Lay it on its back on a rug. One wood screw through each bracket into the inside of the seat rail.",
      add: ["BF"],
      pose: "+z",
      warnings: ["floor"],
      fix: [fx("angle", backBr, [0, 0, -1], { ...SEATB, on: "BF" }), fx("screw", backBr, [0, 0, -1], { ...WOOD, on: "BF" })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit two barrel nuts and two long bolts",
      detail: "A barrel nut in the side of each back leg, slot lined up with the flat screwdriver, then a bolt into it, just a turn or two.",
      fix: [...G.map((sx) => fx("nut", [barrels(zb)[sx < 0 ? 0 : 1]], [sx, 0, 0], { ...BARREL, on: "BF" })), fx("bolt", boltsAt(backWin), [0, 0, -1], { ...BOLT, on: "BF" })],
      tools: ["flathead"],
    },
    {
      title: "Slide the side rails down onto the bolts",
      detail: "Each bolt head drops into the window near the end of its rail.",
      add: ["RL", "RR"],
      from: { RL: [0, 0, 300], RR: [0, 0, 300] },
    },
    {
      title: "Tighten the back bolts",
      detail: "A curved washer under each bolt head in the window, then tighten with the Allen key until the washer sits flush.",
      fix: [fx("washer", boltsAt(backWin), [0, 0, -1], { ...CAP, on: "RL" })],
      tools: ["allen"],
    },
    {
      title: "Fit the front frame's brackets, barrel nuts and bolts",
      detail: "Two seat brackets screwed inside its rail, a barrel nut in each front leg and a long bolt turned into each, as on the back.",
      wait: ["FF"],
      fix: [
        fx("angle", frontBr, [0, 0, 1], { ...SEATB, on: "FF" }),
        fx("screw", frontBr, [0, 0, 1], { ...WOOD, on: "FF" }),
        ...G.map((sx) => fx("nut", [barrels(zf)[sx < 0 ? 0 : 1]], [sx, 0, 0], { ...BARREL, on: "FF" })),
        fx("bolt", boltsAt(frontWin), [0, 0, 1], { ...BOLT, on: "FF" }),
      ],
      tools: ["screwdriver", "flathead"],
    },
    { title: "Press the front frame down onto the side rails", detail: "Its bolt heads drop into the windows at the front ends of the rails.", add: ["FF"], from: { FF: [0, 0, 320] } },
    {
      title: "Turn the chair upside down and tighten the front bolts",
      detail: "Rest the seat on a table edge. A curved washer under each bolt head, then tighten with the Allen key.",
      pose: "-y",
      fix: G.map((sx) => fx("washer", [boltsAt(frontWin)[sx < 0 ? 0 : 1]], [0, 0, 1], { ...CAP, on: rail(sx) })),
      tools: ["allen"],
    },
    {
      title: "Stand the chair up and press it level",
      detail: "On a flat floor, press down on the seat frame so all four legs touch. Then tighten all four bolts again with the Allen key.",
      pose: "+y",
      check: "square",
      tools: ["allen"],
    },
    { title: "Lay the seat pad on the frame", add: ["P"], detail: "The rounded edge to the front." },
    {
      title: "Turn the chair upside down, holding the pad",
      detail: "Keep a hand under the seat pad so it doesn't slip off.",
      pose: "-y",
    },
    {
      title: "Screw the seat pad on through the brackets",
      detail: "One machine screw up through each of the four brackets.",
      fix: [fx("screw", seatScrews, [0, 1, 0], { ...MACHINE, on: "P" })],
      tools: ["screwdriver"],
    },
    { title: "Stand the chair up", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- extendable table ---------- */

const BSCREW = { len: 15, dia: 6 }; // the frame and block screws
const TINY = { len: 10, dia: 3.5 };
const CLIPSCREW = { len: 13, dia: 4 };
const LEAFSCREW = { len: 16, dia: 4.5 };
const CATCHSCREW = { len: 16, dia: 4 };

function extendable(): CustomParams {
  const W = 1300, D = 800, H = 750;
  const yT = H - TOPT;
  const RH2 = 80;
  const yTopR = yT - 10; // the rails stop under the runners
  const yR = yTopR - RH2 / 2;
  const half = 590, halfD = 340;
  const lx = half - LEG / 2, lz = halfD - LEG / 2;
  const xin = half - LEG, zin = halfD - LEG;
  const zr = halfD - RT / 2, xr = half - RT / 2;
  const xc = 200, zi = 150; // the inner frame: cross rails and the two short rails between them
  const yH = yR - 10, hH = 60;
  const parts: CustomPart[] = [];
  for (const sz of G) parts.push({ id: sz < 0 ? "LB" : "LF", name: "Long rail", size: [2 * xin, RH2, RT], pos: [0, yR, sz * zr], material: "wood" });
  for (const sx of G) parts.push({ id: sx < 0 ? "CL" : "CR", name: "Cross rail", size: [RT, hH, 2 * (zr - RT / 2)], pos: [sx * xc, yH, 0], material: "wood" });
  for (const sz of G) parts.push({ id: sz < 0 ? "IB" : "IF", name: "Inner rail", size: [2 * (xc - RT / 2), hH, RT], pos: [0, yH, sz * zi], material: "wood" });
  for (const sx of G) parts.push({ id: sx < 0 ? "SL" : "SR", name: "End rail", size: [RT, RH2, 2 * zin], pos: [sx * xr, yR, 0], material: "wood" });
  for (const sz of G) parts.push({ id: sz < 0 ? "UB" : "UF", name: "Runner", size: [2 * xin, 10, 16], pos: [0, yTopR + 5, sz * zr], material: "metal" });
  for (const sx of G) parts.push({ id: sx < 0 ? "TL" : "TR", name: "Table top half", size: [W / 2, TOPT, D], pos: [(sx * W) / 4, H - TOPT / 2, 0], material: "wood" });
  const yLeaf = yH + hH / 2 + 11;
  parts.push({ id: "K", name: "Extension leaf", size: [580, TOPT, 2 * (zr - RT / 2) - 20], pos: [0, yLeaf, 0], material: "wood" });
  const legId = (sx: number, sz: number) => `G${sx < 0 ? "L" : "R"}${sz < 0 ? "B" : "F"}`;
  for (const sx of G) for (const sz of G) parts.push({ id: legId(sx, sz), name: "Leg", size: [LEG, yT, LEG], pos: [sx * lx, yT / 2, sz * lz], material: "wood" });

  const d = 0.707;
  const diag = (sx: number, sz: number): Vec3 => [r1(sx * d), 0, r1(sz * d)];
  const corner = (sx: number, sz: number): Vec3 => [r1(sx * (xin - 45)), yR, r1(sz * (zin - 45))];
  const onLong = (sz: number): Vec3[] => G.flatMap((sx) => [-20, 20].map((dy) => [sx * (xin - 25), yR + dy, sz * zin] as Vec3));
  const onEnd = (sx: number): Vec3[] => G.flatMap((sz) => [-20, 20].map((dy) => [sx * xin, yR + dy, sz * (zin - 25)] as Vec3));
  const long = (sz: number) => (sz < 0 ? "LB" : "LF");
  const under = (pts: [number, number][], y: number): Vec3[] => pts.map(([x, z]) => [x, y, z]);
  const hangers = (sx: number, sz: number): Vec3[] => [yR - 18, yR + 18].map((y) => [r1(sx * (lx - 16)), y, r1(sz * (lz - 16))] as Vec3);
  const nuts = (sx: number, sz: number): Vec3[] => [yR - 18, yR + 18].map((y) => [r1(sx * (xin - 38)), y, r1(sz * (zin - 38))] as Vec3);
  const feet: Vec3[] = G.flatMap((sx) => G.map((sz) => [sx * lx, 0, sz * lz] as Vec3));
  const blocks = (pts: [number, number][], y: number, on: string, name: string, screw: typeof BSCREW, dir: Vec3 = [0, 1, 0]): CustomFix[] => [
    fx("clip", under(pts, y), dir, { name, len: 18, dia: 34, on }),
    fx("screw", under(pts, y).flatMap((p) => [[p[0] - 10, p[1], p[2]], [p[0] + 10, p[1], p[2]]] as Vec3[]), dir, { ...screw, on }),
  ];

  const steps: CustomStep[] = [
    {
      title: "Screw a corner bracket onto each end of the long rails",
      detail: "Lay the two long rails on a rug, inside face up. Two screws through each bracket.",
      // the long rails take their fittings lying beside the build and are folded onto the inner frame later
      wait: ["LB", "LF"],
      pose: "-y",
      warnings: ["floor"],
      fix: [...G.flatMap((sx) => G.map((sz) => fx("angle", [corner(sx, sz)], diag(sx, sz), { ...CORNER, on: long(sz) }))), ...G.map((sz) => fx("screw", onLong(sz).filter((_, i) => i % 2 === 0).flatMap((p) => [[p[0], p[1], sz * (zr - RT / 2 - 3)], [p[0], p[1] + 40, sz * (zr - RT / 2 - 3)]] as Vec3[]), [0, 0, sz], { ...BSCREW, on: long(sz) }))],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a runner stop onto each long rail",
      detail: "In the middle of the inside face, one small screw each.",
      fix: G.flatMap((sz) => [fx("clip", [[0, yR, sz * (zr - RT / 2)]], [0, 0, sz], { name: "Runner stop", len: 14, dia: 30, on: long(sz) }), fx("screw", [[0, yR - 8, sz * (zr - RT / 2)]], [0, 0, sz], { ...TINY, on: long(sz) })]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw four connector bolts into the long rails",
      detail: "Two in each rail, where the cross rails will meet it, until only the head stands out.",
      fix: G.map((sz) => fx("camScrew", G.map((sx) => [sx * xc, yH, sz * (zr - RT / 2)] as Vec3), [0, 0, sz], { on: long(sz), name: "Connector bolt" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw a stop stud into each long rail",
      detail: "Into the hole between the two connector bolts.",
      fix: G.map((sz) => fx("stud", [[sz * 420, yR + 15, sz * (zr - RT / 2)]], [0, 0, sz], { name: "Stop stud", len: 14, dia: 12, on: long(sz) })),
      tools: ["screwdriver"],
    },
    {
      title: "Tap eight dowels into the inner rails",
      detail: "Two in each end of the two short inner rails, by hand.",
      fix: G.flatMap((sx) => G.map((sz) => fx("dowel", [-12, 12].map((dy) => [sx * (xc - RT / 2), yH + dy, sz * zi] as Vec3), [-sx, 0, 0], { on: sz < 0 ? "IB" : "IF", mate: sx < 0 ? "CL" : "CR" }))),
    },
    { title: "Push the cross rails onto the dowels", detail: "One at each end of the inner rails, pressed on until the joints close.", add: ["CL", "CR"] },
    {
      title: "Tap a dowel into each end of the cross rails",
      detail: "Four dowels, one in each end.",
      fix: G.flatMap((sx) => G.map((sz) => fx("dowel", [[sx * xc, yH + 15, sz * (zr - RT / 2)]], [0, 0, -sz], { on: sx < 0 ? "CL" : "CR", mate: long(sz) }))),
    },
    { title: "Fold the long rails up onto the inner frame", detail: "The dowels and connector bolts go into the holes in the cross rail ends. The holes for the runners face away from the brackets.", add: ["LB", "LF"] },
    {
      title: "Lock the cross rails with four cam locks",
      detail: "One near each end of the cross rails, arrow towards the bolt, turned clockwise until it grips.",
      fix: [fx("cam", G.flatMap((sx) => G.map((sz) => [sx * xc, yH - hH / 2, sz * (zr - 60)] as Vec3)), [0, 1, 0], {})],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the table lock onto one end rail",
      detail: "Two screws through its base, on the inside face, with the lever towards the middle.",
      add: ["SL"],
      fix: [fx("connector", [[-(xr - RT / 2), yR, 0]], [-1, 0, 0], { name: "Table lock", len: 50, dia: 40, on: "SL" }), fx("screw", [[-(xr - RT / 2), yR - 20, -15], [-(xr - RT / 2), yR - 20, 15]], [-1, 0, 0], { ...BSCREW, on: "SL" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the end rails onto the corner brackets",
      detail: "Two screws through each bracket into the end rail, then turn the frame over.",
      add: ["SR"],
      fix: G.map((sx) => fx("screw", onEnd(sx).map((p) => [sx * (xr - RT / 2 - 3), p[1], p[2]] as Vec3), [sx, 0, 0], { ...BSCREW, on: sx < 0 ? "SL" : "SR" })),
      tools: ["screwdriver"],
    },
    {
      title: "Press the two runners onto the long rails",
      detail: "Into the groove along the top edge of each rail, pressed down all along.",
      add: ["UB", "UF"],
      pose: "+y",
    },
    {
      title: "Clip four slides into the runners",
      detail: "Two in each runner, each held with one screw. Then turn the frame upside down again.",
      fix: [fx("clip", G.flatMap((sz) => G.map((sx) => [sx * 300, yT, sz * zr] as Vec3)), [0, -1, 0], { name: "Runner slide", len: 16, dia: 30 }), fx("screw", G.flatMap((sz) => G.map((sx) => [sx * 300 + 30, yT, sz * zr] as Vec3)), [0, -1, 0], { ...CLIPSCREW })],
      tools: ["screwdriver"],
    },
    {
      title: "Lay one top half face down and slide the frame onto it",
      detail: "On a rug. The two slides on that side go into the tracks under the half and slide along.",
      add: ["TL"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Slide on the other top half", detail: "The same way, onto the other two slides.", add: ["TR"] },
    {
      title: "Screw a stop stud into each top half",
      detail: "Into the hole near the middle of each half, so the halves can't slide off the runners.",
      fix: G.map((sx) => fx("stud", [[sx * 120, yT, 220]], [0, 1, 0], { name: "Stop stud", len: 14, dia: 12, on: sx < 0 ? "TL" : "TR" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the lock catch onto a top half",
      detail: "Push the pin into the catch, then two screws, close to the end rail with the lock.",
      fix: [
        fx("clip", [[-(xr - 60), yT, 0]], [0, 1, 0], { name: "Lock catch", len: 20, dia: 30, on: "TL" }),
        fx("pin", [[-(xr - 60), yT - 10, 0]], [0, 0, 1], { name: "Catch pin", len: 30, dia: 4, on: "TL" }),
        fx("screw", [[-(xr - 60), yT, -18], [-(xr - 60), yT, 18]], [0, 1, 0], { ...CATCHSCREW, on: "TL" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw two stop blocks under the top",
      detail: "One under each half, two screws each, in the holes shown.",
      fix: blocks([[-80, -260], [80, 260]], yT, "TL", "Stop block", BSCREW),
      tools: ["screwdriver"],
    },
    { title: "Slide the two halves together", detail: "Until they meet in the middle." },
    { title: "Check the lock clicks", detail: "Push the lever until you hear it click: the halves are locked together." },
    {
      title: "Fit a barrel nut and two hanger bolts in each leg",
      detail: "The barrel nut in the side hole, slot lined up with the bolts, then the two hanger bolts into the top of the leg by hand.",
      add: G.flatMap((sx) => G.map((sz) => legId(sx, sz))),
      fix: G.flatMap((sx) => G.flatMap((sz) => [fx("nut", [[sx * (lx - LEG / 2), yR, sz * lz]], [sx, 0, 0], { ...BARREL, on: legId(sx, sz) }), fx("stud", hangers(sx, sz), diag(sx, sz), { ...HANGER, on: legId(sx, sz) })])),
      tools: ["flathead"],
    },
    {
      title: "Bolt the legs onto the corner brackets",
      detail: "A spring washer and a nut on each hanger bolt, tightened with the box spanner.",
      fix: G.flatMap((sx) => G.flatMap((sz) => [fx("washer", nuts(sx, sz), diag(sx, sz), { ...LOCK, on: legId(sx, sz) }), fx("nut", nuts(sx, sz), diag(sx, sz), { ...NUT, on: legId(sx, sz) })])),
      tools: ["wrench"],
    },
    {
      title: "Hammer a floor protector into each foot",
      detail: "Tap them in straight.",
      fix: [fx("glide", feet, [0, 1, 0], GLIDE)],
      tools: ["hammer"],
    },
    {
      title: "Screw two stop blocks under the leaf",
      detail: "The leaf lies face down on the rug, two screws in each block.",
      add: ["K"],
      fix: blocks([[-200, -200], [200, 200]], yLeaf - TOPT / 2, "K", "Stop block", BSCREW),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the two leaf supports on",
      detail: "One at each end of the leaf, two screws each, the cone pointing out.",
      fix: blocks([[-250, 0], [250, 0]], yLeaf - TOPT / 2, "K", "Leaf support", LEAFSCREW),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the second lock catch onto the leaf",
      detail: "Pin pushed in first, then two screws.",
      fix: [
        fx("clip", [[0, yLeaf - TOPT / 2, -250]], [0, 1, 0], { name: "Lock catch", len: 20, dia: 30, on: "K" }),
        fx("pin", [[0, yLeaf - TOPT / 2 - 10, -250]], [1, 0, 0], { name: "Catch pin", len: 30, dia: 4, on: "K" }),
        fx("screw", [[-18, yLeaf - TOPT / 2, -250], [18, yLeaf - TOPT / 2, -250]], [0, 1, 0], { ...CATCHSCREW, on: "K" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Turn the table over and store the leaf under the top",
      detail: "Two of you to turn it, lifting it. Open the lock, pull the halves apart, lay the leaf on the inner frame and push the halves back until the lock clicks.",
      pose: "+y",
      people: 2,
    },
    {
      title: "To make the table longer, lift the leaf up between the halves",
      detail: "Open the lock and pull the halves apart, fold the leaf up into the gap, then push them together until it clicks.",
    },
  ];
  return { parts, steps };
}

/* ---------- which guide ---------- */

const family: Family = {
  names: ["NÄSINGE", "NASINGE"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/extendable/.test(slug)) return extendable();
    if (/chair/.test(slug)) return chair(s);
    if (/table-120/.test(slug)) return table({ W: 1200, D: 1200, H: 750, round: true, half: 395, halfD: 395, screws: [3, 3], dowels: 4 });
    if (/table-80-x-60/.test(slug)) return table({ W: 800, D: 600, H: 750, round: false, half: 345, halfD: 245, screws: [2, 2], dowels: 2 });
    if (/table-130-x-80/.test(slug)) return table({ W: 1300, D: 800, H: 750, round: false, half: 595, halfD: 345, screws: [3, 2], dowels: 4 });
    return null;
  },
};
export default family;
