# 🧩 Route Riot — CODEX GUIDELINES

**Version:** 1.0  
**Audience:** AI development assistants (ChatGPT, Gemini, Claude, Copilot)  
**Goal:** Ensure all AI models follow the same conventions when modifying or analyzing code.

---

## 🧱 1. Core Principles

- **Non-destructive editing:**  
  Never delete large code blocks; instead comment them out or mark with `// DEPRECATED:`.

- **Layered structure:**  
  - `services/` → Firestore, data, logic (no DOM).  
  - `features/` → Controllers, orchestrators.  
  - `components/` → UI elements.  
  - `ui/` → Shared UI utilities and overlays.  
  - `utils/` → Helpers, formatters, constants.  

- **No circular imports.**  
  UI → features → services → utils only.

---

## 🧠 2. Comment Protocol (AICP Standard)

Use explicit, parseable headers in every file:

```js
// ============================================================================
// FILE: path/to/file.js
// PURPOSE: What this file is responsible for.
// DEPENDS_ON: other/modules
// USED_BY: features/ or components/
// ============================================================================

/**
 * @function exampleFunction
 * @param {string} arg1 - description
 * @returns {Promise<void>}
 * @aicp-phase chat
 */
```

---

## 🧩 3. Codex Instruction Blocks

Use this template for all AI task instructions:

```
=== CODEX UNIVERSAL BLOCK v1.0 ===
INTENT: clear 1–2 sentence summary
MODELS: ChatGPT5, Gemini2, Claude3
REQUIREMENTS:
 - Non-destructive
 - Keep file paths relative
TARGET_FILES:
 - path/to/file.js
 - another/file.js
=== END CODEX UNIVERSAL BLOCK ===
```

---

## 🧮 4. Phase & Status Markers

```js
// === PHASE: chat_refactor_v2 ===
// STATUS: in_progress
// TODO: migrate playerChat.events.js → features/chat/
```

Both AIs will treat this as a **context boundary** when resuming work.

---

## 📁 5. Manifest Usage

- The root `codex_manifest.yaml` defines project structure.  
- Any new service or feature must be registered there.  
- Use lower_snake_case for file names and kebab-case for folders.

---

## 🔒 6. AI Behavior Expectations

- **ChatGPT:** Prefers explicit Codex blocks, short logical tasks.  
- **Gemini:** Handles batch file creation better but may time out on >700 lines.  
- **Both:** Require consistent comment headers and YAML manifest to align context.

---

## 🧰 7. Shared Utilities (planned for utils/)

| File | Purpose |
|:--|:--|
| `helpers.js` | Reusable small functions (formatters, ID generators). |
| `logger.js` | Unified console and Firestore logging. |
| `time.js` | Countdown, cooldown, and timestamp helpers. |

---

## ✅ 8. Commit Guidelines

| Action | Command | Note |
|:--|:--|:--|
| Create checkpoint | `git commit -am "Codex Phase X complete"` | Small, focused commits. |
| Create tag | `git tag -a safe-<date>-<desc> -m "desc"` | Use before major AI edits. |
| Revert | `git checkout tags/<tag>` | Clean rollback point. |

---

## 🧭 9. Human Notes

Store running notes under `docs/ai_notes/` and always prefix entries with dates.  
Use Markdown headers for readability by both AIs.

---

## 🧩 10. Final Guideline Summary

✅ Use structured headers  
✅ Use JSDoc consistently  
✅ Group by layer (services → features → components → ui → utils)  
✅ Use Codex Blocks for edits  
✅ Never delete logic; deprecate instead  
✅ Keep notes under `docs/ai_notes/`  
✅ Sync `codex_manifest.yaml` after new features

---

*Following these rules ensures all AI agents can safely collaborate without overwriting or diverging logic.*