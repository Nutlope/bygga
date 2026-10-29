import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KROKHOLMEN, read from the garden coffee table's manual. The base is two bent steel tubes that cross in the middle:
 * with it upside down on a rug they are unfolded and screwed together where they cross. The base is turned over, the
 * mesh tray is laid on it and screwed down into the four legs from inside, and a cap is pressed over each screw.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 73 across, 44 high
  const Dm = s.size.w * 10 || 730, H = s.size.h * 10 || 440;
  const rim = 45, yT = H - rim; // underside of the tray
  const r = Dm / 2 - 40; // legs, centre to tube
  const rf = r + 20, yF = 30; // the bend at each foot
  const yX = 150; // where the tubes cross
  const tube = 16;
  const yc = yT / 2;
  const tubePart = (id: string, phi: number, dy: number): CustomPart => {
    const pieces: PartPiece[] = [];
    for (const sx of [1, -1]) {
      const c = Math.cos(phi) * sx, sn = Math.sin(phi) * sx;
      pieces.push({ shape: "cyl", size: [tube, yT - yF, tube], pos: [r * c, (yT + yF) / 2 - yc, r * sn] });
      pieces.push({ shape: "cyl", size: [tube, 24, tube], pos: [((r + rf) / 2) * c, yF - yc, ((r + rf) / 2) * sn], rot: [0, -phi, Math.PI / 2] });
      const L = Math.hypot(rf, yX + dy - yF), a = -Math.atan2(rf, yX + dy - yF);
      pieces.push({ shape: "cyl", size: [tube, L, tube], pos: [(rf / 2) * c, (yF + yX + dy) / 2 - yc, (rf / 2) * sn], rot: [0, sx > 0 ? -phi : Math.PI - phi, a] });
    }
    // the flattened middle where the two tubes cross and are screwed together
    pieces.push({ shape: "cyl", size: [tube + 8, tube, tube + 8], pos: [0, yX + dy - yc, 0] });
    const ex = 2 * rf * Math.abs(Math.cos(phi)) + tube, ez = 2 * rf * Math.abs(Math.sin(phi)) + tube;
    return { id, name: "Base tube", size: [ex, yT, ez], pos: [0, yc, 0], material: "metal", pieces };
  };
  const legs: Vec3[] = [1, 3, 5, 7].map((k) => [r * Math.cos((k * Math.PI) / 4), yT + 2, r * Math.sin((k * Math.PI) / 4)]);
  const intoLegs = (kind: CustomFix["kind"], o: Partial<CustomFix> = {}): CustomFix[] =>
    (["A", "B"] as const).map((tb, i) => ({ kind, count: 2, at: [legs[i], legs[i + 2]], dir: [0, -1, 0], on: "T", ...(o.len ? { mate: tb } : {}), ...o }));
  return {
    parts: [
      tubePart("A", Math.PI / 4, 0),
      tubePart("B", (3 * Math.PI) / 4, tube),
      { id: "T", name: "Mesh tray", shape: "cyl", size: [Dm, rim, Dm], pos: [0, yT + rim / 2, 0], material: "metal" },
    ],
    steps: [
      {
        title: "Unfold the base and screw the tubes together",
        detail: "Stand it upside down on a rug, open the two tubes into a cross and screw them together where they meet.",
        add: ["A", "B"],
        fix: [{ kind: "bolt", count: 1, len: 16, dia: 6, at: [[0, yX - tube / 2 + 1, 0]], dir: [0, 1, 0], on: "A", mate: "B" }],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Screw the tray onto the legs",
        detail: "Turn the base over, lay the tray on it with its holes over the legs, and screw down into each leg.",
        add: ["T"],
        fix: intoLegs("bolt", { len: 16, dia: 6 }),
        pose: "+y",
      },
      { title: "Press a cap over each screw", detail: "Push them in by hand until they sit flush with the mesh.", fix: intoLegs("cap", { dia: 18 }) },
    ],
  };
}

const family: Family = { names: ["KROKHOLMEN"], recipe };
export default family;
