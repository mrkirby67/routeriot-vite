# AICP Import Verification Report — 2025-10-30 23:31:58
- Files scanned: 118
- Invalid imports: 157
- Circular dependencies: 3
- Legacy references: 14
- Summary: ⚠️ Issues Found

## Invalid Imports
| File | Import | Issue |
|------|--------|-------|
| components/Broadcast/Broadcast.js | ./Broadcast.module.css | Path contains uppercase characters |
| components/BugStrikeControl/BugStrikeControl.js | ../../modules/teamSurpriseManager.js | Path contains uppercase characters |
| components/BugStrikeControl/BugStrikeControl.js | ./BugStrikeControl.module.css | Path contains uppercase characters |
| components/FlatTireControl/FlatTireControl.js | ./FlatTireControl.module.css | Path contains uppercase characters |
| components/FlatTireControl/FlatTireControl.js | ./flatTireControlController.js | Path contains uppercase characters |
| components/FlatTireControl/controller/autoScheduler.js | ../../../modules/flatTireManager.js | Path contains uppercase characters |
| components/FlatTireControl/controller/domHandlers.js | ../FlatTireControl.module.css | Path contains uppercase characters |
| components/GameControls/GameControls.js | ../../modules/emailTeams.js | Path contains uppercase characters |
| components/GameControls/GameControls.js | ../../modules/gameMaintenance.js | Path contains uppercase characters |
| components/GameControls/GameControls.js | ../../modules/gameRulesManager.js | Path contains uppercase characters |
| components/GameControls/GameControls.js | ../../modules/gameStateManager.js | Path contains uppercase characters |
| components/GameControls/GameControls.js | ../../modules/gameTimer.js | Path contains uppercase characters |
| components/GameControls/GameControls.js | ./GameControls.module.css | Path contains uppercase characters |
| components/OpponentList/OpponentList.js | ../../services/teamService.js | Path contains uppercase characters |
| components/RacerManagement/RacerManagement.js | ./RacerManagement.module.css | Path contains uppercase characters |
| components/Scoreboard/Scoreboard.js | ../../modules/scoreboardManager.js | Path contains uppercase characters |
| components/Scoreboard/Scoreboard.js | ../../modules/zoneManager.js | Path contains uppercase characters |
| components/Scoreboard/Scoreboard.js | ./Scoreboard.module.css | Path contains uppercase characters |
| components/SpeedBumpControl/SpeedBumpControl.js | ./SpeedBumpControl.module.css | Path contains uppercase characters |
| components/SpeedBumpControl/SpeedBumpControl.js | ./speedBumpControlController.js | Path contains uppercase characters |
| components/SpeedBumpControl/controller/actions.js | ../../../modules/speedBump/interactions.js | Path contains uppercase characters |
| components/SpeedBumpControl/controller/actions.js | ../../../modules/teamSurpriseManager.js | Path contains uppercase characters |
| components/SpeedBumpControl/controller/domHandlers.js | ../../../modules/speedBump/index.js | Path contains uppercase characters |
| components/SpeedBumpControl/controller/domHandlers.js | ../SpeedBumpControl.module.css | Path contains uppercase characters |
| components/SpeedBumpControl/controller/promptBank.js | ../../../modules/speedBumpChallenges.js | Path contains uppercase characters |
| components/SpeedBumpControl/controller/stateSync.js | ../../../modules/speedBump/index.js | Path contains uppercase characters |
| components/SpeedBumpControl/controller/teamPrompts.js | ../../../modules/speedBumpChallenges.js | Path contains uppercase characters |
| components/SpeedBumpControl/speedBumpControlController.js | ../../modules/speedBumpChallenges.js | Path contains uppercase characters |
| components/SpeedBumpControl/speedBumpControlController.js | ./SpeedBumpControl.module.css | Path contains uppercase characters |
| components/SpeedBumpControl/speedBumpControlController.js | ./controller/domHandlers.js | Path contains uppercase characters |
| components/SpeedBumpControl/speedBumpControlController.js | ./controller/promptBank.js | Path contains uppercase characters |
| components/SpeedBumpControl/speedBumpControlController.js | ./controller/teamPrompts.js | Path contains uppercase characters |
| components/SurpriseSelector/SurpriseSelector.js | ../../modules/teamSurpriseManager.js | Path contains uppercase characters |
| components/SurpriseSelector/SurpriseSelector.js | ./SurpriseSelector.module.css | Path contains uppercase characters |
| components/TeamLinks/TeamLinks.js | ./TeamLinks.module.css | Path contains uppercase characters |
| components/TeamSurpriseManager/TeamSurpriseManager.js | ../../ui/team-surprise/teamSurpriseUI.js | Path contains uppercase characters |
| components/TeamSurpriseManager/TeamSurpriseManager.js | ../SurpriseSelector/SurpriseSelector.js | Path contains uppercase characters |
| components/ZoneManagement/ZoneManagement.js | ../../modules/zoneManager.js | Path contains uppercase characters |
| components/ZoneManagement/ZoneManagement.js | ./zoneHandlers.js | Path contains uppercase characters |
| components/ZoneManagement/ZoneManagement.js | ./zoneRender.js | Path contains uppercase characters |
| components/ZoneManagement/ZoneManagement.js | ./zoneUI.js | Path contains uppercase characters |
| components/ZoneManagement/zoneFirestore.js | ../../modules/data.js | Not found |
| components/ZoneManagement/zoneFirestore.js | ../../modules/scoreboardManager.js | Path contains uppercase characters |
| components/ZoneManagement/zoneFirestore.js | ../../modules/zonesUtils.js | Path contains uppercase characters |
| components/ZoneManagement/zoneHandlers.js | ../../modules/scoreboardManager.js | Path contains uppercase characters |
| components/ZoneManagement/zoneRender.js | ../../modules/zoneManager.js | Path contains uppercase characters |
| components/ZoneManagement/zoneRender.js | ../ZoneQuestions/ZoneQuestionsTypes.js | Path contains uppercase characters |
| components/ZoneManagement/zoneRender.js | ./ZoneManagement.module.css | Path contains uppercase characters |
| components/ZoneManagement/zoneUI.js | ./ZoneManagement.module.css | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestions.js | ./ZoneQuestionsUI.js | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsEditor.js | ./ZoneQuestions.module.css | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsEditor.js | ./ZoneQuestionsLogic.js | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsEditor.js | ./ZoneQuestionsTypes.js | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsLogic.js | ./ZoneQuestionsTypes.js | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsUI.js | ./ZoneQuestions.module.css | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsUI.js | ./ZoneQuestionsEditor.js | Path contains uppercase characters |
| components/ZoneQuestions/ZoneQuestionsUI.js | ./ZoneQuestionsLogic.js | Path contains uppercase characters |
| features/chat/playerChat.events.js | ./playerChat.state.js | Path contains uppercase characters |
| features/chat/playerChat.state.js | ../../components/ChatLog/ChatLog.js | Path contains uppercase characters |
| features/chat/playerChat.state.js | ../../services/messageService.js | Path contains uppercase characters |
| features/chat/playerChat.state.js | ./playerChat.events.js | Path contains uppercase characters |
| features/flat-tire/flatTireController.js | ../../components/FlatTireControl/controller/autoScheduler.js | Path contains uppercase characters |
| features/flat-tire/flatTireController.js | ../../components/FlatTireControl/controller/firestoreSync.js | Path contains uppercase characters |
| features/flat-tire/flatTireController.js | ../../modules/googleMapsLoader.js | Path contains uppercase characters |
| features/flat-tire/flatTireController.js | ../../services/flat-tire/flatTireService.js | Path contains uppercase characters |
| features/flat-tire/flatTireController.js | ../../ui/flat-tire/flatTireUI.js | Path contains uppercase characters |
| features/flat-tire/flatTireController.js | ./flatTireEvents.js | Path contains uppercase characters |
| features/flat-tire/flatTireEvents.js | ../../services/flat-tire/flatTireService.js | Path contains uppercase characters |
| features/game-state/gameStateController.js | ../../services/gameStateService.js | Path contains uppercase characters |
| features/game-state/gameStateController.js | ../../ui/gameNotifications.js | Path contains uppercase characters |
| features/player-page/playerPageController.js | ../../components/OpponentList/OpponentList.js | Path contains uppercase characters |
| features/player-page/playerPageController.js | ../chat/playerChat.state.js | Path contains uppercase characters |
| features/team-surprise/teamSurpriseController.js | ../../services/team-surprise/teamSurpriseService.js | Path contains uppercase characters |
| features/team-surprise/teamSurpriseController.js | ../../ui/team-surprise/teamSurpriseUI.js | Path contains uppercase characters |
| features/team-surprise/teamSurpriseController.js | ./teamSurpriseEvents.js | Path contains uppercase characters |
| features/team-surprise/teamSurpriseController.js | ./teamSurpriseTypes.js | Path contains uppercase characters |
| features/team-surprise/teamSurpriseEvents.js | ./teamSurpriseTypes.js | Path contains uppercase characters |
| modules/auth.js | otpauth | Not found |
| modules/chatManager/messageService.js | ../../services/messageService.js | Path contains uppercase characters |
| modules/chatManager/playerChat.events.js | ./playerChat.surprises.js | Path contains uppercase characters |
| modules/chatManager/playerChat.js | ./playerChat.events.js | Path contains uppercase characters |
| modules/chatManager/playerChat.js | ./playerChat.state.js | Path contains uppercase characters |
| modules/chatManager/playerChat.js | ./playerChat.ui.js | Path contains uppercase characters |
| modules/chatManager/playerChat.state.js | ../playerBugStrike.js | Path contains uppercase characters |
| modules/chatManager/playerChat.state.js | ../playerUI/overlays/speedBumpOverlay.js | Path contains uppercase characters |
| modules/chatManager/playerChat.state.js | ../speedBump/index.js | Path contains uppercase characters |
| modules/chatManager/playerChat.state.js | ../teamSurpriseManager.js | Path contains uppercase characters |
| modules/chatManager/playerChat.state.js | ./messageService.js | Path contains uppercase characters |
| modules/chatManager/playerChat.surprises.js | ../flatTireManager.js | Path contains uppercase characters |
| modules/chatManager/playerChat.surprises.js | ../teamSurpriseManager.js | Path contains uppercase characters |
| modules/chatManager/playerChat.surprises.js | ./messageService.js | Path contains uppercase characters |
| modules/chatManager/playerChat.ui.js | ../playerUI/overlays.js | Path contains uppercase characters |
| modules/chatManager/playerChat.ui.js | ../speedBumpPlayer.js | Path contains uppercase characters |
| modules/chatManager/playerChat.ui.js | ../teamSurpriseManager.js | Path contains uppercase characters |
| modules/chatManager/playerChat.ui.js | ./playerChat.surprises.js | Path contains uppercase characters |
| modules/chatManager/playerChat.ui.js | ./playerChat.utils.js | Path contains uppercase characters |
| modules/controlActions.js | ./gameUI.js | Path contains uppercase characters |
| modules/controlActions.js | ./teamSurpriseManager.js | Path contains uppercase characters |
| modules/controlStatus.js | ./gameStateManager.js | Path contains uppercase characters |
| modules/controlStatus.js | ./gameUI.js | Path contains uppercase characters |
| modules/controlStatus.js | ./scoreboardManager.js | Path contains uppercase characters |
| modules/controlStatus.js | ./zoneManager.js | Path contains uppercase characters |
| modules/controlUI.js | ./controlActions.js | Path contains uppercase characters |
| modules/controlUI.js | ./controlStatus.js | Path contains uppercase characters |
| modules/controlUI.js | ./gameStateManager.js | Path contains uppercase characters |
| modules/controlUI.js | ./gameUI.js | Path contains uppercase characters |
| modules/flatTireManager.js | ./teamSurpriseManager.js | Path contains uppercase characters |
| modules/flatTireManager.js | ./zonesUtils.js | Path contains uppercase characters |
| modules/flatTireUI.js | ./chatManager/messageService.js | Path contains uppercase characters |
| modules/flatTireUI.js | ./flatTireManager.js | Path contains uppercase characters |
| modules/flatTireUI.js | ./playerUI/overlays.js | Path contains uppercase characters |
| modules/flatTireUI.js | ./teamSurpriseManager.js | Path contains uppercase characters |
| modules/flatTireUI.js | ./zonesFirestore.js | Path contains uppercase characters |
| modules/flatTire_normalizeGPS.js | ./flatTireManager.js | Path contains uppercase characters |
| modules/gameRulesManager.js | ./emailTeams.js | Path contains uppercase characters |
| modules/gameRulesManager.js | ./teamSurpriseManager.js | Path contains uppercase characters |
| modules/gameStateManager.js | ./gameTimer.js | Path contains uppercase characters |
| modules/gameStateManager.js | ./gameUI.js | Path contains uppercase characters |
| modules/messages/taunts.js | ../../data/chirpMessages.js | Path contains uppercase characters |
| modules/playerBugStrike.js | ../styles/playerBugStrike.css | Path contains uppercase characters |
| modules/playerUI.js | ./playerUI/autoInit.js | Path contains uppercase characters |
| modules/playerUI/autoInit.js | ../speedBump/index.js | Path contains uppercase characters |
| modules/playerUI/autoInit.js | ./overlays/speedBumpOverlay.js | Path contains uppercase characters |
| modules/playerUI/core.js | ../zoneManager.js | Path contains uppercase characters |
| modules/playerUI/overlays/flatTireOverlay.js | ../../../data/chirpMessages.js | Path contains uppercase characters |
| modules/playerUI/overlays/flatTireOverlay.js | ../../zonesMap.js | Path contains uppercase characters |
| modules/playerUI/overlays/speedBumpOverlay.js | ../../speedBump/core.js | Path contains uppercase characters |
| modules/playerUI/overlays/speedBumpOverlay.js | ./baseOverlays.js | Path contains uppercase characters |
| modules/speedBump/interactions.js | ../chatManager/messageService.js | Path contains uppercase characters |
| modules/speedBump/interactions.js | ../teamSurpriseManager.js | Path contains uppercase characters |
| modules/speedBump/interactions.js | ../zonesFirestore.js | Path contains uppercase characters |
| modules/speedBump/overlay.js | ../teamSurpriseManager.js | Path contains uppercase characters |
| modules/speedBump/reversals.js | ../chatManager/messageService.js | Path contains uppercase characters |
| modules/speedBump/reversals.js | ../playerUI/overlays.js | Path contains uppercase characters |
| modules/speedBump/reversals.js | ../teamSurpriseManager.js | Path contains uppercase characters |
| modules/speedBump/reversals.js | ../zonesFirestore.js | Path contains uppercase characters |
| modules/speedBumpPlayer.js | ./playerUI/overlays.js | Path contains uppercase characters |
| modules/speedBumpPlayer.js | ./speedBump/index.js | Path contains uppercase characters |
| modules/speedBumpPlayer.js | ./speedBumpChallenges.js | Path contains uppercase characters |
| modules/zones.js | ./playerUI.js | Path contains uppercase characters |
| modules/zones.js | ./scoreboardManager.js | Path contains uppercase characters |
| modules/zones.js | ./zonesChallenge.js | Path contains uppercase characters |
| modules/zones.js | ./zonesFirestore.js | Path contains uppercase characters |
| modules/zones.js | ./zonesMap.js | Path contains uppercase characters |
| modules/zones.js | ./zonesUtils.js | Path contains uppercase characters |
| modules/zonesChallenge.js | ./zoneManager.js | Path contains uppercase characters |
| modules/zonesChallenge.js | ./zonesFirestore.js | Path contains uppercase characters |
| modules/zonesChallenge.js | ./zonesUtils.js | Path contains uppercase characters |
| modules/zonesFirestore.js | ./zonesUtils.js | Path contains uppercase characters |
| services/flat-tire/flatTireService.js | ../../modules/flatTireManager.js | Path contains uppercase characters |
| services/gameStateService.js | ./firestoreRefs.js | Path contains uppercase characters |
| services/team-surprise/teamSurpriseService.js | ../../features/team-surprise/teamSurpriseTypes.js | Path contains uppercase characters |
| services/teamService.js | ./firestoreRefs.js | Path contains uppercase characters |
| ui/flat-tire/flatTireUI.js | ../../components/FlatTireControl/FlatTireControl.module.css | Path contains uppercase characters |
| ui/flat-tire/flatTireUI.js | ../../features/flat-tire/flatTireTypes.js | Path contains uppercase characters |
| ui/flat-tire/flatTireUI.js | ../../modules/zonesMap.js | Path contains uppercase characters |
| ui/team-surprise/teamSurpriseUI.js | ../../features/team-surprise/teamSurpriseEvents.js | Path contains uppercase characters |

## Legacy References
| File | Import | Suggested Fix |
|------|--------|----------------|
| components/BugStrikeControl/BugStrikeControl.js | ../../modules/teamSurpriseManager.js | modules stub only |
| components/FlatTireControl/FlatTireControl.js | ./flatTireControlController.js | use components/TeamSurpriseManager/TeamSurpriseManager.js or features/services split |
| components/SpeedBumpControl/controller/actions.js | ../../../modules/teamSurpriseManager.js | modules stub only |
| components/SurpriseSelector/SurpriseSelector.js | ../../modules/teamSurpriseManager.js | modules stub only |
| modules/chatManager/playerChat.state.js | ../teamSurpriseManager.js | modules stub only |
| modules/chatManager/playerChat.surprises.js | ../teamSurpriseManager.js | modules stub only |
| modules/chatManager/playerChat.ui.js | ../teamSurpriseManager.js | modules stub only |
| modules/controlActions.js | ./teamSurpriseManager.js | modules stub only |
| modules/flatTireManager.js | ./teamSurpriseManager.js | modules stub only |
| modules/flatTireUI.js | ./teamSurpriseManager.js | modules stub only |
| modules/gameRulesManager.js | ./teamSurpriseManager.js | modules stub only |
| modules/speedBump/interactions.js | ../teamSurpriseManager.js | modules stub only |
| modules/speedBump/overlay.js | ../teamSurpriseManager.js | modules stub only |
| modules/speedBump/reversals.js | ../teamSurpriseManager.js | modules stub only |

## Circular Dependencies
| File A | File B | Link Type |
|---------|---------|-----------|
| features/chat/playerChat.state.js | features/chat/playerChat.events.js | import |
| modules/speedBump/comms.js | modules/speedBump/interactions.js | import |
| modules/speedBump/reversals.js | modules/speedBump/interactions.js | import |
