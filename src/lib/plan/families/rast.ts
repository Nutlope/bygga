import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * RAST, read from its manuals (chest of 3 drawers 60x59, 6-drawer dresser 124x68). Solid pine: plastic runners are
 * screwed to the inside of the sides first, the top and two bottom rails go between the sides on dowels and long
 * screws, and the hardboard back slides into grooves (3 drawers, with push pins) or is nailed on (6 drawers). Glides
 * go under the sides, two brackets on the top hold it to the wall with the screws and plugs in the box. Each drawer
 * is a front with four cam bolts, two sides locked with cams, a bottom slid in, a back knocked on with ribbed pins
 * and a knob; turn stops in the carcass keep the drawers in. The 6-drawer dresser has a middle divider joined to
 * the rails and the top with cam locks. The 3-drawer dresser 62x70 (rast-3-drawers, US manual) is built like one
 * column of the 6-drawer dresser: one screw per rail end and a nailed back.
 */

const T = 18;

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const cols = W > 900 ? 2 : 1;
  const rows = 3;
  const six = cols === 2;
  const old = /^rast-3-drawers$/.test(s.slug ?? "");
  const nailed = six || old;
  const zb = -D / 2 + 8; // the back lies behind the boards
  const zf = D / 2;
  const inW = W - 2 * T - (cols - 1) * T;
  const colW = inW / cols;
  const colX = (c: number) => -W / 2 + T + colW / 2 + c * (colW + T);
  const railH = 60, y0 = 20 + railH; // the drawers start above the bottom rail, which stands a little off the floor
  const y1 = H - T;
  const rowH = (y1 - y0) / rows;
  const parts: CustomPart[] = [];
  const wood = (id: string, name: string, size: Vec3, pos: Vec3) => parts.push({ id, name, size, pos, material: "wood" });
  for (const [id, sx] of [["sL", -1], ["sR", 1]] as const) wood(id, "Side", [T, H, D], [sx * (W / 2 - T / 2), H / 2, 0]);
  wood("top", "Top", [W - 2 * T, T, D - 8], [0, H - T / 2, 4]);
  if (six) wood("dv", "Divider", [T, y1, D - 8], [0, y1 / 2, 4]);
  // bottom rails, front and back (split at the divider on the dresser)
  const rails: string[] = [];
  const railSpan = (c: number): [number, number] => (six ? [colX(c), colW] : [0, inW]);
  for (let c = 0; c < cols; c++) {
    const [x, w] = railSpan(c);
    wood(`rF${c}`, "Front rail", [w, railH, T], [x, 20 + railH / 2, zf - T / 2]);
    wood(`rB${c}`, "Back rail", [w, railH, T], [x, 20 + railH / 2, zb + T / 2]);
    rails.push(`rF${c}`, `rB${c}`);
  }
  parts.push({ id: "back", name: "Back panel", size: [nailed ? W : W - 2 * T + 16, H - 20, 3], pos: [0, 20 + (H - 20) / 2, nailed ? -D / 2 - 1.5 : -D / 2 + 5], material: "fiber" });

  // drawers
  const dw = colW - 6, dd = D - 50, st = 12;
  const drawers: { c: number; r: number; x: number; y0: number; h: number }[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) drawers.push({ c, r, x: colX(c), y0: y0 + r * rowH + 3, h: rowH - 6 });
  const ids = (p: string) => drawers.map((_, i) => `${p}${i}`);
  drawers.forEach((d, i) => {
    const zs = zf - T - (dd - T) / 2;
    wood(`df${i}`, "Drawer front", [dw, d.h, T], [d.x, d.y0 + d.h / 2, zf - T / 2]);
    wood(`dl${i}`, "Drawer side", [st, d.h - 25, dd - T], [d.x - dw / 2 + 12 + st / 2, d.y0 + 10 + (d.h - 25) / 2, zs]);
    wood(`dr${i}`, "Drawer side", [st, d.h - 25, dd - T], [d.x + dw / 2 - 12 - st / 2, d.y0 + 10 + (d.h - 25) / 2, zs]);
    parts.push({ id: `db${i}`, name: "Drawer bottom", size: [dw - 24 - 2 * st, 3, dd - T - st], pos: [d.x, d.y0 + 18, zs + st / 2], material: "fiber" });
    wood(`dk${i}`, "Drawer back", [dw - 24 - 2 * st, d.h - 45, st], [d.x, d.y0 + 20 + (d.h - 45) / 2, zf - dd + st / 2]);
  });

  // ---------- fittings ----------
  const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const zMid = 0;
  // runners: one per drawer on each wall of its column
  const walls = (c: number) => [colX(c) - colW / 2, colX(c) + colW / 2];
  const runnerY = (d: (typeof drawers)[number]) => d.y0 + d.h / 2;
  const runnerFix = (pick: (x: number) => boolean, sx: number): CustomFix[] => {
    const at: Vec3[] = [];
    for (const d of drawers) for (const [k, x] of walls(d.c).entries()) if (pick(x) && (k ? 1 : -1) === sx) at.push([x, runnerY(d), zMid]);
    const screws = at.flatMap((p) => [-1, 1].map((k) => [p[0], p[1] + 8, k * (D / 2 - 70)] as Vec3));
    return [fix("runner", at, [sx, 0, 0], { len: D - 60, dia: 24, name: "Drawer runner" }), fix("screw", screws, [sx, 0, 0], { len: 12, dia: 3.5 })];
  };
  const isSide = (x: number) => Math.abs(Math.abs(x) - (W / 2 - T)) < 1;
  const sideScrews = (sx: number): CustomFix => {
    const pts: Vec3[] = [
      // beside the top's dowels, not on them
      ...[-1, 1].map((k) => [sx * (W / 2), H - T / 2, k * (D / 2 - 100)] as Vec3),
      // the chest takes two screws into each rail end, the dresser one
      ...[zf - T / 2, zb + T / 2].flatMap((z) => (nailed ? [14] : [-14, 14]).map((dy) => [sx * (W / 2), 20 + railH / 2 + dy, z] as Vec3)),
    ];
    return fix("screw", pts, [-sx, 0, 0], { name: "Connector screw", len: 50, dia: 7, on: sx < 0 ? "sL" : "sR" });
  };
  const brackets: Vec3[] = [-1, 1].map((sx) => [sx * (W / 2 - T - 60), H, zb + 4] as Vec3);
  const glides: Vec3[] = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - T / 2), 0, sz * (D / 2 - 50)] as Vec3)),
    ...(six ? [-1, 1].map((sz) => [0, 0, sz * (D / 2 - 50)] as Vec3) : []),
  ];
  const nD = drawers.length;
  const steps: CustomStep[] = [];
  const push = (st: CustomStep) => steps.push(st);
  const chunk = (st: CustomStep, fixes: CustomFix[]) => {
    for (let i = 0; i < fixes.length; i += 10) push({ ...st, fix: fixes.slice(i, i + 10), add: i ? [] : st.add });
  };

  if (six) {
    push({
      title: "Tap dowels into the bottom rails",
      detail: "Into the ends of the four rail halves: plain ones at the side ends, the dark joining dowels at the divider.",
      fix: [
        ...rails.map((id) => {
          const c = id.endsWith("1") ? 1 : 0;
          return fix("dowel", [[c ? W / 2 - T : -W / 2 + T, 20 + railH / 2, id.startsWith("rF") ? zf - T / 2 : zb + T / 2]], [c ? 1 : -1, 0, 0], { len: 30, dia: 8, on: id });
        }),
        ...["rF0", "rB0"].map((id) => fix("dowel", [[-T / 2, 20 + railH / 2, id === "rF0" ? zf - T / 2 : zb + T / 2]], [1, 0, 0], { name: "Joining dowel", len: 40, dia: 8, on: id })),
      ],
      add: rails,
      tools: ["hammer"],
      pose: "-z",
      warnings: ["floor"],
    });
    push({ title: "Screw cam bolts into the back rail ends", detail: "One into the inner end of each back rail half, by hand.", fix: [fix("camScrew", [[-T / 2, 20 + railH / 2, zb + T / 2], [T / 2, 20 + railH / 2, zb + T / 2]], [-1, 0, 0], { len: 34 })] });
    push({ title: "Join the rails to the divider", detail: "Push the rail halves onto the divider from both sides, then turn the two cam locks clockwise.", add: ["dv"], fix: [fix("cam", [[0, 20 + railH / 2 + 15, zb + T + 20], [0, 20 + railH / 2 - 15, zb + T + 20]], [0, 0, -1], { on: "dv", dia: 15 })], tools: ["screwdriver"] });
    push({
      title: "Fit the wall brackets to the top",
      detail: "Two dowels into the top and a cam bolt, then the two brackets at the back with a screw and washer each.",
      add: ["top"],
      fix: [
        fix("dowel", [-1, 1].map((k) => [0, H - T, k * (D / 2 - 60)] as Vec3), [0, 1, 0], { len: 30, dia: 8, mate: "dv" }),
        ...[-1, 1].map((sx) => fix("dowel", [-1, 1].map((k) => [sx * (W / 2 - T), H - T / 2, k * (D / 2 - 60)] as Vec3), [sx, 0, 0], { len: 30, dia: 8, on: "top" })),
        fix("camScrew", [[0, H - T, 0], [0, H - T, -60]], [0, 1, 0], { len: 34 }),
        fix("angle", brackets, [0, 0, 1], { name: "Wall bracket", len: 80, dia: 30 }),
        fix("washer", brackets.map((p) => [p[0], p[1] - 1, p[2] + 25] as Vec3), [0, -1, 0]),
        fix("screw", brackets.map((p) => [p[0], p[1] - 2, p[2] + 25] as Vec3), [0, -1, 0], { len: 16, dia: 4, on: "top" }),
      ],
      tools: ["screwdriver"],
    });
    push({ title: "Lock the top to the divider", detail: "Two cam locks in the divider, turned clockwise.", fix: [fix("cam", [[0, H - T - 35, 30], [0, H - T - 35, -30]], [0, 0, 1], { on: "dv", dia: 15 })], tools: ["screwdriver"] });
    chunk({ title: "Screw the runners onto the divider", detail: "Three on each face, two screws each, the open end towards the front." }, [...runnerFix((x) => !isSide(x), 1), ...runnerFix((x) => !isSide(x), -1)]);
  }

  // the runners on the sides go on first, with each side lying on a rug
  const sideRunners = [...runnerFix(isSide, -1), ...runnerFix(isSide, 1)];
  chunk({ title: "Screw the runners onto the sides", detail: `Lay the sides flat on a rug, inside up. ${cols * 3} runners, two screws each, the slotted end at the front.`, add: ["sL", "sR"], ...(six ? {} : { pose: "+x" as const }), warnings: ["floor"] }, sideRunners);
  if (!six) {
    push({ title: "Tap dowels into the top", detail: "Two into each end.", add: ["top"], fix: [-1, 1].map((sx) => fix("dowel", [-1, 1].map((k) => [sx * (W / 2 - T), H - T / 2, k * (D / 2 - 60)] as Vec3), [sx, 0, 0], { len: 30, dia: 8, on: "top" })), tools: ["hammer"], pose: "+y" });
    push({
      title: "Screw the wall brackets onto the top",
      detail: "At the back corners, one screw and washer each. Use the short screws, not the wall screws.",
      fix: [fix("angle", brackets, [0, 0, 1], { name: "Wall bracket", len: 80, dia: 30, on: "top" }), fix("washer", brackets.map((p) => [p[0], p[1] - 1, p[2] + 25] as Vec3), [0, -1, 0]), fix("screw", brackets.map((p) => [p[0], p[1] - 2, p[2] + 25] as Vec3), [0, -1, 0], { len: 16, dia: 4, on: "top" })],
      tools: ["screwdriver"],
    });
    push({ title: "Screw the top to one side", detail: "Two long screws through the side with the box spanner and Allen key.", fix: [{ ...sideScrews(-1), at: sideScrews(-1).at!.slice(0, 2), count: 2 }], tools: ["allen"], pose: "-z" });
    push({ title: "Tap dowels into the bottom rails", detail: old ? "One into each end of both rails." : "Two into each end of both rails.", fix: rails.flatMap((id) => [-1, 1].map((sx) => fix("dowel", [[sx * (W / 2 - T), 20 + railH / 2, id.startsWith("rF") ? zf - T / 2 : zb + T / 2]], [sx, 0, 0], { len: 30, dia: 8, on: id }))), tools: ["hammer"] });
    if (old) {
      push({ title: "Push the rails into the side", detail: "Front and back, then one long screw through the side into each.", add: rails, fix: [{ ...sideScrews(-1), at: sideScrews(-1).at!.slice(2), count: 2 }], tools: ["allen"] });
      push({ title: "Screw the other side on", detail: "Onto the dowels, then four long screws through it: two into the top and one into each rail.", fix: [sideScrews(1)], tools: ["allen"], check: "square" });
    } else
      push({
        title: "Fit the rails and the other side",
        detail: "Push the rails into the first side, lay the second side on, then six long screws through it: two into the top and two into each rail.",
        add: rails,
        fix: [sideScrews(1)],
        tools: ["allen"],
        check: "square",
      });
  } else {
    push({
      title: "Screw the sides on",
      detail: "Lay the frame on its front. Four long screws through each side into the top and the rails.",
      fix: [sideScrews(-1), sideScrews(1)],
      tools: ["allen"],
      pose: "-z",
      check: "square",
    });
  }
  if (!nailed) {
    push({ title: "Slide the back panel in", detail: "Into the grooves in the sides from the bottom, smooth side in.", add: ["back"], from: { back: [0, -400, 0] } });
    const pts: Vec3[] = [[-W / 4, H - T / 2, -D / 2 + 3], [W / 4, H - T / 2, -D / 2 + 3], [-W / 4, 20 + railH / 2, -D / 2 + 3], [W / 4, 20 + railH / 2, -D / 2 + 3]];
    push({ title: "Push the sleeves into the back", detail: "Four plastic sleeves into the holes, two into the top and two into the back rail.", fix: [fix("plug", pts, [0, 0, 1], { name: "Plastic sleeve", included: true, len: 12, dia: 8 })] });
    push({ title: "Press a pin into each sleeve", detail: "It spreads the sleeve and holds the back tight.", fix: [fix("cap", pts, [0, 0, 1], { name: "Push pin", len: 12, dia: 12 })] });
    push({ title: "Press the glides under the sides", detail: "Two under each side, pegs into the holes.", fix: [fix("glide", glides, [0, 1, 0], { name: "Glide", len: 6, dia: 20 })] });
  } else {
    push({ title: "Press the glides in", detail: six ? "Two under each side and two under the divider." : "Two under each side.", fix: [fix("glide", glides, [0, 1, 0], { name: "Glide", len: 6, dia: 20 })], pose: "-z" });
    push({ title: "Lay the back panel on", detail: "Smooth side in. Line it up with the corners so the frame sits square.", add: ["back"], from: { back: [0, 0, -300] }, check: "square" });
    const nails: Vec3[] = [];
    const row = (n: number, y: number) => { for (let i = 0; i < n; i++) nails.push([-W / 2 + 10 + ((W - 20) * i) / (n - 1), y, -D / 2 - 3]); };
    if (six) for (const y of [30, (H - T) * 0.5, H - 10]) row(10, y);
    else { row(6, 30); row(6, H - 10); for (const y of [H * 0.3, H * 0.6]) for (const sx of [-1, 1]) nails.push([sx * (W / 2 - 9), y, -D / 2 - 3]); }
    chunk({ title: "Nail the back on", detail: `${nails.length} nails along the edges${six ? " and across the middle" : ""}, with the nail holder. A corner first, then check it's square.`, tools: ["hammer"] }, [fix("nail", nails, [0, 0, 1], { len: 20, dia: 1.6 })]);
  }
  push({ title: six ? "Stand it up together" : "Stand it up", detail: "Lift it upright, don't drag it by one corner.", pose: "+y", people: six ? 2 : 1, warnings: six ? ["two"] : [] });
  const wall: Vec3[] = brackets.map((p) => [p[0], p[1] - 30, -D / 2 - 2]);
  push({
    title: "Screw it to the wall",
    detail: "Slide the brackets up against the wall, mark, drill and fix them with the wall screws and plugs in the box. For other walls, use fittings made for them.",
    fix: [
      fix("plug", wall.map((p) => [p[0], p[1], p[2] - 40] as Vec3), [0, 0, -1], { len: 35, dia: 8, included: true }),
      fix("washer", wall, [0, 0, -1]),
      fix("screw", wall.map((p) => [p[0], p[1], p[2] + 1] as Vec3), [0, 0, -1], { len: 50, dia: 5, included: true }),
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });

  // drawers: every step shown for all of them at once
  const sideIds = (i: number) => [`dl${i}`, `dr${i}`];
  push({
    title: "Screw the cam bolts into the drawer fronts",
    detail: `Lay each front face down on a rug. Four bolts into its back, by hand. Do the same for all ${nD} drawers.`,
    add: ids("df"),
    fix: drawers.slice(0, 10).map((d, i) => fix("camScrew", [-1, 1].flatMap((sx) => [d.y0 + 30, d.y0 + d.h - 30].map((y) => [d.x + sx * (dw / 2 - 12 - st / 2), y, zf - T] as Vec3)), [0, 0, 1], { on: `df${i}`, len: 34 })),
    tools: ["screwdriver"],
  });
  push({ title: "Stand the sides on the cam bolts", detail: "Grooves facing in. Hold them upright, don't let them tip.", add: drawers.flatMap((_, i) => sideIds(i)) });
  chunk(
    { title: "Lock the cams in the sides", detail: "Two in each side, turned clockwise.", tools: ["screwdriver"] },
    drawers.flatMap((d, i) => [-1, 1].map((sx) => fix("cam", [d.y0 + 40, d.y0 + d.h - 40].map((y) => [d.x + sx * (dw / 2 - 12 - st), y, zf - T - 30] as Vec3), [sx, 0, 0], { on: sideIds(i)[sx < 0 ? 0 : 1], dia: 15 }))),
  );
  push({ title: "Slide the bottoms in", detail: "Down into the grooves in the sides and front.", add: ids("db"), from: Object.fromEntries(ids("db").map((id) => [id, [0, 0, -260] as Vec3])) });
  chunk(
    { title: "Knock the backs on", detail: "Lay each back between the sides and knock four ribbed pins through the sides into it.", add: ids("dk"), tools: ["hammer"] },
    drawers.flatMap((d, i) => [-1, 1].map((sx) => fix("nail", [d.y0 + 35, d.y0 + d.h - 40].map((y) => [d.x + sx * (dw / 2 - 12), y, zf - dd + st / 2] as Vec3), [-sx, 0, 0], { name: "Ribbed pin", len: 30, dia: 6, on: sideIds(i)[sx < 0 ? 0 : 1] }))),
  );
  chunk(
    { title: "Screw on the knobs", detail: "One screw from the inside of each front into its knob.", tools: ["screwdriver"] },
    drawers.flatMap((d, i) => [fix("knob", [[d.x, d.y0 + d.h / 2, zf + 3]], [0, 0, -1], { on: `df${i}`, len: 25, dia: 34 }), fix("screw", [[d.x, d.y0 + d.h / 2, zf - T - 2]], [0, 0, 1], { len: 30, dia: 4 })]),
  );
  push({ title: "Slide the drawers in", detail: "Onto the runners, all the way in." });
  const stopL: Vec3[] = drawers.map((d) => [walls(d.c)[0], d.y0 + d.h + 1, zf - 40]);
  const stopR: Vec3[] = drawers.map((d) => [walls(d.c)[1], d.y0 + d.h + 1, zf - 40]);
  push({
    title: "Screw in the drawer stops",
    detail: `${2 * nD} stops, two above each drawer, into the walls just inside the front. They keep the drawers from pulling out.`,
    fix: [fix("stud", stopL, [-1, 0, 0], { name: "Drawer stop", len: 10, dia: 12 }), fix("stud", stopR, [1, 0, 0], { name: "Drawer stop", len: 10, dia: 12 })],
    tools: ["screwdriver"],
  });
  return { parts, steps };
}

const family: Family = {
  names: ["RAST"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/rast-chest-3-drawers-60|rast-6-drawer-dresser|^rast-3-drawers$/.test(slug)) return recipe(s);
    return null;
  },
};
export default family;
