import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VITTSJÖ, read from its manuals. Everything is a black steel frame of square tube, joined with small machine
 * screws, with glass and board shelves dropped in.
 * Shelving units are built lying on one side: a side ladder on the floor, the width rails dropped onto its lugs
 * and screwed one by one, the other ladder lowered onto them. The 100 wide units then get two loose middle posts
 * hooked onto the rails and held with angle brackets. The tall ones get two triangle braces at the back. The top
 * board is screwed into the top frame, which pushes onto the post ends; the bottom board is screwed into the bottom
 * rails. Stood up, fixed to the wall, the glass shelves drop onto clear pads.
 * The round coffee table, laptop table, desk and laptop stand are built upside down where the manual says so.
 * The 90x50 coffee table is the nest of two tables and follows that manual.
 */

type Kind = CustomFix["kind"];
type Seg = [Vec3, Vec3];

const T = 20; // steel tube
const FOOT = { kind: "foot" as const, len: 14, dia: 20 };
const SCREW = { len: 10, dia: 6 }; // machine screw into the tube lugs
const SMALL = { len: 12, dia: 3.5 }; // chipboard screw through a tab into a board
const PAD = { name: "Glass pad", len: 2, dia: 12 };

const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r1 = (n: number) => Math.round(n * 10) / 10;

/** One welded steel frame: square tube along each segment (centre lines), as one part. */
function frame(id: string, name: string, segs: Seg[], extra: PartPiece[] = []): CustomPart {
  const boxes = segs.map(([a, b]) => {
    const lo = a.map((v, i) => Math.min(v, b[i]) - T / 2) as Vec3;
    const hi = a.map((v, i) => Math.max(v, b[i]) + T / 2) as Vec3;
    return { lo, hi };
  });
  for (const p of extra) boxes.push({ lo: p.pos.map((v, i) => v - p.size[i] / 2) as Vec3, hi: p.pos.map((v, i) => v + p.size[i] / 2) as Vec3 });
  const lo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.lo[i]))) as Vec3;
  const hi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.hi[i]))) as Vec3;
  const mid = lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3;
  const pieces: PartPiece[] = boxes.slice(0, segs.length).map((b) => ({
    shape: "box",
    size: b.hi.map((v, i) => r1(v - b.lo[i])) as Vec3,
    pos: b.lo.map((v, i) => r1((v + b.hi[i]) / 2 - mid[i])) as Vec3,
  }));
  for (const p of extra) pieces.push({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 });
  return { id, name, size: hi.map((v, i) => r1(v - lo[i])) as Vec3, pos: mid, pieces, material: "metal" };
}

const tube = (id: string, name: string, size: Vec3, pos: Vec3): CustomPart => ({ id, name, size, pos, material: "metal" });

/* ---------- shelving units ---------- */

function shelving(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tall = H > 1200;
  const wide = W >= 800;
  const F = 10; // feet showing under the posts
  const pt = 12; // top and bottom boards
  const gt = 6; // glass
  const yt = H - pt - T / 2; // top frame rails
  const yp = H - pt - T; // post tops, under the top frame
  const yb = 90; // bottom rails
  const nGlass = tall ? 3 : 1;
  const levels = [yb, ...Array.from({ length: nGlass }, (_, k) => r1(yb + ((yt - yb) * (k + 1)) / (nGlass + 1)))];
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;

  const ladder = (id: string, sx: number) =>
    frame(id, "Side frame", [
      [[sx * xs, F + T / 2, -zs], [sx * xs, yp - T / 2, -zs]],
      [[sx * xs, F + T / 2, zs], [sx * xs, yp - T / 2, zs]],
      ...levels.map((y): Seg => [[sx * xs, y, -zs + T], [sx * xs, y, zs - T]]),
    ]);
  const parts: CustomPart[] = [ladder("L", -1), ladder("R", 1)];
  // the width rails, front and back at each level, from the bottom
  const rails: { id: string; y: number; sz: number }[] = [];
  levels.forEach((y, i) => [-1, 1].forEach((sz) => rails.push({ id: `W${i}${sz < 0 ? "b" : "f"}`, y, sz })));
  for (const r of rails) parts.push(tube(r.id, "Rail", [W - 2 * T, T, T], [0, r.y, r.sz * zs]));
  if (wide) for (const sz of [-1, 1]) parts.push(tube(`M${sz < 0 ? "b" : "f"}`, "Middle post", [T, yp - F, T + 2], [0, (F + yp) / 2, sz * zs]));
  if (tall) for (const sx of [-1, 1]) parts.push({ id: `X${sx < 0 ? "l" : "r"}`, name: "Brace", size: [70, 70, 3], pos: [sx * (W / 2 - 45), levels[2] + 25, -D / 2 - 1.5], material: "metal" });
  parts.push(
    frame("F", "Top frame", [
      [[-xs, yt, -zs], [xs, yt, -zs]],
      [[-xs, yt, zs], [xs, yt, zs]],
      [[-xs, yt, -zs + T], [-xs, yt, zs - T]],
      [[xs, yt, -zs + T], [xs, yt, zs - T]],
    ]),
  );
  parts.push({ id: "P", name: "Top panel", size: [W, pt, D], pos: [0, H - pt / 2, 0] });
  parts.push({ id: "B", name: "Bottom panel", size: [W - 2 * T, pt, D - 2 * T], pos: [0, yb + T / 2 - pt / 2, 0] });
  const glassIds = levels.slice(1).map((_, i) => `G${i}`);
  levels.slice(1).forEach((y, i) => parts.push({ id: glassIds[i], name: "Glass shelf", size: [W - 2 * T, gt, D - 2 * T], pos: [0, y + T / 2 + 1 + gt / 2, 0], material: "glass" }));

  const feet = (sx: number) => fx("foot", [-1, 1].map((sz) => [sx * xs, F, sz * zs] as Vec3), [0, 1, 0], { ...FOOT, on: sx < 0 ? "L" : "R" });
  // a screw through the rail's end into the lug on the side frame, from the front or back face
  // front rails take their screws from the front, back rails from the back
  const railScrews = (ids: string[], sx: number): CustomFix[] =>
    [1, -1]
      .map((sz) => ids.map((id) => rails.find((x) => x.id === id)!).filter((r) => r.sz === sz))
      .filter((rs) => rs.length)
      .map((rs) => fx("screw", rs.map((r) => [sx * (W / 2 - T - 12), r.y, r.sz * (D / 2)] as Vec3), [0, 0, -rs[0].sz], { ...SCREW, on: sx < 0 ? "L" : "R" }));
  const railIds = rails.map((r) => r.id);
  const bottom = railIds.slice(0, 2);
  const steps: CustomStep[] = [];
  const lie = { pose: "+x" as const };
  steps.push({
    title: tall ? "Screw two feet into a side frame" : "Screw the feet into the side frames",
    detail: tall ? "Lay it flat on a rug, lugs up, and turn the feet into the ends of its two posts." : "Two in the ends of each frame's posts. Lay one frame flat on a rug, lugs up.",
    add: ["L"],
    fix: [feet(-1)],
    ...lie,
    warnings: ["floor"],
  });
  if (tall) {
    steps.push({ title: "Drop the bottom rails onto the lugs", detail: "The two rails next to the feet. The screw holes face out, the hooks the way the drawing shows.", add: bottom });
    steps.push({ title: "Screw the bottom rails on", detail: "One screw through each rail into its lug.", fix: railScrews(bottom, -1), tools: ["screwdriver"] });
    steps.push({ title: "Drop the next rail on", detail: "Check its hook faces the right way before you let go.", add: [railIds[2]] });
    steps.push({ title: "Screw it on", detail: "One screw, through the rail into the lug.", fix: railScrews([railIds[2]], -1), tools: ["screwdriver"] });
    const rest = railIds.slice(3);
    steps.push({ title: "Fit the rest of the rails", detail: "Drop each one onto its lug and screw it on.", add: rest, fix: railScrews(rest, -1), tools: ["screwdriver"] });
    steps.push({ title: "Lay the other side frame on", detail: "Turn two feet into its posts first, then lower it onto the rail ends with its feet at the same end.", add: ["R"], fix: [feet(1)], people: 2 });
    steps.push({ title: "Screw the side frame to every rail", detail: "Eight screws, one into each rail end.", fix: railScrews(railIds, 1), tools: ["screwdriver"] });
  } else {
    steps.push({ title: "Drop the bottom rails onto the lugs", detail: "The screw holes face out, the hooks the way the drawing shows.", add: bottom });
    steps.push({ title: "Screw the bottom rails on", detail: "One screw through each rail into its lug.", fix: railScrews(bottom, -1), tools: ["screwdriver"] });
    const mid = railIds.slice(2);
    steps.push({ title: "Drop the middle rails on", detail: "Both hooks face the same way as on the bottom rails.", add: mid });
    steps.push({ title: "Screw the middle rails on", detail: "One screw in each.", fix: railScrews(mid, -1), tools: ["screwdriver"] });
    steps.push({ title: "Lay the other side frame on top", detail: "Feet at the same end as the first one, every lug onto a rail end.", add: ["R"], fix: [feet(1)] });
    steps.push({ title: "Screw the side frame to the rails", detail: "One screw into each rail end.", fix: railScrews(railIds, 1), tools: ["screwdriver"] });
  }

  if (wide) {
    const hookY = (y: number) => y;
    for (const [k, sz] of [[0, 1], [1, -1]] as const) {
      const id = `M${sz < 0 ? "b" : "f"}`;
      const z = sz * (D / 2);
      steps.push({
        title: k === 0 ? "Hook a middle post onto the rails" : "Hook the other middle post on",
        detail: "Turn a foot into its end first. Its slots drop over the rails halfway along, foot at the same end as the others.",
        add: [id],
        fix: [fx("foot", [[0, F, sz * zs]], [0, 1, 0], { ...FOOT, on: id })],
      });
      const ys = levels.map(hookY);
      steps.push({
        title: "Screw on its angle brackets",
        detail: "One bracket where the post crosses each rail, one screw through each. The odd bracket goes at the bottom rail.",
        fix: [
          fx("angle", ys.map((y) => [T / 2 + 12, y, z - sz * T] as Vec3), [0, 0, sz], { name: "Angle bracket", len: 24, dia: 24, on: id }),
          fx("screw", ys.map((y) => [T / 2 + 12, y, z - sz * T - sz * 2] as Vec3), [0, 0, sz], { ...SCREW, on: id }),
        ],
        tools: ["screwdriver"],
      });
    }
  }
  if (tall) {
    steps.push({
      title: "Screw the braces across the back corners",
      detail: "One triangle at each side, three screws each. They keep the frame square.",
      add: ["Xl", "Xr"],
      fix: [
        fx(
          "screw",
          [-1, 1].flatMap((sx) => [[sx * xs, levels[2], -D / 2 - 3], [sx * xs, levels[2] + 50, -D / 2 - 3], [sx * (W / 2 - 70), levels[2], -D / 2 - 3]] as Vec3[]),
          [0, 0, 1],
          SCREW,
        ),
      ],
      tools: ["screwdriver"],
      check: "square",
    });
  }
  const tabs = (y: number, inset: number, n: number): Vec3[] => {
    const xsT = n === 6 ? [-1, 0, 1].map((k) => k * (W / 2 - inset)) : [-1, 1].map((k) => k * (W / 2 - inset));
    return [-1, 1].flatMap((sz) => xsT.map((x) => [x, y, sz * (D / 2 - T - 10)] as Vec3));
  };
  const nTabs = wide ? 6 : 4;
  steps.push({
    title: "Screw the top panel into the top frame",
    detail: "Lay the panel on a rug with the side you want on show down, set the frame on it with the lugs up and screw through the tabs.",
    add: ["P", "F"],
    fix: [fx("screw", tabs(H - pt, T + 30, nTabs), [0, 1, 0], { ...SMALL, on: "F", mate: "P" })],
    tools: ["screwdriver"],
  });
  const topScrews: Vec3[] = (wide ? [-xs, 0, xs] : [-xs, xs]).flatMap((x) => [-1, 1].map((sz) => [x, yp - 15, sz * (D / 2)] as Vec3));
  steps.push({
    title: "Push the top onto the post ends",
    detail: "Every lug slides over a post end. One screw through each lug.",
    fix: [1, -1].map((sz) => fx("screw", topScrews.filter((p) => Math.sign(p[2]) === sz), [0, 0, -sz], { ...SCREW, on: "F" })),
    tools: ["screwdriver"],
  });
  steps.push({
    title: "Screw in the bottom panel",
    detail: "Slide it in between the bottom rails, show side up, and screw it to the tabs from below.",
    add: ["B"],
    fix: [fx("screw", tabs(yb + T / 2 - pt, T + 30, nTabs), [0, 1, 0], { ...SMALL, on: "B" })],
    tools: ["screwdriver"],
  });
  const wallPts: Vec3[] = [-1, 1].map((sx) => [sx * (xs - (wide ? 0 : 0)), yt, -D / 2] as Vec3);
  steps.push({
    title: "Stand it up and fix it to the wall",
    detail: "Turn out the feet until it stands level, then one screw through each back corner of the top frame into the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [fx("plug", wallPts.map((p) => [p[0], p[1], p[2] - 2] as Vec3), [0, 0, -1]), fx("screw", wallPts, [0, 0, -1], { len: 50, dia: 5, on: "F" })],
    pose: "+y",
    people: 2,
    tools: ["screwdriver", "drill", "pencil"],
    wall: true,
    warnings: ["two", "wall", "tip"],
  });
  const pads: Vec3[] = levels.slice(1).flatMap((y) => [-1, 1].flatMap((sz) => (wide ? [-xs + T, 0, xs - T] : [-xs + T, xs - T]).map((x) => [x === 0 ? 0 : x, y + T / 2, sz * (zs - T)] as Vec3)));
  steps.push({
    title: nGlass > 1 ? "Lay in the glass shelves" : "Lay in the glass shelf",
    detail: "Stick a clear pad on every tab first, then tilt each pane in and lower it flat onto its pads.",
    add: glassIds,
    fix: [fx("glide", pads, [0, 1, 0], PAD)],
  });
  return { parts, steps };
}

/* ---------- round coffee table ---------- */

const ring = (R: number, n = 64): PartPiece[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { shape: "box", size: [r1((2 * Math.PI * R) / n + 2), T, T], pos: [r1(R * Math.cos(a)), 0, r1(R * Math.sin(a))], rot: [0, r1(Math.PI / 2 - a), 0] } as PartPiece;
  });

function coffeeRound(s: ProductSpec): CustomParams {
  const Dm = s.size.w * 10, H = s.size.h * 10;
  const F = 10;
  const R = Dm / 2 - T / 2; // ring centre line
  const RL = R - T; // legs, just inside the ring
  const yx = 80; // the crossed bars under the shelf
  const legTop = H - T;
  const hL = legTop - F;
  const legFrame = (id: string, a: number, bump: number): CustomPart => {
    const c = Math.cos(a), sn = Math.sin(a);
    const half = Math.abs(RL * c) + T / 2, halfZ = Math.abs(RL * sn) + T / 2;
    const yMid = (F + legTop) / 2;
    return {
      id,
      name: "Leg frame",
      size: [r1(2 * half), hL, r1(2 * halfZ)],
      pos: [0, yMid, 0],
      material: "metal",
      pieces: [
        { shape: "box", size: [T, hL, T], pos: [r1(RL * c), 0, r1(RL * sn)] },
        { shape: "box", size: [T, hL, T], pos: [r1(-RL * c), 0, r1(-RL * sn)] },
        { shape: "box", size: [2 * RL, T + bump, T + bump], pos: [0, r1(yx - yMid), 0], rot: [0, r1(-a), 0] },
      ],
    };
  };
  const q = Math.PI / 4;
  const parts: CustomPart[] = [
    { id: "R", name: "Top ring", size: [2 * R + T, T, 2 * R + T], pos: [0, H - T / 2, 0], pieces: ring(R), material: "metal" },
    legFrame("A", q, 0),
    legFrame("B", 3 * q, 1),
    { id: "S", name: "Shelf", size: [2 * RL - T - 10, 12, 2 * RL - T - 10], pos: [0, yx + T / 2 + 6, 0], shape: "cyl" },
    { id: "G", name: "Glass top", size: [2 * R - T - 6, 6, 2 * R - T - 6], pos: [0, H - 5, 0], shape: "cyl", material: "glass" },
  ];
  const angles = [q, 3 * q, 5 * q, 7 * q];
  const legOf = (a: number) => (Math.abs(Math.cos(a) - Math.cos(q)) < 0.01 && Math.abs(Math.sin(a) - Math.sin(q)) < 0.01) || (Math.abs(Math.cos(a) + Math.cos(q)) < 0.01 && Math.abs(Math.sin(a) + Math.sin(q)) < 0.01) ? "A" : "B";
  const steps: CustomStep[] = [
    {
      title: "Stand the crossed legs in the upturned ring",
      detail: "Lay the ring upside down on a rug. Cross the two leg frames where their bars are notched and push each leg top onto a lug of the ring.",
      add: ["R", "A", "B"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the legs to the ring",
      detail: "One screw through each leg top into its lug.",
      fix: angles.map((a) => fx("screw", [[r1((RL + T / 2) * Math.cos(a)), legTop - 12, r1((RL + T / 2) * Math.sin(a))]], [r1(-Math.cos(a)), 0, r1(-Math.sin(a))], { ...SCREW, on: legOf(a), mate: "R" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the feet into the legs",
      detail: "By hand, into the open end of each leg.",
      fix: [fx("foot", angles.map((a) => [r1(RL * Math.cos(a)), F, r1(RL * Math.sin(a))] as Vec3), [0, 1, 0], FOOT)],
    },
    {
      title: "Screw the shelf onto the crossed bars",
      detail: "Tip the table on its side, slide the shelf in between the legs onto the bars, and screw up through the bars into it.",
      add: ["S"],
      fix: [fx("screw", angles.map((a) => [r1(150 * Math.cos(a)), yx - T / 2, r1(150 * Math.sin(a))] as Vec3), [0, 1, 0], { len: 16, dia: 4, on: "S" })],
      tools: ["screwdriver"],
      pose: "+x",
      from: { S: [0, 0, 420] },
    },
    {
      title: "Stand it up and stick on the glass pads",
      detail: "One clear pad on each of the six tabs inside the ring.",
      fix: [fx("glide", Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + 0.3).map((a) => [r1((R - T) * Math.cos(a)), H - 9, r1((R - T) * Math.sin(a))] as Vec3), [0, 1, 0], { ...PAD, on: "R" })],
      pose: "+y",
    },
    { title: "Lay the glass top in the ring", detail: "Lower it flat onto the pads. The rim of the ring holds it in place.", add: ["G"] },
  ];
  return { parts, steps };
}

/* ---------- laptop stand ---------- */

function laptopStand(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const F = 10;
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const Dt = Math.round(D * 0.75); // the top reaches three quarters over the base
  const yBase = F + T / 2, yTop = H - T / 2;
  const zp = [-zs, -zs + 60]; // two posts at each side, at the back
  const parts: CustomPart[] = [
    frame("A", "Base frame", [
      [[-xs, yBase, -zs], [-xs, yBase, zs]],
      [[xs, yBase, -zs], [xs, yBase, zs]],
      [[-xs + T, yBase, -zs], [xs - T, yBase, -zs]],
    ]),
  ];
  const posts: string[] = [];
  for (const sx of [-1, 1]) for (const z of zp) {
    const id = `P${posts.length}`;
    posts.push(id);
    parts.push(tube(id, "Post", [T, yTop - yBase - T, T], [sx * xs, (yTop + yBase) / 2, z]));
  }
  const zt = -D / 2 + Dt - T / 2;
  parts.push(
    frame("B", "Top frame", [
      [[-xs, yTop, -zs], [-xs, yTop, zt]],
      [[xs, yTop, -zs], [xs, yTop, zt]],
      [[-xs + T, yTop, -zs], [xs - T, yTop, -zs]],
      [[-xs + T, yTop, zt], [xs - T, yTop, zt]],
    ]),
  );
  parts.push({ id: "G", name: "Glass top", size: [W - 2 * T, 6, Dt - 2 * T], pos: [0, H - 5, -D / 2 + Dt / 2], material: "glass" });
  const pairs = (y: number): Vec3[] => [-1, 1].flatMap((sx) => zp.flatMap((z) => [[sx * (W / 2), y - 8, z], [sx * (W / 2), y + 8, z]] as Vec3[]));
  const steps: CustomStep[] = [
    {
      title: "Screw the feet into the base",
      detail: "Hold the base on its edge and turn a foot into each end of the two long bars.",
      add: ["A"],
      fix: [fx("foot", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, F, sz * zs] as Vec3)), [0, 1, 0], { ...FOOT, on: "A" })],
    },
    {
      title: "Screw the posts onto the base",
      detail: "Lay the base flat. Each post slides over a stub at the back; two screws through each, from the outside.",
      add: posts,
      fix: [-1, 1].map((sx) => fx("screw", pairs(yBase + T + 20).filter((p) => Math.sign(p[0]) === sx), [-sx, 0, 0], { ...SCREW, len: 8 })),
      tools: ["screwdriver"],
    },
    {
      title: "Push the top frame onto the posts",
      detail: "Its four stubs go into the post tops. Two screws through each post.",
      add: ["B"],
      fix: [-1, 1].map((sx) => fx("screw", pairs(yTop - T - 20).filter((p) => Math.sign(p[0]) === sx), [-sx, 0, 0], { ...SCREW, len: 8 })),
      tools: ["screwdriver"],
    },
    {
      title: "Lay the glass top on its pads",
      detail: "Six clear pads on the tabs inside the frame, then the glass. Turn the feet until it stands steady.",
      add: ["G"],
      fix: [fx("glide", [-1, 0, 1].flatMap((k) => [-1, 1].map((sx) => [sx * (xs - T), H - 8, -D / 2 + Dt / 2 + k * (Dt / 2 - 2 * T)] as Vec3)), [0, 1, 0], { ...PAD, on: "B" })],
    },
  ];
  return { parts, steps };
}

/* ---------- laptop table ---------- */

const BOLT = { len: 40, dia: 6 };

function laptopTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const F = 10;
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const yt = H - T / 2, ylow = 100, ysh = H - 130;
  const zi = zs - 80; // the inner rail behind the front rail
  const x0 = Math.round(W * 0.05); // where the shelf steps down
  const end = (id: string, sx: number) =>
    frame(id, "End frame", [
      [[sx * xs, F + T / 2, -zs], [sx * xs, yt, -zs]],
      [[sx * xs, F + T / 2, zs], [sx * xs, yt, zs]],
      [[sx * xs, yt, -zs + T], [sx * xs, yt, zs - T]],
      [[sx * xs, ylow, -zs + T], [sx * xs, ylow, zs - T]],
    ]);
  const parts: CustomPart[] = [
    frame("B", "Front frame", [
      [[-xs + T, yt, zs], [xs - T, yt, zs]],
      [[-xs + T, yt, zi], [xs - T, yt, zi]],
      [[x0, yt, zi + T], [x0, yt, zs - T]],
    ]),
    end("A1", -1),
    end("A2", 1),
    frame("C", "Back frame", [
      [[-xs + T, yt, -zs], [xs - T, yt, -zs]],
      [[x0, ysh, -zs], [x0, yt - T, -zs]],
      [[x0 + T, ysh, -zs], [xs - T, ysh, -zs]],
      [[x0, ysh, -zs + T], [x0, ysh, zi]],
      [[x0, ysh + T, zi], [x0, yt - T, zi]],
      [[x0 + T, ysh, zi], [xs - T, ysh, zi]],
    ]),
    tube("E", "Low rail", [W - 2 * T, T, T], [0, ylow, -zs]),
    { id: "S", name: "Shelf", size: [xs - T / 2 - x0 - T / 2, 10, zi - T / 2 - (-zs + T / 2)], pos: [(x0 + T / 2 + xs - T / 2) / 2, ysh + T / 2 + 5, (zi - T / 2 + -zs + T / 2) / 2] },
    { id: "G", name: "Glass top", size: [W - 2 * T, 6, D - 2 * T], pos: [0, H - 5, 0], material: "glass" },
  ];
  const bolts = (pts: Vec3[], on: string) => [-1, 1].map((sx) => fx("bolt", pts.filter((p) => Math.sign(p[0]) === sx), [-sx, 0, 0], { ...BOLT, on: sx < 0 ? "A1" : "A2", mate: on })).filter((f) => f.count);
  const ends = (z: number, y: number, xsSet = [-1, 1]): Vec3[] => xsSet.map((sx) => [sx * (W / 2), y, z] as Vec3);
  const steps: CustomStep[] = [
    {
      title: "Bolt the end frames to the front frame",
      detail: "Upside down on a rug: lay the front frame flat and stand an end frame on each end. Turn the bolts in by hand, not tight yet.",
      add: ["B", "A1", "A2"],
      fix: bolts([...ends(zs, yt), ...ends(zi, yt)], "B"),
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt on the back frame",
      detail: "The stepped part for the shelf goes to the same end as the gap in the front frame.",
      add: ["C"],
      fix: bolts([...ends(-zs, yt), [W / 2, ysh, -zs]], "C"),
    },
    { title: "Bolt on the low rail", detail: "Between the two back legs, near the feet.", add: ["E"], fix: bolts(ends(-zs, ylow), "E") },
    { title: "Tighten all the bolts", detail: "All nine, with the Allen key, once the frame sits square on the rug.", tools: ["allen"], check: "square" },
    {
      title: "Screw the shelf frame together",
      detail: "Three screws where the stepped bars meet the front frame and the end frame.",
      fix: [fx("screw", [[x0, yt - T, zi + T / 2], [x0, yt - T, -zs + T / 2], [xs - T / 2, ysh, zi]], [0, 1, 0], SCREW)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the back corners together",
      detail: "Three screws through the corner tabs at each end of the back rail. They keep it from racking.",
      fix: [
        // up through the tab into the back rail (two) and the end frame's top bar (one)
        fx("screw", [-1, 1].flatMap((sx) => [[sx * (xs - T - 20), yt - T / 2 - 2, -zs], [sx * (xs - T - 50), yt - T / 2 - 2, -zs], [sx * xs, yt - T / 2 - 2, -zs + T + 20]] as Vec3[]), [0, 1, 0], SCREW),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the feet and turn it over",
      detail: "One foot in each leg end, then turn the table onto its feet.",
      fix: [fx("foot", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, F, sz * zs] as Vec3)), [0, 1, 0], FOOT)],
      pose: "+y",
    },
    {
      title: "Screw the shelf in from above",
      detail: "Lay it on the stepped bars and screw through it into the four tabs.",
      add: ["S"],
      fix: [fx("screw", [x0 + 40, xs - 40].flatMap((x) => [-zs + T + 20, zi - T - 20].map((z) => [x, ysh + T / 2 + 10, z] as Vec3)), [0, -1, 0], { ...SMALL, on: "S" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the glass top on its pads",
      detail: "Six clear pads on the tabs inside the rim, then lower the glass flat. Turn the feet until it stands steady.",
      add: ["G"],
      fix: [fx("glide", [-1, 0, 1].flatMap((k) => [-1, 1].map((sz) => [k * (xs - T - 20), H - 8, sz * (zs - T)] as Vec3)), [0, 1, 0], PAD)],
    },
    {
      title: "Clip the cables to a back leg",
      detail: "Peel the backing off the cable clips and press them on where the cable runs down.",
      fix: [fx("clip", [300, 500].map((y) => [xs, y, -zs - T / 2] as Vec3), [0, 0, 1], { name: "Cable clip", len: 12, dia: 16, on: "A2" })],
    },
  ];
  return { parts, steps };
}

/* ---------- nest of tables ---------- */

/**
 * The 90 x 50 guide is the nest of two tables. The small square one is built first, upside down: its two leg
 * frames push into the top frame's corner sockets and are bolted, the feet go in, and stood up it gets pads and
 * its glass. The long one: two end frames, each an end bar with two posts clicked on and two angle brackets
 * underneath (four bolts each), then upside down onto the top frame, the low rails bolted between the posts, the
 * feet, the shelf screwed onto the rail tabs, and stood up, pads and glass. The small one stands over the long
 * one's end, open at the sides so the long one slides in under it.
 */
function nest(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = 450, D = 440; // the long table
  const w = 500, h = 500; // the small table, square
  const F = 10, pt = 12;
  const BOLT6 = { len: 12, dia: 6 };
  const BRACKET = { name: "Angle bracket", len: 40, dia: 30 };
  // the small one stands over the left end of the long one
  const cx = -W / 2 + w / 2 - 20;
  const sxs = w / 2 - T / 2, szs = w / 2 - T / 2;
  const legY0 = F + T / 2, legY1 = h - T - T / 2;
  const yf = 40; // its floor bars
  const smallFrame = (id: string, sz: number) =>
    frame(id, "Leg frame", [
      [[cx - sxs, legY0, sz * szs], [cx - sxs, legY1, sz * szs]],
      [[cx + sxs, legY0, sz * szs], [cx + sxs, legY1, sz * szs]],
      [[cx - sxs + T, yf, sz * szs], [cx + sxs - T, yf, sz * szs]],
    ]);
  const ring = (id: string, x0: number, x1: number, z: number, y: number) =>
    frame(id, "Top frame", [
      [[x0, y, -z], [x1, y, -z]],
      [[x0, y, z], [x1, y, z]],
      [[x0, y, -z + T], [x0, y, z - T]],
      [[x1, y, -z + T], [x1, y, z - T]],
    ]);
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const yl = 110; // the long table's low frame
  const yTop = H - T / 2;
  const parts: CustomPart[] = [
    ring("SR", cx - sxs, cx + sxs, szs, h - T / 2),
    smallFrame("SA", 1),
    smallFrame("SB", -1),
    { id: "SG", name: "Small glass top", size: [w - 2 * T, 6, w - 2 * T], pos: [cx, h - 5, 0], material: "glass" },
  ];
  const posts: string[][] = [[], []];
  [-1, 1].forEach((sx, e) => {
    parts.push(tube(`E${e}`, "End bar", [T, T, D - 2 * T], [sx * xs, yl, 0]));
    for (const sz of [-1, 1]) {
      const id = `P${e}${sz < 0 ? "b" : "f"}`;
      posts[e].push(id);
      parts.push(tube(id, "Post", [T, yTop - T / 2 - F, T], [sx * xs, (F + yTop - T / 2) / 2, sz * zs]));
    }
  });
  parts.push(ring("LR", -xs, xs, zs, yTop));
  for (const sz of [-1, 1]) parts.push(tube(`R${sz < 0 ? "b" : "f"}`, "Low rail", [W - 2 * T, T, T], [0, yl, sz * zs]));
  parts.push({ id: "SH", name: "Shelf", size: [W - 2 * T, pt, D - 2 * T], pos: [0, yl + T / 2 + pt / 2, 0] });
  parts.push({ id: "LG", name: "Glass top", size: [W - 2 * T, 6, D - 2 * T], pos: [0, H - 5, 0], material: "glass" });

  // the small table's bolts: through each leg top into its socket in the top frame
  const yb = h - T - 15;
  const sideBolt = (sz: number) => [-1, 1].map((k) => fx("bolt", [[cx + k * (w / 2), yb, sz * szs]], [-k, 0, 0], { ...BOLT6, on: sz > 0 ? "SA" : "SB", mate: "SR" }));
  // the long table's end frames: each bracket sits under the end bar against a post, two bolts up into the bar and two into the post
  const endFix = (e: number, pass: 0 | 1): CustomFix[] => {
    const sx = e === 0 ? -1 : 1;
    return [-1, 1].flatMap((sz) => {
      const zb = sz * (zs - T / 2 - 26 - pass * 26);
      const yp = yl - T / 2 - 12 - pass * 30;
      return [
        fx("bolt", [[sx * xs, yl - T / 2 - 2, zb]], [0, 1, 0], { ...BOLT6, on: `E${e}` }),
        fx("bolt", [[sx * xs, yp, sz * (zs - T / 2 - 2)]], [0, 0, sz], { ...BOLT6, on: `P${e}${sz < 0 ? "b" : "f"}` }),
      ];
    });
  };
  const brackets = (e: number) => fx("angle", [-1, 1].map((sz) => [(e === 0 ? -1 : 1) * xs, yl - T / 2 - 30, sz * (zs - T / 2 - 30)] as Vec3), [0, 1, 0], { ...BRACKET, on: `E${e}` });
  const endSteps = (e: number): CustomStep[] => [
    { title: e === 0 ? "Click two posts onto an end bar" : "Build the other end frame", detail: e === 0 ? "Lay the bar on a rug and push a post onto each stub until it clicks." : "Click its posts on and fit its brackets and bolts the same way.", wait: [`E${e}`, ...posts[e]], pose: "+y", warnings: e === 0 ? ["floor"] : [] },
    { title: "Fit an angle bracket under each joint", detail: "Hold it against the post, under the bar, and turn one bolt up into the bar.", fix: [brackets(e), ...endFix(e, 0).filter((_, i) => i % 2 === 0)], tools: ["allen"] },
    { title: "Bolt the brackets to the posts", detail: "One bolt through each bracket into its post.", fix: endFix(e, 0).filter((_, i) => i % 2 === 1), tools: ["allen"] },
    { title: "Put in the second bolt up into the bar", detail: "In the other hole of each bracket.", fix: endFix(e, 1).filter((_, i) => i % 2 === 0), tools: ["allen"] },
    { title: "And the second one into each post", detail: "Tighten all four now.", fix: endFix(e, 1).filter((_, i) => i % 2 === 1), tools: ["allen"] },
  ];
  const e1 = endSteps(1);
  const otherEnd: CustomStep = { ...e1[0], fix: e1.flatMap((st) => st.fix ?? []), tools: ["allen"] };
  const ringBolts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => fx("bolt", [[sx * (W / 2), yTop - T / 2 - T - 15, sz * zs]], [-sx, 0, 0], { ...BOLT6, on: `P${sx < 0 ? 0 : 1}${sz < 0 ? "b" : "f"}`, mate: "LR" })));
  const railBolts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => fx("bolt", [[sx * (W / 2), yl, sz * zs]], [-sx, 0, 0], { ...BOLT6, len: 30, on: `P${sx < 0 ? 0 : 1}${sz < 0 ? "b" : "f"}`, mate: `R${sz < 0 ? "b" : "f"}` })));
  const shelfScrews: Vec3[] = [-1, 1].flatMap((sz) => [-2, -1, 0, 1, 2].map((k) => [k * ((W - 2 * T - 120) / 4), yl + T / 2 - 1, sz * (zs - T)] as Vec3));
  const pads = (x0: number, x1: number, z: number, y: number, n: number): Vec3[] => [-1, 1].flatMap((sz) => Array.from({ length: n }, (_, i) => [r1(x0 + ((x1 - x0) * i) / (n - 1)), y, sz * z] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Push a leg frame into the small top frame",
      detail: "Lay the top frame upside down on a rug. Push the two legs into the sockets at one side until they click.",
      add: ["SR", "SA"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Bolt the legs to the top frame", detail: "One bolt through each leg into its socket.", fix: sideBolt(1), tools: ["allen"] },
    { title: "Push in the other leg frame", detail: "Its floor bar the same way as the first one's.", add: ["SB"] },
    {
      title: "Bolt it on",
      detail: "Four bolts: one from the side and one from the back of each leg. Then tighten them all.",
      fix: [...sideBolt(-1), fx("bolt", [-1, 1].map((k) => [cx + k * sxs, yb - 30, -w / 2] as Vec3), [0, 0, 1], { ...BOLT6, on: "SB", mate: "SR" })],
      tools: ["allen"],
    },
    { title: "Screw in the four feet", detail: "By hand, into the leg ends.", fix: [fx("foot", [-1, 1].flatMap((k) => [-1, 1].map((sz) => [cx + k * sxs, F, sz * szs] as Vec3)), [0, 1, 0], FOOT)] },
    { title: "Turn it over and stick on the glass pads", detail: "Six clear pads, on the tabs inside the top frame.", fix: [fx("glide", pads(cx - sxs + T + 20, cx + sxs - T - 20, szs - T, h - 8, 3), [0, 1, 0], { ...PAD, on: "SR" })], pose: "+y" },
    { title: "Lay the small glass top in", detail: "Lower it flat onto the pads.", add: ["SG"] },
    ...endSteps(0),
    otherEnd,
    {
      title: "Stand the end frames in the long top frame",
      detail: "Lay the top frame upside down on a rug and push the four post ends into its corner sockets until they click.",
      add: ["LR", "E0", "E1", ...posts[0], ...posts[1]],
      pose: "-y",
      people: 2,
      warnings: ["floor", "two"],
    },
    {
      title: "Bolt in the low rails",
      detail: "One along each side between the end bars, tabs inwards. Eight bolts: one through each post into the top frame and one into the rail.",
      add: ["Rb", "Rf"],
      fix: [...ringBolts, ...railBolts],
      tools: ["allen"],
    },
    { title: "Screw the feet into the posts", fix: [fx("foot", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, F, sz * zs] as Vec3)), [0, 1, 0], FOOT)] },
    {
      title: "Slide in the shelf and screw it on",
      detail: "Slide it in between the rails, show side towards the rug, and screw through the ten tabs.",
      add: ["SH"],
      fix: [fx("screw", shelfScrews, [0, 1, 0], { ...SMALL, on: "SH" })],
      from: { SH: [0, 0, 500] },
      tools: ["screwdriver"],
    },
    { title: "Turn it over and stick on the glass pads", detail: "Eight clear pads on the tabs inside the top frame.", fix: [fx("glide", pads(-xs + T + 20, xs - T - 20, zs - T, H - 8, 4), [0, 1, 0], { ...PAD, on: "LR" })], pose: "+y", people: 2 },
    { title: "Lay in the glass top", detail: "Lower it flat onto the pads, then turn the feet of both tables until they stand steady. The small one goes over the end of the long one.", add: ["LG"], people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

/* ---------- desk ---------- */

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const F = 10;
  const pt = 12;
  const Hf = H - pt;
  const yt = Hf - T / 2, ylow = 100, ym = 400;
  const Ws = Math.round(W * 0.34); // the shelf unit at the right
  const xR = W / 2 - T / 2, xI = W / 2 - Ws + T / 2, xL = -W / 2 + T / 2;
  const zs = D / 2 - T / 2;
  const ladder = (id: string, name: string, x: number, ys: number[]) =>
    frame(id, name, [
      [[x, F + T / 2, -zs], [x, yt, -zs]],
      [[x, F + T / 2, zs], [x, yt, zs]],
      ...ys.map((y): Seg => [[x, y, -zs + T], [x, y, zs - T]]),
    ]);
  const parts: CustomPart[] = [
    ladder("R", "Shelf end frame", xR, [ylow, ym, yt]),
    ladder("I", "Shelf end frame", xI, [ylow, ym, yt]),
    ladder("L", "End frame", xL, [ylow, yt]),
  ];
  const sw = xR - xI - T;
  const sx = (xR + xI) / 2;
  const rails: [string, number, number][] = [["Rb0", ylow, -zs], ["Rf0", ylow, zs], ["Rb1", ym, -zs], ["Rf1", ym, zs]];
  for (const [id, y, z] of rails) parts.push(tube(id, "Shelf rail", [sw, T, T], [sx, y, z]));
  const lw = xI - xL - T, lx = (xI + xL) / 2;
  parts.push(tube("Tb", "Top rail", [lw, T, T], [lx, yt, -zs]), tube("Tf", "Top rail", [lw, T, T], [lx, yt, zs]), tube("E", "Low rail", [lw, T, T], [lx, ylow, -zs]));
  parts.push({ id: "B", name: "Bottom shelf", size: [sw, pt, D - 2 * T], pos: [sx, ylow + T / 2 - pt / 2, 0] });
  parts.push({ id: "P", name: "Desk top", size: [W, pt, D], pos: [0, H - pt / 2, 0] });
  parts.push({ id: "G", name: "Glass shelf", size: [sw, 6, D - 2 * T], pos: [sx, ym + T / 2 + 4, 0], material: "glass" });

  const feet = (x: number, on: string) => fx("foot", [-1, 1].map((sz) => [x, F, sz * zs] as Vec3), [0, 1, 0], { ...FOOT, on });
  // one bolt each, so every bolt knows the rail its tip goes into
  const into = (x: number, dir: number, pts: [number, number, string][], on: string, o = BOLT) => pts.map(([y, z, mate]) => fx("bolt", [[x, y, z]], [dir, 0, 0], { ...o, on, mate }));
  const SHORT = { len: 12, dia: 6 };
  const steps: CustomStep[] = [
    { title: "Screw two feet into a shelf end frame", detail: "Lay it flat on a rug and turn the feet into its leg ends.", add: ["R"], fix: [feet(xR, "R")], warnings: ["floor"] },
    { title: "Bolt the bottom rails into it", detail: "Stand the frame up. The tab on each rail faces up and in. Turn the bolts in by hand.", add: ["Rb0", "Rf0"], fix: into(W / 2, -1, [[ylow, -zs, "Rb0"], [ylow, zs, "Rf0"]], "R"), tools: ["allen"] },
    { title: "Bolt the middle rails into it", detail: "The same way, one bolt each.", add: ["Rb1", "Rf1"], fix: into(W / 2, -1, [[ym, -zs, "Rb1"], [ym, zs, "Rf1"]], "R"), tools: ["allen"] },
    {
      title: "Bolt on the other shelf end frame",
      detail: "Feet into it first, then push it onto the rail ends. Three of the long bolts now.",
      add: ["I"],
      fix: [feet(xI, "I"), ...into(xI - T / 2, 1, [[ylow, -zs, "Rb0"], [ylow, zs, "Rf0"], [ym, -zs, "Rb1"]], "I")],
      tools: ["allen"],
    },
    { title: "Put the odd bolt in the last hole", detail: "The one bolt that looks different goes into the last middle rail.", fix: into(xI - T / 2, 1, [[ym, zs, "Rf1"]], "I", { len: 30, dia: 6 }), tools: ["allen"] },
  ];
  for (const [k, id, z] of [[0, "Tb", -zs], [1, "Tf", zs]] as const) {
    steps.push({
      title: k === 0 ? "Bolt a long top rail to the shelf unit" : "Bolt on the other top rail",
      detail: "Its tabs face up, for the desk top. One long bolt into the top of the shelf end frame.",
      add: [id],
      fix: into(xI + T / 2, -1, [[yt, z, id]], "I"),
      tools: ["allen"],
    });
    steps.push({
      title: "Bolt it from below",
      detail: "Its end sits on a tab of the frame: two short bolts up through the tab.",
      fix: [fx("bolt", [0, 1].map((i) => [xI - T / 2 - 15 - i * 30, yt - T / 2 - 2, z] as Vec3), [0, 1, 0], { ...SHORT, on: id })],
      tools: ["allen"],
    });
  }
  steps.push({
    title: "Bolt the low rail to the shelf unit",
    detail: "Along the back, near the feet. Two short bolts through its plate.",
    add: ["E"],
    fix: [fx("bolt", [[xI - T / 2, ylow - 8, -zs], [xI - T / 2, ylow + 8, -zs]], [1, 0, 0], { ...SHORT, on: "E", mate: "I" })],
    tools: ["allen"],
  });
  steps.push({ title: "Screw two feet into the end frame", detail: "The plain end frame, for the left end.", add: ["L"], fix: [feet(xL, "L")], pose: "+y" });
  steps.push({
    title: "Bolt the end frame to the rails",
    detail: "Three long bolts: both top rails and the low rail. Tighten every bolt now.",
    fix: into(-W / 2, 1, [[yt, -zs, "Tb"], [yt, zs, "Tf"], [ylow, -zs, "E"]], "L"),
    tools: ["allen"],
    check: "square",
  });
  const shelfTabs: Vec3[] = [-1, 0, 1].flatMap((k) => [-1, 1].map((sz) => [sx + k * (sw / 2 - 40), ylow + T / 2 - pt, sz * (zs - T - 10)] as Vec3));
  steps.push({
    title: "Screw in the bottom shelf",
    detail: "Turn the desk upside down, drop the board into the bottom of the shelf unit and screw through the six tabs.",
    add: ["B"],
    fix: [fx("screw", shelfTabs, [0, 1, 0], { ...SMALL, on: "B" })],
    pose: "-y",
    people: 2,
    tools: ["screwdriver"],
  });
  const topTabs: Vec3[] = [
    ...[-1, 1].flatMap((sz) => [0, 1, 2, 3, 4].map((i) => [xL + T + 40 + ((xI - xL - 2 * T - 80) * i) / 4, Hf, sz * (zs + 0)] as Vec3)),
    ...[-1, 1].map((sz) => [xR, Hf, sz * (zs - 120)] as Vec3),
    ...[-1, 1].map((sz) => [xI, Hf, sz * (zs - 120)] as Vec3),
    ...[-1, 0, 1].map((k) => [xL, Hf, k * (zs - 120)] as Vec3),
  ];
  steps.push({
    title: "Screw the frame onto the desk top",
    detail: "Lay the top face down on a rug, lower the upturned frame onto it, then screw through all 17 tabs.",
    add: ["P"],
    fix: [fx("screw", topTabs, [0, 1, 0], { ...SMALL, on: "P" })],
    people: 2,
    tools: ["screwdriver"],
    from: { P: [0, 260, 0] },
  });
  steps.push({
    title: "Turn it over and stick on the glass pads",
    detail: "Together, onto its feet. One clear pad on each of the six tabs at the middle of the shelf unit.",
    fix: [fx("glide", [-1, 0, 1].flatMap((k) => [-1, 1].map((sz) => [sx + k * (sw / 2 - 20), ym + T / 2, sz * (zs - T)] as Vec3)), [0, 1, 0], PAD)],
    pose: "+y",
    people: 2,
  });
  steps.push({ title: "Slide in the glass shelf", detail: "From the side, between the rails, until it lies flat on all six pads.", add: ["G"], from: { G: [-300, 0, 0] } });
  steps.push({
    title: "Level it and clip up the cables",
    detail: "Turn the feet until it stands steady. The cable clips press onto the legs where you want the cables to run.",
    fix: [fx("clip", [200, 320, 440, 560, 680].map((y) => [xI, y, -zs - T / 2] as Vec3), [0, 0, 1], { name: "Cable clip", len: 12, dia: 16, on: "I" })],
  });
  return { parts, steps };
}

const family: Family = {
  names: ["VITTSJÖ", "VITTSJO"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/shelving-unit/.test(slug)) return shelving(s);
    if (/coffee-table-75/.test(slug)) return coffeeRound(s);
    if (/coffee-table-90-x-50/.test(slug)) return nest(s);
    if (/laptop-stand/.test(slug)) return laptopStand(s);
    if (/laptop-table/.test(slug)) return laptopTable(s);
    if (/desk/.test(slug)) return desk(s);
    return null;
  },
};
export default family;
