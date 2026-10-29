import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * JUTHOLMEN, from IKEA's two section manuals (one-seat and corner). Every section is built the same way: the two
 * steel leg frames are turned to cross and bolted together in the middle through a spacer, the woven seat is laid
 * upside down and the underframe bolted to it at four tabs, then two people hold it while the back is bolted on from
 * underneath with four bolts. The corner section's two back panels hook together into an L first. Sofas, chairs and
 * the corner sofa are sections side by side, joined with two clips under the seat at each joint, and the KUDDARNA
 * cushions go on last (back cushions only on the tall sets).
 */

type Edge = "back" | "left" | "right" | "front";
interface Mod {
  kind: "seat" | "corner";
  x0: number;
  z0: number;
  w: number;
  d: number;
  panels: Edge[]; // the first one runs the full length, the second stops against it
  cushions: Edge[]; // back cushions lean on these panels
}

const SW = 640, SD = 740; // one-seat section
const CW = 730; // corner section, square
const Y0 = 230, Y1 = 310; // seat frame, underside and top
const PT = 40; // back panel thickness
const PH = 400; // back panel height above the seat
const CT = 130; // back cushion thickness
const SC = 80; // seat cushion

const BOLT_MID = { len: 90, dia: 6 };
const BOLT_LEG = { len: 25, dia: 6 };
const BOLT_BACK = { len: 45, dia: 8 };

function layout(s: ProductSpec): { mods: Mod[]; cushions: boolean; backs: boolean } | null {
  const slug = s.slug ?? "";
  const tall = s.size.h >= 80;
  const seat = (x0: number, cushions: Edge[] = ["back"]): Mod => ({ kind: "seat", x0, z0: 0, w: SW, d: SD, panels: ["back"], cushions });
  const corner = (x0: number, z0: number, panels: Edge[], cushions: Edge[] = ["back"]): Mod => ({ kind: "corner", x0, z0, w: CW, d: CW, panels, cushions });
  if (/one-seat-section/.test(slug)) return { mods: [seat(0)], cushions: false, backs: false };
  if (/corner-section/.test(slug)) return { mods: [corner(0, 0, ["back", "left"])], cushions: false, backs: false };
  if (/easy-chair|-chair-/.test(slug)) return { mods: [seat(0)], cushions: true, backs: tall };
  if (/modular-corner-sofa/.test(slug))
    return {
      // the bend at the back left, two one-seat sections along the back, and a corner section turned to close the left run
      mods: [corner(0, 0, ["back", "left"], ["back", "left"]), seat(CW), seat(CW + SW), corner(0, CW, ["left", "front"], ["left"])],
      cushions: true,
      backs: tall,
    };
  if (/2-seat/.test(slug)) return { mods: [corner(0, 0, ["back", "left"]), corner(CW, 0, ["back", "right"])], cushions: true, backs: tall };
  if (/3-seat/.test(slug)) return { mods: [corner(0, 0, ["back", "left"]), seat(CW), corner(CW + SW, 0, ["back", "right"])], cushions: true, backs: tall };
  return null;
}

/** A tube from p to q as a cylinder piece (pieces are drawn along y, then turned). */
function tube(p: Vec3, q: Vec3, dia: number, c: Vec3): PartPiece {
  const v: Vec3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const len = Math.hypot(...v);
  const u = v.map((x) => x / len);
  const tilt = Math.acos(Math.max(-1, Math.min(1, u[1])));
  const yaw = Math.hypot(u[0], u[2]) > 1e-6 ? Math.atan2(u[2], -u[0]) : 0;
  return { shape: "cyl", size: [dia, len, dia], pos: [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1], (p[2] + q[2]) / 2 - c[2]], rot: [0, yaw, tilt], material: "metal" };
}

/** Two bent tubes that cross under the seat: each has a leg at two opposite corners, joined by a rising arch. */
function underframe(m: Mod, cx: number, cz: number): { parts: Omit<CustomPart, "id">[]; tabs: Vec3[]; mid: Vec3; yA: number } {
  const a = m.w / 2 - 35, b = m.d / 2 - 35;
  const c: Vec3 = [cx, Y0 / 2, cz];
  const yA = 196, yB = 168, dia = 22;
  const hoop = (sx: number, yc: number) => {
    const pieces: PartPiece[] = [];
    for (const s of [-1, 1]) {
      const foot: Vec3 = [cx + s * sx * a, 0, cz + s * b];
      const top: Vec3 = [foot[0], Y0, foot[2]];
      pieces.push(tube(foot, top, dia, c));
      // the arch rises from low on the leg to the crossing, steep first and flat at the top
      const at = (f: number): Vec3 => [cx + s * sx * a * (1 - f), 50 + (yc - 50) * Math.sin((f * Math.PI) / 2), cz + s * b * (1 - f)];
      const fs = [0, 0.3, 0.6, 1];
      for (let k = 0; k < fs.length - 1; k++) pieces.push(tube(at(fs[k]), at(fs[k + 1]), dia, c));
      pieces.push({ shape: "box", size: [44, 4, 44], pos: [top[0] - c[0], Y0 - 2 - c[1], top[2] - c[2]], material: "metal" });
    }
    return pieces;
  };
  // two separate leg frames, the high arch crossing over the low one
  const frames = [hoop(1, yA), hoop(-1, yB)].map((pieces) => ({ name: "Leg frame", size: [m.w - 48, Y0, m.d - 48] as Vec3, pos: c, material: "metal" as const, pieces }));
  const tabs: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [cx + sx * a, Y0, cz + sz * b] as Vec3));
  return { parts: frames, tabs, mid: [cx, yA + dia / 2, cz], yA };
}

function recipeOf(s: ProductSpec): CustomParams | null {
  const L = layout(s);
  if (!L) return null;
  const { mods } = L;
  const X = Math.max(...mods.map((m) => m.x0 + m.w)), Z = Math.max(...mods.map((m) => m.z0 + m.d));
  const parts: CustomPart[] = [];
  const ids = { frames: [] as string[], seats: [] as string[], backs: [] as string[], corners: [] as string[], cush: [] as string[], backC: [] as string[] };
  const fix = { mid: [] as Vec3[], tabs: [] as Vec3[], back: [] as Vec3[] };
  const n = mods.length;

  mods.forEach((m, i) => {
    const x0 = m.x0 - X / 2, z0 = m.z0 - Z / 2, x1 = x0 + m.w, z1 = z0 + m.d;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const u = underframe(m, cx, cz);
    u.parts.forEach((pt, k) => {
      parts.push({ id: `U${i}${k}`, ...pt });
      ids.frames.push(`U${i}${k}`);
    });
    fix.mid.push(u.mid);
    fix.tabs.push(...u.tabs);
    parts.push({ id: `S${i}`, name: m.kind === "corner" ? "Corner seat" : "Seat", size: [m.w, Y1 - Y0, m.d], pos: [cx, (Y0 + Y1) / 2, cz], material: "board" });
    ids.seats.push(`S${i}`);
    // the back panels, standing on the seat's edges
    const has = (e: Edge) => m.panels.includes(e);
    const yP = Y1 + PH / 2;
    m.panels.forEach((e, k) => {
      const id = `P${i}${e[0]}`;
      const full = k === 0;
      const along = (lo: number, hi: number, cutLo: boolean, cutHi: boolean) => [lo + (cutLo ? PT : 0), hi - (cutHi ? PT : 0)];
      let size: Vec3, pos: Vec3;
      if (e === "back" || e === "front") {
        const [a, b] = full ? [x0, x1] : along(x0, x1, has("left"), has("right"));
        size = [b - a, PH, PT];
        pos = [(a + b) / 2, yP, e === "back" ? z0 + PT / 2 : z1 - PT / 2];
      } else {
        const [a, b] = full ? [z0, z1] : along(z0, z1, has("back"), has("front"));
        size = [PT, PH, b - a];
        pos = [e === "left" ? x0 + PT / 2 : x1 - PT / 2, yP, (a + b) / 2];
      }
      parts.push({ id, name: k === 0 ? "Back panel" : "Side panel", size, pos, material: "board" });
      (m.kind === "corner" ? ids.corners : ids.backs).push(id);
      // its bolts come up through the seat frame into its bottom edge: four under a one-seat back, two under each corner panel
      const cnt = m.kind === "corner" ? 2 : 4;
      const span = (e === "back" || e === "front" ? size[0] : size[2]) - 120;
      for (let j = 0; j < cnt; j++) {
        const f = -span / 2 + (j * span) / (cnt - 1);
        fix.back.push(e === "back" || e === "front" ? [pos[0] + f, Y0, pos[2]] : [pos[0], Y0, pos[2] + f]);
      }
    });
    if (!L.cushions) return;
    // the seat cushion fills what the panels (and the back cushions on the tall sets) leave free
    const inset = (e: Edge) => (has(e) ? PT + (L.backs && m.cushions.includes(e) ? CT : 0) : 0) + 6;
    const a0 = x0 + inset("left"), a1 = x1 - inset("right"), b0 = z0 + inset("back"), b1 = z1 - inset("front");
    parts.push({ id: `C${i}`, name: "Seat cushion", size: [a1 - a0, SC, b1 - b0], pos: [(a0 + a1) / 2, Y1 + SC / 2, (b0 + b1) / 2], material: "soft" });
    ids.cush.push(`C${i}`);
    if (!L.backs) return;
    const yB = Y1 + SC + (830 - Y1 - SC) / 2, hB = 830 - Y1 - SC - 4;
    m.cushions.forEach((e, k) => {
      const id = `B${i}${e[0]}`;
      const lean = 0.12;
      if (e === "back" || e === "front") {
        const a = x0 + (has("left") ? PT + (k > 0 ? CT : 0) : 6), b = x1 - (has("right") ? PT : 6);
        const z = e === "back" ? z0 + PT + CT / 2 : z1 - PT - CT / 2;
        parts.push({ id, name: "Back cushion", size: [b - a, hB, CT - 20], pos: [(a + b) / 2, yB, z], rot: [e === "back" ? -lean : lean, 0, 0], material: "soft" });
      } else {
        const a = z0 + (has("back") ? PT + (k > 0 ? CT : 0) : 6), b = z1 - (has("front") ? PT : 6);
        const x = e === "left" ? x0 + PT + CT / 2 : x1 - PT - CT / 2;
        parts.push({ id, name: "Back cushion", size: [CT - 20, hB, b - a], pos: [x, yB, (a + b) / 2], rot: [0, 0, e === "left" ? lean : -lean], material: "soft" });
      }
      ids.backC.push(id);
    });
  });

  const many = n > 1;
  const each = many ? " Do the same for each section." : "";
  const pts = (k: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind: k, count: at.length, at, dir, ...o });
  const steps: CustomStep[] = [
    {
      title: many ? "Open out the underframes" : "Open out the underframe",
      detail: `Stand the two leg frames on the floor and turn one round on the other until they cross, the tabs at the top.${each}`,
      add: ids.frames,
      warnings: ["floor"],
    },
    {
      title: "Bolt the leg frames together in the middle",
      detail: "Push the spacer sleeve in between the tubes where they cross, then the long bolt from above with the spring washer and a washer under its head. Tighten it fully.",
      fix: [
        pts("washer", fix.mid.map((p) => [p[0], p[1] - 22, p[2]] as Vec3), [0, -1, 0], { name: "Spacer sleeve", len: 16, dia: 20 }),
        pts("washer", fix.mid, [0, -1, 0], { name: "Spring washer", len: 2, dia: 12 }),
        pts("washer", fix.mid, [0, -1, 0], { len: 1.5, dia: 16 }),
        pts("bolt", fix.mid, [0, -1, 0], BOLT_MID),
      ],
      tools: ["allen"],
    },
    {
      title: many ? "Bolt the underframes to the seats" : "Bolt the underframe to the seat",
      detail: "Lay the seat upside down on a rug and set the underframe on it, feet up. A bolt with a washer through each of the four tabs, not fully tight yet.",
      add: ids.seats,
      pose: "-y",
      fix: [pts("washer", fix.tabs, [0, 1, 0], { len: 1.5, dia: 16 }), pts("bolt", fix.tabs, [0, 1, 0], BOLT_LEG)],
      tools: ["allen"],
      warnings: ["floor"],
    },
    {
      title: "Tighten all five bolts",
      detail: "The four in the tabs and the one in the middle, once the frame sits square on the seat.",
      tools: ["allen"],
    },
  ];
  if (ids.corners.length)
    steps.push({
      title: ids.corners.length > 2 ? "Hook each pair of back panels together" : "Hook the two back panels together",
      detail: "Stand them on the floor at a right angle. The peg on one end drops into the slot on the other: push it down so they make an L.",
      add: ids.corners,
    });
  steps.push({
    title: "Bolt the back on together",
    detail: `One holds the seat on the ${ids.corners.length ? "back panels" : "back"}, upside down, while the other turns four bolts with washers up through the seat frame into ${ids.corners.length ? "their" : "its"} bottom edge.${each}`,
    add: ids.backs,
    fix: [pts("washer", fix.back, [0, 1, 0], { len: 2, dia: 20 }), pts("bolt", fix.back, [0, 1, 0], BOLT_BACK)],
    tools: ["allen"],
    people: 2,
  });
  steps.push({ title: "Turn it over together", detail: "Lift it by the seat frame and set it on its feet.", pose: "+y", people: 2 });

  // clips under the seat at every joint between two sections
  if (many) {
    const clips: Vec3[] = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = mods[i], b = mods[j];
        if (a.x0 + a.w === b.x0 && a.z0 === b.z0) {
          const x = b.x0 - X / 2, z0 = a.z0 - Z / 2, dz = Math.min(a.d, b.d) / 4;
          clips.push([x, Y0, z0 + 2 * dz - dz], [x, Y0, z0 + 2 * dz + dz]);
        } else if (a.z0 + a.d === b.z0 && a.x0 === b.x0) {
          const z = b.z0 - Z / 2, x0 = a.x0 - X / 2, dx = a.w / 4;
          clips.push([x0 + dx, Y0, z], [x0 + 3 * dx, Y0, z]);
        }
      }
    steps.push({
      title: "Clip the sections together",
      detail: "Push them side by side, then push two clips up over the frames of both sections under the seat at each joint.",
      fix: [pts("clamp", clips, [0, 1, 0], { name: "Connecting clip", len: 50, dia: 30 })],
    });
  }
  if (ids.cush.length) steps.push({ title: many ? "Lay the seat cushions on" : "Lay the seat cushion on", detail: "Dots on the underside down, so it doesn't slide.", add: ids.cush, kind: "cushions" });
  if (ids.backC.length) steps.push({ title: ids.backC.length > 1 ? "Put the back cushions in" : "Put the back cushion in", detail: "Lean each one against its panel, behind the seat cushion.", add: ids.backC, kind: "cushions" });
  return { parts, steps };
}

const family: Family = {
  names: ["JUTHOLMEN"],
  recipe: recipeOf,
};
export default family;
