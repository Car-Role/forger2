import { RESOURCES, UPGRADES, TOOLS, ENERGY, ENEMIES, BUILDINGS, TOWERS, LAND_TILES, WORLD_GRID_SIZE, LAND_TILE_SIZE } from '../data/GameData.js';
import { MessageTypes } from '../network/MessageTypes.js';

// Player colors for multiplayer
const PLAYER_COLORS = [0xffffff, 0x88ff88, 0x8888ff, 0xff8888];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    // Multiplayer state
    this.networkManager = null;
    this.isMultiplayer = false;
    this.isHost = false;
    this.localPlayerId = null;
    this.playerNumber = 1;
    this.remotePlayers = new Map(); // peerId -> sprite
    this.nextEntityId = 0;
  }

  create() {
    this.tileSize = 32;
    
    // Initialize multiplayer
    this.isMultiplayer = this.registry.get('isMultiplayer') || false;
    this.isHost = this.registry.get('isHost') || false;
    this.playerNumber = this.registry.get('playerNumber') || 1;
    
    if (this.isMultiplayer) {
      this.networkManager = this.registry.get('networkManager');
      this.localPlayerId = this.networkManager.localPlayerId;
    }
    this.resources = this.add.group();
    this.buildings = this.add.group();
    this.enemies = this.add.group();
    this.towers = this.add.group();
    this.projectiles = this.add.group();
    this.landMarkers = this.add.group();
    
    // World grid - each cell is a land tile
    this.gridSize = WORLD_GRID_SIZE;
    this.landTileSize = LAND_TILE_SIZE; // tiles per land chunk
    
    // Calculate world size
    this.worldWidth = this.gridSize * this.landTileSize * this.tileSize;
    this.worldHeight = this.gridSize * this.landTileSize * this.tileSize;
    
    // World seed for consistent random generation across clients
    if (this.isMultiplayer && this.networkManager) {
      // Use room code as seed for consistent world generation
      const roomCode = this.networkManager.getRoomCode() || 'DEFAULT';
      this.worldSeed = this.hashCode(roomCode);
    } else {
      // Single player uses saved seed or generates new one
      this.worldSeed = this.registry.get('worldSeed') || Math.floor(Math.random() * 1000000);
      this.registry.set('worldSeed', this.worldSeed);
    }
    
    // Get unlocked lands from registry
    this.unlockedLands = this.registry.get('unlockedLands') || {};
    
    // Initialize center tile if new game
    const centerKey = `${Math.floor(this.gridSize/2)},${Math.floor(this.gridSize/2)}`;
    if (Object.keys(this.unlockedLands).length === 0) {
      this.unlockedLands[centerKey] = 'starter';
      this.registry.set('unlockedLands', this.unlockedLands);
    }
    
    // Set world bounds
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    
    // Generate world
    this.generateWorld();
    
    // Create player
    this.createPlayer();
    
    // Add collision between player and water
    this.physics.add.collider(this.player, this.waterTiles);
    
    // Spawn enemies on unlocked lands
    this.spawnAllEnemies();
    
    // Load saved buildings
    this.loadBuildings();
    
    // Setup camera
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    
    // Setup input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
    
    // Action keys
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    
    // Mining state
    this.isMining = false;
    this.miningTarget = null;
    this.miningProgress = 0;
    
    // Combat state
    this.isAttacking = false;
    this.attackCooldown = 0;
    this.isResting = false;
    this.wasLeftMouseDown = false;
    this.wasRightMouseDown = false;
    
    // Interaction state
    this.nearbyBuilding = null;
    this.nearbyLandMarker = null;
    
    // Create mining progress bar
    this.miningBarBg = this.add.rectangle(0, 0, 50, 8, 0x333333).setVisible(false);
    this.miningBarFill = this.add.rectangle(0, 0, 48, 6, 0x44aa44).setVisible(false);
    
    // Create interaction prompt
    this.interactPrompt = this.add.text(0, 0, '[E] Interact', {
      fontSize: '12px',
      fontFamily: 'Arial',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setVisible(false).setDepth(3000);
    
    // Listen for events
    this.events.on('placeBuilding', this.placeBuilding, this);
    this.events.on('startBuildingPlacement', this.startBuildingPlacement, this);
    this.events.on('startTowerPlacement', this.startTowerPlacement, this);
    this.events.on('buyLand', this.buyLand, this);
    
    // Building placement state
    this.isPlacingBuilding = false;
    this.isPlacingTower = false;
    this.placementBuilding = null;
    this.placementTower = null;
    this.placementGhost = null;
    this.placementGrid = null;
    
    // Load saved towers
    this.loadTowers();
    
    // Play time tracking
    this.playTime = this.registry.get('playTime') || 0;
    this.sessionStartTime = Date.now();
    
    // Auto-save every 30 seconds (only for host or single player)
    if (!this.isMultiplayer || this.isHost) {
      this.time.addEvent({
        delay: 30000,
        callback: () => {
          // Request player data from clients before saving
          if (this.isMultiplayer && this.isHost) {
            this.requestPlayerDataForSave();
            // Save after a short delay to allow data to arrive
            this.time.delayedCall(500, () => this.saveGame());
          } else {
            this.saveGame();
          }
        },
        callbackScope: this,
        loop: true
      });
    }
    
    // Setup multiplayer networking
    if (this.isMultiplayer) {
      this.setupNetworkHandlers();
      this.remotePlayerSprites = this.add.group();
      this.playerSaveData = {}; // Cache for player data from clients
      
      // If host, send initial world state to clients
      if (this.isHost) {
        this.time.delayedCall(1000, () => {
          this.broadcastFullWorldState();
        });
      }
      
      // Clients periodically send inventory to host for saving
      if (!this.isHost) {
        this.time.addEvent({
          delay: 30000,
          callback: this.sendInventoryToHost,
          callbackScope: this,
          loop: true
        });
      }
      
      // Network sync timers
      this.positionSyncTimer = 0;
      this.worldStateSyncTimer = 0;
      this.enemyStateSyncTimer = 0;
    }
  }
  
  // ========== MULTIPLAYER NETWORKING ==========
  
  generateEntityId() {
    const prefix = this.isHost ? 'h' : `c${this.playerNumber}`;
    return `${prefix}_${this.nextEntityId++}`;
  }
  
  setupNetworkHandlers() {
    if (!this.networkManager) return;
    
    // Handle incoming messages
    this.networkManager.onMessage((type, data, peerId) => {
      this.handleNetworkMessage(type, data, peerId);
    });
    
    // Handle player join/leave
    this.networkManager.on('playerJoined', (data) => {
      this.onPlayerJoined(data);
    });
    
    this.networkManager.on('playerLeft', (data) => {
      this.onPlayerLeft(data);
    });
    
    this.networkManager.on('hostDisconnected', () => {
      this.onHostDisconnected();
    });
    
    // Start ping interval
    this.networkManager.startPingInterval();
  }
  
  handleNetworkMessage(type, data, peerId) {
    switch (type) {
      // Player messages
      case MessageTypes.PLAYER_POSITION:
        this.handleRemotePlayerPosition(data, peerId);
        break;
      case MessageTypes.PLAYER_ANIMATION:
        this.handleRemotePlayerAnimation(data, peerId);
        break;
      case MessageTypes.PLAYER_DEATH:
        this.handleRemotePlayerDeath(data, peerId);
        break;
        
      // World state
      case MessageTypes.WORLD_STATE_FULL:
        if (!this.isHost) this.applyFullWorldState(data);
        break;
      case MessageTypes.WORLD_INIT:
        if (!this.isHost) this.applyWorldInit(data);
        break;
        
      // Resources
      case MessageTypes.RESOURCE_HARVEST_START:
        if (this.isHost) this.handleRemoteHarvestStart(data, peerId);
        break;
      case MessageTypes.RESOURCE_HARVEST_COMPLETE:
        this.handleResourceHarvested(data, peerId);
        break;
      case MessageTypes.RESOURCE_RESPAWN:
        if (!this.isHost) this.handleResourceRespawn(data);
        break;
        
      // Buildings
      case MessageTypes.BUILDING_PLACE:
        if (this.isHost) this.handleRemoteBuildingPlace(data, peerId);
        else this.handleBuildingPlaced(data);
        break;
        
      // Towers
      case MessageTypes.TOWER_PLACE:
        if (this.isHost) this.handleRemoteTowerPlace(data, peerId);
        else this.handleTowerPlaced(data);
        break;
      case MessageTypes.TOWER_FIRE:
        if (!this.isHost) this.handleTowerFired(data);
        break;
      case MessageTypes.TOWER_DAMAGE:
        if (!this.isHost) this.handleTowerDamaged(data);
        break;
      case MessageTypes.TOWER_DESTROY:
        if (!this.isHost) this.handleTowerDestroyed(data);
        break;
        
      // Combat
      case MessageTypes.ATTACK_START:
        this.handleRemoteAttack(data, peerId);
        break;
      case MessageTypes.DAMAGE_DEALT:
        if (!this.isHost) this.handleDamageDealt(data);
        break;
      case MessageTypes.ENEMY_STATE:
        if (!this.isHost) this.handleEnemyState(data);
        break;
      case MessageTypes.ENEMY_DEATH:
        if (!this.isHost) this.handleEnemyDeath(data);
        break;
      case MessageTypes.ENEMY_SPAWN:
        if (!this.isHost) this.handleEnemySpawn(data);
        break;
        
      // Land
      case MessageTypes.LAND_PURCHASE:
        if (this.isHost) this.handleRemoteLandPurchase(data, peerId);
        else this.handleLandPurchased(data);
        break;
        
      // Inventory sync for saving
      case MessageTypes.INVENTORY_REQUEST:
        if (!this.isHost) this.sendInventoryToHost();
        break;
      case MessageTypes.INVENTORY_UPDATE:
        if (this.isHost) this.handlePlayerInventoryData(data, peerId);
        break;
        
      // Storage sync
      case MessageTypes.STORAGE_UPDATE:
        this.handleStorageUpdate(data, peerId);
        break;
    }
  }
  
  handleStorageUpdate(data, peerId) {
    // Update local storage state
    this.registry.set('storage', data.storage);
    
    // If host, relay to other clients
    if (this.isHost) {
      this.networkManager.sendToAll(MessageTypes.STORAGE_UPDATE, data);
    }
    
    // Refresh storage panel if open
    const uiScene = this.scene.get('UIScene');
    if (uiScene && uiScene.activeModal === 'storage') {
      uiScene.updateStoragePanel();
    }
  }
  
  sendInventoryToHost() {
    if (this.isHost) return;
    
    this.networkManager.sendToHost(MessageTypes.INVENTORY_UPDATE, {
      playerNumber: this.playerNumber,
      inventory: this.registry.get('inventory'),
      inventorySlots: this.registry.get('inventorySlots'),
      hotbar: this.registry.get('hotbar'),
      equipment: this.registry.get('equipment'),
      tools: this.registry.get('tools'),
      upgrades: this.registry.get('upgrades'),
      xp: this.registry.get('xp'),
      level: this.registry.get('level'),
      position: { x: this.player.x, y: this.player.y }
    });
  }
  
  onPlayerJoined(data) {
    console.log('Player joined:', data);
    this.createRemotePlayer(data.peerId, data.playerNumber);
    
    // Host sends current world state to new player
    if (this.isHost) {
      this.time.delayedCall(500, () => {
        this.sendWorldStateToPlayer(data.peerId);
      });
    }
  }
  
  onPlayerLeft(data) {
    console.log('Player left:', data);
    this.removeRemotePlayer(data.peerId);
  }
  
  onHostDisconnected() {
    console.log('Host disconnected!');
    // Show message and return to menu
    this.showFloatingText(this.player.x, this.player.y - 50, 'Host disconnected!');
    this.time.delayedCall(2000, () => {
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
  }
  
  createRemotePlayer(peerId, playerNumber) {
    if (this.remotePlayers.has(peerId)) return;
    
    const remotePlayer = this.physics.add.sprite(
      this.worldWidth / 2,
      this.worldHeight / 2,
      'player'
    );
    remotePlayer.setDepth(1000);
    remotePlayer.setTint(PLAYER_COLORS[playerNumber - 1] || 0xffffff);
    remotePlayer.peerId = peerId;
    remotePlayer.playerNumber = playerNumber;
    
    // Add name label
    remotePlayer.nameLabel = this.add.text(0, -25, `P${playerNumber}`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 1 }
    }).setOrigin(0.5).setDepth(1001);
    
    // Interpolation targets
    remotePlayer.targetX = remotePlayer.x;
    remotePlayer.targetY = remotePlayer.y;
    
    this.remotePlayers.set(peerId, remotePlayer);
    this.remotePlayerSprites.add(remotePlayer);
    
    this.showFloatingText(this.player.x, this.player.y - 30, `P${playerNumber} joined!`);
  }
  
  removeRemotePlayer(peerId) {
    const remotePlayer = this.remotePlayers.get(peerId);
    if (remotePlayer) {
      if (remotePlayer.nameLabel) remotePlayer.nameLabel.destroy();
      remotePlayer.destroy();
      this.remotePlayers.delete(peerId);
    }
  }
  
  handleRemotePlayerPosition(data, peerId) {
    // If we're host and this is from a client, relay to other clients
    if (this.isHost && peerId !== this.localPlayerId) {
      this.networkManager.sendToAll(MessageTypes.PLAYER_POSITION, {
        ...data,
        peerId: peerId
      });
    }
    
    // Update remote player position
    const targetPeerId = data.peerId || peerId;
    if (targetPeerId === this.localPlayerId) return;
    
    let remotePlayer = this.remotePlayers.get(targetPeerId);
    if (!remotePlayer && data.playerNumber) {
      this.createRemotePlayer(targetPeerId, data.playerNumber);
      remotePlayer = this.remotePlayers.get(targetPeerId);
    }
    
    if (remotePlayer) {
      remotePlayer.targetX = data.x;
      remotePlayer.targetY = data.y;
      remotePlayer.setFlipX(data.flipX);
      
      if (data.texture && this.textures.exists(data.texture)) {
        remotePlayer.setTexture(data.texture);
      }
    }
  }
  
  handleRemotePlayerAnimation(data, peerId) {
    const remotePlayer = this.remotePlayers.get(peerId);
    if (remotePlayer && data.texture && this.textures.exists(data.texture)) {
      remotePlayer.setTexture(data.texture);
    }
  }
  
  updateRemotePlayers(delta) {
    this.remotePlayers.forEach((remotePlayer) => {
      // Smooth interpolation
      const lerpFactor = 0.15;
      remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, remotePlayer.targetX, lerpFactor);
      remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, remotePlayer.targetY, lerpFactor);
      
      // Update name label position
      if (remotePlayer.nameLabel) {
        remotePlayer.nameLabel.setPosition(remotePlayer.x, remotePlayer.y - 25);
      }
      
      // Update depth
      remotePlayer.setDepth(remotePlayer.y);
    });
  }
  
  sendPlayerState() {
    if (!this.networkManager || !this.player) return;
    
    const state = {
      x: this.player.x,
      y: this.player.y,
      flipX: this.player.flipX,
      texture: this.currentPlayerTexture || 'player',
      playerNumber: this.playerNumber,
      peerId: this.localPlayerId
    };
    
    this.networkManager.broadcast(MessageTypes.PLAYER_POSITION, state);
  }
  
  broadcastFullWorldState() {
    if (!this.isHost || !this.networkManager) return;
    
    const state = {
      unlockedLands: this.unlockedLands,
      resources: this.serializeResources(),
      buildings: this.serializeBuildings(),
      towers: this.serializeTowers(),
      enemies: this.serializeEnemies()
    };
    
    this.networkManager.sendToAll(MessageTypes.WORLD_STATE_FULL, state);
  }
  
  sendWorldStateToPlayer(peerId) {
    if (!this.isHost || !this.networkManager) return;
    
    const state = {
      unlockedLands: this.unlockedLands,
      resources: this.serializeResources(),
      buildings: this.serializeBuildings(),
      towers: this.serializeTowers(),
      enemies: this.serializeEnemies(),
      storage: this.registry.get('storage') || {}
    };
    
    this.networkManager.sendToPeer(peerId, MessageTypes.WORLD_INIT, state);
  }
  
  serializeResources() {
    return this.resources.getChildren().map(r => ({
      id: r.id,
      x: r.x,
      y: r.y,
      type: r.resourceType
    }));
  }
  
  serializeBuildings() {
    return this.buildings.getChildren().map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      type: b.buildingType
    }));
  }
  
  serializeTowers() {
    return this.towers.getChildren().map(t => ({
      id: t.id,
      x: t.x,
      y: t.y,
      type: t.towerType,
      health: t.health
    }));
  }
  
  serializeEnemies() {
    return this.enemies.getChildren().map(e => ({
      id: e.id,
      x: e.x,
      y: e.y,
      type: e.enemyType,
      health: e.health
    }));
  }
  
  applyWorldInit(state) {
    // Apply initial world state from host
    this.unlockedLands = state.unlockedLands || {};
    this.registry.set('unlockedLands', this.unlockedLands);
    
    // Apply shared storage
    if (state.storage) {
      this.registry.set('storage', state.storage);
    }
    
    // Regenerate world with new unlocked lands
    this.regenerateWorld();
    
    // Apply entities
    this.applyResourceState(state.resources);
    this.applyBuildingState(state.buildings);
    this.applyTowerState(state.towers);
    this.applyEnemyState(state.enemies);
  }
  
  applyFullWorldState(state) {
    // Update unlocked lands
    if (state.unlockedLands) {
      const oldLands = Object.keys(this.unlockedLands).length;
      this.unlockedLands = state.unlockedLands;
      this.registry.set('unlockedLands', this.unlockedLands);
      
      if (Object.keys(this.unlockedLands).length > oldLands) {
        this.regenerateWorld();
      }
    }
    
    // Update enemy states
    if (state.enemies) {
      this.applyEnemyState(state.enemies);
    }
  }
  
  applyResourceState(resources) {
    if (!resources) return;
    // Resources are generated from land tiles, so we don't need to sync them
    // Just update IDs for existing resources
  }
  
  applyBuildingState(buildings) {
    if (!buildings) return;
    
    buildings.forEach(b => {
      const exists = this.buildings.getChildren().find(
        existing => existing.x === b.x && existing.y === b.y
      );
      if (!exists) {
        this.createBuildingFromNetwork(b);
      }
    });
  }
  
  applyTowerState(towers) {
    if (!towers) return;
    
    towers.forEach(t => {
      const exists = this.towers.getChildren().find(
        existing => existing.id === t.id
      );
      if (!exists) {
        this.createTowerFromNetwork(t);
      } else if (exists.health !== t.health) {
        exists.health = t.health;
        this.updateTowerHealthBar(exists);
      }
    });
  }
  
  applyEnemyState(enemies) {
    if (!enemies) return;
    
    enemies.forEach(e => {
      const existing = this.enemies.getChildren().find(
        enemy => enemy.id === e.id
      );
      if (existing) {
        // Update position and health
        existing.targetX = e.x;
        existing.targetY = e.y;
        existing.health = e.health;
        
        // Update health bar
        if (existing.healthBarFill) {
          const healthPercent = existing.health / existing.maxHealth;
          existing.healthBarFill.setScale(healthPercent, 1);
        }
      }
    });
  }
  
  regenerateWorld() {
    // Clear and regenerate terrain based on unlocked lands
    // This is called when new lands are unlocked
    
    // Clear existing resources to avoid duplicates
    if (this.resources && this.resources.scene) {
      this.resources.clear(true, true);
    }
    
    this.generateWorld();
    this.updateLandMarkers();
  }
  
  createBuildingFromNetwork(data) {
    const building = this.physics.add.sprite(data.x, data.y, data.type);
    building.setDepth(data.y);
    building.buildingType = data.type;
    building.id = data.id;
    building.setImmovable(true);
    this.buildings.add(building);
  }
  
  createTowerFromNetwork(data) {
    const towerData = TOWERS[data.type];
    if (!towerData) return;
    
    const size = towerData.size * this.tileSize;
    
    const tower = this.add.rectangle(data.x, data.y, size - 4, size - 4, this.getTowerColor(data.type));
    tower.setStrokeStyle(2, 0x000000);
    tower.setDepth(data.y);
    
    tower.id = data.id;
    tower.towerType = data.type;
    tower.towerData = towerData;
    tower.health = data.health || towerData.health;
    tower.maxHealth = towerData.health;
    tower.lastFireTime = 0;
    
    // Create health bar
    tower.healthBarBg = this.add.rectangle(data.x, data.y - size / 2 - 8, size, 6, 0x333333).setDepth(data.y + 1);
    tower.healthBarFill = this.add.rectangle(data.x, data.y - size / 2 - 8, size - 2, 4, 0x44ff44).setDepth(data.y + 2);
    
    tower.label = this.add.text(data.x, data.y, towerData.name.charAt(0), {
      fontSize: `${Math.max(12, size / 3)}px`,
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(data.y + 1);
    
    this.towers.add(tower);
    this.updateTowerHealthBar(tower);
  }
  
  // Network message handlers for host
  handleRemoteHarvestStart(data, peerId) {
    // Host validates and processes harvest start
    // For now, just acknowledge
  }
  
  handleResourceHarvested(data, peerId) {
    // Remove the harvested resource for all players
    const resource = this.resources.getChildren().find(r => r.id === data.resourceId);
    if (resource) {
      resource.destroy();
    }
    
    // If host, relay to other clients
    if (this.isHost && peerId !== this.localPlayerId) {
      this.networkManager.sendToAll(MessageTypes.RESOURCE_HARVEST_COMPLETE, data);
    }
  }
  
  handleResourceRespawn(data) {
    // Client: Create the respawned resource
    this.createResource(data.x, data.y, data.type, data.id);
  }
  
  handleRemoteBuildingPlace(data, peerId) {
    // Host validates and places building
    const building = this.placeBuilding(data);
    if (building) {
      // Broadcast to all clients
      this.networkManager.sendToAll(MessageTypes.BUILDING_PLACE, {
        ...data,
        id: building.id
      });
    }
  }
  
  handleBuildingPlaced(data) {
    // Client: Building was placed by host
    this.placeBuilding(data, true);
  }
  
  handleRemoteTowerPlace(data, peerId) {
    // Host validates and places tower
    // Resources should already be consumed by the placing player
    const tower = this.placeTowerDirect(data.towerType, data.x, data.y);
    if (tower) {
      this.networkManager.sendToAll(MessageTypes.TOWER_PLACE, {
        type: data.towerType,
        x: data.x,
        y: data.y,
        id: tower.id
      });
    }
  }
  
  handleTowerPlaced(data) {
    this.createTowerFromNetwork(data);
  }
  
  handleTowerFired(data) {
    // Visual effect for tower firing
    const tower = this.towers.getChildren().find(t => t.id === data.towerId);
    const target = this.enemies.getChildren().find(e => e.id === data.targetId);
    
    if (tower && target) {
      // Create projectile visual
      const projectile = this.add.circle(tower.x, tower.y, 4, this.getProjectileColor(tower.towerData.projectile));
      projectile.setDepth(2000);
      
      this.tweens.add({
        targets: projectile,
        x: target.x,
        y: target.y,
        duration: 200,
        onComplete: () => projectile.destroy()
      });
    }
  }
  
  handleTowerDamaged(data) {
    const tower = this.towers.getChildren().find(t => t.id === data.towerId);
    if (tower) {
      tower.health = data.health;
      this.updateTowerHealthBar(tower);
    }
  }
  
  handleTowerDestroyed(data) {
    const tower = this.towers.getChildren().find(t => t.id === data.towerId);
    if (tower) {
      if (tower.healthBarBg) tower.healthBarBg.destroy();
      if (tower.healthBarFill) tower.healthBarFill.destroy();
      if (tower.label) tower.label.destroy();
      tower.destroy();
    }
  }
  
  handleRemoteAttack(data, peerId) {
    // Show attack visual for remote player
    const remotePlayer = this.remotePlayers.get(peerId);
    if (remotePlayer) {
      this.showAttackEffect(data.angle, data.range, data.toolType, data.attackDir);
    }
    
    // If host, process damage
    if (this.isHost) {
      this.processRemoteAttackDamage(data, peerId);
    }
  }
  
  processRemoteAttackDamage(data, peerId) {
    // Find enemies in attack range
    this.enemies.getChildren().forEach(enemy => {
      const dist = Phaser.Math.Distance.Between(data.x, data.y, enemy.x, enemy.y);
      if (dist > data.range) return;
      
      const angleToEnemy = Phaser.Math.Angle.Between(data.x, data.y, enemy.x, enemy.y);
      let angleDiff = Math.abs(angleToEnemy - data.angle);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      
      if (angleDiff <= data.arc / 2) {
        this.damageEnemy(enemy, data.damage);
      }
    });
  }
  
  handleDamageDealt(data) {
    const enemy = this.enemies.getChildren().find(e => e.id === data.enemyId);
    if (enemy) {
      enemy.health = data.newHealth;
      if (enemy.healthBarFill) {
        const healthPercent = enemy.health / enemy.maxHealth;
        enemy.healthBarFill.setScale(healthPercent, 1);
      }
      
      // Visual feedback
      enemy.setTint(0xff4444);
      this.time.delayedCall(100, () => enemy.clearTint());
    }
  }
  
  handleEnemyState(data) {
    if (!data.enemies) return;
    
    data.enemies.forEach(e => {
      const enemy = this.enemies.getChildren().find(en => en.id === e.id);
      if (enemy) {
        // Interpolate position
        enemy.targetX = e.x;
        enemy.targetY = e.y;
        enemy.health = e.health;
        
        if (enemy.healthBarFill) {
          const healthPercent = enemy.health / enemy.maxHealth;
          enemy.healthBarFill.setScale(healthPercent, 1);
        }
      }
    });
  }
  
  handleEnemyDeath(data) {
    const enemy = this.enemies.getChildren().find(e => e.id === data.enemyId);
    if (enemy) {
      // Show loot drops
      if (data.drops) {
        Object.entries(data.drops).forEach(([resource, amount]) => {
          this.showFloatingText(enemy.x, enemy.y - 20, `+${amount} ${RESOURCES[resource]?.name || resource}`);
        });
      }
      
      // Clean up
      if (enemy.healthBarBg) enemy.healthBarBg.destroy();
      if (enemy.healthBarFill) enemy.healthBarFill.destroy();
      enemy.destroy();
    }
  }
  
  handleEnemySpawn(data) {
    this.createEnemyFromNetwork(data);
  }
  
  createEnemyFromNetwork(data) {
    const enemyData = ENEMIES[data.type];
    if (!enemyData) return;
    
    const enemy = this.physics.add.sprite(data.x, data.y, data.type);
    enemy.id = data.id;
    enemy.enemyType = data.type;
    enemy.enemyData = enemyData;
    enemy.health = data.health || enemyData.health;
    enemy.maxHealth = enemyData.health;
    enemy.setDepth(data.y);
    enemy.targetX = data.x;
    enemy.targetY = data.y;
    
    enemy.healthBarBg = this.add.image(data.x, data.y - 20, 'healthBarBg').setDepth(data.y + 1);
    enemy.healthBarFill = this.add.image(data.x, data.y - 20, 'healthBarFill').setDepth(data.y + 2);
    
    enemy.moveTimer = 0;
    enemy.moveDirection = { x: 0, y: 0 };
    
    this.enemies.add(enemy);
  }
  
  handleRemoteLandPurchase(data, peerId) {
    // Host processes land purchase from a client
    // Validate and apply
    const landKey = `${data.gx},${data.gy}`;
    if (!this.unlockedLands[landKey]) {
      this.unlockedLands[landKey] = data.landType;
      this.registry.set('unlockedLands', this.unlockedLands);
      
      // Regenerate world to properly update water collisions
      this.regenerateWorld();
      
      // Broadcast to all clients
      this.networkManager.sendToAll(MessageTypes.LAND_PURCHASE, {
        gx: data.gx,
        gy: data.gy,
        landType: data.landType
      });
      
      this.saveGame();
    }
  }
  
  handleLandPurchased(data) {
    const landKey = `${data.gx},${data.gy}`;
    if (!this.unlockedLands[landKey]) {
      this.unlockedLands[landKey] = data.landType;
      this.registry.set('unlockedLands', this.unlockedLands);
      
      // Regenerate world to properly update water collisions
      this.regenerateWorld();
      
      this.showFloatingText(this.player.x, this.player.y - 30, `New land unlocked!`);
    }
  }
  
  handleRemotePlayerDeath(data, peerId) {
    const remotePlayer = this.remotePlayers.get(peerId);
    if (remotePlayer) {
      this.showFloatingText(remotePlayer.x, remotePlayer.y - 30, `P${remotePlayer.playerNumber} died!`);
    }
  }
  
  // Helper to place tower without consuming resources (for network sync)
  placeTowerDirect(towerType, x, y) {
    const towerData = TOWERS[towerType];
    if (!towerData) return null;
    
    const size = towerData.size * this.tileSize;
    
    const tower = this.add.rectangle(x, y, size - 4, size - 4, this.getTowerColor(towerType));
    tower.setStrokeStyle(2, 0x000000);
    tower.setDepth(y);
    
    tower.id = this.generateEntityId();
    tower.towerType = towerType;
    tower.towerData = towerData;
    tower.health = towerData.health;
    tower.maxHealth = towerData.health;
    tower.lastFireTime = 0;
    
    tower.healthBarBg = this.add.rectangle(x, y - size / 2 - 8, size, 6, 0x333333).setDepth(y + 1);
    tower.healthBarFill = this.add.rectangle(x, y - size / 2 - 8, size - 2, 4, 0x44ff44).setDepth(y + 2);
    
    tower.label = this.add.text(x, y, towerData.name.charAt(0), {
      fontSize: `${Math.max(12, size / 3)}px`,
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(y + 1);
    
    this.towers.add(tower);
    
    return tower;
  }
  
  // ========== END MULTIPLAYER NETWORKING ==========

  generateWorld() {
    // Create or clear water tiles group
    if (!this.waterTiles) {
      this.waterTiles = this.physics.add.staticGroup();
    } else if (this.waterTiles.scene) {
      this.waterTiles.clear(true, true);
    } else {
      // Group was destroyed, recreate it
      this.waterTiles = this.physics.add.staticGroup();
    }
    
    // Draw entire world grid
    for (let gx = 0; gx < this.gridSize; gx++) {
      for (let gy = 0; gy < this.gridSize; gy++) {
        const key = `${gx},${gy}`;
        const isUnlocked = this.unlockedLands[key];
        
        // Calculate pixel positions for this land chunk
        const startX = gx * this.landTileSize * this.tileSize;
        const startY = gy * this.landTileSize * this.tileSize;
        
        if (isUnlocked) {
          // Draw unlocked land with grass
          this.drawLandTile(gx, gy, isUnlocked);
        } else {
          // Draw water for locked areas
          for (let tx = 0; tx < this.landTileSize; tx++) {
            for (let ty = 0; ty < this.landTileSize; ty++) {
              const worldX = startX + tx * this.tileSize + this.tileSize / 2;
              const worldY = startY + ty * this.tileSize + this.tileSize / 2;
              const waterTile = this.add.image(worldX, worldY, 'water').setDepth(-1);
              
              // Add collision for water tiles at the edge of unlocked land
              if (this.isAdjacentToUnlocked(gx, gy)) {
                const collider = this.waterTiles.create(worldX, worldY, null);
                collider.setVisible(false);
                collider.body.setSize(this.tileSize, this.tileSize);
              }
            }
          }
          
          // Check if adjacent to unlocked land - make clickable for purchase
          if (this.isAdjacentToUnlocked(gx, gy)) {
            this.createLandMarker(gx, gy);
          }
        }
      }
    }
  }

  drawLandTile(gx, gy, landType) {
    const landData = LAND_TILES[landType];
    const startX = gx * this.landTileSize * this.tileSize;
    const startY = gy * this.landTileSize * this.tileSize;
    
    // Draw ground tiles
    for (let tx = 0; tx < this.landTileSize; tx++) {
      for (let ty = 0; ty < this.landTileSize; ty++) {
        const worldX = startX + tx * this.tileSize + this.tileSize / 2;
        const worldY = startY + ty * this.tileSize + this.tileSize / 2;
        
        // Edge tiles are sand (border)
        let tileType = 'grass';
        if (tx === 0 || ty === 0 || tx === this.landTileSize - 1 || ty === this.landTileSize - 1) {
          tileType = 'sand';
        } else if (this.getSeededRandomForPosition(gx * 100 + tx, gy * 100 + ty) < 0.1) {
          tileType = 'dirt';
        }
        
        this.add.image(worldX, worldY, tileType).setDepth(-1);
      }
    }
    
    // Spawn resources for this land
    this.spawnResourcesForLand(gx, gy, landData);
  }

  spawnResourcesForLand(gx, gy, landData) {
    if (!landData || !landData.resources) return;
    
    const startX = gx * this.landTileSize * this.tileSize;
    const startY = gy * this.landTileSize * this.tileSize;
    const padding = 2 * this.tileSize;
    
    // Use seeded random for consistent resource count and placement
    const numResources = 6 + Math.floor(this.getSeededRandomForPosition(gx, gy, 0) * 5);
    
    for (let i = 0; i < numResources; i++) {
      // Use seeded random for resource type selection
      const typeIndex = Math.floor(this.getSeededRandomForPosition(gx, gy, i + 1) * landData.resources.length);
      const type = landData.resources[typeIndex];
      
      // Use seeded random for position
      const xRand = this.getSeededRandomForPosition(gx, gy, i * 2 + 100);
      const yRand = this.getSeededRandomForPosition(gx, gy, i * 2 + 101);
      const x = startX + padding + xRand * (this.landTileSize * this.tileSize - padding * 2);
      const y = startY + padding + yRand * (this.landTileSize * this.tileSize - padding * 2);
      
      // Use deterministic ID based on land position and resource index for network sync
      const resourceId = `r_${gx}_${gy}_${i}`;
      this.createResource(x, y, type, resourceId);
    }
  }

  isAdjacentToUnlocked(gx, gy) {
    const neighbors = [
      [gx - 1, gy], [gx + 1, gy],
      [gx, gy - 1], [gx, gy + 1]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
        if (this.unlockedLands[`${nx},${ny}`]) {
          return true;
        }
      }
    }
    return false;
  }

  createLandMarker(gx, gy) {
    const centerX = (gx + 0.5) * this.landTileSize * this.tileSize;
    const centerY = (gy + 0.5) * this.landTileSize * this.tileSize;
    
    // Flag pole (standalone, not in container)
    const pole = this.add.rectangle(centerX, centerY, 4, 40, 0x8B4513)
      .setOrigin(0.5, 1)
      .setDepth(2000);
    
    // Flag (interactive - this is what you click)
    const flag = this.add.rectangle(centerX + 12, centerY - 30, 30, 20, 0x44ff44)
      .setOrigin(0, 0.5)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true });
    
    // Buy label (shows on hover)
    const buyLabel = this.add.text(centerX, centerY + 15, '🏝️ Buy Land', {
      fontSize: '12px',
      fontFamily: 'Arial',
      align: 'center',
      backgroundColor: '#228822',
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5, 0).setVisible(false).setDepth(2002);
    
    // Store grid coordinates on the flag
    flag.gridX = gx;
    flag.gridY = gy;
    flag.pole = pole;
    flag.buyLabel = buyLabel;
    
    // Hover effects
    flag.on('pointerover', () => {
      flag.setFillStyle(0x88ff88);
      buyLabel.setVisible(true);
    });
    
    flag.on('pointerout', () => {
      flag.setFillStyle(0x44ff44);
      buyLabel.setVisible(false);
    });
    
    // Click to open purchase UI
    flag.on('pointerdown', () => {
      console.log('Flag clicked!', gx, gy);
      this.events.emit('openLandPurchase', { gx, gy });
    });
    
    // Add flag to the group (we'll use flag as the main reference)
    this.landMarkers.add(flag);
  }

  getAvailableLandTypes() {
    // Return land types based on what's already unlocked
    const unlocked = Object.values(this.unlockedLands);
    const available = [];
    
    // Always available
    available.push('forest', 'quarry');
    
    // Tier 2 - need some resources
    if (unlocked.length >= 2) {
      available.push('copperMine', 'swamp');
    }
    
    // Tier 3 - need copper
    if (unlocked.includes('copperMine') || unlocked.length >= 4) {
      available.push('ironMine', 'deepForest');
    }
    
    // Tier 4 - need iron
    if (unlocked.includes('ironMine') || unlocked.length >= 6) {
      available.push('goldMine', 'crystalCave');
    }
    
    // Tier 5 - need gold/crystal
    if (unlocked.includes('goldMine') || unlocked.includes('crystalCave')) {
      available.push('diamondMine', 'mythrilPeak');
    }
    
    return available;
  }

  buyLand(data) {
    const { gx, gy, landType } = data;
    const key = `${gx},${gy}`;
    
    const landData = LAND_TILES[landType];
    if (!landData || !landData.unlockCost) return;
    
    // Check if can afford
    const inventory = this.registry.get('inventory');
    for (const [res, amt] of Object.entries(landData.unlockCost)) {
      if ((inventory[res] || 0) < amt) {
        this.showFloatingText(this.player.x, this.player.y - 30, 'Not enough resources!');
        return;
      }
    }
    
    // Consume resources
    for (const [res, amt] of Object.entries(landData.unlockCost)) {
      inventory[res] -= amt;
    }
    this.registry.set('inventory', inventory);
    
    // In multiplayer, clients send request to host
    if (this.isMultiplayer && !this.isHost) {
      this.networkManager.sendToHost(MessageTypes.LAND_PURCHASE, {
        gx: gx,
        gy: gy,
        landType: landType
      });
      this.showFloatingText(this.player.x, this.player.y - 30, 'Requesting land purchase...');
      return;
    }
    
    // Unlock the land
    this.unlockedLands[key] = landType;
    this.registry.set('unlockedLands', this.unlockedLands);
    
    // Regenerate world to properly update water collisions
    this.regenerateWorld();
    
    // Spawn enemies on the new land (only host spawns in multiplayer)
    if (landData.enemies && landData.enemies.length > 0) {
      const startX = gx * this.landTileSize * this.tileSize;
      const startY = gy * this.landTileSize * this.tileSize;
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const enemyType = Phaser.Math.RND.pick(landData.enemies);
        const x = startX + (1 + Math.random() * (this.landTileSize - 2)) * this.tileSize;
        const y = startY + (1 + Math.random() * (this.landTileSize - 2)) * this.tileSize;
        this.createEnemy(x, y, enemyType);
      }
    }
    
    // Show success message
    this.showFloatingText(this.player.x, this.player.y - 30, `${landData.name} unlocked!`);
    
    // Broadcast to clients if host
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.LAND_PURCHASE, {
        gx: gx,
        gy: gy,
        landType: landType
      });
    }
    
    // Save game (only host or single player)
    if (!this.isMultiplayer || this.isHost) {
      this.saveGame();
    }
  }
  
  updateLandMarkers() {
    // Destroy associated objects before clearing markers
    this.landMarkers.getChildren().forEach(flag => {
      if (flag.pole) flag.pole.destroy();
      if (flag.buyLabel) flag.buyLabel.destroy();
    });
    
    // Clear existing markers
    this.landMarkers.clear(true, true);
    
    // Track which tiles already have markers to avoid duplicates
    const markedTiles = new Set();
    
    // Re-add markers for locked adjacent tiles
    Object.keys(this.unlockedLands).forEach(key => {
      const [gx, gy] = key.split(',').map(Number);
      const neighbors = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
      ];
      
      neighbors.forEach(({ dx, dy }) => {
        const nx = gx + dx;
        const ny = gy + dy;
        const nKey = `${nx},${ny}`;
        
        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize &&
            !this.unlockedLands[nKey] && !markedTiles.has(nKey)) {
          // Create full interactive marker
          this.createLandMarker(nx, ny);
          markedTiles.add(nKey);
        }
      });
    });
  }

  spawnAllEnemies() {
    Object.entries(this.unlockedLands).forEach(([key, landType]) => {
      const landData = LAND_TILES[landType];
      if (!landData || !landData.enemies || landData.enemies.length === 0) return;
      
      const [gx, gy] = key.split(',').map(Number);
      const startX = gx * this.landTileSize * this.tileSize;
      const startY = gy * this.landTileSize * this.tileSize;
      
      // Spawn 1-2 enemies per land tile
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const enemyType = Phaser.Math.RND.pick(landData.enemies);
        const x = startX + (1 + Math.random() * (this.landTileSize - 2)) * this.tileSize;
        const y = startY + (1 + Math.random() * (this.landTileSize - 2)) * this.tileSize;
        this.createEnemy(x, y, enemyType);
      }
    });
  }

  createResource(x, y, type, id = null) {
    const resource = this.physics.add.sprite(x, y, type);
    resource.setImmovable(true);
    resource.resourceType = type;
    resource.id = id || this.generateEntityId();
    
    // Get resource data
    const resourceKey = Object.keys(RESOURCES).find(
      key => RESOURCES[key].source === type
    );
    resource.resourceData = RESOURCES[resourceKey];
    resource.resourceKey = resourceKey;
    
    // Set depth based on y position for proper layering
    resource.setDepth(y);
    
    this.resources.add(resource);
    return resource;
  }

  createPlayer() {
    const startX = this.worldWidth / 2;
    const startY = this.worldHeight / 2;
    
    this.player = this.physics.add.sprite(startX, startY, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(1000);
    
    // Base speed
    this.baseSpeed = 150;
    
    // Animation state
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.currentPlayerTexture = 'player';
  }

  update(time, delta) {
    // Local player controls
    this.handleMovement();
    this.handleMining(delta);
    this.handleInteraction();
    this.handleCombat(delta);
    this.handleEnergy(delta);
    
    // Only host runs AI and authoritative game logic
    if (!this.isMultiplayer || this.isHost) {
      this.updateEnemies(delta);
      this.updateTowers(delta);
      this.updateProjectiles(delta);
    } else {
      // Clients interpolate enemy positions
      this.interpolateEnemies(delta);
    }
    
    this.updateDepths();
    this.checkNearbyBuilding();
    this.updatePlayerAnimation(delta);
    this.updateLandMarkerVisibility();
    this.updateBuildingPlacement();
    
    // Multiplayer sync
    if (this.isMultiplayer) {
      this.updateRemotePlayers(delta);
      
      // Send position updates
      this.positionSyncTimer += delta;
      if (this.positionSyncTimer >= 50) { // 20 times per second
        this.sendPlayerState();
        this.positionSyncTimer = 0;
      }
      
      // Host broadcasts enemy states
      if (this.isHost) {
        this.enemyStateSyncTimer += delta;
        if (this.enemyStateSyncTimer >= 100) { // 10 times per second
          this.broadcastEnemyStates();
          this.enemyStateSyncTimer = 0;
        }
        
        // Periodic full world state sync
        this.worldStateSyncTimer += delta;
        if (this.worldStateSyncTimer >= 5000) { // Every 5 seconds
          this.broadcastFullWorldState();
          this.worldStateSyncTimer = 0;
        }
      }
    }
  }
  
  interpolateEnemies(delta) {
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.targetX !== undefined) {
        const lerpFactor = 0.1;
        enemy.x = Phaser.Math.Linear(enemy.x, enemy.targetX, lerpFactor);
        enemy.y = Phaser.Math.Linear(enemy.y, enemy.targetY, lerpFactor);
        
        // Update health bar position
        if (enemy.healthBarBg) {
          enemy.healthBarBg.setPosition(enemy.x, enemy.y - 20);
        }
        if (enemy.healthBarFill) {
          enemy.healthBarFill.setPosition(enemy.x - 1, enemy.y - 20);
        }
        
        enemy.setDepth(enemy.y);
      }
    });
  }
  
  broadcastEnemyStates() {
    if (!this.isHost || !this.networkManager) return;
    
    const enemyStates = this.enemies.getChildren().map(e => ({
      id: e.id,
      x: e.x,
      y: e.y,
      health: e.health
    }));
    
    this.networkManager.sendToAll(MessageTypes.ENEMY_STATE, { enemies: enemyStates });
  }

  updateLandMarkerVisibility() {
    // Show/hide buy buttons based on player proximity
    const showDistance = 250;
    
    this.landMarkers.getChildren().forEach(flag => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, flag.x, flag.y
      );
      
      // Show/hide based on proximity
      const shouldShow = dist < showDistance;
      flag.setVisible(shouldShow);
      if (flag.pole) flag.pole.setVisible(shouldShow);
      
      if (!shouldShow && flag.buyLabel) {
        flag.buyLabel.setVisible(false);
      }
    });
  }

  startBuildingPlacement(buildingType) {
    this.isPlacingBuilding = true;
    this.placementBuilding = buildingType;
    
    // Create ghost sprite for preview
    this.placementGhost = this.add.sprite(0, 0, buildingType);
    this.placementGhost.setAlpha(0.6);
    this.placementGhost.setTint(0x88ff88);
    this.placementGhost.setDepth(3000);
    
    // Create grid overlay
    this.placementGrid = this.add.graphics();
    this.placementGrid.setDepth(2999);
    
    // Create placement UI (fixed to camera)
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      this.placementUI = uiScene.add.text(600, 760, 'Click to place  •  Right-click or ESC to cancel', {
        fontSize: '14px',
        fontFamily: 'Arial',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setDepth(5000);
    }
    
    // Setup placement input
    this.input.on('pointerdown', this.handlePlacementClick, this);
    this.input.keyboard.once('keydown-ESC', this.cancelBuildingPlacement, this);
  }

  updateBuildingPlacement() {
    if (!this.isPlacingBuilding || !this.placementGhost) return;
    
    // Get mouse position in world coordinates
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    // Snap to grid (32px tiles)
    const gridX = Math.floor(worldPoint.x / this.tileSize) * this.tileSize + this.tileSize / 2;
    const gridY = Math.floor(worldPoint.y / this.tileSize) * this.tileSize + this.tileSize / 2;
    
    // Update ghost position
    this.placementGhost.setPosition(gridX, gridY);
    
    // Check if placement is valid
    const isValid = this.isValidPlacement(gridX, gridY);
    this.placementGhost.setTint(isValid ? 0x88ff88 : 0xff4444);
    
    // Draw grid around placement area
    this.placementGrid.clear();
    this.placementGrid.lineStyle(1, isValid ? 0x44ff44 : 0xff4444, 0.5);
    
    // Draw a 3x3 grid around cursor
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tileX = gridX + dx * this.tileSize - this.tileSize / 2;
        const tileY = gridY + dy * this.tileSize - this.tileSize / 2;
        this.placementGrid.strokeRect(tileX, tileY, this.tileSize, this.tileSize);
      }
    }
  }

  isValidPlacement(x, y) {
    // Check if on unlocked land
    const gx = Math.floor(x / (this.landTileSize * this.tileSize));
    const gy = Math.floor(y / (this.landTileSize * this.tileSize));
    const landKey = `${gx},${gy}`;
    
    if (!this.unlockedLands[landKey]) return false;
    
    // Check distance from player (must be within reasonable range)
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    if (dist > 200) return false;
    
    // Check for collision with existing buildings
    let hasCollision = false;
    this.buildings.getChildren().forEach(building => {
      const bDist = Phaser.Math.Distance.Between(building.x, building.y, x, y);
      if (bDist < 40) hasCollision = true;
    });
    
    if (hasCollision) return false;
    
    // Check for collision with resources
    this.resources.getChildren().forEach(resource => {
      const rDist = Phaser.Math.Distance.Between(resource.x, resource.y, x, y);
      if (rDist < 30) hasCollision = true;
    });
    
    return !hasCollision;
  }

  handlePlacementClick(pointer) {
    if (!this.isPlacingBuilding) return;
    
    // Right click cancels
    if (pointer.rightButtonDown()) {
      this.cancelBuildingPlacement();
      return;
    }
    
    // Left click places
    if (pointer.leftButtonDown()) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const gridX = Math.floor(worldPoint.x / this.tileSize) * this.tileSize + this.tileSize / 2;
      const gridY = Math.floor(worldPoint.y / this.tileSize) * this.tileSize + this.tileSize / 2;
      
      if (this.isValidPlacement(gridX, gridY)) {
        this.confirmBuildingPlacement(gridX, gridY);
      } else {
        this.showFloatingText(gridX, gridY - 20, 'Cannot place here!');
      }
    }
  }

  confirmBuildingPlacement(x, y) {
    // Consume resources now
    const building = BUILDINGS[this.placementBuilding];
    if (building) {
      const inventory = this.registry.get('inventory');
      let canAfford = true;
      
      // Double-check we can still afford it
      for (const [res, amt] of Object.entries(building.recipe)) {
        if ((inventory[res] || 0) < amt) {
          canAfford = false;
          break;
        }
      }
      
      if (!canAfford) {
        this.showFloatingText(x, y - 20, 'Not enough resources!');
        this.cleanupPlacement();
        return;
      }
      
      // Consume resources
      Object.entries(building.recipe).forEach(([res, amt]) => {
        inventory[res] = (inventory[res] || 0) - amt;
      });
      this.registry.set('inventory', inventory);
    }
    
    // Place the actual building
    this.placeBuilding({ type: this.placementBuilding, x, y });
    
    // Update UI
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.updateCraftingPanel();
      uiScene.inventoryUI.refresh();
    }
    
    // Clean up placement mode
    this.cleanupPlacement();
    
    this.showFloatingText(x, y - 20, 'Building placed!');
  }

  cancelBuildingPlacement() {
    if (!this.isPlacingBuilding) return;
    
    // No refund needed - resources weren't consumed yet
    this.cleanupPlacement();
    this.showFloatingText(this.player.x, this.player.y - 30, 'Placement cancelled');
  }

  cleanupPlacement() {
    this.isPlacingBuilding = false;
    this.placementBuilding = null;
    
    if (this.placementGhost) {
      this.placementGhost.destroy();
      this.placementGhost = null;
    }
    
    if (this.placementGrid) {
      this.placementGrid.destroy();
      this.placementGrid = null;
    }
    
    if (this.placementUI) {
      this.placementUI.destroy();
      this.placementUI = null;
    }
    
    this.input.off('pointerdown', this.handlePlacementClick, this);
  }

  updatePlayerAnimation(delta) {
    let targetTexture = 'player';
    
    // Get current tool type
    const currentTool = this.registry.get('currentTool') || 'hands';
    const toolData = TOOLS[currentTool];
    const toolType = toolData?.type || 'hands';
    
    if (this.isMining) {
      // Mining/harvesting animation based on tool type
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
      const attackProgress = 1 - (this.attackCooldown / 500);
      
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
      // Walking animation - show weapon while walking
      this.walkTimer += delta;
      if (this.walkTimer > 150) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 3;
      }
      
      // Use hold sprite for first frame, walk sprites for others
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

  handleMovement() {
    if (this.isMining) {
      this.player.setVelocity(0, 0);
      return;
    }
    
    // Get speed multiplier from upgrades
    const upgrades = this.registry.get('upgrades');
    const speedMult = UPGRADES.moveSpeed.effect(upgrades.moveSpeed);
    const speed = this.baseSpeed * speedMult;
    
    let vx = 0;
    let vy = 0;
    
    // Use custom keys - check if they exist and are properly bound
    let leftDown, rightDown, upDown, downDown;
    
    if (this.customKeys) {
      leftDown = this.customKeys.left?.isDown;
      rightDown = this.customKeys.right?.isDown;
      upDown = this.customKeys.up?.isDown;
      downDown = this.customKeys.down?.isDown;
    } else {
      // Fallback to arrow keys and WASD
      leftDown = this.cursors.left.isDown || this.wasd.left.isDown;
      rightDown = this.cursors.right.isDown || this.wasd.right.isDown;
      upDown = this.cursors.up.isDown || this.wasd.up.isDown;
      downDown = this.cursors.down.isDown || this.wasd.down.isDown;
    }
    
    if (leftDown) {
      vx = -speed;
    } else if (rightDown) {
      vx = speed;
    }
    
    if (upDown) {
      vy = -speed;
    } else if (downDown) {
      vy = speed;
    }
    
    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }
    
    this.player.setVelocity(vx, vy);
  }

  handleMining(delta) {
    const harvestKey = this.customKeys?.harvest || this.spaceKey;
    
    if (Phaser.Input.Keyboard.JustDown(harvestKey)) {
      // Find nearest resource
      const nearest = this.findNearestResource();
      if (nearest && nearest.distance < 50) {
        // Check energy
        const energy = this.registry.get('energy');
        if (energy < ENERGY.miningCost) {
          this.showFloatingText(this.player.x, this.player.y - 30, 'Too tired!');
          return;
        }
        
        // Check tier requirements
        const resourceTier = nearest.resource.resourceData.tier;
        const currentTool = this.registry.get('currentTool');
        const toolData = TOOLS[currentTool];
        const toolTier = toolData ? toolData.tier : 0;
        
        if (resourceTier > toolTier + 1) {
          this.showFloatingText(this.player.x, this.player.y - 30, 'Need better tool!');
          return;
        }
        
        this.startMining(nearest.resource);
      }
    }
    
    if (this.isMining) {
      if (!harvestKey.isDown) {
        this.stopMining();
        return;
      }
      
      // Check if still in range
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.miningTarget.x, this.miningTarget.y
      );
      
      if (dist > 60) {
        this.stopMining();
        return;
      }
      
      // Get mining speed from upgrades
      const upgrades = this.registry.get('upgrades');
      const speedMult = UPGRADES.miningSpeed.effect(upgrades.miningSpeed);
      
      // Get tool power and type bonus
      const currentTool = this.registry.get('currentTool');
      const toolData = TOOLS[currentTool];
      let toolPower = toolData ? toolData.power : 1;
      
      // Tool type bonus (axe for trees, pickaxe for ores)
      const resourceToolType = this.miningTarget.resourceData.toolType;
      const toolType = toolData ? toolData.type : null;
      if (resourceToolType !== 'any' && toolType === resourceToolType) {
        toolPower *= 1.5; // 50% bonus for correct tool
      }
      
      // Progress mining
      this.miningProgress += delta * speedMult * (toolPower / 2);
      
      // Update progress bar
      const harvestTime = this.miningTarget.resourceData.harvestTime;
      const progress = Math.min(this.miningProgress / harvestTime, 1);
      this.updateMiningBar(progress);
      
      if (this.miningProgress >= harvestTime) {
        this.completeHarvest();
      }
    }
  }

  findNearestResource() {
    let nearest = null;
    let minDist = Infinity;
    
    this.resources.getChildren().forEach(resource => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        resource.x, resource.y
      );
      
      if (dist < minDist) {
        minDist = dist;
        nearest = resource;
      }
    });
    
    return nearest ? { resource: nearest, distance: minDist } : null;
  }

  startMining(resource) {
    this.isMining = true;
    this.miningTarget = resource;
    this.miningProgress = 0;
    
    // Show progress bar
    this.miningBarBg.setVisible(true);
    this.miningBarFill.setVisible(true);
    
    // Highlight resource
    resource.setTint(0xffff88);
  }

  stopMining() {
    if (this.miningTarget) {
      this.miningTarget.clearTint();
    }
    
    this.isMining = false;
    this.miningTarget = null;
    this.miningProgress = 0;
    
    this.miningBarBg.setVisible(false);
    this.miningBarFill.setVisible(false);
  }

  updateMiningBar(progress) {
    const x = this.miningTarget.x;
    const y = this.miningTarget.y - 30;
    
    this.miningBarBg.setPosition(x, y);
    this.miningBarFill.setPosition(x - 24 + (progress * 24), y);
    this.miningBarFill.setScale(progress, 1);
  }

  completeHarvest() {
    const resource = this.miningTarget;
    const resourceKey = resource.resourceKey;
    
    // Consume energy
    const energy = this.registry.get('energy');
    this.registry.set('energy', Math.max(0, energy - ENERGY.miningCost));
    
    // Get yield multiplier
    const upgrades = this.registry.get('upgrades');
    const yieldMult = UPGRADES.harvestYield.effect(upgrades.harvestYield);
    
    // Calculate amount harvested
    const baseAmount = Phaser.Math.Between(1, 3);
    const amount = Math.floor(baseAmount * yieldMult);
    
    // Add to new slot-based inventory
    const added = this.addToInventory(resourceKey, amount);
    
    if (!added) {
      this.showFloatingText(resource.x, resource.y - 20, 'Inventory full!');
      this.stopMining();
      return;
    }
    
    this.showFloatingText(resource.x, resource.y - 20, `+${amount} ${resource.resourceData.name}`);
    
    // Also update old inventory for compatibility
    const inventory = this.registry.get('inventory');
    inventory[resourceKey] = (inventory[resourceKey] || 0) + amount;
    this.registry.set('inventory', inventory);
    
    // Add XP
    const xp = this.registry.get('xp');
    this.registry.set('xp', xp + resource.resourceData.xp);
    
    // Check for level up
    this.checkLevelUp();
    
    // Emit event for UI
    this.events.emit('resourceGathered', { 
      type: resourceKey, 
      amount: amount,
      total: inventory[resourceKey]
    });
    
    // Destroy and respawn resource
    const type = resource.resourceType;
    const resourceId = resource.id;
    const oldX = resource.x;
    const oldY = resource.y;
    
    // Broadcast resource harvested to network
    if (this.isMultiplayer) {
      this.networkManager.broadcast(MessageTypes.RESOURCE_HARVEST_COMPLETE, {
        resourceId: resourceId,
        x: oldX,
        y: oldY,
        type: type
      });
    }
    
    resource.destroy();
    
    // Find which land tile this resource was on
    const gx = Math.floor(oldX / (this.landTileSize * this.tileSize));
    const gy = Math.floor(oldY / (this.landTileSize * this.tileSize));
    const landKey = `${gx},${gy}`;
    const landType = this.unlockedLands[landKey];
    
    // Respawn after delay in the same land tile (only host respawns in multiplayer)
    if (landType && (!this.isMultiplayer || this.isHost)) {
      // Use seeded random for consistent respawn timing
      const respawnDelay = 5000 + this.getSeededRandomForPosition(Math.floor(oldX), Math.floor(oldY), Date.now() % 1000) * 10000;
      
      this.time.delayedCall(respawnDelay, () => {
        const startX = gx * this.landTileSize * this.tileSize;
        const startY = gy * this.landTileSize * this.tileSize;
        const padding = 2 * this.tileSize;
        
        // Use seeded random for respawn position
        const xRand = this.getSeededRandomForPosition(gx, gy, Date.now() % 10000);
        const yRand = this.getSeededRandomForPosition(gx, gy, (Date.now() + 1) % 10000);
        const x = startX + padding + xRand * (this.landTileSize * this.tileSize - padding * 2);
        const y = startY + padding + yRand * (this.landTileSize * this.tileSize - padding * 2);
        
        const newResource = this.createResource(x, y, type);
        
        // Broadcast respawn to clients
        if (this.isMultiplayer && this.isHost) {
          this.networkManager.sendToAll(MessageTypes.RESOURCE_RESPAWN, {
            id: newResource.id,
            x: x,
            y: y,
            type: type
          });
        }
      });
    }
    
    this.stopMining();
  }

  showFloatingText(x, y, text) {
    const floatText = this.add.text(x, y, text, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(2000);
    
    this.tweens.add({
      targets: floatText,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      onComplete: () => floatText.destroy()
    });
  }

  checkLevelUp() {
    const xp = this.registry.get('xp');
    let level = this.registry.get('level');
    
    // Simple: 100 XP per level
    const xpNeededForNextLevel = level * 100;
    
    while (xp >= xpNeededForNextLevel) {
      level++;
      this.registry.set('level', level);
      this.registry.set('health', 100); // Restore health on level up
      
      this.showFloatingText(
        this.player.x, 
        this.player.y - 50, 
        `🎉 Level Up! ${level}`
      );
      
      // Check if we level up again
      if (xp < level * 100) break;
    }
  }

  updateDepths() {
    // Update player depth based on y position
    this.player.setDepth(this.player.y);
    
    // Update resource depths
    this.resources.getChildren().forEach(resource => {
      resource.setDepth(resource.y);
    });
  }

  placeBuilding(buildingData, fromNetwork = false) {
    const { type, x, y } = buildingData;
    
    const building = this.physics.add.sprite(x, y, type);
    building.setDepth(y);
    building.buildingType = type;
    building.id = buildingData.id || this.generateEntityId();
    building.setImmovable(true);
    
    this.buildings.add(building);
    
    // Save to registry (only for host or single player)
    if (!this.isMultiplayer || this.isHost) {
      const buildings = this.registry.get('buildings');
      buildings.push({ type, x, y, id: building.id });
      this.registry.set('buildings', buildings);
    }
    
    // Broadcast to network if not from network
    if (this.isMultiplayer && !fromNetwork) {
      if (this.isHost) {
        // Host broadcasts to all clients
        this.networkManager.sendToAll(MessageTypes.BUILDING_PLACE, {
          type: type,
          x: x,
          y: y,
          id: building.id
        });
      } else {
        // Client requests placement from host
        this.networkManager.sendToHost(MessageTypes.BUILDING_PLACE, {
          type: type,
          x: x,
          y: y
        });
      }
    }
    
    return building;
  }

  loadBuildings() {
    const buildings = this.registry.get('buildings');
    buildings.forEach(b => {
      const building = this.physics.add.sprite(b.x, b.y, b.type);
      building.setDepth(b.y);
      building.buildingType = b.type;
      building.setImmovable(true);
      this.buildings.add(building);
    });
  }

  // ========== TOWER SYSTEM ==========
  
  startTowerPlacement(towerType) {
    this.isPlacingTower = true;
    this.placementTower = towerType;
    
    const towerData = TOWERS[towerType];
    const size = towerData.size * this.tileSize;
    
    // Create ghost rectangle for preview
    this.placementGhost = this.add.rectangle(0, 0, size, size, 0x4488ff, 0.5);
    this.placementGhost.setDepth(3000);
    this.placementGhost.setStrokeStyle(2, 0x4488ff);
    
    // Create grid overlay
    this.placementGrid = this.add.graphics();
    this.placementGrid.setDepth(2999);
    
    // Create placement UI (fixed to camera)
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      this.placementUI = uiScene.add.text(600, 760, `Placing ${towerData.name} (${towerData.size}x${towerData.size})  •  Click to place  •  Right-click/ESC to cancel`, {
        fontSize: '14px',
        fontFamily: 'Arial',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setDepth(5000);
    }
    
    // Setup placement input
    this.input.on('pointerdown', this.handleTowerPlacementClick, this);
    this.input.keyboard.once('keydown-ESC', this.cancelTowerPlacement, this);
  }

  updateBuildingPlacement() {
    // Handle building placement
    if (this.isPlacingBuilding && this.placementGhost) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      const gridX = Math.floor(worldPoint.x / this.tileSize) * this.tileSize + this.tileSize / 2;
      const gridY = Math.floor(worldPoint.y / this.tileSize) * this.tileSize + this.tileSize / 2;
      
      this.placementGhost.setPosition(gridX, gridY);
      
      const isValid = this.isValidPlacement(gridX, gridY);
      this.placementGhost.setTint(isValid ? 0x88ff88 : 0xff4444);
      
      this.placementGrid.clear();
      this.placementGrid.lineStyle(1, isValid ? 0x44ff44 : 0xff4444, 0.5);
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const tileX = gridX + dx * this.tileSize - this.tileSize / 2;
          const tileY = gridY + dy * this.tileSize - this.tileSize / 2;
          this.placementGrid.strokeRect(tileX, tileY, this.tileSize, this.tileSize);
        }
      }
    }
    
    // Handle tower placement
    if (this.isPlacingTower && this.placementGhost) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      const towerData = TOWERS[this.placementTower];
      const tileCount = towerData.size;
      const size = tileCount * this.tileSize;
      
      // Snap to grid based on tower size
      const gridX = Math.floor(worldPoint.x / this.tileSize) * this.tileSize + size / 2;
      const gridY = Math.floor(worldPoint.y / this.tileSize) * this.tileSize + size / 2;
      
      this.placementGhost.setPosition(gridX, gridY);
      
      const isValid = this.isValidTowerPlacement(gridX, gridY, tileCount);
      this.placementGhost.setFillStyle(isValid ? 0x4488ff : 0xff4444, 0.5);
      this.placementGhost.setStrokeStyle(2, isValid ? 0x4488ff : 0xff4444);
      
      // Draw grid
      this.placementGrid.clear();
      this.placementGrid.lineStyle(1, isValid ? 0x4488ff : 0xff4444, 0.5);
      
      for (let dx = 0; dx < tileCount; dx++) {
        for (let dy = 0; dy < tileCount; dy++) {
          const tileX = gridX - size / 2 + dx * this.tileSize;
          const tileY = gridY - size / 2 + dy * this.tileSize;
          this.placementGrid.strokeRect(tileX, tileY, this.tileSize, this.tileSize);
        }
      }
    }
  }

  isValidTowerPlacement(x, y, tileCount) {
    const size = tileCount * this.tileSize;
    const halfSize = size / 2;
    
    // Check all tiles the tower would occupy
    for (let dx = 0; dx < tileCount; dx++) {
      for (let dy = 0; dy < tileCount; dy++) {
        const checkX = x - halfSize + dx * this.tileSize + this.tileSize / 2;
        const checkY = y - halfSize + dy * this.tileSize + this.tileSize / 2;
        
        // Check if on unlocked land
        const gx = Math.floor(checkX / (this.landTileSize * this.tileSize));
        const gy = Math.floor(checkY / (this.landTileSize * this.tileSize));
        const landKey = `${gx},${gy}`;
        
        if (!this.unlockedLands[landKey]) return false;
      }
    }
    
    // Check distance from player
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
    if (dist > 250) return false;
    
    // Check for collision with existing buildings
    let hasCollision = false;
    this.buildings.getChildren().forEach(building => {
      const bDist = Phaser.Math.Distance.Between(building.x, building.y, x, y);
      if (bDist < 50 + size / 2) hasCollision = true;
    });
    
    // Check for collision with existing towers
    this.towers.getChildren().forEach(tower => {
      const tDist = Phaser.Math.Distance.Between(tower.x, tower.y, x, y);
      const otherSize = tower.towerData.size * this.tileSize;
      if (tDist < (size + otherSize) / 2 + 10) hasCollision = true;
    });
    
    // Check for collision with resources
    this.resources.getChildren().forEach(resource => {
      const rDist = Phaser.Math.Distance.Between(resource.x, resource.y, x, y);
      if (rDist < 30 + size / 2) hasCollision = true;
    });
    
    return !hasCollision;
  }

  handleTowerPlacementClick(pointer) {
    if (!this.isPlacingTower) return;
    
    if (pointer.rightButtonDown()) {
      this.cancelTowerPlacement();
      return;
    }
    
    if (pointer.leftButtonDown()) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const towerData = TOWERS[this.placementTower];
      const size = towerData.size * this.tileSize;
      
      const gridX = Math.floor(worldPoint.x / this.tileSize) * this.tileSize + size / 2;
      const gridY = Math.floor(worldPoint.y / this.tileSize) * this.tileSize + size / 2;
      
      if (this.isValidTowerPlacement(gridX, gridY, towerData.size)) {
        this.confirmTowerPlacement(gridX, gridY);
      } else {
        this.showFloatingText(gridX, gridY - 20, 'Cannot place here!');
      }
    }
  }

  confirmTowerPlacement(x, y) {
    const towerData = TOWERS[this.placementTower];
    
    // Check resources
    const inventory = this.registry.get('inventory');
    for (const [res, amt] of Object.entries(towerData.recipe)) {
      if ((inventory[res] || 0) < amt) {
        this.showFloatingText(x, y - 20, 'Not enough resources!');
        this.cleanupTowerPlacement();
        return;
      }
    }
    
    // Consume resources
    Object.entries(towerData.recipe).forEach(([res, amt]) => {
      inventory[res] = (inventory[res] || 0) - amt;
    });
    this.registry.set('inventory', inventory);
    
    // Place the tower
    this.placeTower(this.placementTower, x, y);
    
    // Update UI
    const uiScene = this.scene.get('UIScene');
    if (uiScene) {
      uiScene.updateCraftingPanel();
      uiScene.inventoryUI.refresh();
    }
    
    this.cleanupTowerPlacement();
    this.showFloatingText(x, y - 20, `${towerData.name} placed!`);
  }

  cancelTowerPlacement() {
    if (!this.isPlacingTower) return;
    this.cleanupTowerPlacement();
    this.showFloatingText(this.player.x, this.player.y - 30, 'Placement cancelled');
  }

  cleanupTowerPlacement() {
    this.isPlacingTower = false;
    this.placementTower = null;
    
    if (this.placementGhost) {
      this.placementGhost.destroy();
      this.placementGhost = null;
    }
    
    if (this.placementGrid) {
      this.placementGrid.destroy();
      this.placementGrid = null;
    }
    
    if (this.placementUI) {
      this.placementUI.destroy();
      this.placementUI = null;
    }
    
    this.input.off('pointerdown', this.handleTowerPlacementClick, this);
  }

  placeTower(towerType, x, y, fromNetwork = false) {
    const towerData = TOWERS[towerType];
    const size = towerData.size * this.tileSize;
    
    // Create tower sprite (rectangle for now)
    const tower = this.add.rectangle(x, y, size - 4, size - 4, this.getTowerColor(towerType));
    tower.setStrokeStyle(2, 0x000000);
    tower.setDepth(y);
    
    // Add tower data
    tower.id = this.generateEntityId();
    tower.towerType = towerType;
    tower.towerData = towerData;
    tower.health = towerData.health;
    tower.maxHealth = towerData.health;
    tower.lastFireTime = 0;
    
    // Create health bar
    tower.healthBarBg = this.add.rectangle(x, y - size / 2 - 8, size, 6, 0x333333).setDepth(y + 1);
    tower.healthBarFill = this.add.rectangle(x, y - size / 2 - 8, size - 2, 4, 0x44ff44).setDepth(y + 2);
    
    // Add label
    tower.label = this.add.text(x, y, towerData.name.charAt(0), {
      fontSize: `${Math.max(12, size / 3)}px`,
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(y + 1);
    
    this.towers.add(tower);
    
    // Save to registry (only for host or single player)
    if (!this.isMultiplayer || this.isHost) {
      const savedTowers = this.registry.get('towers') || [];
      savedTowers.push({ type: towerType, x, y, health: towerData.health, id: tower.id });
      this.registry.set('towers', savedTowers);
    }
    
    // Broadcast to network if not from network
    if (this.isMultiplayer && !fromNetwork) {
      if (this.isHost) {
        // Host broadcasts to all clients
        this.networkManager.sendToAll(MessageTypes.TOWER_PLACE, {
          type: towerType,
          x: x,
          y: y,
          id: tower.id
        });
      } else {
        // Client requests placement from host
        this.networkManager.sendToHost(MessageTypes.TOWER_PLACE, {
          towerType: towerType,
          x: x,
          y: y
        });
      }
    }
    
    return tower;
  }

  getTowerColor(towerType) {
    const colors = {
      woodenTower: 0x8B4513,
      stoneTower: 0x808080,
      archerTower: 0x654321,
      cannonTower: 0x2F4F4F,
      fortress: 0x4a4a6a,
      crystalSpire: 0x9966ff
    };
    return colors[towerType] || 0x666666;
  }

  loadTowers() {
    const savedTowers = this.registry.get('towers') || [];
    savedTowers.forEach(t => {
      const tower = this.placeTower(t.type, t.x, t.y);
      if (tower && t.health !== undefined) {
        tower.health = t.health;
        this.updateTowerHealthBar(tower);
      }
    });
    // Clear and re-save to avoid duplicates
    this.registry.set('towers', savedTowers);
  }

  updateTowers(delta) {
    this.towers.getChildren().forEach(tower => {
      // Find nearest enemy in range
      let nearestEnemy = null;
      let nearestDist = tower.towerData.range;
      
      this.enemies.getChildren().forEach(enemy => {
        const dist = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.x, enemy.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      });
      
      // Fire at enemy if cooldown is ready
      if (nearestEnemy) {
        const now = this.time.now;
        if (now - tower.lastFireTime >= tower.towerData.fireRate) {
          this.towerFire(tower, nearestEnemy);
          tower.lastFireTime = now;
        }
      }
    });
  }

  towerFire(tower, target) {
    const projectile = this.add.circle(tower.x, tower.y, 4, this.getProjectileColor(tower.towerData.projectile));
    projectile.setDepth(2000);
    projectile.damage = tower.towerData.damage;
    projectile.target = target;
    projectile.speed = 300;
    projectile.tower = tower;
    
    this.projectiles.add(projectile);
    
    // Broadcast tower fire to clients
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.TOWER_FIRE, {
        towerId: tower.id,
        targetId: target.id,
        projectileType: tower.towerData.projectile
      });
    }
  }

  getProjectileColor(type) {
    const colors = {
      arrow: 0x8B4513,
      rock: 0x666666,
      cannonball: 0x222222,
      magic: 0xff66ff
    };
    return colors[type] || 0xffffff;
  }

  updateProjectiles(delta) {
    this.projectiles.getChildren().forEach(projectile => {
      if (!projectile.target || !projectile.target.active) {
        projectile.destroy();
        return;
      }
      
      // Move toward target
      const angle = Phaser.Math.Angle.Between(
        projectile.x, projectile.y,
        projectile.target.x, projectile.target.y
      );
      
      projectile.x += Math.cos(angle) * projectile.speed * (delta / 1000);
      projectile.y += Math.sin(angle) * projectile.speed * (delta / 1000);
      
      // Check hit
      const dist = Phaser.Math.Distance.Between(
        projectile.x, projectile.y,
        projectile.target.x, projectile.target.y
      );
      
      if (dist < 15) {
        // Deal damage
        projectile.target.health -= projectile.damage;
        
        // Update enemy health bar
        if (projectile.target.healthBarFill) {
          const healthPercent = projectile.target.health / projectile.target.maxHealth;
          projectile.target.healthBarFill.setScale(healthPercent, 1);
        }
        
        // Check if enemy died
        if (projectile.target.health <= 0) {
          this.killEnemy(projectile.target);
        }
        
        projectile.destroy();
      }
    });
  }

  damageTower(tower, amount) {
    // Only host processes tower damage in multiplayer
    if (this.isMultiplayer && !this.isHost) return;
    
    tower.health -= amount;
    this.updateTowerHealthBar(tower);
    
    // Broadcast damage to clients
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.TOWER_DAMAGE, {
        towerId: tower.id,
        damage: amount,
        health: tower.health
      });
    }
    
    if (tower.health <= 0) {
      this.destroyTower(tower);
    }
  }

  updateTowerHealthBar(tower) {
    const healthPercent = tower.health / tower.maxHealth;
    const size = tower.towerData.size * this.tileSize;
    tower.healthBarFill.setScale(healthPercent, 1);
    
    // Change color based on health
    if (healthPercent > 0.5) {
      tower.healthBarFill.setFillStyle(0x44ff44);
    } else if (healthPercent > 0.25) {
      tower.healthBarFill.setFillStyle(0xffaa00);
    } else {
      tower.healthBarFill.setFillStyle(0xff4444);
    }
  }

  destroyTower(tower) {
    // Show destruction effect
    this.showFloatingText(tower.x, tower.y - 20, `${tower.towerData.name} destroyed!`);
    
    // Broadcast destruction to clients
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.TOWER_DESTROY, {
        towerId: tower.id
      });
    }
    
    // Clean up
    if (tower.healthBarBg) tower.healthBarBg.destroy();
    if (tower.healthBarFill) tower.healthBarFill.destroy();
    if (tower.label) tower.label.destroy();
    
    // Remove from saved towers (only for host or single player)
    if (!this.isMultiplayer || this.isHost) {
      const savedTowers = this.registry.get('towers') || [];
      const index = savedTowers.findIndex(t => t.id === tower.id || (t.x === tower.x && t.y === tower.y));
      if (index !== -1) {
        savedTowers.splice(index, 1);
        this.registry.set('towers', savedTowers);
      }
    }
    
    tower.destroy();
  }

  // ========== END TOWER SYSTEM ==========

  createEnemy(x, y, type) {
    const enemyData = ENEMIES[type];
    if (!enemyData) return;
    
    const enemy = this.physics.add.sprite(x, y, type);
    enemy.id = this.generateEntityId(); // Add unique ID for network sync
    enemy.enemyType = type;
    enemy.enemyData = enemyData;
    enemy.health = enemyData.health;
    enemy.maxHealth = enemyData.health;
    enemy.setDepth(y);
    enemy.targetX = x; // For client interpolation
    enemy.targetY = y;
    
    // Create health bar
    enemy.healthBarBg = this.add.image(x, y - 20, 'healthBarBg').setDepth(y + 1);
    enemy.healthBarFill = this.add.image(x, y - 20, 'healthBarFill').setDepth(y + 2);
    
    // Movement AI
    enemy.moveTimer = 0;
    enemy.moveDirection = { x: 0, y: 0 };
    
    this.enemies.add(enemy);
    
    // Broadcast spawn to clients if host
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.ENEMY_SPAWN, {
        id: enemy.id,
        x: x,
        y: y,
        type: type,
        health: enemy.health
      });
    }
    
    return enemy;
  }

  updateEnemies(delta) {
    this.enemies.getChildren().forEach(enemy => {
      // Update health bar position
      enemy.healthBarBg.setPosition(enemy.x, enemy.y - 20);
      enemy.healthBarFill.setPosition(enemy.x - 1, enemy.y - 20);
      const healthPercent = enemy.health / enemy.maxHealth;
      enemy.healthBarFill.setScale(healthPercent, 1);
      
      // Simple AI - move towards player if close, wander otherwise
      const distToPlayer = Phaser.Math.Distance.Between(
        enemy.x, enemy.y, this.player.x, this.player.y
      );
      
      // Check for nearby towers to attack
      let nearestTower = null;
      let nearestTowerDist = 100; // Tower aggro range
      
      this.towers.getChildren().forEach(tower => {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, tower.x, tower.y);
        if (dist < nearestTowerDist) {
          nearestTowerDist = dist;
          nearestTower = tower;
        }
      });
      
      if (nearestTower && nearestTowerDist < distToPlayer) {
        // Attack tower instead of player
        const angle = Phaser.Math.Angle.Between(
          enemy.x, enemy.y, nearestTower.x, nearestTower.y
        );
        enemy.setVelocity(
          Math.cos(angle) * enemy.enemyData.speed,
          Math.sin(angle) * enemy.enemyData.speed
        );
        
        // Attack tower if close
        const towerSize = nearestTower.towerData.size * this.tileSize / 2;
        if (nearestTowerDist < towerSize + 20) {
          this.enemyAttackTower(enemy, nearestTower);
        }
      } else if (distToPlayer < 150) {
        // Chase player
        const angle = Phaser.Math.Angle.Between(
          enemy.x, enemy.y, this.player.x, this.player.y
        );
        enemy.setVelocity(
          Math.cos(angle) * enemy.enemyData.speed,
          Math.sin(angle) * enemy.enemyData.speed
        );
        
        // Attack if close
        if (distToPlayer < 30) {
          this.enemyAttackPlayer(enemy);
        }
      } else {
        // Wander
        enemy.moveTimer -= delta;
        if (enemy.moveTimer <= 0) {
          enemy.moveTimer = 2000 + Math.random() * 2000;
          const angle = Math.random() * Math.PI * 2;
          enemy.moveDirection = {
            x: Math.cos(angle) * enemy.enemyData.speed * 0.5,
            y: Math.sin(angle) * enemy.enemyData.speed * 0.5
          };
        }
        enemy.setVelocity(enemy.moveDirection.x, enemy.moveDirection.y);
      }
      
      // Keep in bounds
      enemy.x = Phaser.Math.Clamp(enemy.x, 50, this.worldWidth - 50);
      enemy.y = Phaser.Math.Clamp(enemy.y, 50, this.worldHeight - 50);
      
      enemy.setDepth(enemy.y);
    });
  }

  enemyAttackPlayer(enemy) {
    if (!enemy.lastAttack) enemy.lastAttack = 0;
    
    const now = this.time.now;
    if (now - enemy.lastAttack < 1000) return; // 1 second cooldown
    
    enemy.lastAttack = now;
    
    const health = this.registry.get('health');
    const newHealth = Math.max(0, health - enemy.enemyData.damage);
    this.registry.set('health', newHealth);
    
    this.showFloatingText(this.player.x, this.player.y - 30, `-${enemy.enemyData.damage} HP`);
    this.player.setTint(0xff6666);
    this.time.delayedCall(200, () => this.player.clearTint());
    
    if (newHealth <= 0) {
      this.playerDeath();
    }
  }

  enemyAttackTower(enemy, tower) {
    if (!enemy.lastAttack) enemy.lastAttack = 0;
    
    const now = this.time.now;
    if (now - enemy.lastAttack < 1000) return; // 1 second cooldown
    
    enemy.lastAttack = now;
    
    this.damageTower(tower, enemy.enemyData.damage);
    this.showFloatingText(tower.x, tower.y - 20, `-${enemy.enemyData.damage}`);
  }

  handleCombat(delta) {
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    
    // Check for attack input
    const attackBinding = this.getAttackKeyName();
    let shouldAttack = false;
    
    if (attackBinding === 'MOUSE1') {
      // Left mouse button
      shouldAttack = this.input.activePointer.leftButtonDown() && !this.wasLeftMouseDown;
      this.wasLeftMouseDown = this.input.activePointer.leftButtonDown();
    } else if (attackBinding === 'MOUSE2') {
      // Right mouse button
      shouldAttack = this.input.activePointer.rightButtonDown() && !this.wasRightMouseDown;
      this.wasRightMouseDown = this.input.activePointer.rightButtonDown();
    } else {
      // Keyboard key
      const attackKeyObj = this.customKeys?.attack || this.attackKey;
      shouldAttack = Phaser.Input.Keyboard.JustDown(attackKeyObj);
    }
    
    if (shouldAttack && this.attackCooldown <= 0) {
      this.performAttack();
    }
  }

  performAttack() {
    const currentTool = this.registry.get('currentTool');
    const toolData = TOOLS[currentTool];
    const toolType = toolData?.type || 'fists';
    
    // Get attack properties from tool data or use defaults
    const attackProps = toolData?.attack || { range: 25, arc: 0.8, speed: 350, knockback: 50 };
    
    // Calculate damage based on tool
    let damage = 5; // Base damage with hands
    if (toolData) {
      damage = toolData.power * 3;
      // Combat weapons do extra damage
      if (['sword', 'dagger', 'spear', 'battleaxe', 'hammer'].includes(toolType)) {
        damage *= 1.5;
      }
    }
    
    const attackRange = attackProps.range;
    const attackArc = attackProps.arc;
    const cooldown = attackProps.speed;
    const knockback = attackProps.knockback;
    
    // Hit delay based on weapon type
    let hitDelay = cooldown * 0.3;
    if (toolType === 'dagger') hitDelay = cooldown * 0.15;
    else if (toolType === 'spear') hitDelay = cooldown * 0.4;
    else if (toolType === 'hammer' || toolType === 'battleaxe') hitDelay = cooldown * 0.5;
    
    this.attackCooldown = cooldown;
    this.isAttacking = true;
    this.currentAttackKnockback = knockback;
    
    // Determine attack direction based on movement or facing
    const attackDir = this.getAttackDirection();
    const attackAngle = Math.atan2(attackDir.y, attackDir.x);
    
    // Delay the actual hit to match animation
    this.time.delayedCall(hitDelay, () => {
      this.executeAttackHit(attackAngle, attackRange, attackArc, damage, toolType, attackDir);
    });
    
    // End attack state
    this.time.delayedCall(cooldown * 0.6, () => {
      this.isAttacking = false;
    });
  }

  getAttackDirection() {
    // Check if player is moving - use movement direction
    const vx = this.player.body.velocity.x;
    const vy = this.player.body.velocity.y;
    
    if (Math.abs(vx) > 10 || Math.abs(vy) > 10) {
      // Normalize to 4 directions
      if (Math.abs(vx) > Math.abs(vy)) {
        return { x: vx > 0 ? 1 : -1, y: 0, dir: vx > 0 ? 'right' : 'left' };
      } else {
        return { x: 0, y: vy > 0 ? 1 : -1, dir: vy > 0 ? 'down' : 'up' };
      }
    }
    
    // Use facing direction if not moving
    return { x: this.player.flipX ? -1 : 1, y: 0, dir: this.player.flipX ? 'left' : 'right' };
  }

  executeAttackHit(attackAngle, attackRange, attackArc, damage, toolType, attackDir) {
    // Create visual hitbox indicator
    this.showAttackEffect(attackAngle, attackRange, toolType, attackDir);
    
    // Broadcast attack to network
    if (this.isMultiplayer) {
      this.networkManager.broadcast(MessageTypes.ATTACK_START, {
        x: this.player.x,
        y: this.player.y,
        angle: attackAngle,
        range: attackRange,
        arc: attackArc,
        damage: damage,
        toolType: toolType,
        attackDir: attackDir,
        playerNumber: this.playerNumber
      });
    }
    
    // Only host processes damage in multiplayer
    if (this.isMultiplayer && !this.isHost) return;
    
    // Find enemies in the attack arc
    this.enemies.getChildren().forEach(enemy => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, enemy.x, enemy.y
      );
      
      if (dist > attackRange) return;
      
      // Check if enemy is within attack arc
      const angleToEnemy = Phaser.Math.Angle.Between(
        this.player.x, this.player.y, enemy.x, enemy.y
      );
      
      let angleDiff = Math.abs(angleToEnemy - attackAngle);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      
      if (angleDiff <= attackArc / 2) {
        this.damageEnemy(enemy, damage);
      }
    });
  }

  showAttackEffect(attackAngle, range, toolType, attackDir) {
    const px = this.player.x;
    const py = this.player.y;
    
    switch (toolType) {
      case 'sword':
        this.showSwordSlash(px, py, range, attackDir);
        break;
      case 'axe':
        this.showAxeChop(px, py, range, attackDir);
        break;
      case 'battleaxe':
        this.showBattleAxeSweep(px, py, range, attackDir);
        break;
      case 'pickaxe':
        this.showPickaxeStab(px, py, range, attackDir);
        break;
      case 'dagger':
        this.showDaggerStab(px, py, range, attackDir);
        break;
      case 'spear':
        this.showSpearThrust(px, py, range, attackDir);
        break;
      case 'hammer':
        this.showHammerSmash(px, py, range, attackDir);
        break;
      default:
        this.showPunchEffect(px, py, attackDir);
    }
  }

  // SWORD: Horizontal arc slash
  showSwordSlash(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    const baseAngle = Math.atan2(dirY, dirX);
    const arcSize = 0.45; // ~52 degrees total arc
    
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 18, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const progress = i / 4;
        const currentAngle = baseAngle - arcSize + (arcSize * 2 * progress);
        
        // Draw blade trail
        graphics.lineStyle(4 - i * 0.6, 0xc0e0ff, 0.9 - i * 0.15);
        graphics.beginPath();
        
        const startR = 12;
        const endR = range * 0.95;
        graphics.moveTo(px + Math.cos(currentAngle) * startR, py + Math.sin(currentAngle) * startR);
        graphics.lineTo(px + Math.cos(currentAngle) * endR, py + Math.sin(currentAngle) * endR);
        graphics.strokePath();
        
        // Blade gleam
        if (i === 2) {
          graphics.fillStyle(0xffffff, 0.8);
          graphics.fillCircle(px + Math.cos(currentAngle) * endR, py + Math.sin(currentAngle) * endR, 3);
        }
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 60,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // AXE: Overhead chop arc
  showAxeChop(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    const baseAngle = Math.atan2(dirY, dirX);
    const perpAngle = baseAngle - Math.PI / 2;
    
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 30, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const progress = i / 3;
        // Arc from above to below
        const swingAngle = baseAngle + (0.35 - progress * 0.7);
        
        graphics.lineStyle(5 - i, 0xffaa55, 0.8 - i * 0.15);
        graphics.beginPath();
        
        const handleLen = 15;
        const bladeLen = range * 0.7;
        const hx = px + Math.cos(swingAngle) * handleLen;
        const hy = py + Math.sin(swingAngle) * handleLen;
        const bx = px + Math.cos(swingAngle) * bladeLen;
        const by = py + Math.sin(swingAngle) * bladeLen;
        
        graphics.moveTo(hx, hy);
        graphics.lineTo(bx, by);
        graphics.strokePath();
        
        // Axe head
        graphics.fillStyle(0x888888, 0.7);
        const headAngle = swingAngle + Math.PI / 2;
        graphics.fillRect(bx - 4, by - 4, 8, 8);
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 50,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // BATTLE AXE: Wide sweeping horizontal arc
  showBattleAxeSweep(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    const baseAngle = Math.atan2(dirY, dirX);
    const arcSize = 0.7; // Wide sweep
    
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 25, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const progress = i / 5;
        const currentAngle = baseAngle - arcSize + (arcSize * 2 * progress);
        
        // Heavy blade trail
        graphics.lineStyle(6 - i * 0.8, 0xff6633, 0.85 - i * 0.12);
        graphics.beginPath();
        
        const startR = 18;
        const endR = range * 0.9;
        graphics.moveTo(px + Math.cos(currentAngle) * startR, py + Math.sin(currentAngle) * startR);
        graphics.lineTo(px + Math.cos(currentAngle) * endR, py + Math.sin(currentAngle) * endR);
        graphics.strokePath();
        
        // Large axe head
        graphics.fillStyle(0x666666, 0.6);
        const headX = px + Math.cos(currentAngle) * endR;
        const headY = py + Math.sin(currentAngle) * endR;
        graphics.fillCircle(headX, headY, 6);
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 70,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // PICKAXE: Forward poke/stab
  showPickaxeStab(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 35, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const progress = i / 2;
        const reach = 0.4 + progress * 0.6;
        
        graphics.lineStyle(3, 0x999999, 0.7 - i * 0.2);
        graphics.beginPath();
        
        const tipX = px + dirX * range * reach;
        const tipY = py + dirY * range * reach;
        
        graphics.moveTo(px + dirX * 10, py + dirY * 10);
        graphics.lineTo(tipX, tipY);
        graphics.strokePath();
        
        // Pickaxe point
        graphics.fillStyle(0x777777, 0.6);
        graphics.beginPath();
        graphics.moveTo(tipX, tipY);
        graphics.lineTo(tipX - dirY * 5 - dirX * 3, tipY + dirX * 5 - dirY * 3);
        graphics.lineTo(tipX + dirY * 5 - dirX * 3, tipY - dirX * 5 - dirY * 3);
        graphics.closePath();
        graphics.fillPath();
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 60,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // DAGGER: Quick double stab
  showDaggerStab(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    
    // Two quick stabs
    for (let stab = 0; stab < 2; stab++) {
      this.time.delayedCall(stab * 60, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const offsetX = (stab === 0 ? -1 : 1) * dirY * 5;
        const offsetY = (stab === 0 ? 1 : -1) * dirX * 5;
        
        // Quick thrust line
        graphics.lineStyle(2, 0xdddddd, 0.9);
        graphics.beginPath();
        graphics.moveTo(px + offsetX, py + offsetY);
        graphics.lineTo(px + dirX * range + offsetX, py + dirY * range + offsetY);
        graphics.strokePath();
        
        // Blade glint
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(px + dirX * range * 0.8 + offsetX, py + dirY * range * 0.8 + offsetY, 2);
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 40,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // SPEAR: Long thrust with reach indicator
  showSpearThrust(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 30, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const progress = i / 3;
        const reach = 0.3 + progress * 0.7;
        
        // Long shaft
        graphics.lineStyle(2, 0x8B4513, 0.7);
        graphics.beginPath();
        graphics.moveTo(px, py);
        graphics.lineTo(px + dirX * range * reach * 0.7, py + dirY * range * reach * 0.7);
        graphics.strokePath();
        
        // Spear tip
        graphics.lineStyle(3, 0xaaaaaa, 0.8 - i * 0.15);
        graphics.beginPath();
        graphics.moveTo(px + dirX * range * reach * 0.6, py + dirY * range * reach * 0.6);
        graphics.lineTo(px + dirX * range * reach, py + dirY * range * reach);
        graphics.strokePath();
        
        // Point
        if (i === 2 || i === 3) {
          graphics.fillStyle(0xcccccc, 0.7);
          const tipX = px + dirX * range * reach;
          const tipY = py + dirY * range * reach;
          graphics.beginPath();
          graphics.moveTo(tipX + dirX * 6, tipY + dirY * 6);
          graphics.lineTo(tipX - dirY * 3, tipY + dirX * 3);
          graphics.lineTo(tipX + dirY * 3, tipY - dirX * 3);
          graphics.closePath();
          graphics.fillPath();
        }
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 50,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // HAMMER: Overhead smash with impact
  showHammerSmash(px, py, range, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    const baseAngle = Math.atan2(dirY, dirX);
    
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 40, () => {
        const graphics = this.add.graphics();
        graphics.setDepth(2500);
        
        const progress = i / 3;
        // Arc from raised to smashed
        const swingAngle = baseAngle + (0.5 - progress * 1.0);
        const reach = 0.5 + progress * 0.5;
        
        // Handle
        graphics.lineStyle(4, 0x8B4513, 0.7);
        graphics.beginPath();
        graphics.moveTo(px, py);
        const handleEnd = range * reach * 0.5;
        graphics.lineTo(px + Math.cos(swingAngle) * handleEnd, py + Math.sin(swingAngle) * handleEnd);
        graphics.strokePath();
        
        // Hammer head
        const headX = px + Math.cos(swingAngle) * range * reach * 0.7;
        const headY = py + Math.sin(swingAngle) * range * reach * 0.7;
        graphics.fillStyle(0x555555, 0.8 - i * 0.15);
        graphics.fillRect(headX - 6, headY - 6, 12, 12);
        
        // Impact effect on final frame
        if (i === 3) {
          graphics.lineStyle(2, 0xffff00, 0.6);
          for (let j = 0; j < 4; j++) {
            const impactAngle = (j / 4) * Math.PI * 2;
            graphics.beginPath();
            graphics.moveTo(headX, headY);
            graphics.lineTo(headX + Math.cos(impactAngle) * 12, headY + Math.sin(impactAngle) * 12);
            graphics.strokePath();
          }
        }
        
        this.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 60,
          onComplete: () => graphics.destroy()
        });
      });
    }
  }

  // FISTS: Quick punch
  showPunchEffect(px, py, attackDir) {
    const { x: dirX, y: dirY } = attackDir;
    
    const graphics = this.add.graphics();
    graphics.setDepth(2500);
    
    const impactX = px + dirX * 22;
    const impactY = py + dirY * 22;
    
    // Fist shape
    graphics.fillStyle(0xffcc99, 0.8);
    graphics.fillCircle(impactX, impactY, 5);
    
    // Impact lines
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
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 80,
      onComplete: () => graphics.destroy()
    });
  }

  damageEnemy(enemy, damage) {
    // Only host processes damage in multiplayer
    if (this.isMultiplayer && !this.isHost) return;
    
    enemy.health -= damage;
    
    this.showFloatingText(enemy.x, enemy.y - 30, `-${damage}`);
    enemy.setTint(0xff4444);
    this.time.delayedCall(100, () => enemy.clearTint());
    
    // Knockback using weapon's knockback value
    const knockback = this.currentAttackKnockback || 100;
    const angle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y, enemy.x, enemy.y
    );
    enemy.setVelocity(
      Math.cos(angle) * knockback,
      Math.sin(angle) * knockback
    );
    
    // Broadcast damage to clients
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.DAMAGE_DEALT, {
        enemyId: enemy.id,
        damage: damage,
        newHealth: enemy.health
      });
    }
    
    if (enemy.health <= 0) {
      this.killEnemy(enemy);
    }
  }

  killEnemy(enemy) {
    // Drop loot
    const drops = enemy.enemyData.drops;
    const inventory = this.registry.get('inventory');
    
    Object.entries(drops).forEach(([resource, amount]) => {
      inventory[resource] = (inventory[resource] || 0) + amount;
      this.showFloatingText(enemy.x, enemy.y - 20, `+${amount} ${RESOURCES[resource].name}`);
    });
    
    this.registry.set('inventory', inventory);
    
    // Add XP
    const xp = this.registry.get('xp');
    this.registry.set('xp', xp + enemy.enemyData.xp);
    this.checkLevelUp();
    
    // Broadcast death to clients if host
    if (this.isMultiplayer && this.isHost) {
      this.networkManager.sendToAll(MessageTypes.ENEMY_DEATH, {
        enemyId: enemy.id,
        drops: drops,
        position: { x: enemy.x, y: enemy.y }
      });
    }
    
    // Clean up
    const oldX = enemy.x;
    const oldY = enemy.y;
    const enemyType = enemy.enemyType;
    enemy.healthBarBg.destroy();
    enemy.healthBarFill.destroy();
    enemy.destroy();
    
    // Find which land tile this enemy was on (only host respawns)
    if (!this.isMultiplayer || this.isHost) {
      const gx = Math.floor(oldX / (this.landTileSize * this.tileSize));
      const gy = Math.floor(oldY / (this.landTileSize * this.tileSize));
      const landKey = `${gx},${gy}`;
      const landType = this.unlockedLands[landKey];
      
      // Respawn after delay in the same land tile
      if (landType) {
        this.time.delayedCall(15000 + Math.random() * 15000, () => {
          const startX = gx * this.landTileSize * this.tileSize;
          const startY = gy * this.landTileSize * this.tileSize;
          const x = startX + (1 + Math.random() * (this.landTileSize - 2)) * this.tileSize;
          const y = startY + (1 + Math.random() * (this.landTileSize - 2)) * this.tileSize;
          this.createEnemy(x, y, enemyType);
        });
      }
    }
  }

  playerDeath() {
    this.showFloatingText(this.player.x, this.player.y - 50, 'You died!');
    
    // Respawn with half resources
    const inventory = this.registry.get('inventory');
    Object.keys(inventory).forEach(key => {
      inventory[key] = Math.floor(inventory[key] / 2);
    });
    this.registry.set('inventory', inventory);
    
    // Reset health and energy
    this.registry.set('health', 100);
    this.registry.set('energy', ENERGY.max);
    
    // Teleport to center
    this.player.setPosition(this.worldWidth / 2, this.worldHeight / 2);
  }

  handleEnergy(delta) {
    const energy = this.registry.get('energy');
    
    if (this.isResting) {
      // Fast restore when resting in house
      const newEnergy = Math.min(ENERGY.max, energy + (ENERGY.restorePerSecond * delta / 1000));
      this.registry.set('energy', newEnergy);
      
      // Also restore health
      const health = this.registry.get('health');
      const newHealth = Math.min(100, health + (10 * delta / 1000));
      this.registry.set('health', newHealth);
    } else if (!this.isMining && this.player.body.velocity.length() < 10) {
      // Slow restore when idle
      const newEnergy = Math.min(ENERGY.max, energy + (ENERGY.restorePerSecondIdle * delta / 1000));
      this.registry.set('energy', newEnergy);
    }
  }

  checkNearbyBuilding() {
    let nearest = null;
    let minDist = Infinity;
    
    // Check buildings only (land markers are now mouse-clickable)
    this.buildings.getChildren().forEach(building => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, building.x, building.y
      );
      
      if (dist < minDist) {
        minDist = dist;
        nearest = building;
      }
    });
    
    if (nearest && minDist < 60) {
      this.nearbyBuilding = nearest;
      this.interactPrompt.setPosition(nearest.x, nearest.y - 50);
      const interactKey = this.getInteractKeyName();
      this.interactPrompt.setText(`[${interactKey}] ${BUILDINGS[nearest.buildingType]?.name || nearest.buildingType}`);
      this.interactPrompt.setVisible(true);
    } else {
      this.nearbyBuilding = null;
      this.interactPrompt.setVisible(false);
      this.isResting = false;
    }
  }

  handleInteraction() {
    const interactKeyObj = this.customKeys?.interact || this.interactKey;
    if (Phaser.Input.Keyboard.JustDown(interactKeyObj)) {
      if (this.nearbyBuilding) {
        this.interactWithBuilding(this.nearbyBuilding);
      }
    }
  }

  interactWithBuilding(building) {
    const type = building.buildingType;
    
    switch (type) {
      case 'workbench':
        this.events.emit('openWorkbench');
        break;
      case 'forge':
        this.events.emit('openForge');
        break;
      case 'storage':
        this.events.emit('openStorage');
        break;
      case 'house':
        this.isResting = !this.isResting;
        if (this.isResting) {
          this.showFloatingText(this.player.x, this.player.y - 30, 'Resting...');
        }
        break;
      case 'portal':
        this.events.emit('openPortal');
        break;
      case 'mine':
        this.events.emit('openMine');
        break;
    }
  }

  saveGame() {
    // Only host saves in multiplayer
    if (this.isMultiplayer && !this.isHost) return;
    
    // Calculate total play time
    const currentSessionTime = Date.now() - this.sessionStartTime;
    const totalPlayTime = this.playTime + currentSessionTime;
    
    // Get towers data
    const towersData = [];
    this.towers.getChildren().forEach(tower => {
      towersData.push({
        type: tower.towerType,
        x: tower.x,
        y: tower.y,
        health: tower.health,
        id: tower.id
      });
    });
    
    const saveData = {
      inventory: this.registry.get('inventory'),
      inventorySlots: this.registry.get('inventorySlots'),
      hotbar: this.registry.get('hotbar'),
      equipment: this.registry.get('equipment'),
      unlockedLands: this.registry.get('unlockedLands'),
      buildings: this.registry.get('buildings'),
      towers: towersData,
      currentTool: this.registry.get('currentTool'),
      tools: this.registry.get('tools'),
      upgrades: this.registry.get('upgrades'),
      xp: this.registry.get('xp'),
      level: this.registry.get('level'),
      energy: this.registry.get('energy'),
      health: this.registry.get('health'),
      storage: this.registry.get('storage'),
      playTime: totalPlayTime,
      lastPlayed: Date.now(),
      worldSeed: this.worldSeed
    };
    
    // For multiplayer, save all player data
    if (this.isMultiplayer) {
      saveData.isMultiplayer = true;
      saveData.roomCode = this.networkManager.getRoomCode();
      saveData.playerPosition = { x: this.player.x, y: this.player.y };
      
      // Save each player's data
      saveData.players = {};
      
      // Host (P1) data
      saveData.players[1] = {
        inventory: this.registry.get('inventory'),
        inventorySlots: this.registry.get('inventorySlots'),
        hotbar: this.registry.get('hotbar'),
        equipment: this.registry.get('equipment'),
        tools: this.registry.get('tools'),
        upgrades: this.registry.get('upgrades'),
        xp: this.registry.get('xp'),
        level: this.registry.get('level'),
        position: { x: this.player.x, y: this.player.y }
      };
      
      // Include cached player data from clients
      if (this.playerSaveData) {
        Object.keys(this.playerSaveData).forEach(playerNum => {
          if (playerNum != 1) { // Don't overwrite host data
            saveData.players[playerNum] = this.playerSaveData[playerNum];
          }
        });
      }
      
      // Also store remote player positions as fallback
      this.remotePlayers.forEach((player, peerId) => {
        const playerNum = player.playerNumber;
        if (!saveData.players[playerNum]) {
          saveData.players[playerNum] = {
            position: { x: player.x, y: player.y }
          };
        } else if (saveData.players[playerNum]) {
          // Update position
          saveData.players[playerNum].position = { x: player.x, y: player.y };
        }
      });
    }
    
    // Use save key from registry (set by BootScene)
    const saveKey = this.registry.get('saveKey') || 'forger2_save_0';
    console.log('Saving game to:', saveKey, 'isMultiplayer:', this.isMultiplayer);
    localStorage.setItem(saveKey, JSON.stringify(saveData));
  }
  
  // Request player data from all clients for saving
  requestPlayerDataForSave() {
    if (!this.isMultiplayer || !this.isHost) return;
    
    this.networkManager.sendToAll(MessageTypes.INVENTORY_REQUEST, {});
  }
  
  // Handle inventory data from clients
  handlePlayerInventoryData(data, peerId) {
    // Store player data for next save
    const playerNum = data.playerNumber;
    this.playerSaveData = this.playerSaveData || {};
    this.playerSaveData[playerNum] = data;
  }

  getInteractKeyName() {
    // Get from settings stored in localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('forger2_settings') || '{}');
      return settings.controls?.interact || 'E';
    } catch (e) {
      return 'E';
    }
  }

  getHarvestKeyName() {
    try {
      const settings = JSON.parse(localStorage.getItem('forger2_settings') || '{}');
      return settings.controls?.harvest || 'SPACE';
    } catch (e) {
      return 'SPACE';
    }
  }

  getAttackKeyName() {
    try {
      const settings = JSON.parse(localStorage.getItem('forger2_settings') || '{}');
      return settings.controls?.attack || 'F';
    } catch (e) {
      return 'F';
    }
  }

  addToInventory(itemKey, count = 1) {
    const inventory = this.registry.get('inventorySlots') || [];
    
    // Try to stack with existing
    const existingSlot = inventory.findIndex(slot => 
      slot && slot.item === itemKey && slot.count < 99
    );
    
    if (existingSlot !== -1) {
      inventory[existingSlot].count += count;
      this.registry.set('inventorySlots', inventory);
      return true;
    }
    
    // Find empty slot
    const emptySlot = inventory.findIndex(slot => !slot || !slot.item);
    if (emptySlot !== -1) {
      inventory[emptySlot] = { item: itemKey, count: count };
      this.registry.set('inventorySlots', inventory);
      return true;
    }
    
    return false; // Inventory full
  }

  removeFromInventory(itemKey, count = 1) {
    const inventory = this.registry.get('inventorySlots') || [];
    let remaining = count;
    
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      if (inventory[i] && inventory[i].item === itemKey) {
        const take = Math.min(remaining, inventory[i].count);
        inventory[i].count -= take;
        remaining -= take;
        
        if (inventory[i].count <= 0) {
          inventory[i] = null;
        }
      }
    }
    
    this.registry.set('inventorySlots', inventory);
    
    // Also update old inventory for compatibility
    const oldInv = this.registry.get('inventory');
    oldInv[itemKey] = Math.max(0, (oldInv[itemKey] || 0) - count);
    if (oldInv[itemKey] <= 0) delete oldInv[itemKey];
    this.registry.set('inventory', oldInv);
    
    return remaining === 0;
  }

  hasInInventory(itemKey, count = 1) {
    const inventory = this.registry.get('inventorySlots') || [];
    let total = 0;
    inventory.forEach(slot => {
      if (slot && slot.item === itemKey) {
        total += slot.count;
      }
    });
    return total >= count;
  }

  // ========== SEEDED RANDOM FOR MULTIPLAYER SYNC ==========
  
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Seeded random number generator for consistent world generation
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
  
  // Get a seeded random value for a specific position
  getSeededRandomForPosition(x, y, offset = 0) {
    const seed = this.worldSeed + x * 73856093 + y * 19349663 + offset * 83492791;
    return this.seededRandom(seed);
  }
}
