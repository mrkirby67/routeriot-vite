# Services Layer

Total modules: 5

| Module | Purpose | Exports | Phase |
|--------|---------|---------|-------|
| [services/firestoreRefs.js](services/firestoreRefs.js.md) | Centralizes all Firestore database references for<br>the application. | refs, gameStateRef,<br>teamsCollectionRef,<br>getTeamRef, zonesCollectionRef | tier1_services_injection |
| [services/flat-tire/flatTireService.js](services/flat-tire/flatTireService.js.md) | Handles all Firestore interactions for the Flat<br>Tire feature. | loadFlatTireConfig,<br>subscribeFlatTireAssignments,<br>subscribeFlatTireConfig,<br>assignFlatTireTeam,<br>releaseFlatTireTeam | tier1_services_injection |
| [services/gameStateService.js](services/gameStateService.js.md) | Manages core game state logic, such as pausing,<br>resuming, and resetting the game. | pauseGame | tier1_services_injection |
| [services/messageService.js](services/messageService.js.md) | Data layer for handling chat messages. | sendMessage, onNewMessage | tier1_services_injection |
| [services/teamService.js](services/teamService.js.md) | Manages team-related data, such as fetching team<br>information and player lists. | getAllTeams | tier1_services_injection |
