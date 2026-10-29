import type { Archetype, CornerCab, FitUse, FitZone, ProductSpec, RowUnit } from "./types";

/**
 * A wide offline index of real IKEA product names. Each row is a kind plus outer size (cm);
 * the kind decides the archetype and sensible parameters. Hand-tuned catalog entries win over these.
 */
export type Kind =
  | "cube"
  | "bookcase"
  | "open"
  | "chest"
  | "nightstand"
  | "desk"
  | "coffee"
  | "side"
  | "dining"
  | "bed"
  | "wardrobe"
  | "cabinet"
  | "sideboard"
  | "tv"
  | "shoe"
  | "chair"
  | "stool"
  | "bench"
  | "sofa"
  | "armchair"
  // added with the IKEA product data: existing archetypes with other parameters
  | "wallshelf"
  | "wallcab"
  | "kitchen"
  | "trolley"
  | "bar"
  | "console"
  | "kidstable"
  | "kidschair"
  // added later: new shapes of an existing archetype
  | "office"
  | "chaise"
  | "corner"
  | "cot"
  | "bunk"
  | "loft"
  | "dropleaf"
  | "daybed"
  | "mixed"
  | "sliding"
  | "slidecab"
  | "bookrow"
  | "cabrow"
  | "section"
  | "gateleg"
  | "washstand"
  | "sinkcab"
  | "appliance"
  | "shoerack"
  | "clothesrack"
  | "changing"
  | "divider"
  | "backbench"
  | "junior"
  | "lounge"
  | "highchair"
  // the last hard shapes: corners
  | "cornercab"
  | "cornerrobe"
  | "usofa"
  // the last chairs
  | "lounger"
  | "swivel"
  | "conference"
  | "cornerdesk"
  | "conftable"
  // the long tail of single pieces
  | "lidbox"
  | "shelfbench"
  | "workbench"
  | "extension"
  | "deskdraw"
  | "boxdesk"
  | "hatrack"
  | "coatstand"
  | "pouffe"
  | "chairbed"
  | "airer"
  | "riser";

export type X = {
  rows?: number;
  cols?: 1 | 2;
  knobs?: "none" | "knob" | "bar";
  plinth?: boolean;
  doors?: 0 | 1 | 2;
  shelves?: number;
  c?: number;
  m?: number;
  l?: number;
  f?: number;
  seats?: number;
  arms?: "wide" | "slim" | "none";
  legs?: "round" | "square";
  attach?: "screw" | "plate" | "apron";
  shelf?: boolean;
  min?: number;
  round?: boolean;
  seatH?: number;
  chaise?: "left" | "right" | "both";
  corner?: "left" | "right";
  open?: boolean;
  sd?: number;
  drawer?: boolean;
  leaves?: number;
  leaf?: number;
  under?: "pullout" | "trundle" | "boxes";
  mats?: number;
  dtop?: boolean;
  rail?: boolean;
  slides?: number;
  n?: number;
  of?: "bookcase" | "cabinet" | "tv" | "wardrobe" | "wallcab" | "open";
  hinge?: boolean;
  use?: FitUse;
  z?: string;
  basin?: number;
  hung?: boolean;
  uf?: number;
  ins?: number;
  blind?: number;
  u?: string;
  v?: string;
  cu?: number;
  inner?: "shelf" | "carousel" | "pullout";
  rock?: boolean;
  /** IKEA's own kind of product when the kind's category doesn't name it ("Storage table", "Pouffe") */
  cat?: string;
  /** stands on castors */
  cast?: boolean;
  /** a modular chest: this many columns side by side (NORDLI) */
  mods?: number;
  /** drawers, when there are fewer than the slots: the rest stay open */
  dr?: number;
  /** comes with a footstool */
  foot?: boolean;
  /** cm: a side table module at the right-hand end */
  st?: number;
  /** cm: a cabinet with doors this high at the bottom, open shelves above */
  low?: number;
  /** cm: room under the bottom shelf for a storage box on castors */
  box?: number;
  /** mm: panel thickness, when it isn't the kind's own */
  t?: number;
  /** a mirror on top */
  mirror?: boolean;
  /** cm: a rack or a back panel rising from the back of the top (size.h takes it in) */
  up?: number;
  /** sold in the US and not in the UK: comes after the family's UK pieces in search */
  us?: boolean;
  /** cm, from IKEA's measurements of a sofa or armchair: armrest height and width, backrest height, room under it, seat depth */
  ah?: number;
  aw?: number;
  bk?: number;
  lg?: number;
  sdp?: number;
};

/** A hand made row. `slug` keeps a row's link when IKEA's name for it is corrected (otherwise it comes from the name and variant). */
export type Row = [name: string, kind: Kind, variant: string, w: number, h: number, d: number, x?: X, keywords?: string, slug?: string];

export const ROWS: Row[] = [
  // shelving and bookcases
  ["HEMNES", "bookcase", "Bookcase, 90 × 197 cm", 90, 197, 37, { shelves: 4 }, "bookshelf"],
  ["HEMNES", "bookcase", "Bookcase, 49 × 197 cm", 49, 197, 31, { shelves: 4 }, "narrow bookshelf"],
  ["IVAR", "open", "Shelving unit, 89 × 179 cm", 89, 179, 30, { shelves: 3 }, "pine shelf"],
  ["FINNBY", "bookcase", "Bookcase, 60 × 180 cm", 60, 180, 24, { shelves: 3 }],
  ["GERSBY", "bookcase", "Bookcase, 60 × 180 cm", 60, 180, 24, { shelves: 3 }],
  ["LAIVA", "bookcase", "Bookcase, 62 × 165 cm", 62, 165, 24, { shelves: 3 }],
  ["BRIMNES", "bookcase", "Bookcase, 60 × 190 cm", 60, 190, 35, { shelves: 3 }, "bookshelf"],
  ["HAUGA", "bookcase", "Bookcase, 80 × 199 cm", 80, 199, 35, { shelves: 3 }],
  ["IDANÄS", "bookcase", "Bookcase, 81 × 225 cm", 81, 225, 39, { shelves: 4 }],
  ["FJÄLKINGE", "open", "Shelving unit, 118 × 193 cm", 118, 193, 35, { shelves: 4 }],
  ["BAGGEBO", "bookcase", "Shelf unit, 50 × 160 cm", 50, 160, 25, { shelves: 3 }, "metal shelf"],
  ["HYLLIS", "open", "Shelf unit, 60 × 140 cm", 60, 140, 27, { shelves: 3 }, "metal shelf"],
  ["OMAR", "open", "Shelf section, 92 × 181 cm", 92, 181, 36, { shelves: 4 }, "metal shelving"],
  ["ALBERT", "open", "Shelving unit, 64 × 159 cm", 64, 159, 28, { shelves: 3 }],
  ["BROR", "open", "Shelving unit, 85 × 190 cm", 85, 190, 40, { shelves: 3 }, "garage shelf"],
  ["VITTSJÖ", "open", "Shelving unit, 51 × 175 cm", 51, 175, 36, { shelves: 4 }],
  ["KOLBJÖRN", "open", "Shelving unit, 80 × 81 cm", 80, 81, 35, { shelves: 1 }],
  ["TROFAST", "cube", "Storage frame, 99 × 94 cm", 99, 94, 44, {}, "kids toy storage"],
  ["EKET", "cube", "Cabinet combination, 70 × 70 cm", 70, 70, 35],
  ["KALLAX", "cube", "Shelving unit, 112 × 112 cm", 112, 112, 39, {}, "3x3 9 cube"],
  ["KALLAX", "cube", "Shelving unit, 147 × 77 cm", 147, 77, 39, {}, "4x2"],
  // chests of drawers
  ["HEMNES", "chest", "Chest of 8 drawers", 160, 96, 50, { cols: 2, rows: 4, knobs: "knob", plinth: true, min: 240 }, "dresser"],
  ["HEMNES", "chest", "Chest of 6 drawers", 108, 131, 50, { cols: 2, rows: 3, knobs: "knob", plinth: true, min: 210 }, "dresser"],
  ["HEMNES", "nightstand", "Nightstand, 2 drawers", 46, 70, 35, { rows: 1, knobs: "knob", plinth: true }, "bedside table"],
  ["KULLEN", "chest", "Chest of 5 drawers", 70, 112, 40, { rows: 5, knobs: "knob" }],
  ["KULLEN", "chest", "Chest of 6 drawers", 140, 72, 40, { cols: 2, rows: 3, knobs: "knob" }],
  ["KULLEN", "nightstand", "Chest of 2 drawers", 35, 49, 40, { rows: 2, knobs: "knob" }, "bedside"],
  ["NORDLI", "chest", "Chest of 8 drawers", 160, 99, 47, { cols: 2, rows: 4, knobs: "none", min: 240 }],
  ["NORDLI", "chest", "Chest of 4 drawers", 40, 99, 47, { rows: 4, knobs: "none" }],
  ["TARVA", "chest", "Chest of 5 drawers", 76, 127, 40, { rows: 5, knobs: "knob" }, "pine"],
  ["TARVA", "chest", "Chest of 6 drawers", 118, 92, 48, { cols: 2, rows: 3, knobs: "knob" }, "pine"],
  ["TARVA", "nightstand", "Nightstand", 39, 61, 38, { rows: 1, knobs: "knob" }, "bedside pine"],
  ["KOPPANG", "chest", "Chest of 3 drawers", 90, 83, 55, { rows: 3, knobs: "bar" }],
  ["KOPPANG", "chest", "Chest of 6 drawers", 172, 83, 55, { cols: 2, rows: 3, knobs: "bar" }],
  ["SONGESAND", "chest", "Chest of 4 drawers", 82, 104, 50, { rows: 4, knobs: "knob", plinth: true }],
  ["SONGESAND", "chest", "Chest of 6 drawers", 161, 81, 50, { cols: 2, rows: 3, knobs: "knob", plinth: true }],
  ["SONGESAND", "cabinet", "Nightstand", 42, 58, 40, { doors: 1, shelves: 1, knobs: "knob", cat: "Nightstand" }, "bedside table"],
  ["BRIMNES", "chest", "Chest of 3 drawers", 78, 95, 46, { rows: 3, knobs: "none" }],
  ["BRIMNES", "nightstand", "Nightstand", 39, 41, 41, { rows: 1, knobs: "none" }],
  ["HAUGA", "chest", "Chest of 6 drawers", 138, 84, 46, { cols: 2, rows: 3, knobs: "bar" }],
  ["HAUGA", "chest", "Chest of 3 drawers", 70, 84, 46, { rows: 3, knobs: "bar" }],
  ["IDANÄS", "chest", "Chest of 6 drawers", 162, 95, 47, { cols: 2, rows: 3, knobs: "bar", min: 210 }],
  ["GURSKEN", "chest", "Chest of 3 drawers", 69, 67, 38, { rows: 3, knobs: "knob" }],
  ["GURSKEN", "nightstand", "Bedside table", 39, 55, 40, { rows: 2, knobs: "knob" }],
  ["VIHALS", "chest", "Chest of 6 drawers", 140, 85, 47, { cols: 2, rows: 3, knobs: "bar" }],
  ["HELMER", "chest", "Drawer unit on castors", 28, 65, 44, { rows: 5, knobs: "none" }, "metal office"],
  ["NESNA", "nightstand", "Bedside table", 36, 45, 35, { rows: 1, knobs: "none" }],
  ["MALM", "nightstand", "Bedside table, 1 drawer", 40, 55, 48, { rows: 1, knobs: "none" }],
  // tables and desks
  ["MICKE", "desk", "Desk, 105 × 50 cm", 105, 75, 50, { attach: "apron", legs: "square" }, "computer desk"],
  ["LAGKAPTEN", "desk", "Desk, 120 × 60 cm", 120, 73, 60, { attach: "plate", legs: "round" }, "adils olov desk"],
  ["BEKANT", "desk", "Desk, 160 × 80 cm", 160, 65, 80, { attach: "apron", legs: "square" }, "office"],
  ["IDÅSEN", "desk", "Desk, 160 × 80 cm", 160, 65, 80, { attach: "apron", legs: "square" }, "office"],
  ["TROTTEN", "desk", "Desk, 120 × 70 cm", 120, 71, 70, { attach: "apron", legs: "square" }, "office"],
  ["LINNMON", "desk", "Table top with legs, 120 × 60 cm", 120, 74, 60, { attach: "plate", legs: "round" }],
  ["LISABO", "dining", "Table, 140 × 78 cm", 140, 74, 78, {}, "dining table ash"],
  ["EKEDALEN", "dining", "Extendable table, 120 × 80 cm", 120, 75, 80, {}, "dining"],
  ["MÖRBYLÅNGA", "dining", "Table, 220 × 100 cm", 220, 74, 100, {}, "oak dining"],
  ["INGO", "dining", "Table, 120 × 75 cm", 120, 73, 75, {}, "pine dining"],
  ["NORRÅKER", "dining", "Table, 125 × 74 cm", 125, 74, 74, {}, "birch dining"],
  ["VANGSTA", "dining", "Extendable table, 120 × 75 cm", 120, 73, 75, {}, "dining"],
  ["SKOGSTA", "dining", "Dining table, 235 × 100 cm", 235, 74, 100, {}, "acacia"],
  ["LERHAMN", "dining", "Table, 118 × 74 cm", 118, 74, 74, {}, "dining"],
  ["SANDSBERG", "dining", "Table, 110 × 67 cm", 110, 75, 67, {}, "dining"],
  ["INGATORP", "dining", "Extendable table, 155 × 87 cm", 155, 74, 87, {}, "dining"],
  ["TOMMARYD", "dining", "Table, 130 × 70 cm", 130, 75, 70, {}, "dining"],
  ["HEMNES", "coffee", "Coffee table, 118 × 75 cm", 118, 46, 75, { attach: "apron", shelf: true }],
  ["LISTERBY", "coffee", "Coffee table, 140 × 60 cm", 140, 37, 60, { attach: "apron", shelf: false }],
  ["HOLMERUD", "coffee", "Coffee table, 90 × 55 cm", 90, 40, 55, { shelf: true }],
  ["VITTSJÖ", "coffee", "Coffee table, 90 × 50 cm", 90, 40, 50, { legs: "square", shelf: true }],
  ["LACK", "coffee", "Coffee table, 90 × 55 cm", 90, 45, 55, { shelf: true }],
  ["HEMNES", "side", "Side table, 55 × 55 cm", 55, 55, 55, { attach: "apron" }, "end table"],
  ["KLIMPEN", "desk", "Table, 120 × 60 cm", 120, 75, 60, { attach: "apron" }],
  // beds
  ["MALM", "bed", "Bed frame, 140 × 200 cm", 156, 100, 209, { m: 140 }, "double"],
  ["MALM", "bed", "Bed frame, 90 × 200 cm", 106, 100, 209, { m: 90 }, "single"],
  ["HEMNES", "bed", "Bed frame, 160 × 200 cm", 174, 120, 211, { m: 160, f: 66 }, "queen double"],
  ["HEMNES", "bed", "Bed frame, 90 × 200 cm", 105, 120, 211, { m: 90, f: 66 }, "single"],
  ["TARVA", "bed", "Bed frame, 140 × 200 cm", 147, 92, 209, { m: 140, f: 40 }, "pine double"],
  ["TARVA", "bed", "Bed frame, 90 × 200 cm", 97, 92, 209, { m: 90, f: 40 }, "pine single"],
  ["NEIDEN", "bed", "Bed frame, 90 × 200 cm", 96, 65, 205, { m: 90, f: 30 }, "single pine"],
  ["BRIMNES", "bed", "Bed frame, 160 × 200 cm", 166, 102, 206, { m: 160 }, "storage"],
  ["SONGESAND", "bed", "Bed frame, 160 × 200 cm", 167, 95, 207, { m: 160, f: 59 }],
  ["SLATTUM", "bed", "Upholstered bed frame, 160 × 200 cm", 164, 85, 206, { m: 160, f: 40 }],
  ["KLEPPSTAD", "bed", "Bed frame, 160 × 200 cm", 166, 86, 207, { m: 160, f: 27 }],
  ["IDANÄS", "bed", "Bed frame, 160 × 200 cm", 174, 101, 211, { m: 160 }],
  ["SAGSTUA", "bed", "Bed frame, 160 × 200 cm", 167, 123, 209, { m: 160, f: 84 }, "metal"],
  ["NORDLI", "bed", "Bed frame with storage, 160 × 200 cm", 168, 64, 207, { m: 160 }],
  ["KRITTER", "bed", "Kids bed frame, 70 × 160 cm", 75, 64, 165, { m: 70, l: 160, f: 50 }, "children"],
  ["SUNDVIK", "bed", "Extendable bed, 80 × 200 cm", 85, 80, 207, { m: 80, f: 60 }, "kids"],
  // wardrobes, cabinets, sideboards
  ["PAX", "wardrobe", "Wardrobe frame, 50 × 236 cm", 50, 236, 58, { doors: 0, shelves: 2 }],
  ["PAX", "wardrobe", "Wardrobe frame, 100 × 236 cm", 100, 236, 58, { doors: 0, shelves: 2 }],
  ["HEMNES", "wardrobe", "Wardrobe with 2 doors, 120 × 197 cm", 120, 197, 59, { knobs: "knob" }],
  ["KLEPPSTAD", "wardrobe", "Wardrobe with 2 doors, 79 × 176 cm", 79, 176, 55],
  ["SONGESAND", "wardrobe", "Wardrobe, 120 × 191 cm", 120, 191, 60],
  ["RAKKESTAD", "wardrobe", "Wardrobe with 2 doors, 79 × 176 cm", 79, 176, 55],
  ["VISTHUS", "wardrobe", "Wardrobe, 122 × 216 cm", 122, 216, 59],
  ["DOMBÅS", "wardrobe", "Wardrobe, 140 × 181 cm", 140, 181, 51],
  ["HAUGA", "wardrobe", "Wardrobe, 70 × 199 cm", 70, 199, 46],
  ["IDANÄS", "wardrobe", "Wardrobe, 121 × 211 cm", 121, 211, 59],
  ["BRIMNES", "wardrobe", "Wardrobe with 3 doors, 117 × 190 cm", 117, 190, 50],
  ["HAVSTA", "cabinet", "Cabinet with doors, 81 × 123 cm", 81, 123, 35],
  ["HEMNES", "cabinet", "Glass-door cabinet, 90 × 197 cm", 90, 197, 37, { shelves: 3 }, "display vitrine"],
  ["FABRIKÖR", "cabinet", "Glass-door cabinet, 81 × 113 cm", 81, 113, 41, { shelves: 2 }, "metal display"],
  ["DETOLF", "cabinet", "Glass-door cabinet, 43 × 163 cm", 43, 163, 37, { doors: 1, shelves: 3 }, "display"],
  ["RUDSTA", "cabinet", "Glass-door cabinet, 80 × 170 cm", 80, 170, 37, { shelves: 3 }],
  ["MILSBO", "cabinet", "Glass-door cabinet, 101 × 186 cm", 101, 186, 42, { shelves: 3 }],
  ["KOLBJÖRN", "cabinet", "Cabinet, 80 × 81 cm", 80, 81, 35, { shelves: 1 }, "outdoor balcony"],
  ["IVAR", "cabinet", "Cabinet with doors, 80 × 83 cm", 80, 83, 30, { shelves: 1 }, "pine"],
  ["BESTÅ", "cabinet", "Shelf unit with doors, 60 × 64 cm", 60, 64, 40, { doors: 1, shelves: 1, knobs: "none" }],
  ["BRIMNES", "cabinet", "Cabinet with doors, 39 × 95 cm", 39, 95, 34, { doors: 1, shelves: 2 }],
  ["HEMNES", "sideboard", "Sideboard, 157 × 88 cm", 157, 88, 47, { knobs: "knob" }, "buffet"],
  ["HAVSTA", "sideboard", "Sideboard, 100 × 89 cm", 100, 89, 47],
  ["TONSTAD", "sideboard", "Sideboard, 121 × 81 cm", 121, 81, 47],
  ["IDANÄS", "sideboard", "Sideboard, 160 × 87 cm", 160, 87, 47],
  ["BESTÅ", "tv", "TV bench, 120 × 40 cm", 120, 38, 42, { knobs: "none" }],
  ["BESTÅ", "tv", "TV bench, 180 × 38 cm", 180, 38, 42, { knobs: "none" }],
  ["BRIMNES", "tv", "TV bench, 120 × 53 cm", 120, 53, 41, { knobs: "none" }],
  ["HEMNES", "tv", "TV bench, 148 × 57 cm", 148, 57, 47, { knobs: "knob" }],
  ["HAUGA", "tv", "TV bench, 138 × 54 cm", 138, 54, 36, { knobs: "bar" }],
  // shoe cabinets
  ["BISSA", "shoe", "Shoe cabinet with 2 compartments", 49, 93, 28, { c: 2 }, "shoe storage"],
  ["BISSA", "shoe", "Shoe cabinet with 3 compartments", 49, 135, 28, { c: 3 }, "shoe storage"],
  ["HEMNES", "shoe", "Shoe cabinet with 2 compartments", 89, 127, 30, { c: 2, knobs: "knob" }, "shoe storage"],
  ["HEMNES", "shoe", "Shoe cabinet with 4 compartments", 107, 101, 22, { c: 2, knobs: "knob" }, "shoe storage"],
  ["STÄLL", "shoe", "Shoe cabinet with 3 compartments", 79, 148, 29, { c: 3, knobs: "knob" }, "shoe storage"],
  ["TRONES", "shoe", "Shoe cabinet, 52 × 39 cm", 52, 39, 18, { c: 1, knobs: "none" }, "shoe storage wall"],
  ["BRUSALI", "shoe", "Shoe cabinet with 3 compartments", 61, 130, 30, { c: 3, knobs: "knob" }],
  ["MACKAPÄR", "shoe", "Shoe cabinet, 80 × 102 cm", 80, 102, 35, { c: 2, knobs: "bar" }],
  // seating
  ["POÄNG", "armchair", "Armchair", 68, 100, 82, { arms: "slim", seatH: 42, sdp: 50 }, "easy chair"],
  ["STRANDMON", "armchair", "Wing chair", 82, 101, 96, { arms: "wide", seatH: 45, sdp: 54 }],
  ["EKERÖ", "armchair", "Armchair", 70, 73, 73, { arms: "slim" }],
  ["KIVIK", "sofa", "3-seat sofa", 228, 83, 95, { seats: 3, seatH: 45, sdp: 60 }, "couch"],
  ["KLIPPAN", "sofa", "2-seat sofa", 180, 66, 88, { seats: 2, arms: "slim", seatH: 43, sdp: 54, lg: 11 }, "couch"],
  ["EKTORP", "sofa", "3-seat sofa", 218, 88, 88, { seats: 3, seatH: 45, sdp: 49, aw: 24 }, "couch"],
  // its article, page and manual are the 3-seat sofa-bed (the corner sofa-bed is a guide of its own); first listed as a corner sofa-bed
  ["FRIHETEN", "sofa", "3-seat sofa-bed", 225, 83, 105, { seats: 3, arms: "slim", seatH: 46, sdp: 61 }, "couch sleeper", "friheten-corner-sofa-bed"],
  ["SÖDERHAMN", "sofa", "3-seat sofa", 198, 83, 99, { seats: 3, arms: "slim", seatH: 40, sdp: 48, aw: 6, bk: 69, lg: 14 }, "couch"],
  ["VIMLE", "sofa", "3-seat sofa", 241, 83, 98, { seats: 3, seatH: 48, sdp: 55, ah: 68, aw: 15, bk: 68, lg: 6 }, "couch"],
  ["LANDSKRONA", "sofa", "3-seat sofa", 204, 78, 89, { seats: 3, arms: "slim", seatH: 44, sdp: 61, ah: 64 }, "couch"],
  ["GLOSTAD", "sofa", "2-seat sofa", 121, 68, 78, { seats: 2, seatH: 41, sdp: 54, ah: 57, bk: 68, lg: 23 }, "couch"],
  ["UPPLAND", "sofa", "3-seat sofa", 231, 89, 98, { seats: 3 }, "couch"],
  ["HEMLINGBY", "sofa", "2-seat sofa", 145, 71.5, 71.5, { seats: 2, arms: "slim" }, "couch"],
  ["STEFAN", "chair", "Chair", 42, 90, 49, { seatH: 46 }, "dining chair pine"],
  ["ODGER", "chair", "Chair", 45, 81, 51, { seatH: 43 }, "dining chair"],
  ["TEODORES", "chair", "Chair", 46, 80, 53, {}, "dining chair"],
  ["ADDE", "chair", "Chair", 39, 77, 47, {}, "dining chair"],
  ["LISABO", "chair", "Chair", 46, 80, 51, { seatH: 48 }, "dining chair"],
  ["NORRÅKER", "chair", "Chair", 41, 81, 50, {}, "dining chair"],
  ["JANINGE", "chair", "Chair", 50, 76, 47, {}, "dining chair"],
  ["EKEDALEN", "chair", "Chair", 45, 95, 51, {}, "dining chair"],
  ["BERGMUND", "chair", "Chair", 52, 95, 59, { seatH: 51 }, "dining chair upholstered"],
  ["TERJE", "chair", "Folding chair", 44, 79, 50, {}, "folding"],
  ["STIG", "stool", "Bar stool, 74 cm", 37, 74, 37, {}, "bar"],
  ["DALFRED", "stool", "Bar stool", 50, 74, 50, {}, "bar"],
  ["KYRRE", "stool", "Stool", 42, 45, 48],
  ["BEKVÄM", "stool", "Step stool", 43, 50, 39, {}, "step"],
  ["ÄPPLARÖ", "bench", "Bench, outdoor", 114, 44, 41, {}, "garden outdoor"],
  ["HEMNES", "bench", "Bench", 98, 45, 37, {}, "hallway"],
];

const MIN: Record<Kind, number> = {
  cube: 40, bookcase: 50, open: 40, chest: 90, nightstand: 40, desk: 25, coffee: 20, side: 15, dining: 40,
  bed: 100, wardrobe: 120, cabinet: 60, sideboard: 80, tv: 60, shoe: 45, chair: 25, stool: 12, bench: 20, sofa: 40, armchair: 30,
  wallshelf: 25, wallcab: 40, kitchen: 50, trolley: 25, bar: 35, console: 30, kidstable: 15, kidschair: 20,
  office: 20, chaise: 55, corner: 70, cot: 35, bunk: 90, loft: 75, dropleaf: 40, daybed: 60, mixed: 50, sliding: 110, slidecab: 60, bookrow: 120, cabrow: 120, section: 25, gateleg: 50, washstand: 35, sinkcab: 45, appliance: 50, shoerack: 25, clothesrack: 20, changing: 50, divider: 20, backbench: 35, junior: 25, lounge: 30, highchair: 15, cornercab: 45, cornerrobe: 150, usofa: 110, lounger: 35, swivel: 25, conference: 20, cornerdesk: 35, conftable: 30, lidbox: 30, shelfbench: 30, workbench: 45, extension: 20, deskdraw: 40, boxdesk: 35, hatrack: 20, coatstand: 15, pouffe: 10, chairbed: 35, airer: 10, riser: 10,
};

const CATEGORY: Record<Kind, string> = {
  cube: "Shelving unit", bookcase: "Bookcase", open: "Shelving unit", chest: "Chest of drawers", nightstand: "Nightstand",
  desk: "Desk", coffee: "Coffee table", side: "Side table", dining: "Dining table", bed: "Bed frame", wardrobe: "Wardrobe",
  cabinet: "Cabinet", sideboard: "Sideboard", tv: "TV bench", shoe: "Shoe cabinet", chair: "Chair", stool: "Stool",
  bench: "Bench", sofa: "Sofa", armchair: "Armchair", wallshelf: "Wall shelf", wallcab: "Wall cabinet", kitchen: "Kitchen cabinet",
  trolley: "Trolley", bar: "Bar table", console: "Console table", kidstable: "Children's table", kidschair: "Children's chair",
  office: "Office chair", chaise: "Sofa with chaise longue", corner: "Corner sofa", cot: "Cot", bunk: "Bunk bed", loft: "Loft bed", dropleaf: "Drop-leaf table", daybed: "Day-bed", mixed: "Cabinet with doors and drawers", sliding: "Wardrobe with sliding doors", slidecab: "Cabinet with sliding doors", bookrow: "Bookcase combination", cabrow: "Storage combination", section: "Sofa section", gateleg: "Gateleg table", washstand: "Wash-stand", sinkcab: "Sink cabinet", appliance: "Appliance cabinet", shoerack: "Shoe rack", clothesrack: "Clothes rack", changing: "Changing table", divider: "Room divider", backbench: "Bench with backrest", junior: "Junior chair", lounge: "Lounge chair", highchair: "Highchair", cornercab: "Corner base cabinet", cornerrobe: "Corner wardrobe", usofa: "U-shaped sofa", lounger: "Sun lounger", swivel: "Swivel easy chair", conference: "Conference chair", cornerdesk: "Corner desk", conftable: "Conference table", lidbox: "Storage bench", shelfbench: "Bench with storage", workbench: "Work bench", extension: "Height extension unit", deskdraw: "Desk with drawers", boxdesk: "Desk with storage", hatrack: "Hat rack", coatstand: "Hat and coat stand", pouffe: "Pouffe", chairbed: "Chair-bed", airer: "Drying rack", riser: "Laptop stand",
};

export const KIND_ARCH: Record<Kind, Archetype> = {
  cube: "shelf", bookcase: "shelf", open: "shelf", chest: "drawers", nightstand: "drawers", desk: "table", coffee: "table",
  side: "table", dining: "table", bed: "bed", wardrobe: "cabinet", cabinet: "cabinet", sideboard: "cabinet", tv: "cabinet",
  shoe: "cabinet", chair: "seat", stool: "seat", bench: "seat", sofa: "sofa", armchair: "sofa", wallshelf: "shelf", wallcab: "cabinet",
  kitchen: "cabinet", trolley: "table", bar: "table", console: "table", kidstable: "table", kidschair: "seat",
  office: "seat", chaise: "sofa", corner: "sofa", cot: "bed", bunk: "bed", loft: "bed", dropleaf: "table", daybed: "bed", mixed: "cabinet", sliding: "cabinet", slidecab: "cabinet", bookrow: "shelf", cabrow: "cabinet", section: "sofa", gateleg: "table", washstand: "cabinet", sinkcab: "cabinet", appliance: "cabinet", shoerack: "shelf", clothesrack: "shelf", changing: "drawers", divider: "shelf", backbench: "seat", junior: "seat", lounge: "seat", highchair: "seat", cornercab: "cabinet", cornerrobe: "cabinet", usofa: "sofa", lounger: "seat", swivel: "seat", conference: "seat", cornerdesk: "table", conftable: "table", lidbox: "cabinet", shelfbench: "table", workbench: "table", extension: "cabinet", deskdraw: "table", boxdesk: "table", hatrack: "shelf", coatstand: "shelf", pouffe: "sofa", chairbed: "sofa", airer: "shelf", riser: "table",
};

const round = (x: X) => (x.round ? { round: true } : {});

const ROW_CATEGORY: Record<NonNullable<X["of"]>, string> = {
  bookcase: "Bookcase combination",
  cabinet: "Cabinet combination",
  tv: "TV bench combination",
  wardrobe: "Wardrobe combination",
  wallcab: "Wall cabinet combination",
  open: "Shelving combination",
};

const ZONE_KIND = { r: "drawers", d: "doors", f: "front", g: "gap", o: "open", a: "apron" } as const;

/**
 * A fitted cabinet's front from the bottom up, as "r2@80+g@60+d1": r drawers, d doors, f a fixed front, g an opening for
 * an appliance, o open shelves, a room for a sink's own front. The digit is how many (s1 adds a shelf behind doors),
 * @ the band's height in cm; a band without one shares out what is left.
 */
export function parseZones(z: string): FitZone[] {
  const out: FitZone[] = [];
  for (const tok of z.split("+")) {
    const m = tok.match(/^([rdfgoa])(\d)?(?:s(\d))?(?:@(\d+))?$/);
    if (!m) continue;
    out.push({ kind: ZONE_KIND[m[1] as keyof typeof ZONE_KIND], h: Number(m[4] ?? 0), ...(m[2] ? { n: Number(m[2]) } : {}), ...(m[3] ? { shelves: Number(m[3]) } : {}) });
  }
  return out;
}

const FIT_USE: Partial<Record<Kind, FitUse>> = { washstand: "basin", sinkcab: "sink", appliance: "oven" };
const FIT_FRONT: Partial<Record<Kind, string>> = { washstand: "r2", sinkcab: "d1@60+f@20", appliance: "r2@80+g@60+d1" };
/** An appliance cabinet is named after what goes in it. */
const FIT_CATEGORY: Partial<Record<FitUse, string>> = {
  oven: "Oven cabinet",
  ovenhob: "Oven cabinet",
  fridge: "Fridge cabinet",
  hob: "Hob cabinet",
  microwave: "Microwave cabinet",
  hood: "Extractor hood cabinet",
};

/** Cabinets built around a basin, a sink or an appliance: x.z is the front, x.use what goes in, x.basin a basin in the box. */
function fitted(kind: Kind, base: Omit<ProductSpec, "source">, w: number, h: number, x: X): Omit<ProductSpec, "source"> {
  const use = x.use ?? FIT_USE[kind] ?? "appliance";
  const zones = parseZones(x.z ?? FIT_FRONT[kind] ?? "d1");
  const count = (k: FitZone["kind"]) => zones.reduce((a, q) => a + (q.kind === k ? (q.n ?? 1) : 0), 0);
  const drawers = count("drawers"), doors = count("doors");
  const hung = !!x.hung;
  const tall = h > 150;
  const fit = {
    use,
    zones,
    ...(x.basin ? { basin: x.basin } : {}),
    ...(["basin", "sink", "hob", "ovenhob"].includes(use) ? { rails: true } : {}),
    ...(hung && use === "basin" ? { hangFirst: true } : {}),
  };
  return {
    ...base,
    category: kind === "appliance" ? (FIT_CATEGORY[use] ?? CATEGORY.appliance) : base.category,
    minutes: x.min ?? MIN[kind] + 20 * drawers + 8 * doors + (tall ? 30 : 0) + (x.basin ? 10 : 0),
    people: tall || w > 90 ? 2 : 1,
    difficulty: drawers ? 3 : 2,
    cabinet: { doors: 0, shelves: 0, rail: false, plinth: !hung, handles: x.knobs ?? "bar", thickness: 18, ...(hung ? { wall: true } : {}), fit },
  };
}

/** Turn a kind and a size into a full product spec. */
export function specFor(kind: Kind, name: string, variant: string, w: number, h: number, d: number, x: X = {}): Omit<ProductSpec, "source"> {
  let spec = specOf(kind, name, variant, w, h, d, x);
  // a sofa or armchair IKEA measured: its seat, armrests, backrest and legs as they really are
  if (spec.sofa && !spec.sofa.pouffe) {
    const m = { seatH: x.seatH, seatD: x.sdp, armH: x.ah, armW: x.aw, backH: x.bk, legH: x.lg };
    const known = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
    if (Object.keys(known).length) spec = { ...spec, sofa: { ...spec.sofa, ...known } };
  }
  // EKET: a box of four panels with a door or an open front, the open wall-mounted ones too (eket.ts builds it from its manuals)
  if (name === "EKET" && (spec.cabinet || (kind === "wallshelf" && spec.shelf))) {
    const wall = kind === "wallcab" || kind === "wallshelf";
    const cab = spec.cabinet ?? { doors: 0 as const, shelves: 0, rail: false, plinth: false, handles: "none" as const, thickness: 16 };
    spec = { ...spec, archetype: "cabinet", shelf: undefined, cabinet: { ...cab, shelves: 0, plinth: false, thickness: 16, ...(wall ? { wall: true } : {}) } };
  }
  // IKEA's own name for what it is, when the kind's category doesn't say it
  return x.cat ? { ...spec, category: x.cat } : spec;
}

function specOf(kind: Kind, name: string, variant: string, w: number, h: number, d: number, x: X): Omit<ProductSpec, "source"> {
  const big = h > 150 || w > 150;
  const base = {
    name,
    variant,
    category: CATEGORY[kind],
    archetype: KIND_ARCH[kind],
    size: { w, h, d },
    minutes: x.min ?? MIN[kind],
    people: (big ? 2 : 1) as 1 | 2,
    difficulty: (["chest", "wardrobe", "sideboard"].includes(kind) ? 3 : ["cube", "side", "stool", "coffee"].includes(kind) ? 1 : 2) as 1 | 2 | 3,
  };
  switch (kind) {
    case "cube":
      // x.uf: cm of an underframe the grid stands on; x.ins: inserts with a door in its cubes
      if (x.ins) {
        const cols = Math.max(1, Math.round((w - 6) / 35)), rows = Math.max(1, Math.round((h - 6) / 35));
        return { ...base, minutes: x.min ?? 10 + 7 * cols * rows + 15 * x.ins, people: cols * rows > 4 ? 2 : 1, difficulty: 2, shelf: { style: "grid", cols, rows, outer: 40, inner: 16, back: false, inserts: x.ins } };
      }
      if (x.uf) {
        const cols = Math.max(1, Math.round((w - 6) / 35)), rows = Math.max(1, Math.round((h - x.uf - 6) / 35));
        return { ...base, minutes: x.min ?? 30 + 7 * cols * rows, people: cols * rows > 4 ? 2 : 1, shelf: { style: "grid", cols, rows, outer: 40, inner: 16, back: false, underframe: x.uf } };
      }
      // x.t: thinner panels than KALLAX's (IVAR's box shelf)
      if (x.t) return { ...base, minutes: x.min ?? 15, people: 1, shelf: { style: "grid", cols: Math.max(1, Math.round((w - 6) / 35)), rows: Math.max(1, Math.round((h - 6) / 35)), outer: x.t, inner: x.t, back: false } };
      return { ...base, shelf: { style: "grid", cols: Math.max(1, Math.round((w - 6) / 35)), rows: Math.max(1, Math.round((h - 6) / 35)), outer: 40, inner: 16, back: false } };
    case "bookcase":
      return { ...base, shelf: { style: "bookcase", shelves: x.shelves ?? Math.max(1, Math.round(h / 45) - 1), fixedShelf: h > 150, back: true, plinth: h > 100, outer: 16 } };
    case "open":
      // x.rail: a clothes rail under a shelf near the top; x.box: room under the bottom shelf for a storage box on castors
      if (x.rail) return { ...base, difficulty: 2, people: 2, shelf: { style: "bookcase", shelves: 1, fixedShelf: false, back: false, plinth: false, outer: 18, rail: true } };
      if (x.box) return { ...base, minutes: x.min ?? MIN.open + 10, difficulty: 1, shelf: { style: "bookcase", shelves: x.shelves ?? Math.max(1, Math.round((h - x.box) / 45) - 1), fixedShelf: h > 150, back: false, plinth: false, outer: 18, boxUnder: x.box } };
      return { ...base, difficulty: 1, shelf: { style: "bookcase", shelves: x.shelves ?? Math.max(1, Math.round(h / 45) - 1), fixedShelf: h > 150, back: false, plinth: x.plinth ?? false, outer: 18 } };
    case "changing": {
      // x.rows: a chest of that many drawers under the changing top; otherwise an open frame with x.shelves
      if (x.rows) {
        const rows = x.rows;
        return { ...base, minutes: x.min ?? 45 + 20 * rows, people: 2, difficulty: 3, drawers: { cols: 1, rows, knobs: x.knobs ?? "knob", plinth: false, thickness: 16, changing: true } };
      }
      return { ...base, archetype: "shelf", minutes: x.min ?? MIN.changing, difficulty: 2, shelf: { style: "bookcase", shelves: x.shelves ?? 2, fixedShelf: false, back: false, plinth: false, outer: 18, changing: true } };
    }
    case "highchair":
      // x.shelf false: no tray in the box, only the safety belt
      return { ...base, difficulty: 1, people: 1, seat: { kind: "highchair", seat: "square", seatH: x.seatH ?? 55, backH: h, ...(x.shelf === false ? { tray: false } : {}) } };
    case "lounger":
      // a sun lounger lies along its depth; size.h is the height with the backrest up
      return { ...base, difficulty: 2, people: 1, seat: { kind: "lounger", seat: "square", seatH: x.seatH ?? 33, backH: h } };
    case "swivel": {
      // an easy chair in one piece on a swivel base; x.rock: it rocks as well; x.arms "none": a shell with no armrests
      const rock = x.rock ? { rock: true } : {};
      return { ...base, category: x.rock ? "Rocking armchair" : CATEGORY.swivel, difficulty: 1, people: 1, seat: { kind: "swivel", seat: "square", seatH: x.seatH ?? 44, backH: h, ...(x.arms !== "none" ? { arms: true } : {}), ...rock } };
    }
    case "conference":
      // built like an office chair: castors, a gas lift, the seat on top
      return { ...base, difficulty: 1, seat: { kind: "office", seat: "square", seatH: x.seatH ?? 46, backH: h, arms: (x.arms ?? "none") !== "none" } };
    case "lounge":
      // a low armchair on a wooden frame, built like a chair with armrests
      return { ...base, difficulty: 2, people: 1, seat: { kind: "chair", seat: "square", seatH: x.seatH ?? 38, backH: h, arms: true } };
    case "junior":
      // a chair with a high seat, so a child sits at a grown-up table
      return { ...base, difficulty: 1, people: 1, seat: { kind: "chair", seat: "square", seatH: x.seatH ?? 62, backH: h } };
    case "backbench":
      // built like a wide chair with armrests: back legs that carry the backrest, front legs up to the armrests
      return { ...base, people: w > 100 ? 2 : 1, seat: { kind: "chair", seat: "square", seatH: x.seatH ?? 45, backH: h, arms: true } };
    case "divider":
      // size.w is the width laid out flat; it stands folded into a zigzag
      return { ...base, difficulty: 1, people: h > 160 ? 2 : 1, shelf: { style: "screen" } };
    case "clothesrack":
      // x.shelf: a shoe shelf low down instead of a lower rail
      return { ...base, difficulty: 1, people: 1, shelf: { style: "rack", ...(x.shelf ? { shoes: true } : {}) } };
    case "shoerack":
      // an open rack: a fixed shelf in the middle, and one more on pins when it's tall enough for three rows of shoes
      return { ...base, difficulty: 1, people: 1, shelf: { style: "bookcase", shelves: x.shelves ?? (h >= 55 ? 1 : 0), fixedShelf: true, back: false, plinth: false, outer: 18 } };
    case "chest":
    case "nightstand": {
      // x.mods: a modular chest, columns of x.rows slots with x.dr drawers from the bottom up
      if (x.mods) {
        const dr = x.dr ?? x.mods * (x.rows ?? 4);
        return { ...base, minutes: x.min ?? 40 + 20 * dr + 10 * (x.mods - 1), people: 2, drawers: { cols: 1, rows: x.rows ?? 4, knobs: x.knobs ?? "none", plinth: false, thickness: 16, modules: x.mods, ...(x.dr ? { count: x.dr } : {}) } };
      }
      // x.cast: a drawer unit on castors
      const cast = x.cast ? { castors: true } : {};
      return { ...base, minutes: x.min ?? (kind === "nightstand" ? 30 + 15 * (x.rows ?? 2) : 30 + 20 * (x.rows ?? 3) * (x.cols ?? 1)) + (x.cast ? 5 : 0), drawers: { cols: x.cols ?? 1, rows: x.rows ?? (kind === "nightstand" ? 2 : 3), knobs: x.knobs ?? "knob", plinth: x.plinth ?? false, thickness: 16, ...cast } };
    }
    case "desk":
      return { ...base, table: { attach: x.attach ?? "plate", legs: x.legs ?? "round", legSize: x.legs === "square" ? 45 : 34, topThickness: 28, shelf: false } };
    case "coffee":
      return { ...base, table: { attach: x.attach ?? "screw", legs: x.legs ?? "square", legSize: 48, topThickness: 40, shelf: x.shelf ?? true, ...round(x) } };
    case "side":
      return { ...base, table: { attach: x.attach ?? "screw", legs: "square", legSize: 40, topThickness: 30, shelf: false, ...round(x) } };
    case "dining":
      return { ...base, people: w > 140 ? 2 : 1, table: { attach: "apron", legs: x.legs ?? "square", legSize: 55, topThickness: 25, shelf: false, ...round(x) } };
    case "bed":
      return { ...base, people: 2, bed: { mattressW: x.m ?? Math.max(80, w - 16), mattressL: x.l ?? 200, headH: h, footH: x.f ?? 38, slats: x.l && x.l < 190 ? 13 : 17, centerBeam: (x.m ?? w) >= 120 } };
    case "wardrobe":
      return { ...base, people: 2, cabinet: { doors: x.doors ?? (w >= 60 ? 2 : 1), shelves: x.shelves ?? 1, rail: x.rail ?? true, plinth: true, handles: x.knobs ?? "knob", thickness: 18 } };
    case "cabinet":
      // x.low: a shelving unit with a cabinet this many cm high at the bottom, open shelves above
      if (x.low) return { ...base, minutes: x.min ?? MIN.cabinet + 25, people: h > 150 ? 2 : 1, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: 0, rail: false, plinth: false, handles: x.knobs ?? "knob", thickness: 18, low: x.low } };
      // x.cast: on castors, so no plinth
      if (x.cast) return { ...base, minutes: x.min ?? MIN.cabinet + 5, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: x.shelves ?? (h > 100 ? 2 : 1), rail: false, plinth: false, handles: x.knobs ?? "knob", thickness: 18, castors: true } };
      return { ...base, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: x.shelves ?? (h > 100 ? 2 : 1), rail: false, plinth: h > 100, handles: x.knobs ?? "knob", thickness: 18 } };
    case "sideboard":
      return { ...base, cabinet: { doors: 2, shelves: 1, rail: false, plinth: true, handles: x.knobs ?? "knob", thickness: 18 } };
    case "tv":
      // x.rows: a TV bench full of drawers, side by side when it's wide
      if (x.rows) return { ...base, archetype: "drawers", minutes: x.min ?? 30 + 20 * x.rows * (w >= 100 ? 2 : 1), difficulty: 3, drawers: { cols: w >= 100 ? 2 : 1, rows: x.rows, knobs: x.knobs ?? "none", plinth: false, thickness: 16, free: true } };
      return { ...base, cabinet: { doors: x.doors ?? 2, shelves: x.doors === 0 ? 1 : 0, rail: false, plinth: false, handles: x.knobs ?? "knob", thickness: 16 } };
    case "shoe":
      return { ...base, cabinet: { fronts: "tilt", compartments: x.c ?? 2, doors: 0, shelves: 0, rail: false, plinth: false, handles: x.knobs ?? "knob", thickness: 16 } };
    case "chair":
      return { ...base, seat: { kind: "chair", seat: "square", seatH: x.seatH ?? 45, backH: h, ...((x.arms ?? "none") !== "none" ? { arms: true } : {}) } };
    case "stool":
      return { ...base, seat: { kind: "stool", seat: "round", seatH: h, splay: true, stretchers: h > 60 } };
    case "bench":
      return { ...base, seat: { kind: "bench", seat: "square", seatH: h, splay: false } };
    case "airer":
      // two end frames, rails between them and a wing each side
      return { ...base, difficulty: 1, people: 1, shelf: { style: "airer" } };
    case "riser":
      // a top on two side panels, felt pads under them
      return { ...base, difficulty: 1, people: 1, table: { attach: "screw", legs: "square", legSize: 20, topThickness: 18, shelf: false, riser: true } };
    case "pouffe":
      // a padded block on four legs
      return { ...base, difficulty: 1, people: 1, sofa: { seats: 1, arms: "none", legs: "round", pouffe: true, ...(x.round ? { round: true } : {}) } };
    case "chairbed":
      // built like an armchair, and it folds out into a bed
      return { ...base, people: 1, difficulty: 2, sofa: { seats: 1, arms: x.arms ?? "none", legs: "round", bed: true } };
    case "sofa":
    case "armchair":
      // x.st: a side table module at the right-hand end, x.st cm wide
      if (x.st) {
        const seats = x.seats ?? (kind === "armchair" ? 1 : Math.max(1, Math.round((w - x.st - 30) / 62)));
        return { ...base, minutes: x.min ?? MIN[kind] + 20 + (seats > 4 ? 30 : 0), people: 2, difficulty: seats > 4 ? 3 : 2, sofa: { seats, arms: x.arms ?? "wide", legs: "round", table: x.st } };
      }
      // x.foot: an armchair with its footstool
      if (x.foot) return { ...base, minutes: x.min ?? MIN.armchair + 15, people: 1, sofa: { seats: x.seats ?? 1, arms: x.arms ?? "wide", legs: "round", foot: true } };
      return {
        ...base,
        people: kind === "sofa" ? 2 : 1,
        // more than four seats come as two sections joined together
        ...(kind === "sofa" && (x.seats ?? 0) > 4 ? { minutes: x.min ?? MIN.sofa + 30, difficulty: 3 as const } : {}),
        sofa: { seats: x.seats ?? (kind === "armchair" ? 1 : Math.max(1, Math.round((w - 30) / 62))), arms: x.arms ?? "wide", legs: "round" },
      };
    case "wallshelf":
      // a wall shelf unit (LACK): a tall narrow column of fixed shelves on a back panel (lack.ts builds it from its manual)
      if (/^wall shelf unit\b/i.test(variant) && h > 2 * w) return { ...base, difficulty: 1, people: 2, shelf: { style: "bookcase", shelves: x.shelves ?? Math.round(h / 27), fixedShelf: true, back: true, plinth: false, outer: 18, wall: true } };
      return { ...base, difficulty: 1, people: 1, shelf: { style: "bookcase", shelves: x.shelves ?? Math.max(0, Math.round(h / 35) - 1), fixedShelf: false, back: false, plinth: false, outer: 16, wall: true } };
    case "wallcab":
      // x.z: doors over drawers, drawn like the cabinets built around an appliance
      if (x.z) return fitted(kind, base, w, h, { use: "storage", hung: true, ...x });
      return { ...base, people: w > 100 ? 2 : 1, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: x.shelves ?? (h > 50 ? 1 : 0), rail: false, plinth: false, handles: x.knobs ?? "knob", thickness: 16, wall: true } };
    case "kitchen":
      // x.z: a front of drawers and doors, drawn like the cabinets built around an appliance
      if (x.z) return fitted(kind, base, w, h, { use: "storage", ...x });
      // x.up: a back panel standing up from the back of the top
      if (x.up) return { ...base, minutes: x.min ?? MIN.kitchen + 10, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: x.shelves ?? 1, rail: false, plinth: true, handles: x.knobs ?? "bar", thickness: 18, upstand: x.up } };
      return { ...base, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: x.shelves ?? Math.max(1, Math.round(h / 45) - 1), rail: false, plinth: true, handles: x.knobs ?? "bar", thickness: 18 } };
    case "trolley":
      // x.up: a kitchen island with a rack rising from the back of its top
      if (x.up) return { ...base, minutes: x.min ?? MIN.trolley + 20, people: 2, difficulty: 2, table: { attach: "plate", legs: "round", legSize: 25, topThickness: 20, shelf: true, rack: x.up } };
      // most trolleys stand three tiers high: the top and two shelves under it
      return { ...base, difficulty: 1, table: { attach: "plate", legs: "round", legSize: 25, topThickness: 20, shelf: true, levels: x.shelves ?? (h >= 60 ? 2 : 1) } };
    case "bar":
      return { ...base, people: 2, table: { attach: x.attach ?? "apron", legs: x.legs ?? "square", legSize: 50, topThickness: 25, shelf: false, ...round(x) } };
    case "console":
      return { ...base, difficulty: 1, table: { attach: "apron", legs: x.legs ?? "square", legSize: 40, topThickness: 22, shelf: x.shelf ?? false } };
    case "kidstable":
      return { ...base, difficulty: 1, people: 1, table: { attach: x.attach ?? "screw", legs: x.legs ?? "round", legSize: 40, topThickness: 22, shelf: false, ...round(x) } };
    case "kidschair":
      return { ...base, difficulty: 1, seat: { kind: "chair", seat: "square", seatH: x.seatH ?? 31, backH: h } };
    case "office":
      // x.arms: "slim" for armrests, "none" without
      return { ...base, difficulty: 1, seat: { kind: "office", seat: "square", seatH: x.seatH ?? 48, backH: h, arms: (x.arms ?? "none") !== "none" } };
    case "chaise":
    case "corner": {
      const sofa = { seats: x.seats ?? (kind === "corner" ? 4 : 3), arms: x.arms ?? "wide", legs: "round" as const, depth: x.sd ?? 92 };
      const shape = kind === "corner" ? { corner: x.corner ?? "left", ...(x.open ? { open: true } : {}) } : { chaise: x.chaise ?? "right" };
      return { ...base, people: 2, sofa: { ...sofa, ...shape } };
    }
    case "usofa": {
      // a corner with seats running forward on the left, and a chaise longue at the right-hand end of the back
      const sd = x.sd ?? 92;
      return { ...base, people: 2, difficulty: 3, sofa: { seats: x.seats ?? 6, arms: x.arms ?? "wide", legs: "round", depth: sd, corner: "left", chaise: "right", reach: Math.min(175, Math.max(140, sd + 68)) } };
    }
    case "cot":
      return { ...base, people: 1, bed: { type: "cot", mattressW: x.m ?? 60, mattressL: x.l ?? 120, headH: h, footH: h, slats: 9, centerBeam: false, ...(x.drawer ? { drawer: true } : {}) } };
    case "bunk":
    case "loft":
      return { ...base, people: 2, difficulty: 3, bed: { type: kind, mattressW: x.m ?? 90, mattressL: x.l ?? 200, headH: h, footH: h, slats: 14, centerBeam: false } };
    case "conftable":
      // built like the family's desks; a standing one is as tall as a bar table
      return { ...base, people: 2, table: { attach: x.attach ?? "plate", legs: x.legs ?? "round", legSize: 40, topThickness: 28, shelf: false, ...round(x) } };
    case "cornerdesk":
      // an L-shaped top, x.sd deep along each wall, on five legs
      return { ...base, people: 2, difficulty: 2, table: { attach: "plate", legs: x.legs ?? "round", legSize: 40, topThickness: 28, shelf: false, ell: x.sd ?? 60 } };
    case "dropleaf":
      return { ...base, people: w > 120 ? 2 : 1, table: { attach: "apron", legs: "square", legSize: 45, topThickness: 25, shelf: false, leaves: x.leaves ?? 2, leaf: x.leaf ?? 30 } };
    case "daybed": {
      // x.under: what is underneath; x.rows: drawers in the pull-out; x.mats: mattresses in the box
      const drawers = x.under === "pullout" ? (x.rows ?? 2) : 0;
      const minutes = x.min ?? MIN.daybed + (x.under === "pullout" ? 45 : x.under ? 25 : 0) + 15 * drawers;
      const under = x.under ? { under: x.under } : {};
      return { ...base, minutes, people: 2, difficulty: x.under ? 3 : 2, bed: { type: "daybed", mattressW: x.m ?? 80, mattressL: x.l ?? 200, headH: h, footH: h, slats: 13, centerBeam: false, ...under, ...(drawers ? { drawers, knobs: x.knobs ?? "none" } : {}), ...(x.mats ? { mattresses: x.mats } : {}) } };
    }
    case "mixed": {
      // x.rows: drawers, under the doors unless x.dtop (a kitchen base cabinet); x.rail: a wardrobe
      const rows = x.rows ?? 1;
      const category = x.rail ? "Wardrobe with drawers" : x.doors === 0 ? "Bookcase with drawer" : CATEGORY.mixed;
      const at = x.dtop ? { drawerAt: "top" as const } : {};
      return { ...base, category, minutes: x.min ?? MIN.mixed + 20 * rows + (h > 150 ? 30 : 0), people: h > 150 ? 2 : 1, difficulty: 3, cabinet: { doors: x.doors ?? (w > 50 ? 2 : 1), shelves: x.shelves ?? (h > 150 ? 2 : 1), rail: !!x.rail, plinth: x.plinth ?? (h > 100 || !!x.dtop), handles: x.knobs ?? (x.dtop ? "bar" : "knob"), thickness: 18, drawers: rows, ...at } };
    }
    case "sliding":
    case "slidecab": {
      // x.slides: how many sliding doors; a wardrobe has a top shelf and a clothes rail
      const robe = kind === "sliding";
      return { ...base, people: robe || h > 150 ? 2 : 1, difficulty: robe ? 3 : 2, cabinet: { fronts: "sliding", slides: x.slides ?? 2, doors: 0, shelves: x.shelves ?? (robe ? 1 : h > 150 ? 3 : h > 100 ? 2 : 1), rail: robe, plinth: x.plinth ?? h > 120, handles: "none", thickness: robe ? 18 : 16 } };
    }
    case "gateleg":
      // x.leaves of x.leaf cm, each on a gate leg; x.shelf: storage on the stretchers; x.hinge: the leaves come loose
      return { ...base, people: w > 120 ? 2 : 1, table: { attach: "apron", legs: "square", legSize: 40, topThickness: 22, shelf: !!x.shelf, leaves: x.leaves ?? 2, leaf: x.leaf ?? 50, gate: true, ...(x.hinge ? { hinges: true } : {}) } };
    case "section": {
      // a straight section of a modular sofa, sold alone: no armrests
      const seats = x.seats ?? 1;
      // x.corner: a corner section, with a backrest along the back and down that side
      if (x.corner) return { ...base, minutes: x.min ?? MIN.section + 15, people: 1, sofa: { seats: 1, arms: "none", legs: "round", corner: x.corner } };
      // x.arms: a modular easy chair, a one-seat section with an armrest on each side
      return { ...base, minutes: x.min ?? MIN.section + 10 * seats + (x.arms ? 10 : 0), people: seats > 1 ? 2 : 1, sofa: { seats, arms: x.arms ?? "none", legs: "round" } };
    }
    case "washstand":
    case "sinkcab":
    case "appliance":
      return fitted(kind, base, w, h, x);
    case "cornercab": {
      // an L, x.sd deep along each wall; or with x.blind, a long cabinet with a door that wide at its open end.
      // x.inner: a carousel or a pull-out fitting; x.rows: a drawer over the door; x.doors 0: a frame sold without its door
      const hung = !!x.hung;
      const door = x.doors !== 0;
      const inner = x.inner ? { inner: x.inner } : {};
      const corner: CornerCab = x.blind
        ? { shape: "blind", door: door ? x.blind : 0, ...inner, ...(x.rows ? { drawer: true } : {}) }
        : { shape: "l", depth: x.sd ?? (hung ? 37 : 60), ...inner };
      const minutes = x.min ?? MIN.cornercab + (door ? 15 : 0) + (x.inner ? 15 : 0) + (x.rows ? 30 : 0) + 5 * (x.shelves ?? 0);
      return { ...base, category: hung ? "Corner wall cabinet" : CATEGORY.cornercab, minutes, people: w > 100 ? 2 : 1, difficulty: x.rows ? 3 : 2, cabinet: { doors: door ? 1 : 0, shelves: x.shelves ?? 0, rail: false, plinth: !hung, handles: x.knobs ?? "bar", thickness: 18, ...(hung ? { wall: true } : {}), corner } };
    }
    case "hatrack":
      // a back rail with hooks, an end at each side and a shelf on top, hung on the wall
      return { ...base, difficulty: 1, people: 1, shelf: { style: "hatrack" } };
    case "coatstand":
      // feet in a cross, a pole in sections, hooks around the top
      return { ...base, difficulty: 1, people: h > 1500 ? 2 : 1, shelf: { style: "stand" } };
    case "deskdraw":
      // x.rows drawers side by side under the top; x.mirror: a dressing table's mirror on the back of the top
      return { ...base, minutes: x.min ?? MIN.deskdraw + 20 * (x.rows ?? 2) + (x.mirror ? 15 : 0), people: w > 100 || x.mirror ? 2 : 1, difficulty: 2, table: { attach: "apron", legs: "square", legSize: 50, topThickness: 25, shelf: false, drawers: x.rows ?? 2, knobs: x.knobs ?? "knob", ...(x.mirror ? { mirror: Math.min(100, Math.max(40, h - 75)) } : {}) } };
    case "boxdesk":
      // a low desk top between two storage frames, x.rows boxes in each, or shelves when x.shelf
      return { ...base, minutes: x.min ?? MIN.boxdesk + 5 * (x.rows ?? 2), people: 1, difficulty: 1, table: { attach: "plate", legs: "square", legSize: 40, topThickness: 22, shelf: false, frame: 32, boxes: x.rows ?? 2, ...(x.shelf ? { shelvesIn: true } : {}) } };
    case "extension":
      // a short box that stands on top of a bookcase or wardrobe: open, or with doors (x.doors)
      return { ...base, minutes: x.min ?? MIN.extension + (x.doors ? 15 : 0), people: 1, difficulty: x.doors ? 2 : 1, cabinet: { doors: x.doors ?? 0, shelves: 0, rail: false, plinth: false, handles: x.knobs ?? (x.doors ? "knob" : "none"), thickness: 16, onTop: x.doors ? "cabinet" : "bookcase" } };
    case "shelfbench":
      // a bench or stool with a shelf under the seat, built like a table: rails under the seat, legs, the shelf between them
      return { ...base, difficulty: 2, people: w > 100 ? 2 : 1, table: { attach: w > 70 ? "apron" : "plate", legs: "square", legSize: 45, topThickness: 30, shelf: true, seat: true, inner: true } };
    case "workbench":
      // a sturdy table with a shelf low down between its legs
      return { ...base, difficulty: 2, people: 2, table: { attach: "apron", legs: "square", legSize: 60, topThickness: 30, shelf: true, inner: true } };
    case "lidbox": {
      // a box with a lid on hinges: a storage bench, a storage table, a footstool or pouffe with a padded lid
      const soft = /pouffe|footstool/i.test(x.cat ?? "");
      return { ...base, minutes: x.min ?? MIN.lidbox + (w > 100 ? 15 : 0), people: w > 120 ? 2 : 1, difficulty: 2, cabinet: { doors: 0, shelves: 0, rail: false, plinth: false, handles: "none", thickness: 18, lid: soft ? { soft: true } : {} } };
    }
    case "cornerrobe": {
      // an L of wardrobe frames: x.u along the back wall, ending at its far end, x.v along the left-hand wall, ending at its
      // front, and between them an add-on corner unit x.cu deep with its back to the left-hand wall (cm, "100+50")
      // no layout given (a typed name, not an IKEA row): one frame along the back and a deep corner unit, like PAX 161/111
      const plain = x.u === undefined && x.v === undefined;
      const fd = 58, cuw = 53, cud = x.cu ?? (plain ? 58 : 35);
      const list = (s?: string) => (s ?? "").split("+").filter(Boolean).map(Number);
      const back = plain ? [w - cud >= 100 ? 100 : 50] : list(x.u), side = list(x.v);
      const sum = (l: number[]) => l.reduce((a, v) => a + v, 0);
      const frame = (fw: number) => specFor("wardrobe", name, variant, fw, h, fd, { doors: x.doors, shelves: x.shelves, knobs: x.knobs });
      const r1 = (n: number) => Math.round(n * 10) / 10;
      const units: RowUnit[] = [];
      let bx = -w / 2 + (w - sum(back));
      for (const fw of back) {
        units.push({ w: fw, d: fd, at: [r1(bx + fw / 2), r1(-d / 2 + fd / 2)], cabinet: frame(fw).cabinet });
        bx += fw;
      }
      let sz = d / 2 - sum(side);
      const corner = specFor("cabinet", name, variant, cuw, h, cud, { doors: 0, shelves: 4 });
      units.push({ w: cuw, d: cud, at: [r1(-w / 2 + cud / 2), r1(sz - cuw / 2)], turn: true, corner: true, cabinet: { ...corner.cabinet, plinth: true } });
      for (const fw of side) {
        units.push({ w: fw, d: fd, at: [r1(-w / 2 + fd / 2), r1(sz + fw / 2)], turn: true, cabinet: frame(fw).cabinet });
        sz += fw;
      }
      const minutes = x.min ?? [...back, ...side].reduce((a, fw) => a + frame(fw).minutes, 0) + 50;
      return { ...frame(back[0] ?? 100), category: CATEGORY.cornerrobe, size: { w, h, d }, minutes, people: 2, difficulty: 3, row: { n: units.length, of: "wardrobe", join: true, units } };
    }
    case "bookrow":
    case "cabrow": {
      // x.n units of kind x.of side by side, each drawn as its own guide would draw it
      const n = x.n ?? 2;
      const of = x.of ?? (kind === "bookrow" ? "bookcase" : "cabinet");
      const inner: X = { ...x };
      delete inner.n;
      delete inner.of;
      // with x.slides, a pair of sliding doors runs in front of all the frames, which have no doors of their own
      const slide = x.slides ? { slide: x.slides } : {};
      if (x.slides) Object.assign(inner, { doors: 0, slides: undefined });
      if (x.u) {
        // frames that aren't all alike, x.u wide from the left ("80+40" cm); IVAR's sections share a post, so the row
        // can be a little narrower than its frames added up, and each frame gives up its share
        delete inner.u;
        const ws = x.u.split("+").map(Number);
        const scale = w / ws.reduce((a, v) => a + v, 0);
        const each = ws.map((uw) => specFor(of, name, variant, Math.round(uw * scale * 10) / 10, h, x.slides ? d - 8 : d, inner));
        const units = each.map((o) => ({ w: o.size.w, ...(o.cabinet ? { cabinet: o.cabinet } : {}), ...(o.shelf ? { shelf: o.shelf } : {}) }));
        const category = x.slides ? CATEGORY.sliding : ROW_CATEGORY[of];
        const minutes = x.min ?? each.reduce((a, o) => a + o.minutes, 0) + 15 + (x.slides ? 40 : 0);
        return { ...each[0], category, size: { w, h, d }, minutes, people: 2, row: { n: ws.length, of, join: of !== "bookcase" && of !== "open", ...slide, units } };
      }
      const one = specFor(of, name, variant, Math.round((w / n) * 10) / 10, h, x.slides ? d - 8 : d, inner);
      const category = x.slides ? CATEGORY.sliding : ROW_CATEGORY[of];
      return { ...one, category, size: { w, h, d }, minutes: x.min ?? one.minutes * n + 15 + (x.slides ? 40 : 0), people: 2, row: { n, of, join: of !== "bookcase", ...slide } };
    }
  }
}

export const KIND_LABELS: { kind: Kind; label: string }[] = [
  { kind: "bookcase", label: "Bookcase" },
  { kind: "cube", label: "Cube shelf" },
  { kind: "chest", label: "Chest of drawers" },
  { kind: "nightstand", label: "Nightstand" },
  { kind: "wardrobe", label: "Wardrobe" },
  { kind: "cabinet", label: "Cabinet" },
  { kind: "shoe", label: "Shoe cabinet" },
  { kind: "tv", label: "TV bench" },
  { kind: "desk", label: "Desk" },
  { kind: "dining", label: "Dining table" },
  { kind: "coffee", label: "Coffee table" },
  { kind: "bed", label: "Bed frame" },
  { kind: "sofa", label: "Sofa" },
  { kind: "corner", label: "Corner sofa" },
  { kind: "chair", label: "Chair" },
  { kind: "office", label: "Office chair" },
  { kind: "stool", label: "Stool" },
  { kind: "bench", label: "Bench" },
];

export const KIND_DEFAULT_SIZE: Record<Kind, [number, number, number]> = {
  cube: [77, 77, 39], bookcase: [80, 190, 30], open: [80, 180, 35], chest: [80, 90, 48], nightstand: [42, 55, 40], desk: [120, 74, 60],
  coffee: [110, 45, 60], side: [50, 50, 50], dining: [140, 74, 80], bed: [156, 100, 209], wardrobe: [100, 200, 58], cabinet: [80, 120, 40],
  sideboard: [140, 85, 45], tv: [150, 50, 42], shoe: [60, 100, 28], chair: [44, 88, 50], stool: [35, 45, 35], bench: [100, 45, 38],
  sofa: [210, 85, 92], armchair: [75, 90, 80], wallshelf: [60, 60, 22], wallcab: [60, 60, 35], kitchen: [60, 80, 60], trolley: [50, 80, 40],
  bar: [120, 105, 60], console: [100, 79, 35], kidstable: [77, 48, 55], kidschair: [34, 60, 34],
  office: [64, 105, 64], chaise: [226, 85, 160], corner: [233, 85, 171], cot: [130, 84, 68], bunk: [211, 160, 100], loft: [211, 195, 100], dropleaf: [134, 75, 80], daybed: [207, 83, 91], mixed: [80, 120, 40], sliding: [118, 200, 60], slidecab: [80, 110, 45], bookrow: [160, 202, 28], cabrow: [240, 48, 42], section: [192, 83, 92], gateleg: [151, 75, 90], washstand: [60, 83, 47], sinkcab: [60, 80, 60], appliance: [60, 200, 60], shoerack: [80, 40, 32], clothesrack: [100, 160, 46], changing: [80, 100, 55], divider: [150, 170, 25], backbench: [120, 86, 60], junior: [43, 91, 52], lounge: [72, 88, 80], highchair: [58, 90, 62], cornercab: [88, 80, 88], cornerrobe: [161, 201, 111], usofa: [306, 83, 241], lounger: [66, 87, 195], swivel: [78, 98, 80], conference: [60, 86, 60], cornerdesk: [140, 74, 130], conftable: [140, 74, 68], lidbox: [100, 48, 42], shelfbench: [110, 46, 38], workbench: [110, 90, 55], extension: [80, 35, 28], deskdraw: [120, 75, 50], boxdesk: [124, 52, 44], hatrack: [80, 26, 32], coatstand: [45, 175, 45], pouffe: [45, 42, 45], chairbed: [80, 87, 98], airer: [140, 95, 55], riser: [40, 15, 26],
};
