// Network Message Types for Multiplayer

export const MessageTypes = {
  // Connection
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  PLAYER_INFO: 'player_info',
  PLAYER_READY: 'player_ready',
  GAME_START: 'game_start',
  
  // Player State
  PLAYER_POSITION: 'player_position',
  PLAYER_INPUT: 'player_input',
  PLAYER_ACTION: 'player_action',
  PLAYER_ANIMATION: 'player_animation',
  PLAYER_HEALTH: 'player_health',
  PLAYER_DEATH: 'player_death',
  
  // World State
  WORLD_STATE_FULL: 'world_state_full',
  WORLD_STATE_DELTA: 'world_state_delta',
  WORLD_INIT: 'world_init',
  
  // Resources
  RESOURCE_HARVEST_START: 'resource_harvest_start',
  RESOURCE_HARVEST_COMPLETE: 'resource_harvest_complete',
  RESOURCE_RESPAWN: 'resource_respawn',
  RESOURCE_STATE: 'resource_state',
  
  // Buildings
  BUILDING_PLACE: 'building_place',
  BUILDING_PLACE_CONFIRM: 'building_place_confirm',
  BUILDING_INTERACT: 'building_interact',
  BUILDING_STATE: 'building_state',
  
  // Storage
  STORAGE_UPDATE: 'storage_update',
  STORAGE_DEPOSIT: 'storage_deposit',
  STORAGE_WITHDRAW: 'storage_withdraw',
  
  // Towers
  TOWER_PLACE: 'tower_place',
  TOWER_PLACE_CONFIRM: 'tower_place_confirm',
  TOWER_FIRE: 'tower_fire',
  TOWER_DAMAGE: 'tower_damage',
  TOWER_DESTROY: 'tower_destroy',
  TOWER_STATE: 'tower_state',
  
  // Combat
  ATTACK_START: 'attack_start',
  ATTACK_HIT: 'attack_hit',
  DAMAGE_DEALT: 'damage_dealt',
  ENEMY_SPAWN: 'enemy_spawn',
  ENEMY_DEATH: 'enemy_death',
  ENEMY_STATE: 'enemy_state',
  ENEMY_ATTACK: 'enemy_attack',
  
  // Projectiles
  PROJECTILE_CREATE: 'projectile_create',
  PROJECTILE_HIT: 'projectile_hit',
  PROJECTILE_STATE: 'projectile_state',
  
  // Land
  LAND_PURCHASE: 'land_purchase',
  LAND_PURCHASE_CONFIRM: 'land_purchase_confirm',
  
  // Inventory
  INVENTORY_UPDATE: 'inventory_update',
  INVENTORY_REQUEST: 'inventory_request',
  
  // Chat (future)
  CHAT_MESSAGE: 'chat_message',
  
  // Game State
  GAME_PAUSE: 'game_pause',
  GAME_RESUME: 'game_resume',
  GAME_SAVE: 'game_save',
  HOST_DISCONNECT: 'host_disconnect',
  
  // Ping/Latency
  PING: 'ping',
  PONG: 'pong',
  
  // Mine System
  MINE_ENTER: 'mine_enter',
  MINE_EXIT: 'mine_exit',
  MINE_STATE: 'mine_state',
  MINE_RESOURCE_HARVEST: 'mine_resource_harvest',
  MINE_ENEMY_SPAWN: 'mine_enemy_spawn',
  MINE_ENEMY_DEATH: 'mine_enemy_death',
  MINE_PLAYER_POSITION: 'mine_player_position',
  MINE_REFRESH: 'mine_refresh'
};

// Message priority levels for batching
export const MessagePriority = {
  HIGH: 0,    // Immediate send (attacks, deaths)
  MEDIUM: 1,  // Next tick (positions, states)
  LOW: 2      // Can be delayed (full syncs)
};

// Which messages are high frequency
export const HighFrequencyMessages = [
  MessageTypes.PLAYER_POSITION,
  MessageTypes.PLAYER_INPUT,
  MessageTypes.ENEMY_STATE
];

// Which messages require host validation
export const HostValidatedMessages = [
  MessageTypes.RESOURCE_HARVEST_COMPLETE,
  MessageTypes.BUILDING_PLACE,
  MessageTypes.TOWER_PLACE,
  MessageTypes.LAND_PURCHASE,
  MessageTypes.ATTACK_HIT
];
