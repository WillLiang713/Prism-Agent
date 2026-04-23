## Agent Communication Preferences
- Respond in Chinese by default when interacting with the user.
- Avoid heavy jargon; explain technical points in plain language without assuming deep prior knowledge.
- Use Chinese commit messages by default when creating git commits for this repository.

## UI Design Compliance

- All UI work must strictly follow the rules defined in `DESIGN.md`.
- All frontend work must also strictly follow the rules in `web-design-guidelines`; treat them as mandatory requirements, not optional suggestions.
- Use `frontend-design` for production-grade implementation inside the repository, especially when translating an approved direction into React components, pages, or shippable UI code.
- When designing, implementing, or reviewing UI, treat `DESIGN.md` as the primary source of truth for visual style, layout, components, spacing, and interaction details.
- For frontend design, implementation, review, and refactoring, `DESIGN.md` and `web-design-guidelines` must both be satisfied together.
- If an existing UI implementation conflicts with `DESIGN.md`, prioritize aligning the result with `DESIGN.md` unless the user explicitly requests an exception.

## Difficult Bug Investigation

- When analyzing any problem, prioritize deep analysis to identify the root cause before proposing or implementing a fix; avoid stopping at surface symptoms when the underlying cause is still unclear.
- Prioritize Context7 for official framework/library docs, and GitHub Issues/Discussions/PRs for real-world reports and fixes; do not rely only on local intuition when symptoms are hard to explain.
- When presenting the diagnosis, clearly separate confirmed facts, likely inferences, and external references that inspired the hypothesis.

## Test Cleanup

- Always run browser-based tests in headless mode unless the user explicitly requests otherwise.
- Before starting any backend or dev server for browser automation, first check whether the required service is already running in the background, and reuse the existing one when possible.
- Do not start background services on your own when browser automation can proceed with an already-running service, to avoid conflicting with services the user has already started.
- When starting browser-based tests, do not keep backend services running in the foreground; start them in the background or use a detached process so the test workflow does not get stuck.
- After completing tests, clean up any cache files, temporary artifacts, and test output created during the run; do not leave junk in the repository.
- After browser-based tests finish, terminate any leftover backend, browser, driver, or test-related processes started for the run so they do not accumulate and slow down or freeze the machine.
