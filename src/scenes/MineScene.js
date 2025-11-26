import { MessageTypes } from '../network/MessageTypes.js';
import { RESOURCES, TOOLS, ENEMIES } from '../data/GameData.js';

// Mine rock types with their drops
const MINE_ROCKS = {
  stoneRock: { name: 'Stone', color: 0x888888, health: 3, drops: { stone: 2 }, tier: 1 },
  coalRock: { name: 'Coal', color: 0x333333, health: 4, drops: { coal: 2 }, tier: 1 },
  copperRock: { name: 'Copper', color: 0xb87333, health: 5, drops: { copper: 2 }, tier: 2 },
  ironRock: { name: 'Iron', color: 0x8b8b8b, health: 6, drops: { iron: 2 }, tier: 3 },
  goldRock: { name: 'Gold', color: 0xffd700, health: 8, drops: { gold: 2 }, tier: 4 },
  crystalRock: { name: 'Crystal', color: 0x88ffff, health: 10, drops: { crystal: 2 }, tier: 4 },
  diamondRock: { name: 'Diamond', color: 0x00ffff, health: 12, drops: { diamond: 1 }, tier: 5 },
  mythrilRock: { name: 'Mythril', color: 0xff88ff, health: 15, drops: { mythril: 1 }, tier: 6 }
};

// Mine enemy types
const MINE_ENEMIES = ['slime', 'goblin', 'golem', 'crystalBeast'];

export class MineScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MineScene' });
  }

  init(data) {
    this.mineId = data.mineId || 'default';
    this.isMultiplayer = data.isMultiplayer || false;
    this.isHost = data.isHost || false;
    this.networkManager = data.networkManager || null;
    this.playerNumber = data.playerNumber || 1;
    this.mineState = data.mineState || null; // Received from host for clients
  }

  create() {
    // Mine dimensions
    this.mineWidth = 1600;
    this.mineHeight = 1200;
    this.tileSize = 32;
    
    // Set physics world bounds to match mine size
    this.physics.world.setBounds(0, 0, this.mineWidth, this.mineHeight);
    
    // Get player data from registry
    this.currentTool = this.registry.get('currentTool') || 'hands';
    this.tools = this.registry.get('tools') || ['hands'];
    
    // Create dark background
    this.add.rectangle(0, 0, this.mineWidth, this.mineHeight, 0x1a1a2a)
      .setOrigin(0, 0);
    
    // Create cave walls (border)
    this.createCaveWalls();
    
    // Physics groups
    this.rocks = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.remotePlayers = new Map();
    
    // Set refresh time BEFORE generating mine (it uses this for seeding)
    this.refreshTime = this.registry.get('mineRefreshTime');
    if (!this.refreshTime || Date.now() > this.refreshTime) {
      this.refreshTime = Date.now() + 300000; // 5 minutes from now
      this.registry.set('mineRefreshTime', this.refreshTime);
    }
    
    // Create player
    this.createPlayer();
    
    // Generate or apply mine content
    if (this.isMultiplayer && !this.isHost && this.mineState) {
      // Client: Apply state from host
      this.applyMineState(this.mineState);
    } else {
      // Host or single player: Generate mine
      this.generateMine();
    }
    
    // Create lighting effect
    this.createLighting();
    
    // Setup camera
    this.cameras.main.setBounds(0, 0, this.mineWidth, this.mineHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.2);
    
    // Exit state - disable for 1 second to prevent accidental immediate exit
    this.isExiting = false;
    this.canExit = false;
    this.time.delayedCall(1000, () => { this.canExit = true; });
    
    // Exit zone (top center, below the wall) - must be created BEFORE setupCollisions
    this.exitZone = this.add.rectangle(this.mineWidth / 2, 80, 120, 80, 0x44ff44, 0.3)
      .setOrigin(0.5);
    this.physics.add.existing(this.exitZone, true);
    
    const exitText = this.add.text(this.mineWidth / 2, 60, '⬆ EXIT ⬆', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#44ff44'
    }).setOrigin(0.5).setDepth(200);
    
    // Setup controls
    this.setupControls();
    
    // Setup collisions (after exitZone is created)
    this.setupCollisions();
    
    // Setup network handlers
    if (this.isMultiplayer) {
      this.setupNetworkHandlers();
      
      // Host broadcasts initial state
      if (this.isHost) {
        this.broadcastMineState();
      }
    }
    
    // Mining state
    this.isMining = false;
    this.miningTarget = null;
    this.miningProgress = 0;
    
    // Create mining progress bar (same as overworld)
    this.miningBarBg = this.add.rectangle(0, 0, 40, 6, 0x333333).setVisible(false).setDepth(300);
    this.miningBarFill = this.add.rectangle(0, 0, 36, 4, 0x44ff44).setVisible(false).setDepth(301);
    this.miningBarFill.setOrigin(0, 0.5);
    
    // Attack cooldown
    this.lastAttackTime = 0;
    this.attackCooldownMax = 400;
    this.attackCooldown = 0; // Current cooldown remaining (for animation)
    
    // Refresh timer display
    this.refreshText = this.add.text(this.mineWidth / 2, 80, '', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffaa00'
    }).setOrigin(0.5).setScrollFactor(0);
    
    // Position update timer for multiplayer
    if (this.isMultiplayer) {
      this.time.addEvent({
        delay: 50,
        callback: this.sendPositionUpdate,
        callbackScope: this,
        loop: true
      });
    }
    
    // Enemy AI update
    this.time.addEvent({
      delay: 100,
      callback: this.updateEnemyAI,
      callbackScope: this,
      loop: true
    });
  }

  createCaveWalls() {
    const wallThickness = 64;
    const wallColor = 0x2a2a3a;
    
    // Top wall
    this.add.rectangle(this.mineWidth / 2, wallThickness / 2, this.mineWidth, wallThickness, wallColor);
    // Bottom wall
    this.add.rectangle(this.mineWidth / 2, this.mineHeight - wallThickness / 2, this.mineWidth, wallThickness, wallColor);
    // Left wall
    this.add.rectangle(wallThickness / 2, this.mineHeight / 2, wallThickness, this.mineHeight, wallColor);
    // Right wall
    this.add.rectangle(this.mineWidth - wallThickness / 2, this.mineHeight / 2, wallThickness, this.mineHeight, wallColor);
    
    // Add wall colliders
    this.walls = this.physics.add.staticGroup();
    this.walls.add(this.add.rectangle(this.mineWidth / 2, 16, this.mineWidth, 32, wallColor, 0).setOrigin(0.5));
    this.walls.add(this.add.rectangle(this.mineWidth / 2, this.mineHeight - 16, this.mineWidth, 32, wallColor, 0).setOrigin(0.5));
    this.walls.add(this.add.rectangle(16, this.mineHeight / 2, 32, this.mineHeight, wallColor, 0).setOrigin(0.5));
    this.walls.add(this.add.rectangle(this.mineWidth - 16, this.mineHeight / 2, 32, this.mineHeight, wallColor, 0).setOrigin(0.5));
  }

  createPlayer() {
    // Spawn away from exit zone (exit is at y=40-120)
    const spawnX = this.mineWidth / 2 + (this.playerNumber - 1) * 40 - 40;
    const spawnY = 200;
    
    // Use the same player sprite as overworld
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(100);
    this.player.body.setSize(20, 24);
    
    // Animation state (same as GameScene)
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.currentPlayerTexture = 'player';
    
    // Player label
    this.playerLabel = this.add.text(spawnX, spawnY - 25, `P${this.playerNumber}`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(101);
  }

  generateMine() {
    // Seed based on mine refresh time for consistency
    const seed = Math.floor(this.refreshTime / 1000);
    const rng = this.createSeededRandom(seed);
    
    // Generate rocks
    const rockCount = 40 + Math.floor(rng() * 20);
    const padding = 100;
    
    for (let i = 0; i < rockCount; i++) {
      const x = padding + rng() * (this.mineWidth - padding * 2);
      const y = 200 + rng() * (this.mineHeight - 300);
      
      // Determine rock type based on depth (y position)
      const depthRatio = (y - 200) / (this.mineHeight - 400);
      const rockType = this.getRockTypeForDepth(depthRatio, rng);
      
      this.createRock(x, y, rockType, `rock_${i}`);
    }
    
    // Generate enemies (only host spawns in multiplayer) - MORE enemies for danger!
    if (!this.isMultiplayer || this.isHost) {
      const enemyCount = 20 + Math.floor(rng() * 15); // 20-35 enemies
      
      for (let i = 0; i < enemyCount; i++) {
        const x = padding + rng() * (this.mineWidth - padding * 2);
        const y = 250 + rng() * (this.mineHeight - 350);
        
        const enemyType = MINE_ENEMIES[Math.floor(rng() * MINE_ENEMIES.length)];
        this.createEnemy(x, y, enemyType, `enemy_${i}`);
      }
    }
  }

  createSeededRandom(seed) {
    let s = seed;
    return function() {
      s = Math.sin(s * 9999) * 10000;
      return s - Math.floor(s);
    };
  }

  getRockTypeForDepth(depthRatio, rng) {
    const roll = rng();
    
    if (depthRatio < 0.3) {
      // Upper area: basic rocks
      if (roll < 0.5) return 'stoneRock';
      if (roll < 0.8) return 'coalRock';
      return 'copperRock';
    } else if (depthRatio < 0.6) {
      // Middle area: mid-tier
      if (roll < 0.3) return 'coalRock';
      if (roll < 0.5) return 'copperRock';
      if (roll < 0.8) return 'ironRock';
      return 'goldRock';
    } else {
      // Deep area: rare rocks
      if (roll < 0.2) return 'ironRock';
      if (roll < 0.4) return 'goldRock';
      if (roll < 0.6) return 'crystalRock';
      if (roll < 0.85) return 'diamondRock';
      return 'mythrilRock';
    }
  }

  createRock(x, y, rockType, id) {
    const rockData = MINE_ROCKS[rockType];
    if (!rockData) return null;
    
    // Map rock types to resource sprites
    const spriteMap = {
      stoneRock: 'stone',
      coalRock: 'coal',
      copperRock: 'copper',
      ironRock: 'iron',
      goldRock: 'gold',
      crystalRock: 'crystal',
      diamondRock: 'diamond',
      mythrilRock: 'mythril'
    };
    
    const spriteKey = spriteMap[rockType] || 'stone';
    const rock = this.physics.add.sprite(x, y, spriteKey);
    rock.setDepth(10);
    rock.setScale(1.5); // Make rocks bigger in mines
    
    rock.id = id;
    rock.rockType = rockType;
    rock.health = rockData.health;
    rock.maxHealth = rockData.health;
    rock.drops = rockData.drops;
    rock.tier = rockData.tier;
    
    // Add sparkle effect for rare rocks
    if (rockData.tier >= 4) {
      rock.sparkle = this.add.circle(x, y, 28, rockData.color, 0.4);
      rock.sparkle.setDepth(9);
      this.tweens.add({
        targets: rock.sparkle,
        alpha: 0.15,
        scale: 1.2,
        duration: 800,
        yoyo: true,
        repeat: -1
      });
    }
    
    this.rocks.add(rock);
    return rock;
  }

  createEnemy(x, y, enemyType, id) {
    const enemyData = ENEMIES[enemyType];
    if (!enemyData) return null;
    
    // Use the same enemy sprites as overworld
    const enemy = this.physics.add.sprite(x, y, enemyType);
    enemy.setDepth(80);
    
    enemy.id = id;
    enemy.enemyType = enemyType;
    // Mine enemies have 3x health - they're tougher underground!
    enemy.health = enemyData.health * 3;
    enemy.maxHealth = enemyData.health * 3;
    enemy.damage = enemyData.damage * 1.5; // 50% more damage
    enemy.speed = enemyData.speed * 0.8; // Slightly slower in mines
    enemy.lastAttackTime = 0;
    enemy.attackCooldown = 800; // Attack faster
    enemy.aggroRange = 250; // Much larger aggro range - they can see in the dark!
    enemy.isAggro = false;
    
    // Health bar
    enemy.healthBarBg = this.add.rectangle(x, y - 20, 30, 5, 0x333333).setDepth(82);
    enemy.healthBarFill = this.add.rectangle(x, y - 20, 28, 3, 0xff4444).setDepth(83);
    
    this.enemies.add(enemy);
    
    // Broadcast spawn in multiplayer
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.MINE_ENEMY_SPAWN, {
        id: id,
        x: x,
        y: y,
        type: enemyType
      });
    }
    
    return enemy;
  }

  createLighting() {
    // Simple dark overlay - just 10% darker
    this.darkness = this.add.rectangle(
      this.mineWidth / 2, 
      this.mineHeight / 2, 
      this.mineWidth, 
      this.mineHeight, 
      0x000000, 
      0.1  // 10% opacity
    );
    this.darkness.setDepth(5); // Below UI elements but above background
    this.darkness.setScrollFactor(0);
  }

  updateLighting() {
    // No dynamic lighting updates needed - just a static dark overlay
  }

  setupControls() {
    const settings = JSON.parse(localStorage.getItem('forger2_settings') || '{}');
    const controls = settings.controls || {
      moveUp: 'W', moveDown: 'S', moveLeft: 'A', moveRight: 'D',
      harvest: 'SPACE', interact: 'E', attack: 'F'
    };
    
    this.keys = {
      up: this.input.keyboard.addKey(controls.moveUp),
      down: this.input.keyboard.addKey(controls.moveDown),
      left: this.input.keyboard.addKey(controls.moveLeft),
      right: this.input.keyboard.addKey(controls.moveRight),
      harvest: this.input.keyboard.addKey(controls.harvest),
      interact: this.input.keyboard.addKey(controls.interact),
      attack: this.input.keyboard.addKey(controls.attack)
    };
    
    // ESC to exit
    this.input.keyboard.on('keydown-ESC', () => this.exitMine());
  }

  setupCollisions() {
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.rocks);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.rocks);
    
    // Player-enemy collision
    this.physics.add.overlap(this.player, this.enemies, this.handleEnemyCollision, null, this);
    
    // Exit zone
    this.physics.add.overlap(this.player, this.exitZone, this.handleExitZone, null, this);
  }

  setupNetworkHandlers() {
    if (!this.networkManager) return;
    
    this.networkManager.onMessage = (type, data, peerId) => {
      switch (type) {
        case MessageTypes.MINE_PLAYER_POSITION:
          this.handleRemotePlayerPosition(data, peerId);
          break;
        case MessageTypes.MINE_RESOURCE_HARVEST:
          this.handleRemoteHarvest(data);
          break;
        case MessageTypes.MINE_ENEMY_SPAWN:
          if (!this.isHost) this.handleRemoteEnemySpawn(data);
          break;
        case MessageTypes.MINE_ENEMY_DEATH:
          this.handleRemoteEnemyDeath(data);
          break;
        case MessageTypes.MINE_STATE:
          if (!this.isHost) this.applyMineState(data);
          break;
        case MessageTypes.MINE_EXIT:
          this.handleRemotePlayerExit(data, peerId);
          break;
      }
    };
  }

  update(time, delta) {
    if (!this.player || !this.player.body) return;
    
    // Decrement attack cooldown for animation
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
      if (this.attackCooldown < 0) this.attackCooldown = 0;
    }
    
    // Movement
    const speed = 160;
    let vx = 0, vy = 0;
    
    if (this.keys.up.isDown) vy = -speed;
    if (this.keys.down.isDown) vy = speed;
    if (this.keys.left.isDown) vx = -speed;
    if (this.keys.right.isDown) vx = speed;
    
    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }
    
    this.player.setVelocity(vx, vy);
    
    // Update player animation (same as GameScene)
    this.updatePlayerAnimation(delta);
    
    // Update player label position
    if (this.playerLabel) {
      this.playerLabel.setPosition(this.player.x, this.player.y - 25);
    }
    
    // Mining
    if (this.keys.harvest.isDown) {
      this.tryMine();
    } else {
      this.isMining = false;
      this.miningTarget = null;
    }
    
    // Attack
    if (this.keys.attack.isDown) {
      this.tryAttack(time);
    }
    
    // Update enemy health bars
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.healthBarBg && enemy.healthBarFill) {
        enemy.healthBarBg.setPosition(enemy.x, enemy.y - 20);
        enemy.healthBarFill.setPosition(enemy.x, enemy.y - 20);
        enemy.healthBarFill.setScale(enemy.health / enemy.maxHealth, 1);
      }
    });
    
    // Update refresh timer
    const remaining = Math.max(0, this.refreshTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    this.refreshText.setText(`Refresh in: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    this.refreshText.setPosition(this.cameras.main.scrollX + this.cameras.main.width / 2, 
                                  this.cameras.main.scrollY + 20);
  }

  tryMine() {
    const mineRange = 60;
    
    // If not currently mining, find nearest rock
    if (!this.isMining) {
      let nearestRock = null;
      let nearestDist = mineRange;
      
      this.rocks.getChildren().forEach(rock => {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, rock.x, rock.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestRock = rock;
        }
      });
      
      if (nearestRock) {
        this.startMining(nearestRock);
      }
      return;
    }
    
    // Check if still in range
    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.miningTarget.x, this.miningTarget.y
    );
    
    if (dist > mineRange) {
      this.stopMining();
      return;
    }
    
    // Get tool power and type bonus (same as overworld)
    const currentTool = this.registry.get('currentTool') || 'hands';
    const tool = TOOLS[currentTool] || TOOLS.hands;
    let toolPower = tool.power || 1;
    
    // Pickaxe bonus for mining rocks
    if (tool.type === 'pickaxe') {
      toolPower *= 1.5;
    }
    
    // Progress mining (harvestTime based on rock tier)
    const harvestTime = 500 + (this.miningTarget.tier * 200); // Higher tier = longer
    this.miningProgress += 16.67 * (toolPower / 2); // ~60fps delta
    
    // Update progress bar
    const progress = Math.min(this.miningProgress / harvestTime, 1);
    this.updateMiningBar(progress);
    
    if (this.miningProgress >= harvestTime) {
      this.harvestRock(this.miningTarget);
    }
  }
  
  startMining(rock) {
    this.isMining = true;
    this.miningTarget = rock;
    this.miningProgress = 0;
    
    // Show progress bar
    this.miningBarBg.setVisible(true);
    this.miningBarFill.setVisible(true);
    
    // Highlight rock
    rock.setTint(0xffff88);
  }
  
  stopMining() {
    if (this.miningTarget) {
      this.miningTarget.clearTint();
      this.miningTarget.setScale(1.5); // Reset scale
    }
    
    this.isMining = false;
    this.miningTarget = null;
    this.miningProgress = 0;
    
    this.miningBarBg.setVisible(false);
    this.miningBarFill.setVisible(false);
  }
  
  updateMiningBar(progress) {
    const x = this.miningTarget.x;
    const y = this.miningTarget.y - 35;
    
    this.miningBarBg.setPosition(x, y);
    this.miningBarFill.setPosition(x - 18, y);
    this.miningBarFill.setScale(progress, 1);
  }

  harvestRock(rock) {
    // Give drops
    const inventory = this.registry.get('inventory');
    Object.entries(rock.drops).forEach(([resource, amount]) => {
      inventory[resource] = (inventory[resource] || 0) + amount;
      this.showFloatingText(rock.x, rock.y, `+${amount} ${resource}`);
    });
    this.registry.set('inventory', inventory);
    
    // Add XP
    const xp = this.registry.get('xp') || 0;
    this.registry.set('xp', xp + rock.tier * 5);
    
    // Destroy rock and its components
    if (rock.sparkle) rock.sparkle.destroy();
    if (rock.label) rock.label.destroy();
    rock.destroy();
    
    // Broadcast in multiplayer
    if (this.isMultiplayer) {
      this.networkManager.broadcast(MessageTypes.MINE_RESOURCE_HARVEST, {
        rockId: rock.id
      });
    }
    
    // Reset mining state
    this.isMining = false;
    this.miningTarget = null;
    this.miningProgress = 0;
    this.miningBarBg.setVisible(false);
    this.miningBarFill.setVisible(false);
  }

  tryAttack(time) {
    if (time - this.lastAttackTime < this.attackCooldownMax) return;
    this.lastAttackTime = time;
    this.attackCooldown = this.attackCooldownMax; // Set cooldown for animation
    
    const currentTool = this.registry.get('currentTool') || 'hands';
    const tool = TOOLS[currentTool] || TOOLS.hands;
    const range = tool.attack?.range || 40;
    const damage = tool.power || 1;
    
    // Get attack direction
    const attackDir = this.getAttackDirection();
    
    // Find enemies in range
    this.enemies.getChildren().forEach(enemy => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < range) {
        this.damageEnemy(enemy, damage);
      }
    });
    
    // Show attack effect (same as overworld - no white circle)
    this.showPunchEffect(this.player.x, this.player.y, attackDir);
  }
  
  getAttackDirection() {
    const vx = this.player.body.velocity.x;
    const vy = this.player.body.velocity.y;
    
    if (Math.abs(vx) > 10 || Math.abs(vy) > 10) {
      if (Math.abs(vx) > Math.abs(vy)) {
        return { x: vx > 0 ? 1 : -1, y: 0 };
      } else {
        return { x: 0, y: vy > 0 ? 1 : -1 };
      }
    }
    
    return { x: this.player.flipX ? -1 : 1, y: 0 };
  }
  
  showPunchEffect(px, py, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    
    const graphics = this.add.graphics();
    graphics.setDepth(2500);
    
    const impactX = px + dirX * 22;
    const impactY = py + dirY * 22;
    
    // Impact lines only (same as overworld)
    graphics.lineStyle(2, 0xffffaa, 0.7);
    for (let i = 0; i < 3; i++) {
      const angle = Math.atan2(dirY, dirX) + (i - 1) * 0.5;
      graphics.beginPath();
      graphics.moveTo(impactX + Math.cos(angle) * 6, impactY + Math.sin(angle) * 6);
      graphics.lineTo(impactX + Math.cos(angle) * 12, impactY + Math.sin(angle) * 12);
      graphics.strokePath();
    }
    
    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 80,
      onComplete: () => graphics.destroy()
    });
  }

  damageEnemy(enemy, damage) {
    enemy.health -= damage;
    
    // Knockback
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    enemy.setVelocity(Math.cos(angle) * 200, Math.sin(angle) * 200);
    
    // Flash red
    enemy.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      if (enemy.active) enemy.clearTint();
    });
    
    if (enemy.health <= 0) {
      this.killEnemy(enemy);
    }
  }

  killEnemy(enemy) {
    // Drop loot
    const inventory = this.registry.get('inventory');
    const drops = { stone: 1, coal: 1 }; // Basic drops
    Object.entries(drops).forEach(([resource, amount]) => {
      inventory[resource] = (inventory[resource] || 0) + amount;
    });
    this.registry.set('inventory', inventory);
    
    // XP
    const xp = this.registry.get('xp') || 0;
    this.registry.set('xp', xp + 10);
    
    this.showFloatingText(enemy.x, enemy.y, '+10 XP');
    
    // Cleanup
    if (enemy.healthBarBg) enemy.healthBarBg.destroy();
    if (enemy.healthBarFill) enemy.healthBarFill.destroy();
    enemy.destroy();
    
    // Broadcast
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.MINE_ENEMY_DEATH, {
        enemyId: enemy.id
      });
    }
  }

  updateEnemyAI() {
    if (!this.isHost && this.isMultiplayer) return; // Only host controls AI
    
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      
      // Find nearest player
      let nearestPlayer = this.player;
      let nearestDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      
      this.remotePlayers.forEach(rp => {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, rp.x, rp.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayer = rp;
        }
      });
      
      // Aggro check
      if (nearestDist < enemy.aggroRange) {
        enemy.isAggro = true;
        
        // Move towards player
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, nearestPlayer.x, nearestPlayer.y);
        enemy.setVelocity(Math.cos(angle) * enemy.speed, Math.sin(angle) * enemy.speed);
      } else {
        enemy.isAggro = false;
        
        // Wander
        if (Math.random() < 0.02) {
          const wanderAngle = Math.random() * Math.PI * 2;
          enemy.setVelocity(Math.cos(wanderAngle) * enemy.speed * 0.3, 
                           Math.sin(wanderAngle) * enemy.speed * 0.3);
        }
      }
    });
  }

  handleEnemyCollision(player, enemy) {
    const now = Date.now();
    if (now - enemy.lastAttackTime < enemy.attackCooldown) return;
    enemy.lastAttackTime = now;
    
    // Damage player
    const health = this.registry.get('health') || 100;
    const newHealth = Math.max(0, health - enemy.damage);
    this.registry.set('health', newHealth);
    
    // Knockback player
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    player.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
    
    // Flash
    player.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      if (player.active) player.clearTint();
    });
    
    this.showFloatingText(player.x, player.y, `-${enemy.damage}`);
    
    if (newHealth <= 0) {
      this.handlePlayerDeath();
    }
  }

  handlePlayerDeath() {
    this.showFloatingText(this.player.x, this.player.y, 'You died!');
    this.time.delayedCall(1500, () => this.exitMine());
  }

  handleExitZone() {
    // Exit when touching exit zone (after initial delay)
    if (this.canExit && !this.isExiting) {
      this.exitMine();
    }
  }

  exitMine() {
    // Prevent multiple calls
    if (this.isExiting) return;
    this.isExiting = true;
    
    // Broadcast exit in multiplayer
    if (this.isMultiplayer) {
      this.networkManager.broadcast(MessageTypes.MINE_EXIT, {
        playerNumber: this.playerNumber
      });
    }
    
    // Return to game scene
    this.scene.stop('MineScene');
    this.scene.resume('GameScene');
    this.scene.resume('UIScene');
    
    // Emit event to GameScene
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.emit('mineExited');
    }
  }

  // Network handlers
  sendPositionUpdate() {
    if (!this.networkManager || !this.player) return;
    
    this.networkManager.broadcast(MessageTypes.MINE_PLAYER_POSITION, {
      playerNumber: this.playerNumber,
      x: this.player.x,
      y: this.player.y
    });
  }

  handleRemotePlayerPosition(data, peerId) {
    let remotePlayer = this.remotePlayers.get(peerId);
    
    if (!remotePlayer) {
      // Create remote player using same sprite as overworld
      remotePlayer = this.add.sprite(data.x, data.y, 'player');
      remotePlayer.setTint(0x88ff88); // Tint to differentiate
      remotePlayer.setDepth(99);
      remotePlayer.playerNumber = data.playerNumber;
      
      // Label
      remotePlayer.label = this.add.text(data.x, data.y - 25, `P${data.playerNumber}`, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#88ff88'
      }).setOrigin(0.5).setDepth(100);
      
      this.remotePlayers.set(peerId, remotePlayer);
    }
    
    // Smooth interpolation
    this.tweens.add({
      targets: remotePlayer,
      x: data.x,
      y: data.y,
      duration: 50,
      ease: 'Linear',
      onUpdate: () => {
        if (remotePlayer.label) {
          remotePlayer.label.setPosition(remotePlayer.x, remotePlayer.y - 25);
        }
      }
    });
  }

  handleRemoteHarvest(data) {
    const rock = this.rocks.getChildren().find(r => r.id === data.rockId);
    if (rock) {
      if (rock.sparkle) rock.sparkle.destroy();
      if (rock.label) rock.label.destroy();
      rock.destroy();
    }
  }

  handleRemoteEnemySpawn(data) {
    this.createEnemy(data.x, data.y, data.type, data.id);
  }

  handleRemoteEnemyDeath(data) {
    const enemy = this.enemies.getChildren().find(e => e.id === data.enemyId);
    if (enemy) {
      if (enemy.healthBarBg) enemy.healthBarBg.destroy();
      if (enemy.healthBarFill) enemy.healthBarFill.destroy();
      enemy.destroy();
    }
  }

  handleRemotePlayerExit(data, peerId) {
    const remotePlayer = this.remotePlayers.get(peerId);
    if (remotePlayer) {
      if (remotePlayer.label) remotePlayer.label.destroy();
      remotePlayer.destroy();
      this.remotePlayers.delete(peerId);
    }
  }

  broadcastMineState() {
    const rocksData = this.rocks.getChildren().map(rock => ({
      id: rock.id,
      x: rock.x,
      y: rock.y,
      type: rock.rockType,
      health: rock.health
    }));
    
    const enemiesData = this.enemies.getChildren().map(enemy => ({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      type: enemy.enemyType,
      health: enemy.health
    }));
    
    this.networkManager.sendToAll(MessageTypes.MINE_STATE, {
      rocks: rocksData,
      enemies: enemiesData,
      refreshTime: this.refreshTime
    });
  }

  applyMineState(state) {
    // Clear existing
    this.rocks.clear(true, true);
    this.enemies.clear(true, true);
    
    // Apply rocks
    state.rocks.forEach(rockData => {
      const rock = this.createRock(rockData.x, rockData.y, rockData.type, rockData.id);
      if (rock) rock.health = rockData.health;
    });
    
    // Apply enemies
    state.enemies.forEach(enemyData => {
      const enemy = this.createEnemy(enemyData.x, enemyData.y, enemyData.type, enemyData.id);
      if (enemy) enemy.health = enemyData.health;
    });
    
    this.refreshTime = state.refreshTime;
  }

  showFloatingText(x, y, text) {
    const floatText = this.add.text(x, y, text, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(300);
    
    this.tweens.add({
      targets: floatText,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      onComplete: () => floatText.destroy()
    });
  }

  // Player animation system (same as GameScene)
  updatePlayerAnimation(delta) {
    let targetTexture = 'player';
    
    // Get current tool type from registry (always up to date)
    const currentTool = this.registry.get('currentTool') || 'hands';
    const toolData = TOOLS[currentTool];
    const toolType = toolData?.type || 'hands';
    
    if (this.isMining) {
      // Mining animation based on tool type
      this.walkTimer += delta;
      if (this.walkTimer > 200) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 2;
      }
      
      if (toolType === 'pickaxe') {
        targetTexture = this.walkFrame === 0 ? 'player_swing_pickaxe1' : 'player_swing_pickaxe2';
      } else if (toolType === 'axe') {
        targetTexture = this.walkFrame === 0 ? 'player_swing_axe1' : 'player_swing_axe2';
      } else {
        targetTexture = this.walkFrame === 0 ? 'player_mine' : 'player';
      }
    } else if (this.attackCooldown > 0) {
      // Attack animation based on weapon type
      const attackProgress = 1 - (this.attackCooldown / this.attackCooldownMax);
      
      if (toolType === 'sword') {
        if (attackProgress < 0.2) {
          targetTexture = 'player_swing_sword1';
        } else if (attackProgress < 0.5) {
          targetTexture = 'player_swing_sword2';
        } else {
          targetTexture = 'player_swing_sword3';
        }
      } else if (toolType === 'axe') {
        targetTexture = attackProgress < 0.5 ? 'player_swing_axe1' : 'player_swing_axe2';
      } else if (toolType === 'pickaxe') {
        targetTexture = attackProgress < 0.5 ? 'player_swing_pickaxe1' : 'player_swing_pickaxe2';
      } else {
        targetTexture = 'player_attack';
      }
    } else if (this.player.body.velocity.length() > 10) {
      // Walking animation
      this.walkTimer += delta;
      if (this.walkTimer > 150) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 3;
      }
      
      if (this.walkFrame === 0) {
        targetTexture = this.getHoldTexture(toolType);
      } else if (this.walkFrame === 1) {
        targetTexture = 'player_walk1';
      } else {
        targetTexture = 'player_walk2';
      }
    } else {
      // Idle - show weapon held
      targetTexture = this.getHoldTexture(toolType);
      this.walkFrame = 0;
      this.walkTimer = 0;
    }
    
    if (this.currentPlayerTexture !== targetTexture) {
      this.currentPlayerTexture = targetTexture;
      this.player.setTexture(targetTexture);
    }
    
    // Flip based on movement direction
    if (this.player.body.velocity.x < -10) {
      this.player.setFlipX(true);
    } else if (this.player.body.velocity.x > 10) {
      this.player.setFlipX(false);
    }
  }

  getHoldTexture(toolType) {
    switch (toolType) {
      case 'sword': return 'player_hold_sword';
      case 'axe': return 'player_hold_axe';
      case 'pickaxe': return 'player_hold_pickaxe';
      default: return 'player';
    }
  }
}
