## Agent Communication Preferences
- Respond in Chinese by default when interacting with the user.
- 与用户交互时默认使用中文回复。
- Avoid heavy jargon; explain technical points in plain language without assuming deep prior knowledge.
- 避免大量术语；解释时尽量通俗，不假设用户具备深厚技术背景。

## UI Design Compliance
UI 设计规范遵循

- All UI work must strictly follow the rules defined in `DESIGN.md`.
- 所有 UI 相关工作都必须严格遵循 `DESIGN.md` 中定义的规则。
- All frontend work must also strictly follow the rules in `web-design-guidelines`; treat them as mandatory requirements, not optional suggestions.
- 所有前端相关工作也必须严格遵循 `web-design-guidelines` 中的规则；这些规则属于强制要求，不是可选建议。
- When designing, implementing, or reviewing UI, treat `DESIGN.md` as the primary source of truth for visual style, layout, components, spacing, and interaction details.
- 在设计、实现或审查 UI 时，应将 `DESIGN.md` 视为视觉风格、布局、组件、间距和交互细节的首要依据。
- For frontend design, implementation, review, and refactoring, `DESIGN.md` and `web-design-guidelines` must both be satisfied together.
- 对于前端设计、实现、审查和重构，必须同时满足 `DESIGN.md` 与 `web-design-guidelines` 两套要求。
- If an existing UI implementation conflicts with `DESIGN.md`, prioritize aligning the result with `DESIGN.md` unless the user explicitly requests an exception.
- 如果现有 UI 实现与 `DESIGN.md` 冲突，除非用户明确要求例外，否则应优先使结果与 `DESIGN.md` 保持一致。

## Difficult Bug Investigation
复杂问题排查

- When analyzing any problem, prioritize deep analysis to identify the root cause before proposing or implementing a fix; avoid stopping at surface symptoms when the underlying cause is still unclear.
- 分析任何问题时，都要优先做深入分析，先找出问题的根本原因，再提出或实施修复；如果底层原因还不清楚，不要停留在表面现象上。
- Prioritize Context7 for official framework/library docs, and GitHub Issues/Discussions/PRs for real-world reports and fixes; do not rely only on local intuition when symptoms are hard to explain.
- 查资料时统一优先使用 Context7 获取框架或库的官方文档，使用 GitHub Issues / Discussions / PR 查真实案例与修复思路；当现象反直觉时，不要只凭本地经验判断。
- When presenting the diagnosis, clearly separate confirmed facts, likely inferences, and external references that inspired the hypothesis.
- 输出诊断结论时，要明确区分：已经确认的事实、基于证据的推断，以及作为启发来源的外部案例。

## Test Cleanup
测试清理

- Always run browser-based tests in headless mode unless the user explicitly requests otherwise.
- 涉及浏览器的测试默认一律使用 headless 模式运行，除非用户明确要求使用有界面模式。
- Before starting any backend or dev server for browser automation, first check whether the required service is already running in the background, and reuse the existing one when possible.
- 在开始浏览器自动化前，如需后端或 dev server，必须先检查目标服务是否已经在后台运行；如果已经启动，优先复用现有服务。
- Do not start background services on your own when browser automation can proceed with an already-running service, to avoid conflicting with services the user has already started.
- 做浏览器自动测试时，不要擅自再启动后台服务；如果用户已经启动了服务，应避免重复启动和端口冲突。
- When starting browser-based tests, do not keep backend services running in the foreground; start them in the background or use a detached process so the test workflow does not get stuck.
- 开始浏览器测试时，不要让后端服务以前台阻塞方式运行；如需启动后端，必须放到后台或使用脱离终端的方式，避免测试流程被卡住。
- After completing tests, clean up any cache files, temporary artifacts, and test output created during the run; do not leave junk in the repository.
- 测试完成后，清理本次运行产生的缓存文件、临时产物和测试输出，不要把垃圾文件留在仓库里。
- After browser-based tests finish, terminate any leftover backend, browser, driver, or test-related processes started for the run so they do not accumulate and slow down or freeze the machine.
- 浏览器测试结束后，清理本次启动但未退出的后端、浏览器、驱动或相关测试进程，避免残余进程累积导致电脑变卡甚至卡死。
