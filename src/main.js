import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { MultiplayerMenuScene } from './scenes/MultiplayerMenuScene.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [MainMenuScene, MultiplayerMenuScene, BootScene, GameScene, UIScene],
  input: {
    keyboard: {
      capture: [
        Phaser.Input.Keyboard.KeyCodes.TAB,
        Phaser.Input.Keyboard.KeyCodes.SPACE,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT
      ]
    }
  }
};

const game = new Phaser.Game(config);

// Prevent right-click context menu on the game canvas
document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'CANVAS') {
    e.preventDefault();
  }
});

// Prevent Tab from switching focus
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && document.activeElement?.tagName === 'CANVAS') {
    e.preventDefault();
  }
});
