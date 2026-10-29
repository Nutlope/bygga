import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwItem, HwKind, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * LERHOLMEN, read from the picnic table's manual. The two middle battens take their dowels lying flat, are turned
 * over and each gets a diagonal strut bolted on. The top is four slatted panels pinned together, upside down; the
 * battens are pressed onto it, the two long rails slide onto the batten ends and are bolted down. Each end frame
 * slides on over the rails and its strut and is bolted to the top, the rails and the strut; then two people turn it
 * over. Each bench is two halves pinned together and two rails bolted underneath, built upside down beside the table,
 * then turned over, lowered between the end frames and bolted to them.
 */

const fx = (kind: HwKind, at: Vec3[], dir: Vec3, on: string, more: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...more });
const DOWEL = { len: 40, dia: 10 };
const BOLT = { len: 80, dia: 6 };
const LONG = { len: 90, dia: 6 };
const SHORT = { len: 60, dia: 6 };
const NUT = { name: "Barrel nut", len: 14, dia: 10 };
const PIN = { name: "Steel pin", len: 50, dia: 8 };
const WASHER = { len: 2, dia: 16 };

const L = 1500, H = 760, D = 750; // top: 150 x 75, 76 high
const ST = 20; // slats
const topY = H - ST / 2;
const batX = 42.5, batY = 710, batD = 625; // the two middle battens, 4 cm apart
const railZ = 335, railY = 705, frameX = L / 2 - 22.5, frameIn = frameX - 22.5;
const postY = 470; // where the struts meet the end frames' middle posts
const benchY = 450, benchZ = 610, benchRailY = 410, cz = 85; // bench rails sit cz either side of the bench middle

const slats = (len: number, width: number, n: number): PartPiece[] => {
  const w = 55, gap = (width - n * w) / (n - 1);
  return Array.from({ length: n }, (_, i) => ({ shape: "box", size: [len, ST, w], pos: [0, 0, -width / 2 + w / 2 + i * (w + gap)] }));
};

function parts(): CustomPart[] {
  const out: CustomPart[] = [];
  // top panels: P0 back left, P1 back right, P2 front left, P3 front right
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) =>
    out.push({ id: `P${i}`, name: "Top panel", size: [L / 2, ST, D / 2], pos: [(sx * L) / 4, topY, (sz * D) / 4], material: "wood", pieces: slats(L / 2, D / 2, 6) }),
  );
  [-1, 1].forEach((sx, i) => out.push({ id: `B${i}`, name: "Batten", size: [45, 60, batD], pos: [sx * batX, batY, 0], material: "wood" }));
  // S0 runs from the right-hand batten out to the right end frame, S1 to the left
  const x0 = batX + 22.5, dx = frameIn - x0, dy = batY - 5 - postY;
  [1, -1].forEach((sx, i) =>
    out.push({ id: `S${i}`, name: "Strut", size: [Math.hypot(dx, dy), 45, 45], pos: [sx * (x0 + dx / 2), postY + dy / 2, 0], rot: [0, 0, -sx * Math.atan2(dy, dx)], material: "wood" }),
  );
  [1, -1].forEach((sz, i) => out.push({ id: `R${i}`, name: "Long rail", size: [2 * frameIn, 70, 45], pos: [0, railY, sz * railZ], material: "wood" }));
  // an end frame comes in one piece: the bar under the top, two legs, a middle post and the long bench arm
  const fh = H - ST;
  [1, -1].forEach((sx, i) =>
    out.push({
      id: `F${i}`, name: "End frame", size: [45, fh, 1470], pos: [sx * frameX, fh / 2, 0], material: "wood",
      pieces: [
        { shape: "box", size: [45, 70, D], pos: [0, railY - fh / 2, 0] },
        ...[-1, 1].map((z): PartPiece => ({ shape: "box", size: [45, 670, 70], pos: [0, 335 - fh / 2, z * 320] })),
        { shape: "box", size: [45, 230, 70], pos: [0, 555 - fh / 2, 0] },
        { shape: "box", size: [45, 60, 1470], pos: [0, benchRailY - fh / 2, 0] },
      ],
    }),
  );
  [1, -1].forEach((sz, k) => {
    [1, -1].forEach((sx, j) => out.push({ id: `Q${k}${j}`, name: "Bench half", size: [L / 2, ST, 250], pos: [(sx * L) / 4, benchY, sz * benchZ], material: "wood", pieces: slats(L / 2, 250, 4) }));
    [1, -1].forEach((o, j) => out.push({ id: `C${k}${j}`, name: "Bench rail", size: [2 * frameIn, 60, 45], pos: [0, benchRailY, sz * benchZ + o * cz], material: "wood" }));
  });
  return out;
}

function steps(): CustomStep[] {
  const pinsBetween = (host: string, mate: string, at: Vec3[], dir: Vec3) => [
    fx("pin", at, dir, host, { ...PIN, mate }),
    fx("washer", at, dir, host, WASHER),
  ];
  const panelAt = (x: number, z: number) => `P${(x > 0 ? 1 : 0) + (z > 0 ? 2 : 0)}`;
  const battenDowels = [0, 1].map((i) => {
    const x = (i ? 1 : -1) * batX;
    return [
      ...[-150, 150].map((z) => fx("dowel", [[x, batY + 30, z]], [0, -1, 0], `B${i}`, { ...DOWEL, mate: panelAt(x, z) })),
      ...[1, -1].map((sz) => fx("dowel", [695, 725].map((y) => [x, y, (sz * batD) / 2] as Vec3), [0, 0, -sz], `B${i}`, { ...DOWEL, mate: sz > 0 ? "R0" : "R1" })),
    ];
  }).flat();
  const strutY = (x: number) => batY - 5 - ((batY - 5 - postY) * (Math.abs(x) - batX - 22.5)) / (frameIn - batX - 22.5);
  const aside: Vec3 = [0, 0, -700];
  const end = (i: number): CustomStep[] => {
    const sx = i ? -1 : 1, F = `F${i}`, S = `S${i}`;
    const out = sx * (frameX + 22.5);
    return [
      {
        title: i ? "Slide the other end frame on" : "Slide an end frame on",
        detail: "Over the ends of both rails, with the strut's dowel going into the hole in the middle post.",
        add: [F],
        people: 2,
      },
      {
        title: "Bolt the frame to the top",
        detail: "Two bolts down through the bar that lies on the top.",
        fix: [-150, 150].map((z) => fx("bolt", [[sx * frameX, railY - 35, z]], [0, 1, 0], F, { ...BOLT, mate: panelAt(sx, z) })),
      },
      {
        title: "Bolt the frame to the rails",
        detail: "A barrel nut into each rail, slot facing the bolt, then a bolt through the frame into it.",
        fix: [
          ...[0, 1].map((r) => fx("nut", [[sx * (frameIn - 40), railY - 35, (r ? -1 : 1) * railZ]], [0, 1, 0], `R${r}`, NUT)),
          ...[0, 1].map((r) => fx("bolt", [[out, railY, (r ? -1 : 1) * railZ]], [-sx, 0, 0], F, { ...LONG, mate: `R${r}` })),
        ],
        tools: ["flathead"],
      },
      {
        title: "Bolt the middle post to the strut",
        detail: "One bolt through the post into the end of the strut.",
        fix: [fx("bolt", [[out, postY, 0]], [-sx, 0, 0], F, { ...LONG, mate: S })],
      },
    ];
  };
  const benches = [0, 1];
  const bz = (k: number) => (k ? -1 : 1) * benchZ;
  return [
    {
      title: "Tap the dowels into the two battens",
      detail: "Lay them flat on a rug. Two dowels go into the wide face of each and two into each end.",
      fix: battenDowels,
      wait: ["B0", "B1"],
      from: { B0: aside, B1: aside },
      pose: "-y",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Turn the battens over",
      detail: "Dowels down, with the countersunk bolt holes facing each other.",
    },
    {
      title: "Bolt a strut to each batten",
      detail: "Put a barrel nut into the end of the strut, then a short bolt through the batten into it. The strut's notch faces up.",
      fix: [0, 1].flatMap((i) => {
        const sx = i ? -1 : 1, x = sx * (batX + 22.5 + 40);
        return [
          fx("nut", [[x, strutY(x), 22.5]], [0, 0, -1], `S${i}`, NUT),
          fx("bolt", [[sx * (batX - 22.5), batY - 5, 0]], [sx, 0, 0], `B${i ? 0 : 1}`, { ...SHORT, mate: `S${i}` }),
        ];
      }),
      wait: ["S0", "S1"],
      from: { S0: aside, S1: aside },
      tools: ["flathead", "allen"],
    },
    {
      title: "Lay a top panel upside down",
      detail: "On the rug, slats down.",
      add: ["P0"],
    },
    {
      title: "Pin two more panels to it",
      detail: "Push a steel pin with a washer into each hole in the edges, then press the panels together.",
      fix: [
        ...pinsBetween("P0", "P1", [-280, -95].map((z) => [0, topY, z] as Vec3), [-1, 0, 0]),
        ...pinsBetween("P0", "P2", [-560, -190].map((x) => [x, topY, 0] as Vec3), [0, 0, -1]),
      ],
      add: ["P1", "P2"],
      from: { P1: [300, 0, 0], P2: [0, 0, 300] },
    },
    {
      title: "Pin on the last panel",
      detail: "Four more pins and washers, then press it into the corner.",
      fix: [
        ...pinsBetween("P1", "P3", [190, 560].map((x) => [x, topY, 0] as Vec3), [0, 0, -1]),
        ...pinsBetween("P2", "P3", [95, 280].map((z) => [0, topY, z] as Vec3), [-1, 0, 0]),
      ],
      add: ["P3"],
      from: { P3: [220, 0, 220] },
    },
    {
      title: "Press the battens onto the middle of the top",
      detail: "Struts pointing out to the ends. Press them down until the dowels are all the way in.",
      add: ["B0", "B1", "S0", "S1"],
    },
    {
      title: "Tap a dowel into the end of each strut",
      fix: [0, 1].map((i) => fx("dowel", [[(i ? -1 : 1) * frameIn, postY, 0]], [i ? 1 : -1, 0, 0], `S${i}`, { ...DOWEL, mate: `F${i}` })),
      tools: ["hammer"],
    },
    {
      title: "Slide the long rails onto the batten ends",
      detail: "One along each long edge of the top.",
      add: ["R0", "R1"],
    },
    {
      title: "Bolt the rails to the top",
      detail: "Four bolts down through each rail.",
      fix: [0, 1].map((r) => fx("bolt", [-550, -200, 200, 550].map((x) => [x, railY - 35, (r ? -1 : 1) * railZ] as Vec3), [0, 1, 0], `R${r}`, BOLT)),
    },
    ...end(0),
    ...end(1),
    {
      title: "Turn the table over together",
      detail: "Two of you, lifting by the end frames.",
      pose: "+y",
      people: 2,
    },
    {
      title: "Pin the two halves of each bench together",
      detail: "Upside down beside the table: a steel pin and a washer in each of the two holes, then press the halves together.",
      fix: benches.flatMap((k) => pinsBetween(`Q${k}0`, `Q${k}1`, [-60, 60].map((dz) => [0, benchY, bz(k) + dz] as Vec3), [1, 0, 0])),
      wait: benches.flatMap((k) => [`Q${k}0`, `Q${k}1`]),
    },
    {
      title: "Tap the dowels into the bench rails",
      detail: "One into each end of every rail.",
      fix: benches.flatMap((k) => [0, 1].map((j) => fx("dowel", [1, -1].map((sx) => [sx * frameIn, benchRailY + 15, bz(k) + (j ? -cz : cz)] as Vec3), [-1, 0, 0], `C${k}${j}`, DOWEL))),
      wait: benches.flatMap((k) => [`C${k}0`, `C${k}1`]),
      tools: ["hammer"],
    },
    {
      title: "Bolt the rails under each bench",
      detail: "Lay two rails along each bench, ends flush with the bench's ends, and turn in eight bolts. Then turn the bench over.",
      fix: benches.flatMap((k) => [0, 1].map((j) => fx("bolt", [-600, -220, 220, 600].map((x) => [x, benchRailY - 30, bz(k) + (j ? -cz : cz)] as Vec3), [0, 1, 0], `C${k}${j}`, BOLT))),
    },
    {
      title: "Lower the benches between the end frames",
      detail: "Tilt each bench a little so the dowels at one end find their holes, then the other, and let it rest on the bench arms.",
      add: benches.flatMap((k) => [`Q${k}0`, `Q${k}1`, `C${k}0`, `C${k}1`]),
      people: 2,
    },
    {
      title: "Bolt the benches to the end frames",
      detail: "A barrel nut into each rail end, then a bolt through the frame into it: eight in all.",
      fix: [
        ...benches.flatMap((k) => [0, 1].map((j) => fx("nut", [1, -1].map((sx) => [sx * (frameIn - 40), benchRailY - 30, bz(k) + (j ? -cz : cz)] as Vec3), [0, 1, 0], `C${k}${j}`, NUT))),
        ...[0, 1].map((i) => fx("bolt", benches.flatMap((k) => [cz, -cz].map((dz) => [(i ? -1 : 1) * (frameX + 22.5), benchRailY - 15, bz(k) + dz] as Vec3)), [i ? 1 : -1, 0, 0], `F${i}`, LONG)),
      ],
      tools: ["flathead", "allen"],
    },
  ];
}

/* ---------------- moving the parts built beside the table ---------------- */

// turned upside down about x through c, then moved so that c lands on to
const flip = (p: Vec3, c: Vec3, to: Vec3): Vec3 => [p[0] - c[0] + to[0], -(p[1] - c[1]) + to[1], -(p[2] - c[2]) + to[2]];
const flipRot = (r: Vec3): Vec3 => [r[0] + Math.PI, r[1], r[2]];

function restage(b: PlanBuilder, list: CustomPart[], stepList: CustomStep[]) {
  const items = b.items.filter((i): i is PartItem => i.kind === "part");
  const item = (id: string) => items[list.findIndex((p) => p.id === id)];
  const stepOf = (title: string) => b.steps.findIndex((s) => s.title === stepList.find((x) => x.title.startsWith(title))?.title);
  const stateAt = (it: PartItem, n: number) => it.states.find((s) => s.step === n);
  const insert = (it: PartItem, st: PartItem["states"][number]) => {
    it.states.push(st);
    it.states.sort((a, x) => a.step - x.step);
  };
  const hwAt = (n: number) => b.items.filter((i): i is HwItem => i.kind === "hw" && i.step === n);

  // the battens take their dowels face up, then are turned over beside the top
  const s1 = stepOf("Tap the dowels into the two"), s2 = stepOf("Turn the battens over");
  const bc: Vec3 = [0, batY, 0], away: Vec3 = [0, 0, -1120];
  for (const id of ["B0", "B1"]) {
    const it = item(id), st = stateAt(it, s1);
    if (!st) continue;
    const plain = st.pos;
    st.pos = flip(it.final.pos, bc, [bc[0] + away[0], bc[1] + 20, bc[2] + away[2]]);
    st.rot = flipRot(it.final.rot);
    insert(it, { ...st, step: s2, pos: plain, rot: it.final.rot, from: undefined, delay: 0.2 });
  }

  // each bench is built upside down on the floor beside its side of the table
  const sp = stepOf("Pin the two halves"), sd = stepOf("Tap the dowels into the bench"), sr = stepOf("Bolt the rails under");
  [0, 1].forEach((k) => {
    const sz = k ? -1 : 1;
    const c: Vec3 = [0, 420, sz * benchZ], to: Vec3 = [0, 40, sz * 1400];
    const pinsDone = Math.max(0, ...hwAt(sp).map((h) => h.delay)) + 0.5;
    [`Q${k}0`, `Q${k}1`].forEach((id, j) => {
      const it = item(id), st = stateAt(it, sp);
      if (!st) return;
      st.pos = flip(it.final.pos, c, to);
      st.rot = flipRot(it.final.rot);
      // the second half is pushed on over the pins
      if (j) Object.assign(st, { from: [-320, 0, 0] as Vec3, delay: pinsDone });
      else st.from = [0, 220, 0];
    });
    [`C${k}0`, `C${k}1`].forEach((id) => {
      const it = item(id), st = stateAt(it, sd);
      if (!st) return;
      const onBench = flip(it.final.pos, c, to);
      st.pos = [onBench[0], 30, onBench[2] + sz * 380];
      st.rot = flipRot(it.final.rot);
      st.from = [0, 220, 0];
      insert(it, { ...st, step: sr, pos: onBench, from: undefined, delay: 0.15 });
    });
  });
  // the rails are laid on before their bolts go in
  for (const h of hwAt(sr)) h.delay += 0.9;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (!/picnic/i.test(s.variant)) return false;
  const list = parts(), stepList = steps();
  buildCustom(b, { ...s, custom: { parts: list, steps: stepList } });
  restage(b, list, stepList);
  return true;
}

const family: Family = { names: ["LERHOLMEN"], build };
export default family;
