import Peer from 'peerjs';
import { MessageTypes, HighFrequencyMessages } from './MessageTypes.js';

/**
 * NetworkManager - Handles all PeerJS multiplayer communication
 * 
 * Host-Client Architecture:
 * - Host creates a room and gets a room code
 * - Clients join using the room code
 * - Host is authoritative for game state
 */
export class NetworkManager {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.isHost = false;
    this.hostConnection = null; // Client's connection to host
    this.roomCode = null;
    this.localPlayerId = null;
    this.playerNumber = 0; // 1-4
    this.connectedPlayers = new Map(); // peerId -> { playerNumber, ready }
    
    // Event callbacks
    this.messageHandlers = [];
    this.eventHandlers = {
      playerJoined: [],
      playerLeft: [],
      connectionError: [],
      roomCreated: [],
      joinedRoom: [],
      connectionReady: [],
      hostDisconnected: []
    };
    
    // Message batching for performance
    this.messageQueue = [];
    this.lastSendTime = 0;
    this.sendInterval = 50; // ms between batched sends
    
    // Latency tracking
    this.latency = 0;
    this.pingInterval = null;
  }

  /**
   * Generate a random room code
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Host a new game
   * @returns {Promise<string>} Room code
   */
  async hostGame() {
    return new Promise((resolve, reject) => {
      this.roomCode = this.generateRoomCode();
      this.isHost = true;
      this.playerNumber = 1;
      
      // Create peer with room code as ID
      this.peer = new Peer(`forger2-${this.roomCode}`, {
        debug: 1 // Minimal logging
      });
      
      this.peer.on('open', (id) => {
        console.log('Host peer opened with ID:', id);
        this.localPlayerId = id;
        this.connectedPlayers.set(id, { playerNumber: 1, ready: true });
        this.emit('roomCreated', this.roomCode);
        resolve(this.roomCode);
      });
      
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });
      
      this.peer.on('error', (err) => {
        console.error('Host peer error:', err);
        this.emit('connectionError', err);
        reject(err);
      });
      
      this.peer.on('disconnected', () => {
        console.log('Host disconnected from signaling server');
      });
    });
  }

  /**
   * Join an existing game
   * @param {string} roomCode - The room code to join
   * @returns {Promise<void>}
   */
  async joinGame(roomCode) {
    return new Promise((resolve, reject) => {
      this.roomCode = roomCode.toUpperCase();
      this.isHost = false;
      
      // Create peer with random ID
      this.peer = new Peer(undefined, {
        debug: 1
      });
      
      this.peer.on('open', (id) => {
        console.log('Client peer opened with ID:', id);
        this.localPlayerId = id;
        
        // Connect to host
        const hostId = `forger2-${this.roomCode}`;
        console.log('Connecting to host:', hostId);
        
        const conn = this.peer.connect(hostId, {
          reliable: true,
          serialization: 'json'
        });
        
        conn.on('open', () => {
          console.log('Connected to host!');
          this.hostConnection = conn;
          this.setupConnectionHandlers(conn, hostId);
          
          // Send join request
          this.sendToHost(MessageTypes.PLAYER_JOIN, {
            peerId: this.localPlayerId
          });
        });
        
        conn.on('error', (err) => {
          console.error('Connection to host failed:', err);
          this.emit('connectionError', err);
          reject(err);
        });
        
        // Timeout for connection
        setTimeout(() => {
          if (!this.hostConnection) {
            reject(new Error('Connection timeout - room may not exist'));
          }
        }, 10000);
      });
      
      this.peer.on('error', (err) => {
        console.error('Client peer error:', err);
        if (err.type === 'peer-unavailable') {
          reject(new Error('Room not found'));
        } else {
          this.emit('connectionError', err);
          reject(err);
        }
      });
      
      // Listen for messages from host
      this.onMessage((type, data, peerId) => {
        if (type === MessageTypes.PLAYER_INFO) {
          this.playerNumber = data.playerNumber;
          this.connectedPlayers = new Map(Object.entries(data.players));
          this.emit('joinedRoom', { roomCode: this.roomCode, playerNumber: this.playerNumber });
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming connection (host only)
   */
  handleIncomingConnection(conn) {
    console.log('Incoming connection from:', conn.peer);
    
    conn.on('open', () => {
      // Check if room is full
      if (this.connections.size >= 3) { // Max 4 players (host + 3)
        conn.send({ type: 'room_full' });
        conn.close();
        return;
      }
      
      this.setupConnectionHandlers(conn, conn.peer);
      this.connections.set(conn.peer, conn);
    });
  }

  /**
   * Setup handlers for a connection
   */
  setupConnectionHandlers(conn, peerId) {
    conn.on('data', (data) => {
      this.handleMessage(data, peerId);
    });
    
    conn.on('close', () => {
      console.log('Connection closed:', peerId);
      this.handleDisconnection(peerId);
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', peerId, err);
    });
  }

  /**
   * Handle incoming message
   */
  handleMessage(data, peerId) {
    const { type, payload } = data;
    
    // Special handling for join requests (host only)
    if (this.isHost && type === MessageTypes.PLAYER_JOIN) {
      this.handlePlayerJoin(peerId, payload);
      return;
    }
    
    // Special handling for pings
    if (type === MessageTypes.PING) {
      this.sendToPeer(peerId, MessageTypes.PONG, { timestamp: payload.timestamp });
      return;
    }
    
    if (type === MessageTypes.PONG) {
      this.latency = Date.now() - payload.timestamp;
      return;
    }
    
    // Notify all message handlers
    this.messageHandlers.forEach(handler => {
      handler(type, payload, peerId);
    });
  }

  /**
   * Handle player join request (host only)
   */
  handlePlayerJoin(peerId, payload) {
    // Assign player number
    const playerNumber = this.getNextPlayerNumber();
    
    this.connectedPlayers.set(peerId, {
      playerNumber,
      ready: false
    });
    
    // Send player info to new player
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.send({
        type: MessageTypes.PLAYER_INFO,
        payload: {
          playerNumber,
          players: Object.fromEntries(this.connectedPlayers)
        }
      });
    }
    
    // Notify all players about new player
    this.sendToAll(MessageTypes.PLAYER_JOIN, {
      peerId,
      playerNumber
    });
    
    this.emit('playerJoined', { peerId, playerNumber });
  }

  /**
   * Get next available player number
   */
  getNextPlayerNumber() {
    const usedNumbers = new Set();
    this.connectedPlayers.forEach(p => usedNumbers.add(p.playerNumber));
    
    for (let i = 1; i <= 4; i++) {
      if (!usedNumbers.has(i)) return i;
    }
    return 0; // Should never happen if we check room full
  }

  /**
   * Handle player disconnection
   */
  handleDisconnection(peerId) {
    const playerInfo = this.connectedPlayers.get(peerId);
    
    if (this.isHost) {
      // Host: Remove player and notify others
      this.connections.delete(peerId);
      this.connectedPlayers.delete(peerId);
      
      this.sendToAll(MessageTypes.PLAYER_LEAVE, {
        peerId,
        playerNumber: playerInfo?.playerNumber
      });
      
      this.emit('playerLeft', { peerId, playerNumber: playerInfo?.playerNumber });
    } else {
      // Client: Host disconnected
      if (peerId === `forger2-${this.roomCode}` || this.hostConnection?.peer === peerId) {
        console.log('Host disconnected!');
        this.emit('hostDisconnected');
      }
    }
  }

  /**
   * Send message to host (client only)
   */
  sendToHost(type, payload) {
    if (this.isHost) {
      // Host sending to self - just handle locally
      this.handleMessage({ type, payload }, this.localPlayerId);
      return;
    }
    
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type, payload });
    }
  }

  /**
   * Send message to all connected peers (host only)
   */
  sendToAll(type, payload) {
    if (!this.isHost) {
      console.warn('Only host can sendToAll');
      return;
    }
    
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send({ type, payload });
      }
    });
  }

  /**
   * Send message to specific peer
   */
  sendToPeer(peerId, type, payload) {
    if (this.isHost) {
      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        conn.send({ type, payload });
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      // Clients can only send to host
      this.hostConnection.send({ type, payload });
    }
  }

  /**
   * Broadcast message (host sends to all, client sends to host)
   */
  broadcast(type, payload) {
    if (this.isHost) {
      this.sendToAll(type, payload);
    } else {
      this.sendToHost(type, payload);
    }
  }

  /**
   * Register message handler
   */
  onMessage(callback) {
    this.messageHandlers.push(callback);
  }

  /**
   * Register event handler
   */
  on(event, callback) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(callback);
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => callback(data));
    }
  }

  /**
   * Start ping interval for latency measurement
   */
  startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.isHost) {
        this.connections.forEach((conn, peerId) => {
          if (conn.open) {
            conn.send({ type: MessageTypes.PING, payload: { timestamp: Date.now() } });
          }
        });
      } else if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: MessageTypes.PING, payload: { timestamp: Date.now() } });
      }
    }, 2000);
  }

  /**
   * Get current latency
   */
  getLatency() {
    return this.latency;
  }

  /**
   * Get player count
   */
  getPlayerCount() {
    return this.connectedPlayers.size;
  }

  /**
   * Get all connected player info
   */
  getPlayers() {
    return Array.from(this.connectedPlayers.entries()).map(([peerId, info]) => ({
      peerId,
      ...info,
      isLocal: peerId === this.localPlayerId
    }));
  }

  /**
   * Check if this is the host
   */
  getIsHost() {
    return this.isHost;
  }

  /**
   * Get local player number
   */
  getPlayerNumber() {
    return this.playerNumber;
  }

  /**
   * Get room code
   */
  getRoomCode() {
    return this.roomCode;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    if (this.isHost) {
      // Notify all clients
      this.sendToAll(MessageTypes.HOST_DISCONNECT, {});
      
      // Close all connections
      this.connections.forEach(conn => conn.close());
      this.connections.clear();
    } else if (this.hostConnection) {
      this.hostConnection.close();
    }
    
    if (this.peer) {
      this.peer.destroy();
    }
    
    this.peer = null;
    this.hostConnection = null;
    this.connections.clear();
    this.connectedPlayers.clear();
    this.messageHandlers = [];
    this.isHost = false;
    this.roomCode = null;
  }
}

// Singleton instance
let networkManagerInstance = null;

export function getNetworkManager() {
  if (!networkManagerInstance) {
    networkManagerInstance = new NetworkManager();
  }
  return networkManagerInstance;
}

export function resetNetworkManager() {
  if (networkManagerInstance) {
    networkManagerInstance.disconnect();
    networkManagerInstance = null;
  }
}
