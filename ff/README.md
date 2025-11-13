# Fastest Finger (FF) Mini-Game

This folder contains a completely **separate** classroom mini-game that is **not part of Route Riot**.  
It is intentionally lightweight and should **not be merged, refactored, optimized, reorganized, or incorporated** into the Route Riot modules, services, components, or build pipeline.

## Purpose
This is a simple reaction-based buzzer game for live classroom use.  
Students join using `/ff/player`, and the teacher runs the round from `/ff/control`.

## Important Boundaries for AI Code Assistants
- **Do not rewrite or consolidate this code** into Route Riot files.
- **Do not attempt to convert** this into a module or import structure within:
  - `/components/`
  - `/modules/`
  - `/services/`
  - or the Route Riot UI.
- **Do not remove** the separate HTML pages in this folder.
- **Do not rename**, **auto-fix**, **"modernize"**, or **infer dependency folding** across project layers.

## Firebase Data Isolation
Fastest Finger uses its own data paths:

### Firestore

## Firebase Configuration (FF only)
- Copy `core/runtime-config.sample.js` to `core/runtime-config.js`.
- Fill in your Firebase project values (apiKey, authDomain, etc.). Keep this file out of git; `.gitignore` already skips it.
- The runtime config script is included in every FF page (and the broader Route Riot app) to avoid hardcoding keys in the repo.
