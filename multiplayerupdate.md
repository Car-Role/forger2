# Forger2 Multiplayer Implementation Plan
## Using PeerJS (WebRTC P2P)

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [New Files to Create](#new-files-to-create)
4. [Files to Modify](#files-to-modify)
5. [Network Message Types](#network-message-types)
6. [State Synchronization Strategy](#state-synchronization-strategy)
7. [Implementation Phases](#implementation-phases)
8. [Technical Challenges](#technical-challenges)
9. [Testing Plan](#testing-plan)

---

## Overview

### What is PeerJS?
PeerJS is a wrapper around WebRTC that simplifies peer-to-peer connections. It uses a signaling server (free cloud option available) to help peers find each other, then establishes a direct connection.

### Multiplayer Model
- **Host-Client Architecture**: One player hosts, others join
- **Host is Authoritative**: Host runs game logic, validates actions
- **Clients are Predictive**: Clients predict locally, reconcile with host
- **Room Codes**: Simple 6-character codes for joining

### Player Limit
- Recommended: 2-4 players
- Technical limit: ~8 players (WebRTC mesh becomes unstable beyond this)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOST PLAYER                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  GameScene (runs full game logic)                         │  │
│  │  - Enemy AI                                               │  │
│  │  - Tower targeting                                        │  │
│  │  - Resource respawning                                    │  │
│  │  - Combat validation                                      │  │
│  │  - World state                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  NetworkManager                                           │  │
│  │  - Broadcasts state updates                               │  │
│  │  - Receives client inputs                                 │  │
│  │  - Validates client actions                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ WebRTC (PeerJS)
                          │
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT PLAYER                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  GameScene (renders, predicts locally)                    │  │
│  │  - Renders world from host state                          │  │
│  │  - Local movement prediction                              │  │
│  │  - Sends inputs to host                                   │  │
│  │  - Reconciles with host state                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  NetworkManager                                           │  │
│  │  - Receives state updates                                 │  │
│  │  - Sends player inputs                                    │  │
│  │  - Handles interpolation                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Files to Create

### 1. `src/network/NetworkManager.js`
**Purpose**: Core networking class that handles all PeerJS communication

**Responsibilities:**
- Initialize PeerJS connection
- Host game (create room)
- Join game (connect to host)
- Send/receive messages
- Handle disconnections
- Manage connected peers
- Message queuing and batching

**Key Methods:**
- `constructor(scene)` - Initialize with reference to game scene
- `hostGame()` - Create a new room, return room code
- `joinGame(roomCode)` - Connect to existing room
- `sendToHost(messageType, data)` - Client → Host
- `sendToAll(messageType, data)` - Host → All Clients
- `sendToPeer(peerId, messageType, data)` - Direct message
- `disconnect()` - Clean disconnect
- `onMessage(callback)` - Register message handler
- `isHost()` - Check if this instance is host
- `getConnectedPeers()` - List of connected peer IDs

**Events to Emit:**
- `playerJoined` - New player connected
- `playerLeft` - Player disconnected
- `connectionError` - Connection failed
- `roomCreated` - Room successfully created
- `joinedRoom` - Successfully joined room

**Estimated Lines:** ~300

---

### 2. `src/network/MessageTypes.js`
**Purpose**: Define all network message types as constants

```javascript
export const MessageTypes = {
  // Connection
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  PLAYER_INFO: 'player_info',
  
  // Player State
  PLAYER_POSITION: 'player_position',
  PLAYER_INPUT: 'player_input',
  PLAYER_ACTION: 'player_action',
  PLAYER_ANIMATION: 'player_animation',
  
  // World State
  WORLD_STATE_FULL: 'world_state_full',
  WORLD_STATE_DELTA: 'world_state_delta',
  
  // Resources
  RESOURCE_HARVEST_START: 'resource_harvest_start',
  RESOURCE_HARVEST_COMPLETE: 'resource_harvest_complete',
  RESOURCE_RESPAWN: 'resource_respawn',
  
  // Buildings
  BUILDING_PLACE: 'building_place',
  BUILDING_INTERACT: 'building_interact',
  
  // Towers
  TOWER_PLACE: 'tower_place',
  TOWER_FIRE: 'tower_fire',
  TOWER_DAMAGE: 'tower_damage',
  TOWER_DESTROY: 'tower_destroy',
  
  // Combat
  ATTACK_START: 'attack_start',
  DAMAGE_DEALT: 'damage_dealt',
  ENEMY_SPAWN: 'enemy_spawn',
  ENEMY_DEATH: 'enemy_death',
  ENEMY_STATE: 'enemy_state',
  
  // Land
  LAND_PURCHASE: 'land_purchase',
  
  // Inventory (for shared resources mode)
  INVENTORY_UPDATE: 'inventory_update',
  
  // Chat
  CHAT_MESSAGE: 'chat_message',
  
  // Game State
  GAME_PAUSE: 'game_pause',
  GAME_RESUME: 'game_resume',
  SAVE_GAME: 'save_game'
};
```

**Estimated Lines:** ~50

---

### 3. `src/network/StateSync.js`
**Purpose**: Handle state serialization and delta compression

**Responsibilities:**
- Serialize game state for network transmission
- Calculate state deltas (only send changes)
- Apply received state updates
- Handle state interpolation for smooth rendering
- Manage state history for reconciliation

**Key Methods:**
- `serializeFullState()` - Full world state snapshot
- `serializeDeltaState(lastState)` - Only changed values
- `applyFullState(state)` - Apply full state to game
- `applyDeltaState(delta)` - Apply delta to current state
- `interpolateState(prevState, nextState, t)` - Smooth interpolation

**Estimated Lines:** ~200

---

### 4. `src/network/PlayerSync.js`
**Purpose**: Handle remote player rendering and interpolation

**Responsibilities:**
- Create/destroy remote player sprites
- Interpolate remote player positions
- Sync remote player animations
- Handle remote player actions (mining, attacking)
- Display remote player names

**Key Methods:**
- `createRemotePlayer(peerId, data)` - Spawn remote player sprite
- `updateRemotePlayer(peerId, data)` - Update position/state
- `removeRemotePlayer(peerId)` - Remove disconnected player
- `interpolatePositions(delta)` - Smooth movement
- `getRemotePlayer(peerId)` - Get player by peer ID

**Estimated Lines:** ~150

---

### 5. `src/scenes/MultiplayerMenuScene.js`
**Purpose**: UI for hosting/joining multiplayer games

**UI Elements:**
- "Host Game" button
- Room code display (when hosting)
- Room code input field (when joining)
- "Join Game" button
- Connected players list
- "Start Game" button (host only)
- "Back" button
- Connection status indicator
- Error messages

**Estimated Lines:** ~200

---

### 6. `src/scenes/LobbyScene.js`
**Purpose**: Pre-game lobby for players to ready up

**Features:**
- Show all connected players
- Player ready status
- Host can kick players
- Host can start game
- Chat functionality
- Game settings (if any)

**Estimated Lines:** ~150

---

## Files to Modify

### 1. `src/main.js`

**Changes Required:**

```javascript
// ADD: Import new scenes
import { MultiplayerMenuScene } from './scenes/MultiplayerMenuScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';

// MODIFY: Add to scene list
scene: [MainMenuScene, MultiplayerMenuScene, LobbyScene, BootScene, GameScene, UIScene]
```

**Impact:** Low - Just adding new scenes

---

### 2. `src/scenes/MainMenuScene.js`

**Changes Required:**

```javascript
// ADD: Multiplayer button in create()
createMultiplayerButton() {
  // Add button below save slots
  // On click: this.scene.start('MultiplayerMenuScene')
}

// MODIFY: createSaveSlots() 
// - Move save slots up slightly to make room for multiplayer button
```

**Specific Changes:**
- Line ~40: Add `this.createMultiplayerButton();` after `createSaveSlots()`
- Add new method `createMultiplayerButton()` (~30 lines)
- Adjust Y positions of save slots if needed

**Impact:** Low - Adding one button

---

### 3. `src/scenes/BootScene.js`

**Changes Required:**

```javascript
// ADD: Check for multiplayer mode
create() {
  // ... existing code ...
  
  // NEW: Check if this is a multiplayer game
  const isMultiplayer = this.registry.get('isMultiplayer');
  const isHost = this.registry.get('isHost');
  
  if (isMultiplayer && !isHost) {
    // Client: Don't initialize new game, wait for host state
    this.initClientGame();
  } else {
    // Single player or Host: Normal initialization
    // ... existing logic ...
  }
}

// ADD: New method for client initialization
initClientGame() {
  // Minimal initialization - world state comes from host
  this.registry.set('inventory', {});
  this.registry.set('inventorySlots', new Array(32).fill(null));
  // ... other minimal setup ...
}
```

**Impact:** Medium - Conditional logic for multiplayer

---

### 4. `src/scenes/GameScene.js` (MAJOR CHANGES)

**This is the most heavily impacted file.**

#### 4.1 Constructor & Create

```javascript
// ADD: Network manager reference
constructor() {
  super({ key: 'GameScene' });
  this.networkManager = null;
  this.isMultiplayer = false;
  this.isHost = false;
  this.remotePlayers = new Map();
  this.localPlayerId = null;
}

create() {
  // ADD: Initialize multiplayer if needed
  this.isMultiplayer = this.registry.get('isMultiplayer') || false;
  this.isHost = this.registry.get('isHost') || false;
  
  if (this.isMultiplayer) {
    this.networkManager = this.registry.get('networkManager');
    this.setupNetworkHandlers();
    this.localPlayerId = this.networkManager.peerId;
  }
  
  // ... existing create code ...
  
  // ADD: Remote players group
  this.remotePlayerSprites = this.add.group();
}
```

#### 4.2 Update Loop

```javascript
update(time, delta) {
  // MODIFY: Only run certain logic if host or single player
  if (!this.isMultiplayer || this.isHost) {
    this.updateEnemies(delta);      // Host controls enemies
    this.updateTowers(delta);       // Host controls towers
    this.updateProjectiles(delta);  // Host controls projectiles
  }
  
  // Always run for local player
  this.handleMovement();
  this.handleMining(delta);
  this.handleInteraction();
  this.handleCombat(delta);
  this.handleEnergy(delta);
  this.updateDepths();
  this.checkNearbyBuilding();
  this.updatePlayerAnimation(delta);
  this.updateLandMarkerVisibility();
  this.updateBuildingPlacement();
  
  // ADD: Multiplayer-specific updates
  if (this.isMultiplayer) {
    this.sendPlayerState();           // Send our position to others
    this.updateRemotePlayers(delta);  // Interpolate remote players
    
    if (this.isHost) {
      this.broadcastWorldState();     // Send world state to clients
    }
  }
}
```

#### 4.3 Player Movement

```javascript
// MODIFY: handleMovement()
handleMovement() {
  // ... existing movement code ...
  
  // ADD: Send movement to network
  if (this.isMultiplayer) {
    // Movement is handled locally for responsiveness
    // Position is synced in sendPlayerState()
  }
}
```

#### 4.4 Resource Harvesting

```javascript
// MODIFY: startMining()
startMining(resource) {
  // ... existing code ...
  
  // ADD: Notify network
  if (this.isMultiplayer) {
    this.networkManager.sendToHost(MessageTypes.RESOURCE_HARVEST_START, {
      resourceId: resource.id,  // Need to add IDs to resources
      playerId: this.localPlayerId
    });
  }
}

// MODIFY: completeHarvest()
completeHarvest() {
  if (this.isMultiplayer && !this.isHost) {
    // Client: Request harvest from host
    this.networkManager.sendToHost(MessageTypes.RESOURCE_HARVEST_COMPLETE, {
      resourceId: this.miningTarget.id,
      playerId: this.localPlayerId
    });
    // Don't actually harvest - wait for host confirmation
    return;
  }
  
  // Host or single player: Normal harvest
  // ... existing harvest code ...
  
  // ADD: If host, broadcast to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.RESOURCE_HARVEST_COMPLETE, {
      resourceId: this.miningTarget.id,
      playerId: this.localPlayerId,
      resourceType: this.miningTarget.resourceType
    });
  }
}
```

#### 4.5 Combat

```javascript
// MODIFY: executeAttackHit()
executeAttackHit(attackAngle, attackRange, attackArc, damage, toolType, attackDir) {
  // ADD: Send attack to network
  if (this.isMultiplayer) {
    this.networkManager.sendToHost(MessageTypes.ATTACK_START, {
      playerId: this.localPlayerId,
      angle: attackAngle,
      range: attackRange,
      arc: attackArc,
      damage: damage,
      toolType: toolType,
      position: { x: this.player.x, y: this.player.y }
    });
    
    if (!this.isHost) {
      // Client: Show visual effect but don't deal damage
      this.showAttackEffect(attackAngle, attackRange, toolType, attackDir);
      return;
    }
  }
  
  // Host or single player: Normal attack logic
  // ... existing code ...
}

// MODIFY: damageEnemy()
damageEnemy(enemy, damage) {
  // Only host can damage enemies
  if (this.isMultiplayer && !this.isHost) return;
  
  // ... existing code ...
  
  // ADD: Broadcast damage to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.DAMAGE_DEALT, {
      enemyId: enemy.id,
      damage: damage,
      newHealth: enemy.health
    });
  }
}

// MODIFY: killEnemy()
killEnemy(enemy) {
  // ... existing code ...
  
  // ADD: Broadcast death to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.ENEMY_DEATH, {
      enemyId: enemy.id,
      drops: enemy.enemyData.drops,
      position: { x: enemy.x, y: enemy.y }
    });
  }
}
```

#### 4.6 Enemy AI

```javascript
// MODIFY: updateEnemies()
updateEnemies(delta) {
  // Only host runs enemy AI
  if (this.isMultiplayer && !this.isHost) {
    // Clients just interpolate enemy positions from host state
    return;
  }
  
  // ... existing enemy AI code ...
  
  // ADD: Broadcast enemy states periodically
  if (this.isMultiplayer && this.isHost) {
    this.enemyBroadcastTimer = (this.enemyBroadcastTimer || 0) + delta;
    if (this.enemyBroadcastTimer > 100) { // 10 times per second
      this.broadcastEnemyStates();
      this.enemyBroadcastTimer = 0;
    }
  }
}

// ADD: New method
broadcastEnemyStates() {
  const enemyStates = this.enemies.getChildren().map(enemy => ({
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    health: enemy.health,
    velocityX: enemy.body.velocity.x,
    velocityY: enemy.body.velocity.y
  }));
  
  this.networkManager.sendToAll(MessageTypes.ENEMY_STATE, { enemies: enemyStates });
}
```

#### 4.7 Towers

```javascript
// MODIFY: placeTower()
placeTower(towerType, x, y) {
  if (this.isMultiplayer && !this.isHost) {
    // Client: Request placement from host
    this.networkManager.sendToHost(MessageTypes.TOWER_PLACE, {
      towerType, x, y,
      playerId: this.localPlayerId
    });
    return;
  }
  
  // Host or single player: Normal placement
  // ... existing code ...
  
  // ADD: Broadcast to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.TOWER_PLACE, {
      towerType, x, y,
      towerId: tower.id
    });
  }
}

// MODIFY: updateTowers()
updateTowers(delta) {
  // Only host runs tower AI
  if (this.isMultiplayer && !this.isHost) return;
  
  // ... existing code ...
}

// MODIFY: towerFire()
towerFire(tower, target) {
  // ... existing code ...
  
  // ADD: Broadcast to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.TOWER_FIRE, {
      towerId: tower.id,
      targetId: target.id
    });
  }
}
```

#### 4.8 Buildings

```javascript
// MODIFY: placeBuilding()
placeBuilding(buildingData) {
  if (this.isMultiplayer && !this.isHost) {
    // Client: Request placement from host
    this.networkManager.sendToHost(MessageTypes.BUILDING_PLACE, {
      ...buildingData,
      playerId: this.localPlayerId
    });
    return;
  }
  
  // ... existing code ...
  
  // ADD: Broadcast to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.BUILDING_PLACE, {
      ...buildingData,
      buildingId: building.id
    });
  }
}
```

#### 4.9 Land Purchase

```javascript
// MODIFY: buyLand()
buyLand(data) {
  if (this.isMultiplayer && !this.isHost) {
    // Client: Request purchase from host
    this.networkManager.sendToHost(MessageTypes.LAND_PURCHASE, {
      ...data,
      playerId: this.localPlayerId
    });
    return;
  }
  
  // ... existing code ...
  
  // ADD: Broadcast to clients
  if (this.isMultiplayer && this.isHost) {
    this.networkManager.sendToAll(MessageTypes.LAND_PURCHASE, {
      gx: data.gx,
      gy: data.gy,
      landType: data.landType
    });
  }
}
```

#### 4.10 New Network Methods to Add

```javascript
// ADD: Setup network event handlers
setupNetworkHandlers() {
  this.networkManager.onMessage((type, data, peerId) => {
    switch (type) {
      case MessageTypes.PLAYER_POSITION:
        this.handleRemotePlayerPosition(data, peerId);
        break;
      case MessageTypes.WORLD_STATE_FULL:
        this.handleFullWorldState(data);
        break;
      case MessageTypes.ENEMY_STATE:
        this.handleEnemyState(data);
        break;
      // ... handle all message types ...
    }
  });
  
  this.networkManager.on('playerJoined', (peerId) => {
    this.createRemotePlayer(peerId);
  });
  
  this.networkManager.on('playerLeft', (peerId) => {
    this.removeRemotePlayer(peerId);
  });
}

// ADD: Send local player state
sendPlayerState() {
  if (!this.networkManager) return;
  
  const state = {
    x: this.player.x,
    y: this.player.y,
    velocityX: this.player.body.velocity.x,
    velocityY: this.player.body.velocity.y,
    animation: this.currentPlayerTexture,
    flipX: this.player.flipX,
    isMining: this.isMining,
    health: this.registry.get('health')
  };
  
  if (this.isHost) {
    this.networkManager.sendToAll(MessageTypes.PLAYER_POSITION, state);
  } else {
    this.networkManager.sendToHost(MessageTypes.PLAYER_POSITION, state);
  }
}

// ADD: Create remote player sprite
createRemotePlayer(peerId) {
  const remotePlayer = this.physics.add.sprite(
    this.worldWidth / 2,
    this.worldHeight / 2,
    'player'
  );
  remotePlayer.setDepth(1000);
  remotePlayer.setTint(0x88ff88); // Tint to distinguish
  
  // Add name label
  remotePlayer.nameLabel = this.add.text(0, -30, `Player ${peerId.slice(0, 4)}`, {
    fontSize: '10px',
    fontFamily: 'Arial',
    backgroundColor: '#000000aa'
  }).setOrigin(0.5);
  
  this.remotePlayers.set(peerId, remotePlayer);
  this.remotePlayerSprites.add(remotePlayer);
}

// ADD: Update remote player from network data
handleRemotePlayerPosition(data, peerId) {
  const remotePlayer = this.remotePlayers.get(peerId);
  if (!remotePlayer) return;
  
  // Store target position for interpolation
  remotePlayer.targetX = data.x;
  remotePlayer.targetY = data.y;
  remotePlayer.setFlipX(data.flipX);
  
  // Update animation
  if (data.animation && this.textures.exists(data.animation)) {
    remotePlayer.setTexture(data.animation);
  }
}

// ADD: Interpolate remote players
updateRemotePlayers(delta) {
  this.remotePlayers.forEach((remotePlayer, peerId) => {
    if (remotePlayer.targetX !== undefined) {
      // Smooth interpolation
      const lerpFactor = 0.2;
      remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, remotePlayer.targetX, lerpFactor);
      remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, remotePlayer.targetY, lerpFactor);
      
      // Update name label position
      if (remotePlayer.nameLabel) {
        remotePlayer.nameLabel.setPosition(remotePlayer.x, remotePlayer.y - 30);
      }
      
      // Update depth
      remotePlayer.setDepth(remotePlayer.y);
    }
  });
}

// ADD: Remove disconnected player
removeRemotePlayer(peerId) {
  const remotePlayer = this.remotePlayers.get(peerId);
  if (remotePlayer) {
    if (remotePlayer.nameLabel) remotePlayer.nameLabel.destroy();
    remotePlayer.destroy();
    this.remotePlayers.delete(peerId);
  }
}

// ADD: Host broadcasts full world state
broadcastWorldState() {
  this.worldStateBroadcastTimer = (this.worldStateBroadcastTimer || 0) + 1;
  if (this.worldStateBroadcastTimer < 60) return; // Once per second
  this.worldStateBroadcastTimer = 0;
  
  const state = {
    resources: this.serializeResources(),
    buildings: this.serializeBuildings(),
    towers: this.serializeTowers(),
    enemies: this.serializeEnemies(),
    unlockedLands: this.unlockedLands
  };
  
  this.networkManager.sendToAll(MessageTypes.WORLD_STATE_FULL, state);
}

// ADD: Client applies world state from host
handleFullWorldState(state) {
  if (this.isHost) return; // Host doesn't receive this
  
  // Apply world state
  this.applyResourceState(state.resources);
  this.applyBuildingState(state.buildings);
  this.applyTowerState(state.towers);
  this.applyEnemyState(state.enemies);
  this.unlockedLands = state.unlockedLands;
}
```

#### 4.11 Entity ID System

```javascript
// ADD: ID generation for network sync
this.nextEntityId = 0;

generateEntityId() {
  return `${this.localPlayerId}_${this.nextEntityId++}`;
}

// MODIFY: All entity creation to include IDs
createResource(x, y, type) {
  // ... existing code ...
  resource.id = this.generateEntityId(); // ADD THIS
}

createEnemy(x, y, type) {
  // ... existing code ...
  enemy.id = this.generateEntityId(); // ADD THIS
}

placeTower(towerType, x, y) {
  // ... existing code ...
  tower.id = this.generateEntityId(); // ADD THIS
}

placeBuilding(buildingData) {
  // ... existing code ...
  building.id = this.generateEntityId(); // ADD THIS
}
```

**Impact:** HIGH - This file needs the most changes

---

### 5. `src/scenes/UIScene.js`

**Changes Required:**

```javascript
// ADD: Multiplayer UI elements
create() {
  // ... existing code ...
  
  // ADD: Player list panel (for multiplayer)
  if (this.registry.get('isMultiplayer')) {
    this.createPlayerListPanel();
  }
}

// ADD: Show connected players
createPlayerListPanel() {
  this.playerListPanel = this.add.container(1100, 10);
  // Show list of connected players
  // Update when players join/leave
}

// MODIFY: Inventory updates in multiplayer
// - May need to sync with host for shared inventory mode
// - Or keep separate inventories per player
```

**Impact:** Medium - Adding multiplayer UI elements

---

### 6. `src/data/GameData.js`

**Changes Required:**

```javascript
// ADD: Multiplayer configuration
export const MULTIPLAYER_CONFIG = {
  maxPlayers: 4,
  tickRate: 20,              // Network updates per second
  interpolationDelay: 100,   // ms delay for smooth interpolation
  positionSyncRate: 50,      // ms between position updates
  stateSyncRate: 1000,       // ms between full state syncs
  roomCodeLength: 6,
  connectionTimeout: 10000,  // ms before connection timeout
};

// ADD: Player colors for multiplayer
export const PLAYER_COLORS = [
  0xffffff, // Host - white
  0x88ff88, // Player 2 - green
  0x8888ff, // Player 3 - blue
  0xff8888, // Player 4 - red
];
```

**Impact:** Low - Adding configuration

---

### 7. `package.json`

**Changes Required:**

```json
{
  "dependencies": {
    "peerjs": "^1.5.2"
  }
}
```

**Impact:** Low - Adding one dependency

---

## Network Message Types

### High Frequency (Every Frame / 50ms)
| Message | Direction | Data Size | Purpose |
|---------|-----------|-----------|----------|
| PLAYER_POSITION | Both | ~50 bytes | Player position, velocity, animation |
| PLAYER_INPUT | Client→Host | ~20 bytes | Raw input state |

### Medium Frequency (100-500ms)
| Message | Direction | Data Size | Purpose |
|---------|-----------|-----------|----------|
| ENEMY_STATE | Host→Client | ~100 bytes/enemy | Enemy positions and health |
| TOWER_FIRE | Host→Client | ~30 bytes | Tower attack events |
| PROJECTILE_STATE | Host→Client | ~20 bytes/projectile | Projectile positions |

### Low Frequency (On Event)
| Message | Direction | Data Size | Purpose |
|---------|-----------|-----------|----------|
| RESOURCE_HARVEST | Both | ~40 bytes | Resource gathered |
| BUILDING_PLACE | Both | ~50 bytes | Building placed |
| TOWER_PLACE | Both | ~50 bytes | Tower placed |
| LAND_PURCHASE | Both | ~40 bytes | Land unlocked |
| ENEMY_DEATH | Host→Client | ~30 bytes | Enemy killed |
| DAMAGE_DEALT | Host→Client | ~30 bytes | Damage event |
| WORLD_STATE_FULL | Host→Client | ~2-10 KB | Full world sync |

---

## State Synchronization Strategy

### What the Host Controls (Authoritative)
1. **Enemy AI** - All enemy movement, targeting, attacks
2. **Tower AI** - All tower targeting and firing
3. **Projectiles** - All projectile movement and hit detection
4. **Resource Respawning** - When and where resources respawn
5. **Combat Damage** - Final damage calculations
6. **World State** - Definitive state of all entities

### What Clients Control (Predictive)
1. **Local Movement** - Immediate response, reconciled with host
2. **Local Animation** - Immediate visual feedback
3. **UI Interactions** - Menus, inventory (local only)
4. **Camera** - Follows local player

### What is Shared
1. **Unlocked Lands** - Synced from host
2. **Buildings** - Synced from host
3. **Towers** - Synced from host
4. **Resources** - Synced from host

### Inventory Mode Options
1. **Shared Inventory** - All players share one inventory (co-op focused)
2. **Separate Inventories** - Each player has own inventory (competitive)
3. **Hybrid** - Shared storage chest, personal hotbar

---

## Implementation Phases

### Phase 1: Foundation (Estimated: 4-6 hours)
1. Install PeerJS dependency
2. Create NetworkManager.js
3. Create MessageTypes.js
4. Create MultiplayerMenuScene.js
5. Add multiplayer button to main menu
6. Test basic connection between two browsers

### Phase 2: Player Sync (Estimated: 3-4 hours)
1. Create PlayerSync.js
2. Modify GameScene for remote players
3. Implement position interpolation
4. Sync player animations
5. Test two players seeing each other

### Phase 3: World State (Estimated: 4-5 hours)
1. Create StateSync.js
2. Add entity ID system
3. Implement full state broadcast
4. Implement delta state updates
5. Sync resources, buildings, towers
6. Test world consistency

### Phase 4: Actions (Estimated: 4-5 hours)
1. Sync resource harvesting
2. Sync building placement
3. Sync tower placement
4. Sync land purchases
5. Test all actions work for both players

### Phase 5: Combat (Estimated: 3-4 hours)
1. Sync player attacks
2. Sync enemy AI (host-controlled)
3. Sync damage events
4. Sync enemy deaths and respawns
5. Test combat works correctly

### Phase 6: Polish (Estimated: 2-3 hours)
1. Add player names/labels
2. Add connection status UI
3. Handle disconnections gracefully
4. Add reconnection logic
5. Performance optimization
6. Testing and bug fixes

**Total Estimated Time: 20-27 hours**

---

## Technical Challenges

### 1. Latency Compensation
**Problem:** Players on slow connections see delayed actions
**Solution:** 
- Client-side prediction for movement
- Interpolation for remote players
- Server reconciliation for important actions

### 2. State Divergence
**Problem:** Client and host state can drift apart
**Solution:**
- Periodic full state sync (every 1-2 seconds)
- Delta compression for efficiency
- Client reconciliation on mismatch

### 3. NAT Traversal
**Problem:** Some networks block P2P connections
**Solution:**
- PeerJS handles most cases automatically
- Can add TURN server for fallback (costs money)
- Display connection error with troubleshooting tips

### 4. Host Disconnection
**Problem:** If host leaves, game ends
**Solution Options:**
- Host migration (complex)
- Save game state, allow reconnection
- Simply end game with warning

### 5. Cheating Prevention
**Problem:** Clients could send fake data
**Solution:**
- Host validates all actions
- Reject impossible actions (e.g., harvesting from too far)
- Rate limiting on actions

### 6. Bandwidth Optimization
**Problem:** Too much data causes lag
**Solution:**
- Delta compression (only send changes)
- Message batching
- Prioritize important updates
- Reduce update frequency for distant entities

---

## Testing Plan

### Local Testing
1. Open game in two browser tabs
2. Host in one, join in other
3. Test all features

### Network Testing
1. Test on same WiFi network
2. Test across different networks (use phone hotspot)
3. Test with simulated latency (Chrome DevTools)

### Test Cases
- [ ] Host can create room and get code
- [ ] Client can join with room code
- [ ] Both players see each other
- [ ] Movement is smooth for both
- [ ] Resource harvesting works for both
- [ ] Buildings can be placed by both
- [ ] Towers can be placed by both
- [ ] Combat works correctly
- [ ] Enemies attack both players
- [ ] Land purchase works
- [ ] Disconnection is handled gracefully
- [ ] Reconnection works (if implemented)

---

## File Summary

### New Files (6)
| File | Lines (Est.) | Priority |
|------|--------------|----------|
| `src/network/NetworkManager.js` | ~300 | Critical |
| `src/network/MessageTypes.js` | ~50 | Critical |
| `src/network/StateSync.js` | ~200 | High |
| `src/network/PlayerSync.js` | ~150 | High |
| `src/scenes/MultiplayerMenuScene.js` | ~200 | Critical |
| `src/scenes/LobbyScene.js` | ~150 | Medium |

### Modified Files (7)
| File | Changes | Impact |
|------|---------|--------|
| `src/main.js` | Add scenes, import | Low |
| `src/scenes/MainMenuScene.js` | Add MP button | Low |
| `src/scenes/BootScene.js` | MP initialization | Medium |
| `src/scenes/GameScene.js` | Major networking | **HIGH** |
| `src/scenes/UIScene.js` | Player list UI | Medium |
| `src/data/GameData.js` | MP config | Low |
| `package.json` | Add peerjs | Low |

---

## Next Steps

Once you approve this plan, implementation will proceed in this order:

1. **Install PeerJS** - Add to package.json
2. **Create NetworkManager** - Core networking class
3. **Create MultiplayerMenuScene** - Host/Join UI
4. **Modify MainMenuScene** - Add multiplayer button
5. **Begin GameScene modifications** - Start with player sync

---

## Questions to Decide Before Implementation

1. **Inventory Mode**: Shared inventory or separate per player?
2. **Save System**: Save multiplayer progress? Host only?
3. **Player Names**: Allow custom names or auto-generate?
4. **Max Players**: 2, 4, or configurable?
5. **Host Migration**: Implement or just end game if host leaves?
