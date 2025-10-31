# Features Layer

Total modules: 8

| Module | Purpose | Exports | Phase |
|--------|---------|---------|-------|
| [features/bug-strike/bugStrikePlayer.js](features/bug-strike/bugStrikePlayer.js.md) | Handles the player-side logic for Bug Strikes. | initializeBugStrikePlayer | tier2_features_injection |
| [features/chat/playerChat.events.js](features/chat/playerChat.events.js.md) | Bridges UI events (like sending a message) to the<br>chat state controller. | attachChatEventListeners | tier2_features_injection |
| [features/chat/playerChat.state.js](features/chat/playerChat.state.js.md) | Main controller for the player chat feature. | initializeChat,<br>handleSendMessage | tier2_features_injection |
| [features/flat-tire/flatTireController.js](features/flat-tire/flatTireController.js.md) | Orchestrates the Flat Tire feature, importing from<br>smaller modules. | createFlatTireControlController,<br>FlatTireControlController | tier2_features_injection |
| [features/flat-tire/flatTireTypes.js](features/flat-tire/flatTireTypes.js.md) | Defines constants and types for the Flat Tire<br>feature. | CAPTURE_RADIUS_METERS | tier2_features_injection |
| [features/game-state/gameStateController.js](features/game-state/gameStateController.js.md) | Handles UI interactions related to game state<br>changes. | handlePauseGame,<br>handleResumeGame | tier2_features_injection |
| [features/player-page/playerPageController.js](features/player-page/playerPageController.js.md) | Controller for the main player page. | initializePlayerPage | tier2_features_injection |
| [features/speed-bump/speedBumpPlayer.js](features/speed-bump/speedBumpPlayer.js.md) | Handles the player-side logic for Speed Bumps. | initializeSpeedBumpPlayer | tier2_features_injection |
