import { SpriteGenerator } from '../utils/SpriteGenerator.js';
import { ENERGY } from '../data/GameData.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Generate all procedural sprites
    const spriteGen = new SpriteGenerator(this);
    spriteGen.generateAllSprites();

    // Check for multiplayer mode
    const isMultiplayer = this.registry.get('isMultiplayer') || false;
    const isHost = this.registry.get('isHost') || false;
    const playerNumber = this.registry.get('playerNumber') || 1;

    // Get save slot from registry (set by MainMenuScene or MultiplayerMenuScene)
    const saveSlot = this.registry.get('currentSaveSlot') ?? 0;
    const isNewGame = this.registry.get('isNewGame') ?? false;
    
    // Use saveKey from registry if already set (multiplayer sets this directly)
    // Otherwise construct from saveSlot
    let saveKey = this.registry.get('saveKey');
    if (!saveKey) {
      saveKey = typeof saveSlot === 'string' ? `forger2_save_${saveSlot}` : `forger2_save_${saveSlot}`;
    }
    
    // Store current save key for GameScene to use
    this.registry.set('saveKey', saveKey);
    console.log('BootScene saveKey:', saveKey);

    // For multiplayer clients, initialize minimal state (will receive from host)
    if (isMultiplayer && !isHost) {
      this.initClientGame(playerNumber);
    } else {
      // Single player or Host: Normal initialization
      // Try to load saved game
      const savedGame = localStorage.getItem(saveKey);
      if (savedGame && !isNewGame) {
        try {
          const data = JSON.parse(savedGame);
          // Old inventory format (object) - convert to new slot-based format
          if (data.inventory && !Array.isArray(data.inventorySlots)) {
            this.registry.set('inventorySlots', this.convertOldInventory(data.inventory));
          } else {
            this.registry.set('inventorySlots', data.inventorySlots || new Array(32).fill(null));
          }
          this.registry.set('inventory', data.inventory || {}); // Keep for compatibility
          this.registry.set('hotbar', data.hotbar || new Array(6).fill(null));
          this.registry.set('equipment', data.equipment || {});
          this.registry.set('unlockedLands', data.unlockedLands || {});
          this.registry.set('buildings', data.buildings || []);
          this.registry.set('towers', data.towers || []);
          this.registry.set('currentTool', data.currentTool || 'hands');
          this.registry.set('tools', data.tools || ['hands']);
          this.registry.set('storedTools', data.storedTools || []);
          this.registry.set('upgrades', data.upgrades || {
            miningSpeed: 0,
            harvestYield: 0,
            moveSpeed: 0,
            inventorySize: 0
          });
          this.registry.set('xp', data.xp || 0);
          this.registry.set('level', data.level || 1);
          this.registry.set('energy', data.energy || ENERGY.max);
          this.registry.set('health', data.health || 100);
          this.registry.set('storage', data.storage || {});
          this.registry.set('playTime', data.playTime || 0);
        } catch (e) {
          this.initNewGame();
        }
      } else {
        this.initNewGame();
      }
    }

    // Start game scenes
    this.scene.start('GameScene');
    this.scene.start('UIScene');
  }
  
  initClientGame(playerNumber) {
    // Check if there's saved player data for this player
    const saveSlot = this.registry.get('currentSaveSlot');
    const saveKey = this.registry.get('saveKey') || `forger2_save_mp_${saveSlot}`;
    const isNewGame = this.registry.get('isNewGame');
    
    let playerData = null;
    
    // Try to load saved player data
    if (!isNewGame) {
      try {
        const savedGame = localStorage.getItem(saveKey);
        if (savedGame) {
          const data = JSON.parse(savedGame);
          if (data.players && data.players[playerNumber]) {
            playerData = data.players[playerNumber];
          }
        }
      } catch (e) {
        console.log('No saved player data found');
      }
    }
    
    if (playerData) {
      // Load saved player data
      this.registry.set('inventory', playerData.inventory || {});
      this.registry.set('inventorySlots', playerData.inventorySlots || new Array(32).fill(null));
      this.registry.set('hotbar', playerData.hotbar || new Array(6).fill(null));
      this.registry.set('equipment', playerData.equipment || {});
      this.registry.set('tools', playerData.tools || ['hands']);
      this.registry.set('upgrades', playerData.upgrades || {
        miningSpeed: 0,
        harvestYield: 0,
        moveSpeed: 0,
        inventorySize: 0
      });
      this.registry.set('xp', playerData.xp || 0);
      this.registry.set('level', playerData.level || 1);
      this.registry.set('currentTool', 'hands');
      this.registry.set('energy', ENERGY.max);
      this.registry.set('health', 100);
    } else {
      // New player - minimal initialization
      this.registry.set('inventory', {});
      this.registry.set('inventorySlots', new Array(32).fill(null));
      this.registry.set('hotbar', new Array(6).fill(null));
      this.registry.set('equipment', {});
      this.registry.set('currentTool', 'hands');
      this.registry.set('tools', ['hands']);
      this.registry.set('storedTools', []);
      this.registry.set('upgrades', {
        miningSpeed: 0,
        harvestYield: 0,
        moveSpeed: 0,
        inventorySize: 0
      });
      this.registry.set('xp', 0);
      this.registry.set('level', 1);
      this.registry.set('energy', ENERGY.max);
      this.registry.set('health', 100);
    }
    
    // World state will be synced from host
    this.registry.set('unlockedLands', {});
    this.registry.set('buildings', []);
    this.registry.set('towers', []);
    this.registry.set('storage', {});
    this.registry.set('playTime', 0);
  }

  initNewGame() {
    this.registry.set('inventory', {}); // Keep for compatibility
    this.registry.set('inventorySlots', new Array(32).fill(null));
    this.registry.set('hotbar', new Array(6).fill(null));
    this.registry.set('equipment', {});
    this.registry.set('unlockedLands', {}); // Will be initialized in GameScene
    this.registry.set('buildings', []);
    this.registry.set('towers', []);
    this.registry.set('currentTool', 'hands');
    this.registry.set('tools', ['hands']);
    this.registry.set('storedTools', []);
    this.registry.set('upgrades', {
      miningSpeed: 0,
      harvestYield: 0,
      moveSpeed: 0,
      inventorySize: 0
    });
    this.registry.set('xp', 0);
    this.registry.set('level', 1);
    this.registry.set('energy', ENERGY.max);
    this.registry.set('health', 100);
    this.registry.set('storage', {});
    this.registry.set('playTime', 0);
  }

  convertOldInventory(oldInventory) {
    // Convert old {wood: 10, stone: 5} format to new slot-based format
    const slots = new Array(32).fill(null);
    let slotIndex = 0;
    
    Object.entries(oldInventory).forEach(([item, count]) => {
      if (count > 0 && slotIndex < 32) {
        slots[slotIndex] = { item, count };
        slotIndex++;
      }
    });
    
    return slots;
  }
}
