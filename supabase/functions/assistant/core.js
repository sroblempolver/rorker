// Generated from web/src/lib/assistant/core.ts by web/preview/build-function.mjs. Do not edit.

// src/lib/plan/catalog-extra.ts
var b = (x, y, z, w, d, h, color) => ({ shape: "box", x, y, z, w, d, h, color });
var c = (x, y, z, w, d, h, color) => ({ shape: "cylinder", x, y, z, w, d, h, color });
var s = (x, y, z, w, d, h, color) => ({ shape: "sphere", x, y, z, w, d, h, color });
var legs = (w, d, h, t, col, inset = 40) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => b(i * (w / 2 - inset), 0, j * (d / 2 - inset), t, t, h, col));
var WOOD = "#a07850";
var DARK = "#8a6a48";
var WHITE = "#f4efe6";
var STEEL = "#b9bec4";
var BLACK = "#232426";
var INK = "#1b1a17";
var FABRIC = "#6f7486";
var GREY = "#7d8187";
var GREEN = "#3f7a4a";
var RED = "#b8473a";
var COUNTERS = ["base_cabinet", "island", "kitchen_sink", "sideboard", "table", "kitchen_cart"];
var EXTRA = {
  // kitchen
  wall_oven: {
    label: "Wall oven",
    w: 600,
    d: 600,
    h: 2200,
    kg: 110,
    mount: "floor",
    face: "room",
    words: ["double oven", "oven tower"],
    fill: "#d9d2c4",
    parts: [b(0, 0, 0, 600, 600, 2200, "#d9d2c4"), b(0, 900, 302, 540, 4, 560, BLACK), b(0, 1500, 302, 540, 4, 300, BLACK), b(0, 1480, 310, 420, 20, 20, STEEL)]
  },
  wine_cooler: {
    label: "Wine cooler",
    w: 600,
    d: 570,
    h: 870,
    kg: 40,
    mount: "floor",
    face: "room",
    words: ["wine fridge"],
    fill: BLACK,
    parts: [b(0, 0, 0, 600, 570, 870, BLACK), b(0, 60, 287, 520, 4, 760, "#5d7f9e"), ...[200, 360, 520, 680].map((y) => b(0, y, 270, 500, 20, 30, "#7a3b2e"))]
  },
  chest_freezer: {
    label: "Chest freezer",
    w: 1100,
    d: 650,
    h: 850,
    kg: 45,
    mount: "floor",
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, 0, 1100, 650, 820, WHITE), b(0, 820, 0, 1110, 660, 40, WHITE), b(0, 760, 330, 300, 20, 30, GREY)]
  },
  blender: {
    label: "Blender",
    w: 180,
    d: 200,
    h: 420,
    kg: 4,
    mount: "surface",
    on: COUNTERS,
    back: true,
    face: "with",
    fill: BLACK,
    parts: [b(0, 0, 0, 180, 200, 150, BLACK), c(0, 150, 0, 140, 140, 240, "#cfe6ee"), c(0, 390, 0, 150, 150, 30, BLACK)]
  },
  stand_mixer: {
    label: "Stand mixer",
    w: 220,
    d: 350,
    h: 360,
    kg: 10,
    mount: "surface",
    on: COUNTERS,
    back: true,
    face: "with",
    fill: RED,
    parts: [b(0, 0, 0, 220, 350, 40, RED), b(0, 40, -120, 100, 100, 240, RED), b(0, 260, 0, 140, 340, 100, RED), c(0, 40, 50, 200, 200, 150, STEEL)]
  },
  air_fryer: {
    label: "Air fryer",
    w: 280,
    d: 340,
    h: 320,
    kg: 5,
    mount: "surface",
    on: COUNTERS,
    back: true,
    face: "with",
    fill: BLACK,
    parts: [b(0, 0, 0, 280, 340, 320, BLACK), b(0, 40, 172, 220, 4, 140, "#3b3c40"), b(0, 100, 180, 60, 30, 30, GREY)]
  },
  trash_can: {
    label: "Trash can",
    w: 350,
    d: 300,
    h: 650,
    kg: 4,
    mount: "floor",
    face: "room",
    words: ["bin", "garbage can", "waste bin"],
    fill: STEEL,
    parts: [b(0, 0, 0, 350, 300, 620, STEEL), b(0, 620, 0, 360, 310, 30, GREY), b(0, 0, 160, 120, 40, 20, BLACK)]
  },
  recycling_bin: {
    label: "Recycling bin",
    w: 400,
    d: 350,
    h: 650,
    kg: 4,
    mount: "floor",
    face: "room",
    fill: "#3a6ea5",
    parts: [b(0, 0, 0, 400, 350, 620, "#3a6ea5"), b(0, 620, 0, 410, 360, 30, "#2c5480")]
  },
  kitchen_cart: {
    label: "Kitchen cart",
    w: 800,
    d: 450,
    h: 900,
    kg: 25,
    mount: "floor",
    face: "room",
    words: ["trolley", "butcher block"],
    fill: WOOD,
    parts: [b(0, 860, 0, 800, 450, 40, WOOD), b(0, 150, 0, 740, 400, 20, WOOD), b(0, 480, 0, 740, 400, 20, WOOD), ...legs(800, 450, 860, 40, STEEL, 25)]
  },
  water_dispenser: {
    label: "Water dispenser",
    w: 320,
    d: 340,
    h: 1300,
    kg: 15,
    mount: "floor",
    face: "room",
    words: ["water cooler"],
    fill: WHITE,
    parts: [b(0, 0, 0, 320, 340, 950, WHITE), c(0, 950, 0, 270, 270, 350, "#8fd3f0"), b(0, 600, 172, 160, 4, 120, GREY)]
  },
  dish_rack: {
    label: "Dish rack",
    w: 450,
    d: 330,
    h: 150,
    kg: 1.5,
    mount: "surface",
    on: COUNTERS,
    face: "with",
    words: ["drying rack for dishes"],
    fill: STEEL,
    parts: [b(0, 0, 0, 450, 330, 20, STEEL), ...[-150, -75, 0, 75, 150].map((x) => b(x, 20, 0, 8, 260, 130, STEEL))]
  },
  // bathroom
  bidet: {
    label: "Bidet",
    w: 380,
    d: 560,
    h: 400,
    kg: 25,
    mount: "floor",
    face: "room",
    fill: WHITE,
    parts: [c(0, 0, 40, 380, 520, 400, WHITE), b(0, 320, -230, 120, 60, 80, STEEL)]
  },
  urinal: {
    label: "Urinal",
    w: 360,
    d: 340,
    h: 650,
    kg: 20,
    mount: "wall",
    at: 450,
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, -50, 360, 240, 650, WHITE), c(0, 60, 40, 300, 200, 300, "#e4dfd4")]
  },
  medicine_cabinet: {
    label: "Medicine cabinet",
    w: 600,
    d: 140,
    h: 700,
    kg: 12,
    mount: "wall",
    at: 1200,
    face: "room",
    words: ["mirror cabinet"],
    fill: "#8fd3f0",
    parts: [b(0, 0, 0, 600, 140, 700, WHITE), b(0, 20, 72, 560, 4, 660, "#cfe6ee")]
  },
  towel_bar: {
    label: "Towel bar",
    w: 600,
    d: 80,
    h: 60,
    kg: 1,
    mount: "wall",
    at: 1150,
    face: "room",
    words: ["towel rail", "towel rack"],
    fill: STEEL,
    parts: [c(0, 20, 30, 600, 20, 20, STEEL), b(-280, 0, -20, 20, 60, 60, STEEL), b(280, 0, -20, 20, 60, 60, STEEL), b(0, -300, 20, 400, 20, 320, "#d8c9a8")]
  },
  toilet_roll_holder: {
    label: "Toilet roll holder",
    w: 160,
    d: 110,
    h: 110,
    kg: 0.4,
    mount: "wall",
    at: 650,
    face: "room",
    words: ["toilet paper holder"],
    fill: WHITE,
    parts: [b(0, 40, -45, 160, 20, 30, STEEL), c(0, 0, 10, 120, 110, 110, WHITE)]
  },
  laundry_hamper: {
    label: "Laundry hamper",
    w: 450,
    d: 350,
    h: 650,
    kg: 3,
    mount: "floor",
    face: "room",
    words: ["clothes basket", "laundry basket"],
    fill: "#c9b38c",
    parts: [b(0, 0, 0, 450, 350, 620, "#c9b38c"), b(0, 620, 0, 460, 360, 30, "#b29b72")]
  },
  // bedroom
  bunk_bed: {
    label: "Bunk bed",
    w: 1e3,
    d: 2050,
    h: 1650,
    kg: 85,
    mount: "floor",
    face: "room",
    fill: WOOD,
    parts: [...legs(1e3, 2050, 1650, 70, WOOD, 35), b(0, 200, 0, 980, 2e3, 160, WOOD), b(0, 360, 0, 920, 1950, 180, "#e9e3d6"), b(0, 1050, 0, 980, 2e3, 160, WOOD), b(0, 1210, 0, 920, 1950, 180, "#e9e3d6"), b(0, 1450, -1e3, 980, 30, 150, WOOD), b(460, 300, 600, 40, 40, 1300, WOOD)]
  },
  sofa_bed: { label: "Sofa bed", w: 2e3, d: 950, h: 850, kg: 75, mount: "floor", face: "to", to: ["tv", "coffee_table"], words: ["futon", "daybed"], like: "sofa", fill: FABRIC },
  blanket_chest: {
    label: "Blanket chest",
    w: 1e3,
    d: 450,
    h: 480,
    kg: 25,
    mount: "floor",
    face: "room",
    words: ["chest", "trunk", "toy box", "storage chest"],
    fill: DARK,
    parts: [b(0, 0, 0, 1e3, 450, 440, DARK), b(0, 440, 0, 1010, 460, 40, WOOD), b(0, 300, 227, 120, 10, 40, STEEL)]
  },
  dressing_table: {
    label: "Dressing table",
    w: 1e3,
    d: 450,
    h: 1450,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["vanity table", "makeup table"],
    users: ["bar_stool", "chair"],
    fill: WHITE,
    parts: [b(0, 720, 0, 1e3, 450, 40, WHITE), b(-380, 0, 0, 240, 440, 720, WHITE), b(380, 0, 0, 240, 440, 720, WHITE), b(0, 760, -200, 700, 30, 690, "#cfe6ee")]
  },
  floor_mirror: {
    label: "Floor mirror",
    w: 600,
    d: 300,
    h: 1700,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["full length mirror", "standing mirror"],
    fill: "#8fd3f0",
    parts: [b(0, 0, -100, 600, 40, 1700, DARK), b(0, 30, -78, 540, 4, 1640, "#cfe6ee"), b(0, 0, 50, 40, 250, 40, DARK)]
  },
  clothes_rack: {
    label: "Clothes rack",
    w: 1200,
    d: 450,
    h: 1600,
    kg: 9,
    mount: "floor",
    face: "room",
    words: ["garment rack", "clothes rail"],
    fill: STEEL,
    parts: [b(0, 0, 0, 1200, 450, 30, STEEL), b(-580, 0, 0, 30, 30, 1600, STEEL), b(580, 0, 0, 30, 30, 1600, STEEL), c(0, 1560, 0, 1180, 30, 30, STEEL), ...[-400, -200, 0, 200, 400].map((x, i) => b(x, 600, 0, 60, 380, 920, ["#5d7f9e", "#b8473a", "#e9e3d6", "#3f7a4a", "#2b2c30"][i]))]
  },
  bench: {
    label: "Bench",
    w: 1200,
    d: 400,
    h: 450,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["bed bench", "entry bench"],
    fill: WOOD,
    parts: [b(0, 410, 0, 1200, 400, 40, WOOD), ...legs(1200, 400, 410, 50, WOOD, 60)]
  },
  changing_table: {
    label: "Changing table",
    w: 800,
    d: 500,
    h: 950,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["baby changer"],
    fill: WHITE,
    parts: [b(0, 0, 0, 800, 500, 900, WHITE), b(0, 900, -20, 780, 460, 50, "#cfe6ee"), ...[200, 480, 760].map((y) => b(0, y - 180, 252, 740, 4, 2, GREY))]
  },
  // living
  sectional_sofa: {
    label: "Corner sofa",
    w: 2700,
    d: 1700,
    h: 850,
    kg: 110,
    mount: "floor",
    face: "to",
    to: ["tv", "coffee_table", "fireplace"],
    words: ["sectional", "l sofa", "l-shaped sofa"],
    fill: FABRIC,
    parts: [b(0, 0, 400, 2700, 900, 420, FABRIC), b(0, 420, -50, 2700, 220, 430, FABRIC), b(1050, 0, -400, 600, 900, 420, FABRIC), b(1240, 420, -400, 220, 900, 430, FABRIC), b(-1260, 420, 400, 180, 900, 220, FABRIC), b(-50, 420, 470, 2400, 640, 90, "#7d8296")]
  },
  loveseat: { label: "Loveseat", w: 1500, d: 880, h: 850, kg: 40, mount: "floor", face: "to", to: ["tv", "coffee_table", "fireplace"], words: ["2 seat sofa", "two seater"], like: "sofa", fill: FABRIC },
  recliner: {
    label: "Recliner",
    w: 900,
    d: 950,
    h: 1050,
    kg: 45,
    mount: "floor",
    face: "to",
    to: ["tv", "coffee_table", "fireplace"],
    words: ["reclining chair", "lazy boy"],
    fill: "#5a4a40",
    parts: [b(0, 0, 0, 900, 950, 450, "#5a4a40"), b(0, 450, -380, 900, 200, 600, "#5a4a40"), b(-370, 450, 0, 160, 900, 220, "#5a4a40"), b(370, 450, 0, 160, 900, 220, "#5a4a40"), b(0, 450, 80, 580, 700, 90, "#6b594d")]
  },
  ottoman: {
    label: "Ottoman",
    w: 600,
    d: 600,
    h: 420,
    kg: 8,
    mount: "floor",
    face: "any",
    words: ["footstool", "pouf", "pouffe"],
    fill: FABRIC,
    parts: [b(0, 40, 0, 600, 600, 380, FABRIC), ...legs(600, 600, 40, 40, DARK, 40)]
  },
  bean_bag: {
    label: "Bean bag",
    w: 900,
    d: 900,
    h: 700,
    kg: 5,
    mount: "floor",
    face: "any",
    fill: "#b0623a",
    parts: [s(0, 0, 0, 900, 900, 520, "#b0623a"), s(0, 300, -200, 700, 400, 420, "#b0623a")]
  },
  side_table: {
    label: "Side table",
    w: 500,
    d: 500,
    h: 550,
    kg: 6,
    mount: "floor",
    face: "any",
    words: ["end table", "lamp table"],
    fill: WOOD,
    parts: [b(0, 520, 0, 500, 500, 30, WOOD), b(0, 150, 0, 440, 440, 20, WOOD), ...legs(500, 500, 520, 35, WOOD, 30)]
  },
  console_table: {
    label: "Console table",
    w: 1200,
    d: 350,
    h: 780,
    kg: 18,
    mount: "floor",
    face: "room",
    words: ["hall table", "entry table"],
    fill: WOOD,
    parts: [b(0, 740, 0, 1200, 350, 40, WOOD), b(0, 150, 0, 1120, 300, 20, WOOD), ...legs(1200, 350, 740, 40, DARK, 30)]
  },
  floor_speaker: {
    label: "Floor speaker",
    w: 220,
    d: 300,
    h: 1e3,
    kg: 18,
    mount: "floor",
    face: "to",
    to: ["sofa", "armchair"],
    words: ["tower speaker", "speaker"],
    fill: BLACK,
    parts: [b(0, 0, 0, 220, 300, 1e3, BLACK), c(0, 620, 152, 160, 4, 160, "#3b3c40"), c(0, 380, 152, 160, 4, 160, "#3b3c40"), c(0, 850, 152, 60, 4, 60, "#3b3c40")]
  },
  soundbar: {
    label: "Soundbar",
    w: 900,
    d: 100,
    h: 70,
    kg: 3,
    mount: "surface",
    on: ["sideboard", "dresser", "console_table"],
    face: "with",
    fill: BLACK,
    parts: [b(0, 0, 0, 900, 100, 70, BLACK), b(0, 10, 51, 860, 2, 50, "#3b3c40")]
  },
  game_console: {
    label: "Game console",
    w: 300,
    d: 260,
    h: 80,
    kg: 4,
    mount: "surface",
    on: ["sideboard", "dresser", "console_table", "desk"],
    face: "with",
    words: ["playstation", "xbox", "console"],
    fill: WHITE,
    parts: [b(0, 0, 0, 300, 260, 80, WHITE), b(0, 30, 131, 200, 2, 6, "#55b2ff")]
  },
  aquarium: {
    label: "Aquarium",
    w: 1e3,
    d: 400,
    h: 1300,
    kg: 160,
    mount: "floor",
    face: "room",
    words: ["fish tank"],
    fill: "#3a6ea5",
    parts: [b(0, 0, 0, 1e3, 400, 750, BLACK), b(0, 750, 0, 1e3, 400, 500, "#5aa9d6"), b(0, 750, 0, 960, 360, 60, "#c9b38c"), b(-250, 810, 0, 60, 60, 260, GREEN), b(0, 1250, 0, 1010, 410, 50, BLACK)]
  },
  grandfather_clock: {
    label: "Grandfather clock",
    w: 500,
    d: 300,
    h: 2e3,
    kg: 60,
    mount: "floor",
    face: "room",
    words: ["tall clock", "longcase clock"],
    fill: DARK,
    parts: [b(0, 0, 0, 500, 300, 300, DARK), b(0, 300, 0, 400, 260, 1200, DARK), b(0, 1500, 0, 500, 300, 500, DARK), c(0, 1600, 152, 320, 4, 320, WHITE), b(0, 600, 132, 60, 4, 700, "#c9a46a")]
  },
  wall_clock: {
    label: "Wall clock",
    w: 350,
    d: 50,
    h: 350,
    kg: 1.5,
    mount: "wall",
    at: 1800,
    face: "room",
    fill: WHITE,
    parts: [c(0, 0, 0, 350, 50, 350, BLACK), c(0, 15, 6, 320, 40, 320, WHITE)]
  },
  coat_rack: {
    label: "Coat rack",
    w: 450,
    d: 450,
    h: 1800,
    kg: 6,
    mount: "floor",
    face: "any",
    words: ["coat stand", "hat stand"],
    fill: DARK,
    parts: [c(0, 0, 0, 420, 420, 40, DARK), c(0, 40, 0, 40, 40, 1760, DARK), b(0, 1650, 0, 400, 30, 30, DARK), b(0, 1650, 0, 30, 400, 30, DARK), b(-150, 1100, 0, 200, 200, 600, "#5d7f9e")]
  },
  umbrella_stand: {
    label: "Umbrella stand",
    w: 250,
    d: 250,
    h: 550,
    kg: 3,
    mount: "floor",
    face: "any",
    fill: STEEL,
    parts: [c(0, 0, 0, 250, 250, 550, STEEL), b(-40, 450, 0, 30, 30, 350, RED), b(50, 450, 30, 30, 30, 300, BLACK)]
  },
  bar_cart: {
    label: "Bar cart",
    w: 750,
    d: 430,
    h: 850,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["drinks trolley"],
    fill: "#c9a46a",
    parts: [b(0, 830, 0, 750, 430, 20, "#c9a46a"), b(0, 250, 0, 750, 430, 20, "#c9a46a"), ...legs(750, 430, 830, 20, "#c9a46a", 15), c(-200, 850, 0, 80, 80, 280, GREEN), c(-80, 850, 0, 80, 80, 300, "#7a3b2e")]
  },
  room_divider: {
    label: "Room divider",
    w: 1500,
    d: 400,
    h: 1800,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["folding screen", "partition screen"],
    fill: "#d8c9a8",
    parts: [-500, 0, 500].map((x, i) => b(x, 0, i === 1 ? 100 : -100, 480, 30, 1800, "#d8c9a8"))
  },
  chaise_longue: {
    label: "Chaise longue",
    w: 700,
    d: 1700,
    h: 850,
    kg: 35,
    mount: "floor",
    face: "room",
    words: ["chaise", "lounger"],
    fill: FABRIC,
    parts: [b(0, 0, 0, 700, 1700, 420, FABRIC), b(0, 420, -700, 700, 300, 430, FABRIC), b(0, 420, 100, 640, 1300, 80, "#7d8296")]
  },
  // dining
  round_dining_table: {
    label: "Round dining table",
    w: 1200,
    d: 1200,
    h: 750,
    kg: 40,
    mount: "floor",
    face: "any",
    words: ["round table"],
    fill: WOOD,
    parts: [c(0, 710, 0, 1200, 1200, 40, WOOD), c(0, 40, 0, 160, 160, 670, WOOD), c(0, 0, 0, 600, 600, 40, WOOD)]
  },
  china_cabinet: {
    label: "China cabinet",
    w: 1e3,
    d: 450,
    h: 1950,
    kg: 85,
    mount: "floor",
    face: "room",
    words: ["display cabinet", "hutch", "vitrine"],
    fill: DARK,
    parts: [b(0, 0, 0, 1e3, 450, 850, DARK), b(0, 850, 40, 1e3, 380, 1100, DARK), b(0, 900, 232, 920, 4, 1e3, "#cfe6ee"), ...[1200, 1550].map((y) => b(0, y, 40, 960, 340, 20, WOOD))]
  },
  high_chair: {
    label: "High chair",
    w: 550,
    d: 650,
    h: 1050,
    kg: 8,
    mount: "floor",
    face: "to",
    to: ["dining_table", "table", "round_dining_table"],
    words: ["baby chair"],
    fill: WHITE,
    parts: [b(0, 550, -20, 400, 400, 40, WHITE), b(0, 590, -200, 400, 40, 450, WHITE), b(0, 750, 220, 450, 200, 30, "#cfe6ee"), ...legs(550, 650, 550, 30, WHITE, 20)]
  },
  // office
  standing_desk: {
    label: "Standing desk",
    w: 1400,
    d: 700,
    h: 1100,
    kg: 35,
    mount: "floor",
    face: "room",
    users: ["office_chair", "chair", "bar_stool"],
    words: ["sit stand desk", "adjustable desk"],
    fill: WOOD,
    parts: [b(0, 1070, 0, 1400, 700, 30, WOOD), b(-550, 0, 0, 70, 70, 1070, GREY), b(550, 0, 0, 70, 70, 1070, GREY), b(-550, 0, 0, 70, 650, 40, GREY), b(550, 0, 0, 70, 650, 40, GREY), b(0, 1e3, -200, 1050, 60, 60, GREY)]
  },
  corner_desk: {
    label: "Corner desk",
    w: 1600,
    d: 1400,
    h: 750,
    kg: 45,
    mount: "floor",
    face: "room",
    users: ["office_chair", "chair"],
    words: ["l desk", "l-shaped desk"],
    fill: WOOD,
    parts: [b(0, 720, -400, 1600, 600, 30, WOOD), b(-500, 720, 300, 600, 800, 30, WOOD), b(750, 0, -400, 40, 580, 720, WOOD), b(-500, 0, 680, 580, 40, 720, WOOD), b(-780, 0, -400, 40, 580, 720, WOOD)]
  },
  whiteboard: {
    label: "Whiteboard",
    w: 1200,
    d: 30,
    h: 900,
    kg: 9,
    mount: "wall",
    at: 900,
    face: "room",
    words: ["white board", "dry erase board"],
    fill: WHITE,
    parts: [b(0, 0, 0, 1200, 30, 900, STEEL), b(0, 20, 16, 1160, 2, 860, "#ffffff"), b(0, 0, 40, 1e3, 60, 20, STEEL)]
  },
  pinboard: {
    label: "Pinboard",
    w: 900,
    d: 25,
    h: 600,
    kg: 3,
    mount: "wall",
    at: 1100,
    face: "room",
    words: ["cork board", "notice board", "bulletin board"],
    fill: "#c9a46a",
    parts: [b(0, 0, 0, 900, 25, 600, DARK), b(0, 20, 13, 860, 2, 560, "#c9a46a"), b(-200, 300, 15, 150, 2, 200, WHITE), b(150, 150, 15, 180, 2, 120, "#ffd23f")]
  },
  shredder: {
    label: "Shredder",
    w: 350,
    d: 280,
    h: 600,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["paper shredder"],
    fill: BLACK,
    parts: [b(0, 0, 0, 350, 280, 480, BLACK), b(0, 480, 0, 360, 290, 120, "#3b3c40"), b(0, 590, 0, 260, 20, 10, INK)]
  },
  router: {
    label: "Wi-Fi router",
    w: 250,
    d: 160,
    h: 50,
    kg: 0.6,
    mount: "surface",
    on: ["desk", "sideboard", "console_table", "bookshelf", "table"],
    face: "with",
    words: ["router", "modem", "wifi"],
    fill: BLACK,
    parts: [b(0, 0, 0, 250, 160, 40, BLACK), b(-90, 40, -60, 10, 10, 160, BLACK), b(90, 40, -60, 10, 10, 160, BLACK), b(0, 20, 81, 120, 2, 5, "#34d07a")]
  },
  server_rack: {
    label: "Server rack",
    w: 600,
    d: 1e3,
    h: 2e3,
    kg: 120,
    mount: "floor",
    face: "room",
    words: ["network rack", "server cabinet"],
    fill: BLACK,
    parts: [b(0, 0, 0, 600, 1e3, 2e3, BLACK), ...[300, 500, 700, 900, 1100].map((y) => b(0, y, 502, 520, 4, 120, "#3b3c40")), b(-200, 1200, 503, 20, 2, 20, "#34d07a")]
  },
  projector_screen: {
    label: "Projector screen",
    w: 2e3,
    d: 80,
    h: 1300,
    kg: 10,
    mount: "wall",
    at: 900,
    face: "room",
    words: ["pull down screen", "projection screen"],
    fill: WHITE,
    parts: [b(0, 1220, 0, 2100, 80, 80, BLACK), b(0, 0, 0, 2e3, 4, 1220, "#ffffff")]
  },
  projector: {
    label: "Projector",
    w: 330,
    d: 250,
    h: 110,
    kg: 3,
    mount: "ceiling",
    at: 2500,
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, 0, 330, 250, 110, WHITE), c(-80, 25, 126, 70, 4, 70, BLACK), c(0, 110, 0, 40, 40, 250, GREY)]
  },
  safe: {
    label: "Safe",
    w: 450,
    d: 450,
    h: 600,
    kg: 90,
    mount: "floor",
    face: "room",
    words: ["strongbox", "gun safe"],
    fill: GREY,
    parts: [b(0, 0, 0, 450, 450, 600, GREY), b(0, 40, 226, 380, 4, 520, "#6b6e73"), c(80, 300, 230, 80, 10, 80, STEEL)]
  },
  conference_table: {
    label: "Meeting table",
    w: 2400,
    d: 1100,
    h: 750,
    kg: 90,
    mount: "floor",
    face: "any",
    words: ["conference table", "boardroom table"],
    fill: WOOD,
    parts: [b(0, 720, 0, 2400, 1100, 30, WOOD), b(-800, 0, 0, 120, 600, 720, DARK), b(800, 0, 0, 120, 600, 720, DARK)]
  },
  // laundry, utility and services
  utility_sink: {
    label: "Utility sink",
    w: 600,
    d: 550,
    h: 900,
    kg: 20,
    mount: "floor",
    face: "room",
    words: ["laundry sink", "laundry tub", "mop sink"],
    fill: WHITE,
    parts: [b(0, 600, 0, 600, 550, 300, WHITE), b(0, 880, 20, 520, 440, 22, "#d7d2c7"), ...legs(600, 550, 600, 40, STEEL, 30), c(0, 900, -240, 30, 30, 300, STEEL), b(0, 1180, -170, 25, 150, 25, STEEL)]
  },
  ironing_board: {
    label: "Ironing board",
    w: 1300,
    d: 400,
    h: 900,
    kg: 6,
    mount: "floor",
    face: "any",
    fill: "#cfe6ee",
    parts: [b(0, 870, 0, 1300, 380, 30, "#cfe6ee"), b(-300, 0, 0, 30, 300, 870, STEEL), b(300, 0, 0, 30, 300, 870, STEEL), b(500, 900, 0, 220, 110, 120, STEEL)]
  },
  drying_rack: {
    label: "Clothes drying rack",
    w: 1400,
    d: 550,
    h: 1e3,
    kg: 4,
    mount: "floor",
    face: "any",
    words: ["airer", "clothes horse"],
    fill: WHITE,
    parts: [b(0, 0, -260, 1400, 20, 1e3, WHITE), b(0, 0, 260, 1400, 20, 1e3, WHITE), ...[-180, -60, 60, 180].map((z) => c(0, 950, z, 1400, 10, 10, WHITE)), b(-300, 600, 0, 300, 400, 340, "#5d7f9e")]
  },
  vacuum_cleaner: {
    label: "Vacuum cleaner",
    w: 300,
    d: 300,
    h: 1150,
    kg: 6,
    mount: "floor",
    face: "room",
    words: ["vacuum", "hoover"],
    fill: "#a77bff",
    parts: [b(0, 0, 60, 300, 120, 60, GREY), b(0, 60, 0, 180, 180, 400, "#a77bff"), c(0, 460, 0, 40, 40, 650, GREY), b(0, 1100, 0, 120, 40, 50, BLACK)]
  },
  furnace: {
    label: "Furnace",
    w: 550,
    d: 750,
    h: 1300,
    kg: 70,
    mount: "floor",
    face: "room",
    words: ["air handler", "hvac unit"],
    fill: GREY,
    parts: [b(0, 0, 0, 550, 750, 1300, GREY), b(0, 100, 377, 500, 4, 500, "#6b6e73"), b(0, 700, 377, 500, 4, 500, "#6b6e73"), b(0, 1300, 0, 400, 400, 200, STEEL)]
  },
  boiler: {
    label: "Wall boiler",
    w: 450,
    d: 350,
    h: 700,
    kg: 35,
    mount: "wall",
    at: 1100,
    face: "room",
    words: ["combi boiler", "tankless water heater"],
    fill: WHITE,
    parts: [b(0, 0, 0, 450, 350, 700, WHITE), b(0, 80, 176, 200, 2, 80, BLACK), ...[-120, -40, 40, 120].map((x) => c(x, -150, 0, 22, 22, 150, "#c58b5a"))]
  },
  ac_unit: {
    label: "Wall AC unit",
    w: 900,
    d: 230,
    h: 300,
    kg: 10,
    mount: "wall",
    at: 2050,
    face: "room",
    words: ["air conditioner", "split ac", "mini split", "aircon"],
    fill: WHITE,
    parts: [b(0, 0, 0, 900, 230, 300, WHITE), b(0, 30, 112, 800, 10, 40, "#d7d2c7"), b(330, 230, 116, 40, 2, 10, "#34d07a")]
  },
  ac_condenser: {
    label: "AC condenser",
    w: 850,
    d: 350,
    h: 650,
    kg: 50,
    mount: "floor",
    face: "room",
    words: ["outdoor unit", "heat pump", "condenser unit"],
    fill: WHITE,
    parts: [b(0, 0, 0, 850, 350, 650, "#e6e1d6"), c(-120, 100, 176, 460, 4, 460, GREY), c(-120, 290, 178, 120, 4, 120, BLACK)]
  },
  electrical_panel: {
    label: "Electrical panel",
    w: 400,
    d: 100,
    h: 600,
    kg: 15,
    mount: "wall",
    at: 1300,
    face: "room",
    words: ["breaker box", "fuse box", "consumer unit", "distribution board"],
    fill: GREY,
    parts: [b(0, 0, 0, 400, 100, 600, "#a9adb2"), b(0, 30, 51, 340, 2, 540, "#9a9ea3"), ...[150, 300, 450].map((y) => b(0, y, 53, 280, 2, 60, BLACK))]
  },
  dehumidifier: {
    label: "Dehumidifier",
    w: 350,
    d: 250,
    h: 600,
    kg: 12,
    mount: "floor",
    face: "room",
    fill: WHITE,
    parts: [b(0, 0, 0, 350, 250, 600, WHITE), b(0, 380, 126, 280, 2, 160, "#d7d2c7"), b(0, 560, 0, 120, 60, 40, GREY)]
  },
  space_heater: {
    label: "Space heater",
    w: 450,
    d: 200,
    h: 600,
    kg: 6,
    mount: "floor",
    face: "room",
    words: ["heater", "oil heater", "portable heater"],
    fill: WHITE,
    parts: [...[-160, -80, 0, 80, 160].map((x) => b(x, 60, 0, 60, 180, 520, WHITE)), b(0, 0, 0, 400, 200, 60, GREY)]
  },
  radiator: {
    label: "Radiator",
    w: 1e3,
    d: 100,
    h: 600,
    kg: 25,
    mount: "wall",
    at: 150,
    face: "room",
    fill: WHITE,
    parts: [...Array.from({ length: 10 }, (_, i) => b(-450 + i * 100, 0, 0, 60, 100, 600, WHITE)), c(-520, 50, 0, 30, 30, 120, STEEL)]
  },
  water_softener: {
    label: "Water softener",
    w: 300,
    d: 450,
    h: 1050,
    kg: 40,
    mount: "floor",
    face: "room",
    words: ["water filter"],
    fill: "#3a6ea5",
    parts: [b(0, 0, 0, 300, 450, 750, "#e6e1d6"), c(0, 0, -100, 250, 250, 1050, "#3a6ea5"), b(0, 1050, -100, 200, 200, 60, BLACK)]
  },
  // garage and workshop
  workbench: {
    label: "Workbench",
    w: 1800,
    d: 700,
    h: 900,
    kg: 60,
    mount: "floor",
    face: "room",
    words: ["work bench", "tool bench"],
    fill: WOOD,
    parts: [b(0, 850, 0, 1800, 700, 50, WOOD), b(0, 200, 0, 1700, 640, 30, WOOD), ...legs(1800, 700, 850, 80, DARK, 50), b(0, 900, -330, 1800, 20, 900, "#c9a46a"), b(-500, 900, -360, 30, 30, 1700, GREY)]
  },
  tool_chest: {
    label: "Tool chest",
    w: 700,
    d: 460,
    h: 1e3,
    kg: 60,
    mount: "floor",
    face: "room",
    words: ["toolbox", "tool cabinet"],
    fill: RED,
    parts: [b(0, 80, 0, 700, 460, 920, RED), ...[220, 360, 500, 640, 780, 900].map((y) => b(0, y, 232, 600, 4, 18, STEEL)), ...[-1, 1].flatMap((i) => [c(i * 280, 0, 180, 70, 70, 80, BLACK), c(i * 280, 0, -180, 70, 70, 80, BLACK)])]
  },
  metal_shelving: {
    label: "Metal shelving",
    w: 1200,
    d: 450,
    h: 1800,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["garage shelving", "storage rack", "shelving unit"],
    fill: GREY,
    parts: [...legs(1200, 450, 1800, 35, GREY, 18), ...[50, 450, 850, 1250, 1650].map((y) => b(0, y, 0, 1200, 450, 25, GREY)), b(-300, 475, 0, 400, 350, 300, "#c9a46a"), b(250, 875, 0, 450, 350, 280, "#3a6ea5")]
  },
  bicycle: {
    label: "Bicycle",
    w: 600,
    d: 1750,
    h: 1050,
    kg: 13,
    mount: "floor",
    face: "any",
    words: ["bike"],
    fill: "#3a6ea5",
    parts: [c(0, 0, 550, 40, 660, 660, BLACK), c(0, 0, -550, 40, 660, 660, BLACK), b(0, 330, 0, 40, 1050, 40, "#3a6ea5"), b(0, 330, -280, 40, 40, 520, "#3a6ea5"), b(0, 850, -300, 120, 260, 50, BLACK), b(0, 950, 470, 560, 40, 40, BLACK)]
  },
  motorcycle: {
    label: "Motorcycle",
    w: 800,
    d: 2100,
    h: 1150,
    kg: 190,
    mount: "floor",
    face: "any",
    words: ["motorbike", "scooter"],
    fill: BLACK,
    parts: [c(0, 0, 750, 140, 620, 620, BLACK), c(0, 0, -750, 160, 640, 640, BLACK), b(0, 300, 0, 300, 1100, 380, "#55606b"), b(0, 680, -200, 300, 700, 120, BLACK), b(0, 650, 250, 280, 450, 250, RED), b(0, 1050, 700, 780, 40, 40, STEEL)]
  },
  lawn_mower: {
    label: "Lawn mower",
    w: 550,
    d: 1400,
    h: 1e3,
    kg: 30,
    mount: "floor",
    face: "any",
    words: ["mower"],
    fill: GREEN,
    parts: [b(0, 80, 300, 550, 650, 250, GREEN), ...[-1, 1].flatMap((i) => [c(i * 260, 0, 550, 60, 200, 200, BLACK), c(i * 260, 0, 50, 60, 200, 200, BLACK)]), b(-200, 330, -200, 30, 30, 700, BLACK), b(200, 330, -200, 30, 30, 700, BLACK), b(0, 980, -450, 430, 30, 30, BLACK)]
  },
  ladder: {
    label: "Step ladder",
    w: 500,
    d: 700,
    h: 1800,
    kg: 8,
    mount: "floor",
    face: "any",
    words: ["ladder", "stepladder"],
    fill: STEEL,
    parts: [b(-220, 0, 150, 40, 40, 1800, STEEL), b(220, 0, 150, 40, 40, 1800, STEEL), b(-220, 0, -200, 40, 40, 1750, STEEL), b(220, 0, -200, 40, 40, 1750, STEEL), ...[350, 700, 1050, 1400].map((y) => b(0, y, 150 - y / 15, 440, 90, 25, GREY))]
  },
  // fitness
  exercise_bike: {
    label: "Exercise bike",
    w: 550,
    d: 1200,
    h: 1300,
    kg: 45,
    mount: "floor",
    face: "room",
    words: ["spin bike", "stationary bike", "peloton"],
    fill: BLACK,
    parts: [b(0, 0, 0, 550, 1200, 60, BLACK), b(0, 60, 350, 60, 60, 1100, BLACK), c(0, 200, 300, 60, 450, 450, GREY), b(0, 60, -300, 60, 60, 850, BLACK), b(0, 900, -300, 200, 280, 60, BLACK), b(0, 1150, 400, 500, 80, 40, BLACK), b(0, 1250, 380, 250, 20, 160, "#3a6ea5")]
  },
  rowing_machine: {
    label: "Rowing machine",
    w: 550,
    d: 2200,
    h: 550,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["rower", "erg"],
    fill: BLACK,
    parts: [b(0, 150, -200, 120, 1800, 60, "#2b2c30"), b(0, 0, -1050, 450, 80, 160, BLACK), c(0, 80, 850, 120, 480, 480, BLACK), b(0, 220, -200, 300, 350, 70, "#3b3c40"), b(0, 160, 450, 400, 200, 50, GREY), b(0, 480, 820, 520, 30, 30, STEEL)]
  },
  weight_bench: {
    label: "Weight bench",
    w: 600,
    d: 1300,
    h: 1400,
    kg: 35,
    mount: "floor",
    face: "room",
    words: ["bench press", "gym bench"],
    fill: BLACK,
    parts: [b(0, 400, 0, 300, 1200, 80, BLACK), b(0, 0, 0, 100, 1200, 60, GREY), b(0, 0, -500, 80, 80, 400, GREY), b(0, 0, 500, 80, 80, 400, GREY), b(-250, 0, -500, 60, 60, 1400, GREY), b(250, 0, -500, 60, 60, 1400, GREY), c(0, 1250, -480, 1500, 30, 30, STEEL)]
  },
  dumbbell_rack: {
    label: "Dumbbell rack",
    w: 1200,
    d: 450,
    h: 800,
    kg: 120,
    mount: "floor",
    face: "room",
    words: ["weights", "dumbbells"],
    fill: BLACK,
    parts: [b(-550, 0, 0, 60, 450, 800, BLACK), b(550, 0, 0, 60, 450, 800, BLACK), b(0, 380, 0, 1100, 300, 30, BLACK), b(0, 700, -60, 1100, 240, 30, BLACK), ...[-400, -150, 100, 350].map((x) => b(x, 410, 0, 160, 120, 120, "#3b3c40"))]
  },
  punching_bag: {
    label: "Punching bag",
    w: 400,
    d: 400,
    h: 1200,
    kg: 35,
    mount: "ceiling",
    at: 600,
    face: "any",
    words: ["boxing bag", "heavy bag"],
    fill: RED,
    parts: [c(0, 0, 0, 380, 380, 1100, RED), c(0, 1100, 0, 20, 20, 900, STEEL)]
  },
  yoga_mat: { label: "Yoga mat", w: 610, d: 1830, h: 6, kg: 1.5, mount: "floor", face: "any", words: ["exercise mat", "gym mat"], fill: "#a77bff", parts: [b(0, 0, 0, 610, 1830, 6, "#a77bff")] },
  // outdoor
  patio_table: {
    label: "Patio table",
    w: 1500,
    d: 900,
    h: 740,
    kg: 25,
    mount: "floor",
    face: "any",
    words: ["garden table", "outdoor table"],
    fill: "#8d8a83",
    parts: [b(0, 710, 0, 1500, 900, 30, "#8d8a83"), ...legs(1500, 900, 710, 50, "#55585c", 60)]
  },
  patio_chair: {
    label: "Patio chair",
    w: 580,
    d: 600,
    h: 870,
    kg: 6,
    mount: "floor",
    face: "to",
    to: ["patio_table", "fire_pit", "round_dining_table", "table"],
    words: ["garden chair", "outdoor chair"],
    fill: "#55585c",
    parts: [b(0, 420, 0, 560, 560, 40, "#8d8a83"), b(0, 460, -270, 560, 40, 410, "#8d8a83"), ...legs(580, 600, 420, 35, "#55585c", 25)]
  },
  sun_lounger: {
    label: "Sun lounger",
    w: 700,
    d: 1950,
    h: 800,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["deck chair", "pool lounger"],
    fill: WHITE,
    parts: [b(0, 280, 200, 680, 1400, 60, WHITE), b(0, 300, -750, 680, 60, 520, WHITE), ...legs(700, 1950, 280, 40, "#55585c", 60)]
  },
  bbq_grill: {
    label: "BBQ grill",
    w: 1300,
    d: 600,
    h: 1150,
    kg: 55,
    mount: "floor",
    face: "room",
    words: ["barbecue", "grill", "bbq"],
    fill: BLACK,
    parts: [b(0, 0, 0, 900, 550, 850, BLACK), b(0, 850, 0, 900, 550, 300, "#3b3c40"), b(-560, 850, 0, 220, 500, 30, STEEL), b(560, 850, 0, 220, 500, 30, STEEL), b(0, 1e3, 290, 500, 30, 30, STEEL)]
  },
  outdoor_sofa: { label: "Outdoor sofa", w: 1900, d: 850, h: 750, kg: 40, mount: "floor", face: "to", to: ["patio_table", "fire_pit", "coffee_table"], words: ["patio sofa", "garden sofa"], like: "sofa", fill: "#8d8a83" },
  patio_umbrella: {
    label: "Patio umbrella",
    w: 2700,
    d: 2700,
    h: 2500,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["parasol", "garden umbrella"],
    fill: "#e9e3d6",
    parts: [c(0, 0, 0, 500, 500, 80, "#55585c"), c(0, 80, 0, 40, 40, 2400, WHITE), c(0, 2200, 0, 2700, 2700, 120, "#e9e3d6"), c(0, 2320, 0, 900, 900, 120, "#e9e3d6")]
  },
  hot_tub: {
    label: "Hot tub",
    w: 2100,
    d: 2100,
    h: 900,
    kg: 400,
    mount: "floor",
    face: "any",
    words: ["spa", "jacuzzi"],
    fill: "#5aa9d6",
    parts: [b(0, 0, 0, 2100, 2100, 900, "#6e4f37"), b(0, 860, 0, 1850, 1850, 20, "#5aa9d6")]
  },
  planter: {
    label: "Planter",
    w: 600,
    d: 600,
    h: 900,
    kg: 40,
    mount: "floor",
    face: "any",
    words: ["flower pot", "plant pot", "planter box"],
    fill: GREEN,
    parts: [b(0, 0, 0, 600, 600, 450, "#55585c"), s(0, 380, 0, 560, 560, 520, GREEN)]
  },
  garden_bench: {
    label: "Garden bench",
    w: 1500,
    d: 600,
    h: 850,
    kg: 30,
    mount: "floor",
    face: "room",
    words: ["park bench"],
    fill: WOOD,
    parts: [b(0, 420, 50, 1500, 450, 40, WOOD), b(0, 500, -230, 1500, 40, 350, WOOD), b(-700, 0, 0, 60, 600, 650, BLACK), b(700, 0, 0, 60, 600, 650, BLACK)]
  },
  fire_pit: {
    label: "Fire pit",
    w: 900,
    d: 900,
    h: 400,
    kg: 50,
    mount: "floor",
    face: "any",
    words: ["firepit"],
    fill: "#8d8a83",
    parts: [c(0, 0, 0, 900, 900, 380, "#8d8a83"), c(0, 380, 0, 700, 700, 20, INK), s(0, 360, 0, 300, 300, 160, "#ff8a3d")]
  },
  // kids, pets, hobbies
  kids_table: {
    label: "Kids' table",
    w: 800,
    d: 600,
    h: 520,
    kg: 8,
    mount: "floor",
    face: "any",
    words: ["children's table", "play table"],
    fill: "#ffd23f",
    parts: [b(0, 490, 0, 800, 600, 30, WHITE), ...legs(800, 600, 490, 50, "#ffd23f", 40)]
  },
  rocking_chair: {
    label: "Rocking chair",
    w: 650,
    d: 900,
    h: 1050,
    kg: 12,
    mount: "floor",
    face: "room",
    words: ["rocker", "nursing chair"],
    fill: WOOD,
    parts: [b(-280, 0, 0, 40, 900, 60, WOOD), b(280, 0, 0, 40, 900, 60, WOOD), b(0, 400, 0, 600, 500, 40, WOOD), b(0, 440, -240, 600, 40, 600, WOOD), ...legs(600, 500, 400, 35, WOOD, 20).map((p) => ({ ...p, y: 60, h: 340 }))]
  },
  dog_bed: {
    label: "Dog bed",
    w: 900,
    d: 700,
    h: 250,
    kg: 3,
    mount: "floor",
    face: "any",
    words: ["pet bed", "dog basket"],
    fill: "#7a5a4a",
    parts: [b(0, 0, 0, 900, 700, 120, "#7a5a4a"), b(0, 120, -280, 900, 140, 130, "#7a5a4a"), b(-380, 120, 0, 140, 700, 130, "#7a5a4a"), b(380, 120, 0, 140, 700, 130, "#7a5a4a")]
  },
  cat_tree: {
    label: "Cat tree",
    w: 600,
    d: 500,
    h: 1500,
    kg: 15,
    mount: "floor",
    face: "any",
    words: ["cat tower", "scratching post"],
    fill: "#d8c9a8",
    parts: [b(0, 0, 0, 600, 500, 40, "#d8c9a8"), c(-150, 40, 0, 100, 100, 1100, "#c9a46a"), c(150, 40, 0, 100, 100, 700, "#c9a46a"), b(150, 740, 0, 400, 400, 30, "#d8c9a8"), b(-100, 1140, 0, 500, 400, 300, "#d8c9a8")]
  },
  pool_table: {
    label: "Pool table",
    w: 2500,
    d: 1400,
    h: 800,
    kg: 350,
    mount: "floor",
    face: "any",
    words: ["billiard table", "snooker table"],
    fill: GREEN,
    parts: [b(0, 650, 0, 2500, 1400, 150, DARK), b(0, 795, 0, 2300, 1200, 10, GREEN), b(-1e3, 0, -500, 150, 150, 650, DARK), b(1e3, 0, -500, 150, 150, 650, DARK), b(-1e3, 0, 500, 150, 150, 650, DARK), b(1e3, 0, 500, 150, 150, 650, DARK)]
  },
  ping_pong_table: {
    label: "Ping pong table",
    w: 2740,
    d: 1525,
    h: 760,
    kg: 100,
    mount: "floor",
    face: "any",
    words: ["table tennis table"],
    fill: "#3a6ea5",
    parts: [b(0, 730, 0, 2740, 1525, 30, "#3a6ea5"), b(0, 760, 0, 20, 1600, 150, WHITE), ...legs(2740, 1525, 730, 50, GREY, 200)]
  },
  dartboard: {
    label: "Dartboard",
    w: 450,
    d: 40,
    h: 450,
    kg: 5,
    mount: "wall",
    at: 1500,
    face: "room",
    words: ["dart board"],
    fill: INK,
    parts: [c(0, 0, 0, 450, 40, 450, INK), c(0, 30, 6, 340, 30, 340, "#e9e3d6"), c(0, 190, 12, 60, 30, 60, RED)]
  },
  guitar: {
    label: "Guitar on a stand",
    w: 380,
    d: 400,
    h: 1050,
    kg: 4,
    mount: "floor",
    face: "room",
    words: ["guitar", "acoustic guitar"],
    fill: "#c9a46a",
    parts: [b(0, 0, 0, 360, 380, 40, BLACK), c(0, 80, 40, 380, 100, 480, "#c9a46a"), b(0, 560, 40, 60, 40, 480, DARK)]
  },
  drum_kit: {
    label: "Drum kit",
    w: 1600,
    d: 1300,
    h: 1300,
    kg: 45,
    mount: "floor",
    face: "room",
    words: ["drums", "drum set"],
    fill: RED,
    parts: [c(0, 0, 300, 560, 400, 560, RED), c(-450, 0, 0, 400, 400, 450, RED), c(-250, 600, 300, 300, 300, 200, RED), c(250, 600, 300, 300, 300, 200, RED), c(450, 0, -100, 400, 400, 600, RED), c(-650, 1100, 100, 400, 400, 15, "#c9a46a"), c(650, 1200, 100, 450, 450, 15, "#c9a46a"), b(0, 0, -400, 400, 400, 480, BLACK)]
  },
  floor_fan: {
    label: "Floor fan",
    w: 450,
    d: 350,
    h: 1200,
    kg: 5,
    mount: "floor",
    face: "room",
    words: ["fan", "standing fan", "pedestal fan"],
    fill: WHITE,
    parts: [c(0, 0, 0, 400, 350, 40, WHITE), c(0, 40, 0, 40, 40, 800, WHITE), c(0, 820, 0, 450, 140, 450, "#e6e1d6"), c(0, 990, 40, 120, 100, 120, GREY)]
  },
  humidifier: {
    label: "Humidifier",
    w: 250,
    d: 250,
    h: 350,
    kg: 2,
    mount: "floor",
    face: "any",
    words: ["air purifier", "purifier"],
    fill: WHITE,
    parts: [c(0, 0, 0, 250, 250, 320, WHITE), c(0, 320, 0, 120, 120, 30, GREY)]
  }
};

// src/lib/plan/catalog.ts
var WOOD2 = "#a07850";
var DARK2 = "#8a6a48";
var CAB = "#5b5750";
var WHITE2 = "#f4efe6";
var STEEL2 = "#b9bec4";
var BLACK2 = "#232426";
var FABRIC2 = "#6f7486";
var DESKS = ["desk", "table", "dining_table", "sideboard", "dresser", "nightstand"];
var COUNTERS2 = ["base_cabinet", "island", "kitchen_sink", "sideboard", "table"];
var BASE = {
  // kitchen
  base_cabinet: { label: "Base cabinet", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: CAB },
  wall_cabinet: { label: "Wall cabinet", w: 600, d: 350, h: 700, kg: 18, mount: "wall", at: 1450, face: "room", fill: CAB },
  tall_cabinet: { label: "Tall cabinet", w: 600, d: 600, h: 2200, kg: 70, mount: "floor", face: "room", words: ["pantry"], fill: "#d9d2c4" },
  kitchen_sink: { label: "Kitchen sink", w: 800, d: 600, h: 900, kg: 45, mount: "floor", face: "room", fill: CAB },
  dishwasher: { label: "Dishwasher", w: 600, d: 600, h: 850, kg: 45, mount: "floor", face: "room", fill: CAB },
  range: { label: "Range", w: 600, d: 600, h: 900, kg: 60, mount: "floor", face: "room", words: ["stove", "cooker"], fill: BLACK2 },
  cooktop: { label: "Cooktop", w: 600, d: 520, h: 900, kg: 10, mount: "floor", face: "room", words: ["hob"], fill: BLACK2 },
  oven: { label: "Oven", w: 600, d: 600, h: 900, kg: 35, mount: "floor", face: "room", fill: BLACK2 },
  range_hood: { label: "Range hood", w: 600, d: 500, h: 600, kg: 12, mount: "wall", at: 1600, face: "room", words: ["extractor", "hood"], fill: STEEL2 },
  fridge: { label: "Fridge", w: 700, d: 700, h: 1850, kg: 80, mount: "floor", face: "room", words: ["refrigerator", "freezer"], fill: STEEL2 },
  island: { label: "Kitchen island", w: 1800, d: 900, h: 900, kg: 150, mount: "floor", face: "any", fill: CAB },
  microwave: { label: "Microwave", w: 500, d: 380, h: 300, kg: 14, mount: "surface", on: COUNTERS2, back: true, face: "with", fill: BLACK2 },
  coffee_machine: { label: "Coffee machine", w: 280, d: 400, h: 380, kg: 9, mount: "surface", on: COUNTERS2, back: true, face: "with", words: ["espresso"], fill: BLACK2 },
  kettle: { label: "Kettle", w: 220, d: 160, h: 250, kg: 1.2, mount: "surface", on: COUNTERS2, back: true, face: "with", fill: STEEL2 },
  toaster: { label: "Toaster", w: 300, d: 180, h: 200, kg: 2, mount: "surface", on: COUNTERS2, back: true, face: "with", fill: STEEL2 },
  bar_stool: { label: "Bar stool", w: 400, d: 400, h: 1e3, kg: 6, mount: "floor", face: "to", to: ["island", "base_cabinet", "kitchen_sink", "bar_counter"], words: ["counter stool", "stool"], fill: WOOD2 },
  // bathroom
  toilet: { label: "Toilet", w: 400, d: 650, h: 800, kg: 30, mount: "floor", face: "room", words: ["wc"], fill: WHITE2 },
  washbasin: { label: "Washbasin", w: 600, d: 450, h: 900, kg: 18, mount: "floor", face: "room", words: ["basin", "sink"], fill: WHITE2 },
  vanity: { label: "Vanity", w: 800, d: 480, h: 900, kg: 45, mount: "floor", face: "room", fill: WOOD2 },
  bathtub: { label: "Bathtub", w: 1700, d: 700, h: 580, kg: 50, mount: "floor", face: "room", words: ["bath", "tub"], fill: WHITE2 },
  shower: { label: "Shower", w: 900, d: 900, h: 2050, kg: 60, mount: "floor", face: "room", fill: "#cfe6ee" },
  mirror: { label: "Mirror", w: 600, d: 30, h: 800, kg: 8, mount: "wall", at: 1100, face: "room", fill: "#8fd3f0" },
  towel_radiator: { label: "Towel radiator", w: 500, d: 100, h: 1200, kg: 12, mount: "wall", at: 300, face: "room", fill: WHITE2 },
  // bedroom
  bed: { label: "Bed", w: 1600, d: 2e3, h: 1050, kg: 70, mount: "floor", face: "room", fill: "#e9e3d6" },
  nightstand: { label: "Nightstand", w: 450, d: 400, h: 550, kg: 12, mount: "floor", face: "room", words: ["bedside table"], fill: DARK2 },
  wardrobe: { label: "Wardrobe", w: 1200, d: 600, h: 2200, kg: 90, mount: "floor", face: "room", words: ["closet", "armoire"], fill: DARK2 },
  dresser: { label: "Dresser", w: 1e3, d: 480, h: 800, kg: 45, mount: "floor", face: "room", words: ["chest of drawers", "drawers"], fill: DARK2 },
  crib: { label: "Crib", w: 700, d: 1300, h: 900, kg: 25, mount: "floor", face: "room", words: ["cot"], fill: WHITE2 },
  // living and dining
  sofa: { label: "Sofa", w: 2100, d: 900, h: 850, kg: 60, mount: "floor", face: "to", to: ["tv", "fireplace", "coffee_table"], words: ["couch"], fill: FABRIC2 },
  armchair: { label: "Armchair", w: 850, d: 850, h: 850, kg: 25, mount: "floor", face: "to", to: ["coffee_table", "tv", "fireplace", "sofa"], fill: FABRIC2 },
  coffee_table: { label: "Coffee table", w: 1100, d: 600, h: 420, kg: 20, mount: "floor", face: "any", fill: WOOD2 },
  table: { label: "Table", w: 1200, d: 800, h: 750, kg: 30, mount: "floor", face: "any", fill: WOOD2 },
  dining_table: { label: "Dining table", w: 1600, d: 900, h: 750, kg: 45, mount: "floor", face: "any", fill: WOOD2 },
  chair: { label: "Chair", w: 450, d: 450, h: 900, kg: 5, mount: "floor", face: "to", to: ["dining_table", "table", "desk"], fill: WOOD2 },
  sideboard: { label: "Sideboard", w: 1600, d: 450, h: 750, kg: 55, mount: "floor", face: "room", words: ["tv unit", "tv stand", "credenza", "buffet"], fill: DARK2 },
  tv: { label: "TV", w: 1230, d: 80, h: 720, kg: 15, mount: "surface", on: ["sideboard", "dresser", "tv_stand"], at: 1100, face: "with", back: true, words: ["television", "screen"], fill: "#151618" },
  bookshelf: { label: "Bookshelf", w: 800, d: 300, h: 2e3, kg: 40, mount: "floor", face: "room", words: ["bookcase", "shelving"], fill: DARK2 },
  wall_shelf: { label: "Wall shelf", w: 800, d: 250, h: 40, kg: 4, mount: "wall", at: 1500, face: "room", words: ["floating shelf"], fill: WOOD2 },
  picture: { label: "Picture", w: 700, d: 30, h: 500, kg: 3, mount: "wall", at: 1350, face: "room", words: ["painting", "art", "frame", "poster"], fill: "#c9a46a" },
  rug: { label: "Rug", w: 2e3, d: 1400, h: 10, kg: 8, mount: "floor", face: "any", words: ["carpet"], fill: "#7a5a4a" },
  fireplace: { label: "Fireplace", w: 1200, d: 400, h: 1150, kg: 200, mount: "floor", face: "room", fill: "#8d8a83" },
  piano: { label: "Upright piano", w: 1500, d: 600, h: 1250, kg: 230, mount: "floor", face: "room", users: ["chair", "bar_stool"], fill: "#151618" },
  lamp: { label: "Floor lamp", w: 400, d: 400, h: 1600, kg: 5, mount: "floor", face: "any", words: ["floor lamp", "standing lamp"], fill: "#f3c56b" },
  table_lamp: { label: "Table lamp", w: 280, d: 280, h: 450, kg: 2, mount: "surface", on: ["nightstand", "desk", "sideboard", "dresser", "table"], face: "any", words: ["desk lamp", "bedside lamp"], fill: "#f3c56b" },
  plant: { label: "Plant", w: 400, d: 400, h: 1200, kg: 10, mount: "floor", face: "any", fill: "#3f7a4a" },
  ceiling_fan: { label: "Ceiling fan", w: 1300, d: 1300, h: 400, kg: 7, mount: "ceiling", at: 2250, face: "any", fill: "#d9d2c4" },
  pendant_light: { label: "Pendant light", w: 400, d: 400, h: 400, kg: 2, mount: "ceiling", at: 1900, face: "any", words: ["chandelier", "ceiling light"], fill: "#f3c56b" },
  // office
  desk: { label: "Desk", w: 1200, d: 600, h: 750, kg: 30, mount: "floor", face: "room", users: ["office_chair", "chair"], fill: WOOD2 },
  office_chair: { label: "Office chair", w: 600, d: 600, h: 1100, kg: 14, mount: "floor", face: "to", to: ["desk", "table"], words: ["desk chair", "swivel chair"], fill: "#2b2c30" },
  computer: { label: "Computer", w: 900, d: 450, h: 460, kg: 12, mount: "surface", on: DESKS, back: true, face: "with", words: ["pc", "desktop", "desktop computer", "workstation", "imac"], fill: BLACK2 },
  monitor: { label: "Monitor", w: 620, d: 200, h: 460, kg: 5, mount: "surface", on: DESKS, back: true, face: "with", words: ["screen", "display"], fill: BLACK2 },
  laptop: { label: "Laptop", w: 340, d: 240, h: 230, kg: 1.6, mount: "surface", on: DESKS, face: "with", words: ["notebook", "macbook"], fill: "#9da3aa" },
  printer: { label: "Printer", w: 450, d: 400, h: 250, kg: 10, mount: "surface", on: ["desk", "sideboard", "filing_cabinet", "table"], face: "with", fill: "#e6e1d6" },
  filing_cabinet: { label: "Filing cabinet", w: 400, d: 600, h: 720, kg: 30, mount: "floor", face: "room", words: ["drawer unit", "pedestal"], fill: "#7d8187" },
  // laundry, services, outside
  washing_machine: { label: "Washing machine", w: 600, d: 600, h: 850, kg: 70, mount: "floor", face: "room", words: ["washer"], fill: WHITE2 },
  dryer: { label: "Dryer", w: 600, d: 600, h: 850, kg: 40, mount: "floor", face: "room", fill: WHITE2 },
  water_heater: { label: "Water heater", w: 560, d: 560, h: 1500, kg: 60, mount: "floor", face: "room", words: ["geyser", "hot water tank"], fill: "#e6e1d6" },
  treadmill: { label: "Treadmill", w: 800, d: 1900, h: 1400, kg: 90, mount: "floor", face: "room", fill: "#2b2c30" },
  car: { label: "Car", w: 1800, d: 4500, h: 1500, kg: 1400, mount: "floor", face: "any", fill: "#55606b" }
};
var CATALOG = { ...BASE, ...EXTRA };
var OBJECT_KINDS = [...Object.keys(CATALOG), "other"];

// src/lib/dates.ts
function today(d = /* @__PURE__ */ new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// src/lib/assistant/core.ts
var JOB = { type: "string", description: `The job: its id, or its name as the person says it ("Hadley Road"). Leave out for the job they're looking at.` };
var PIN_KINDS = ["task", "issue", "note", "material"];
var ITEM_KINDS = ["outlet", "switch", "light", "data", "plumbing", "vent", "thermostat", "mount", "other"];
var SIDE = { type: "string", enum: ["north", "south", "east", "west"] };
var PART = { type: "object", properties: {
  shape: { type: "string", enum: ["box", "cylinder", "sphere"] },
  x: { type: "number", description: "Centre, mm right of the object's middle as seen from its front" },
  z: { type: "number", description: "Centre, mm toward its front from its middle" },
  y: { type: "number", description: "Bottom of this part, mm above the object's bottom" },
  w: { type: "number", description: "Width, mm (left to right)" },
  d: { type: "number", description: "Depth, mm (front to back)" },
  h: { type: "number", description: "Height, mm" },
  color: { type: "string", description: "#rrggbb, its real colour" }
}, required: ["shape", "x", "y", "z", "w", "d", "h"] };
var TOOLS = [
  { name: "list_jobs", description: "List the jobs this person can see: id, name, address, status, open pins and current stage.", input_schema: { type: "object", properties: {} } },
  { name: "job_overview", description: "One job at a glance: stages, floors and rooms (with ids), open pins (number, kind, title, status, due date, who is tagged, where).", input_schema: { type: "object", properties: { job: JOB } } },
  { name: "find_in_plan", description: `Find rooms, walls, doors, windows and objects in a job's plan by name, kind, room or id ("kitchen sink", "master bedroom", "G-F46"). Returns ids to use with other tools.`, input_schema: { type: "object", properties: { job: JOB, query: { type: "string" } }, required: ["query"] } },
  {
    name: "add_pin",
    description: "Add a pin (task, issue, note or material) to a job, on a room or object when given its id. Due date defaults to today. Tag people by name.",
    input_schema: { type: "object", properties: {
      job: JOB,
      kind: { type: "string", enum: PIN_KINDS },
      title: { type: "string" },
      details: { type: "string" },
      element_id: { type: "string", description: "Room, wall, door, window or object id from find_in_plan or job_overview" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      tag: { type: "array", items: { type: "string" }, description: "Team members' names" },
      high_priority: { type: "boolean" },
      photo_request: { type: "boolean", description: 'Asking the tagged person for a photo of this spot ("get Marco to send a photo of the sink"): a task they close with a photo, sent from their link' }
    }, required: ["kind", "title"] }
  },
  {
    name: "update_pin",
    description: "Change a pin by its number: status (open, in_progress, done), title, details, due date, or who is tagged.",
    input_schema: { type: "object", properties: {
      job: JOB,
      pin_number: { type: "integer" },
      status: { type: "string", enum: ["open", "in_progress", "done"] },
      title: { type: "string" },
      details: { type: "string" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      tag: { type: "array", items: { type: "string" }, description: "Replaces who is tagged" }
    }, required: ["pin_number"] }
  },
  { name: "set_stage", description: "Set a job stage's status by its name: not_started, active or done.", input_schema: { type: "object", properties: { job: JOB, stage: { type: "string" }, status: { type: "string", enum: ["not_started", "active", "done"] } }, required: ["stage", "status"] } },
  { name: "set_build_status", description: "Mark a room, wall, door, window or object's build status: not_built, in_progress, done, existing or demolish (or clear).", input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string" }, status: { type: "string", enum: ["not_built", "in_progress", "done", "existing", "demolish", "clear"] } }, required: ["element_id", "status"] } },
  {
    name: "add_wall_item",
    description: "Put an outlet, switch, light, plumbing point or other wall item on a wall of a room, at a height in mm (typical heights used when left out).",
    input_schema: { type: "object", properties: {
      job: JOB,
      room: { type: "string", description: "Room id or name" },
      wall: { type: "string", description: 'Which wall, e.g. "north wall" or "east wall B"' },
      kind: { type: "string", enum: ITEM_KINDS },
      height_mm: { type: "number" },
      from_left_mm: { type: "number", description: "From the wall's left end seen from inside the room; middle when left out" },
      label: { type: "string" }
    }, required: ["room", "wall", "kind"] }
  },
  {
    name: "whats_around",
    description: 'What is next to an object or door/window: the things on its left and right (as seen standing in front of it, facing it, the way someone uses it), in front of it and behind it, with distances. Use it for "the cabinet right of the stove" or "the outlet left of the sink". Returns ids.',
    input_schema: { type: "object", properties: { job: JOB, element_id: { type: "string", description: "The reference object's id, from find_in_plan" } }, required: ["element_id"] }
  },
  { name: "room_layout", description: "A room's layout for changing what's in it: its inside edges (x grows east, y grows south, in mm), its walls with the doors and windows on them, and every object in it with id, centre, size and the way it faces. Call it before adding or moving things.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id or name" } }, required: ["room"] } },
  {
    name: "add_objects",
    description: 'Add furniture, appliances, electronics or fixtures to a room. Each goes in at its real size, height and weight (the catalogue\'s usual values unless you give them), at the right height: things that sit on something (a computer, monitor, microwave, table lamp, TV) go on top of it, on the desk or counter you name with `on` or the nearest suitable one in the room; wall things (mirror, picture, wall cabinet, shelf) hang at their usual height against the nearest wall. When you leave out `facing` it faces the natural way: chairs to their desk or table, stools to the counter, sofas to the TV, beds, cabinets and desks with their backs to the wall. Pieces are kept inside the room. Something not in the kind list: kind "other", its real name, and `parts`.',
    input_schema: { type: "object", properties: { job: JOB, room: { type: "string", description: "Room id (best) or name" }, objects: { type: "array", maxItems: 30, items: { type: "object", properties: {
      kind: { type: "string", enum: OBJECT_KINDS },
      name: { type: "string", description: 'What it is, e.g. "Queen bed", "Desktop computer", "Espresso machine"' },
      x: { type: "number", description: "Centre, plan mm. Can be left out for things put on something or next to their partner (a chair at its desk)" },
      y: { type: "number" },
      width_mm: { type: "number", description: "Across its front; leave out for the usual size" },
      depth_mm: { type: "number", description: "Front to back" },
      height_mm: { type: "number" },
      weight_kg: { type: "number" },
      facing: { ...SIDE, description: "The way its front faces (the foot of a bed, the seat of a chair, a screen's face). Leave out for the natural way." },
      face_toward: { type: "string", description: "Id of something it should face (a chair facing desk G-F41)" },
      on: { type: "string", description: 'Id of what it sits on (the desk, counter or sideboard), from room_layout or earlier in this call ("new:0" is the first object of this call)' },
      height_above_floor_mm: { type: "number", description: "Its bottom above the floor, for something hung at an unusual height" },
      parts: { type: "array", maxItems: 40, items: PART, description: "For kind other: the object built from simple shapes at real sizes, as it really looks (a rowing machine: rail, seat, flywheel, footrests). Its overall width, depth and height must contain the parts." }
    }, required: ["kind"] } } }, required: ["room", "objects"] }
  },
  {
    name: "change_object",
    description: "Move, turn, resize, rename or re-seat one object. Move by mm east/south (negative for west/north), or to a new centre; turn it to face a side or another object; put it on something (`on`), or set its height above the floor.",
    input_schema: { type: "object", properties: {
      job: JOB,
      element_id: { type: "string" },
      move_east_mm: { type: "number" },
      move_south_mm: { type: "number" },
      to_x: { type: "number" },
      to_y: { type: "number" },
      facing: SIDE,
      face_toward: { type: "string", description: "Id of what it should face" },
      on: { type: "string", description: "Id of what it should sit on" },
      height_above_floor_mm: { type: "number" },
      width_mm: { type: "number" },
      depth_mm: { type: "number" },
      height_mm: { type: "number" },
      weight_kg: { type: "number" },
      name: { type: "string" }
    }, required: ["element_id"] }
  },
  {
    name: "point_at",
    description: `Put a blinking coloured dot on the plan (2D and 3D) on each place you're talking about, so the person sees which is which. Use it whenever you name places they must tell apart or find: before asking "the bedroom with the blue dot or the green one?", and to show where something is. With one place it also opens that room or object in the side panel. Returns each place's dot colour; say the colours in your reply.`,
    input_schema: { type: "object", properties: { job: JOB, places: { type: "array", minItems: 1, maxItems: 6, items: { type: "object", properties: {
      id: { type: "string", description: "Room, object, door, window or wall id" },
      label: { type: "string", description: 'What you call it, e.g. "south bedroom"' }
    }, required: ["id"] } }, open: { type: "string", description: "Id to open in the side panel (defaults to the place when there is just one)" } }, required: ["places"] }
  },
  { name: "remove_objects", description: "Take objects out of the plan by id (furniture, appliances, fixtures). Ones from the drawing can be brought back with Reset.", input_schema: { type: "object", properties: { job: JOB, element_ids: { type: "array", items: { type: "string" } } }, required: ["element_ids"] } },
  { name: "rename_room", description: "Rename a room or change its type.", input_schema: { type: "object", properties: { job: JOB, room: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["kitchen", "bathroom", "wc", "bedroom", "living", "dining", "family", "study", "office", "hallway", "foyer", "stair_hall", "laundry", "utility", "closet", "garage", "storage", "balcony", "porch", "terrace", "other"] } }, required: ["room"] } },
  { name: "team", description: "The team: names, titles and roles (and contact details for admins).", input_schema: { type: "object", properties: {} } }
];
function instructions(me, ctx) {
  return [
    `You are the Rorker assistant inside Rorker, a job app for contractors, working for ${me.name ?? "the signed-in person"} at ${me.company} (role: ${me.role === "admin" ? "owner/admin" : "employee"}).`,
    "You act as them: you can look up their jobs and make changes with the tools, on their permissions. Do what they ask without asking for confirmation, unless the request is unclear; then ask one short question.",
    'Look things up with the tools rather than guessing. Use ids you got from a tool. When you change something, say in one short sentence what you did ("Added task #7 on the kitchen sink, due today, tagged Marco.").',
    "Keep replies short and plain: they are often read aloud to someone on a job site. No tables, no headings, no long lists; at most a few short sentences.",
    "Never give out information beyond what the tools return for this person. Don't reveal anything about other companies, and don't repeat personal contact details unless this person is an admin and asked for them.",
    "Never say which AI model or company powers you; you are the Rorker assistant.",
    `Where things are: left and right of an object always mean as seen standing in front of it, facing it (the way you'd use a stove, a sink or a cabinet), not as seen on the plan. "The cabinet right of the stove" is the one at your right hand when you face the stove. Use whats_around to find it. Above and below mean height on the wall. North, south, east and west follow the plan (north is up). If two things still fit, ask one short question naming them by where they are.`,
    "Changing the plan: you can add, move, turn, resize and remove furniture, appliances and fixtures, and rename rooms (room_layout first, then add_objects, change_object, remove_objects, rename_room). Walls, rooms' shapes, doors and windows can't be changed here yet: say so in one sentence and offer to add a task pin for it.",
    "Real things, real sizes: every object has a real width, depth, height, weight and mounting height, and drawings never show furniture heights, so add_objects fills in the usual ones for each kind. Pick the kind that is the actual thing (a computer is kind computer, never a box or other). A computer, monitor, laptop, printer, table lamp, microwave, coffee machine or TV sits on a desk, counter or sideboard, never on the floor: put it `on` that piece (add the desk first if the room has none, or ask). Chairs go at their desk or table facing it, bar stools at the counter or island facing it, sofas and armchairs face the TV, fireplace or coffee table, beds, cabinets, wardrobes and desks stand with their backs to a wall facing into the room, wall cabinets, mirrors, pictures and shelves hang on a wall at their usual height. Leave facing out and it is worked out that way; give it only when the person asks for something else.",
    "Something not in the kind list (a rowing machine, a pool table, a kayak rack): don't settle for a box. Work out from what you know (or look it up with web search when you can) what it really looks like, its real size and weight, then add it as kind other with its name and parts: simple boxes, cylinders and spheres at real sizes and colours that together look like the real thing. Only when you truly can't tell what it is, ask what it looks like.",
    "Placing: the usual layouts (width x depth, mm): double bed 1400x2000, queen 1600x2000, king 1800x2000, single 900x2000 with a nightstand each side of a double; dining table 1600x900 for 6 or 1200x800 for 4 with a chair at each place; desk 1200x600 with an office chair; sofa facing the TV on a sideboard. Place things the way a designer would: keep about 900 mm of walking space and never block a door or doorway. Only add what fits; leave other things as they are unless asked.",
    'Showing places: whenever you mention a room or spot the person has to pick between or find ("which bedroom?"), call point_at first so a coloured dot blinks on each one, then name them by where they are and by colour ("the bedroom on the south side, blue dot, or the east one, green dot?"). Rooms often share a name, so tell them apart by their side of the floor (find_in_plan says where each one is). After adding or moving something it is pointed at for you. Dots blink for 10 seconds and then go, so every time you refer to a place again (later in the chat too), call point_at again so it blinks again.',
    // keep these two last: they change per request, and everything above them is cached
    `Today is ${today()}.`,
    ctx.jobId ? `They are looking at the job "${ctx.jobName ?? ctx.jobId}" (id ${ctx.jobId})${ctx.where ? `, at ${ctx.where}` : ""}${ctx.selected ? `, with ${ctx.selected} selected` : ""}. "This job", "here" and "this" refer to that.` : "They are on the jobs list."
  ].join("\n");
}
export {
  TOOLS,
  instructions
};
