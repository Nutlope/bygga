import type { Family } from "./family";
import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * NORRMANSÖ, from IKEA's manuals. The bench and the table are trestles built upside down on their slatted top: each
 * end is two posts between a top rail and a foot. On the 100 cm bench the ends come in one piece: they are screwed to
 * the top, then two braces are bolted between the posts and screwed to the middle of the top. On the 200 cm bench and
 * the table the posts first get barrel nuts and rods, are capped onto the top rails, screwed to the top, joined low
 * down by a long stretcher, then the feet are capped on and two braces run from the stretcher to the middle of the
 * top. The table's top comes in two halves that are joined first. The chair is one welded seat with legs: the
 * backrest is pushed into it and bolted from the sides.
 */

const CAP: HwDef = { kind: "nut", len: 12, dia: 14, name: "Cap nut" };
const SMALL_CAP: HwDef = { kind: "nut", len: 10, dia: 12, name: "Cap nut" };
const BARREL: HwDef = { kind: "nut", len: 20, dia: 10, name: "Barrel nut" };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 18 };

type StepIn = { title: string; detail?: string; tools?: ToolId[]; people?: 1 | 2; pose?: Pose; warnings?: WarnId[]; kind: StepKind; scene?: string };

function stepper(b: PlanBuilder) {
  let pose: Pose = "+y";
  return (d: StepIn, body: () => void = () => {}) => {
    const side = !!d.scene && d.scene !== "main";
    if (d.pose && !side) pose = d.pose;
    const w = new Set<WarnId>(d.warnings ?? []);
    if (d.people === 2) w.add("two");
    b.step({ ...d, tools: d.tools ?? [], people: d.people ?? 1, pose: side ? (d.pose ?? "+y") : pose, warnings: [...w].slice(0, 3) }, body);
  };
}

/** A brace from p1 to p2 in the x-y plane: its size, centre and turn. */
function brace(p1: [number, number], p2: [number, number], t: number) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const L = Math.hypot(dx, dy);
  return { size: [t, L, t] as Vec3, pos: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0] as Vec3, rot: [0, 0, Math.atan2(-dx, dy)] as Vec3, L };
}

interface Trestle {
  W: number;
  H: number;
  D: number;
  T: number; // top, thick
  legX: number; // centre of each end, from the middle
  pw: number; // post, square
  gap: number; // between the two posts of an end
  foot: Vec3; // x, y, z size
  rail: Vec3; // top rail under the top
  bw: number; // brace, square
  kit: boolean; // the ends come as loose posts, rails and feet (with a stretcher)
  halves: boolean; // the top comes in two halves
  str?: { y: number; h: number; w: number }; // stretcher
  centre: number; // screws through the top end of each brace
}

function trestle(b: PlanBuilder, s: ProductSpec, g: Trestle): boolean {
  const st = stepper(b);
  const { W, H, D, T, legX, pw, gap, foot, rail, bw } = g;
  const isTable = g.halves;
  const yU = H - T; // underside of the top
  const yR = yU - rail[1]; // underside of the top rails
  const pz = gap / 2 + pw / 2;
  const pzo = gap / 2 + pw; // outer face of a post
  const postH = yR - foot[1];
  const sxs = [-1, 1];

  // the top
  const tops = g.halves
    ? [-1, 1].map((sz) => b.place(b.part("Top half", [W, T, D / 2], { material: "wood" }), [0, H - T / 2, (sz * D) / 4]))
    : [b.place(b.part("Top", [W, T, D], { material: "wood" }), [0, H - T / 2, 0])];
  const top = tops[0];

  // the ends: loose posts, rails and feet, or one piece each
  const postT = b.part("Post", [pw, postH, pw], { material: "wood" });
  const railT = b.part("Top rail", rail, { material: "wood" });
  const footT = b.part("Foot", foot, { material: "wood" });
  const ends = sxs.map((sx) => {
    const x = sx * legX;
    if (g.kit)
      return {
        sx,
        x,
        posts: [-1, 1].map((sz) => b.place(postT, [x, foot[1] + postH / 2, sz * pz])),
        rail: b.place(railT, [x, yR + rail[1] / 2, 0]),
        foot: b.place(footT, [x, foot[1] / 2, 0]),
        whole: "",
      };
    const pieces: PartPiece[] = [
      { shape: "box", size: rail, pos: [0, yR + rail[1] / 2, 0] },
      ...[-1, 1].map((sz) => ({ shape: "box" as const, size: [pw, postH, pw] as Vec3, pos: [0, foot[1] + postH / 2, sz * pz] as Vec3 })),
      { shape: "box", size: foot, pos: [0, foot[1] / 2, 0] },
    ];
    const c = b.compound("Leg frame", pieces, { material: "wood" });
    return { sx, x, posts: [] as string[], rail: "", foot: "", whole: b.place(c.type, [x + c.mid[0], c.mid[1], c.mid[2]]) };
  });
  const railOf = (e: (typeof ends)[number]) => e.rail || e.whole;
  const postOf = (e: (typeof ends)[number], i: number) => e.posts[i] || e.whole;

  const stre = g.str ? b.place(b.part("Stretcher", [2 * legX + pw, g.str.h, g.str.w], { material: "wood" }), [0, g.str.y, 0]) : "";
  const yLow = g.str ? g.str.y + g.str.h / 2 : foot[1] + 110;
  const braces = sxs.map((sx) => {
    const p1: [number, number] = [sx * (g.str ? legX - 110 : legX), yLow];
    const p2: [number, number] = [sx * 60, yU];
    const r = brace(p1, p2, bw);
    return { sx, p1, p2, L: r.L, key: b.place(b.part("Brace", r.size, { material: "wood" }), r.pos, r.rot) };
  });
  const along = (br: (typeof braces)[number], d: number): Vec3 => [br.p2[0] + ((br.p1[0] - br.p2[0]) * d) / br.L, br.p2[1] + ((br.p1[1] - br.p2[1]) * d) / br.L, 0];

  /* ---------- fittings ---------- */
  const railZ = [-(rail[2] / 2 - 50), rail[2] / 2 - 50];
  const legScrew: HwDef = isTable ? { kind: "bolt", len: 80, dia: 8 } : { kind: "screw", len: 70, dia: 6, name: "Wood screw" };
  const legScrews = (): FitOpts[] => ends.flatMap((e) => railZ.map((z) => ({ on: railOf(e), at: [e.x, yR, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: g.halves ? (z < 0 ? tops[0] : tops[1]) : top })));
  const centre: HwDef = isTable ? legScrew : { kind: "screw", len: 70, dia: 6, name: "Wood screw" };
  const centreFits = (): FitOpts[] =>
    braces.flatMap((br) =>
      // two go side by side near the top end (further down the slope they would stop short of the top)
      (g.centre > 1 ? [-15, 15] : [0]).map((z) => {
        const q = along(br, g.centre > 1 ? 55 : 60);
        return { on: br.key, at: [q[0], q[1] - bw / 2, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: g.halves ? (z < 0 ? tops[0] : tops[1]) : top };
      }),
    );

  /* ---------- steps ---------- */
  if (g.halves) {
    st(
      {
        title: "Join the two halves of the top",
        detail: "Lay them upside down on a rug, side by side. Four short rods across the join, a washer and a cap nut on each, tightened with the Allen keys.",
        tools: ["allen"],
        kind: "bolts",
        pose: "-y",
        people: 2,
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.3);
        tops.forEach((k, i) => b.add(k, [0, -200, (i ? 1 : -1) * 200]));
        b.then(0.15);
        const xs = [-0.36, -0.12, 0.12, 0.36].map((f) => f * W);
        const y = H - T / 2;
        b.fits({ kind: "stud", len: 60, dia: 8 }, xs.map((x) => ({ on: tops[0], at: [x, y, 0] as Vec3, dir: [0, 0, -1] as Vec3, mate: tops[1] })), 0.1);
        b.then(0.1);
        b.fits(WASHER, xs.map((x) => ({ on: tops[1], at: [x, y, 30] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.06);
        b.fits(SMALL_CAP, xs.flatMap((x) => [-1, 1].map((sz) => ({ on: sz < 0 ? tops[0] : tops[1], at: [x, y, sz * 34] as Vec3, dir: [0, 0, -sz] as Vec3, hole: false as const }))), 0.06);
      },
    );
  }
  if (g.kit) {
    const posts = ends.flatMap((e) => e.posts);
    st(
      {
        title: "Fit the barrel nuts and rods into the posts",
        detail: "Lay the four posts on a rug. A barrel nut into the cross hole near each end, slot facing the end, then turn a rod into the end until it bites in the nut.",
        tools: ["flathead"],
        kind: "bolts",
        scene: "posts",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.15);
        posts.forEach((k, i) => b.stage(k, [0, pw / 2, (i - 1.5) * 160], [0, 0, Math.PI / 2], [0, 160, 0]));
        b.then(0.15);
        const ys = [foot[1] + 40, yR - 40];
        b.fits(BARREL, ends.flatMap((e) => [-1, 1].flatMap((sz) => ys.map((y) => ({ on: postOf(e, sz < 0 ? 0 : 1), at: [e.x - pw / 2, y, sz * pz] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const })))), 0.05);
        b.then(0.1);
        b.fits(
          { kind: "stud", len: isTable ? 70 : 50, dia: 8 },
          ends.flatMap((e) =>
            [-1, 1].flatMap((sz) => [
              { on: postOf(e, sz < 0 ? 0 : 1), at: [e.x, yR, sz * pz] as Vec3, dir: [0, -1, 0] as Vec3, travel: 120, spin: 3 },
              { on: postOf(e, sz < 0 ? 0 : 1), at: [e.x, foot[1], sz * pz] as Vec3, dir: [0, 1, 0] as Vec3, travel: 120, spin: 3 },
            ]),
          ),
          0.05,
        );
      },
    );
    st(
      {
        title: "Fix the posts to the top rails",
        detail: "Rail on the floor, two posts standing in it. A cap nut on each rod from underneath, flat side to the wood.",
        tools: ["allen"],
        kind: "bolts",
        scene: "ends",
        pose: "-y",
      },
      () => {
        const sh = (k: string, e: (typeof ends)[number]): Vec3 => {
          const p = b.partItem(k).final.pos;
          return [p[0] - e.x + e.sx * 260, p[1] - H / 2, p[2]];
        };
        b.stagger(0.2);
        for (const e of ends) b.stage(e.rail, sh(e.rail, e), [0, 0, 0], [0, 160, 0]);
        b.then(0.1);
        for (const e of ends) for (const k of e.posts) b.stage(k, sh(k, e), [0, 0, 0], [0, -200, 0]);
        b.then(0.1);
        b.fits(CAP, ends.flatMap((e) => [-1, 1].map((sz) => ({ on: e.rail, at: [e.x, yU, sz * pz] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }))), 0.1);
      },
    );
  }
  st(
    {
      title: g.halves ? "Screw the leg frames onto the top" : "Lay the top upside down and screw on the ends",
      detail: `${g.halves ? "" : "On a rug, so the slats don't get scratched. "}Two ${isTable ? "bolts" : "screws"} through each top rail into the top.`,
      tools: ["allen"],
      kind: "screws",
      pose: "-y",
      warnings: ["floor"],
    },
    () => {
      if (!g.halves) {
        b.add(top, [0, -200, 0]);
        b.then(0.15);
      }
      b.stagger(0.2);
      for (const e of ends) for (const k of e.whole ? [e.whole] : [e.rail, ...e.posts]) b.add(k, [0, 300, 0]);
      b.then(0.15);
      b.fits(legScrew, legScrews(), 0.1);
    },
  );
  if (g.str && g.kit) {
    if (isTable)
      st(
        {
          title: "Fit the stretcher between the posts",
          detail: "Lower it into the gaps between the posts at the free ends. A long rod through each pair of posts, with a cap nut on both ends, flat side to the wood.",
          tools: ["allen"],
          kind: "bolts",
        },
        () => {
          b.add(stre, [0, 300, 0]);
          b.then(0.15);
          b.fits({ kind: "stud", len: 2 * pzo, dia: 8 }, ends.map((e) => ({ on: e.posts[0], at: [e.x, g.str!.y, -pzo + 10] as Vec3, dir: [0, 0, -1] as Vec3, mate: stre })), 0.2);
          b.then(0.1);
          b.fits(CAP, ends.flatMap((e) => [-1, 1].map((sz) => ({ on: e.posts[sz < 0 ? 0 : 1], at: [e.x, g.str!.y, sz * pzo] as Vec3, dir: [0, 0, -sz] as Vec3, hole: false as const }))), 0.1);
        },
      );
    else {
      const bolt: HwDef = { kind: "bolt", len: 90, dia: 8 };
      const endBolts = (e: (typeof ends)[number]) => [-1, 1].map((sz) => ({ on: e.posts[sz < 0 ? 0 : 1], at: [e.x, g.str!.y, sz * pzo] as Vec3, dir: [0, 0, -sz] as Vec3, mate: stre }));
      st({ title: "Bolt one end of the stretcher", detail: "Lower it between the posts at the free ends. Two long bolts through the posts at one end, flat side of the head to the wood.", tools: ["allen"], kind: "bolts" }, () => {
        b.add(stre, [0, 300, 0]);
        b.then(0.15);
        b.fits(bolt, endBolts(ends[0]), 0.2);
      });
      st({ title: "Bolt the other end", detail: "Lift that end a little to line up the holes, then two more bolts.", tools: ["allen"], kind: "bolts" }, () => b.fits(bolt, endBolts(ends[1]), 0.2));
    }
    st(
      { title: "Cap the feet onto the posts", detail: "Push a foot over each pair of rods and turn a cap nut onto each one.", tools: ["allen"], kind: "legs" },
      () => {
        b.stagger(0.3);
        for (const e of ends) b.add(e.foot, [0, 260, 0]);
        b.then(0.15);
        b.fits(CAP, ends.flatMap((e) => [-1, 1].map((sz) => ({ on: e.foot, at: [e.x, 0, sz * pz] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const }))), 0.1);
      },
    );
    const low: HwDef = isTable ? legScrew : { kind: "bolt", len: 90, dia: 8 };
    const lowFits = braces.map((br) => ({ on: stre, at: [br.p1[0], g.str!.y - g.str!.h / 2, 0] as Vec3, dir: [0, 1, 0] as Vec3, mate: br.key }));
    if (isTable)
      st(
        {
          title: "Fit the braces",
          detail: "Slide them in from the side, from the stretcher to the middle of the top. One screw through the stretcher into each, two through the top end of each into the top.",
          tools: ["allen"],
          kind: "screws",
        },
        () => {
          b.stagger(0.4);
          for (const br of braces) b.add(br.key, [0, 0, 500]);
          b.then(0.15);
          b.fits(low, lowFits, 0.15);
          b.fits(centre, centreFits(), 0.1);
        },
      );
    else {
      st(
        { title: "Fit the braces onto the stretcher", detail: "Slide them in from the side. One long bolt up through the stretcher into the low end of each.", tools: ["allen"], kind: "bolts" },
        () => {
          b.stagger(0.4);
          for (const br of braces) b.add(br.key, [0, 0, 500]);
          b.then(0.15);
          b.fits(low, lowFits, 0.2);
        },
      );
      st({ title: "Screw the braces to the top", detail: "One screw through the top end of each, in the middle of the top.", tools: ["allen"], kind: "screws" }, () => b.fits(centre, centreFits(), 0.2));
    }
  } else {
    // one-piece ends: each brace is bolted between the posts of its end
    braces.forEach((br, i) =>
      st(
        {
          title: i ? "Bolt in the second brace" : "Bolt in the first brace",
          detail: "Its low end goes between the two posts. One long bolt through the posts and the brace, a cap nut on the other side, flat side to the wood.",
          tools: ["allen"],
          kind: "bolts",
        },
        () => {
          b.add(br.key, [0, 0, 400]);
          b.then(0.15);
          const e = ends[i];
          b.fits({ kind: "bolt", len: 120, dia: 8 }, [{ on: e.whole, at: [e.x, yLow, pzo], dir: [0, 0, -1], mate: br.key }]);
          b.then(0.1);
          b.fits(CAP, [{ on: e.whole, at: [e.x, yLow, -pzo], dir: [0, 0, 1], hole: false }]);
        },
      ),
    );
    st({ title: "Screw the braces to the top", detail: "One screw through the top end of each, where they meet in the middle.", tools: ["allen"], kind: "screws" }, () => b.fits(centre, centreFits(), 0.2));
  }
  const big = W > 1500;
  st({
    title: big ? "Turn it over together" : "Turn the bench over",
    detail: g.kit ? "Then give the four cap nuts on the feet a last turn with the Allen key." : "Then go round all the bolts once more with the Allen key.",
    tools: ["allen"],
    kind: "standup",
    pose: "+y",
    people: big ? 2 : 1,
  });
  void s;
  return true;
}

function chair(b: PlanBuilder, s: ProductSpec): boolean {
  const st = stepper(b);
  const W = s.size.w * 10 || 480, H = s.size.h * 10 || 830;
  const SH = 450, zb = -205, xs = W / 2 - 25;
  const seat = b.compound(
    "Seat with legs",
    [
      { shape: "box", size: [W - 40, 22, 440], pos: [0, SH - 11, 10], material: "wood" },
      { shape: "box", size: [W - 10, 60, 450], pos: [0, SH - 22 - 30, 0], material: "metal" },
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ shape: "cyl" as const, size: [26, SH - 80, 26] as Vec3, pos: [sx * xs, (SH - 80) / 2, sz * 205] as Vec3, material: "metal" as const }))),
    ],
    { material: "metal" },
  );
  const yB = SH - 70; // the backrest tubes go down into the back legs to here
  const back = b.compound(
    "Backrest",
    [
      ...[-1, 1].map((sx) => ({ shape: "cyl" as const, size: [20, H - 30 - yB, 20] as Vec3, pos: [sx * xs, (yB + H - 30) / 2, zb - 30] as Vec3, rot: [-0.07, 0, 0] as Vec3 })),
      { shape: "box", size: [W - 30, 40, 20], pos: [0, H - 25, zb - 55] },
      { shape: "box", size: [W - 50, 80, 12], pos: [0, H - 120, zb - 48] },
      { shape: "box", size: [W - 50, 80, 12], pos: [0, H - 230, zb - 40] },
    ],
    { material: "metal" },
  );
  const sk = b.place(seat.type, seat.mid);
  const bk = b.place(back.type, back.mid);
  const bolts = (sx: number): FitOpts[] => [SH - 60, SH - 36].map((y) => ({ on: sk, at: [sx * (W / 2 - 5), y, zb] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: bk }));
  const washers = (sx: number): FitOpts[] => bolts(sx).map((o) => ({ ...o, mate: undefined, hole: false as const }));
  const BOLT: HwDef = { kind: "bolt", len: 16, dia: 6 };
  st(
    { title: "Push the backrest into the seat", detail: "Turn the seat upside down at the edge of a table, the back hanging over. Push both tubes of the backrest into the back legs.", pose: "-y", kind: "join" },
    () => {
      b.add(sk, [0, -200, 0]);
      b.then(0.2);
      b.add(bk, [0, 320, 0]);
    },
  );
  st({ title: "Fix the left side", detail: "Two bolts, each with a washer, through the seat frame into the tube. Only loosely for now.", tools: ["allen"], kind: "bolts" }, () => {
    b.fits(WASHER, washers(-1), 0.1);
    b.fits(BOLT, bolts(-1), 0.15);
  });
  st({ title: "Fix the right side and tighten all four", detail: "Two more bolts with washers, then tighten all four bolts firmly.", tools: ["allen"], kind: "bolts" }, () => {
    b.fits(WASHER, washers(1), 0.1);
    b.fits(BOLT, bolts(1), 0.15);
  });
  st({ title: "Turn the chair over", pose: "+y", kind: "standup" });
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  if (/norrmanso-chair/.test(slug)) return chair(b, s);
  if (/norrmanso-table/.test(slug))
    return trestle(b, s, { W, H, D, T: 40, legX: W / 2 - 370, pw: 60, gap: 60, foot: [80, 70, 760], rail: [80, 60, 840], bw: 60, kit: true, halves: true, str: { y: 165, h: 70, w: 56 }, centre: 2 });
  if (/norrmanso-bench/.test(slug)) {
    if (W >= 1500) return trestle(b, s, { W, H, D, T: 35, legX: W / 2 - 240, pw: 45, gap: 46, foot: [60, 50, 380], rail: [60, 50, 360], bw: 45, kit: true, halves: false, str: { y: 120, h: 50, w: 44 }, centre: 1 });
    return trestle(b, s, { W, H, D, T: 35, legX: W / 2 - 130, pw: 45, gap: 46, foot: [70, 50, 380], rail: [60, 50, 360], bw: 45, kit: false, halves: false, centre: 1 });
  }
  return false;
}

const family: Family = { names: ["NORRMANSÖ"], build };
export default family;
