import { RESOURCES, TOOLS, EQUIPMENT, CONSUMABLES } from '../data/GameData.js';

export class InventoryUI {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.selectedSlot = null;
    this.dragItem = null;
    
    // Inventory grid size
    this.gridCols = 8;
    this.gridRows = 4;
    this.slotSize = 50;
    this.slotPadding = 4;
    
    // Hotbar size
    this.hotbarSlots = 6;
    
    this.create();
  }

  create() {
    // Main container - hidden by default
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(6000);
    this.container.setVisible(false);
    
    // Dark overlay
    this.overlay = this.scene.add.rectangle(600, 400, 1200, 800, 0x000000, 0.8)
      .setInteractive();
    this.container.add(this.overlay);
    
    // Main panel background
    const panelWidth = 750;
    const panelHeight = 550;
    const panelX = 600 - panelWidth / 2;
    const panelY = 400 - panelHeight / 2;
    
    this.panel = this.scene.add.rectangle(600, 400, panelWidth, panelHeight, 0x2a2a3a, 0.95);
    this.container.add(this.panel);
    
    // Title
    const title = this.scene.add.text(600, panelY + 20, 'INVENTORY', {
      fontSize: '24px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    this.container.add(title);
    
    // Close button
    const closeBtn = this.scene.add.text(panelX + panelWidth - 30, panelY + 10, 'X', {
      fontSize: '20px',
      fontFamily: 'Arial',
      backgroundColor: '#aa4444',
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggle());
    this.container.add(closeBtn);
    
    // === LEFT SIDE: Character & Equipment ===
    this.createEquipmentPanel(panelX + 20, panelY + 60);
    
    // === RIGHT SIDE: Inventory Grid ===
    this.createInventoryGrid(panelX + 280, panelY + 60);
    
    // === BOTTOM: Hotbar ===
    this.createHotbar();
    
    // === Item tooltip ===
    this.createTooltip();
    
    // Drag and drop
    this.scene.input.on('pointerup', () => this.endDrag());
  }

  createEquipmentPanel(x, y) {
    // Character silhouette background
    const charBg = this.scene.add.rectangle(x + 100, y + 150, 200, 300, 0x1a1a2a);
    this.container.add(charBg);
    
    // Character label
    const charLabel = this.scene.add.text(x + 100, y, 'CHARACTER', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    this.container.add(charLabel);
    
    // Simple character representation
    const playerSprite = this.scene.add.image(x + 100, y + 150, 'player').setScale(3);
    this.container.add(playerSprite);
    
    // Equipment slots
    this.equipmentSlots = {};
    const slots = [
      { key: 'head', label: 'Head', x: x + 100, y: y + 40 },
      { key: 'chest', label: 'Chest', x: x + 100, y: y + 120 },
      { key: 'legs', label: 'Legs', x: x + 100, y: y + 200 },
      { key: 'feet', label: 'Feet', x: x + 100, y: y + 280 },
      { key: 'weapon', label: 'Weapon', x: x + 20, y: y + 150 },
      { key: 'offhand', label: 'Offhand', x: x + 180, y: y + 150 }
    ];
    
    slots.forEach(slot => {
      const slotBg = this.scene.add.rectangle(slot.x, slot.y, 48, 48, 0x3a3a4a)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, 0x5a5a6a);
      
      slotBg.slotType = 'equipment';
      slotBg.slotKey = slot.key;
      
      slotBg.on('pointerover', () => this.onSlotHover(slotBg));
      slotBg.on('pointerout', () => this.onSlotOut(slotBg));
      slotBg.on('pointerdown', () => this.onSlotClick(slotBg));
      
      const label = this.scene.add.text(slot.x, slot.y + 30, slot.label, {
        fontSize: '9px',
        fontFamily: 'Arial',
        color: '#888888'
      }).setOrigin(0.5, 0);
      
      this.equipmentSlots[slot.key] = {
        bg: slotBg,
        label: label,
        itemIcon: null,
        item: null
      };
      
      this.container.add([slotBg, label]);
    });
    
    // Stats display
    this.statsText = this.scene.add.text(x, y + 320, '', {
      fontSize: '11px',
      fontFamily: 'Arial',
      lineSpacing: 4
    });
    this.container.add(this.statsText);
  }

  createInventoryGrid(x, y) {
    // Inventory label
    const invLabel = this.scene.add.text(x, y - 5, 'INVENTORY', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    this.container.add(invLabel);
    
    // Grid slots
    this.inventorySlots = [];
    
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const slotX = x + col * (this.slotSize + this.slotPadding) + this.slotSize / 2;
        const slotY = y + 25 + row * (this.slotSize + this.slotPadding) + this.slotSize / 2;
        
        const slotBg = this.scene.add.rectangle(slotX, slotY, this.slotSize, this.slotSize, 0x3a3a4a)
          .setInteractive({ useHandCursor: true })
          .setStrokeStyle(1, 0x5a5a6a);
        
        const slotIndex = row * this.gridCols + col;
        slotBg.slotType = 'inventory';
        slotBg.slotIndex = slotIndex;
        
        slotBg.on('pointerover', () => this.onSlotHover(slotBg));
        slotBg.on('pointerout', () => this.onSlotOut(slotBg));
        slotBg.on('pointerdown', () => this.onSlotClick(slotBg));
        
        this.inventorySlots.push({
          bg: slotBg,
          itemIcon: null,
          itemText: null,
          item: null,
          count: 0
        });
        
        this.container.add(slotBg);
      }
    }
    
    // Drop item button
    const dropBtn = this.scene.add.text(x + 350, y + 250, 'Drop Selected', {
      fontSize: '12px',
      fontFamily: 'Arial',
      backgroundColor: '#6a4a4a',
      padding: { x: 10, y: 6 }
    }).setInteractive({ useHandCursor: true });
    dropBtn.on('pointerdown', () => this.dropSelectedItem());
    this.container.add(dropBtn);
  }

  createHotbar() {
    // Hotbar is always visible at bottom of screen
    this.hotbarContainer = this.scene.add.container(600, 750);
    this.hotbarContainer.setDepth(5500);
    
    const hotbarBg = this.scene.add.rectangle(0, 0, 
      this.hotbarSlots * (this.slotSize + this.slotPadding) + 20, 
      this.slotSize + 20, 0x2a2a3a, 0.9);
    this.hotbarContainer.add(hotbarBg);
    
    this.hotbarSlotObjects = [];
    const startX = -(this.hotbarSlots * (this.slotSize + this.slotPadding)) / 2 + this.slotSize / 2;
    
    for (let i = 0; i < this.hotbarSlots; i++) {
      const slotX = startX + i * (this.slotSize + this.slotPadding);
      
      const slotBg = this.scene.add.rectangle(slotX, 0, this.slotSize, this.slotSize, 0x3a3a4a)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, 0x5a5a6a);
      
      slotBg.slotType = 'hotbar';
      slotBg.slotIndex = i;
      
      slotBg.on('pointerdown', () => this.selectHotbarSlot(i));
      
      // Slot number
      const numText = this.scene.add.text(slotX - 20, -20, `${i + 1}`, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#888888'
      });
      
      this.hotbarSlotObjects.push({
        bg: slotBg,
        numText: numText,
        itemIcon: null,
        itemText: null,
        item: null,
        count: 0
      });
      
      this.hotbarContainer.add([slotBg, numText]);
    }
    
    // Current hotbar selection
    this.hotbarSelection = 0;
    this.updateHotbarSelection();
    
    // Number key shortcuts for hotbar
    for (let i = 1; i <= this.hotbarSlots; i++) {
      this.scene.input.keyboard.on(`keydown-${i}`, () => {
        this.selectHotbarSlot(i - 1);
      });
    }
  }

  createTooltip() {
    this.tooltip = this.scene.add.container(0, 0);
    this.tooltip.setDepth(7000);
    this.tooltip.setVisible(false);
    
    this.tooltipBg = this.scene.add.rectangle(0, 0, 200, 100, 0x1a1a2a, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5a5a6a);
    
    this.tooltipTitle = this.scene.add.text(10, 8, '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    
    this.tooltipDesc = this.scene.add.text(10, 28, '', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
      wordWrap: { width: 180 }
    });
    
    this.tooltip.add([this.tooltipBg, this.tooltipTitle, this.tooltipDesc]);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.container.setVisible(this.isOpen);
    
    if (this.isOpen) {
      this.refresh();
    }
  }

  refresh() {
    this.refreshInventoryGrid();
    this.refreshEquipment();
    this.refreshHotbar();
    this.refreshStats();
  }

  refreshInventoryGrid() {
    // Get both old inventory (resources) and new slot-based inventory
    const oldInventory = this.scene.registry.get('inventory') || {};
    const inventorySlots = this.scene.registry.get('inventorySlots') || [];
    
    // Convert old inventory to slot format if inventorySlots is empty
    let itemsToShow = [];
    
    // First add items from inventorySlots
    inventorySlots.forEach(slotData => {
      if (slotData && slotData.item) {
        itemsToShow.push({ item: slotData.item, count: slotData.count || 1 });
      }
    });
    
    // Then add resources from old inventory that aren't already shown
    Object.entries(oldInventory).forEach(([itemKey, count]) => {
      if (count > 0 && !itemsToShow.find(i => i.item === itemKey)) {
        itemsToShow.push({ item: itemKey, count: count });
      }
    });
    
    this.inventorySlots.forEach((slot, index) => {
      // Clear existing
      if (slot.itemIcon) {
        slot.itemIcon.destroy();
        slot.itemIcon = null;
      }
      if (slot.itemText) {
        slot.itemText.destroy();
        slot.itemText = null;
      }
      
      const itemData = itemsToShow[index];
      if (itemData && itemData.item) {
        slot.item = itemData.item;
        slot.count = itemData.count || 1;
        
        // Create icon - resources use their key directly as texture
        const iconKey = this.getItemIconKey(itemData.item);
        if (this.scene.textures.exists(iconKey)) {
          slot.itemIcon = this.scene.add.image(slot.bg.x, slot.bg.y, iconKey).setScale(1.5);
          this.container.add(slot.itemIcon);
        } else {
          // Fallback text icon
          const resourceData = RESOURCES[itemData.item];
          const displayText = resourceData ? resourceData.name.substring(0, 3) : itemData.item.substring(0, 2).toUpperCase();
          slot.itemIcon = this.scene.add.text(slot.bg.x, slot.bg.y, displayText, {
            fontSize: '14px',
            fontFamily: 'Arial',
            fontStyle: 'bold'
          }).setOrigin(0.5);
          this.container.add(slot.itemIcon);
        }
        
        // Count text
        if (slot.count > 1) {
          slot.itemText = this.scene.add.text(slot.bg.x + 18, slot.bg.y + 18, `${slot.count}`, {
            fontSize: '11px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
          }).setOrigin(1, 1);
          this.container.add(slot.itemText);
        }
      } else {
        slot.item = null;
        slot.count = 0;
      }
    });
  }

  refreshEquipment() {
    const equipment = this.scene.registry.get('equipment') || {};
    
    Object.keys(this.equipmentSlots).forEach(slotKey => {
      const slot = this.equipmentSlots[slotKey];
      
      if (slot.itemIcon) {
        slot.itemIcon.destroy();
        slot.itemIcon = null;
      }
      
      const equippedItem = equipment[slotKey];
      if (equippedItem) {
        slot.item = equippedItem;
        
        const iconKey = this.getItemIconKey(equippedItem);
        if (this.scene.textures.exists(iconKey)) {
          slot.itemIcon = this.scene.add.image(slot.bg.x, slot.bg.y, iconKey).setScale(1.2);
        } else {
          slot.itemIcon = this.scene.add.text(slot.bg.x, slot.bg.y, equippedItem.substring(0, 2).toUpperCase(), {
            fontSize: '14px',
            fontFamily: 'Arial',
            fontStyle: 'bold'
          }).setOrigin(0.5);
        }
        this.container.add(slot.itemIcon);
      } else {
        slot.item = null;
      }
    });
  }

  refreshHotbar() {
    // Get tools from registry - this is the main source of owned tools
    const tools = this.scene.registry.get('tools') || ['hands'];
    const hotbar = this.scene.registry.get('hotbar') || [];
    
    this.hotbarSlotObjects.forEach((slot, index) => {
      if (slot.itemIcon) {
        slot.itemIcon.destroy();
        slot.itemIcon = null;
      }
      if (slot.itemText) {
        slot.itemText.destroy();
        slot.itemText = null;
      }
      
      // First check hotbar, then fall back to tools array
      let itemKey = null;
      let itemCount = 1;
      
      const hotbarItem = hotbar[index];
      if (hotbarItem && hotbarItem.item) {
        itemKey = hotbarItem.item;
        itemCount = hotbarItem.count || 1;
      } else if (index < tools.length) {
        // Show tools in hotbar slots
        itemKey = tools[index];
      }
      
      if (itemKey && itemKey !== 'hands') {
        slot.item = itemKey;
        slot.count = itemCount;
        
        // Get the texture key - tools use their key directly
        const iconKey = TOOLS[itemKey] ? itemKey : this.getItemIconKey(itemKey);
        if (this.scene.textures.exists(iconKey)) {
          slot.itemIcon = this.scene.add.image(slot.bg.x, slot.bg.y, iconKey).setScale(1.5);
        } else {
          // Fallback: show tool name abbreviation
          const toolData = TOOLS[itemKey];
          const displayText = toolData ? toolData.name.substring(0, 3) : itemKey.substring(0, 2).toUpperCase();
          slot.itemIcon = this.scene.add.text(slot.bg.x, slot.bg.y, displayText, {
            fontSize: '12px',
            fontFamily: 'Arial',
            fontStyle: 'bold'
          }).setOrigin(0.5);
        }
        this.hotbarContainer.add(slot.itemIcon);
        
        if (itemCount > 1) {
          slot.itemText = this.scene.add.text(slot.bg.x + 18, slot.bg.y + 18, `${itemCount}`, {
            fontSize: '11px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
          }).setOrigin(1, 1);
          this.hotbarContainer.add(slot.itemText);
        }
      } else if (index === 0) {
        // First slot shows "Hands" if no tool
        slot.item = 'hands';
        slot.count = 1;
        slot.itemIcon = this.scene.add.text(slot.bg.x, slot.bg.y, '✊', {
          fontSize: '20px'
        }).setOrigin(0.5);
        this.hotbarContainer.add(slot.itemIcon);
      } else {
        slot.item = null;
        slot.count = 0;
      }
    });
    
    this.updateHotbarSelection();
  }

  refreshStats() {
    const equipment = this.scene.registry.get('equipment') || {};
    let totalDefense = 0;
    
    Object.values(equipment).forEach(itemKey => {
      if (itemKey && EQUIPMENT[itemKey]) {
        totalDefense += EQUIPMENT[itemKey].defense;
      }
    });
    
    const currentTool = this.scene.registry.get('currentTool') || 'hands';
    const toolData = TOOLS[currentTool];
    const attackPower = toolData ? toolData.power * (toolData.type === 'sword' ? 6 : 3) : 5;
    
    this.statsText.setText([
      `Defense: ${totalDefense}`,
      `Attack: ${attackPower}`,
      `Tool: ${toolData?.name || 'Hands'}`
    ].join('\n'));
  }

  getItemIconKey(itemKey) {
    // Map item keys to texture keys
    if (RESOURCES[itemKey]) return itemKey;
    if (TOOLS[itemKey]) return 'tool_' + itemKey;
    if (EQUIPMENT[itemKey]) return 'equip_' + itemKey;
    return itemKey;
  }

  getItemData(itemKey) {
    if (RESOURCES[itemKey]) return { ...RESOURCES[itemKey], category: 'resource' };
    if (TOOLS[itemKey]) return { ...TOOLS[itemKey], category: 'tool' };
    if (EQUIPMENT[itemKey]) return { ...EQUIPMENT[itemKey], category: 'equipment' };
    if (CONSUMABLES[itemKey]) return { ...CONSUMABLES[itemKey], category: 'consumable' };
    return null;
  }

  onSlotHover(slotBg) {
    slotBg.setStrokeStyle(2, 0x88aaff);
    
    let item = null;
    if (slotBg.slotType === 'inventory') {
      item = this.inventorySlots[slotBg.slotIndex]?.item;
    } else if (slotBg.slotType === 'equipment') {
      item = this.equipmentSlots[slotBg.slotKey]?.item;
    } else if (slotBg.slotType === 'hotbar') {
      item = this.hotbarSlotObjects[slotBg.slotIndex]?.item;
    }
    
    if (item) {
      this.showTooltip(item, slotBg.x, slotBg.y);
    }
  }

  onSlotOut(slotBg) {
    slotBg.setStrokeStyle(slotBg.slotType === 'hotbar' ? 2 : 1, 0x5a5a6a);
    this.tooltip.setVisible(false);
  }

  onSlotClick(slotBg) {
    if (slotBg.slotType === 'inventory') {
      const slot = this.inventorySlots[slotBg.slotIndex];
      if (slot.item) {
        this.selectedSlot = { type: 'inventory', index: slotBg.slotIndex };
        this.highlightSelectedSlot();
        
        // Double-click to use/equip
        if (this.lastClickedSlot === slotBg.slotIndex && Date.now() - this.lastClickTime < 300) {
          this.useItem(slot.item, slotBg.slotIndex);
        }
        this.lastClickedSlot = slotBg.slotIndex;
        this.lastClickTime = Date.now();
      }
    } else if (slotBg.slotType === 'equipment') {
      const slot = this.equipmentSlots[slotBg.slotKey];
      if (slot.item) {
        // Unequip
        this.unequipItem(slotBg.slotKey);
      }
    }
  }

  highlightSelectedSlot() {
    // Reset all highlights
    this.inventorySlots.forEach(slot => {
      slot.bg.setStrokeStyle(1, 0x5a5a6a);
    });
    
    if (this.selectedSlot && this.selectedSlot.type === 'inventory') {
      this.inventorySlots[this.selectedSlot.index].bg.setStrokeStyle(2, 0xffaa44);
    }
  }

  selectHotbarSlot(index) {
    this.hotbarSelection = index;
    this.updateHotbarSelection();
    
    // Set current tool based on hotbar selection
    const tools = this.scene.registry.get('tools') || ['hands'];
    const hotbar = this.scene.registry.get('hotbar') || [];
    
    // Check hotbar first, then tools array
    const hotbarItem = hotbar[index];
    if (hotbarItem && hotbarItem.item && TOOLS[hotbarItem.item]) {
      this.scene.registry.set('currentTool', hotbarItem.item);
    } else if (index < tools.length && TOOLS[tools[index]]) {
      this.scene.registry.set('currentTool', tools[index]);
    } else {
      this.scene.registry.set('currentTool', 'hands');
    }
  }

  updateHotbarSelection() {
    this.hotbarSlotObjects.forEach((slot, index) => {
      if (index === this.hotbarSelection) {
        slot.bg.setStrokeStyle(3, 0x88ff88);
      } else {
        slot.bg.setStrokeStyle(2, 0x5a5a6a);
      }
    });
  }

  useItem(itemKey, slotIndex) {
    const itemData = this.getItemData(itemKey);
    if (!itemData) return;
    
    if (itemData.category === 'tool') {
      // Add to hotbar
      this.addToHotbar(itemKey, slotIndex);
    } else if (itemData.category === 'equipment') {
      // Equip
      this.equipItem(itemKey, slotIndex);
    } else if (itemData.category === 'consumable') {
      // Use consumable
      this.consumeItem(itemKey, slotIndex);
    }
  }

  equipItem(itemKey, fromSlotIndex) {
    const equipData = EQUIPMENT[itemKey];
    if (!equipData) return;
    
    const equipment = this.scene.registry.get('equipment') || {};
    const inventory = this.scene.registry.get('inventorySlots') || [];
    
    // Swap with existing equipment
    const existingItem = equipment[equipData.slot];
    equipment[equipData.slot] = itemKey;
    
    // Remove from inventory
    inventory[fromSlotIndex] = existingItem ? { item: existingItem, count: 1 } : null;
    
    this.scene.registry.set('equipment', equipment);
    this.scene.registry.set('inventorySlots', inventory);
    this.refresh();
  }

  unequipItem(slotKey) {
    const equipment = this.scene.registry.get('equipment') || {};
    const inventory = this.scene.registry.get('inventorySlots') || [];
    
    const item = equipment[slotKey];
    if (!item) return;
    
    // Find empty inventory slot
    const emptyIndex = inventory.findIndex(slot => !slot || !slot.item);
    if (emptyIndex === -1) {
      // Inventory full
      return;
    }
    
    inventory[emptyIndex] = { item: item, count: 1 };
    equipment[slotKey] = null;
    
    this.scene.registry.set('equipment', equipment);
    this.scene.registry.set('inventorySlots', inventory);
    this.refresh();
  }

  addToHotbar(itemKey, fromSlotIndex) {
    const hotbar = this.scene.registry.get('hotbar') || [];
    const inventory = this.scene.registry.get('inventorySlots') || [];
    
    // Find empty hotbar slot
    let targetSlot = hotbar.findIndex(slot => !slot || !slot.item);
    if (targetSlot === -1) targetSlot = 0; // Replace first slot
    
    // Swap
    const existingHotbarItem = hotbar[targetSlot];
    hotbar[targetSlot] = { item: itemKey, count: 1 };
    inventory[fromSlotIndex] = existingHotbarItem;
    
    this.scene.registry.set('hotbar', hotbar);
    this.scene.registry.set('inventorySlots', inventory);
    this.refresh();
  }

  consumeItem(itemKey, slotIndex) {
    const consumable = CONSUMABLES[itemKey];
    if (!consumable) return;
    
    const inventory = this.scene.registry.get('inventorySlots') || [];
    const slot = inventory[slotIndex];
    
    if (consumable.healAmount) {
      const health = this.scene.registry.get('health') || 100;
      this.scene.registry.set('health', Math.min(100, health + consumable.healAmount));
    }
    
    if (consumable.energyAmount) {
      const energy = this.scene.registry.get('energy') || 100;
      this.scene.registry.set('energy', Math.min(100, energy + consumable.energyAmount));
    }
    
    // Reduce count
    slot.count--;
    if (slot.count <= 0) {
      inventory[slotIndex] = null;
    }
    
    this.scene.registry.set('inventorySlots', inventory);
    this.refresh();
  }

  dropSelectedItem() {
    if (!this.selectedSlot) return;
    
    const inventory = this.scene.registry.get('inventorySlots') || [];
    inventory[this.selectedSlot.index] = null;
    this.scene.registry.set('inventorySlots', inventory);
    this.selectedSlot = null;
    this.refresh();
  }

  showTooltip(itemKey, x, y) {
    const itemData = this.getItemData(itemKey);
    if (!itemData) return;
    
    this.tooltipTitle.setText(itemData.name || itemKey);
    
    let desc = '';
    if (itemData.category === 'tool') {
      desc = `Power: ${itemData.power}\nType: ${itemData.type || 'tool'}`;
    } else if (itemData.category === 'equipment') {
      desc = `Defense: ${itemData.defense}\nSlot: ${itemData.slot}`;
    } else if (itemData.category === 'consumable') {
      if (itemData.healAmount) desc += `Heals: ${itemData.healAmount} HP\n`;
      if (itemData.energyAmount) desc += `Energy: +${itemData.energyAmount}`;
    } else if (itemData.category === 'resource') {
      desc = `Tier ${itemData.tier} resource`;
    }
    
    this.tooltipDesc.setText(desc);
    
    // Resize background
    const height = 50 + desc.split('\n').length * 14;
    this.tooltipBg.setSize(200, height);
    
    // Position
    this.tooltip.setPosition(x + 30, y - 20);
    this.tooltip.setVisible(true);
  }

  endDrag() {
    this.dragItem = null;
  }

  // Add item to inventory (called from game logic)
  addItem(itemKey, count = 1) {
    const inventory = this.scene.registry.get('inventorySlots') || [];
    
    // Try to stack with existing
    const existingSlot = inventory.findIndex(slot => 
      slot && slot.item === itemKey && slot.count < 99
    );
    
    if (existingSlot !== -1) {
      inventory[existingSlot].count += count;
    } else {
      // Find empty slot
      const emptySlot = inventory.findIndex(slot => !slot || !slot.item);
      if (emptySlot !== -1) {
        inventory[emptySlot] = { item: itemKey, count: count };
      } else {
        return false; // Inventory full
      }
    }
    
    this.scene.registry.set('inventorySlots', inventory);
    this.refreshHotbar();
    return true;
  }

  // Check if has item
  hasItem(itemKey, count = 1) {
    const inventory = this.scene.registry.get('inventorySlots') || [];
    let total = 0;
    inventory.forEach(slot => {
      if (slot && slot.item === itemKey) {
        total += slot.count;
      }
    });
    return total >= count;
  }

  // Remove item from inventory
  removeItem(itemKey, count = 1) {
    const inventory = this.scene.registry.get('inventorySlots') || [];
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
    
    this.scene.registry.set('inventorySlots', inventory);
    return remaining === 0;
  }
}
