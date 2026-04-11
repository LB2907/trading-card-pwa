<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Cursor skills (repo root)

An **always-on** Cursor rule loads skills by topic: see **`../.cursor/rules/auto-select-project-skills.mdc`**. It tells the agent to read **every** matching `SKILL.md` (often several) from the table before coding.

Workspace-level agent skills live under **`../.cursor/skills/`** (sibling of `trading-card-pwa/`). Skill ids match the rule table; open the matching `SKILL.md` for the area you touch:

- **Stack**: `tcg-local-sqlite-pwa`, `tcg-supabase-cloud`, `tcg-card-compositor-export`, `tcg-serwist-pwa`, `tcg-marketplace-roadmap`
- **Quality & meta**: `evaluate-new-skill-first`, `improve-skills-after-task` (post-task pass), `nextjs-16-app-router-quality`, `typescript-react-quality`, `web-security-hardening`, `tcg-design-system-ux`
