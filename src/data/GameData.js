// Resource definitions
export const RESOURCES = {
  wood: { name: 'Wood', tier: 1, source: 'tree', harvestTime: 1000, xp: 5, toolType: 'axe' },
  stone: { name: 'Stone', tier: 1, source: 'stone', harvestTime: 1500, xp: 8, toolType: 'pickaxe' },
  fiber: { name: 'Fiber', tier: 1, source: 'fiber', harvestTime: 800, xp: 3, toolType: 'any' },
  berries: { name: 'Berries', tier: 1, source: 'bush', harvestTime: 500, xp: 2, toolType: 'any' },
  coal: { name: 'Coal', tier: 2, source: 'coal', harvestTime: 2000, xp: 12, toolType: 'pickaxe' },
  copper: { name: 'Copper', tier: 2, source: 'copper', harvestTime: 2500, xp: 15, toolType: 'pickaxe' },
  iron: { name: 'Iron', tier: 3, source: 'iron', harvestTime: 3000, xp: 20, toolType: 'pickaxe' },
  gold: { name: 'Gold', tier: 4, source: 'gold', harvestTime: 4000, xp: 30, toolType: 'pickaxe' },
  crystal: { name: 'Crystal', tier: 4, source: 'crystal', harvestTime: 4500, xp: 35, toolType: 'pickaxe' },
  diamond: { name: 'Diamond', tier: 5, source: 'diamond', harvestTime: 5000, xp: 50, toolType: 'pickaxe' },
  mythril: { name: 'Mythril', tier: 5, source: 'mythril', harvestTime: 6000, xp: 75, toolType: 'pickaxe' },
  // Smelted bars (no source - crafted only)
  copperBar: { name: 'Copper Bar', tier: 2, source: null, xp: 0 },
  ironBar: { name: 'Iron Bar', tier: 3, source: null, xp: 0 },
  goldBar: { name: 'Gold Bar', tier: 4, source: null, xp: 0 },
  steelBar: { name: 'Steel Bar', tier: 4, source: null, xp: 0 },
  mythrilBar: { name: 'Mythril Bar', tier: 5, source: null, xp: 0 }
};

// Tool definitions with attack properties
// Attack properties: range, arc (radians), speed (ms cooldown), knockback
export const TOOLS = {
  hands: { 
    name: 'Hands', power: 1, tier: 0, type: 'fists',
    attack: { range: 25, arc: 0.8, speed: 350, knockback: 50 }
  },
  
  // === PICKAXES (precise forward stab/poke) ===
  woodenPickaxe: { 
    name: 'Wooden Pickaxe', power: 2, tier: 1, type: 'pickaxe',
    recipe: { wood: 10, fiber: 5 },
    attack: { range: 40, arc: 0.5, speed: 600, knockback: 80 }
  },
  stonePickaxe: { 
    name: 'Stone Pickaxe', power: 3, tier: 2, type: 'pickaxe',
    recipe: { wood: 5, stone: 15 },
    attack: { range: 42, arc: 0.5, speed: 580, knockback: 90 }
  },
  copperPickaxe: { 
    name: 'Copper Pickaxe', power: 5, tier: 3, type: 'pickaxe',
    recipe: { wood: 5, copper: 20, coal: 10 },
    attack: { range: 45, arc: 0.5, speed: 550, knockback: 100 }
  },
  ironPickaxe: { 
    name: 'Iron Pickaxe', power: 8, tier: 4, type: 'pickaxe',
    recipe: { wood: 5, iron: 25, coal: 15 },
    attack: { range: 48, arc: 0.5, speed: 520, knockback: 110 }
  },
  goldPickaxe: { 
    name: 'Gold Pickaxe', power: 12, tier: 5, type: 'pickaxe',
    recipe: { wood: 5, gold: 30, iron: 10 },
    attack: { range: 50, arc: 0.5, speed: 480, knockback: 120 }
  },
  diamondPickaxe: { 
    name: 'Diamond Pickaxe', power: 20, tier: 6, type: 'pickaxe',
    recipe: { iron: 10, diamond: 15, crystal: 5 },
    attack: { range: 52, arc: 0.5, speed: 450, knockback: 130 }
  },
  mythrilPickaxe: { 
    name: 'Mythril Pickaxe', power: 35, tier: 7, type: 'pickaxe',
    recipe: { diamond: 10, mythril: 25, crystal: 15 },
    attack: { range: 55, arc: 0.5, speed: 400, knockback: 150 }
  },
  
  // === AXES (overhead chop, medium arc) ===
  woodenAxe: { 
    name: 'Wooden Axe', power: 2, tier: 1, type: 'axe',
    recipe: { wood: 15, fiber: 5 },
    attack: { range: 38, arc: 0.7, speed: 650, knockback: 100 }
  },
  stoneAxe: { 
    name: 'Stone Axe', power: 4, tier: 2, type: 'axe',
    recipe: { wood: 10, stone: 20 },
    attack: { range: 40, arc: 0.7, speed: 620, knockback: 120 }
  },
  ironAxe: { 
    name: 'Iron Axe', power: 8, tier: 4, type: 'axe',
    recipe: { wood: 5, iron: 30, coal: 10 },
    attack: { range: 45, arc: 0.7, speed: 580, knockback: 140 }
  },
  diamondAxe: { 
    name: 'Diamond Axe', power: 18, tier: 6, type: 'axe',
    recipe: { iron: 15, diamond: 20 },
    attack: { range: 50, arc: 0.7, speed: 520, knockback: 160 }
  },
  
  // === BATTLE AXES (wide sweeping arc, slower but powerful) ===
  ironBattleAxe: {
    name: 'Iron Battle Axe', power: 12, tier: 4, type: 'battleaxe',
    recipe: { wood: 10, iron: 40, coal: 15 },
    attack: { range: 55, arc: 1.2, speed: 800, knockback: 200 }
  },
  steelBattleAxe: {
    name: 'Steel Battle Axe', power: 18, tier: 5, type: 'battleaxe',
    recipe: { wood: 10, steelBar: 8 },
    attack: { range: 60, arc: 1.3, speed: 750, knockback: 220 }
  },
  mythrilBattleAxe: {
    name: 'Mythril Battle Axe', power: 32, tier: 7, type: 'battleaxe',
    recipe: { mythrilBar: 10, diamond: 5 },
    attack: { range: 65, arc: 1.4, speed: 700, knockback: 250 }
  },
  
  // === SWORDS (balanced horizontal slash) ===
  woodenSword: {
    name: 'Wooden Sword', power: 3, tier: 1, type: 'sword',
    recipe: { wood: 15, fiber: 10 },
    attack: { range: 45, arc: 0.9, speed: 450, knockback: 80 }
  },
  stoneSword: {
    name: 'Stone Sword', power: 5, tier: 2, type: 'sword',
    recipe: { wood: 5, stone: 20 },
    attack: { range: 48, arc: 0.9, speed: 430, knockback: 90 }
  },
  ironSword: {
    name: 'Iron Sword', power: 10, tier: 4, type: 'sword',
    recipe: { wood: 5, iron: 25, coal: 10 },
    attack: { range: 52, arc: 0.9, speed: 400, knockback: 100 }
  },
  goldSword: {
    name: 'Gold Sword', power: 14, tier: 5, type: 'sword',
    recipe: { wood: 5, gold: 30, iron: 5 },
    attack: { range: 55, arc: 0.9, speed: 380, knockback: 110 }
  },
  diamondSword: {
    name: 'Diamond Sword', power: 22, tier: 6, type: 'sword',
    recipe: { iron: 10, diamond: 20, crystal: 5 },
    attack: { range: 58, arc: 0.9, speed: 350, knockback: 120 }
  },
  mythrilSword: {
    name: 'Mythril Sword', power: 40, tier: 7, type: 'sword',
    recipe: { diamond: 10, mythril: 30, crystal: 10 },
    attack: { range: 62, arc: 0.9, speed: 320, knockback: 140 }
  },
  
  // === DAGGERS/KNIVES (very fast, short range, narrow) ===
  stoneDagger: {
    name: 'Stone Dagger', power: 3, tier: 1, type: 'dagger',
    recipe: { stone: 8, fiber: 5 },
    attack: { range: 25, arc: 0.4, speed: 250, knockback: 40 }
  },
  ironDagger: {
    name: 'Iron Dagger', power: 6, tier: 3, type: 'dagger',
    recipe: { iron: 10, fiber: 5 },
    attack: { range: 28, arc: 0.4, speed: 220, knockback: 50 }
  },
  goldDagger: {
    name: 'Gold Dagger', power: 9, tier: 4, type: 'dagger',
    recipe: { gold: 12, fiber: 5 },
    attack: { range: 30, arc: 0.4, speed: 200, knockback: 55 }
  },
  diamondDagger: {
    name: 'Diamond Dagger', power: 14, tier: 6, type: 'dagger',
    recipe: { diamond: 8, iron: 5 },
    attack: { range: 32, arc: 0.4, speed: 180, knockback: 60 }
  },
  
  // === SPEARS (long range, very narrow, thrust attack) ===
  woodenSpear: {
    name: 'Wooden Spear', power: 4, tier: 1, type: 'spear',
    recipe: { wood: 20, fiber: 10 },
    attack: { range: 70, arc: 0.3, speed: 550, knockback: 120 }
  },
  ironSpear: {
    name: 'Iron Spear', power: 9, tier: 3, type: 'spear',
    recipe: { wood: 10, iron: 15 },
    attack: { range: 75, arc: 0.3, speed: 500, knockback: 140 }
  },
  steelSpear: {
    name: 'Steel Spear', power: 14, tier: 5, type: 'spear',
    recipe: { wood: 10, steelBar: 5 },
    attack: { range: 80, arc: 0.3, speed: 450, knockback: 160 }
  },
  mythrilSpear: {
    name: 'Mythril Spear', power: 28, tier: 7, type: 'spear',
    recipe: { mythrilBar: 8, crystal: 5 },
    attack: { range: 90, arc: 0.3, speed: 400, knockback: 180 }
  },
  
  // === HAMMERS (slow, powerful, medium range, good knockback) ===
  stoneHammer: {
    name: 'Stone Hammer', power: 6, tier: 2, type: 'hammer',
    recipe: { wood: 10, stone: 25 },
    attack: { range: 35, arc: 0.6, speed: 750, knockback: 180 }
  },
  ironHammer: {
    name: 'Iron Hammer', power: 12, tier: 4, type: 'hammer',
    recipe: { wood: 10, iron: 35 },
    attack: { range: 40, arc: 0.6, speed: 700, knockback: 220 }
  },
  steelHammer: {
    name: 'Steel Hammer', power: 20, tier: 5, type: 'hammer',
    recipe: { wood: 10, steelBar: 10 },
    attack: { range: 45, arc: 0.6, speed: 650, knockback: 260 }
  },
  mythrilHammer: {
    name: 'Mythril Hammer', power: 35, tier: 7, type: 'hammer',
    recipe: { mythrilBar: 12, diamond: 3 },
    attack: { range: 50, arc: 0.6, speed: 600, knockback: 300 }
  }
};

// Equipment/Armor definitions
export const EQUIPMENT = {
  // Helmets
  leatherHelmet: {
    name: 'Leather Cap', slot: 'head', defense: 2, tier: 1,
    recipe: { fiber: 20 }
  },
  copperHelmet: {
    name: 'Copper Helmet', slot: 'head', defense: 5, tier: 2,
    recipe: { copperBar: 5, fiber: 10 }
  },
  ironHelmet: {
    name: 'Iron Helmet', slot: 'head', defense: 10, tier: 3,
    recipe: { ironBar: 8, fiber: 5 }
  },
  // Chest armor
  leatherChest: {
    name: 'Leather Vest', slot: 'chest', defense: 4, tier: 1,
    recipe: { fiber: 30 }
  },
  copperChest: {
    name: 'Copper Chestplate', slot: 'chest', defense: 10, tier: 2,
    recipe: { copperBar: 10, fiber: 15 }
  },
  ironChest: {
    name: 'Iron Chestplate', slot: 'chest', defense: 20, tier: 3,
    recipe: { ironBar: 15, fiber: 10 }
  },
  // Leg armor
  leatherLegs: {
    name: 'Leather Pants', slot: 'legs', defense: 3, tier: 1,
    recipe: { fiber: 25 }
  },
  copperLegs: {
    name: 'Copper Leggings', slot: 'legs', defense: 7, tier: 2,
    recipe: { copperBar: 7, fiber: 12 }
  },
  ironLegs: {
    name: 'Iron Leggings', slot: 'legs', defense: 15, tier: 3,
    recipe: { ironBar: 12, fiber: 8 }
  },
  // Boots
  leatherBoots: {
    name: 'Leather Boots', slot: 'feet', defense: 2, tier: 1,
    recipe: { fiber: 15 }
  },
  copperBoots: {
    name: 'Copper Boots', slot: 'feet', defense: 4, tier: 2,
    recipe: { copperBar: 4, fiber: 8 }
  },
  ironBoots: {
    name: 'Iron Boots', slot: 'feet', defense: 8, tier: 3,
    recipe: { ironBar: 6, fiber: 5 }
  }
};

// Consumable items
export const CONSUMABLES = {
  berries: {
    name: 'Berries', type: 'food', healAmount: 10, stackSize: 50
  },
  cookedMeat: {
    name: 'Cooked Meat', type: 'food', healAmount: 25, stackSize: 20,
    recipe: { rawMeat: 1, coal: 1 }
  },
  healthPotion: {
    name: 'Health Potion', type: 'potion', healAmount: 50, stackSize: 10,
    recipe: { berries: 10, crystal: 2 }
  },
  energyPotion: {
    name: 'Energy Potion', type: 'potion', energyAmount: 50, stackSize: 10,
    recipe: { berries: 5, fiber: 10, crystal: 1 }
  }
};

// Building definitions
export const BUILDINGS = {
  workbench: {
    name: 'Workbench',
    description: 'Craft basic tools and items',
    recipe: { wood: 20, stone: 10 },
    size: { width: 64, height: 48 }
  },
  forge: {
    name: 'Forge',
    description: 'Smelt ores and craft metal tools',
    recipe: { stone: 40, coal: 20, copper: 10 },
    size: { width: 64, height: 64 }
  },
  storage: {
    name: 'Storage Chest',
    description: 'Store extra resources',
    recipe: { wood: 20, fiber: 10 },
    size: { width: 48, height: 48 }
  },
  house: {
    name: 'House',
    description: 'Rest to restore energy',
    recipe: { wood: 50, stone: 30, fiber: 20 },
    size: { width: 80, height: 80 }
  },
  portal: {
    name: 'Portal',
    description: 'Travel to new islands',
    recipe: { stone: 100, crystal: 25, diamond: 10, mythril: 5 },
    size: { width: 64, height: 80 }
  },
  mine: {
    name: 'Mine Entrance',
    description: 'Access underground resources',
    recipe: { wood: 40, stone: 60, iron: 20 },
    size: { width: 64, height: 64 }
  }
};

// Tower definitions - defensive structures
export const TOWERS = {
  // 1x1 Towers (32x32 pixels)
  woodenTower: {
    name: 'Wooden Tower',
    description: 'Basic defensive tower',
    recipe: { wood: 30, fiber: 10 },
    size: 1, // 1x1 tiles
    health: 100,
    damage: 5,
    range: 150,
    fireRate: 1000, // ms between shots
    projectile: 'arrow'
  },
  stoneTower: {
    name: 'Stone Tower',
    description: 'Sturdy stone tower',
    recipe: { stone: 50, wood: 20 },
    size: 1,
    health: 200,
    damage: 8,
    range: 175,
    fireRate: 1200,
    projectile: 'rock'
  },
  
  // 2x2 Towers (64x64 pixels)
  archerTower: {
    name: 'Archer Tower',
    description: 'Tall tower with longer range',
    recipe: { wood: 60, stone: 40, fiber: 20 },
    size: 2, // 2x2 tiles
    health: 300,
    damage: 12,
    range: 250,
    fireRate: 800,
    projectile: 'arrow'
  },
  cannonTower: {
    name: 'Cannon Tower',
    description: 'Powerful but slow cannon',
    recipe: { stone: 80, ironBar: 20, coal: 30 },
    size: 2,
    health: 400,
    damage: 30,
    range: 200,
    fireRate: 2000,
    projectile: 'cannonball'
  },
  
  // 3x3 Towers (96x96 pixels)
  fortress: {
    name: 'Fortress',
    description: 'Massive defensive structure',
    recipe: { stone: 150, ironBar: 50, wood: 80 },
    size: 3, // 3x3 tiles
    health: 800,
    damage: 20,
    range: 300,
    fireRate: 600,
    projectile: 'arrow'
  },
  crystalSpire: {
    name: 'Crystal Spire',
    description: 'Magical tower with area damage',
    recipe: { crystal: 40, goldBar: 20, stone: 100 },
    size: 3,
    health: 500,
    damage: 40,
    range: 350,
    fireRate: 1500,
    projectile: 'magic'
  }
};

// Land tile definitions - expandable world grid
export const LAND_TILES = {
  // Starting area (center)
  starter: {
    name: 'Grassland',
    resources: ['tree', 'stone', 'bush', 'fiber'],
    enemies: [],
    unlockCost: null // Free starting tile
  },
  // Tier 1 expansions
  forest: {
    name: 'Forest',
    resources: ['tree', 'tree', 'bush', 'fiber'],
    enemies: ['slime'],
    unlockCost: { wood: 30 }
  },
  quarry: {
    name: 'Quarry',
    resources: ['stone', 'stone', 'coal'],
    enemies: ['slime'],
    unlockCost: { wood: 20, stone: 20 }
  },
  // Tier 2 expansions
  copperMine: {
    name: 'Copper Deposit',
    resources: ['stone', 'coal', 'copper', 'copper'],
    enemies: ['slime', 'goblin'],
    unlockCost: { wood: 50, stone: 40 }
  },
  swamp: {
    name: 'Swamp',
    resources: ['fiber', 'fiber', 'bush', 'tree'],
    enemies: ['slime'],
    unlockCost: { wood: 40, fiber: 20 }
  },
  // Tier 3 expansions
  ironMine: {
    name: 'Iron Deposit',
    resources: ['stone', 'coal', 'iron', 'iron'],
    enemies: ['goblin', 'golem'],
    unlockCost: { copper: 30, coal: 30, stone: 50 }
  },
  deepForest: {
    name: 'Deep Forest',
    resources: ['tree', 'tree', 'tree', 'fiber'],
    enemies: ['goblin'],
    unlockCost: { wood: 80, fiber: 30 }
  },
  // Tier 4 expansions
  goldMine: {
    name: 'Gold Vein',
    resources: ['stone', 'gold', 'gold', 'iron'],
    enemies: ['golem'],
    unlockCost: { iron: 40, coal: 50 }
  },
  crystalCave: {
    name: 'Crystal Cave',
    resources: ['stone', 'crystal', 'crystal', 'gold'],
    enemies: ['golem', 'crystalBeast'],
    unlockCost: { iron: 50, gold: 20 }
  },
  // Tier 5 expansions
  diamondMine: {
    name: 'Diamond Mine',
    resources: ['crystal', 'diamond', 'diamond', 'gold'],
    enemies: ['crystalBeast'],
    unlockCost: { gold: 40, crystal: 30 }
  },
  mythrilPeak: {
    name: 'Mythril Peak',
    resources: ['diamond', 'mythril', 'mythril', 'crystal'],
    enemies: ['crystalBeast'],
    unlockCost: { diamond: 30, crystal: 40, gold: 50 }
  }
};

// World grid size (tiles)
export const WORLD_GRID_SIZE = 7; // 7x7 grid of land tiles
export const LAND_TILE_SIZE = 10; // Each land tile is 10x10 game tiles

// Legacy islands array for compatibility
export const ISLANDS = [
  { id: 0, name: 'World', size: { width: 70, height: 70 } }
];

// Smelting recipes (for Forge)
export const SMELTING = {
  copperBar: {
    name: 'Copper Bar',
    recipe: { copper: 3, coal: 1 },
    time: 2000
  },
  ironBar: {
    name: 'Iron Bar',
    recipe: { iron: 3, coal: 2 },
    time: 3000
  },
  goldBar: {
    name: 'Gold Bar',
    recipe: { gold: 3, coal: 2 },
    time: 4000
  },
  steelBar: {
    name: 'Steel Bar',
    recipe: { iron: 2, coal: 4 },
    time: 5000
  },
  mythrilBar: {
    name: 'Mythril Bar',
    recipe: { mythril: 3, crystal: 1, coal: 3 },
    time: 8000
  }
};

// Storage capacity
export const STORAGE_CAPACITY = 100;

// Energy system
export const ENERGY = {
  max: 100,
  miningCost: 2,
  restorePerSecond: 20, // When resting in house
  restorePerSecondIdle: 1 // When not doing anything
};

// Enemy definitions
export const ENEMIES = {
  slime: {
    name: 'Slime',
    health: 20,
    damage: 5,
    speed: 30,
    xp: 15,
    drops: { fiber: 2 }
  },
  goblin: {
    name: 'Goblin',
    health: 40,
    damage: 10,
    speed: 50,
    xp: 30,
    drops: { coal: 1, copper: 1 }
  },
  golem: {
    name: 'Stone Golem',
    health: 80,
    damage: 15,
    speed: 25,
    xp: 60,
    drops: { stone: 5, iron: 2 }
  },
  crystalBeast: {
    name: 'Crystal Beast',
    health: 120,
    damage: 20,
    speed: 40,
    xp: 100,
    drops: { crystal: 3, diamond: 1 }
  }
};

// Upgrade definitions
export const UPGRADES = {
  miningSpeed: {
    name: 'Mining Speed',
    description: 'Harvest resources faster',
    maxLevel: 10,
    costPerLevel: (level) => ({
      stone: 20 * level,
      iron: 5 * level
    }),
    effect: (level) => 1 + (level * 0.15)
  },
  harvestYield: {
    name: 'Harvest Yield',
    description: 'Get more resources per harvest',
    maxLevel: 10,
    costPerLevel: (level) => ({
      wood: 30 * level,
      copper: 10 * level
    }),
    effect: (level) => 1 + (level * 0.2)
  },
  moveSpeed: {
    name: 'Move Speed',
    description: 'Move faster around the island',
    maxLevel: 5,
    costPerLevel: (level) => ({
      fiber: 50 * level,
      berries: 20 * level
    }),
    effect: (level) => 1 + (level * 0.1)
  },
  inventorySize: {
    name: 'Inventory Size',
    description: 'Carry more resources',
    maxLevel: 5,
    costPerLevel: (level) => ({
      wood: 40 * level,
      iron: 15 * level,
      gold: 5 * level
    }),
    effect: (level) => 40 + (level * 10)
  }
};

// Multiplayer configuration
export const MULTIPLAYER_CONFIG = {
  maxPlayers: 4,
  tickRate: 20,              // Network updates per second
  interpolationDelay: 100,   // ms delay for smooth interpolation
  positionSyncRate: 50,      // ms between position updates
  stateSyncRate: 5000,       // ms between full state syncs
  enemySyncRate: 100,        // ms between enemy state syncs
  roomCodeLength: 6,
  connectionTimeout: 10000,  // ms before connection timeout
};

// Player colors for multiplayer (P1, P2, P3, P4)
export const PLAYER_COLORS = [
  0xffffff, // P1 - white (host)
  0x88ff88, // P2 - green
  0x8888ff, // P3 - blue
  0xff8888, // P4 - red
];
