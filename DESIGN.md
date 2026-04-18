# UI Design Specification

## 1. Positioning

This document describes the UI style currently implemented in this repository and turns that style into the default standard for future work.

It is descriptive first and prescriptive second:

- It records the design patterns that are already consistent in the shipped UI.
- It defines how new UI work should stay aligned with those patterns.
- It should not be treated as an aspirational redesign brief for a different product.

When current code and older design descriptions conflict, the shipped UI takes precedence unless a new design task explicitly changes the direction.

This repository is a desktop-first AI client. The interface should read as focused utility software, not as a marketing site, visual experiment, or branded showcase.

## 2. Source Of Truth

Use the following order when judging design decisions:

1. Current shipped UI in the repository
2. Shared tokens and shared UI primitives
3. This document
4. Older screenshots, comments, and historical descriptions

Practical implications:

- Do not force new work to match outdated design notes if the current implementation has already moved on.
- Do not invent local visual systems inside feature components when the shared UI layer already defines a pattern.
- If a new pattern is needed, it should be generalized through shared tokens or shared primitives before becoming feature-specific styling.

## 3. Core Visual Direction

The UI is a restrained desktop-first AI client with a monochrome base.

Core characteristics:

- Dark mode is the visual baseline.
- Light mode must remain supported.
- The overall mood is quiet, practical, and tool-like.
- Visual hierarchy comes from contrast, spacing, and typography weight more than from color.
- Surfaces should stay low-noise, with limited shadow depth and restrained layering.

The interface should feel like clean utility software:

- not a glassmorphism showcase
- not a high-saturation branded product
- not an editorial landing page
- not a dense IDE-style control wall

## 4. Theme And Token Strategy

### 4.1 Theme Model

- The app uses explicit class-based theming through `.dark` on the root document.
- Do not assume `prefers-color-scheme` is the active source of truth.
- Dark and light themes must keep the same structure and component logic.
- Theme changes should primarily happen through token changes, not layout rewrites.

### 4.2 Core Semantic Tokens

The current token system is defined in `web/src/index.css` and exposed through the Tailwind theme.

Core semantic tokens:

- `background`
- `foreground`
- `card`
- `card-foreground`
- `muted`
- `muted-foreground`
- `border`
- `accent`
- `accent-foreground`
- `primary`
- `primary-foreground`
- `success`
- `warning`
- `danger`

Rules:

- Reuse existing semantic tokens before introducing new global tokens.
- Avoid hardcoded one-off colors inside feature components when an existing semantic token expresses the same meaning.
- Treat `success`, `warning`, and `danger` as restrained utility states, not bright branding accents.

### 4.3 Color Behavior

Light theme:

- Near-white background
- Black or near-black foreground
- Soft neutral gray surfaces

Dark theme:

- Compressed grayscale range
- Low visual noise
- Subtle borders and restrained contrast shifts

Across both themes:

- Borders should stay low-contrast.
- Primary emphasis should usually come from contrast inversion, not accent color fills.
- Large saturated color fields do not belong in the base UI language.

### 4.4 Typography Tokens

The current typography stack is the standard for future work:

- Body: `Geist Variable` with CJK system fallbacks
- Display: same family stack as body
- Mono: `Geist Mono Variable` with standard monospace fallbacks

Do not introduce a decorative display typeface unless a future product direction explicitly changes the visual language.

### 4.5 Radius, Shadow, And Blur

Current direction:

- Controls are rounded and compact.
- Pills are common for buttons, small controls, and option rows.
- Medium radii are used for cards, bubbles, popovers, and secondary containers.
- Larger radii are reserved for major shells such as the composer and settings dialog.

Shadow and blur rules:

- Use no shadow or a very soft shadow by default.
- Blur is acceptable for overlays and large modal shells.
- Heavy floating cards, dramatic depth, and glow effects are out of scope.

### 4.6 Spacing

- Prefer compact desktop spacing over airy marketing-page spacing.
- Use small gaps for control clusters.
- Use medium gaps for section separation.
- Use larger vertical spacing only between major chat blocks or modal sections.
- Avoid oversized empty hero spacing in the main app shell.

If a component needs stronger emphasis, first increase contrast, border treatment, or text weight before adding more color.

## 5. Typography Rules

Typography should support long-form reading and tool-oriented density without feeling cramped.

### 5.1 Body Text

- Default body copy sits around `14px`.
- Body text should maintain comfortable reading line height.
- The app should preserve readable density for both prose and code-adjacent content.

### 5.2 Heading Scale

The current markdown scale is the baseline:

- `h1`: `22px`
- `h2`: `18px`
- `h3`: `16px`
- `h4`: `15px`

Rules:

- Headings should stay compact and document-like.
- They should not drift into oversized editorial presentation.
- Hierarchy should come from spacing and weight rather than strong color.

### 5.3 Font Usage

- Use body font for most UI text.
- Use display font for headings, dialog titles, and similar structural labels.
- Use mono font for code, command-like strings, model IDs, and other machine-shaped text.

## 6. Layout Rules

### 6.1 App Shell

- The app is a full-height desktop layout.
- The root shell is a two-column structure.
- The left side is a fixed-width session sidebar.
- The right side is a flexible chat area.
- The shell uses the page background directly rather than a giant framed outer panel.

Do not turn the application into:

- a marketing homepage with hero sections
- a detached multi-card dashboard
- a dense multi-pane IDE frame unless product requirements explicitly change

### 6.2 Header

- The header is minimal and utility-first.
- It mainly hosts theme toggle, settings access, and desktop window controls.
- It should stay visually quiet.
- It must not become a branded navigation bar.

### 6.3 Sidebar

- The sidebar is narrow, persistent, and functional.
- It uses plain background treatment instead of elevated framing.
- Directory groups and thread rows define the main information structure.
- Selection and hover should be expressed through subtle background changes.

### 6.4 Chat Column

- The conversation area uses a centered reading column.
- Content width should remain compact and stable.
- It should feel closer to a chat reader than to a wide document editor.
- Welcome and conversation states should share the same centered content logic.

### 6.5 Composer Placement

- In conversation mode, the composer sits below the scrollable message region.
- It shares the same horizontal padding and width logic as the chat column.
- In welcome state, it belongs inside the centered empty-state stack rather than being docked to the bottom edge.

### 6.6 Dialogs

- Settings is a large modal work surface with internal scrolling.
- Approval is a smaller confirmation-style dialog.
- Overlays may blur the background.
- Dialog surfaces themselves should remain restrained, readable, and neutral.

## 7. Component Rules

### 7.1 Shared Primitive Rule

Shared UI primitives are the default starting point for future work.

Prefer reusing:

- buttons
- inputs
- textareas
- selects
- comboboxes
- scroll areas
- overlays

Do not create feature-local replacements unless the shared primitive cannot reasonably support the requirement.

### 7.2 Buttons

- Buttons are rounded and compact.
- Primary buttons use contrast inversion rather than brand color.
- Secondary and ghost buttons stay quiet.
- Hover emphasis should come from subtle background and text shifts.
- Small icon buttons should remain visually balanced in circular or near-circular containers.

### 7.3 Inputs And Textareas

- Form controls inherit the app typography.
- Controls should remain visually light and neutral.
- Borders should stay subtle.
- Strong blue focus rings are not part of this UI system.

Composer textarea rules:

- It should feel embedded into the composer shell.
- It should not look like a separate heavy field inside another card.

### 7.4 Selects, Comboboxes, And Popovers

- Floating selection surfaces use muted backgrounds, soft borders, and moderate radii.
- Option rows highlight through quiet fill changes.
- Search-capable pickers should preserve the same monochrome control language.
- Menus and popovers should feel compact and efficient rather than spacious or decorative.

### 7.5 Session List

- Directory groups use small, low-contrast labels.
- Thread rows stay compact.
- The active state uses restrained background emphasis.
- Destructive actions should usually remain secondary and reveal on hover, focus, or in overflow menus.

### 7.6 Composer

- The composer is one of the few larger rounded surfaces in the app.
- It should group text entry, attachments, execution mode, model picker, reasoning control, and send or stop action into one cohesive block.
- It should feel dense and efficient, not oversized and decorative.

### 7.7 Settings Surfaces

- Settings should feel like one coherent tool window.
- Section separation should rely on spacing and lightweight dividers.
- Avoid stacking the settings experience into a wall of unrelated cards.
- Service lists and detail panes should read as parts of one work surface.

### 7.8 Approval Dialog

- The approval dialog uses a compact confirmation pattern.
- Risk information and command preview should be readable and structured.
- The dialog should not become dramatic or overly color-coded.

## 8. Content Rendering Rules

### 8.1 User Messages

- User turns are right-aligned compact bubbles.
- They should stay visually lighter than typical consumer chat bubbles.
- Use restrained fill, compact padding, and modest radius.
- Supporting actions such as copy may stay hidden until hover or focus.

### 8.2 Assistant Messages

- Assistant output should read like flowing content, not like a giant bordered response card.
- The primary answer surface is typography plus spacing.
- Standard assistant output should avoid unnecessary framing.
- Errors may use a soft container when needed.

### 8.3 Markdown

Markdown should stay compact, readable, and consistent with the rest of the UI.

Rules:

- Keep headings modest and document-like.
- Preserve readable paragraph spacing.
- Keep inline code and code blocks neutral.
- Avoid flashy syntax-driven presentation.
- Tables, quotes, and links should remain readable without becoming visually heavy.

### 8.4 Tool Output And Timeline Items

- Thinking blocks, tool cards, and related timeline items may use containers.
- Those containers must stay within the same monochrome low-contrast surface language.
- Tool output is part of the conversation flow, not a separate dashboard.

### 8.5 Streaming

- Streaming text should prioritize legibility and continuity.
- Motion should feel tied to content arrival, not ornamental animation.
- Limited shimmer is acceptable for active thinking or title regeneration.
- Shimmer must not become a pervasive motif across the product.

### 8.6 Empty And Welcome States

- Welcome content should stay short, centered, and functional.
- It should guide the user toward action.
- It should not become a branded hero screen.

Do not:

- wrap every assistant message in a heavy card
- turn tool output into colorful dashboard tiles
- inflate the welcome state into a homepage-like layout

## 9. Interaction, Motion, And Accessibility

### 9.1 Interaction

- Hover states should be subtle.
- Most hover feedback should come from neutral background or foreground changes.
- Focus states must remain visible.
- Focus treatment should stay calm rather than glow-heavy.
- Secondary actions may reveal on hover, but essential actions must remain keyboard reachable.

### 9.2 Motion

Motion should stay short, practical, and low-drama.

Current motion vocabulary includes:

- fade-up entrance
- collapsible open and close transitions
- loading spin
- limited shimmer for active generation-related states

Rules:

- Reuse this motion vocabulary before introducing a new one-off animation style.
- Motion should support state change and readability, not decoration.

### 9.3 Reduced Motion

- Respect `prefers-reduced-motion`.
- Streaming and shimmer-like effects must degrade gracefully.
- Reduced-motion behavior should preserve clarity without relying on animated emphasis.

### 9.4 Accessibility

- Preserve semantic buttons, dialogs, labels, and keyboard patterns.
- Do not hide essential information behind hover-only interaction.
- Maintain readable contrast within the restrained grayscale palette.
- Long-form chat content must remain readable for extended sessions.

### 9.5 Scroll Behavior

- Scroll areas should stay visually minimal.
- Reduced or hidden scrollbar styling is acceptable when navigation remains clear in practice.
- Long dialogs and long conversations should scroll independently where appropriate.

## 10. Responsive And Runtime Notes

- This product is desktop-first.
- The primary runtime target is the Tauri desktop app.
- Browser rendering should remain functional for development.
- The interface should still reflect the desktop product rather than a public web page.

Responsive rules:

- Preserve content continuity first.
- Preserve control usability second.
- Do not reshape the app into a mobile-first shell unless product requirements explicitly change.
- On narrower widths, simplify without introducing decorative adaptation.

## 11. Do / Don’t

### Do

- Use a monochrome or near-monochrome base.
- Keep dark mode as the visual baseline.
- Let spacing, contrast, and type weight carry hierarchy.
- Keep the chat column compact and readable.
- Reuse shared primitives and shared tokens.
- Preserve the desktop utility-software character of the app.

### Don’t

- Do not introduce high-saturation brand colors as large surfaces.
- Do not turn the app into a marketing homepage.
- Do not build a wall of heavy assistant cards.
- Do not add dramatic shadows, glow, or neon edges.
- Do not introduce unrelated visual systems inside individual features.
- Do not make hover, focus, or active behavior aggressive.

## 12. Direction For Future Work

When adding or revising UI in this repository, the default question should be:

"Does this look like it belongs to the current Prism-Agent desktop client?"

If the answer depends on brighter color, heavier framing, louder animation, or a different layout model, the change is probably drifting away from the current design system.
