## Agent Communication Preferences
- Respond in Chinese by default when interacting with the user.
- Avoid heavy jargon; explain technical points in plain language without assuming deep prior knowledge.
- Use Chinese commit messages by default when creating git commits for this repository.

## Repo Workflow

- This repository is desktop-first. Treat the Tauri desktop app as the primary runtime target, not a standalone browser product.
- Prefer `bun run dev` as the default local development entrypoint. It is the recommended daily workflow for this repository.
- Do not treat `web/` as an independently shipped browser app unless the user explicitly asks for browser-only work.
- When working across layers, preserve the current architecture: `web/` for the desktop frontend, `src-tauri/` for the Tauri shell, `agent-sidecar/` for the Node sidecar, and `scripts/` for development/build orchestration.
- Keep changes in the correct layer. Do not move sidecar or desktop-shell responsibilities into the frontend just because it is faster to patch locally.

## Validation Expectations

- After code changes, run the narrowest meaningful validation that matches the files you touched, and report what you verified.
- For `web/` changes, prefer at least a frontend build or equivalent targeted validation.
- For `agent-sidecar/` changes, prefer at least a sidecar build or equivalent targeted validation.
- For changes that affect the desktop integration, runtime wiring, or Tauri configuration, prefer validating the desktop startup path rather than checking only isolated modules.
- If you modify files that already have nearby tests, run the relevant tests unless the user explicitly asks you not to or the environment prevents it.
- Do not leave one-off test files created only for investigation. Delete temporary tests before finishing, or convert them into intentional regression tests in the existing test suite and call that out clearly.
- If you could not run a meaningful validation step, say so clearly and explain the gap.

## Generated Artifacts

- Treat build outputs and generated directories as derived artifacts, not primary edit targets.
- Do not hand-edit `web/dist`, `agent-sidecar/dist`, `src-tauri/target`, `node_modules`, or `test-results` unless the user explicitly asks for generated-output work.
- Prefer changing source files and regenerating outputs through the normal build process instead of patching compiled artifacts directly.

## UI Design Compliance

- All frontend work must strictly follow the rules in `web-design-guidelines`; treat them as mandatory requirements, not optional suggestions.
- When designing, implementing, or reviewing UI, use existing local UI patterns and nearby components as the primary source of truth for visual style, layout, spacing, and interaction details.
- Use `frontend-design` for production-grade implementation inside the repository, especially when translating an approved direction into React components, pages, or shippable UI code.
- For React frontend implementation, review, refactoring, and performance optimization work, use `vercel-react-best-practices` as the default performance guidance.
- Apply `vercel-react-best-practices` especially when touching component structure, rendering behavior, state subscriptions, async data flow, or bundle-size-sensitive frontend code.
- For frontend design, implementation, review, and refactoring, satisfy `web-design-guidelines` and preserve consistency with the existing application unless the user explicitly requests a different direction.
- The `web/` frontend uses HeroUI React v3 through `@heroui/react` and `@heroui/styles`. When adding or changing HeroUI components, use the `heroui-react` skill and fetch the relevant component docs before implementation.
- Follow HeroUI v3 patterns in `web/`: no `HeroUIProvider`, compound component APIs where documented, `onPress` for HeroUI interactive components, Tailwind CSS v4 compatibility, and `@import "tailwindcss";` before `@import "@heroui/styles";`.
- Prefer the existing direct HeroUI component import style already used in `web/`, such as `@heroui/react/button`, unless local code or fetched HeroUI v3 docs point to a better pattern.
- Use `heroui-migration` only when migrating HeroUI v2 code or resolving v2-to-v3 API/styling differences. Do not apply HeroUI v2 patterns to new `web/` code.
- Use `heroui-native` only for explicit React Native/mobile work. Do not add Native-only dependencies or patterns to the Tauri desktop/web frontend.

## Difficult Bug Investigation

- When analyzing any problem, prioritize deep analysis to identify the root cause before proposing or implementing a fix; avoid stopping at surface symptoms when the underlying cause is still unclear.
- Prioritize Context7 for official framework/library docs, and GitHub Issues/Discussions/PRs for real-world reports and fixes; do not rely only on local intuition when symptoms are hard to explain.
- When presenting the diagnosis, clearly separate confirmed facts, likely inferences, and external references that inspired the hypothesis.

## Runtime And Security Boundaries

- Preserve browser-development compatibility for frontend code whenever practical; do not assume Tauri-only globals or desktop-only APIs are always available without a guard.
- Be especially careful when changing Tauri capabilities, CSP settings, desktop runtime wiring, or command approval logic.
- Unless the task explicitly requires it, do not broaden security-sensitive permissions, auto-approval behavior, or network access rules.
- If a task requires changing one of those security-sensitive areas, call out the risk clearly and verify the change deliberately.

## Test Cleanup

- Always run browser-based tests in headless mode unless the user explicitly requests otherwise.
- Before starting any backend or dev server for browser automation, first check whether the required service is already running in the background, and reuse the existing one when possible.
- Do not start background services on your own when browser automation can proceed with an already-running service, to avoid conflicting with services the user has already started.
- When starting browser-based tests, do not keep backend services running in the foreground; start them in the background or use a detached process so the test workflow does not get stuck.
- After completing tests, clean up any cache files, temporary artifacts, and test output created during the run; do not leave junk in the repository.
- Treat newly created ad hoc `*.test.*`, `*.spec.*`, fixture, and repro files as temporary unless they are deliberate source-controlled regression coverage. Remove temporary ones before the final response.
- After browser-based tests finish, terminate any leftover backend, browser, driver, or test-related processes started for the run so they do not accumulate and slow down or freeze the machine.

## Test Organization

- New or migrated intentional tests must live under the repository-level `tests/` directory, grouped by layer such as `tests/web/`, `tests/agent-sidecar/`, and `tests/src-tauri/`.
- Mirror the source path under that layer when it helps readability, but do not add new `*.test.*` or `*.spec.*` files beside source files.
- Existing colocated tests may remain until they are intentionally migrated; avoid moving unrelated historical tests as part of a focused feature or bug fix.

## Documentation Sync

- When updating repository rules or user-facing project documentation, keep the English and Chinese counterparts aligned unless the user explicitly asks for a one-language-only change.
- For paired files such as `AGENTS.md` / `docs/AGENTS.zh-CN.md` and `README.md` / `docs/README.zh-CN.md`, aim for semantic parity rather than line-by-line literal translation.
