# Route Riot System Overview

Last updated: 2025-11-02  
Scope: high-level map of core domains, primary modules, and shared dependencies. Use this as the canonical reference when refactoring or auditing ownership.

---

## 1. Chat & Messaging

**Purpose**: Deliver team-to-team chat, control broadcasts, and automated “card” messages via Firestore `conversations`.

| Layer | Key Modules | Notes |
|-------|-------------|-------|
| Service | `services/messageService.js` | Normalises Firestore writes/listens; exposes both legacy (`sender/recipient`) and modern (`fromTeam/toTeam`) fields. |
| Bridge | `modules/chatManager/messageService.js`, `modules/messageListener.js` | Wraps service for legacy callers; rebuilds `window.chatManager` with `sendTeamMessage`, `sendPrivateSystemMessage`, etc. |
| Player Feature | `features/chat/playerChat.state.js`, `features/chat/playerChat.events.js`, `components/ChatLog/ChatLog.js` | Buffers filtered messages and renders UI; triggers sends via service. |
| Control | `components/Broadcast/Broadcast.js`, `modules/chatManager.js` | Renders broadcast panel, subscribes to a broadcast-only feed, keeps legacy control feed alive. |
| Legacy Consumers | `modules/speedBump/interactions.js`, `modules/flatTireUI.js`, `features/team-surprise/teamSurpriseController.js` | Still call `window.chatManager.*`; rely on bridge for schema translation. |

**Shared Data**: Firestore collection `conversations` (documents carry `text/message`, `fromTeam/sender`, `toTeam/recipient`, `kind`, `createdAt`, `timestampMs`).

**Pain Points**:
- Mixed schema until all consumers migrate off `sender/recipient`.
- Broadcast filtering logic duplicated in control + player features.
- `window.chatManager` global remains a coupling hotspot.

---

## 2. Team Surprises / Wild Cards

**Purpose**: Manage inventory (flat tire, bug splat, speed bump, super shield) and cooldowns for each team.

| Layer | Key Modules | Notes |
|-------|-------------|-------|
| Services | `services/team-surprise/teamSurpriseService.js` | CRUD utilities for surprise counts. |
| Feature | `features/team-surprise/teamSurpriseController.js`, `teamSurpriseEvents.js`, `teamSurpriseTypes.js` | High-level orchestration for control dashboard actions. |
| Components | `components/SurpriseSelector/SurpriseSelector.js`, `components/TeamSurpriseManager/TeamSurpriseManager.js` | Control UI to adjust counts and monitor cooldowns. |
| Player UI | `modules/chatManager/playerChat.ui.js`, `modules/teamSurpriseManager.js` | Shows inventory on player dashboard; refreshes shield status. |
| Dependencies | Chat bridge for notifying teams (`window.chatManager.sendPrivateSystemMessage`); Firestore collections `teamSurprises`, `teamSurpriseCooldowns`. |

**Pain Points**:
- Surprises UI depends on chat bridge; breaking `window.chatManager` severs notifications.
- Cooldown state duplicated between local storage and Firestore listeners.

---

## 3. Flat Tire System

**Purpose**: Assign flat tire events to teams, deliver overlays, and let teams chirp/clear the penalty.

| Layer | Key Modules | Notes |
|-------|-------------|-------|
| Services | `services/flat-tire/flatTireService.js` | Firestore helpers for assignments, depots, auto releases. |
| Control Components | `components/FlatTireControl/*` | Control dashboard for scheduling and monitoring flat tires. |
| Feature | `features/flat-tire/flatTireController.js`, `flatTireEvents.js` | Business logic triggered from control UI. |
| Player UI | `modules/flatTireUI.js`, `modules/playerUI/overlays/flatTireOverlay.js` | Player overlay with chirp button and manual release logic. |
| Shared | `modules/chirpCooldown.js`, `data/chirpMessages.js` | Rate limits chirp messages; provides canned taunts. |
| Dependencies | Chat bridge to notify teams and control; uses `teamSurprises` for inventory checks. |

**Pain Points**:
- Overlay/feature share chirp cooldown logic; ensure both import the same module.
- Auto scheduler interacts with control cleanup scripts (watch for double-reset). 

---

## 4. Speed Bump System

**Purpose**: Allow teams to deploy speed bumps, track active assignments, and manage reversals.

| Layer | Key Modules | Notes |
|-------|-------------|-------|
| Services | `services/speed-bump/speedBumpService.js` | Firestore queries for active bumps, history, inventory. |
| Control Components | `components/SpeedBumpControl/*` | Trigger bumps, configure prompts, view status. |
| Feature | `modules/speedBump/index.js`, `modules/speedBump/interactions.js`, `modules/speedBump/reversals.js` | Business rules; uses chat bridge to message teams. |
| Player UI | `modules/playerUI/overlays/speedBumpOverlay.js`, `modules/speedBumpPlayer.js` | Player overlay shows active bumps and countdown. |
| Dependencies | Shares surprise inventory; uses `window.chatManager` for notifications; listens to `teamSurprises` and `speedBumpAssignments`. |

**Pain Points**:
- Multiple modules send chat notifications; keep message payloads consistent.
- Overlay relies on `createdAt` fields; schema drift can break timers. 

---

## 5. Game State & Control Dashboard

**Purpose**: Orchestrate the game lifecycle, manage teams/zones, and provide the control UI.

| Layer | Key Modules | Notes |
|-------|-------------|-------|
| Services | `services/gameStateService.js`, `services/gameRulesManager.js`, `services/firestoreRefs.js` | Global state documents, rules configs, helper refs. |
| Control Core | `control.js`, `modules/controlUI.js`, `modules/controlStatus.js`, `modules/gameMaintenance.js` | Compose the main control page; wire all components. |
| Components | `components/GameControls/GameControls.js`, `components/Scoreboard/Scoreboard.js`, `components/RacerManagement/RacerManagement.js`, `components/ZoneManagement/*`, `components/TeamLinks/TeamLinks.js`, etc. | Modular panels rendered inside control dashboard. |
| Event Flow | Most components import services + modules from corresponding domain (flat tire, surprises, speed bump). Game state updates broadcast via `modules/gameStateManager.js`. |
| Dependencies | `modules/chatManager.js` for integrating chat panels; `docs/aicp_*` auto reports reference these modules. |

**Pain Points**:
- Auto-clean routines in `control.js` can conflict with manual data seeding.
- Multiple modules import Firestore via raw URLs; central config lives in `modules/config.js`.

---

## 6. Player Dashboard

**Purpose**: Present team-specific live data (chat, scores, surprises, zones, timers).

| Layer | Key Modules | Notes |
|-------|-------------|-------|
| Entry | `player.js`, `features/player-page/playerPageController.js` | Bootstraps player page; fetches team from URL/localStorage. |
| UI Modules | `modules/playerUI.js`, `modules/playerUI/core.js`, `modules/playerUI/overlays/*` | Render timers, overlays, notifications. |
| Features | Chat (see §1), speed bump player module, flat tire UI, team surprises panel. |
| Services | Reuse domain services via modules, or rely on control-side watchers (e.g., scoreboard). |
| Dependencies | Most player-side listeners share Firestore refs with control; keep schema alignment in sync during refactors. |

**Pain Points**:
- Chat filtering sensitive to schema; ensure normalization stays aligned.
- Multiple modules manage countdown timers—sync with control logic to avoid drift.

---

## 7. Shared Infrastructure & Utilities

| Area | Modules | Notes |
|------|---------|-------|
| Config | `modules/config.js` | Central Firestore initialisation; imported by services. |
| Registry | `modules/chatManager/registry.js` | Manages listener cleanup; used across chat-related modules. |
| Utils | `modules/chatManager/utils.js`, `modules/utils.js` | HTML escaping, sender name resolution, general helpers. |
| Auto Docs/Reports | `docs/aicp_*` | Generated reports (integrity, validation, file health). Many reference the modules listed above; useful for surfacing stale metadata. |

---

## Active Hotspots / Follow-Up Targets

- **Chat Bridge Migration**: Replace `window.chatManager` dependencies with direct service imports once legacy modules are updated.
- **Schema Drift Watchlist**: Ensure `conversations` documents always carry both old/new fields until consumers are upgraded.
- **Surprise Inventory Coupling**: Flat tire & speed bump logic both mutate surprise counts—plan a single authority to avoid race conditions.
- **Control Auto-Clean**: Revisit control initialisation routines so they don’t wipe data when an active game is running.

---

### How to Use This Document

1. **Refactor Planning**: Start here to see all touchpoints before modifying a domain.  
2. **Overlap Detection**: Look for repeated services or shared collections to catch unintended coupling.  
3. **Documentation Sync**: When updating a domain, adjust this overview first, then regenerate any detailed summaries as needed.
