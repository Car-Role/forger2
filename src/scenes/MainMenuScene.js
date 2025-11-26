import { SpriteGenerator } from '../utils/SpriteGenerator.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    // Generate sprites if not already done
    if (!this.textures.exists('player')) {
      const spriteGen = new SpriteGenerator(this);
      spriteGen.generateAllSprites();
    }
    
    const { width, height } = this.cameras.main;
    
    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);
    
    // Animated background particles
    this.createBackgroundParticles();
    
    // Title
    this.add.text(width / 2, 80, 'FORGER', {
      fontSize: '72px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#8b4513',
      strokeThickness: 6
    }).setOrigin(0.5);
    
    this.add.text(width / 2, 140, 'Craft • Build • Survive', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Save slots container
    this.createSaveSlots();
    
    // Multiplayer button
    this.createMultiplayerButton();
    
    // Settings button
    this.createSettingsButton();
    
    // Version info
    this.add.text(10, height - 25, 'v0.1.0', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#666666'
    });
  }
  
  createMultiplayerButton() {
    const { width, height } = this.cameras.main;
    
    const mpBtn = this.add.container(width / 2, 580);
    
    const mpBg = this.add.rectangle(0, 0, 200, 50, 0x4a6a8a)
      .setStrokeStyle(2, 0x6a8aaa)
      .setInteractive({ useHandCursor: true });
    
    const mpText = this.add.text(0, 0, '🌐 Multiplayer', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    mpBg.on('pointerover', () => mpBg.setFillStyle(0x5a7a9a));
    mpBg.on('pointerout', () => mpBg.setFillStyle(0x4a6a8a));
    mpBg.on('pointerdown', () => {
      this.scene.start('MultiplayerMenuScene');
    });
    
    mpBtn.add([mpBg, mpText]);
  }
  
  createBackgroundParticles() {
    // Create floating particles for ambiance
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, 1200);
      const y = Phaser.Math.Between(0, 800);
      const size = Phaser.Math.Between(2, 5);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.3);
      
      const particle = this.add.circle(x, y, size, 0xffd700, alpha);
      
      this.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(50, 150),
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        onRepeat: () => {
          particle.x = Phaser.Math.Between(0, 1200);
          particle.y = 850;
          particle.alpha = alpha;
        }
      });
    }
  }
  
  createSaveSlots() {
    const { width, height } = this.cameras.main;
    const startY = 220;
    const slotHeight = 100;
    const slotWidth = 400;
    
    // Container for save slots
    this.saveSlotContainer = this.add.container(width / 2, startY);
    
    // Load existing saves
    const saves = this.loadAllSaves();
    
    for (let i = 0; i < 3; i++) {
      const slotY = i * (slotHeight + 15);
      const saveData = saves[i];
      
      // Slot background
      const slotBg = this.add.rectangle(0, slotY, slotWidth, slotHeight, 0x2a2a4a)
        .setStrokeStyle(2, 0x4a4a7a)
        .setInteractive({ useHandCursor: true });
      
      // Slot number label
      const slotLabel = this.add.text(-slotWidth / 2 + 15, slotY - 35, `Save ${i + 1}`, {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#888888'
      });
      
      this.saveSlotContainer.add([slotBg, slotLabel]);
      
      if (saveData) {
        // Has save data - show info
        this.createFilledSlot(slotY, slotWidth, saveData, i);
      } else {
        // Empty slot
        this.createEmptySlot(slotY, slotWidth, i);
      }
      
      // Hover effect
      slotBg.on('pointerover', () => slotBg.setFillStyle(0x3a3a5a));
      slotBg.on('pointerout', () => slotBg.setFillStyle(0x2a2a4a));
    }
  }
  
  createFilledSlot(slotY, slotWidth, saveData, slotIndex) {
    // Player info
    const level = saveData.level || 1;
    const playTime = this.formatPlayTime(saveData.playTime || 0);
    const lastPlayed = this.formatDate(saveData.lastPlayed);
    
    const infoText = this.add.text(-slotWidth / 2 + 70, slotY - 20, 
      `Level ${level}  •  ${playTime}  •  ${lastPlayed}`, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });
    
    // Player icon
    const playerIcon = this.add.sprite(-slotWidth / 2 + 35, slotY, 'player')
      .setScale(1.5);
    
    // Continue button
    const continueBg = this.add.rectangle(slotWidth / 2 - 70, slotY - 12, 100, 30, 0x4a8a4a)
      .setInteractive({ useHandCursor: true });
    const continueText = this.add.text(slotWidth / 2 - 70, slotY - 12, 'Continue', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    continueBg.on('pointerover', () => continueBg.setFillStyle(0x5a9a5a));
    continueBg.on('pointerout', () => continueBg.setFillStyle(0x4a8a4a));
    continueBg.on('pointerdown', () => this.loadGame(slotIndex));
    
    // Delete button
    const deleteBg = this.add.rectangle(slotWidth / 2 - 70, slotY + 18, 100, 25, 0x6a4a4a)
      .setInteractive({ useHandCursor: true });
    const deleteText = this.add.text(slotWidth / 2 - 70, slotY + 18, 'Delete', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    
    deleteBg.on('pointerover', () => deleteBg.setFillStyle(0x8a5a5a));
    deleteBg.on('pointerout', () => deleteBg.setFillStyle(0x6a4a4a));
    deleteBg.on('pointerdown', () => this.confirmDelete(slotIndex));
    
    this.saveSlotContainer.add([infoText, playerIcon, continueBg, continueText, deleteBg, deleteText]);
  }
  
  createEmptySlot(slotY, slotWidth, slotIndex) {
    // Empty slot text
    const emptyText = this.add.text(0, slotY - 5, 'Empty Slot', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#666666'
    }).setOrigin(0.5);
    
    // New Game button
    const newGameBg = this.add.rectangle(0, slotY + 25, 120, 32, 0x4a6a8a)
      .setInteractive({ useHandCursor: true });
    const newGameText = this.add.text(0, slotY + 25, 'New Game', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    newGameBg.on('pointerover', () => newGameBg.setFillStyle(0x5a7a9a));
    newGameBg.on('pointerout', () => newGameBg.setFillStyle(0x4a6a8a));
    newGameBg.on('pointerdown', () => this.startNewGame(slotIndex));
    
    this.saveSlotContainer.add([emptyText, newGameBg, newGameText]);
  }
  
  createSettingsButton() {
    const { width, height } = this.cameras.main;
    
    const settingsBtn = this.add.container(width - 80, height - 50);
    const settingsBg = this.add.rectangle(0, 0, 120, 40, 0x3a3a5a)
      .setStrokeStyle(2, 0x5a5a7a)
      .setInteractive({ useHandCursor: true });
    const settingsText = this.add.text(0, 0, '⚙ Settings', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    
    settingsBg.on('pointerover', () => settingsBg.setFillStyle(0x4a4a6a));
    settingsBg.on('pointerout', () => settingsBg.setFillStyle(0x3a3a5a));
    settingsBg.on('pointerdown', () => this.openSettings());
    
    settingsBtn.add([settingsBg, settingsText]);
  }
  
  loadAllSaves() {
    const saves = [];
    for (let i = 0; i < 3; i++) {
      const key = `forger2_save_${i}`;
      const data = localStorage.getItem(key);
      saves.push(data ? JSON.parse(data) : null);
    }
    return saves;
  }
  
  formatPlayTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  formatDate(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  startNewGame(slotIndex) {
    // Set current save slot
    this.registry.set('currentSaveSlot', slotIndex);
    this.registry.set('isNewGame', true);
    
    // Transition to game
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start('BootScene');
    });
  }
  
  loadGame(slotIndex) {
    // Set current save slot
    this.registry.set('currentSaveSlot', slotIndex);
    this.registry.set('isNewGame', false);
    
    // Transition to game
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start('BootScene');
    });
  }
  
  confirmDelete(slotIndex) {
    // Create confirmation dialog
    const { width, height } = this.cameras.main;
    
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    
    const dialog = this.add.container(width / 2, height / 2);
    
    const dialogBg = this.add.rectangle(0, 0, 300, 150, 0x2a2a4a)
      .setStrokeStyle(2, 0x5a5a7a);
    
    const titleText = this.add.text(0, -50, 'Delete Save?', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    const warningText = this.add.text(0, -15, 'This cannot be undone!', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ff6666'
    }).setOrigin(0.5);
    
    // Confirm button
    const confirmBg = this.add.rectangle(-60, 40, 90, 35, 0x8a4a4a)
      .setInteractive({ useHandCursor: true });
    const confirmText = this.add.text(-60, 40, 'Delete', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x9a5a5a));
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(0x8a4a4a));
    confirmBg.on('pointerdown', () => {
      this.deleteSave(slotIndex);
      overlay.destroy();
      dialog.destroy();
      this.refreshSaveSlots();
    });
    
    // Cancel button
    const cancelBg = this.add.rectangle(60, 40, 90, 35, 0x4a4a6a)
      .setInteractive({ useHandCursor: true });
    const cancelText = this.add.text(60, 40, 'Cancel', {
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
    
    dialog.add([dialogBg, titleText, warningText, confirmBg, confirmText, cancelBg, cancelText]);
  }
  
  deleteSave(slotIndex) {
    const key = `forger2_save_${slotIndex}`;
    localStorage.removeItem(key);
  }
  
  refreshSaveSlots() {
    // Destroy and recreate save slots
    this.saveSlotContainer.destroy();
    this.createSaveSlots();
  }
  
  openSettings() {
    // Create settings overlay
    const { width, height } = this.cameras.main;
    
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    
    const panel = this.add.container(width / 2, height / 2);
    
    const panelBg = this.add.rectangle(0, 0, 400, 300, 0x2a2a4a)
      .setStrokeStyle(2, 0x5a5a7a);
    
    const titleText = this.add.text(0, -120, 'Settings', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Close button
    const closeBg = this.add.rectangle(180, -120, 30, 30, 0x8a4a4a)
      .setInteractive({ useHandCursor: true });
    const closeText = this.add.text(180, -120, '✕', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x9a5a5a));
    closeBg.on('pointerout', () => closeBg.setFillStyle(0x8a4a4a));
    closeBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
    });
    
    // Settings content
    const infoText = this.add.text(0, 0, 'Control settings can be changed\nin-game from the settings menu.', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
      align: 'center'
    }).setOrigin(0.5);
    
    panel.add([panelBg, titleText, closeBg, closeText, infoText]);
  }
}
