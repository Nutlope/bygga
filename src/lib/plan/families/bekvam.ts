import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * BEKVÄM, read from its three manuals.
 * The step stool comes as two side frames already glued (two splayed legs and two rails each). Four cross rails are
 * screwed in between them with long Allen screws, the step drops in on two dowels, then it goes upside down so the
 * seat and the step can be bolted on from below. The stepladder is a front ladder (two stiles and two steps) built
 * flat, the seat screwed to its top, the back frame hung on two hinge brackets and two metal stays to hold it open.
 * The kitchen trolley starts upside down on its top: an apron frame of four rails on corner brackets, legs bolted into
 * the corners on hanger bolts, the two slatted shelves on dowels and cam locks, and two castors last.
 */

type Kind = "stool" | "ladder" | "trolley";

function kindOf(s: ProductSpec): Kind | null {
  const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
  if (/trolley/.test(t)) return "trolley";
  if (/stepladder|3 steps|step-stool-63/.test(t)) return "ladder";
  if (/step.stool/.test(t)) return "stool";
  return null;
}

/** A leg leaning in the y-z plane, from (z0, y0) at its foot to (z1, y1) at its top: centre, length and turn about x. */
function lean(z0: number, y0: number, z1: number, y1: number) {
  const dz = z1 - z0, dy = y1 - y0;
  return { c: [(z0 + z1) / 2, (y0 + y1) / 2] as [number, number], len: Math.hypot(dz, dy), a: Math.atan2(dz, dy) };
}
/** One fitting kind at points placed by hand, all going in the same way. */
function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

/** Where a leaning leg is (z) at height y. */
const zAt = (z0: number, y0: number, z1: number, y1: number, y: number) => z0 + ((z1 - z0) * (y - y0)) / (y1 - y0);

// ---------- the step stool ----------

function stool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const LX = 34, LZ = 44; // legs
  const ST = 20; // seat and step
  const xs = W / 2 - LX / 2; // side frames
  const xi = W / 2 - LX; // inside face of a side frame
  const legTop = H - ST;
  // the back legs stand nearly straight, the front legs lean out under the step
  const back = { z0: -D / 2 + 25, z1: -D / 2 + 45 };
  const front = { z0: D / 2 - 30, z1: D / 2 - 140 };
  const yLow = Math.round(H * 0.41); // middle rails, under the step
  const yUp = legTop - 25; // top rails, under the seat
  const zb = (y: number) => zAt(back.z0, 0, back.z1, legTop, y);
  const zf = (y: number) => zAt(front.z0, 0, front.z1, legTop, y);
  const lb = lean(back.z0, 0, back.z1, legTop), lf = lean(front.z0, 0, front.z1, legTop);
  const yc = legTop / 2;
  const sideRail = (y: number): PartPiece => {
    const z0 = zb(y) + LZ / 2 - 4, z1 = zf(y) - LZ / 2 + 4;
    return { shape: "box", size: [20, 50, z1 - z0], pos: [0, y - yc, (z0 + z1) / 2] };
  };
  const framePieces: PartPiece[] = [
    { shape: "box", size: [LX, lb.len, LZ], pos: [0, lb.c[1] - yc, lb.c[0]], rot: [lb.a, 0, 0] },
    { shape: "box", size: [LX, lf.len, LZ], pos: [0, lf.c[1] - yc, lf.c[0]], rot: [lf.a, 0, 0] },
    sideRail(yUp),
    sideRail(yLow),
  ];
  const parts: CustomPart[] = [];
  for (const [i, sx] of [-1, 1].entries())
    parts.push({ id: `F${i}`, name: "Side frame", size: [LX, legTop, D], pos: [sx * xs, yc, 0], pieces: framePieces, material: "wood" });
  const railLen = 2 * xi;
  const rail = (id: string, y: number, z: number) => parts.push({ id, name: "Rail", size: [railLen, 50, 20], pos: [0, y, z], material: "wood" });
  rail("RLf", yLow, zf(yLow));
  rail("RLb", yLow, zb(yLow));
  rail("RUf", yUp, zf(yUp));
  rail("RUb", yUp, zb(yUp));
  const stepZ0 = zb(yLow) + 120, stepZ1 = D / 2;
  parts.push({ id: "T", name: "Step", size: [railLen, ST, stepZ1 - stepZ0], pos: [0, yLow + 25 + ST / 2, (stepZ0 + stepZ1) / 2], material: "wood" });
  const seatZ0 = -D / 2, seatZ1 = zf(legTop) + LZ / 2 + 15;
  parts.push({ id: "S", name: "Seat", size: [W, ST, seatZ1 - seatZ0], pos: [0, H - ST / 2, (seatZ0 + seatZ1) / 2], material: "wood" });

  // the long Allen screws go in through the outside of the leg, into the end of a rail
  const screws = (i: number, ids: string[]): CustomFix => {
    const sx = i ? 1 : -1;
    const pts = ids.map((id) => {
      const p = parts.find((q) => q.id === id)!.pos;
      return [sx * (W / 2), p[1], p[2]] as Vec3;
    });
    return { kind: "bolt", count: pts.length, len: 70, dia: 6, name: "Allen screw", at: pts, dir: [-sx, 0, 0], on: `F${i}` };
  };
  const step = parts.find((p) => p.id === "T")!;
  const steps: CustomStep[] = [
    {
      title: "Screw the two lower rails to a side frame",
      detail: "Stand the frame on its legs. Turn the screws in with the Allen key until the heads sit flush with the leg, not sunk in.",
      add: ["F0", "RLf", "RLb"],
      fix: [screws(0, ["RLf", "RLb"])],
      tools: ["allen"],
    },
    { title: "Screw on the two upper rails", detail: "At the top of the same frame. The hole for the seat bolt faces up.", add: ["RUf", "RUb"], fix: [screws(0, ["RUf", "RUb"])], tools: ["allen"] },
    {
      title: "Fit the step on its dowels",
      detail: "Tap a dowel into each end of the step, then push it in on the lower rails against the frame.",
      add: ["T"],
      fix: [-1, 1].map((sx) => fx("dowel", [[sx * xi, step.pos[1], step.pos[2]]], [-sx, 0, 0], sx < 0 ? "F0" : "F1", { mate: "T" })),
      tools: ["hammer"],
    },
    {
      title: "Screw on the other side frame",
      detail: "Line it up with the four rails and the step's dowel, then four screws, flush with the legs.",
      add: ["F1"],
      fix: [screws(1, ["RLf", "RLb", "RUf", "RUb"])],
      tools: ["allen"],
    },
    {
      title: "Bolt the seat and the step on from below",
      detail: "Turn the stool upside down onto the seat. Two bolts go up through the upper rails into the seat, one through the front rail into the step.",
      add: ["S"],
      fix: [
        {
          kind: "bolt",
          count: 3,
          len: 55,
          dia: 6,
          at: [
            [0, yUp - 25, zf(yUp)],
            [0, yUp - 25, zb(yUp)],
            [0, yLow - 25, zf(yLow)],
          ],
          dir: [0, 1, 0],
        },
      ],
      tools: ["allen"],
      pose: "-y",
      from: { S: [0, -260, 0] },
    },
    {
      title: "Turn it over and check it stands steady",
      detail: "Press down on the seat. If it rocks, loosen the side screws, let it settle on the floor and tighten them again. Never stand on the very edge of the step.",
      pose: "+y",
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Tighten the side screws again", detail: "Wood shrinks a little: go round all eight screws now and then with the Allen key.", tools: ["allen"] },
  ];
  return { parts, steps };
}

// ---------- the stepladder ----------

function ladder(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = Math.max(s.size.d * 10, 420);
  const SX = 28, SZ = 60; // stiles
  const ST = 20;
  const xs = W / 2 - SX / 2;
  const xi = W / 2 - SX;
  const top = H - ST;
  const fr = { z0: D / 2 - SZ / 2, z1: 40 }; // front stiles: foot, top
  const bk = { z0: -D / 2 + 22, z1: -28, y1: top - 25 }; // back legs, hung just behind the stiles
  const lf = lean(fr.z0, 0, fr.z1, top);
  const lb = lean(bk.z0, 0, bk.z1, bk.y1);
  const zf = (y: number) => zAt(fr.z0, 0, fr.z1, top, y);
  const zb = (y: number) => zAt(bk.z0, 0, bk.z1, bk.y1, y);
  const parts: CustomPart[] = [];
  for (const [i, sx] of [-1, 1].entries()) parts.push({ id: `L${i}`, name: "Stile", size: [SX, lf.len, SZ], pos: [sx * xs, lf.c[1], lf.c[0]], rot: [lf.a, 0, 0], material: "wood" });
  const stepYs = [Math.round(top * 0.33), Math.round(top * 0.66)];
  stepYs.forEach((y, k) => parts.push({ id: `T${k}`, name: "Step", size: [2 * xi, ST, 120], pos: [0, y, zf(y) + 10], material: "wood" }));
  // the seat has a batten under each side, inside the stiles, for the screws
  const seatZ0 = -D / 4 - 20, seatZ1 = fr.z1 + SZ / 2 + 25;
  const seatD = seatZ1 - seatZ0, seatC = (seatZ0 + seatZ1) / 2;
  const batten = (sx: number): PartPiece => ({ shape: "box", size: [20, 40, 100], pos: [sx * (xi - 10), -ST / 2 - 20, fr.z1 - seatC] });
  parts.push({ id: "S", name: "Seat", size: [W, ST + 40, seatD], pos: [0, H - ST / 2 - 20, seatC], pieces: [{ shape: "box", size: [W, ST, seatD], pos: [0, 20, 0] }, batten(-1), batten(1)], material: "wood" });
  // the back frame: two legs, a rail at the top and one lower down, and a cross between them
  const yRail = Math.round(top * 0.45);
  const yc = bk.y1 / 2;
  const zMid = zb((yRail + bk.y1 - 40) / 2);
  const span = 2 * xi;
  const xRise = bk.y1 - 40 - yRail - 40;
  const xLen = Math.hypot(span - 40, xRise), xAng = Math.atan2(xRise, span - 40);
  const bz = -D / 4 + 10; // the frame's middle; its pieces sit relative to it
  const backPieces: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [SX, lb.len, 40], pos: [sx * xs, lb.c[1] - yc, lb.c[0] - bz], rot: [lb.a, 0, 0] })),
    { shape: "box", size: [span, 40, 20], pos: [0, bk.y1 - 40 - yc, zb(bk.y1 - 40) - bz] },
    { shape: "box", size: [span, 40, 20], pos: [0, yRail - yc, zb(yRail) - bz] },
    { shape: "box", size: [xLen, 30, 14], pos: [0, (yRail + bk.y1 - 40) / 2 - yc, zMid - bz], rot: [0, 0, xAng] },
    { shape: "box", size: [xLen, 30, 14], pos: [0, (yRail + bk.y1 - 40) / 2 - yc, zMid - bz], rot: [0, 0, -xAng] },
  ];
  parts.push({ id: "B", name: "Back frame", size: [W, bk.y1, D / 2], pos: [0, yc, bz], pieces: backPieces, material: "wood" });
  // the stays: a flat steel bar on the outside of each side, from stile to back leg
  const yStay = Math.round(top * 0.47);
  for (const [i, sx] of [-1, 1].entries()) {
    const z0 = zb(yStay), z1 = zf(yStay);
    parts.push({ id: `R${i}`, name: i ? "Stay, right" : "Stay, left", size: [4, 22, z1 - z0], pos: [sx * (W / 2 + 2), yStay, (z0 + z1) / 2], material: "metal" });
  }
  const hingeY = top - 40;
  const hingeAt = (sx: number, dy = 0): Vec3 => [sx * xi, hingeY + dy, zf(hingeY + dy)];
  const stile = (sx: number) => (sx < 0 ? "L0" : "L1");
  const stepScrews = stepYs.map((y): Vec3 => [0, y, zf(y) + 10]);
  const steps: CustomStep[] = [
    {
      title: "Screw the steps between the stiles",
      detail: "Lay the stiles flat on a rug. Each long screw goes through a washer and the stile into the end of a step: put the washer on first.",
      add: ["L0", "L1", "T0", "T1"],
      fix: [-1, 1].map((sx) => fx("bolt", stepScrews.map((p) => [sx * (W / 2), p[1], p[2]] as Vec3), [-sx, 0, 0], stile(sx), { len: 70, dia: 6, name: "Allen screw" })),
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Screw a hinge bracket to the top of each stile",
      detail: "On the inside, two short screws each. The pivot points back.",
      fix: [
        ...[-1, 1].map((sx) => fx("hinge", [hingeAt(sx)], [sx, 0, 0], stile(sx), { name: "Hinge bracket" })),
        // one above and one below the pivot, far enough apart to show as two
        ...[-1, 1].map((sx) => fx("screw", [24, -24].map((dy) => hingeAt(sx, dy)), [sx, 0, 0], stile(sx), { len: 16, dia: 4 })),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw the seat onto the stiles",
      detail: "Fit the seat's battens inside the tops of the stiles, then four long screws through the stiles. The label goes under the seat.",
      add: ["S"],
      fix: [-1, 1].map((sx) => fx("screw", [-25, 25].map((dz): Vec3 => [sx * (W / 2), H - ST - 20, fr.z1 + dz]), [-sx, 0, 0], stile(sx), { len: 60, dia: 5, mate: "S" })),
      tools: ["allen"],
    },
    {
      title: "Hang the back frame on the hinge brackets",
      detail: "Turn the ladder upside down onto its seat. Two short screws through each bracket into the back legs.",
      add: ["B"],
      fix: [-1, 1].map((sx) => fx("screw", [-15, 15].map((dy): Vec3 => [sx * xi, bk.y1 - 30 + dy, zb(bk.y1 - 30)]), [sx, 0, 0], "B", { len: 16, dia: 4 })),
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Fit the stays on both sides",
      detail: "Stand it up and open it. The stay marked L goes on the left, R on the right; a washer and a screw at each end. Stop turning while the stay still moves.",
      add: ["R0", "R1"],
      fix: [-1, 1].flatMap((sx) => {
        const at = [zb(yStay) + 15, zf(yStay) - 15].map((z): Vec3 => [sx * (W / 2 + 4), yStay, z]);
        return [fx("washer", at, [-sx, 0, 0], sx < 0 ? "R0" : "R1"), fx("screw", at.map((p): Vec3 => [p[0] + sx, p[1], p[2]]), [-sx, 0, 0], sx < 0 ? "R0" : "R1", { len: 16, dia: 5 })];
      }),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Check the stays lock",
      detail: "Open the ladder fully and press the stays down until they lock straight. Fold them up at the joint to close it.",
      warnings: ["hand"],
    },
    {
      title: "Hang the hook for storing it, if you like",
      detail: "At least 70 cm up the wall, with two screws made for your wall (not included). The folded ladder hangs on it by its seat.",
      fix: [
        fx("hook", [[0, 1400, -D / 2 - 60]], [0, 0, -1]),
        fx("screw", [[-25, 1410, -D / 2 - 58], [25, 1410, -D / 2 - 58]], [0, 0, -1], undefined, { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      kind: "anchor",
      wall: true,
    },
  ];
  return { parts, steps };
}

// ---------- the kitchen trolley ----------

function trolley(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 28, L = 45, inset = 15;
  const legTop = H - TT;
  const lx = W / 2 - inset - L / 2, lz = D / 2 - inset - L / 2;
  const CASTOR = 58; // the two legs with castors are shorter by this much
  const AH = 80, AT = 20; // apron
  const parts: CustomPart[] = [];
  parts.push({ id: "TOP", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" });
  const legs: { id: string; sx: number; sz: number; castor: boolean }[] = [
    { id: "LFL", sx: -1, sz: 1, castor: true },
    { id: "LBL", sx: -1, sz: -1, castor: true },
    { id: "LFR", sx: 1, sz: 1, castor: false },
    { id: "LBR", sx: 1, sz: -1, castor: false },
  ];
  for (const g of legs) {
    const y0 = g.castor ? CASTOR : 0;
    parts.push({ id: g.id, name: g.castor ? "Short leg" : "Leg", size: [L, legTop - y0, L], pos: [g.sx * lx, (y0 + legTop) / 2, g.sz * lz], material: "wood" });
  }
  const ay = legTop - AH / 2;
  const azo = lz + L / 2 - AT / 2, axo = lx + L / 2 - AT / 2; // aprons flush with the legs' outsides
  const ax = lx - L / 2, az = lz - L / 2; // leg inside faces
  parts.push({ id: "AF", name: "Long rail", size: [2 * ax, AH, AT], pos: [0, ay, azo], material: "wood" });
  parts.push({ id: "AB", name: "Long rail", size: [2 * ax, AH, AT], pos: [0, ay, -azo], material: "wood" });
  parts.push({ id: "AL", name: "Short rail", size: [AT, AH, 2 * az], pos: [-axo, ay, 0], material: "wood" });
  parts.push({ id: "AR", name: "Short rail", size: [AT, AH, 2 * az], pos: [axo, ay, 0], material: "wood" });
  // the slatted shelves: a batten along the front and the back, slats across them
  const shelfYs = [Math.round(H * 0.19), Math.round(H * 0.52)];
  const BH = 40, BT = 22;
  const slats = 8, slatW = 32, slatT = 14, slatL = 2 * lz + L - 10;
  const shelfPieces: PartPiece[] = [
    { shape: "box", size: [2 * ax, BH, BT], pos: [0, 0, lz] },
    { shape: "box", size: [2 * ax, BH, BT], pos: [0, 0, -lz] },
    ...Array.from({ length: slats }, (_, k): PartPiece => ({ shape: "box", size: [slatW, slatT, slatL], pos: [-ax + 18 + ((2 * ax - 36) * k) / (slats - 1), BH / 2 + slatT / 2, 0] })),
  ];
  shelfYs.forEach((y, k) => parts.push({ id: `SH${k}`, name: "Slatted shelf", size: [2 * ax, BH + slatT, slatL], pos: [0, y + slatT / 2, 0], pieces: shelfPieces.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - slatT / 2, p.pos[2]] as Vec3 })), material: "wood" }));

  const aiz = azo - AT / 2, aix = axo - AT / 2; // apron inside faces
  const angleXs = [-W / 4, W / 4];
  const ya = legTop - 12;
  // corner brackets across each inside corner, a hanger bolt from each leg through it
  const corner = legs.map((g) => {
    const c: Vec3 = [g.sx * (lx - L / 2), legTop - AH / 2, g.sz * (lz - L / 2)];
    const d: Vec3 = [g.sx * Math.SQRT1_2, 0, g.sz * Math.SQRT1_2];
    const back = (k: number): Vec3 => [c[0] - d[0] * k, c[1], c[2] - d[2] * k];
    return { g, c, d, back };
  });
  const cornerScrews = corner.flatMap(({ g }) =>
    [legTop - AH + 22, legTop - 22].flatMap((y): Vec3[] => [
      [g.sx * (ax - 40), y, g.sz * aiz],
      [g.sx * aix, y, g.sz * (az - 40)],
    ]),
  );
  type Leg = (typeof legs)[number];
  const legById = (id: string) => legs.find((g) => g.id === id)!;
  const shelfJoints = (g: Leg) => shelfYs.map((y): Vec3 => [g.sx * ax, y, g.sz * lz]);
  const dowels = (id: string) => fx("dowel", shelfJoints(legById(id)), [legById(id).sx, 0, 0], id);
  // drawn as studs: a cam bolt (a pre-fitting) would bring its leg into place before the leg's own step
  const camBolts = (id: string) => fx("stud", shelfJoints(legById(id)), [legById(id).sx, 0, 0], id, { name: "Cam bolt", len: 34, dia: 7 });
  // a cam lock in the batten's inside face, near the leg
  const camLocks = (id: string) => {
    const g = legById(id);
    return shelfYs.map((y, k) => fx("cam", [[g.sx * (ax - 30), y, g.sz * (lz - BT / 2)]], [0, 0, g.sz], `SH${k}`));
  };
  const hanger = (ids: string[]) =>
    corner.filter((c) => ids.includes(c.g.id)).flatMap(({ g, d, back }) => [fx("washer", [back(28)], d, g.id), fx("nut", [back(30)], d, g.id)]);
  const faceOf = (p: Vec3) => (Math.abs(Math.abs(p[2]) - aiz) < 1 ? (p[2] > 0 ? "AF" : "AB") : p[0] > 0 ? "AR" : "AL");
  const faceDir = (id: string): Vec3 => (id === "AF" ? [0, 0, 1] : id === "AB" ? [0, 0, -1] : id === "AR" ? [1, 0, 0] : [-1, 0, 0]);
  const byFace = (kind: CustomFix["kind"], pts: Vec3[], o: Partial<CustomFix> = {}) =>
    ["AF", "AB", "AL", "AR"].map((id) => fx(kind, pts.filter((p) => faceOf(p) === id), faceDir(id), id, o)).filter((f) => f.count);
  const anglePts = [1, -1].flatMap((sz) => angleXs.map((x): Vec3 => [x, ya, sz * aiz]));
  const castorLegs = legs.filter((g) => g.castor);
  const steps: CustomStep[] = [
    {
      title: "Screw the angle brackets to the long rails",
      detail: "Lay the four rails out. Two brackets on each long rail, one short screw each, the slotted leg flush with the top edge.",
      add: ["AF", "AB"],
      fix: [...byFace("angle", anglePts), ...byFace("screw", anglePts.map((p): Vec3 => [p[0], p[1] - 8, p[2]]), { len: 14, dia: 4 })],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Join the rails with the corner brackets",
      detail: "Stand the rails on their top edges in a rectangle. A corner bracket across each corner, four short screws in each.",
      add: ["AL", "AR"],
      fix: [...corner.map(({ g, d, back }) => fx("plate", [back(22)], d, g.sz > 0 ? "AF" : "AB", { name: "Corner bracket" })), ...byFace("screw", cornerScrews, { len: 14, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the frame to the underside of the top",
      detail: "Lay the top face down on a rug, centre the frame on it and drive one short screw up through each angle bracket.",
      add: ["TOP"],
      fix: [fx("screw", anglePts.map((p): Vec3 => [p[0], legTop, p[2] - Math.sign(p[2]) * 12]), [0, 1, 0], "TOP", { len: 14, dia: 4 })],
      tools: ["screwdriver"],
      from: { TOP: [0, -300, 0] },
    },
    {
      title: "Screw the cam bolts into the back legs",
      detail: "Into the holes on the inside face of the two back legs, by hand, until they stop.",
      fix: [camBolts("LBL"), camBolts("LBR")],
      tools: ["screwdriver"],
    },
    {
      title: "Fit a barrel nut and a hanger bolt in each leg",
      detail: "Push the barrel nut into the hole in the top end, slot lined up with the bolt hole, then screw the hanger bolt in at the corner until it catches.",
      fix: [
        ...corner.map(({ g }) => fx("nut", [[g.sx * lx, legTop, g.sz * lz]], [0, -1, 0], g.id, { name: "Barrel nut" })),
        ...corner.map(({ g, c, d }) => fx("stud", [c], d, g.id, { name: "Hanger bolt", len: 100, dia: 8 })),
      ],
      tools: ["flathead"],
    },
    {
      title: "Bolt on the two left legs",
      detail: "Square end up against the top. Each hanger bolt goes through its corner bracket: washer, then nut, tightened with a spanner.",
      add: ["LFL", "LBL"],
      fix: hanger(["LFL", "LBL"]),
      tools: ["wrench"],
    },
    {
      title: "Turn it on its side and slide in the shelves",
      detail: "Lay it on the two legs you've fitted. Tap a dowel into the front leg for each shelf, then press the shelves down onto the dowels and cam bolts.",
      add: ["SH0", "SH1"],
      fix: [dowels("LFL")],
      tools: ["hammer"],
      pose: "+x",
    },
    { title: "Lock the shelves to the back leg", detail: "A cam lock in each shelf's back batten, arrow towards the bolt, turned clockwise until it pulls tight.", fix: camLocks("LBL"), tools: ["screwdriver"] },
    {
      title: "Put the other two legs on",
      detail: "Two dowels in the front leg first. Press both legs down onto the shelves' ends and over the hanger bolts.",
      add: ["LFR", "LBR"],
      fix: [dowels("LFR")],
      tools: ["hammer"],
    },
    { title: "Bolt the right legs to the frame", detail: "Turn it upside down again. A washer and a nut on each hanger bolt, tightened with a spanner.", fix: hanger(["LFR", "LBR"]), tools: ["wrench"], pose: "-y" },
    { title: "Lock the shelves to the other back leg", detail: "Two cam locks, turned clockwise until tight.", fix: camLocks("LBR"), tools: ["screwdriver"] },
    {
      title: "Screw the castors under the short legs",
      detail: "Four screws through each castor plate into the end of the leg. Use the longer screws here.",
      fix: [
        ...castorLegs.map((g) => fx("castor", [[g.sx * lx, CASTOR, g.sz * lz]], [0, 1, 0], g.id)),
        ...castorLegs.map((g) => fx("screw", [-1, 1].flatMap((a) => [-1, 1].map((b): Vec3 => [g.sx * lx + a * 16, CASTOR, g.sz * lz + b * 16])), [0, 1, 0], g.id, { len: 30, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Turn it over onto its wheels", detail: "Lift it by the top, not the shelves. Check it stands level on all four.", pose: "+y" },
  ];
  return { parts, steps };
}

/** Lying-down spots for the trolley's legs: on the floor beside the upside-down top while they're fitted out, then beside it on its side. */
function trolleyStages(s: ProductSpec): Record<number, { id: string; pos: Vec3; rot: Vec3 }[]> {
  const H = s.size.h * 10, W = s.size.w * 10, D = s.size.d * 10;
  const ids = ["LFL", "LBL", "LFR", "LBR"];
  return {
    3: ids.map((id, k) => ({ id, pos: [0, H - 23, D / 2 + 110 + k * 75], rot: [0, 0, Math.PI / 2] })),
    6: ["LFR", "LBR"].map((id, k) => ({ id, pos: [-W / 2 + 23, H / 2, D / 2 + 110 + k * 75], rot: [0, 0, 0] })),
  };
}

/** Builds a recipe, showing some parts elsewhere (laid on the floor) from a given step until their own step adds them. */
function buildStaged(b: PlanBuilder, s: ProductSpec, recipe: CustomParams, stages: Record<number, { id: string; pos: Vec3; rot: Vec3 }[]>) {
  const keyOf = (id: string) => {
    const p = recipe.parts.find((q) => q.id === id)!.pos;
    return b.items.find((it) => it.kind === "part" && it.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5))?.key;
  };
  const step = b.step.bind(b);
  b.step = (def, body) =>
    step(def, () => {
      const list = stages[b.steps.length - 1] ?? [];
      if (list.length) {
        b.stagger(0.12);
        for (const g of list) {
          const k = keyOf(g.id);
          if (k) b.stage(k, g.pos, g.rot, [0, 200, 0]);
        }
        b.then(0.15);
      }
      body();
    });
  try {
    buildCustom(b, { ...s, custom: recipe });
  } finally {
    b.step = step;
  }
}

const family: Family = {
  names: ["BEKVÄM", "BEKVAM"],
  build(b, s) {
    if (kindOf(s) !== "trolley") return false;
    buildStaged(b, s, trolley(s), trolleyStages(s));
    return true;
  },
  recipe(s) {
    const k = kindOf(s);
    if (k === "stool") return stool(s);
    if (k === "ladder") return ladder(s);
    return null;
  },
};
export default family;
