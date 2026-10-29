import type { Kind, X } from "@/lib/products";

/**
 * Corrections to the rows built from IKEA's listings (src/data/ikea-rows.ts), one product at a time, found by reading
 * each product's assembly manual beside its IKEA page (the page measurements in scripts/ikea/measures.json). A mistake
 * one rule explains for many products (corner sofas measured leg by leg, bed frames measured from the mattress) is fixed
 * where the rows are read, in scripts/ikea/classify.ts; these are the ones no rule explains. src/lib/catalog.ts applies
 * them as it reads the rows, so a rebuild of the rows keeps them. Hand made rows (ROWS in src/lib/products.ts, CATALOG
 * in src/lib/catalog.ts) are corrected where they are written.
 *
 * size is [w, h, d] in cm, as the kind draws it; x is merged into the row's parameters (undefined takes one out);
 * variant is IKEA's name when the listing names another product than its article is.
 */
export interface Fix {
  size?: [w: number, h: number, d: number];
  kind?: Kind;
  x?: Partial<Record<keyof X, X[keyof X] | undefined>>;
  variant?: string;
}

export const FIXES: Record<string, Fix> = {
  // sofas: sizes on the page or from the modules in the manual, kinds the manual builds
  "soderhamn-2-seat-sofa": { kind: "chaise", size: [186, 83, 151], x: { chaise: "right", sd: 99 } }, // its page: 2-seat sofa with chaise longue
  "morabo-sectional-4-seat": { kind: "chaise", size: [284, 81, 158], x: { chaise: "right", corner: undefined } }, // a 3-seat sofa and a chaise, 158 deep
  "morabo-5-seat-sofa-chaises": { size: [362, 81, 158], x: { chaise: "left" } }, // two chaises side by side at the left end
  "landskrona-4-seat-sofa": { kind: "chaise", size: [280, 78, 158], x: { chaise: "right", sd: 89 } }, // a 3-seat sofa and a chaise
  "landskrona-5-seat-sofa": { kind: "chaise", size: [360, 78, 158], x: { chaise: "left", sd: 89 } }, // a 3-seat sofa and two chaises at the left end
  "finnala-crnr-sleeper-sofa-5-seat-w-chaise": { kind: "corner", x: { corner: "left", chaise: undefined } }, // an L, as the leather one
  "finnala-sectional-4-seat-chaise": { kind: "chaise", x: { chaise: "right" } },
  "holmsund-sleeper-sectional-3-seat": { kind: "chaise", size: [230, 96, 151], x: { chaise: "right", sd: 90, corner: undefined } },
  "malmkoping-sectional-4-seat": { kind: "sofa", size: [326, 100, 92], x: { corner: undefined, sd: undefined } }, // a straight sofa
  "malmkoping-armchair": { size: [107, 100, 92] },
  "lillehem-5-seat-modular-sofa-side-table": { size: [472, 73, 76] },
  "lillehem-6-seat-modular-sofa": { size: [440, 73, 80] },
  "lillesater-4-seat-sofa": { size: [269, 69, 90] },
  "lillesater-6-seat-sofa": { size: [405, 69, 90] },
  "langaryd-loveseat": { size: [198, 82, 90] },
  "langaryd-sofa": { size: [242, 82, 90] },
  "langaryd-sofa-w-chaise-left": { size: [280, 82, 162] },
  "langaryd-sofa-w-chaise-right": { size: [280, 82, 162] },
  "glostad-3-seat-sofa": { size: [171, 68, 78] },
  "stockholm-2025-4-seat-sofa": { size: [308, 70, 99] }, // as high as the 2 and 3-seat sofas: its page gives the backrest, 70
  "stockholm-2025-1-seat-section": { size: [69, 70, 99] },
  "havsten-2-seat-sofa-outdoor": { size: [179, 76, 92] },
  // sofa-beds IKEA names with no seat count: the page's width, and the seats that fit in it
  "balkarp-sleeper-sofa": { size: [190, 80, 84], x: { seats: 3 } },
  "fridhult-sofa-bed": { size: [126, 73, 76], x: { seats: 2 } },
  "hammarn-sofa-bed": { size: [128, 78, 85], x: { seats: 2 } },
  "lycksele-lovas-sleeper-sofa": { size: [142, 87, 100], x: { seats: 2, arms: "none" } },
  "skonaback-sleeper-sofa": { size: [158, 74, 75], x: { seats: 2 } },
  "kivik-1-seat-sofa-bed": { size: [90, 86, 97] },
  // which end the chaise longue or the corner is at, as pictured and built
  "jattebo-2-5-seat-mod-sofa-w-chaise-longue": { x: { chaise: "left" } },
  "applaryd-3-seat-sofa-chaise-longue": { x: { chaise: "left" } },
  "applaryd-4-seat-sofa-chaise-longue": { x: { chaise: "left" } },
  "uppakra-4-5-seat-modular-sofa": { x: { chaise: "left" } },
  "uppakra-modular-corner-sofa-6-seat": { x: { corner: "right" } },
  // the sofa part stays 92 deep: the family's straight sofa is now the 3-seat sofa-bed, 105 deep, a different frame
  "friheten-corner-sofa-bed-storage": { x: { sd: 92 } },
  "friheten-klagshamn-corner-sofa-bed-storage": { x: { chaise: "left", arms: "slim", sd: 92 } },
  // armchairs with a footstool stand as far forward as the footstool
  "ektorp-armchair-and-footstool": { size: [104, 88, 170] },
  "uppland-armchair-and-ottoman": { size: [110, 92, 175] },
  "poang-armchair-and-footstool": { size: [68, 100, 140] },
  "fryksas-armchair-and-footstool": { size: [89, 84, 85] }, // the armchair's own page
  "fryksas-armchair-cushion": { size: [89, 84, 85] },
  "salno-gryttom-armchair-cushion": { size: [65, 110, 84] }, // the SALNÖ armchair's page
  "glostad-ottoman": { size: [58, 41, 68] },
  "havberg-ottoman": { size: [64, 44, 64] },
  "mortfors-pouffe-47-x-47": { size: [47, 44, 47] },

  // chairs and stools
  "skogsta-bar-stool-backrest-62": { size: [41, 91, 46] },
  "nordviken-bar-stool-backrest-62": { size: [40, 88, 45] },
  "rosentorp-bar-stool-backrest-63": { size: [40, 92, 45] },
  "stig-bar-stool-backrest-63": { size: [40, 90, 42] },
  "gronsta-bar-stool-64": { kind: "chair", x: { seatH: 64, cat: "Bar stool" } }, // a low backrest above a 64 cm seat
  "rosentorp-stool": { size: [40, 45, 30] },
  "marius-stool": { size: [40, 45, 40] },
  "domsten-stool": { size: [34, 45, 34] },
  "konstrunda-stool-40": { size: [38, 40, 38] },
  "utter-children-s-stool": { size: [28, 27, 28] },
  "grejsimojs-children-s-stool": { size: [27, 28, 27] },
  "vilto-step-stool": { size: [40, 25, 32] },
  "laktare-conference-chair": { kind: "chair", x: { cat: "Conference chair" } }, // four legs, no castors
  "nammaro-sun-lounger": { size: [67, 78, 193] },

  // tables, desks and trolleys
  "ostavall-adjustable-coffee-table-90": { size: [90, 48, 60], x: { round: undefined } },
  "vitteryd-adjustable-coffee-table-97": { size: [97, 49, 59], x: { round: undefined } },
  "kjellarne-corner-desk-138-x-130": { size: [138, 76, 130] },
  "hol-side-table-50-x-50": { kind: "lidbox", x: { cat: "Side table" } }, // a slatted box with a lid, like the storage table
  "invallning-trolley-68-x-39": { size: [68, 9, 39] }, // a low platform on castors for boxes
  "raskog-trolley-28-x-38-x-61": { size: [38, 61, 28] },
  "raskog-trolley-35-x-45-x-77": { size: [45, 77, 35] },
  "raskog-norrava-trolley-lid-28-x-38-x-61": { size: [38, 61, 28] },
  "raskog-norrava-trolley-lid-35-x-45-x-77": { size: [45, 77, 35] },
  "hornavan-trolley-26-x-48-x-77": { size: [48, 77, 26] },

  // storage
  "sektion-base-cabinet-shelves-30-5-x-61-x-76": { x: { doors: 1 } },
  "fabrikor-glass-door-cabinet-57-x-150": { x: { doors: 1 } },
  "lixhult-cabinet-35-x-60": { size: [35, 82, 35] }, // on its legs
  "lixhult-cabinet-60-x-35": { size: [60, 57, 35] },
  "angsjon-backsjon-wash-stand-wash-basin-124-5-x-5": { x: { z: "r1" } }, // 41.5 cm high: one drawer
  "angsjon-backsjon-wash-stand-wash-basin-170-x-54": { x: { z: "r1" } },
  "nammaro-open-kitchen-unit-80-x-62": { size: [80, 140, 62] },
  "batskar-open-kitchen-unit-60-x-60": { size: [60, 93, 60] },
  "batskar-closed-kitchen-unit-120-x-60": { size: [120, 93, 60] },
  "batskar-add-on-unit-shelves-120-x-70": { kind: "wallshelf", size: [120, 70, 17], x: { cat: "Add-on unit with shelves", doors: undefined } }, // a rack that hangs on the units
  "grillskar-open-kitchen-unit-61-x-61": { size: [61, 92, 61] },
  "grillskar-kitchen-island-shelf-unit-86-x-61": { size: [86, 92, 61] },
  "kallso-hat-rack-80": { size: [80, 24, 32] },

  // small pieces measured on their pages
  "fjaderharv-mini-chest-2-drawers-32-x-25": { size: [32, 16, 25] },
  "alseda-stool": { size: [60, 18, 60] },
  "forsiktig-children-s-stool": { size: [37, 13, 24] },
  "sundvik-changing-table-chest-drawers-78-x-79-x-9": { size: [78, 99, 79] },
  "bolmen-step-stool": { size: [44, 25, 35] },
  "sigfinn-monitor-stand-fixed-height": { size: [53, 10, 24] },
  "smagora-changing-table-bookshelf-60-x-81-x-103": { size: [60, 103, 81] },

  // beds
  "mellgrund-bed-frame-queen-152-x-203": { variant: "Bed frame, Full/Double, 137 × 191 cm", size: [142, 146, 198], x: { m: 137, l: 191, f: 93 } }, // its article is the Full
};

/**
 * Guides that are the same product as another guide: their link opens that one, and they are not listed. A hand made
 * guide IKEA's listings now draw under their own name, or a second hand made guide for one.
 */
export const SAME: Record<string, string> = {
  "malm-bedside-table-1-drawer": "malm-2-drawers",
  "tonstad-sideboard-121-x-81": "tonstad-sideboard-121-x-47-x-90",
  "gursken-chest-3-drawers-69-x-67": "gursken-chest-3-drawers",
  "idanas-sideboard-160-x-87": "idanas-sideboard-124-x-50-x-95",
  "idanas-bookcase-81-x-225": "idanas-bookcase-81-x-39-x-211",
  "vihals-chest-6-drawers": "vihals-chest-6-drawers-140-x-47-x-75",
  "sundso-table-65": "sundso-table-65-x-65",
  "milsbo-glass-door-cabinet-101-x-186": "milsbo-glass-door-cabinet-101-x-100",
  "lagkapten-desk-120-x-60": "lagkapten-adils-desk-120-x-60",
  "rudsta-glass-door-cabinet-80-x-170": "rudsta-glass-door-cabinet-80-x-37-x-120",
  "hemnes-bench": "hemnes-bench-83",
  "brimnes-nightstand": "brimnes-bedside-table-39-x-41-x-53",
  "tarva-chest-6-drawers": "tarva-6-drawer-dresser-151-x-92",
  "tarva-nightstand": "tarva-nightstand-48-x-39-x-62",
  "havsta-sideboard-100-x-89": "havsta-sideboard-basic-unit-121-x-47-x-89",
  "brimnes-cabinet-doors-39-x-95": "brimnes-cabinet-doors-78-x-95",
  "hemnes-glass-door-cabinet-90-x-197": "hemnes-glass-door-cabinet-3-drawers-90-x-197",
};
