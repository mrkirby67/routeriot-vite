# Route Riot – Codebase Overview

## 🧱 FILE MAP
- components: 11 feature sets — Broadcast, BugStrikeControl, FlatTireControl, GameControls, RacerManagement, Scoreboard, SpeedBumpControl, SurpriseSelector, TeamLinks, ZoneManagement, ZoneQuestions
- modules: 52 JS modules, 2 legacy *_FULL variants under modules/
- styling: 12 CSS files (including global style.css)
- html entrypoints: index.html, control.html, player.html
- assets folder present: no
- indexed files total: 107 (depth ≤3)

## ⚙️ FIRESTORE LINKS
- _: modules/teamSurpriseManager.js
- bugStrikeLog: modules/bugStrikeManager.js
- bugStrikes: modules/bugStrikeManager.js
- communications: components/Broadcast/Broadcast.js, components/BugStrikeControl/BugStrikeControl.js, components/GameControls/GameControls.js, components/ZoneManagement/zoneFirestore.js, components/ZoneManagement/zoneHandlers.js, modules/bugStrikeManager.js, modules/chatManager/controlFeed.js, modules/chatManager/messageService.js, modules/chatManager/playerChat.js, modules/controlActions.js, modules/controlStatus.js, modules/controlUI.js, modules/gameMaintenance.js, modules/gameRulesManager.js, modules/playerBugStrikeUI.js, modules/scoreboardManager.js, modules/speedBump/comms.js, modules/speedBumpManager_FULL.js, modules/zonesFirestore.js
- conversations: modules/chatManager/controlFeed.js, modules/chatManager/messageService.js, modules/controlStatus.js
- flatTireAssignments: modules/flatTireManager.js, modules/gameRulesManager.js
- game: components/Broadcast/Broadcast.js, components/GameControls/GameControls.js, components/Scoreboard/Scoreboard.js, components/SpeedBumpControl/controller/promptBank.js, components/SpeedBumpControl/speedBumpControlController_FULL.js, control.js, gameTestState.html, modules/chatManager/controlFeed.js, modules/chatManager/playerChat.js, modules/controlActions.js, modules/controlUI.js, modules/gameMaintenance.js, modules/gameRulesManager.js, modules/gameStateManager.js, modules/gameTimer.js, modules/zones.js, player.js
- questions: components/ZoneQuestions/ZoneQuestionsEditor.js, components/ZoneQuestions/ZoneQuestionsUI.js, modules/zonesChallenge.js
- racers: components/FlatTireControl/controller/firestoreSync.js, components/FlatTireControl/flatTireControlController_FULL.js, components/GameControls/GameControls.js, components/RacerManagement/RacerManagement.js, components/SpeedBumpControl/controller/stateSync.js, components/SpeedBumpControl/speedBumpControlController_FULL.js, modules/gameMaintenance.js, modules/gameRulesManager.js, modules/playerUI/core.js
- scores: components/GameControls/GameControls.js, components/Scoreboard/Scoreboard.js, modules/controlActions.js, modules/gameMaintenance.js, modules/gameRulesManager.js, modules/scoreboardManager.js, modules/zones.js, modules/zonesChallenge.js
- settings: components/BugStrikeControl/BugStrikeControl.js, components/GameControls/GameControls.js, modules/bugStrikeManager.js, modules/flatTireManager.js, modules/gameRulesManager.js
- speedBumpAssignments: modules/gameRulesManager.js
- surpriseAudit: modules/teamSurpriseManager.js
- teamStatus: components/GameControls/GameControls.js, components/Scoreboard/Scoreboard.js, components/ZoneManagement/ZoneManagement.js, components/ZoneManagement/zoneFirestore.js, gameTestState.html, modules/chatManager/playerChat.js, modules/controlActions.js, modules/controlStatus.js, modules/gameMaintenance.js, modules/gameStateManager.js, modules/playerUI/core.js, modules/zonesFirestore.js
- teamSurprises: modules/teamSurpriseManager.js
- zones: components/ZoneManagement/ZoneManagement.js, components/ZoneManagement/zoneFirestore.js, components/ZoneManagement/zoneHandlers.js, components/ZoneManagement/zoneRender.js, components/ZoneQuestions/ZoneQuestionsUI.js, modules/controlActions.js, modules/controlStatus.js, modules/gameMaintenance.js, modules/gameRulesManager.js, modules/homeMap.js, modules/scoreboardManager.js, modules/zoneManager.js, modules/zones.js, modules/zonesChallenge.js

## 🎛 UI COMPONENTS
- Broadcast: Broadcast.js
- BugStrikeControl: BugStrikeControl.js
- FlatTireControl: FlatTireControl.js, autoScheduler.js, domHandlers.js, firestoreSync.js, flatTireControlController.js, flatTireControlController_FULL.js
- GameControls: GameControls.js
- RacerManagement: RacerManagement.js
- Scoreboard: Scoreboard.js
- SpeedBumpControl: SpeedBumpControl.js, domHandlers.js, promptBank.js, speedBumpControlController.js, speedBumpControlController_FULL.js, stateSync.js, teamPrompts.js
- SurpriseSelector: SurpriseSelector.js
- TeamLinks: TeamLinks.js
- ZoneManagement: ZoneManagement.js, zoneFirestore.js, zoneHandlers.js, zoneRender.js, zoneUI.js
- ZoneQuestions: ZoneQuestions.js, ZoneQuestionsEditor.js, ZoneQuestionsLogic.js, ZoneQuestionsTypes.js, ZoneQuestionsUI.js

## 🧩 DEPENDENCIES
- tooling: vite@^5.3.1

## ⚠️ POTENTIAL ISSUES
- Duplicate filename 'core.js': modules/playerUI/core.js, modules/speedBump/core.js
- Duplicate filename 'domHandlers.js': components/FlatTireControl/controller/domHandlers.js, components/SpeedBumpControl/controller/domHandlers.js
- Duplicate filename 'utils.js': modules/chatManager/utils.js, modules/utils.js
- Legacy *_FULL variants present: 4 files
- modules/chatManager/messageService.js:62 — TODO: wire to team-specific Firestore chat doc
- modules/speedBumpManager_FULL.js:4 — NOTE: Uses broadcasts (communications collection) to sync state across clients.

## ✅ READY MODULES
- modules/gameStateManager.js: present, no TODO markers detected
- modules/gameTimer.js: present, no TODO markers detected
- components/ZoneManagement/zoneUI.js: present, no TODO markers detected
- modules/chatManager/registry.js: present, no TODO markers detected
- modules/speedBump/index.js: present, no TODO markers detected
