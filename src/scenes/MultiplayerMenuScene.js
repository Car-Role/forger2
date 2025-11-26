import { MessageTypes } from '../network/MessageTypes.js';

// Network manager singleton
let networkManager = null;

function getNetworkManager() {
  if (!networkManager) {
    // Create inline NetworkManager to avoid import issues
    networkManager = new SimpleNetworkManager();
  }
  return networkManager;
}

function resetNetworkManager() {
  if (networkManager) {
    networkManager.disconnect();
    networkManager = null;
  }
}

// Simplified inline NetworkManager for menu scene
class SimpleNetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.isHost = false;
    this.hostConnection = null;
    this.roomCode = null;
    this.localPlayerId = null;
    this.playerNumber = 0;
    this.connectedPlayers = new Map();
    this.messageHandlers = [];
    this.eventHandlers = {
      playerJoined: [],
      playerLeft: [],
      connectionError: [],
      roomCreated: [],
      joinedRoom: [],
      hostDisconnected: []
    };
    this.latency = 0;
    this.gameStarted = false; // Track if game has started
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async hostGame() {
    // Dynamically import PeerJS
    const { default: Peer } = await import('peerjs');
    
    return new Promise((resolve, reject) => {
      this.roomCode = this.generateRoomCode();
      this.isHost = true;
      this.playerNumber = 1;
      
      this.peer = new Peer(`forger2-${this.roomCode}`, { debug: 1 });
      
      this.peer.on('open', (id) => {
        this.localPlayerId = id;
        this.connectedPlayers.set(id, { playerNumber: 1, ready: true });
        resolve(this.roomCode);
      });
      
      this.peer.on('connection', (conn) => this.handleIncomingConnection(conn));
      this.peer.on('error', (err) => reject(err));
    });
  }

  async joinGame(roomCode) {
    const { default: Peer } = await import('peerjs');
    
    return new Promise((resolve, reject) => {
      this.roomCode = roomCode.toUpperCase();
      this.isHost = false;
      
      this.peer = new Peer(undefined, { debug: 1 });
      
      this.peer.on('open', (id) => {
        this.localPlayerId = id;
        const conn = this.peer.connect(`forger2-${this.roomCode}`, { reliable: true });
        
        conn.on('open', () => {
          this.hostConnection = conn;
          this.setupConnectionHandlers(conn);
          conn.send({ type: MessageTypes.PLAYER_JOIN, payload: { peerId: id } });
        });
        
        conn.on('error', (err) => reject(err));
        
        setTimeout(() => {
          if (!this.hostConnection) reject(new Error('Connection timeout'));
        }, 10000);
      });
      
      this.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') reject(new Error('Room not found'));
        else reject(err);
      });
      
      this.onMessage((type, data) => {
        if (type === MessageTypes.PLAYER_INFO) {
          this.playerNumber = data.playerNumber;
          resolve();
        }
      });
    });
  }

  handleIncomingConnection(conn) {
    conn.on('open', () => {
      if (this.connections.size >= 3) {
        conn.send({ type: 'room_full' });
        conn.close();
        return;
      }
      this.setupConnectionHandlers(conn);
      this.connections.set(conn.peer, conn);
      
      const playerNumber = this.getNextPlayerNumber();
      this.connectedPlayers.set(conn.peer, { playerNumber, ready: false });
      
      conn.send({
        type: MessageTypes.PLAYER_INFO,
        payload: { playerNumber, players: Object.fromEntries(this.connectedPlayers) }
      });
      
      // If game already started, tell the new player to start too
      if (this.gameStarted) {
        conn.send({ type: MessageTypes.GAME_START, payload: {} });
      }
      
      this.emit('playerJoined', { peerId: conn.peer, playerNumber });
    });
  }

  setupConnectionHandlers(conn) {
    conn.on('data', (data) => {
      this.messageHandlers.forEach(h => h(data.type, data.payload, conn.peer));
    });
    conn.on('close', () => {
      if (!this.isHost) this.emit('hostDisconnected');
    });
  }

  getNextPlayerNumber() {
    const used = new Set();
    this.connectedPlayers.forEach(p => used.add(p.playerNumber));
    for (let i = 1; i <= 4; i++) if (!used.has(i)) return i;
    return 0;
  }

  sendToAll(type, payload) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send({ type, payload });
    });
  }

  onMessage(callback) { this.messageHandlers.push(callback); }
  on(event, callback) { if (this.eventHandlers[event]) this.eventHandlers[event].push(callback); }
  emit(event, data) { if (this.eventHandlers[event]) this.eventHandlers[event].forEach(cb => cb(data)); }
  getPlayerCount() { return this.connectedPlayers.size; }
  getPlayers() { return Array.from(this.connectedPlayers.entries()).map(([id, info]) => ({ peerId: id, ...info, isLocal: id === this.localPlayerId })); }
  getPlayerNumber() { return this.playerNumber; }
  getRoomCode() { return this.roomCode; }
  getIsHost() { return this.isHost; }
  getLatency() { return this.latency; }
  
  startPingInterval() {
    // Ping interval for latency measurement
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      if (this.isHost) {
        this.connections.forEach((conn) => {
          if (conn.open) conn.send({ type: 'ping', payload: { timestamp: now } });
        });
      } else if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: 'ping', payload: { timestamp: now } });
      }
    }, 2000);
  }
  
  sendToHost(type, payload) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type, payload });
    }
  }
  
  sendToPeer(peerId, type, payload) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send({ type, payload });
    }
  }
  
  broadcast(type, payload) {
    if (this.isHost) {
      this.sendToAll(type, payload);
    } else {
      this.sendToHost(type, payload);
    }
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.isHost) this.connections.forEach(c => c.close());
    else if (this.hostConnection) this.hostConnection.close();
    if (this.peer) this.peer.destroy();
    this.peer = null;
    this.connections.clear();
    this.connectedPlayers.clear();
  }
}

export class MultiplayerMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MultiplayerMenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    
    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);
    
    // Title
    this.add.text(width / 2, 60, 'MULTIPLAYER', {
      fontSize: '48px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffd700'
    }).setOrigin(0.5);
    
    // Subtitle
    this.add.text(width / 2, 110, 'Play with up to 4 players', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Status text (create first since showMainMenu uses it)
    this.statusText = this.add.text(width / 2, height - 80, '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ff6666'
    }).setOrigin(0.5);
    
    // Create UI containers
    this.createMainMenu();
    this.createHostPanel();
    this.createJoinPanel();
    this.createLobbyPanel();
    
    // Back button
    this.createBackButton();
    
    // Show main menu initially
    this.showMainMenu();
  }

  createMainMenu() {
    const { width, height } = this.cameras.main;
    this.mainMenuContainer = this.add.container(width / 2, height / 2 - 50);
    
    // Check for multiplayer saves
    this.multiplayerSaves = this.findMultiplayerSaves();
    console.log('Multiplayer saves found:', this.multiplayerSaves.length);
    
    // Host New Game button
    const hostBtn = this.createButton(0, 0, 'Host New Game', 0x4a8a4a, () => {
      this.selectedSave = null;
      this.showHostPanel();
    });
    
    // Continue Saved Game button (only if saves exist)
    let continueBtn = null;
    if (this.multiplayerSaves.length > 0) {
      console.log('Creating Continue Saved Game button');
      continueBtn = this.createButton(0, 70, 'Continue Saved Game', 0x6a6a4a, () => {
        this.showSaveSelectPanel();
      });
    }
    
    // Join Game button
    const joinBtn = this.createButton(0, continueBtn ? 140 : 70, 'Join Game', 0x4a6a8a, () => {
      this.showJoinPanel();
    });
    
    const items = [hostBtn, joinBtn];
    if (continueBtn) items.splice(1, 0, continueBtn);
    this.mainMenuContainer.add(items);
  }
  
  findMultiplayerSaves() {
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('forger2_save_mp_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data) {
            // Any save with mp_ prefix is a multiplayer save
            saves.push({
              key: key,
              roomCode: data.roomCode || key.replace('forger2_save_mp_', ''),
              lastPlayed: data.lastPlayed || 0,
              playTime: data.playTime || 0
            });
          }
        } catch (e) {
          console.log('Error parsing save:', key, e);
        }
      }
    }
    // Sort by last played
    saves.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    console.log('Found multiplayer saves:', saves);
    return saves;
  }
  
  showSaveSelectPanel() {
    this.mainMenuContainer.setVisible(false);
    this.hostContainer.setVisible(false);
    this.joinContainer.setVisible(false);
    this.lobbyContainer.setVisible(false);
    
    // Create save select panel if not exists
    if (!this.saveSelectContainer) {
      this.createSaveSelectPanel();
    }
    this.saveSelectContainer.setVisible(true);
    this.updateSaveList();
  }
  
  createSaveSelectPanel() {
    const { width, height } = this.cameras.main;
    this.saveSelectContainer = this.add.container(width / 2, height / 2 - 50);
    
    const title = this.add.text(0, -100, 'Select Saved Game', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Save list container
    this.saveListContainer = this.add.container(0, 0);
    
    // Back button
    const backBtn = this.createButton(0, 200, 'Back', 0x6a4a4a, () => {
      this.saveSelectContainer.setVisible(false);
      this.showMainMenu();
    });
    
    this.saveSelectContainer.add([title, this.saveListContainer, backBtn]);
  }
  
  updateSaveList() {
    this.saveListContainer.removeAll(true);
    
    this.multiplayerSaves.forEach((save, index) => {
      const y = index * 60;
      
      // Format play time
      const hours = Math.floor((save.playTime || 0) / 3600000);
      const mins = Math.floor(((save.playTime || 0) % 3600000) / 60000);
      const timeStr = `${hours}h ${mins}m`;
      
      // Format last played
      const lastDate = save.lastPlayed ? new Date(save.lastPlayed).toLocaleDateString() : 'Unknown';
      
      const bg = this.add.rectangle(0, y, 280, 50, 0x3a4a5a)
        .setStrokeStyle(1, 0x5a6a7a)
        .setInteractive({ useHandCursor: true });
      
      const text = this.add.text(-130, y - 10, `Room: ${save.roomCode}`, {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#ffd700'
      });
      
      const subtext = this.add.text(-130, y + 10, `${timeStr} - ${lastDate}`, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#888888'
      });
      
      bg.on('pointerover', () => bg.setFillStyle(0x4a5a6a));
      bg.on('pointerout', () => bg.setFillStyle(0x3a4a5a));
      bg.on('pointerdown', () => {
        this.selectedSave = save;
        this.saveSelectContainer.setVisible(false);
        this.showHostPanel();
      });
      
      this.saveListContainer.add([bg, text, subtext]);
    });
  }

  createHostPanel() {
    const { width, height } = this.cameras.main;
    this.hostContainer = this.add.container(width / 2, height / 2 - 50);
    this.hostContainer.setVisible(false);
    
    // Title
    const title = this.add.text(0, -80, 'Hosting Game...', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Room code display
    this.roomCodeText = this.add.text(0, 0, 'Room Code: ------', {
      fontSize: '36px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffd700'
    }).setOrigin(0.5);
    
    // Copy button
    const copyBtn = this.add.text(0, 45, '📋 Click to Copy', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#88aaff',
      backgroundColor: '#2a3a5a',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    copyBtn.on('pointerover', () => copyBtn.setColor('#aaccff'));
    copyBtn.on('pointerout', () => copyBtn.setColor('#88aaff'));
    copyBtn.on('pointerdown', () => {
      const code = this.currentRoomCode || '';
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.setText('✓ Copied!');
          this.time.delayedCall(1500, () => copyBtn.setText('📋 Click to Copy'));
        });
      }
    });
    
    // Instructions
    const instructions = this.add.text(0, 80, 'Share this code with friends to join', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Player list
    this.hostPlayerList = this.add.text(0, 115, 'Players: 1/4', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#88ff88'
    }).setOrigin(0.5);
    
    // Start Game button
    this.startGameBtn = this.createButton(0, 180, 'Start Game', 0x4a8a4a, () => {
      this.startMultiplayerGame();
    });
    
    // Cancel button
    const cancelBtn = this.createButton(0, 250, 'Cancel', 0x6a4a4a, () => {
      this.cancelHost();
    });
    
    this.hostContainer.add([title, this.roomCodeText, copyBtn, instructions, this.hostPlayerList, this.startGameBtn, cancelBtn]);
  }

  createJoinPanel() {
    const { width, height } = this.cameras.main;
    this.joinContainer = this.add.container(width / 2, height / 2 - 50);
    this.joinContainer.setVisible(false);
    
    // Title
    const title = this.add.text(0, -80, 'Join Game', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Room code input label
    const label = this.add.text(0, -20, 'Enter Room Code:', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Room code input background
    const inputBg = this.add.rectangle(0, 30, 200, 50, 0x3a3a5a)
      .setStrokeStyle(2, 0x5a5a7a);
    
    // Room code input text
    this.roomCodeInput = '';
    this.roomCodeInputText = this.add.text(0, 30, '______', {
      fontSize: '32px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffffff',
      letterSpacing: 8
    }).setOrigin(0.5);
    
    // Paste button
    this.pasteBtn = this.add.text(0, 70, '📋 Paste Code', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#88aaff',
      backgroundColor: '#2a3a5a',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    this.pasteBtn.on('pointerover', () => this.pasteBtn.setColor('#aaccff'));
    this.pasteBtn.on('pointerout', () => this.pasteBtn.setColor('#88aaff'));
    this.pasteBtn.on('pointerdown', () => {
      navigator.clipboard.readText().then(text => {
        // Clean and validate pasted text
        const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (cleaned.length > 0) {
          this.roomCodeInput = cleaned;
          this.updateRoomCodeDisplay();
          this.pasteBtn.setText('✓ Pasted!');
          this.time.delayedCall(1500, () => this.pasteBtn.setText('📋 Paste Code'));
        }
      }).catch(() => {
        this.statusText.setText('Could not paste - check clipboard permissions');
      });
    });
    
    // Keyboard input
    this.input.keyboard.on('keydown', (event) => {
      if (!this.joinContainer.visible) return;
      
      // Handle Ctrl+V paste
      if (event.ctrlKey && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
          if (cleaned.length > 0) {
            this.roomCodeInput = cleaned;
            this.updateRoomCodeDisplay();
          }
        });
        return;
      }
      
      if (event.key === 'Backspace') {
        this.roomCodeInput = this.roomCodeInput.slice(0, -1);
      } else if (event.key.length === 1 && this.roomCodeInput.length < 6) {
        const char = event.key.toUpperCase();
        if (/[A-Z0-9]/.test(char)) {
          this.roomCodeInput += char;
        }
      }
      
      this.updateRoomCodeDisplay();
    });
    
    // Join button
    const joinBtn = this.createButton(0, 130, 'Join', 0x4a8a4a, () => {
      this.attemptJoin();
    });
    
    // Cancel button
    const cancelBtn = this.createButton(0, 200, 'Cancel', 0x6a4a4a, () => {
      this.showMainMenu();
    });
    
    this.joinContainer.add([title, label, inputBg, this.roomCodeInputText, this.pasteBtn, joinBtn, cancelBtn]);
  }

  createLobbyPanel() {
    const { width, height } = this.cameras.main;
    this.lobbyContainer = this.add.container(width / 2, height / 2 - 50);
    this.lobbyContainer.setVisible(false);
    
    // Title
    this.lobbyTitle = this.add.text(0, -100, 'Lobby', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Room code
    this.lobbyRoomCode = this.add.text(0, -60, 'Room: ------', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffd700'
    }).setOrigin(0.5);
    
    // Player list
    this.lobbyPlayerList = this.add.container(0, 20);
    
    // Waiting text
    this.waitingText = this.add.text(0, 150, 'Waiting for host to start...', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // Leave button
    const leaveBtn = this.createButton(0, 220, 'Leave', 0x6a4a4a, () => {
      this.leaveLobby();
    });
    
    this.lobbyContainer.add([this.lobbyTitle, this.lobbyRoomCode, this.lobbyPlayerList, this.waitingText, leaveBtn]);
  }

  createButton(x, y, text, color, callback) {
    const container = this.add.container(x, y);
    
    const bg = this.add.rectangle(0, 0, 200, 50, color)
      .setStrokeStyle(2, 0x000000)
      .setInteractive({ useHandCursor: true });
    
    const label = this.add.text(0, 0, text, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    bg.on('pointerover', () => bg.setFillStyle(color + 0x111111));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', callback);
    
    container.add([bg, label]);
    return container;
  }

  createBackButton() {
    const backBtn = this.add.container(80, 50);
    
    const bg = this.add.rectangle(0, 0, 100, 40, 0x3a3a5a)
      .setStrokeStyle(2, 0x5a5a7a)
      .setInteractive({ useHandCursor: true });
    
    const label = this.add.text(0, 0, '← Back', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    
    bg.on('pointerover', () => bg.setFillStyle(0x4a4a6a));
    bg.on('pointerout', () => bg.setFillStyle(0x3a3a5a));
    bg.on('pointerdown', () => {
      resetNetworkManager();
      this.scene.start('MainMenuScene');
    });
    
    backBtn.add([bg, label]);
  }

  showMainMenu() {
    this.mainMenuContainer.setVisible(true);
    this.hostContainer.setVisible(false);
    this.joinContainer.setVisible(false);
    this.lobbyContainer.setVisible(false);
    this.statusText.setText('');
  }

  showHostPanel() {
    this.mainMenuContainer.setVisible(false);
    this.hostContainer.setVisible(true);
    this.joinContainer.setVisible(false);
    this.lobbyContainer.setVisible(false);
    
    this.startHosting();
  }

  showJoinPanel() {
    this.mainMenuContainer.setVisible(false);
    this.hostContainer.setVisible(false);
    this.joinContainer.setVisible(true);
    this.lobbyContainer.setVisible(false);
    
    this.roomCodeInput = '';
    this.updateRoomCodeDisplay();
  }

  showLobby(isHost) {
    this.mainMenuContainer.setVisible(false);
    this.hostContainer.setVisible(false);
    this.joinContainer.setVisible(false);
    this.lobbyContainer.setVisible(true);
    
    const nm = getNetworkManager();
    this.lobbyRoomCode.setText(`Room: ${nm.getRoomCode()}`);
    this.lobbyTitle.setText(isHost ? 'Lobby (Host)' : 'Lobby');
    this.waitingText.setVisible(!isHost);
    
    this.updateLobbyPlayerList();
  }

  updateRoomCodeDisplay() {
    const display = this.roomCodeInput.padEnd(6, '_').split('').join(' ');
    this.roomCodeInputText.setText(display);
  }

  async startHosting() {
    this.statusText.setText('Creating room...');
    
    try {
      const nm = getNetworkManager();
      const roomCode = await nm.hostGame();
      
      this.currentRoomCode = roomCode; // Store for copy button
      this.roomCodeText.setText(`Room Code: ${roomCode}`);
      this.statusText.setText('');
      
      // Setup event handlers
      nm.on('playerJoined', (data) => {
        this.updateHostPlayerList();
      });
      
      nm.on('playerLeft', (data) => {
        this.updateHostPlayerList();
      });
      
      this.updateHostPlayerList();
      
    } catch (error) {
      console.error('Failed to host:', error);
      this.statusText.setText('Failed to create room: ' + error.message);
      this.showMainMenu();
    }
  }

  updateHostPlayerList() {
    const nm = getNetworkManager();
    const count = nm.getPlayerCount();
    this.hostPlayerList.setText(`Players: ${count}/4`);
  }

  async attemptJoin() {
    if (this.roomCodeInput.length !== 6) {
      this.statusText.setText('Please enter a 6-character room code');
      return;
    }
    
    this.statusText.setText('Connecting...');
    
    try {
      const nm = getNetworkManager();
      await nm.joinGame(this.roomCodeInput);
      
      this.statusText.setText('');
      
      // Setup event handlers
      nm.on('hostDisconnected', () => {
        this.statusText.setText('Host disconnected');
        this.showMainMenu();
      });
      
      nm.onMessage((type, data, peerId) => {
        if (type === MessageTypes.GAME_START) {
          // Check if this is a saved game continuation
          if (data && data.savedGame && data.roomCode) {
            this.selectedSave = {
              roomCode: data.roomCode,
              key: `forger2_save_mp_${data.roomCode}`
            };
          } else {
            this.selectedSave = null;
          }
          this.launchGame(false);
        }
        if (type === MessageTypes.PLAYER_JOIN || type === MessageTypes.PLAYER_LEAVE) {
          this.updateLobbyPlayerList();
        }
      });
      
      this.showLobby(false);
      
    } catch (error) {
      console.error('Failed to join:', error);
      this.statusText.setText('Failed to join: ' + error.message);
    }
  }

  updateLobbyPlayerList() {
    // Clear existing
    this.lobbyPlayerList.removeAll(true);
    
    const nm = getNetworkManager();
    const players = nm.getPlayers();
    
    players.forEach((player, index) => {
      const y = index * 30;
      const text = this.add.text(0, y, `P${player.playerNumber}${player.isLocal ? ' (You)' : ''}`, {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: player.isLocal ? '#88ff88' : '#ffffff'
      }).setOrigin(0.5);
      
      this.lobbyPlayerList.add(text);
    });
  }

  cancelHost() {
    resetNetworkManager();
    this.showMainMenu();
  }

  leaveLobby() {
    resetNetworkManager();
    this.showMainMenu();
  }

  startMultiplayerGame() {
    const nm = getNetworkManager();
    
    // Mark game as started so late joiners get notified
    nm.gameStarted = true;
    
    // Notify all clients
    nm.sendToAll(MessageTypes.GAME_START, {});
    
    // Launch game as host
    this.launchGame(true);
  }

  launchGame(isHost) {
    const nm = getNetworkManager();
    
    // Store network info in registry
    this.registry.set('isMultiplayer', true);
    this.registry.set('isHost', isHost);
    this.registry.set('networkManager', nm);
    this.registry.set('playerNumber', nm.getPlayerNumber());
    
    // Check if continuing from a saved game
    if (this.selectedSave) {
      // Load saved game (both host and client)
      this.registry.set('isNewGame', false);
      this.registry.set('currentSaveSlot', `mp_${this.selectedSave.roomCode}`);
      this.registry.set('saveKey', this.selectedSave.key);
      
      // Host sends save info to clients
      if (isHost) {
        nm.sendToAll(MessageTypes.GAME_START, {
          savedGame: true,
          roomCode: this.selectedSave.roomCode
        });
      }
    } else {
      // New game
      this.registry.set('isNewGame', true);
      this.registry.set('currentSaveSlot', `mp_${nm.getRoomCode()}`);
      this.registry.set('saveKey', `forger2_save_mp_${nm.getRoomCode()}`);
    }
    
    // Start the game
    this.scene.start('BootScene');
  }
}
