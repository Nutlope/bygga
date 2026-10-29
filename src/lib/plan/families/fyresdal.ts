import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FYRESDAL, read from the daybed frame's manual. The steel back and the two end frames each get their leg tubes
 * pushed in and screwed, then the ends are bolted to the back. The bed frame is built upside down: long rails with
 * brackets, three middle legs screwed on with plates, turned over, cross tubes pushed in, and the pull-out frame
 * fitted underneath with its own rails and tubes. Two people lift the back and ends over the frame and push the tube
 * ends into their holes, it is all bolted together, the slat brackets clicked on and screwed, and the slats clipped
 * into their holders: the top bed's first, then the pull-out bed's.
 */

const TUBE = 25;

/** A round tube along an axis, as a piece of the part centred at c. */
function rod(a: Vec3, b: Vec3, c: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const rot: Vec3 = Math.abs(d[0]) > Math.abs(d[1]) && Math.abs(d[0]) > Math.abs(d[2]) ? [0, 0, Math.PI / 2] : Math.abs(d[2]) > Math.abs(d[1]) ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot };
}

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 197 long, 105 deep, 94 high; mattress 97 x 189
  const L = 1970, Dp = 1050, H = 940;
  const xe = L / 2 - TUBE / 2, zb = -Dp / 2 + TUBE / 2, zf = Dp / 2 - TUBE / 2;
  const yLow = 430; // lower rails of the back and ends, where the leg tubes join
  const yArm = 720;
  const parts: CustomPart[] = [];
  const part = (id: string, name: string, pieces: PartPiece[], c: Vec3, size: Vec3) => parts.push({ id, name, size, pos: c, pieces, material: "metal" });
  const tubePart = (id: string, name: string, a: Vec3, b: Vec3, dia = TUBE) => {
    const c: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const ext: Vec3 = [Math.abs(b[0] - a[0]) || dia, Math.abs(b[1] - a[1]) || dia, Math.abs(b[2] - a[2]) || dia];
    part(id, name, [rod(a, b, c, dia)], c, ext);
  };

  // the back: top and bottom rails, posts at the ends and pairs of bars between
  {
    const c: Vec3 = [0, (yLow + H - TUBE / 2) / 2, zb];
    const yT = H - TUBE / 2;
    const p: PartPiece[] = [rod([-xe, yT, zb], [xe, yT, zb], c), rod([-xe, yLow, zb], [xe, yLow, zb], c), ...[-1, 1].map((sx) => rod([sx * xe, yLow, zb], [sx * xe, yT, zb], c))];
    for (let i = 0; i < 6; i++) for (const o of [-22, 22]) {
      const x = -xe + ((i + 1) * 2 * xe) / 7 + o;
      p.push(rod([x, yLow, zb], [x, yT, zb], c, 16));
    }
    part("BK", "Back frame", p, c, [L, yT - yLow + TUBE, TUBE]);
  }
  tubePart("BL1", "Leg tube", [-xe, 0, zb], [-xe, yLow, zb], 30);
  tubePart("BL2", "Leg tube", [xe, 0, zb], [xe, yLow, zb], 30);
  // an end frame: top and bottom rails from the back to the front post, with bars
  for (const [id, sx] of [["E1", -1], ["E2", 1]] as const) {
    const x = sx * (xe - 2);
    const z0 = zb + TUBE;
    const c: Vec3 = [x, (yLow + yArm) / 2, (z0 + zf) / 2];
    const p: PartPiece[] = [rod([x, yArm, z0], [x, yArm, zf], c), rod([x, yLow, z0], [x, yLow, zf], c), rod([x, yLow, zf], [x, yArm, zf], c)];
    for (const z of [-80, -40, 40, 80]) p.push(rod([x, yLow, z], [x, yArm, z], c, 16));
    part(id, "End frame", p, c, [TUBE, yArm - yLow + TUBE, zf - z0 + TUBE]);
  }
  tubePart("EL1", "Leg tube", [-xe, 0, zf], [-xe, yLow, zf], 30);
  tubePart("EL2", "Leg tube", [xe, 0, zf], [xe, yLow, zf], 30);

  // the bed frame: long rails at the back, middle and front, three middle legs along the back, cross tubes
  // the back rail sits against the back frame's lower rail, so the short bolt goes through one into the other
  const yR = 415, xr = xe - 30;
  const zR = { b: zb + 28, m: 0, f: zf - 40 };
  tubePart("RB", "Long rail", [-xr, yR, zR.b], [xr, yR, zR.b], 30);
  tubePart("RF", "Long rail", [-xr, yR, zR.f], [xr, yR, zR.f], 30);
  tubePart("RM", "Long rail", [-xr, yR, zR.m], [xr, yR, zR.m], 30);
  const legX = [-640, 0, 640];
  // each middle leg has a plate on top that screws up into the back rail
  legX.forEach((x, i) => {
    const c: Vec3 = [x, (yR - 15) / 2, zR.b];
    part(`ML${i + 1}`, "Middle leg", [rod([x, 0, zR.b], [x, yR - 19, zR.b], c, 30), { shape: "box", size: [80, 4, 30], pos: [0, (yR - 17) - c[1], 0] }], c, [80, yR - 15, 30]);
  });
  legX.forEach((x, i) => tubePart(`C${i + 1}`, "Cross tube", [x, yR - 30, zR.b + 15], [x, yR - 30, zR.f - 15], 22));
  // the pull-out frame under it, and its cross tubes
  const yP = 200, zP = 440, xP = xr - 60;
  {
    const c: Vec3 = [0, yP / 2, 0];
    const p: PartPiece[] = [rod([-xP, yP, -zP], [xP, yP, -zP], c), rod([-xP, yP, zP], [xP, yP, zP], c), ...[-1, 1].map((sx) => rod([sx * xP, 0, zP], [sx * xP, yP, zP], c))];
    part("PO", "Pull-out frame", p, c, [2 * xP + TUBE, yP + TUBE, 2 * zP + TUBE]);
  }
  tubePart("PT1", "Pull-out tube", [-xP + 40, yP, -zP + 12], [-xP + 40, yP, zP - 12], 22);
  tubePart("PT2", "Pull-out tube", [0, yP, -zP + 12], [0, yP, zP - 12], 22);
  tubePart("PT3", "Pull-out tube", [xP - 40, yP, -zP + 12], [xP - 40, yP, zP - 12], 22);
  // slats: the top bed's across the rails, the pull-out bed's lower down
  const slats = (id: string, name: string, n: number, y: number, x0: number, z0: number) => {
    const c: Vec3 = [0, y, 0];
    const p: PartPiece[] = Array.from({ length: n }, (_, i) => {
      const x = -x0 + (i * 2 * x0) / (n - 1);
      return rod([x, y, -z0], [x, y, z0], c, 18);
    });
    part(id, name, p, c, [2 * x0 + 18, 18, 2 * z0]);
  };
  slats("SU", "Slats, top bed", 36, yR + 24, xr - 20, zR.f);
  slats("SL", "Slats, pull-out bed", 34, yP + 22, xP - 20, zP);

  const screw = (on: string | undefined, at: Vec3[], dir: Vec3 = [0, -1, 0]): CustomFix => ({ kind: "screw", count: at.length, len: 12, dia: 6, at, dir, on });
  const longBolts = (pts: Vec3[], dir: Vec3, on: string | undefined, mate: string): CustomFix => ({ kind: "bolt", count: pts.length, len: 60, dia: 8, name: "Long bolt", at: pts, dir, on, mate });
  return {
    parts,
    steps: [
      {
        title: "Push the leg tubes into the back",
        detail: "Lay the back flat on a rug. Each tube's flat side goes in first, holes lined up with the holes in the back.",
        add: ["BK", "BL1", "BL2"],
        pose: "+z",
        warnings: ["floor"],
      },
      { title: "Screw the tubes to the back", detail: "One screw in each, through the hole on top.", fix: [screw(undefined, [-1, 1].map((sx): Vec3 => [sx * xe, yLow - 30, zb + 15]), [0, 0, -1])], tools: ["allen"] },
      { title: "Push the leg tubes into the end frames", detail: "One into the front post of each frame, holes lined up.", wait: ["E1", "E2", "EL1", "EL2"] },
      { title: "Screw them to the end frames", detail: "One screw in each.", fix: [...[-1, 1].map((sx) => screw(sx < 0 ? "EL1" : "EL2", [[sx * xe, yLow - 30, zf + 15]], [0, 0, -1]))], wait: ["E1", "E2", "EL1", "EL2"], tools: ["allen"] },
      {
        title: "Bolt the end frames to the back",
        detail: "Stand the back up. Two long bolts join each end frame to a back post; the holes with flat sides face in.",
        add: ["E1", "E2", "EL1", "EL2"],
        fix: [-1, 1].map((sx) => longBolts([yLow, yArm].map((y): Vec3 => [sx * (xe - 2), y, zb + TUBE + 30]), [0, 0, -1], sx < 0 ? "E1" : "E2", "BK")),
        pose: "+y",
        people: 2,
      },
      { title: "Screw a bracket onto the back rail", detail: "The bed frame is built upside down on the floor, beside the back. Brackets on the rails face up.", add: ["RB"], fix: [screw("RB", [[-xr + 40, yR + 15, zR.b]])], tools: ["allen"], warnings: ["floor"] },
      { title: "Screw the middle rail on", detail: "Its plain end into the bracket, one screw.", add: ["RM"], fix: [screw("RM", [[-xr + 40, yR + 15, 0]])], tools: ["allen"] },
      { title: "Join the front rail", detail: "The bracket on its inside, one screw.", add: ["RF"], fix: [screw("RF", [[-xr + 40, yR + 15, zR.f]])], tools: ["allen"] },
      { title: "Lock the middle joint", detail: "One more screw at the other end of the middle rail.", fix: [screw("RM", [[xr - 40, yR + 15, 0]])], tools: ["allen"] },
      {
        title: "Screw the three middle legs on",
        detail: "Plate flat on the back rail, two screws each, then turn a glide into the foot of the outer two.",
        add: ["ML1", "ML2", "ML3"],
        fix: [
          { kind: "screw", count: 6, len: 12, dia: 6, at: legX.flatMap((x) => [-1, 1].map((e): Vec3 => [x + e * 28, yR - 19, zR.b])), dir: [0, 1, 0], mate: "RB" },
          { kind: "foot", count: 2, len: 15, dia: 30, name: "Glide", at: [legX[0], legX[2]].map((x): Vec3 => [x, 0, zR.b]), dir: [0, 1, 0] },
        ],
        tools: ["allen"],
      },
      { title: "Turn the frame over", detail: "Stand the bed frame the right way up, on its three middle legs." },
      { title: "Push the three cross tubes in", detail: "Through the holes in the long rails, from the back.", add: ["C1", "C2", "C3"], from: { C1: [0, 0, -600], C2: [0, 0, -600], C3: [0, 0, -600] } },
      {
        title: "Fit the pull-out frame underneath",
        detail: "Slide it in from the front under the rails. Two short bolts hold its stops, then three screws lock the cross tubes.",
        add: ["PO"],
        fix: [{ kind: "bolt", count: 2, len: 20, dia: 8, name: "Short bolt", at: [-1, 1].map((sx): Vec3 => [sx * xP, yP, -zP - 12]), dir: [0, 0, 1], on: "PO" }, screw(undefined, legX.map((x): Vec3 => [x, yR - 15, zR.f - 15]), [0, -1, 0])],
        from: { PO: [0, 0, 700] },
        tools: ["allen"],
      },
      { title: "Push in the pull-out tubes", detail: "One in the middle first, then one at each end.", add: ["PT2", "PT1", "PT3"], from: { PT1: [0, 0, 600], PT2: [0, 0, 600], PT3: [0, 0, 600] } },
      {
        title: "Lift the back and ends over the frame",
        detail: "With two people, lower them over the bed frame so the three cross tubes go into the holes in the back's lower rail.",
        people: 2,
      },
      {
        title: "Bolt the frame to the back and ends",
        detail: "One short bolt and one screw at the middle, then two long bolts through each end frame into the rails.",
        fix: [
          { kind: "bolt", count: 1, len: 20, dia: 8, name: "Short bolt", at: [[0, yLow - 6, zb - 2]], dir: [0, 0, 1], on: "BK", mate: "RB" },
          screw("RM", [[0, yR + 15, 0]]),
          ...[-1, 1].flatMap((sx) => (["RB", "RF"] as const).map((r) => longBolts([[sx * xe, yR + 3, r === "RB" ? zR.b : zR.f]], [-sx, 0, 0], sx < 0 ? "E1" : "E2", r))),
        ],
        tools: ["allen"],
      },
      {
        title: "Click on the slat brackets and screw them",
        detail: "Snap one onto each end of the middle rail until it clicks, then a screw in each. Two countersunk screws fix the front rail's ends.",
        fix: [
          { kind: "clip", count: 2, len: 40, dia: 30, name: "Slat bracket", at: [-1, 1].map((sx): Vec3 => [sx * (xr - 40), yR + 15, 0]), dir: [0, -1, 0], on: "RM" },
          { kind: "screw", count: 2, len: 12, dia: 6, at: [-1, 1].map((sx): Vec3 => [sx * (xr - 66), yR + 15, 0]), dir: [0, -1, 0], on: "RM" },
          { kind: "screw", count: 2, len: 20, dia: 5, name: "Countersunk screw", at: [-1, 1].map((sx): Vec3 => [sx * (xr - 10), yR + 15, zR.f]), dir: [0, -1, 0], on: "RF" },
        ],
        tools: ["allen"],
      },
      {
        title: "Clip the slats into the top bed",
        detail: "Holders on both ends of each slat, then press them onto the rails until they click. Work from one end to the other.",
        add: ["SU"],
        fix: [{ kind: "clip", count: 35, len: 30, dia: 20, name: "Slat holder", to: ["SU"] }],
      },
      {
        title: "Clip the slats into the pull-out bed",
        detail: "The same way, on the lower frame. Then pull it out and lift it to check it locks level with the top bed.",
        add: ["SL"],
      },
    ],
  };
}

const family: Family = {
  names: ["FYRESDAL"],
  recipe(s) {
    return /daybed/i.test(`${s.slug ?? ""} ${s.variant}`) ? recipe(s) : null;
  },
};
export default family;
