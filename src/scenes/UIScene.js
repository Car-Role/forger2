import { RESOURCES, TOOLS, BUILDINGS, TOWERS, UPGRADES, SMELTING, ENERGY, LAND_TILES, EQUIPMENT } from '../data/GameData.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { MessageTypes } from '../network/MessageTypes.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    this.gameScene = this.scene.get('GameScene');
    
    // Check multiplayer status
    this.isMultiplayer = this.registry.get('isMultiplayer') || false;
    this.isHost = this.registry.get('isHost') || false;
    this.playerNumber = this.registry.get('playerNumber') || 1;
    
    // Load settings first so controls help shows correct keys
    this.settings = this.loadSettings();
    
    // Initialize new inventory system
    this.inventoryUI = new InventoryUI(this);
    
    // UI panels
    this.createInfoPanel();
    this.createCraftingPanel();
    this.createStatusBars();
    this.createControlsHelp();
    this.createBuildingPanels();
    this.setupModalScrolling();
    this.createLandPurchasePanel();
    this.createSettingsMenu();
    this.createDevTools();
    
    // Multiplayer UI
    if (this.isMultiplayer) {
      this.createMultiplayerUI();
    }
    
    // Tab buttons
    this.createTabButtons();
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Current panel state
    this.currentPanel = 'inventory';
    this.showPanel('inventory');
    
    // Modal state
    this.activeModal = null;
    
    // Listen for events
    this.gameScene.events.on('resourceGathered', () => this.inventoryUI.refresh(), this);
    this.gameScene.events.on('openWorkbench', () => this.openModal('workbench'), this);
    this.gameScene.events.on('openForge', () => this.openModal('forge'), this);
    this.gameScene.events.on('openStorage', () => this.openModal('storage'), this);
    this.gameScene.events.on('openLandPurchase', (data) => this.openLandPurchase(data), this);
    
    // Update loop for dynamic info
    this.time.addEvent({
      delay: 100,
      callback: this.updateStatusBars,
      callbackScope: this,
      loop: true
    });
    
    this.time.addEvent({
      delay: 500,
      callback: this.updateInfoPanel,
      callbackScope: this,
      loop: true
    });
  }

  setupKeyboardShortcuts() {
    this.input.keyboard.on('keydown-I', () => this.inventoryUI.toggle());
    this.input.keyboard.on('keydown-TAB', () => this.inventoryUI.toggle());
    this.input.keyboard.on('keydown-C', () => this.showPanel('crafting'));
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.inventoryUI.isOpen) {
        this.inventoryUI.toggle();
      } else if (this.activeModal) {
        this.closeModal();
      } else {
        // Toggle settings menu
        this.toggleSettings();
      }
    });
  }

  createTabButtons() {
    // Buttons will be created in createSettingsMenu to ensure proper ordering
    this.tabButtons = {};
  }

  showPanel(panelKey) {
    this.currentPanel = panelKey;
    
    // Update tab button styles
    Object.keys(this.tabButtons).forEach(key => {
      this.tabButtons[key].setStyle({
        backgroundColor: key === panelKey ? '#5a7a9a' : '#3a4a6a'
      });
    });
    
    // Hide crafting panel
    this.craftingPanel.setVisible(false);
    
    // Show selected panel
    switch (panelKey) {
      case 'crafting':
        this.craftingPanel.setVisible(true);
        this.updateCraftingPanel();
        break;
    }
  }

  createInfoPanel() {
    // Dev info panel - bottom left (hidden by default)
    this.infoPanel = this.add.container(10, 680);
    
    const bg = this.add.rectangle(0, 0, 200, 100, 0x2a2a3a, 0.9)
      .setOrigin(0, 0);
    
    this.infoLevelText = this.add.text(10, 10, 'Level: 1', {
      fontSize: '16px',
      fontFamily: 'Arial'
    });
    
    this.infoXpText = this.add.text(10, 32, 'XP: 0 / 100', {
      fontSize: '14px',
      fontFamily: 'Arial'
    });
    
    this.landsText = this.add.text(10, 54, 'Lands: 1', {
      fontSize: '14px',
      fontFamily: 'Arial'
    });
    
    this.toolText = this.add.text(10, 76, 'Tool: Hands', {
      fontSize: '14px',
      fontFamily: 'Arial'
    });
    
    this.infoPanel.add([bg, this.infoLevelText, this.infoXpText, this.landsText, this.toolText]);
    
    // Hidden by default - unlocked with dev tools
    this.infoPanel.setVisible(false);
  }

  updateInfoPanel() {
    const level = this.registry.get('level');
    const xp = this.registry.get('xp');
    const { xpForLevel, totalXpForLevel } = this.getXpRequirements(level);
    const xpIntoLevel = xp - totalXpForLevel;
    const unlockedLands = this.registry.get('unlockedLands') || {};
    const currentTool = this.registry.get('currentTool');
    
    this.infoLevelText.setText(`Level: ${level}`);
    this.infoXpText.setText(`XP: ${xpIntoLevel} / ${xpForLevel}`);
    this.landsText.setText(`Lands: ${Object.keys(unlockedLands).length}`);
    
    const toolName = currentTool === 'hands' ? 'Hands' : TOOLS[currentTool]?.name || 'Hands';
    this.toolText.setText(`Tool: ${toolName}`);
  }

  createCraftingPanel() {
    this.craftingPanel = this.add.container(1000, 40);
    this.craftingPanel.setVisible(false);
    
    const bg = this.add.rectangle(0, 0, 190, 550, 0x2a2a3a, 0.9)
      .setOrigin(0, 0);
    
    const title = this.add.text(10, 10, 'Crafting', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    
    this.craftingPanel.add([bg, title]);
    
    // Crafting categories
    this.craftingCategories = this.add.container(10, 40);
    this.craftingPanel.add(this.craftingCategories);
    
    // Create a mask for the scrollable area
    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(1000, 120, 180, 400);
    const mask = maskShape.createGeometryMask();
    
    // Crafting items container with mask for scrolling
    this.craftingItems = this.add.container(10, 80);
    this.craftingItems.setMask(mask);
    this.craftingPanel.add(this.craftingItems);
    
    // Scroll state
    this.craftingScrollY = 0;
    this.craftingMaxScroll = 0;
    
    // Scroll buttons
    this.scrollUpBtn = this.add.text(170, 70, '▲', {
      fontSize: '12px',
      fontFamily: 'Arial',
      backgroundColor: '#3a4a6a',
      padding: { x: 4, y: 2 }
    }).setInteractive({ useHandCursor: true });
    this.scrollUpBtn.on('pointerdown', () => this.scrollCrafting(-80));
    this.craftingPanel.add(this.scrollUpBtn);
    
    this.scrollDownBtn = this.add.text(170, 520, '▼', {
      fontSize: '12px',
      fontFamily: 'Arial',
      backgroundColor: '#3a4a6a',
      padding: { x: 4, y: 2 }
    }).setInteractive({ useHandCursor: true });
    this.scrollDownBtn.on('pointerdown', () => this.scrollCrafting(80));
    this.craftingPanel.add(this.scrollDownBtn);
    
    this.craftingCategory = 'tools';
  }

  scrollCrafting(amount) {
    this.craftingScrollY = Phaser.Math.Clamp(
      this.craftingScrollY + amount,
      0,
      Math.max(0, this.craftingMaxScroll - 440)
    );
    this.craftingItems.y = 80 - this.craftingScrollY;
  }

  updateCraftingPanel() {
    // Clear categories
    this.craftingCategories.removeAll(true);
    
    const categories = ['tools', 'buildings', 'towers', 'upgrades'];
    let x = 0;
    
    categories.forEach(cat => {
      const btn = this.add.text(x, 0, cat.charAt(0).toUpperCase() + cat.slice(1), {
        fontSize: '12px',
        fontFamily: 'Arial',
        backgroundColor: this.craftingCategory === cat ? '#5a7a9a' : '#3a4a6a',
        padding: { x: 4, y: 2 }
      }).setInteractive({ useHandCursor: true });
      
      btn.on('pointerdown', () => {
        this.craftingCategory = cat;
        this.updateCraftingPanel();
      });
      
      this.craftingCategories.add(btn);
      x += btn.width + 5;
    });
    
    // Update items based on category
    this.craftingItems.removeAll(true);
    this.craftingScrollY = 0;
    this.craftingItems.y = 80;
    
    switch (this.craftingCategory) {
      case 'tools':
        this.craftingMaxScroll = this.showToolsCrafting();
        break;
      case 'buildings':
        this.craftingMaxScroll = this.showBuildingsCrafting();
        break;
      case 'towers':
        this.craftingMaxScroll = this.showTowersCrafting();
        break;
      case 'upgrades':
        this.craftingMaxScroll = this.showUpgradesCrafting();
        break;
    }
  }

  showToolsCrafting() {
    const inventory = this.registry.get('inventory');
    const ownedTools = this.registry.get('tools');
    let y = 0;
    
    Object.keys(TOOLS).forEach(toolKey => {
      if (toolKey === 'hands') return;
      
      const tool = TOOLS[toolKey];
      if (ownedTools.includes(toolKey)) return; // Already owned
      
      const canCraft = this.canCraft(tool.recipe);
      
      const container = this.add.container(0, y);
      
      // Tool name
      const nameText = this.add.text(0, 0, tool.name, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: canCraft ? '#ffffff' : '#888888'
      });
      
      // Recipe
      const recipeStr = Object.entries(tool.recipe)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      
      const recipeText = this.add.text(0, 16, recipeStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      });
      
      // Craft button
      if (canCraft) {
        const craftBtn = this.add.text(140, 5, 'Craft', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#4a8a4a',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        craftBtn.on('pointerdown', () => this.craftTool(toolKey));
        container.add(craftBtn);
      }
      
      container.add([nameText, recipeText]);
      this.craftingItems.add(container);
      y += 40;
    });
    return y;
  }

  showBuildingsCrafting() {
    const inventory = this.registry.get('inventory');
    let y = 0;
    
    Object.keys(BUILDINGS).forEach(buildingKey => {
      const building = BUILDINGS[buildingKey];
      const canCraft = this.canCraft(building.recipe);
      
      const container = this.add.container(0, y);
      
      const nameText = this.add.text(0, 0, building.name, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: canCraft ? '#ffffff' : '#888888'
      });
      
      const recipeStr = Object.entries(building.recipe)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      
      const recipeText = this.add.text(0, 16, recipeStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa',
        wordWrap: { width: 130 }
      });
      
      if (canCraft) {
        const craftBtn = this.add.text(140, 5, 'Build', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#4a8a4a',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        craftBtn.on('pointerdown', () => this.craftBuilding(buildingKey));
        container.add(craftBtn);
      }
      
      container.add([nameText, recipeText]);
      this.craftingItems.add(container);
      y += 50;
    });
    return y;
  }

  showTowersCrafting() {
    const inventory = this.registry.get('inventory');
    let y = 0;
    
    Object.keys(TOWERS).forEach(towerKey => {
      const tower = TOWERS[towerKey];
      const canCraft = this.canCraft(tower.recipe);
      
      const container = this.add.container(0, y);
      
      // Tower name with size indicator
      const nameText = this.add.text(0, 0, `${tower.name} (${tower.size}x${tower.size})`, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: canCraft ? '#ffffff' : '#888888'
      });
      
      // Stats
      const statsText = this.add.text(0, 14, `DMG:${tower.damage} RNG:${tower.range} HP:${tower.health}`, {
        fontSize: '9px',
        fontFamily: 'Arial',
        color: '#88aaff'
      });
      
      // Recipe
      const recipeStr = Object.entries(tower.recipe)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      
      const recipeText = this.add.text(0, 26, recipeStr, {
        fontSize: '9px',
        fontFamily: 'Arial',
        color: '#aaaaaa',
        wordWrap: { width: 130 }
      });
      
      if (canCraft) {
        const craftBtn = this.add.text(140, 10, 'Build', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#4a6a8a',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        craftBtn.on('pointerdown', () => this.craftTower(towerKey));
        container.add(craftBtn);
      }
      
      container.add([nameText, statsText, recipeText]);
      this.craftingItems.add(container);
      y += 55;
    });
    return y;
  }

  craftTower(towerKey) {
    const tower = TOWERS[towerKey];
    
    if (!this.canCraft(tower.recipe)) return;
    
    // Start tower placement mode (resources consumed on placement)
    this.gameScene.events.emit('startTowerPlacement', towerKey);
    
    this.showNotification(`Place your ${tower.name}!`);
  }

  showUpgradesCrafting() {
    const upgrades = this.registry.get('upgrades');
    let y = 0;
    
    Object.keys(UPGRADES).forEach(upgradeKey => {
      const upgrade = UPGRADES[upgradeKey];
      const currentLevel = upgrades[upgradeKey];
      
      if (currentLevel >= upgrade.maxLevel) return;
      
      const cost = upgrade.costPerLevel(currentLevel + 1);
      const canCraft = this.canCraft(cost);
      
      const container = this.add.container(0, y);
      
      const nameText = this.add.text(0, 0, `${upgrade.name} (${currentLevel}/${upgrade.maxLevel})`, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: canCraft ? '#ffffff' : '#888888'
      });
      
      const costStr = Object.entries(cost)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      
      const costText = this.add.text(0, 16, costStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      });
      
      if (canCraft) {
        const upgradeBtn = this.add.text(130, 5, 'Upgrade', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#4a8a4a',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        upgradeBtn.on('pointerdown', () => this.purchaseUpgrade(upgradeKey));
        container.add(upgradeBtn);
      }
      
      container.add([nameText, costText]);
      this.craftingItems.add(container);
      y += 45;
    });
    return y;
  }

  canCraft(recipe) {
    const inventory = this.registry.get('inventory');
    
    for (const [resource, amount] of Object.entries(recipe)) {
      if ((inventory[resource] || 0) < amount) {
        return false;
      }
    }
    return true;
  }

  consumeResources(recipe) {
    const inventory = this.registry.get('inventory');
    
    for (const [resource, amount] of Object.entries(recipe)) {
      inventory[resource] -= amount;
    }
    
    this.registry.set('inventory', inventory);
  }

  craftTool(toolKey) {
    const tool = TOOLS[toolKey];
    
    if (!this.canCraft(tool.recipe)) return;
    
    this.consumeResources(tool.recipe);
    
    const tools = this.registry.get('tools');
    tools.push(toolKey);
    this.registry.set('tools', tools);
    this.registry.set('currentTool', toolKey);
    
    // Add tool to hotbar
    const hotbar = this.registry.get('hotbar') || new Array(6).fill(null);
    const emptySlot = hotbar.findIndex(s => !s || !s.item);
    if (emptySlot !== -1) {
      hotbar[emptySlot] = { item: toolKey, count: 1 };
      this.registry.set('hotbar', hotbar);
    }
    
    this.updateCraftingPanel();
    this.inventoryUI.refresh();
    
    this.showNotification(`Crafted ${tool.name}!`);
  }

  craftBuilding(buildingKey) {
    const building = BUILDINGS[buildingKey];
    
    if (!this.canCraft(building.recipe)) return;
    
    // Don't consume resources yet - they'll be consumed on placement
    // Start building placement mode
    this.gameScene.events.emit('startBuildingPlacement', buildingKey);
    
    this.showNotification(`Place your ${building.name}!`);
  }

  purchaseUpgrade(upgradeKey) {
    const upgrade = UPGRADES[upgradeKey];
    const upgrades = this.registry.get('upgrades');
    const currentLevel = upgrades[upgradeKey];
    const cost = upgrade.costPerLevel(currentLevel + 1);
    
    if (!this.canCraft(cost)) return;
    
    this.consumeResources(cost);
    
    upgrades[upgradeKey] = currentLevel + 1;
    this.registry.set('upgrades', upgrades);
    
    this.updateCraftingPanel();
    this.inventoryUI.refresh();
    
    this.showNotification(`${upgrade.name} upgraded to level ${currentLevel + 1}!`);
  }

  createLandPurchasePanel() {
    this.landPurchasePanel = this.add.container(250, 100);
    this.landPurchasePanel.setVisible(false);
    this.landPurchasePanel.setDepth(5000);
    
    const panelHeight = 400;
    const contentHeight = 340; // Height for scrollable area
    
    const bg = this.add.rectangle(0, 0, 420, panelHeight, 0x2a2a3a, 0.95).setOrigin(0, 0);
    const title = this.add.text(200, 15, 'Buy Land', {
      fontSize: '20px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    
    const closeBtn = this.add.text(390, 10, 'X', {
      fontSize: '18px',
      fontFamily: 'Arial',
      backgroundColor: '#aa4444',
      padding: { x: 6, y: 2 }
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeLandPurchase());
    
    this.landPurchasePanel.add([bg, title, closeBtn]);
    
    // Create scrollable container for land options
    this.landOptions = this.add.container(10, 50);
    this.landPurchasePanel.add(this.landOptions);
    
    // Create mask for scrolling
    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(250 + 5, 100 + 45, 400, contentHeight);
    const mask = maskShape.createGeometryMask();
    this.landOptions.setMask(mask);
    
    // Scroll state
    this.landOptionsScroll = 0;
    this.landOptionsMaxScroll = 0;
    this.landOptionsContentHeight = contentHeight;
    
    // Scroll buttons
    const scrollUpBtn = this.add.text(380, 50, '▲', {
      fontSize: '16px',
      fontFamily: 'Arial',
      backgroundColor: '#4a4a5a',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    scrollUpBtn.on('pointerdown', () => this.scrollLandOptions(-60));
    
    const scrollDownBtn = this.add.text(380, panelHeight - 30, '▼', {
      fontSize: '16px',
      fontFamily: 'Arial',
      backgroundColor: '#4a4a5a',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    scrollDownBtn.on('pointerdown', () => this.scrollLandOptions(60));
    
    this.landPurchasePanel.add([scrollUpBtn, scrollDownBtn]);
    
    this.pendingLandPurchase = null;
  }
  
  scrollLandOptions(amount) {
    this.landOptionsScroll = Phaser.Math.Clamp(
      this.landOptionsScroll + amount,
      0,
      Math.max(0, this.landOptionsMaxScroll - this.landOptionsContentHeight)
    );
    this.landOptions.y = 50 - this.landOptionsScroll;
  }

  openLandPurchase(data) {
    this.pendingLandPurchase = data;
    this.landPurchasePanel.setVisible(true);
    this.updateLandOptions();
  }

  closeLandPurchase() {
    this.landPurchasePanel.setVisible(false);
    this.pendingLandPurchase = null;
  }

  updateLandOptions() {
    this.landOptions.removeAll(true);
    
    // Reset scroll position
    this.landOptionsScroll = 0;
    this.landOptions.y = 50;
    
    const availableTypes = this.gameScene.getAvailableLandTypes();
    const inventory = this.registry.get('inventory');
    
    let y = 0;
    
    availableTypes.forEach(landType => {
      const landData = LAND_TILES[landType];
      if (!landData || !landData.unlockCost) return;
      
      const canAfford = this.canCraft(landData.unlockCost);
      
      const container = this.add.container(0, y);
      
      // Background for each option
      const bg = this.add.rectangle(-5, 20, 370, 58, canAfford ? 0x3a4a3a : 0x4a3a3a, 0.5)
        .setOrigin(0, 0.5);
      
      // Land name
      const nameText = this.add.text(0, 0, landData.name, {
        fontSize: '14px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: canAfford ? '#ffffff' : '#888888'
      });
      
      // Resources it provides
      const resourcesStr = 'Resources: ' + [...new Set(landData.resources)].join(', ');
      const resourcesText = this.add.text(0, 18, resourcesStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#88cc88'
      });
      
      // Cost with current inventory amounts
      const costParts = Object.entries(landData.unlockCost).map(([res, amt]) => {
        const have = inventory[res] || 0;
        const color = have >= amt ? '#88ff88' : '#ff8888';
        return `${res}: ${have}/${amt}`;
      });
      const costStr = 'Cost: ' + costParts.join(', ');
      const costText = this.add.text(0, 32, costStr, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: canAfford ? '#aaffaa' : '#ffaaaa'
      });
      
      container.add([bg, nameText, resourcesText, costText]);
      
      if (canAfford) {
        const buyBtn = this.add.text(300, 15, 'BUY', {
          fontSize: '14px',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          backgroundColor: '#4a8a4a',
          padding: { x: 12, y: 6 }
        }).setInteractive({ useHandCursor: true });
        
        buyBtn.on('pointerover', () => buyBtn.setStyle({ backgroundColor: '#6aba6a' }));
        buyBtn.on('pointerout', () => buyBtn.setStyle({ backgroundColor: '#4a8a4a' }));
        
        buyBtn.on('pointerdown', () => {
          this.gameScene.events.emit('buyLand', {
            gx: this.pendingLandPurchase.gx,
            gy: this.pendingLandPurchase.gy,
            landType: landType
          });
          this.closeLandPurchase();
        });
        container.add(buyBtn);
      } else {
        const cantAffordText = this.add.text(300, 15, 'Need\nMore', {
          fontSize: '10px',
          fontFamily: 'Arial',
          color: '#aa6666',
          align: 'center'
        });
        container.add(cantAffordText);
      }
      
      this.landOptions.add(container);
      y += 65;
    });
    
    // Set max scroll based on content height
    this.landOptionsMaxScroll = y;
  }

  showNotification(message) {
    const notification = this.add.text(600, 700, message, {
      fontSize: '18px',
      fontFamily: 'Arial',
      backgroundColor: '#2a4a2a',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: notification,
      y: 650,
      alpha: 0,
      duration: 2000,
      onComplete: () => notification.destroy()
    });
  }

  createStatusBars() {
    // Health bar - top left
    this.healthBarContainer = this.add.container(10, 10);
    const healthLabel = this.add.text(0, 0, 'HP', { fontSize: '12px', fontFamily: 'Arial' });
    this.healthBarBg = this.add.rectangle(30, 4, 150, 14, 0x333333).setOrigin(0, 0);
    this.healthBarFill = this.add.rectangle(32, 6, 146, 10, 0xff4444).setOrigin(0, 0);
    this.healthText = this.add.text(185, 2, '100/100', { fontSize: '12px', fontFamily: 'Arial' });
    this.healthBarContainer.add([healthLabel, this.healthBarBg, this.healthBarFill, this.healthText]);

    // XP bar (below HP)
    this.xpBarContainer = this.add.container(10, 30);
    this.levelText = this.add.text(0, 0, 'Lv1', { fontSize: '12px', fontFamily: 'Arial', color: '#ffdd44' });
    this.xpBarBg = this.add.rectangle(30, 4, 150, 14, 0x333333).setOrigin(0, 0);
    this.xpBarFill = this.add.rectangle(32, 6, 146, 10, 0xffdd44).setOrigin(0, 0);
    this.xpText = this.add.text(185, 2, '0/100', { fontSize: '12px', fontFamily: 'Arial', color: '#ffdd44' });
    this.xpBarContainer.add([this.levelText, this.xpBarBg, this.xpBarFill, this.xpText]);

    // Energy bar
    this.energyBarContainer = this.add.container(10, 50);
    const energyLabel = this.add.text(0, 0, 'EN', { fontSize: '12px', fontFamily: 'Arial' });
    this.energyBarBg = this.add.rectangle(30, 4, 150, 14, 0x333333).setOrigin(0, 0);
    this.energyBarFill = this.add.rectangle(32, 6, 146, 10, 0x44aaff).setOrigin(0, 0);
    this.energyText = this.add.text(185, 2, '100/100', { fontSize: '12px', fontFamily: 'Arial' });
    this.energyBarContainer.add([energyLabel, this.energyBarBg, this.energyBarFill, this.energyText]);
  }

  updateStatusBars() {
    const health = this.registry.get('health') || 100;
    const energy = this.registry.get('energy') || ENERGY.max;
    const xp = this.registry.get('xp') || 0;
    const level = this.registry.get('level') || 1;
    
    // Scaling XP curve
    const { xpForLevel, totalXpForLevel } = this.getXpRequirements(level);
    const xpIntoLevel = xp - totalXpForLevel;
    
    const healthPercent = health / 100;
    const energyPercent = energy / ENERGY.max;
    const xpPercent = Math.min(xpIntoLevel / xpForLevel, 1);
    
    this.healthBarFill.setScale(healthPercent, 1);
    this.healthText.setText(`${Math.floor(health)}/100`);
    
    this.xpBarFill.setScale(xpPercent, 1);
    this.levelText.setText(`Lv${level}`);
    this.xpText.setText(`${xpIntoLevel}/${xpForLevel}`);
    
    this.energyBarFill.setScale(energyPercent, 1);
    this.energyText.setText(`${Math.floor(energy)}/${ENERGY.max}`);
  }
  
  addXp(amount) {
    let xp = this.registry.get('xp') || 0;
    let level = this.registry.get('level') || 1;
    
    xp += amount;
    
    // Check for level up with scaling XP curve
    let { totalXpForLevel } = this.getXpRequirements(level);
    let xpNeededForNextLevel = totalXpForLevel + this.getXpRequirements(level).xpForLevel;
    
    while (xp >= xpNeededForNextLevel) {
      level++;
      this.showNotification(`🎉 Level Up! Now level ${level}!`);
      
      // Restore health on level up
      this.registry.set('health', 100);
      
      // Recalculate for next level
      const nextReqs = this.getXpRequirements(level);
      xpNeededForNextLevel = nextReqs.totalXpForLevel + nextReqs.xpForLevel;
    }
    
    this.registry.set('xp', xp);
    this.registry.set('level', level);
  }
  
  // Scaling XP curve: base 100, increases by 50% each level
  getXpRequirements(level) {
    const getXpForLevel = (lvl) => Math.floor(100 * Math.pow(1.5, lvl - 1));
    
    let totalXpForLevel = 0;
    for (let i = 1; i < level; i++) {
      totalXpForLevel += getXpForLevel(i);
    }
    
    return {
      xpForLevel: getXpForLevel(level),
      totalXpForLevel: totalXpForLevel
    };
  }

  createControlsHelp() {
    // Get current controls from settings (or defaults)
    const controls = this.settings?.controls || {
      moveUp: 'W', moveDown: 'S', moveLeft: 'A', moveRight: 'D',
      harvest: 'SPACE', interact: 'E', attack: 'F'
    };
    
    const controlsText = [
      'Controls:',
      `${controls.moveUp}/${controls.moveLeft}/${controls.moveDown}/${controls.moveRight} - Move`,
      `${controls.harvest} - Mine/Harvest`,
      `${controls.interact} - Interact`,
      `${controls.attack} - Attack`,
      'I - Inventory',
      'C - Crafting',
      'ESC - Close menus'
    ].join('\n');

    this.controlsPanel = this.add.container(10, 720);
    const bg = this.add.rectangle(0, 0, 160, 130, 0x2a2a3a, 0.8).setOrigin(0, 0);
    this.controlsHelpText = this.add.text(5, 5, controlsText, {
      fontSize: '10px',
      fontFamily: 'Arial',
      lineSpacing: 2
    });
    this.controlsPanel.add([bg, this.controlsHelpText]);
    this.controlsPanel.setPosition(10, 660);
  }

  createBuildingPanels() {
    // Modal overlay
    this.modalOverlay = this.add.rectangle(600, 400, 1200, 800, 0x000000, 0.7)
      .setInteractive()
      .setVisible(false);
    
    // Workbench panel
    this.workbenchPanel = this.createModalPanel('Workbench', 'Craft tools and items');
    this.workbenchContent = this.createModalContent(this.workbenchPanel);
    
    // Forge panel
    this.forgePanel = this.createModalPanel('Forge', 'Smelt ores into bars');
    this.forgeContent = this.createModalContent(this.forgePanel);
    
    // Storage panel
    this.storagePanel = this.createModalPanel('Storage', 'Store and retrieve items');
    this.storageContent = this.createModalContent(this.storagePanel);
  }

  createModalPanel(title, subtitle) {
    const panelX = 400;
    const panelY = 150;
    const panelWidth = 420;
    const panelHeight = 500;
    const contentHeight = panelHeight - 70;
    
    const panel = this.add.container(panelX, panelY);
    panel.setVisible(false);
    panel.setDepth(2000);
    
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x2a2a3a, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x4a4a6a);
    
    const titleText = this.add.text(panelWidth / 2, 15, title, {
      fontSize: '20px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    
    const subtitleText = this.add.text(panelWidth / 2, 40, subtitle, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5, 0);
    
    const closeBtn = this.add.text(panelWidth - 35, 10, 'X', {
      fontSize: '18px',
      fontFamily: 'Arial',
      backgroundColor: '#aa4444',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', () => this.closeModal());
    
    panel.add([bg, titleText, subtitleText, closeBtn]);
    
    // Store panel dimensions for content masking
    panel.panelX = panelX;
    panel.panelY = panelY;
    panel.panelWidth = panelWidth;
    panel.contentHeight = contentHeight;
    
    return panel;
  }
  
  createModalContent(panel) {
    const contentY = 65;
    const contentHeight = panel.contentHeight;
    
    // Create mask for scrollable content
    const maskGraphics = this.make.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(panel.panelX + 5, panel.panelY + contentY, panel.panelWidth - 20, contentHeight);
    const contentMask = maskGraphics.createGeometryMask();
    
    // Create content container
    const content = this.add.container(5, contentY);
    content.setMask(contentMask);
    
    // Store scroll state
    content.scrollY = 0;
    content.maxScroll = 0;
    content.contentHeight = contentHeight;
    content.baseY = contentY;
    
    panel.add(content);
    return content;
  }

  setupModalScrolling() {
    // Mouse wheel scrolling for modals
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.activeModal) return;
      
      let content = null;
      if (this.activeModal === 'workbench') content = this.workbenchContent;
      else if (this.activeModal === 'forge') content = this.forgeContent;
      else if (this.activeModal === 'storage') content = this.storageContent;
      
      if (!content) return;
      
      // Calculate total content height
      let totalHeight = 0;
      content.list.forEach(child => {
        if (child.y !== undefined && child.height !== undefined) {
          totalHeight = Math.max(totalHeight, child.y + 50);
        }
      });
      
      const maxScroll = Math.max(0, totalHeight - content.contentHeight);
      content.scrollY = Phaser.Math.Clamp(content.scrollY + deltaY * 0.5, 0, maxScroll);
      content.y = content.baseY - content.scrollY;
    });
  }

  openModal(type) {
    this.modalOverlay.setVisible(true);
    this.activeModal = type;
    
    switch (type) {
      case 'workbench':
        this.workbenchPanel.setVisible(true);
        this.updateWorkbenchPanel();
        break;
      case 'forge':
        this.forgePanel.setVisible(true);
        this.updateForgePanel();
        break;
      case 'storage':
        this.storagePanel.setVisible(true);
        this.updateStoragePanel();
        break;
    }
  }

  closeModal() {
    this.modalOverlay.setVisible(false);
    this.workbenchPanel.setVisible(false);
    this.forgePanel.setVisible(false);
    this.storagePanel.setVisible(false);
    this.activeModal = null;
  }

  updateWorkbenchPanel() {
    this.workbenchContent.removeAll(true);
    
    const inventory = this.registry.get('inventory');
    const ownedTools = this.registry.get('tools');
    let y = 0;
    
    // Show craftable tools
    Object.keys(TOOLS).forEach(toolKey => {
      if (toolKey === 'hands') return;
      const tool = TOOLS[toolKey];
      if (ownedTools.includes(toolKey)) return;
      
      const canCraft = this.canCraft(tool.recipe);
      
      const container = this.add.container(5, y);
      
      // Background for item row
      const rowBg = this.add.rectangle(0, 0, 390, 40, canCraft ? 0x3a4a3a : 0x3a3a4a, 0.5)
        .setOrigin(0, 0);
      
      const nameText = this.add.text(10, 5, tool.name, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: canCraft ? '#ffffff' : '#888888'
      });
      
      const recipeStr = Object.entries(tool.recipe)
        .map(([res, amt]) => {
          const have = inventory[res] || 0;
          const color = have >= amt ? '#88ff88' : '#ff8888';
          return `${amt} ${res}`;
        })
        .join(', ');
      
      const recipeText = this.add.text(10, 22, recipeStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      });
      
      container.add([rowBg, nameText, recipeText]);
      
      if (canCraft) {
        const craftBtn = this.add.text(320, 8, 'Craft', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#4a8a4a',
          padding: { x: 10, y: 4 }
        }).setInteractive({ useHandCursor: true });
        
        craftBtn.on('pointerover', () => craftBtn.setStyle({ backgroundColor: '#5a9a5a' }));
        craftBtn.on('pointerout', () => craftBtn.setStyle({ backgroundColor: '#4a8a4a' }));
        craftBtn.on('pointerdown', () => {
          this.craftTool(toolKey);
          this.updateWorkbenchPanel();
        });
        container.add(craftBtn);
      }
      
      this.workbenchContent.add(container);
      y += 44;
    });
  }

  updateForgePanel() {
    this.forgeContent.removeAll(true);
    
    const inventory = this.registry.get('inventory');
    let y = 0;
    
    Object.keys(SMELTING).forEach(itemKey => {
      const item = SMELTING[itemKey];
      const canCraft = this.canCraft(item.recipe);
      
      const container = this.add.container(5, y);
      
      // Background for item row
      const rowBg = this.add.rectangle(0, 0, 390, 44, canCraft ? 0x4a3a2a : 0x3a3a4a, 0.5)
        .setOrigin(0, 0);
      
      const nameText = this.add.text(10, 5, item.name, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: canCraft ? '#ffffff' : '#888888'
      });
      
      const recipeStr = Object.entries(item.recipe)
        .map(([res, amt]) => `${amt} ${res}`)
        .join(', ');
      
      const recipeText = this.add.text(10, 24, recipeStr, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      });
      
      const currentAmount = inventory[itemKey] || 0;
      const amountText = this.add.text(220, 8, `Have: ${currentAmount}`, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#88aaff'
      });
      
      container.add([rowBg, nameText, recipeText, amountText]);
      
      if (canCraft) {
        const smeltBtn = this.add.text(320, 10, 'Smelt', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#8a6a4a',
          padding: { x: 10, y: 4 }
        }).setInteractive({ useHandCursor: true });
        
        smeltBtn.on('pointerover', () => smeltBtn.setStyle({ backgroundColor: '#9a7a5a' }));
        smeltBtn.on('pointerout', () => smeltBtn.setStyle({ backgroundColor: '#8a6a4a' }));
        smeltBtn.on('pointerdown', () => {
          this.smeltItem(itemKey);
          this.updateForgePanel();
        });
        container.add(smeltBtn);
      }
      
      this.forgeContent.add(container);
      y += 48;
    });
  }

  smeltItem(itemKey) {
    const item = SMELTING[itemKey];
    if (!this.canCraft(item.recipe)) return;
    
    this.consumeResources(item.recipe);
    
    // Add to new inventory
    this.inventoryUI.addItem(itemKey, 1);
    
    // Also update old inventory
    const inventory = this.registry.get('inventory');
    inventory[itemKey] = (inventory[itemKey] || 0) + 1;
    this.registry.set('inventory', inventory);
    
    this.showNotification(`Smelted ${item.name}!`);
    this.inventoryUI.refresh();
  }

  updateStoragePanel() {
    this.storageContent.removeAll(true);
    
    const inventory = this.registry.get('inventory');
    const ownedTools = this.registry.get('tools') || [];
    const storage = this.registry.get('storage') || {};
    const storedTools = this.registry.get('storedTools') || [];
    const currentTool = this.registry.get('currentTool');
    
    // Deposit Resources section
    const depositTitle = this.add.text(10, 0, 'Deposit Resources:', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    this.storageContent.add(depositTitle);
    
    let y = 25;
    Object.keys(inventory).forEach(key => {
      if (inventory[key] <= 0) return;
      
      const container = this.add.container(10, y);
      const resourceData = RESOURCES[key];
      if (!resourceData) return;
      
      const text = this.add.text(0, 0, `${resourceData.name}: ${inventory[key]}`, {
        fontSize: '12px',
        fontFamily: 'Arial'
      });
      
      const depositBtn = this.add.text(150, -2, 'Deposit', {
        fontSize: '11px',
        fontFamily: 'Arial',
        backgroundColor: '#4a6a8a',
        padding: { x: 4, y: 2 }
      }).setInteractive({ useHandCursor: true });
      
      depositBtn.on('pointerdown', () => {
        this.depositItem(key, 10);
        this.updateStoragePanel();
      });
      
      container.add([text, depositBtn]);
      this.storageContent.add(container);
      y += 22;
    });
    
    // Deposit Tools section
    const toolsToStore = ownedTools.filter(t => t !== 'hands' && t !== currentTool);
    if (toolsToStore.length > 0) {
      y += 10;
      const depositToolsTitle = this.add.text(10, y, 'Store Tools:', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: '#88aaff'
      });
      this.storageContent.add(depositToolsTitle);
      y += 25;
      
      toolsToStore.forEach(toolKey => {
        const tool = TOOLS[toolKey];
        if (!tool) return;
        
        const container = this.add.container(10, y);
        const text = this.add.text(0, 0, tool.name, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#aaccff'
        });
        
        const storeBtn = this.add.text(150, -2, 'Store', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#4a6a8a',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        storeBtn.on('pointerdown', () => {
          this.storeTool(toolKey);
          this.updateStoragePanel();
        });
        
        container.add([text, storeBtn]);
        this.storageContent.add(container);
        y += 22;
      });
    }
    
    // Withdraw Resources section
    y += 10;
    const withdrawTitle = this.add.text(10, y, 'Withdraw Resources:', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    this.storageContent.add(withdrawTitle);
    
    y += 25;
    Object.keys(storage).forEach(key => {
      if (storage[key] <= 0) return;
      
      const container = this.add.container(10, y);
      const resourceData = RESOURCES[key];
      if (!resourceData) return;
      
      const text = this.add.text(0, 0, `${resourceData.name}: ${storage[key]}`, {
        fontSize: '12px',
        fontFamily: 'Arial'
      });
      
      const withdrawBtn = this.add.text(150, -2, 'Withdraw', {
        fontSize: '11px',
        fontFamily: 'Arial',
        backgroundColor: '#6a8a4a',
        padding: { x: 4, y: 2 }
      }).setInteractive({ useHandCursor: true });
      
      withdrawBtn.on('pointerdown', () => {
        this.withdrawItem(key, 10);
        this.updateStoragePanel();
      });
      
      container.add([text, withdrawBtn]);
      this.storageContent.add(container);
      y += 22;
    });
    
    // Withdraw Tools section
    if (storedTools.length > 0) {
      y += 10;
      const withdrawToolsTitle = this.add.text(10, y, 'Retrieve Tools:', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: '#88ff88'
      });
      this.storageContent.add(withdrawToolsTitle);
      y += 25;
      
      storedTools.forEach(toolKey => {
        const tool = TOOLS[toolKey];
        if (!tool) return;
        
        const container = this.add.container(10, y);
        const text = this.add.text(0, 0, tool.name, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#aaffaa'
        });
        
        const retrieveBtn = this.add.text(150, -2, 'Retrieve', {
          fontSize: '11px',
          fontFamily: 'Arial',
          backgroundColor: '#6a8a4a',
          padding: { x: 4, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        retrieveBtn.on('pointerdown', () => {
          this.retrieveTool(toolKey);
          this.updateStoragePanel();
        });
        
        container.add([text, retrieveBtn]);
        this.storageContent.add(container);
        y += 22;
      });
    }
  }

  depositItem(key, amount) {
    const inventory = this.registry.get('inventory');
    const storage = this.registry.get('storage') || {};
    
    const toDeposit = Math.min(amount, inventory[key] || 0);
    if (toDeposit <= 0) return;
    
    // Remove from new inventory
    this.inventoryUI.removeItem(key, toDeposit);
    
    inventory[key] = (inventory[key] || 0) - toDeposit;
    storage[key] = (storage[key] || 0) + toDeposit;
    
    this.registry.set('inventory', inventory);
    this.registry.set('storage', storage);
    this.inventoryUI.refresh();
    
    // Broadcast storage update in multiplayer
    if (this.isMultiplayer) {
      const networkManager = this.registry.get('networkManager');
      if (networkManager) {
        networkManager.broadcast(MessageTypes.STORAGE_UPDATE, {
          storage: storage
        });
      }
    }
  }

  withdrawItem(key, amount) {
    const inventory = this.registry.get('inventory');
    const storage = this.registry.get('storage') || {};
    
    const toWithdraw = Math.min(amount, storage[key] || 0);
    if (toWithdraw <= 0) return;
    
    // Add to new inventory
    this.inventoryUI.addItem(key, toWithdraw);
    
    storage[key] = (storage[key] || 0) - toWithdraw;
    inventory[key] = (inventory[key] || 0) + toWithdraw;
    
    this.registry.set('inventory', inventory);
    this.registry.set('storage', storage);
    this.inventoryUI.refresh();
    
    // Broadcast storage update in multiplayer
    if (this.isMultiplayer) {
      const networkManager = this.registry.get('networkManager');
      if (networkManager) {
        networkManager.broadcast(MessageTypes.STORAGE_UPDATE, {
          storage: storage
        });
      }
    }
  }
  
  storeTool(toolKey) {
    const ownedTools = this.registry.get('tools') || [];
    const storedTools = this.registry.get('storedTools') || [];
    const currentTool = this.registry.get('currentTool');
    
    // Can't store currently equipped tool
    if (toolKey === currentTool) {
      this.showNotification('Unequip tool first!');
      return;
    }
    
    // Remove from owned tools
    const index = ownedTools.indexOf(toolKey);
    if (index === -1) return;
    
    ownedTools.splice(index, 1);
    storedTools.push(toolKey);
    
    this.registry.set('tools', ownedTools);
    this.registry.set('storedTools', storedTools);
    
    this.showNotification(`Stored ${TOOLS[toolKey].name}`);
    this.inventoryUI.refresh();
    
    // Broadcast in multiplayer
    if (this.isMultiplayer) {
      const networkManager = this.registry.get('networkManager');
      if (networkManager) {
        networkManager.broadcast(MessageTypes.STORAGE_UPDATE, {
          storedTools: storedTools
        });
      }
    }
  }
  
  retrieveTool(toolKey) {
    const ownedTools = this.registry.get('tools') || [];
    const storedTools = this.registry.get('storedTools') || [];
    
    // Remove from stored tools
    const index = storedTools.indexOf(toolKey);
    if (index === -1) return;
    
    storedTools.splice(index, 1);
    ownedTools.push(toolKey);
    
    this.registry.set('tools', ownedTools);
    this.registry.set('storedTools', storedTools);
    
    this.showNotification(`Retrieved ${TOOLS[toolKey].name}`);
    this.inventoryUI.refresh();
    
    // Broadcast in multiplayer
    if (this.isMultiplayer) {
      const networkManager = this.registry.get('networkManager');
      if (networkManager) {
        networkManager.broadcast(MessageTypes.STORAGE_UPDATE, {
          storedTools: storedTools
        });
      }
    }
  }

  createSettingsMenu() {
    // Settings already loaded in create()
    const { width } = this.cameras.main;
    const buttonStyle = {
      fontSize: '12px',
      fontFamily: 'Arial',
      backgroundColor: '#3a4a6a',
      padding: { x: 8, y: 4 }
    };
    
    // Create all top-right buttons with proper spacing
    let xPos = width - 10;
    
    // Settings button (rightmost)
    const settingsBtn = this.add.text(xPos, 10, '⚙️', buttonStyle)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerdown', () => this.toggleSettings());
    settingsBtn.on('pointerover', () => settingsBtn.setStyle({ backgroundColor: '#5a6a8a' }));
    settingsBtn.on('pointerout', () => settingsBtn.setStyle({ backgroundColor: '#3a4a6a' }));
    xPos -= settingsBtn.width + 10;
    
    // Craft button
    const craftBtn = this.add.text(xPos, 10, 'Craft [C]', buttonStyle)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    craftBtn.on('pointerdown', () => this.showPanel('crafting'));
    craftBtn.on('pointerover', () => craftBtn.setStyle({ backgroundColor: '#5a6a8a' }));
    craftBtn.on('pointerout', () => {
      craftBtn.setStyle({ 
        backgroundColor: this.currentPanel === 'crafting' ? '#5a7a9a' : '#3a4a6a' 
      });
    });
    xPos -= craftBtn.width + 10;
    
    // Inventory button
    const invBtn = this.add.text(xPos, 10, 'Inv [I]', buttonStyle)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    invBtn.on('pointerdown', () => this.inventoryUI.toggle());
    invBtn.on('pointerover', () => invBtn.setStyle({ backgroundColor: '#5a6a8a' }));
    invBtn.on('pointerout', () => invBtn.setStyle({ backgroundColor: '#3a4a6a' }));
    
    this.tabButtons = {
      crafting: craftBtn,
      inventory: invBtn
    };
    
    // Settings panel - centered and sized to fit screen
    const panelWidth = 550;
    const panelHeight = 580;
    const panelX = (1200 - panelWidth) / 2;
    const panelY = (800 - panelHeight) / 2;
    
    this.settingsPanel = this.add.container(panelX, panelY);
    this.settingsPanel.setVisible(false);
    this.settingsPanel.setDepth(5000);
    
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2a, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x4a4a6a);
    const title = this.add.text(panelWidth / 2, 15, '⚙️ SETTINGS', {
      fontSize: '20px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    
    const closeBtn = this.add.text(panelWidth - 35, 10, 'X', {
      fontSize: '18px',
      fontFamily: 'Arial',
      backgroundColor: '#aa4444',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleSettings());
    
    this.settingsPanel.add([bg, title, closeBtn]);
    
    // Create scrollable content area
    const contentHeight = panelHeight - 60;
    const contentY = 50;
    
    // Mask for scrollable content
    const maskGraphics = this.make.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(panelX + 10, panelY + contentY, panelWidth - 30, contentHeight);
    const contentMask = maskGraphics.createGeometryMask();
    
    // Scrollable content container
    this.settingsContent = this.add.container(10, contentY);
    this.settingsContent.setMask(contentMask);
    this.settingsPanel.add(this.settingsContent);
    
    // Scroll state
    this.settingsScrollY = 0;
    this.settingsMaxScroll = 0;
    
    let y = 0;
    
    // === CONTROLS SECTION ===
    const controlsTitle = this.add.text(10, y, 'CONTROLS', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#88aaff'
    });
    this.settingsContent.add(controlsTitle);
    y += 25;
    
    this.keyBindButtons = {};
    const keyBindings = [
      { key: 'moveUp', label: 'Up', default: 'W' },
      { key: 'moveDown', label: 'Down', default: 'S' },
      { key: 'moveLeft', label: 'Left', default: 'A' },
      { key: 'moveRight', label: 'Right', default: 'D' },
      { key: 'harvest', label: 'Harvest', default: 'SPACE' },
      { key: 'interact', label: 'Interact', default: 'E' },
      { key: 'attack', label: 'Attack', default: 'F' }
    ];
    
    keyBindings.forEach((binding, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const xPos = 10 + col * 170;
      const yPos = y + row * 28;
      
      const label = this.add.text(xPos, yPos, binding.label + ':', {
        fontSize: '12px',
        fontFamily: 'Arial'
      });
      
      const currentKey = this.settings.controls[binding.key] || binding.default;
      const keyBtn = this.add.text(xPos + 65, yPos - 2, currentKey, {
        fontSize: '11px',
        fontFamily: 'Arial',
        backgroundColor: '#3a3a5a',
        padding: { x: 8, y: 3 },
        fixedWidth: 70,
        align: 'center'
      }).setInteractive({ useHandCursor: true });
      
      keyBtn.bindingKey = binding.key;
      keyBtn.on('pointerdown', () => this.startKeyRebind(keyBtn, binding.key));
      
      this.keyBindButtons[binding.key] = keyBtn;
      this.settingsContent.add([label, keyBtn]);
    });
    
    y += Math.ceil(keyBindings.length / 3) * 28 + 10;
    
    // Reset controls button
    const resetControlsBtn = this.add.text(10, y, 'Reset Controls', {
      fontSize: '11px',
      fontFamily: 'Arial',
      backgroundColor: '#5a4a4a',
      padding: { x: 6, y: 3 }
    }).setInteractive({ useHandCursor: true });
    resetControlsBtn.on('pointerdown', () => this.resetControls());
    this.settingsContent.add(resetControlsBtn);
    y += 30;
    
    // === AUDIO SECTION ===
    const audioTitle = this.add.text(10, y, 'AUDIO', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#88aaff'
    });
    this.settingsContent.add(audioTitle);
    y += 25;
    
    // Master Volume
    this.createSlider(10, y, 'Master', 'masterVolume', 0, 100);
    y += 30;
    
    // SFX Volume
    this.createSlider(10, y, 'SFX', 'sfxVolume', 0, 100);
    y += 30;
    
    // Music Volume
    this.createSlider(10, y, 'Music', 'musicVolume', 0, 100);
    y += 35;
    
    // === DISPLAY SECTION ===
    const displayTitle = this.add.text(10, y, 'DISPLAY', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#88aaff'
    });
    this.settingsContent.add(displayTitle);
    y += 25;
    
    // Camera Zoom
    this.createSlider(10, y, 'Zoom', 'cameraZoom', 50, 200);
    y += 30;
    
    // Toggles in a row
    this.createToggle(10, y, 'Show FPS', 'showFps');
    this.createToggle(180, y, 'Damage Numbers', 'showDamageNumbers');
    y += 28;
    
    this.createToggle(10, y, 'Controls Help', 'showControlsHelp');
    this.createToggle(180, y, 'Screen Shake', 'screenShake');
    y += 28;
    
    this.createToggle(10, y, 'Auto-Save', 'autoSave');
    y += 35;
    
    // Buttons row
    const saveBtn = this.add.text(100, y, 'Save Settings', {
      fontSize: '13px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      backgroundColor: '#4a8a4a',
      padding: { x: 15, y: 6 }
    }).setInteractive({ useHandCursor: true });
    saveBtn.on('pointerdown', () => {
      this.saveSettings();
      this.applySettings();
      this.showNotification('Settings saved!');
    });
    saveBtn.on('pointerover', () => saveBtn.setStyle({ backgroundColor: '#6aba6a' }));
    saveBtn.on('pointerout', () => saveBtn.setStyle({ backgroundColor: '#4a8a4a' }));
    this.settingsContent.add(saveBtn);
    
    const menuBtn = this.add.text(280, y, 'Quit & Save', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      backgroundColor: '#6a4a4a',
      padding: { x: 20, y: 8 }
    }).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => this.confirmReturnToMenu());
    menuBtn.on('pointerover', () => menuBtn.setStyle({ backgroundColor: '#8a6a6a' }));
    menuBtn.on('pointerout', () => menuBtn.setStyle({ backgroundColor: '#6a4a4a' }));
    this.settingsContent.add(menuBtn);
    
    // Listening for key rebind
    this.isRebinding = false;
    this.rebindTarget = null;
    
    this.input.keyboard.on('keydown', (event) => {
      if (this.isRebinding && this.rebindTarget) {
        const keyName = event.key.toUpperCase();
        if (keyName === 'ESCAPE') {
          this.cancelRebind();
        } else {
          this.completeRebind(keyName === ' ' ? 'SPACE' : keyName);
        }
      }
    });
    
    // Also listen for mouse clicks during rebind (with delay to avoid immediate trigger)
    this.input.on('pointerdown', (pointer) => {
      if (this.isRebinding && this.rebindTarget && this.rebindStartTime) {
        // Only accept mouse input after 200ms delay to avoid the initial click
        if (Date.now() - this.rebindStartTime > 200) {
          if (pointer.leftButtonDown()) {
            this.completeRebind('MOUSE1');
          } else if (pointer.rightButtonDown()) {
            this.completeRebind('MOUSE2');
          } else if (pointer.middleButtonDown()) {
            this.completeRebind('MOUSE3');
          }
        }
      }
    });
    
    // Apply settings on load
    this.applySettings();
  }

  createSlider(x, y, label, settingKey, min, max) {
    const labelText = this.add.text(x, y, label + ':', {
      fontSize: '12px',
      fontFamily: 'Arial'
    });
    
    const value = this.settings[settingKey] ?? ((min + max) / 2);
    
    const sliderBg = this.add.rectangle(x + 70, y + 7, 120, 6, 0x333333).setOrigin(0, 0.5);
    const sliderFill = this.add.rectangle(x + 70, y + 7, 120 * ((value - min) / (max - min)), 6, 0x6688aa).setOrigin(0, 0.5);
    
    const valueText = this.add.text(x + 200, y, Math.round(value) + '%', {
      fontSize: '11px',
      fontFamily: 'Arial'
    });
    
    // Make slider interactive
    const sliderZone = this.add.zone(x + 70 + 60, y + 7, 120, 16).setInteractive({ useHandCursor: true });
    
    sliderZone.on('pointerdown', (pointer) => {
      const panelX = this.settingsPanel.x + this.settingsContent.x;
      const localX = pointer.x - (x + 70 + panelX);
      const percent = Phaser.Math.Clamp(localX / 120, 0, 1);
      const newValue = min + percent * (max - min);
      this.settings[settingKey] = Math.round(newValue);
      sliderFill.width = 120 * percent;
      valueText.setText(Math.round(newValue) + '%');
    });
    
    this.settingsContent.add([labelText, sliderBg, sliderFill, valueText, sliderZone]);
  }

  createToggle(x, y, label, settingKey) {
    const labelText = this.add.text(x, y, label, {
      fontSize: '11px',
      fontFamily: 'Arial'
    });
    
    const isOn = this.settings[settingKey] ?? true;
    
    const toggleBtn = this.add.text(x + 100, y - 1, isOn ? 'ON' : 'OFF', {
      fontSize: '10px',
      fontFamily: 'Arial',
      backgroundColor: isOn ? '#4a8a4a' : '#8a4a4a',
      padding: { x: 8, y: 2 }
    }).setInteractive({ useHandCursor: true });
    
    toggleBtn.on('pointerdown', () => {
      this.settings[settingKey] = !this.settings[settingKey];
      toggleBtn.setText(this.settings[settingKey] ? 'ON' : 'OFF');
      toggleBtn.setStyle({ backgroundColor: this.settings[settingKey] ? '#4a8a4a' : '#8a4a4a' });
    });
    
    this.settingsContent.add([labelText, toggleBtn]);
  }

  toggleSettings() {
    this.settingsPanel.setVisible(!this.settingsPanel.visible);
    if (this.isRebinding) {
      this.cancelRebind();
    }
  }

  confirmReturnToMenu() {
    // Create confirmation dialog (above settings panel which is at 5000)
    const { width, height } = this.cameras.main;
    
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setDepth(6000)
      .setInteractive();
    
    const dialog = this.add.container(width / 2, height / 2).setDepth(6001);
    
    const dialogBg = this.add.rectangle(0, 0, 350, 180, 0x2a2a4a)
      .setStrokeStyle(2, 0x5a5a7a);
    
    const titleText = this.add.text(0, -60, 'Return to Main Menu?', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    const infoText = this.add.text(0, -20, 'Your game will be saved automatically.', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Confirm button
    const confirmBg = this.add.rectangle(-70, 40, 110, 40, 0x4a8a4a)
      .setInteractive({ useHandCursor: true });
    const confirmText = this.add.text(-70, 40, 'Yes, Exit', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x5a9a5a));
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(0x4a8a4a));
    confirmBg.on('pointerdown', () => {
      // Save and return to menu
      this.gameScene.saveGame();
      this.scene.stop('GameScene');
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
    
    // Cancel button
    const cancelBg = this.add.rectangle(70, 40, 110, 40, 0x4a4a6a)
      .setInteractive({ useHandCursor: true });
    const cancelText = this.add.text(70, 40, 'Cancel', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    cancelBg.on('pointerover', () => cancelBg.setFillStyle(0x5a5a7a));
    cancelBg.on('pointerout', () => cancelBg.setFillStyle(0x4a4a6a));
    cancelBg.on('pointerdown', () => {
      overlay.destroy();
      dialog.destroy();
    });
    
    dialog.add([dialogBg, titleText, infoText, confirmBg, confirmText, cancelBg, cancelText]);
  }

  startKeyRebind(button, bindingKey) {
    if (this.isRebinding) {
      this.cancelRebind();
    }
    
    this.isRebinding = true;
    this.rebindTarget = button;
    this.rebindKey = bindingKey;
    this.rebindStartTime = Date.now(); // Track when rebind started
    button.setText('Press key/click...');
    button.setStyle({ backgroundColor: '#6a6a3a' });
  }

  cancelRebind() {
    if (this.rebindTarget) {
      const currentKey = this.settings.controls[this.rebindKey];
      this.rebindTarget.setText(currentKey);
      this.rebindTarget.setStyle({ backgroundColor: '#3a3a5a' });
    }
    this.isRebinding = false;
    this.rebindStartTime = null;
    this.rebindTarget = null;
    this.rebindKey = null;
  }

  completeRebind(keyName) {
    this.settings.controls[this.rebindKey] = keyName;
    this.rebindTarget.setText(keyName);
    this.rebindTarget.setStyle({ backgroundColor: '#3a3a5a' });
    this.isRebinding = false;
    this.rebindTarget = null;
    this.rebindKey = null;
    this.rebindStartTime = null;
    
    // Auto-save and apply immediately
    this.saveSettings();
    this.applySettings();
    this.showNotification(`Key bound to ${keyName}`);
  }

  resetControls() {
    this.settings.controls = {
      moveUp: 'W',
      moveDown: 'S',
      moveLeft: 'A',
      moveRight: 'D',
      harvest: 'SPACE',
      interact: 'E',
      attack: 'F'
    };
    
    Object.entries(this.settings.controls).forEach(([key, value]) => {
      if (this.keyBindButtons[key]) {
        this.keyBindButtons[key].setText(value);
      }
    });
    
    // Auto-save and apply immediately
    this.saveSettings();
    this.applySettings();
    this.showNotification('Controls reset to default');
  }

  loadSettings() {
    const saved = localStorage.getItem('forger2_settings');
    const defaults = {
      controls: {
        moveUp: 'W',
        moveDown: 'S',
        moveLeft: 'A',
        moveRight: 'D',
        harvest: 'SPACE',
        interact: 'E',
        attack: 'F'
      },
      masterVolume: 100,
      sfxVolume: 100,
      musicVolume: 50,
      cameraZoom: 100,
      showFps: false,
      showDamageNumbers: true,
      showControlsHelp: true,
      autoSave: true,
      screenShake: true
    };
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed, controls: { ...defaults.controls, ...parsed.controls } };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  }

  saveSettings() {
    localStorage.setItem('forger2_settings', JSON.stringify(this.settings));
  }

  applySettings() {
    // Apply camera zoom
    const zoom = (this.settings.cameraZoom || 100) / 100 * 1.5;
    this.gameScene.cameras.main.setZoom(zoom);
    
    // Apply controls help visibility
    if (this.controlsPanel) {
      this.controlsPanel.setVisible(this.settings.showControlsHelp);
    }
    
    // Update game scene with new key bindings
    this.updateGameControls();
  }

  updateGameControls() {
    const controls = this.settings.controls;
    const scene = this.gameScene;
    
    // Remove old key bindings
    if (scene.customKeys) {
      Object.values(scene.customKeys).forEach(key => {
        if (key && key.destroy) {
          scene.input.keyboard.removeKey(key);
        }
      });
    }
    
    // Helper to get Phaser key code
    const getKeyCode = (keyName) => {
      const name = keyName.toUpperCase();
      // Check Phaser key codes first
      if (Phaser.Input.Keyboard.KeyCodes[name] !== undefined) {
        return Phaser.Input.Keyboard.KeyCodes[name];
      }
      // For single letters, get from KeyCodes
      if (name.length === 1 && name >= 'A' && name <= 'Z') {
        return Phaser.Input.Keyboard.KeyCodes[name];
      }
      // Fallback to char code
      return name.charCodeAt(0);
    };
    
    // Create new key bindings - remove old ones first properly
    if (scene.customKeys) {
      Object.keys(scene.customKeys).forEach(k => {
        const key = scene.customKeys[k];
        if (key) {
          key.reset();
        }
      });
    }
    
    scene.customKeys = {
      up: scene.input.keyboard.addKey(getKeyCode(controls.moveUp), true, true),
      down: scene.input.keyboard.addKey(getKeyCode(controls.moveDown), true, true),
      left: scene.input.keyboard.addKey(getKeyCode(controls.moveLeft), true, true),
      right: scene.input.keyboard.addKey(getKeyCode(controls.moveRight), true, true),
      harvest: scene.input.keyboard.addKey(getKeyCode(controls.harvest), true, true),
      interact: scene.input.keyboard.addKey(getKeyCode(controls.interact), true, true),
      attack: scene.input.keyboard.addKey(getKeyCode(controls.attack), true, true)
    };
    
    console.log('Controls updated:', controls);
    
    // Update controls help UI
    this.updateControlsHelp();
  }
  
  updateControlsHelp() {
    if (!this.controlsPanel) return;
    
    const controls = this.settings.controls;
    const controlsText = [
      'Controls:',
      `${controls.moveUp}/${controls.moveLeft}/${controls.moveDown}/${controls.moveRight} - Move`,
      `${controls.harvest} - Mine/Harvest`,
      `${controls.interact} - Interact`,
      `${controls.attack} - Attack`,
      'I - Inventory',
      'C - Crafting',
      'ESC - Close menus'
    ];
    
    if (this.controlsHelpText) {
      this.controlsHelpText.setText(controlsText.join('\n'));
    }
  }

  createDevTools() {
    // Dev tools - hidden by default, tap tilde 5 times to unlock
    this.devToolsVisible = false;
    this.devToolsUnlocked = false;
    this.tildeTapCount = 0;
    this.tildeTapTimer = null;
    
    // Listen for tilde key to unlock dev tools
    this.input.keyboard.on('keydown-BACKTICK', () => {
      this.tildeTapCount++;
      
      // Reset count after 2 seconds of no taps
      if (this.tildeTapTimer) {
        clearTimeout(this.tildeTapTimer);
      }
      this.tildeTapTimer = setTimeout(() => {
        this.tildeTapCount = 0;
      }, 2000);
      
      // Unlock after 5 taps
      if (this.tildeTapCount >= 5 && !this.devToolsUnlocked) {
        this.devToolsUnlocked = true;
        this.devToggleBtn.setVisible(true);
        this.infoPanel.setVisible(true);
        this.showFloatingMessage('Dev tools unlocked!');
      }
    });
    
    // Dev tools toggle button (hidden until unlocked)
    this.devToggleBtn = this.add.text(10, 780, '🔧 DEV', {
      fontSize: '10px',
      fontFamily: 'Arial',
      backgroundColor: '#444444',
      padding: { x: 4, y: 2 }
    }).setInteractive({ useHandCursor: true });
    this.devToggleBtn.setVisible(false);
    
    this.devToggleBtn.on('pointerdown', () => {
      this.devToolsVisible = !this.devToolsVisible;
      this.devToolsPanel.setVisible(this.devToolsVisible);
    });
    
    // Dev tools panel
    this.devToolsPanel = this.add.container(150, 400);
    this.devToolsPanel.setVisible(false);
    
    const bg = this.add.rectangle(0, 0, 300, 380, 0x222222, 0.95).setOrigin(0, 0);
    const title = this.add.text(150, 10, '🔧 DEV TOOLS', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    
    this.devToolsPanel.add([bg, title]);
    
    let y = 40;
    
    // Resource buttons
    const resourceGroups = [
      { label: 'Basic', resources: ['wood', 'stone', 'fiber', 'berries'] },
      { label: 'Tier 2', resources: ['coal', 'copper'] },
      { label: 'Tier 3', resources: ['iron'] },
      { label: 'Tier 4', resources: ['gold', 'crystal'] },
      { label: 'Tier 5', resources: ['diamond', 'mythril'] },
      { label: 'Bars', resources: ['copperBar', 'ironBar', 'goldBar', 'steelBar', 'mythrilBar'] }
    ];
    
    resourceGroups.forEach(group => {
      const groupLabel = this.add.text(10, y, group.label + ':', {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      });
      this.devToolsPanel.add(groupLabel);
      
      let x = 70;
      group.resources.forEach(res => {
        const btn = this.add.text(x, y, `+50 ${res}`, {
          fontSize: '10px',
          fontFamily: 'Arial',
          backgroundColor: '#3a5a3a',
          padding: { x: 3, y: 2 }
        }).setInteractive({ useHandCursor: true });
        
        btn.on('pointerdown', () => this.devAddResource(res, 50));
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#4a7a4a' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#3a5a3a' }));
        
        this.devToolsPanel.add(btn);
        x += btn.width + 5;
        if (x > 280) {
          x = 70;
          y += 20;
        }
      });
      y += 25;
    });
    
    y += 10;
    
    // Quick actions
    const quickActions = [
      { label: '+1000 All Resources', action: () => this.devAddAllResources(1000) },
      { label: 'Unlock All Tools', action: () => this.devUnlockAllTools() },
      { label: 'Max Health & Energy', action: () => this.devMaxStats() },
      { label: '+10 Levels', action: () => this.devAddLevels(10) },
      { label: 'Clear Save Data', action: () => this.devClearSave() }
    ];
    
    quickActions.forEach(action => {
      const btn = this.add.text(10, y, action.label, {
        fontSize: '12px',
        fontFamily: 'Arial',
        backgroundColor: '#4a4a6a',
        padding: { x: 8, y: 4 }
      }).setInteractive({ useHandCursor: true });
      
      btn.on('pointerdown', action.action);
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#6a6a8a' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#4a4a6a' }));
      
      this.devToolsPanel.add(btn);
      y += 28;
    });
  }

  devAddResource(resource, amount) {
    // Add to new slot-based inventory
    this.inventoryUI.addItem(resource, amount);
    
    // Also update old inventory for compatibility
    const inventory = this.registry.get('inventory');
    inventory[resource] = (inventory[resource] || 0) + amount;
    this.registry.set('inventory', inventory);
    
    this.inventoryUI.refresh();
    this.showNotification(`DEV: +${amount} ${resource}`);
  }

  devAddAllResources(amount) {
    const allResources = ['wood', 'stone', 'fiber', 'berries', 'coal', 'copper', 'iron', 
                         'gold', 'crystal', 'diamond', 'mythril', 
                         'copperBar', 'ironBar', 'goldBar', 'steelBar', 'mythrilBar'];
    allResources.forEach(res => {
      this.inventoryUI.addItem(res, amount);
      
      // Also update old inventory
      const inventory = this.registry.get('inventory');
      inventory[res] = (inventory[res] || 0) + amount;
      this.registry.set('inventory', inventory);
    });
    
    this.inventoryUI.refresh();
    this.showNotification(`DEV: +${amount} all resources`);
  }

  devUnlockAllTools() {
    const allTools = Object.keys(TOOLS);
    this.registry.set('tools', allTools);
    
    // Add tools to hotbar
    const hotbar = this.registry.get('hotbar') || new Array(6).fill(null);
    let slot = 0;
    allTools.slice(0, 6).forEach(tool => {
      if (tool !== 'hands') {
        hotbar[slot] = { item: tool, count: 1 };
        slot++;
      }
    });
    this.registry.set('hotbar', hotbar);
    
    this.inventoryUI.refresh();
    this.showNotification('DEV: All tools unlocked');
  }

  devMaxStats() {
    this.registry.set('health', 100);
    this.registry.set('energy', ENERGY.max);
    this.showNotification('DEV: Max health & energy');
  }

  devAddLevels(amount) {
    const level = this.registry.get('level');
    this.registry.set('level', level + amount);
    this.showNotification(`DEV: +${amount} levels`);
  }

  devClearSave() {
    localStorage.removeItem('forger2_save');
    this.showNotification('DEV: Save cleared - refresh to restart');
  }

  // ========== MULTIPLAYER UI ==========
  
  createMultiplayerUI() {
    const networkManager = this.registry.get('networkManager');
    if (!networkManager) return;
    
    const { width, height } = this.cameras.main;
    
    // Multiplayer info panel in bottom-right
    this.mpPanel = this.add.container(width - 100, height - 90);
    
    // Background
    const mpBg = this.add.rectangle(0, 0, 90, 80, 0x000000, 0.7)
      .setOrigin(0)
      .setStrokeStyle(1, 0x444444);
    
    // Room code
    const roomCode = networkManager.getRoomCode();
    const roomText = this.add.text(5, 5, `Room: ${roomCode}`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#ffd700'
    });
    
    // Host/Client indicator
    const roleText = this.add.text(5, 20, this.isHost ? 'HOST' : 'CLIENT', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: this.isHost ? '#88ff88' : '#88aaff'
    });
    
    // Player number
    const playerText = this.add.text(5, 35, `You: P${this.playerNumber}`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#ffffff'
    });
    
    // Player count (updated dynamically)
    this.mpPlayerCountText = this.add.text(5, 50, 'Players: 1', {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });
    
    // Latency display
    this.mpLatencyText = this.add.text(5, 65, 'Ping: --', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: '#888888'
    });
    
    this.mpPanel.add([mpBg, roomText, roleText, playerText, this.mpPlayerCountText, this.mpLatencyText]);
    
    // Update multiplayer info periodically
    this.time.addEvent({
      delay: 1000,
      callback: this.updateMultiplayerUI,
      callbackScope: this,
      loop: true
    });
  }
  
  updateMultiplayerUI() {
    if (!this.isMultiplayer) return;
    
    const networkManager = this.registry.get('networkManager');
    if (!networkManager) return;
    
    // Update player count
    const playerCount = networkManager.getPlayerCount();
    if (this.mpPlayerCountText) {
      this.mpPlayerCountText.setText(`Players: ${playerCount}`);
    }
    
    // Update latency
    const latency = networkManager.getLatency();
    if (this.mpLatencyText) {
      this.mpLatencyText.setText(`Ping: ${latency}ms`);
      
      // Color based on latency
      if (latency < 50) {
        this.mpLatencyText.setColor('#88ff88');
      } else if (latency < 100) {
        this.mpLatencyText.setColor('#ffff88');
      } else {
        this.mpLatencyText.setColor('#ff8888');
      }
    }
  }
  
  showFloatingMessage(message) {
    const { width, height } = this.cameras.main;
    const text = this.add.text(width / 2, height / 2, message, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffdd44',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: text,
      y: height / 2 - 50,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }
}
