// Procedural pixel art sprite generator
export class SpriteGenerator {
  constructor(scene) {
    this.scene = scene;
  }

  generateAllSprites() {
    this.generatePlayer();
    this.generateResources();
    this.generateTools();
    this.generateBuildings();
    this.generateTiles();
    this.generateUI();
    this.generateEnemies();
    this.generateBars();
  }

  createTexture(key, width, height, drawFunc) {
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
    drawFunc(graphics, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  generatePlayer() {
    // Standing frame
    this.createTexture('player', 32, 32, (g) => {
      // Body
      g.fillStyle(0x4a90d9);
      g.fillRect(10, 8, 12, 16);
      // Head
      g.fillStyle(0xffcc99);
      g.fillRect(12, 2, 8, 8);
      // Eyes
      g.fillStyle(0x333333);
      g.fillRect(14, 4, 2, 2);
      g.fillRect(18, 4, 2, 2);
      // Legs
      g.fillStyle(0x3d3d3d);
      g.fillRect(10, 24, 4, 6);
      g.fillRect(18, 24, 4, 6);
      // Arms
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(22, 10, 4, 10);
    });

    // Walk frame 1
    this.createTexture('player_walk1', 32, 32, (g) => {
      g.fillStyle(0x4a90d9);
      g.fillRect(10, 8, 12, 16);
      g.fillStyle(0xffcc99);
      g.fillRect(12, 2, 8, 8);
      g.fillStyle(0x333333);
      g.fillRect(14, 4, 2, 2);
      g.fillRect(18, 4, 2, 2);
      // Legs spread
      g.fillStyle(0x3d3d3d);
      g.fillRect(8, 24, 4, 6);
      g.fillRect(20, 24, 4, 6);
      // Arms swinging
      g.fillStyle(0xffcc99);
      g.fillRect(4, 8, 4, 10);
      g.fillRect(24, 12, 4, 10);
    });

    // Walk frame 2
    this.createTexture('player_walk2', 32, 32, (g) => {
      g.fillStyle(0x4a90d9);
      g.fillRect(10, 8, 12, 16);
      g.fillStyle(0xffcc99);
      g.fillRect(12, 2, 8, 8);
      g.fillStyle(0x333333);
      g.fillRect(14, 4, 2, 2);
      g.fillRect(18, 4, 2, 2);
      // Legs together
      g.fillStyle(0x3d3d3d);
      g.fillRect(12, 24, 4, 6);
      g.fillRect(16, 24, 4, 6);
      // Arms swinging opposite
      g.fillStyle(0xffcc99);
      g.fillRect(4, 12, 4, 10);
      g.fillRect(24, 8, 4, 10);
    });

    // Mining frame
    this.createTexture('player_mine', 32, 32, (g) => {
      g.fillStyle(0x4a90d9);
      g.fillRect(10, 8, 12, 16);
      g.fillStyle(0xffcc99);
      g.fillRect(12, 2, 8, 8);
      g.fillStyle(0x333333);
      g.fillRect(14, 4, 2, 2);
      g.fillRect(18, 4, 2, 2);
      g.fillStyle(0x3d3d3d);
      g.fillRect(10, 24, 4, 6);
      g.fillRect(18, 24, 4, 6);
      // Arms raised
      g.fillStyle(0xffcc99);
      g.fillRect(6, 4, 4, 10);
      g.fillRect(22, 4, 4, 10);
    });

    // Attack frame (fists)
    this.createTexture('player_attack', 32, 32, (g) => {
      g.fillStyle(0x4a90d9);
      g.fillRect(10, 8, 12, 16);
      g.fillStyle(0xffcc99);
      g.fillRect(12, 2, 8, 8);
      g.fillStyle(0x333333);
      g.fillRect(14, 4, 2, 2);
      g.fillRect(18, 4, 2, 2);
      g.fillStyle(0x3d3d3d);
      g.fillRect(10, 24, 4, 6);
      g.fillRect(18, 24, 4, 6);
      // Right arm extended
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(26, 8, 6, 4);
    });

    // === WEAPON HOLDING SPRITES ===
    
    // Holding pickaxe
    this.createTexture('player_hold_pickaxe', 32, 32, (g) => {
      this.drawPlayerBase(g);
      // Right arm holding pickaxe
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(22, 8, 4, 8);
      // Pickaxe
      g.fillStyle(0x8B4513); // Handle
      g.fillRect(26, 4, 2, 14);
      g.fillStyle(0x808080); // Head
      g.fillRect(24, 2, 8, 4);
      g.fillRect(28, 6, 4, 2);
    });

    // Pickaxe swing frame 1
    this.createTexture('player_swing_pickaxe1', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(24, 4, 4, 6);
      // Pickaxe raised
      g.fillStyle(0x8B4513);
      g.fillRect(26, -2, 2, 12);
      g.fillStyle(0x808080);
      g.fillRect(22, -4, 10, 4);
    });

    // Pickaxe swing frame 2
    this.createTexture('player_swing_pickaxe2', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(26, 12, 4, 6);
      // Pickaxe down
      g.fillStyle(0x8B4513);
      g.fillRect(28, 8, 2, 14);
      g.fillStyle(0x808080);
      g.fillRect(26, 20, 8, 4);
    });

    // Holding axe
    this.createTexture('player_hold_axe', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(22, 8, 4, 8);
      // Axe
      g.fillStyle(0x8B4513); // Handle
      g.fillRect(26, 4, 2, 14);
      g.fillStyle(0x606060); // Blade
      g.fillRect(28, 2, 4, 8);
      g.fillRect(26, 4, 2, 4);
    });

    // Axe swing frame 1
    this.createTexture('player_swing_axe1', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(24, 4, 4, 6);
      // Axe raised
      g.fillStyle(0x8B4513);
      g.fillRect(26, -2, 2, 12);
      g.fillStyle(0x606060);
      g.fillRect(28, -4, 4, 8);
    });

    // Axe swing frame 2
    this.createTexture('player_swing_axe2', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(26, 12, 4, 6);
      // Axe down
      g.fillStyle(0x8B4513);
      g.fillRect(28, 8, 2, 14);
      g.fillStyle(0x606060);
      g.fillRect(30, 18, 4, 8);
    });

    // Holding sword
    this.createTexture('player_hold_sword', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(22, 10, 4, 8);
      // Sword at side
      g.fillStyle(0x8B4513); // Handle
      g.fillRect(26, 16, 2, 6);
      g.fillStyle(0xC0C0C0); // Blade
      g.fillRect(26, 6, 2, 10);
      g.fillStyle(0xFFD700); // Guard
      g.fillRect(24, 14, 6, 2);
    });

    // Sword attack frame 1 (wind up)
    this.createTexture('player_swing_sword1', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(20, 4, 4, 6);
      // Sword raised behind
      g.fillStyle(0x8B4513);
      g.fillRect(18, 0, 2, 6);
      g.fillStyle(0xC0C0C0);
      g.fillRect(16, -8, 2, 10);
      g.fillStyle(0xFFD700);
      g.fillRect(14, -2, 6, 2);
    });

    // Sword attack frame 2 (slash)
    this.createTexture('player_swing_sword2', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(26, 10, 6, 4);
      // Sword extended
      g.fillStyle(0x8B4513);
      g.fillRect(30, 10, 4, 2);
      g.fillStyle(0xC0C0C0);
      g.fillRect(34, 8, 12, 3);
      g.fillStyle(0xFFD700);
      g.fillRect(32, 6, 2, 6);
      // Slash effect
      g.fillStyle(0xFFFFFF, 0.5);
      g.fillRect(38, 4, 8, 2);
      g.fillRect(42, 8, 6, 2);
      g.fillRect(40, 12, 8, 2);
    });

    // Sword attack frame 3 (follow through)
    this.createTexture('player_swing_sword3', 32, 32, (g) => {
      this.drawPlayerBase(g);
      g.fillStyle(0xffcc99);
      g.fillRect(6, 10, 4, 10);
      g.fillRect(26, 16, 4, 6);
      // Sword low
      g.fillStyle(0x8B4513);
      g.fillRect(28, 20, 2, 4);
      g.fillStyle(0xC0C0C0);
      g.fillRect(30, 22, 10, 2);
      g.fillStyle(0xFFD700);
      g.fillRect(28, 18, 2, 6);
    });
  }

  // Helper to draw player base (body, head, legs)
  drawPlayerBase(g) {
    // Body
    g.fillStyle(0x4a90d9);
    g.fillRect(10, 8, 12, 16);
    // Head
    g.fillStyle(0xffcc99);
    g.fillRect(12, 2, 8, 8);
    // Eyes
    g.fillStyle(0x333333);
    g.fillRect(14, 4, 2, 2);
    g.fillRect(18, 4, 2, 2);
    // Legs
    g.fillStyle(0x3d3d3d);
    g.fillRect(10, 24, 4, 6);
    g.fillRect(18, 24, 4, 6);
  }

  generateResources() {
    // Stone
    this.createTexture('stone', 32, 32, (g) => {
      g.fillStyle(0x808080);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0x606060);
      g.fillRect(6, 10, 8, 8);
      g.fillStyle(0xa0a0a0);
      g.fillRect(16, 14, 6, 6);
    });

    // Iron ore
    this.createTexture('iron', 32, 32, (g) => {
      g.fillStyle(0x8b7355);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0xc0c0c0);
      g.fillRect(8, 12, 6, 6);
      g.fillRect(18, 16, 4, 4);
      g.fillRect(12, 20, 5, 5);
    });

    // Gold ore
    this.createTexture('gold', 32, 32, (g) => {
      g.fillStyle(0x8b7355);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0xffd700);
      g.fillRect(8, 12, 6, 6);
      g.fillRect(18, 14, 5, 5);
      g.fillRect(10, 20, 4, 4);
    });

    // Diamond
    this.createTexture('diamond', 32, 32, (g) => {
      g.fillStyle(0x404050);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0x00ffff);
      g.fillRect(12, 12, 8, 8);
      g.fillStyle(0x80ffff);
      g.fillRect(14, 14, 4, 4);
    });

    // Wood/Tree
    this.createTexture('tree', 48, 64, (g) => {
      // Trunk
      g.fillStyle(0x8b4513);
      g.fillRect(18, 32, 12, 32);
      g.fillStyle(0x6b3510);
      g.fillRect(20, 36, 4, 24);
      // Leaves
      g.fillStyle(0x228b22);
      g.fillRect(8, 4, 32, 32);
      g.fillStyle(0x32cd32);
      g.fillRect(12, 8, 12, 12);
      g.fillRect(24, 12, 8, 8);
    });

    // Coal
    this.createTexture('coal', 32, 32, (g) => {
      g.fillStyle(0x404040);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0x202020);
      g.fillRect(8, 12, 8, 8);
      g.fillRect(18, 16, 6, 6);
    });

    // Copper
    this.createTexture('copper', 32, 32, (g) => {
      g.fillStyle(0x8b7355);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0xb87333);
      g.fillRect(8, 12, 6, 6);
      g.fillRect(16, 14, 5, 5);
      g.fillRect(10, 20, 4, 4);
    });

    // Crystal
    this.createTexture('crystal', 32, 32, (g) => {
      g.fillStyle(0x9932cc);
      g.fillRect(12, 4, 8, 24);
      g.fillStyle(0xda70d6);
      g.fillRect(14, 8, 4, 16);
      g.fillRect(8, 12, 4, 12);
      g.fillRect(20, 10, 4, 14);
    });

    // Mythril
    this.createTexture('mythril', 32, 32, (g) => {
      g.fillStyle(0x505070);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0x7df9ff);
      g.fillRect(8, 12, 5, 5);
      g.fillRect(17, 14, 6, 6);
      g.fillStyle(0xafffff);
      g.fillRect(12, 18, 4, 4);
    });

    // Bush (berries)
    this.createTexture('bush', 32, 32, (g) => {
      g.fillStyle(0x228b22);
      g.fillRect(4, 8, 24, 20);
      g.fillStyle(0xff4444);
      g.fillRect(8, 12, 4, 4);
      g.fillRect(18, 14, 4, 4);
      g.fillRect(12, 20, 4, 4);
    });

    // Fiber plant
    this.createTexture('fiber', 32, 48, (g) => {
      g.fillStyle(0x90ee90);
      g.fillRect(14, 24, 4, 24);
      g.fillRect(10, 8, 12, 20);
      g.fillStyle(0x7ccd7c);
      g.fillRect(12, 12, 8, 12);
    });
  }

  generateTools() {
    // Pickaxe
    this.createTexture('pickaxe', 32, 32, (g) => {
      g.fillStyle(0x8b4513);
      g.fillRect(4, 24, 24, 4);
      g.fillStyle(0x808080);
      g.fillRect(2, 4, 12, 6);
      g.fillRect(18, 4, 12, 6);
      g.fillRect(12, 4, 8, 20);
    });

    // Axe
    this.createTexture('axe', 32, 32, (g) => {
      g.fillStyle(0x8b4513);
      g.fillRect(14, 8, 4, 22);
      g.fillStyle(0x808080);
      g.fillRect(4, 4, 14, 10);
      g.fillStyle(0xa0a0a0);
      g.fillRect(6, 6, 8, 6);
    });

    // Hammer
    this.createTexture('hammer', 32, 32, (g) => {
      g.fillStyle(0x8b4513);
      g.fillRect(14, 12, 4, 18);
      g.fillStyle(0x606060);
      g.fillRect(6, 2, 20, 12);
      g.fillStyle(0x808080);
      g.fillRect(8, 4, 16, 8);
    });

    // Sword
    this.createTexture('sword', 32, 32, (g) => {
      g.fillStyle(0xc0c0c0);
      g.fillRect(14, 2, 4, 20);
      g.fillStyle(0xe0e0e0);
      g.fillRect(15, 4, 2, 16);
      g.fillStyle(0x8b4513);
      g.fillRect(10, 22, 12, 4);
      g.fillRect(14, 26, 4, 4);
    });
  }

  generateBuildings() {
    // Workbench
    this.createTexture('workbench', 64, 48, (g) => {
      g.fillStyle(0x8b4513);
      g.fillRect(4, 16, 56, 28);
      g.fillStyle(0xa0522d);
      g.fillRect(8, 20, 48, 20);
      g.fillStyle(0x6b3510);
      g.fillRect(8, 44, 8, 4);
      g.fillRect(48, 44, 8, 4);
    });

    // Forge
    this.createTexture('forge', 64, 64, (g) => {
      g.fillStyle(0x808080);
      g.fillRect(8, 16, 48, 44);
      g.fillStyle(0xff4500);
      g.fillRect(16, 32, 32, 20);
      g.fillStyle(0xffff00);
      g.fillRect(20, 36, 24, 12);
      g.fillStyle(0x404040);
      g.fillRect(20, 4, 24, 16);
    });

    // Storage
    this.createTexture('storage', 48, 48, (g) => {
      g.fillStyle(0x8b4513);
      g.fillRect(4, 8, 40, 36);
      g.fillStyle(0xa0522d);
      g.fillRect(8, 12, 32, 28);
      g.fillStyle(0xffd700);
      g.fillRect(20, 24, 8, 8);
    });

    // House
    this.createTexture('house', 80, 80, (g) => {
      // Walls
      g.fillStyle(0xdeb887);
      g.fillRect(8, 32, 64, 44);
      // Roof
      g.fillStyle(0x8b0000);
      g.fillRect(4, 8, 72, 28);
      g.fillStyle(0xa00000);
      g.fillRect(8, 12, 64, 20);
      // Door
      g.fillStyle(0x654321);
      g.fillRect(32, 48, 16, 28);
      // Window
      g.fillStyle(0x87ceeb);
      g.fillRect(12, 44, 12, 12);
      g.fillRect(56, 44, 12, 12);
    });

    // Portal
    this.createTexture('portal', 64, 80, (g) => {
      g.fillStyle(0x4a4a6a);
      g.fillRect(8, 8, 48, 68);
      g.fillStyle(0x8a2be2);
      g.fillRect(16, 16, 32, 52);
      g.fillStyle(0xda70d6);
      g.fillRect(24, 24, 16, 36);
    });

    // Mine entrance
    this.createTexture('mine', 64, 64, (g) => {
      g.fillStyle(0x8b4513);
      g.fillRect(4, 4, 56, 8);
      g.fillRect(4, 4, 8, 56);
      g.fillRect(52, 4, 8, 56);
      g.fillStyle(0x202020);
      g.fillRect(12, 12, 40, 48);
    });
  }

  generateTiles() {
    // Grass
    this.createTexture('grass', 32, 32, (g) => {
      g.fillStyle(0x4a8f4a);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x5aa05a);
      g.fillRect(4, 4, 4, 4);
      g.fillRect(20, 8, 4, 4);
      g.fillRect(8, 20, 4, 4);
      g.fillRect(24, 24, 4, 4);
    });

    // Sand
    this.createTexture('sand', 32, 32, (g) => {
      g.fillStyle(0xc2b280);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0xd4c494);
      g.fillRect(8, 4, 4, 4);
      g.fillRect(20, 16, 4, 4);
      g.fillRect(4, 24, 4, 4);
    });

    // Water
    this.createTexture('water', 32, 32, (g) => {
      g.fillStyle(0x4a90d9);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x6ab0f9);
      g.fillRect(4, 8, 8, 4);
      g.fillRect(16, 20, 12, 4);
    });

    // Dirt
    this.createTexture('dirt', 32, 32, (g) => {
      g.fillStyle(0x8b6914);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x7b5904);
      g.fillRect(8, 8, 6, 6);
      g.fillRect(20, 18, 6, 6);
    });

    // Rock floor
    this.createTexture('rockfloor', 32, 32, (g) => {
      g.fillStyle(0x606060);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x505050);
      g.fillRect(0, 0, 16, 16);
      g.fillRect(16, 16, 16, 16);
    });
  }

  generateUI() {
    // Inventory slot
    this.createTexture('slot', 40, 40, (g) => {
      g.fillStyle(0x3a3a4a);
      g.fillRect(0, 0, 40, 40);
      g.fillStyle(0x2a2a3a);
      g.fillRect(2, 2, 36, 36);
      g.fillStyle(0x4a4a5a);
      g.fillRect(4, 4, 32, 32);
    });

    // Button
    this.createTexture('button', 120, 40, (g) => {
      g.fillStyle(0x4a6a8a);
      g.fillRect(0, 0, 120, 40);
      g.fillStyle(0x5a7a9a);
      g.fillRect(4, 4, 112, 32);
    });

    // Progress bar background
    this.createTexture('progressBg', 100, 16, (g) => {
      g.fillStyle(0x2a2a3a);
      g.fillRect(0, 0, 100, 16);
    });

    // Progress bar fill
    this.createTexture('progressFill', 96, 12, (g) => {
      g.fillStyle(0x4a9a4a);
      g.fillRect(0, 0, 96, 12);
    });
  }

  generateEnemies() {
    // Slime
    this.createTexture('slime', 32, 32, (g) => {
      g.fillStyle(0x44cc44);
      g.fillRect(4, 12, 24, 16);
      g.fillStyle(0x66ee66);
      g.fillRect(8, 16, 8, 8);
      // Eyes
      g.fillStyle(0x000000);
      g.fillRect(10, 16, 4, 4);
      g.fillRect(18, 16, 4, 4);
    });

    // Goblin
    this.createTexture('goblin', 32, 32, (g) => {
      // Body
      g.fillStyle(0x4a8a4a);
      g.fillRect(10, 12, 12, 14);
      // Head
      g.fillStyle(0x5a9a5a);
      g.fillRect(8, 2, 16, 12);
      // Eyes
      g.fillStyle(0xff0000);
      g.fillRect(10, 6, 4, 4);
      g.fillRect(18, 6, 4, 4);
      // Legs
      g.fillStyle(0x3a6a3a);
      g.fillRect(10, 26, 4, 6);
      g.fillRect(18, 26, 4, 6);
    });

    // Golem
    this.createTexture('golem', 40, 40, (g) => {
      // Body
      g.fillStyle(0x606060);
      g.fillRect(8, 10, 24, 24);
      // Head
      g.fillStyle(0x707070);
      g.fillRect(12, 2, 16, 12);
      // Eyes
      g.fillStyle(0xff6600);
      g.fillRect(14, 6, 4, 4);
      g.fillRect(22, 6, 4, 4);
      // Arms
      g.fillStyle(0x505050);
      g.fillRect(2, 14, 6, 16);
      g.fillRect(32, 14, 6, 16);
    });

    // Crystal Beast
    this.createTexture('crystalBeast', 40, 40, (g) => {
      // Body
      g.fillStyle(0x8844aa);
      g.fillRect(8, 12, 24, 20);
      // Crystal spikes
      g.fillStyle(0xcc66ff);
      g.fillRect(12, 4, 6, 12);
      g.fillRect(22, 6, 6, 10);
      g.fillRect(4, 16, 6, 8);
      g.fillRect(30, 18, 6, 8);
      // Eyes
      g.fillStyle(0xffffff);
      g.fillRect(12, 18, 4, 4);
      g.fillRect(24, 18, 4, 4);
    });
  }

  generateBars() {
    // Health bar background
    this.createTexture('healthBarBg', 32, 6, (g) => {
      g.fillStyle(0x333333);
      g.fillRect(0, 0, 32, 6);
    });

    // Health bar fill
    this.createTexture('healthBarFill', 30, 4, (g) => {
      g.fillStyle(0xff4444);
      g.fillRect(0, 0, 30, 4);
    });

    // Energy bar fill
    this.createTexture('energyBarFill', 30, 4, (g) => {
      g.fillStyle(0x44aaff);
      g.fillRect(0, 0, 30, 4);
    });
  }
}
