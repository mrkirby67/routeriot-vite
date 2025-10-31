# AICP Player Page Scope Report — 2025-10-30

## Queries Found
| File | Line | Query | Filtered? | Comment |
|---|---|---|---|---|
| `services/teamService.js` | 21 | `getDocs(teamsCollectionRef)` | ❌ | The `getAllTeams` function performs an unfiltered query on the entire `teams` collection. This is inefficient and fetches unnecessary data for the player page. |

## Rendering Checks
| File | Expression | Scoped? | Suggestion |
|---|---|---|---|
| `components/OpponentList/OpponentList.js` | `teams.forEach(...)` | ❌ | The component fetches all teams via `teamService.getAllTeams()` and renders every team. It should filter out the active player's own team. |
| `features/player-page/playerPageController.js` | `initializeOpponentList()` | ❌ | The controller calls `initializeOpponentList` without passing the current player's team context, making it impossible for the `OpponentList` to filter correctly. |

## Summary & Recommendations

The Player Page currently fetches and displays all teams, not just the opponents of the active player. This is due to an unfiltered Firestore query and a lack of context-based filtering in the UI components.

**Next Actions:**
1.  Modify `services/teamService.js` to accept an optional `teamId` to exclude from the query, or have the caller perform the filtering.
2.  Update `features/player-page/playerPageController.js` to retrieve the active player's `teamId`.
3.  Pass the `teamId` to `components/OpponentList/OpponentList.js`.
4.  In `OpponentList.js`, filter the list of teams to exclude the active player's team before rendering.
