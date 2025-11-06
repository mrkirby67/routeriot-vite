# AICP Integrity Report — 2025-11-05T23:35:12.327Z

Scanned directories: modules, services, features, components, ui

## Missing Exports (0)
✅ None

## Possible Undefined Variables (0)
✅ None

## AICP Layer Graph Summary
| Layer | JS Files |
|--------|-----------|
| modules | 69 |
| services | 9 |
| features | 12 |
| components | 32 |
| ui | 5 |

## Global Bridge Mismatches
✅ None — all critical globals that are used are also defined.

## Firestore Schema Consistency
### speedbump
Distinct collections: —

### flattire
Distinct collections: flatTireAssignments
| File | Collection |
|------|------------|
| modules/flatTireManager.js | flatTireAssignments |
| modules/gameRulesManager.js | flatTireAssignments |
| services/firestoreRefs.js | flatTireAssignments |

### shield
Distinct collections: —

