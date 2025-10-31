# 🧠 Route Riot — AI Notes Log
**Purpose:**  
This directory stores coordination notes, AI instructions, and task histories shared between ChatGPT, Gemini, and human developers.

---

## 🗂 Structure

| File | Description |
|:--|:--|
| `phase_notes.md` | Running commentary of what’s been done or needs to be done. |
| `refactor_log.md` | Chronological notes on modularization and rewiring tasks. |
| `bug_reports.md` | Known issues discovered by either AI or developer testing. |
| `design_decisions.md` | Rationale for architecture, naming, and feature logic. |

---

## ✍️ Guidelines

1. **Keep entries chronological.** Start each section with `### YYYY-MM-DD – Subject`.
2. **Use short sections** with clear bullet lists — both AIs parse better when lists are compact.
3. **Tag entries** using AI-friendly labels:
   - `@phase chat_refactor_v2`
   - `@phase speedbump_bridge`
   - `@task pending`, `@task complete`
   - `@note human`, `@note ai`
4. **Never overwrite** — append new entries; let the file grow.
5. **Gemini + ChatGPT Shared Convention:**  
   Always start major notes with `##` headers. Both models treat `##` as new context anchors.

---

## Example Entry

```markdown
### 2025-10-30 – Chat/SpeedBump Rewire Plan
@phase chat_speedbump_bridge  
@task pending  

- Migrate imports from `modules/chatManager/messageService.js` → `services/messageService.js`
- Migrate all surprise logic from `teamSurpriseManager.js` → `services/surpriseService.js`
- Verify UI still renders after module path updates.

@note human: commit snapshot `safe-oct29-stable` preserved before edits.
```

---

📘 *Both ChatGPT and Gemini automatically parse this structure when reading the repo context in VS or Colab.*