# 🧠 AICP Injection System
This directory defines templates used to inject AICP headers and metadata into all project files.

## Folder Structure
- `templates/` → contains reusable header/footer Codex patterns
- `inject_config.yaml` → defines injection scope
- `readme.md` → human/AI overview

### Injection Rules
1. Never modify executable logic.
2. Only insert comments or YAML metadata.
3. Maintain UTF-8 plain text format.
4. Compatible with ChatGPT, Gemini, Claude.

### Next Step
Run the Tier 1 Codex Injector Block to add headers & footers to all `/services/` and `/features/` files.
