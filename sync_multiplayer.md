# Multiplayer Sync Checklist

## Current Status - ALL MAJOR SYSTEMS SYNCED ✅

The following items are synchronized between host and clients.

## World State (Host → Clients)

### 1. Resources/Terrain ✅ SYNCED
- [x] Resource positions (trees, rocks, ores, bushes) - Using seeded random based on room code
- [x] Resource respawning after harvest - Host broadcasts respawns
- [x] Resource harvesting - Broadcast when resource is destroyed
- **Fix**: World seed derived from room code ensures identical world generation

### 2. Buildings ✅ SYNCED  
- [x] Building placement (workbench, forge, storage chest)
- [x] Building positions
- [x] Storage chest contents (shared storage)
- **Fix**: `placeBuilding()` now broadcasts to network
- **Fix**: Storage deposits/withdrawals broadcast to all players

### 3. Towers ✅ SYNCED
- [x] Tower placement
- [x] Tower damage
- [x] Tower destruction
- [x] Tower firing (projectiles)

### 4. Enemies ✅ SYNCED
- [x] Enemy spawning
- [x] Enemy positions (host broadcasts)
- [x] Enemy health
- [x] Enemy death

### 5. Land Tiles ✅ SYNCED
- [x] Land purchase/unlock
- [x] New land generation

## Player State (Each Player → All)

### 6. Player Position ✅ SYNCED
- [x] Position updates
- [x] Animation/texture
- [x] Facing direction

### 7. Player Combat ✅ SYNCED
- [x] Attack animations
- [x] Damage dealt to enemies

### 8. Player Inventory ❌ NOT SYNCED (by design - separate inventories)
- Inventories are intentionally separate per player

## Actions That Need Sync

### 9. Resource Harvesting ✅ SYNCED
- [x] Mining complete (remove resource for all)
- [x] Resource respawn (host broadcasts new resources)
- [x] Resource drops (only harvester gets items - correct behavior)

### 10. Building Interaction ❌ NOT SYNCED (future)
- [ ] Opening workbench/forge/storage
- [ ] Crafting items
- [ ] Smelting items

---

## Completed Fixes

### World Seed Sync ✅
- Room code is hashed to create a consistent world seed
- `getSeededRandomForPosition()` generates deterministic random values
- All clients generate identical resource positions

### Building Sync ✅
- `placeBuilding()` broadcasts to all clients
- Buildings have unique IDs for network tracking

### Resource Sync ✅
- Resources have unique IDs
- Harvest completion broadcasts resource destruction
- Host broadcasts resource respawns to clients

---

## Future Work
1. Show other players' mining progress bars
2. Sync crafting/smelting state

---

## Save System ✅

### Host Save Features
- Saves world state (lands, buildings, towers)
- Saves all player data (inventory, tools, upgrades, XP, level)
- Saves player positions
- Uses room code as save identifier

### Continue Game Features
- Host can select from saved multiplayer games
- Clients load their saved player data when rejoining
- World state is restored from host's save

### Save Key Format
- `forger2_save_mp_[ROOMCODE]` for multiplayer saves
