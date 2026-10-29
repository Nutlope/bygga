export type Vec3 = [number, number, number];

export type Archetype = "shelf" | "drawers" | "table" | "bed" | "cabinet" | "seat" | "sofa" | "custom";

export interface ShelfParams {
  style: "grid" | "bookcase" | "rack" | "screen" | "hatrack" | "stand" | "airer"; // a rack: two uprights on feet with a rail across the top; a screen: hinged panels; a hat rack on the wall; a coat stand
  cols: number;
  rows: number;
  shelves: number; // adjustable shelves (bookcase)
  fixedShelf: boolean;
  back: boolean;
  plinth: boolean;
  outer: number; // mm panel thickness of frame
  inner: number; // mm thickness of inner shelves/dividers
  wall?: boolean; // hangs on the wall instead of standing on the floor
  underframe?: number; // cm: a cube grid standing on an underframe this tall (size.h takes it in)
  inserts?: number; // a cube grid sold with this many inserts with a door, from the bottom row up
  shoes?: boolean; // a rack with a shoe shelf low down instead of a lower rail
  changing?: boolean; // a changing table: a changing top goes on last (size.h takes it in)
  rail?: boolean; // open shelving with a clothes rail under a shelf near the top
  boxUnder?: number; // cm: open shelving with this much room under the bottom shelf, for a storage box on castors
}

export interface DrawersParams {
  cols: 1 | 2;
  rows: number;
  knobs: "none" | "knob" | "bar";
  plinth: boolean;
  thickness: number;
  changing?: boolean; // a changing table: a changing top goes on last (size.h and size.d take it in)
  castors?: boolean; // stands on castors (size.h takes them in)
  free?: boolean; // low enough to stand free: not fixed to the wall (a TV bench with drawers)
  modules?: number; // a modular chest (NORDLI): this many columns of `rows` slots, split by dividers
  count?: number; // modular chests: drawers in the slots, from the bottom row up; the rest stay open
}

export interface TableParams {
  topThickness: number;
  legs: "square" | "round";
  legSize: number;
  shelf: boolean;
  attach: "screw" | "plate" | "apron";
  round?: boolean; // round top, size.w is the diameter
  leaves?: number; // a drop-leaf table: 1 or 2 hinged leaves; size.w is the width with them up
  leaf?: number; // cm, width of each leaf
  gate?: boolean; // a gateleg table: each leaf rests on a gate leg that swings out from the frame
  hinges?: boolean; // the leaves come loose and are screwed on with hinges
  ell?: number; // cm: a corner desk, an L-shaped top this deep along each wall (size.w and size.d are its legs)
  drawers?: number; // drawers side by side under the top, in guides between the rails
  knobs?: "none" | "knob" | "bar"; // on the drawer fronts
  mirror?: number; // cm: a dressing table's mirror, standing at the back of the top (size.h takes it in)
  frame?: number; // cm: a low desk whose top sits between two storage frames this wide (TROFAST)
  boxes?: number; // boxes in each of those frames
  shelvesIn?: boolean; // shelves in the frames instead of boxes
  levels?: number; // shelves under the top, evenly up the legs (a trolley's tiers); one when it isn't set
  riser?: boolean; // a laptop or monitor stand: a top on two side panels
  rack?: number; // cm: a rack rising from the back of the top, two posts and a rail with hooks (size.h takes it in)
  seat?: boolean; // a bench or stool built like a table: the top is its seat
  inner?: boolean; // the shelf fits between the legs, screwed through them
}

export interface BedParams {
  mattressW: number; // cm
  mattressL: number; // cm
  headH: number; // cm
  footH: number; // cm, 0 for none
  slats: number;
  centerBeam: boolean;
  type?: "cot" | "bunk" | "loft" | "daybed"; // a cot with barred sides, two beds stacked on posts, one bed up high, or a day-bed
  drawer?: boolean; // a cot with a drawer under the base
  under?: "pullout" | "trundle" | "boxes"; // day-beds: a bed that pulls out (with drawers), a trundle, or storage boxes on castors
  drawers?: number; // day-beds: drawers in the pull-out bed
  knobs?: "none" | "knob" | "bar"; // day-beds: on the drawer fronts
  mattresses?: number; // day-beds: mattresses that come in the box
}

export interface CabinetParams {
  fronts: "doors" | "tilt" | "sliding";
  compartments: number;
  doors: 0 | 1 | 2;
  shelves: number;
  rail: boolean;
  plinth: boolean;
  handles: "knob" | "bar" | "none";
  thickness: number;
  wall?: boolean; // hangs on the wall instead of standing on the floor
  drawers?: number; // drawers as well as doors: full-width drawers, split from the doors by a fixed shelf
  drawerAt?: "top" | "bottom"; // where the drawers are; under the doors unless it says top
  slides?: number; // sliding doors: how many, running in two tracks
  fit?: FitParams; // built around a basin, a sink or an appliance that is fitted afterwards
  corner?: CornerCab; // a kitchen corner cabinet
  lid?: { soft?: boolean }; // a box with a lid on hinges instead (storage benches); a padded lid on a footstool
  castors?: boolean; // stands on castors (size.h takes them in)
  onTop?: "bookcase" | "cabinet"; // a height extension unit: fixed on top of the bookcase or cabinet it extends
  low?: number; // cm: a shelving unit with a cabinet this high at the bottom, doors over it and open shelves above
  upstand?: number; // cm: a back panel standing up from the back of the top (size.h takes it in)
}

/**
 * A kitchen corner cabinet. An L has a leg along each wall, `depth` deep, and a door in two halves that folds at the
 * inner corner (size.w and size.d are the legs). A blind corner is one long carcass with a door at its open end;
 * the rest of its front hides behind the cabinet on the other wall.
 */
export interface CornerCab {
  shape: "l" | "blind";
  depth?: number; // cm: how deep each leg of an L is
  door?: number; // cm: how wide a blind corner's door is
  inner?: "shelf" | "carousel" | "pullout"; // what goes inside, besides the shelves
  drawer?: boolean; // a blind corner: a drawer over the door
}

/** What a fitted cabinet is built around. The guide builds the cabinet only, and says so at the end. */
export type FitUse = "basin" | "sink" | "hob" | "oven" | "ovenhob" | "fridge" | "microwave" | "hood" | "appliance" | "storage";

/** One band of a fitted cabinet's front, from the bottom up. */
export interface FitZone {
  // drawers, doors, a fixed front that doesn't open (in front of a sink), an opening for an appliance,
  // open shelves, or room at the top for a sink's own front
  kind: "drawers" | "doors" | "front" | "gap" | "open" | "apron";
  h: number; // cm of the front; 0 shares out what is left
  n?: number; // drawers in the band, doors side by side (1 or 2), or shelves when open
  shelves?: number; // shelves behind the doors
}

export interface FitParams {
  use: FitUse;
  zones: FitZone[]; // from the bottom up
  basin?: number; // cm: a wash-basin that comes in the box, this thick; size includes it, and it goes on top last
  rails?: boolean; // two rails across the top instead of a top panel
  hangFirst?: boolean; // hung on the wall before the fronts go on (wash-stands)
}

export interface SeatParams {
  kind: "stool" | "chair" | "bench" | "office" | "highchair" | "lounger" | "swivel";
  seat: "round" | "square";
  seatH: number; // cm
  backH: number; // cm (chair total height)
  stretchers: boolean;
  splay: boolean;
  arms?: boolean; // office chairs and chairs: armrests
  tray?: boolean; // highchairs: false when it comes without a tray
  rock?: boolean; // swivel easy chairs: it rocks as well
}

export interface SofaParams {
  seats: number;
  arms: "wide" | "slim" | "none";
  legs: "round" | "block";
  chaise?: "left" | "right" | "both"; // a chaise longue at that end, seen from the front; size.d is its length
  corner?: "left" | "right"; // an L: the return runs forward on that side; size.d is its length
  open?: boolean; // corner sofas: no armrest at the front of the return
  depth?: number; // cm, depth of the seat sections of a corner or chaise sofa
  reach?: number; // cm, how far a U-shaped sofa's chaise longue reaches forward (with both corner and chaise set)
  foot?: boolean; // an armchair that comes with its footstool, built after it and stood in front of it
  pouffe?: boolean; // a pouffe or footstool on its own: a padded block on four legs
  round?: boolean; // a pouffe: a padded drum instead of a block
  bed?: boolean; // a chair-bed: it folds out into a bed
  table?: number; // cm: a side table module at the right-hand end (size.w takes it in)
  // IKEA's own measurements, in cm, where the product has them (see src/lib/plan/sofaDims.ts)
  seatH?: number; // top of the seat cushions
  seatD?: number; // how deep the seat is, from the back cushions to the front edge
  armH?: number; // top of the armrests
  armW?: number; // how wide each armrest is
  backH?: number; // top of the backrest frame, under the back cushions
  legH?: number; // room under the frame
}

/** A product read from someone's own manual: parts as boxes in the assembled product, steps that add them. */
export interface CustomPart {
  id: string;
  label?: string; // the manual's own part number or letter, when short
  name: string;
  size: Vec3; // mm along x (width), y (height), z (depth) as it sits in the finished product
  pos: Vec3; // mm, centre of the part; y up from the floor, x left to right, z back to front
  shape?: "box" | "cyl";
  material?: PartMaterial;
  rot?: Vec3; // radians, when it doesn't sit square (a leaning back, a splayed leg); size is before turning
  pieces?: PartPiece[]; // drawn as these boxes and cylinders (positions from pos) instead of one box of size
  extra?: boolean; // not in the box (a mattress, the wall)
}

export interface CustomFix {
  kind: HwKind;
  count: number;
  len?: number;
  dia?: number;
  to?: string[]; // parts it goes into, when the manual says
  name?: string; // its own name when the kind's general one doesn't fit
  included?: boolean; // wall plugs and screws that come in the box (they're marked not included otherwise)
  // exactly where each one goes, when the joint finder would guess wrong: points in the finished product (mm),
  // the way each one goes in, the part it sits in and the part its other end goes into
  at?: Vec3[];
  dir?: Vec3;
  on?: string;
  mate?: string;
  twist?: number; // radians about the way it goes in (an angle bracket's tab lying flat)
}

export interface CustomStep {
  title: string;
  detail?: string;
  add?: string[];
  fix?: CustomFix[];
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  warnings?: WarnId[];
  from?: Record<string, Vec3>; // part id -> offset it arrives from (mm), when the guess isn't right
  wait?: string[]; // parts that take fittings in this step but are joined in a later one: shown beside the build until then
  repeat?: number; // "do this twice": the same step for the other side
  kind?: StepKind;
  check?: "square";
  wall?: boolean;
}

export interface CustomParams {
  parts: CustomPart[];
  steps: CustomStep[];
  fromCover?: boolean;
}

export type TipKey =
  | "general"
  | "frame"
  | "back"
  | "shelves"
  | "drawers"
  | "doors"
  | "legs"
  | "slats"
  | "cushions"
  | "anchor";

export interface ProductSpec {
  name: string;
  variant: string;
  category: string;
  archetype: Archetype;
  size: { w: number; h: number; d: number }; // cm
  minutes: number;
  people: 1 | 2;
  difficulty: 1 | 2 | 3;
  material?: string;
  shelf?: Partial<ShelfParams>;
  drawers?: Partial<DrawersParams>;
  table?: Partial<TableParams>;
  bed?: Partial<BedParams>;
  cabinet?: Partial<CabinetParams>;
  seat?: Partial<SeatParams>;
  sofa?: Partial<SofaParams>;
  custom?: CustomParams;
  brand?: string;
  tips?: Partial<Record<TipKey, string>>;
  watchOut?: string[];
  source: "catalog" | "ai" | "guess" | "scan";
  slug?: string;
  variants?: { label: string; slug: string }[];
  siblings?: { label: string; slug: string }[];
  row?: { n: number; join?: boolean; of?: string; slide?: number; units?: RowUnit[] }; // several identical units side by side, built one after another, with sliding doors across them all
}

/** One frame of a row whose frames aren't all alike, or of a corner: its own size and parameters, and where it stands. */
export interface RowUnit {
  w: number; // cm
  d?: number; // cm, when it isn't as deep as the row
  at?: [number, number]; // cm, the middle of its footprint (x, z); otherwise side by side from the left, backs in line
  turn?: boolean; // stands with its back to the left-hand wall
  corner?: boolean; // the add-on unit that fills the corner
  cabinet?: Partial<CabinetParams>;
  shelf?: Partial<ShelfParams>;
}

/* ---------- generated plan ---------- */

export type PartMaterial = "board" | "fiber" | "wood" | "metal" | "soft" | "glass";

/** One box or cylinder of a part made of several (a star base, a cot side with bars), in the part's own frame. */
export interface PartPiece {
  shape: "box" | "cyl" | "halfcyl" | "slab"; // halfcyl: half a disc, [dia, thickness, dia / 2], flat edge at the back (-z)
  outline?: [number, number][]; // slab: its corners as [x, z] (mm, from pos), drawn as one board of size[1] thickness
  round?: number; // slab: corner radius
  size: Vec3; // mm, box extents or cylinder [dia, length, dia]
  pos: Vec3; // mm, from the centre of the part
  rot?: Vec3;
  material?: PartMaterial;
}

export interface PartType {
  id: string;
  label: string; // letter
  name: string;
  size: Vec3; // mm, box extents or cylinder [dia, length, dia]; the bounding box when it has pieces
  shape: "box" | "cyl";
  material: PartMaterial;
  qty: number;
  extra?: boolean; // not in the box (e.g. mattress)
  pieces?: PartPiece[]; // drawn as these boxes and cylinders instead of one
}

export type HwKind =
  | "dowel"
  | "camScrew"
  | "cam"
  | "screw"
  | "nail"
  | "pin"
  | "legScrew"
  | "bolt"
  | "plate"
  | "bracket"
  | "runner"
  | "knob"
  | "handle"
  | "hinge"
  | "glide"
  | "plug"
  | "castor"
  | "gasLift"
  | "connector"
  | "roller"
  | "flatHinge"
  | "hook"
  | "clip"
  | "strap"
  | "nut"
  | "washer"
  | "stud"
  | "clamp"
  | "angle"
  | "foot"
  | "cap"
  | "spacer";

export interface HwType {
  id: string;
  kind: HwKind;
  name: string;
  spec: string;
  len: number;
  dia: number;
  qty: number;
  notIncluded?: boolean;
}

export interface Hole {
  p: Vec3;
  n: Vec3;
  r: number;
}

/** A display state of a part: from `step` on it sits at pos/rot inside `scene`. The last state is the assembled one. */
export interface PartState {
  step: number;
  scene: string;
  pos: Vec3;
  rot: Vec3;
  from?: Vec3; // approach offset in scene frame
  spin?: number; // revolutions about local Y while approaching
  delay: number;
}

export interface PartItem {
  key: string;
  kind: "part";
  ref: string;
  final: { pos: Vec3; rot: Vec3 };
  states: PartState[];
  holes: Hole[];
}

export interface HwItem {
  key: string;
  kind: "hw";
  ref: string;
  parent?: string; // part key (local coords) or none (scene coords)
  scene?: string;
  step: number;
  pos: Vec3;
  dir: Vec3; // insertion direction, pointing into the material
  twist?: number;
  travel: number;
  spin?: number;
  turn?: number;
  delay: number;
  scale?: number;
  preset?: boolean;
}

export type Item = PartItem | HwItem;

export type ToolId =
  | "allen"
  | "screwdriver"
  | "flathead"
  | "hammer"
  | "drill"
  | "level"
  | "tape"
  | "pencil"
  | "wrench"
  | "knife";

export type WarnId =
  | "two"
  | "loose"
  | "hand"
  | "wall"
  | "square"
  | "floor"
  | "face"
  | "tip";

export type Pose = "+y" | "-y" | "+z" | "-z" | "+x" | "-x";

export type StepKind =
  | "dowels"
  | "bolts"
  | "cams"
  | "nails"
  | "square"
  | "flip"
  | "standup"
  | "shelves"
  | "anchor"
  | "drawer"
  | "runners"
  | "legs"
  | "doors"
  | "hinges"
  | "slats"
  | "join"
  | "screws"
  | "cushions"
  | "general";

export interface Step {
  n: number;
  title: string;
  detail?: string;
  tools: ToolId[];
  people: 1 | 2;
  repeat?: number;
  scene: string;
  pose: Pose;
  warnings: WarnId[];
  kind: StepKind;
  check?: "square";
  wall?: boolean;
  quiet?: boolean;
  minutes: number;
}

export interface ToolNeed {
  id: ToolId;
  included?: boolean;
  optional?: boolean;
  why?: string;
}

export interface Plan {
  spec: ProductSpec;
  parts: PartType[];
  hardware: HwType[];
  items: Item[];
  steps: Step[];
  tools: ToolNeed[];
}
