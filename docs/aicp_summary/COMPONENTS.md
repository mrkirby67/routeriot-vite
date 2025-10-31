# Components Layer

Total modules: 31

| Module | Purpose | Exports | Phase |
|--------|---------|---------|-------|
| [components/Broadcast/Broadcast.js](components/Broadcast/Broadcast.js.md) | === AI-CONTEXT-MAP === | BroadcastComponent,<br>initializeBroadcastLogic | tier3_components_injection |
| [components/BugStrikeControl/BugStrikeControl.js](components/BugStrikeControl/BugStrikeControl.js.md) | 🧱 COMPONENT MARKUP | BugStrikeControlComponent,<br>initializeBugStrikeControl | tier3_components_injection |
| [components/ChatLog/ChatLog.js](components/ChatLog/ChatLog.js.md) | Renders the chat log UI. | renderMessages | tier3_components_injection |
| [components/FlatTireControl/FlatTireControl.js](components/FlatTireControl/FlatTireControl.js.md) | Auto-generated metadata for FlatTireControl | FlatTireControlComponent,<br>initializeFlatTireControl,<br>teardownFlatTireControl | tier3_components_injection |
| [components/FlatTireControl/controller/autoScheduler.js](components/FlatTireControl/controller/autoScheduler.js.md) | === AI-CONTEXT-MAP === | startAutoScheduler,<br>stopAutoScheduler | tier3_components_injection |
| [components/FlatTireControl/controller/domHandlers.js](components/FlatTireControl/controller/domHandlers.js.md) | Auto-generated metadata for domHandlers | setupDomRefs, renderRows | tier3_components_injection |
| [components/FlatTireControl/controller/firestoreSync.js](components/FlatTireControl/controller/firestoreSync.js.md) | === AI-CONTEXT-MAP === | subscribeToRacers, applyConfig | tier3_components_injection |
| [components/FlatTireControl/flatTireControlController.js](components/FlatTireControl/flatTireControlController.js.md) | Re-exports the refactored<br>FlatTireControlController. | createFlatTireControlController | tier3_components_injection |
| [components/GameControls/GameControls.js](components/GameControls/GameControls.js.md) | 🎉 Animated Broadcast Banner | GameControlsComponent,<br>initializeGameControlsLogic | tier3_components_injection |
| [components/OpponentList/OpponentList.js](components/OpponentList/OpponentList.js.md) | Renders and manages the list of opponent players. | initializeOpponentList | tier3_components_injection |
| [components/RacerManagement/RacerManagement.js](components/RacerManagement/RacerManagement.js.md) | === AI-CONTEXT-MAP === | RacerManagementComponent,<br>initializeRacerManagementLogic | tier3_components_injection |
| [components/Scoreboard/Scoreboard.js](components/Scoreboard/Scoreboard.js.md) | SCOREBOARD COMPONENT (Unified Control + Player) | ScoreboardComponent,<br>initializeScoreboardListener | tier3_components_injection |
| [components/SpeedBumpControl/SpeedBumpControl.js](components/SpeedBumpControl/SpeedBumpControl.js.md) | === AI-CONTEXT-MAP === | SpeedBumpControlComponent,<br>initializeSpeedBumpControl,<br>teardownSpeedBumpControl | tier3_components_injection |
| [components/SpeedBumpControl/controller/actions.js](components/SpeedBumpControl/controller/actions.js.md) | Called when control clicks “Send” beside a team<br>row. | handleSendSpeedBump,<br>handleReleaseSpeedBump | tier3_components_injection |
| [components/SpeedBumpControl/controller/domHandlers.js](components/SpeedBumpControl/controller/domHandlers.js.md) | Auto-generated metadata for domHandlers | setupDomRefs, wireButtons,<br>renderTeamRows, updateRow | tier3_components_injection |
| [components/SpeedBumpControl/controller/promptBank.js](components/SpeedBumpControl/controller/promptBank.js.md) | === AI-CONTEXT-MAP === | loadBank, saveBankToFirestore,<br>saveBankLocal | tier3_components_injection |
| [components/SpeedBumpControl/controller/stateSync.js](components/SpeedBumpControl/controller/stateSync.js.md) | === AI-CONTEXT-MAP === | syncTeams, syncBumps | tier3_components_injection |
| [components/SpeedBumpControl/controller/teamPrompts.js](components/SpeedBumpControl/controller/teamPrompts.js.md) | === AI-CONTEXT-MAP === | loadPrompts, savePrompts,<br>ensurePrompt, shufflePrompt,<br>reconcileWithBank | tier3_components_injection |
| [components/SpeedBumpControl/speedBumpControlController.js](components/SpeedBumpControl/speedBumpControlController.js.md) | 🔁 NEW: propagate bank changes to the shared prompt<br>pool immediately | createSpeedBumpControlController,<br>SpeedBumpControlController | tier3_components_injection |
| [components/SurpriseSelector/SurpriseSelector.js](components/SurpriseSelector/SurpriseSelector.js.md) | export async function<br>applyToAllTeams(selectedType, newCount = 0) { | applyToAllTeams,<br>SurpriseSelectorComponent,<br>initializeSurpriseSelector,<br>teardownSurpriseSelector | tier3_components_injection |
| [components/TeamLinks/TeamLinks.js](components/TeamLinks/TeamLinks.js.md) | File: components/TeamLinks/TeamLinks.js | TeamLinksComponent,<br>initializeTeamLinksLogic | tier3_components_injection |
| [components/ZoneManagement/ZoneManagement.js](components/ZoneManagement/ZoneManagement.js.md) | Initialize Zone Management logic for the Control<br>dashboard. | initializeZoneManagementLogic,<br>ZoneManagementComponent | tier3_components_injection |
| [components/ZoneManagement/zoneFirestore.js](components/ZoneManagement/zoneFirestore.js.md) | 📣 GENERIC BROADCAST EVENT | broadcastEvent,<br>broadcastChallenge,<br>broadcastWin | tier3_components_injection |
| [components/ZoneManagement/zoneHandlers.js](components/ZoneManagement/zoneHandlers.js.md) | 🔍 MANAGE BUTTON (toggle zone details) | default | tier3_components_injection |
| [components/ZoneManagement/zoneRender.js](components/ZoneManagement/zoneRender.js.md) | 🔍 Helper: Dynamic Zoom from Diameter | renderZones | tier3_components_injection |
| [components/ZoneManagement/zoneUI.js](components/ZoneManagement/zoneUI.js.md) | === AI-CONTEXT-MAP === | ZoneManagementComponent | tier3_components_injection |
| [components/ZoneQuestions/ZoneQuestions.js](components/ZoneQuestions/ZoneQuestions.js.md) | 🔹 Export both together for streamlined imports | initializeZoneQuestions,<br>ZoneQuestionsComponent,<br>initializeZoneQuestionsUI | tier3_components_injection |
| [components/ZoneQuestions/ZoneQuestionsEditor.js](components/ZoneQuestions/ZoneQuestionsEditor.js.md) | 🧱 Render Form | renderZoneQuestionEditor,<br>initializeZoneQuestionEditor | tier3_components_injection |
| [components/ZoneQuestions/ZoneQuestionsLogic.js](components/ZoneQuestions/ZoneQuestionsLogic.js.md) | ✅ Validate structure before saving a question | validateQuestionBeforeSave,<br>parseCsv, renderAnswerSummary | tier3_components_injection |
| [components/ZoneQuestions/ZoneQuestionsTypes.js](components/ZoneQuestions/ZoneQuestionsTypes.js.md) | 🔹 All supported question types | validateQuestionType,<br>allowedQuestionTypes,<br>booleanSets, defaultTolerance,<br>minChoices, questionTypeLabels | tier3_components_injection |
| [components/ZoneQuestions/ZoneQuestionsUI.js](components/ZoneQuestions/ZoneQuestionsUI.js.md) | 🧱 Component (UI) | ZoneQuestionsComponent,<br>initializeZoneQuestionsUI | tier3_components_injection |
