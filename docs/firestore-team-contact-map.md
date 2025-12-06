# Firestore Team/Player Contact Map

This doc captures where Route Riot stores team + player contact info in Firestore and how to dump it for debugging.

## Canonical sources
- **Collection:** `racers/{racerId}`  
  - Fields seen in code: `name`, `displayName` (rare), `cell`, `email`, `team`, `teamCode?`, `role?`  
  - Usage: Racer Management UI, game start roster snapshots, speed bump contact lookups, email link generation.  
  - Contact lives at the **player level** (`cell`, `email`). Team association via `team` string.
- **Collection:** `teams/{teamId}` (optional contact)  
  - Fields referenced: `name`/`teamName`, `slogan`, `email`, occasionally `phone`/`cell` if provided.  
  - Usage: Read-only listing via `services/teamService.js`; no writes in codebase. Treat as supplemental/legacy team-level contact.

## Derived / secondary data
- **Collection:** `games/{gameId}` (field: `rosterSnapshot`)  
  - Created at game start by `services/game/gameRosterService.js` as a snapshot copy of the current `racers` data.  
  - Schema: array of `{ teamId, teamName, teamCode?, players: [{ playerId, displayName, phone, email, isCaptain? }] }`.  
  - Not a source of truth; mirrors `racers` for that game’s timeline.
- **Static fallback:** `data.js` contains hardcoded team names/emails used for legacy lookups; not synced to Firestore.

## Contact dump utility
- Service: `services/admin/contactReportService.js` exports `fetchAllTeamContacts()` → returns flat rows with `{ source, teamId, teamName, playerId, playerName, phone, email }`, combining `teams` (if contact exists) and `racers` (per-player, with team-level fallback).
- CLI: `tools/firestoreContactDump.js` prints JSON to stdout.
  - Run: `NODE_OPTIONS=--experimental-network-imports node tools/firestoreContactDump.js`
  - Output: array of team/player contact rows (includes `source: "racers"` or `source: "teams"`).

## Notes & caveats
- If a racer row lacks phone/email but the team doc has them, the dump echoes the team-level contact on that racer row for convenience.
- No game logic is changed; this is read-only. Security rules/auth still apply when running the dump.
- If multiple sources disagree, treat `racers` as authoritative for player-level contact; `teams` is supplemental. `rosterSnapshot` is a per-game copy for audit only.
