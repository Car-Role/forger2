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
    
    // Setup controls
    this.setupControls();
    
    // Setup collisions
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
    
    // Attack cooldown
    this.lastAttackTime = 0;
    this.attackCooldown = 400;
    
    // Exit zone (top center)
    this.exitZone = this.add.rectangle(this.mineWidth / 2, 40, 100, 60, 0x44ff44, 0.3)
      .setOrigin(0.5);
    this.physics.add.existing(this.exitZone, true);
    
    const exitText = this.add.text(this.mineWidth / 2, 40, '⬆ EXIT', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#44ff44'
    }).setOrigin(0.5);
    
    // Refresh timer display
    this.refreshTime = this.registry.get('mineRefreshTime') || Date.now() + 300000; // 5 minutes
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
    // Spawn near exit
    const spawnX = this.mineWidth / 2 + (this.playerNumber - 1) * 40 - 40;
    const spawnY = 120;
    
    this.player = this.physics.add.sprite(spawnX, spawnY, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(100);
    this.player.body.setSize(20, 24);
    
    // Player light radius indicator
    this.playerLight = this.add.circle(spawnX, spawnY, 120, 0xffff88, 0.1);
    this.playerLight.setDepth(50);
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
    
    // Generate enemies (only host spawns in multiplayer)
    if (!this.isMultiplayer || this.isHost) {
      const enemyCount = 8 + Math.floor(rng() * 6);
      
      for (let i = 0; i < enemyCount; i++) {
        const x = padding + rng() * (this.mineWidth - padding * 2);
        const y = 300 + rng() * (this.mineHeight - 400);
        
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
    
    const rock = this.add.rectangle(x, y, 40, 40, rockData.color);
    rock.setStrokeStyle(2, 0x000000);
    this.physics.add.existing(rock, true);
    
    rock.id = id;
    rock.rockType = rockType;
    rock.health = rockData.health;
    rock.maxHealth = rockData.health;
    rock.drops = rockData.drops;
    rock.tier = rockData.tier;
    
    // Add sparkle effect for rare rocks
    if (rockData.tier >= 4) {
      rock.sparkle = this.add.circle(x, y, 25, rockData.color, 0.3);
      this.tweens.add({
        targets: rock.sparkle,
        alpha: 0.1,
        duration: 1000,
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
    
    const enemy = this.physics.add.sprite(x, y, enemyType);
    enemy.setTint(enemyData.color || 0xff0000);
    
    enemy.id = id;
    enemy.enemyType = enemyType;
    enemy.health = enemyData.health;
    enemy.maxHealth = enemyData.health;
    enemy.damage = enemyData.damage;
    enemy.speed = enemyData.speed * 0.7; // Slower in mines
    enemy.lastAttackTime = 0;
    enemy.attackCooldown = 1000;
    enemy.aggroRange = 150;
    enemy.isAggro = false;
    
    // Health bar
    enemy.healthBarBg = this.add.rectangle(x, y - 25, 30, 4, 0x333333);
    enemy.healthBarFill = this.add.rectangle(x, y - 25, 28, 2, 0xff4444);
    
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
    // Dark overlay with alpha mask effect
    this.darkness = this.add.graphics();
    this.darkness.setDepth(200);
    this.updateLighting();
  }

  updateLighting() {
    this.darkness.clear();
    
    // Create dark overlay
    this.darkness.fillStyle(0x000000, 0.7);
    this.darkness.fillRect(0, 0, this.mineWidth, this.mineHeight);
    
    // Cut out light around player
    this.darkness.fillStyle(0x000000, 0);
    
    // Use blend mode to create light effect
    const lightRadius = 150;
    const px = this.player.x;
    const py = this.player.y;
    
    // Create gradient-like effect with multiple circles
    for (let r = lightRadius; r > 0; r -= 10) {
      const alpha = 0.7 * (r / lightRadius);
      this.darkness.fillStyle(0x000000, alpha);
      this.darkness.fillCircle(px, py, r);
    }
    
    // Light around other players
    this.remotePlayers.forEach(player => {
      for (let r = 100; r > 0; r -= 10) {
        const alpha = 0.7 * (r / 100);
        this.darkness.fillStyle(0x000000, alpha);
        this.darkness.fillCircle(player.x, player.y, r);
      }
    });
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
    
    // Update player light position
    this.playerLight.setPosition(this.player.x, this.player.y);
    
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
    
    // Update lighting
    this.updateLighting();
    
    // Update enemy health bars
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.healthBarBg && enemy.healthBarFill) {
        enemy.healthBarBg.setPosition(enemy.x, enemy.y - 25);
        enemy.healthBarFill.setPosition(enemy.x - 14, enemy.y - 25);
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
    // Find nearest rock in range
    const mineRange = 50;
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
      if (this.miningTarget !== nearestRock) {
        this.miningTarget = nearestRock;
        this.miningProgress = 0;
      }
      
      // Get tool power
      const tool = TOOLS[this.currentTool] || TOOLS.hands;
      const power = tool.power || 1;
      
      this.miningProgress += power * 0.02;
      
      // Visual feedback
      nearestRock.setScale(1 + Math.sin(this.miningProgress * 10) * 0.05);
      
      if (this.miningProgress >= 1) {
        this.harvestRock(nearestRock);
      }
    }
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
    
    // Destroy rock
    if (rock.sparkle) rock.sparkle.destroy();
    rock.destroy();
    
    // Broadcast in multiplayer
    if (this.isMultiplayer) {
      this.networkManager.broadcast(MessageTypes.MINE_RESOURCE_HARVEST, {
        rockId: rock.id
      });
    }
    
    this.miningTarget = null;
    this.miningProgress = 0;
  }

  tryAttack(time) {
    if (time - this.lastAttackTime < this.attackCooldown) return;
    this.lastAttackTime = time;
    
    const tool = TOOLS[this.currentTool] || TOOLS.hands;
    const range = tool.attack?.range || 30;
    const damage = tool.power || 1;
    
    // Find enemies in range
    this.enemies.getChildren().forEach(enemy => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < range) {
        this.damageEnemy(enemy, damage);
      }
    });
    
    // Attack visual
    const attackCircle = this.add.circle(this.player.x, this.player.y, range, 0xffffff, 0.3);
    this.tweens.add({
      targets: attackCircle,
      alpha: 0,
      scale: 1.5,
      duration: 200,
      onComplete: () => attackCircle.destroy()
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
    // Show exit prompt
    if (!this.exitPromptShown) {
      this.exitPromptShown = true;
      this.showFloatingText(this.player.x, this.player.y - 40, 'Press E to exit');
    }
    
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      this.exitMine();
    }
  }

  exitMine() {
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
      // Create remote player sprite
      remotePlayer = this.physics.add.sprite(data.x, data.y, 'player');
      remotePlayer.setTint(0x88aaff);
      remotePlayer.playerNumber = data.playerNumber;
      this.remotePlayers.set(peerId, remotePlayer);
    }
    
    // Smooth interpolation
    this.tweens.add({
      targets: remotePlayer,
      x: data.x,
      y: data.y,
      duration: 50,
      ease: 'Linear'
    });
  }

  handleRemoteHarvest(data) {
    const rock = this.rocks.getChildren().find(r => r.id === data.rockId);
    if (rock) {
      if (rock.sparkle) rock.sparkle.destroy();
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
}
