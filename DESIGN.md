# UI Design Specification

## 1. Design Positioning

The interface should not feel like a flat white landing page, and it should not drift into a high-saturation neon style. Its core character is:

- A desktop-first AI chat workspace
- Dark by default, with full light-theme support
- Mostly neutral in tone, with restraint instead of strong brand-color dominance
- Layering built through dark surfaces, subtle borders, blur, and shadow
- Content-first, with very little decoration and quiet, short interaction feedback

Visual keywords:

- `neutral`
- `dense but calm`
- `desktop workspace`
- `soft glass panel`
- `low-saturation grayscale`

## 2. Theme System

The interface uses a dual-theme system:

- Default theme: dark
- Optional theme: light
- When no explicit theme is set, follow `prefers-color-scheme`

Theme-switching requirements:

- Only switch tokens; do not change layout structure
- Preserve the same visual hierarchy across dark and light themes
- The light theme must not be a simple inverted dark theme; it must preserve the same panel logic, border logic, radius logic, and shadow logic

## 3. Design Tokens

### 3.1 Typography

- `--font-body`: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `"Helvetica Neue"`, `"PingFang SC"`, `"Hiragino Sans GB"`, `"Microsoft YaHei"`, `Arial`, `sans-serif`
- `--font-display`: same as `--font-body`
- `--font-mono`: currently also the same as `--font-body`

Notes:

- Use `Inter` consistently across the system; do not introduce a highly stylized display typeface
- Distinguish code and prose mainly through containers, borders, backgrounds, and size, not through aggressive font contrast

### 3.2 Dark Theme Core Colors

- Page background `--bg`: `#000000`
- Elevated background `--bg-elev`: `#0a0a0a`
- Panel background `--bg-chat`: `#161616`
- Primary surface `--surface`: `rgba(20, 20, 20, 0.92)`
- Solid surface `--surface-solid`: `#141414`
- Glass surface `--glass`: `rgba(20, 20, 20, 0.55)`
- Strong glass surface `--glass-strong`: `rgba(20, 20, 20, 0.78)`

Borders:

- `--border`: `rgba(255, 255, 255, 0.05)`
- `--border-strong`: `rgba(255, 255, 255, 0.09)`
- `--border-accent`: `rgba(255, 255, 255, 0.16)`
- `--border-subtle`: `rgba(255, 255, 255, 0.03)`

Text:

- `--text`: `#e4e4e4`
- `--text-muted`: `#888888`
- `--text-dim`: `#555555`

Neutral emphasis:

- `--accent`: `#a0a0a0`
- `--accent-strong`: `#d4d4d4`
- `--accent-glow`: `rgba(255, 255, 255, 0.06)`

Semantic colors:

- Running / warning `--warm`: `#f97316`
- Strong warning `--warm-strong`: `#ea580c`
- Error `--danger`: `#ef4444`
- Success `--panel-status-success`: `#22c55e`

State fills:

- `--bg-hover`: `rgba(255, 255, 255, 0.06)`
- `--bg-active`: `rgba(255, 255, 255, 0.08)`
- `--bg-subtle`: `rgba(255, 255, 255, 0.03)`

### 3.3 Light Theme Core Colors

- Page background `--bg`: `#f5f5f7`
- Elevated background `--bg-elev`: `#ffffff`
- Panel background `--bg-chat`: `#ffffff`
- Primary surface `--surface`: `rgba(255, 255, 255, 0.92)`
- Solid surface `--surface-solid`: `#ffffff`

Borders:

- `--border`: `rgba(0, 0, 0, 0.08)`
- `--border-strong`: `rgba(0, 0, 0, 0.12)`
- `--border-accent`: `rgba(0, 0, 0, 0.18)`

Text:

- `--text`: `#1d1d1f`
- `--text-muted`: `#86868b`
- `--text-dim`: `#b0b0b5`

Neutral emphasis:

- `--accent`: `#424245`
- `--accent-strong`: `#1d1d1f`
- `--accent-glow`: `rgba(0, 0, 0, 0.04)`

### 3.4 Shadows and Blur

Dark theme:

- `--shadow-xs`: `0 1px 3px rgba(0, 0, 0, 0.4)`
- `--shadow-sm`: `0 4px 16px rgba(0, 0, 0, 0.5)`
- `--shadow-md`: `0 12px 40px rgba(0, 0, 0, 0.6)`

Light theme:

- `--shadow-xs`: `0 1px 2px rgba(0, 0, 0, 0.05)`
- `--shadow-sm`: `0 4px 12px rgba(0, 0, 0, 0.06)`
- `--shadow-md`: `0 12px 32px rgba(0, 0, 0, 0.08)`

Modal layer:

- `--modal-overlay`: dark `rgba(6, 8, 12, 0.62)`, light `rgba(245, 247, 250, 0.82)`
- `--modal-shadow`: large and soft; do not use aggressive outer glow

Rules:

- Panels may use `backdrop-filter: blur(...)`
- Shadows are allowed, but they must stay soft, low-contrast, and hierarchy-driven; do not create neon-like glow

### 3.5 Border Radius

- `--radius-xl`: `20px`
- `--radius-lg`: `16px`
- `--radius-md`: `12px`
- `--radius-sm`: `8px`
- Pill / round buttons: `999px`
- Image radius: `16px`

Usage:

- App shell, primary panels, modals: `20px`
- Inputs, edit panels, secondary containers: `16px`
- Tool buttons, status blocks, code blocks: `8px` to `12px`
- Circular icon buttons: `34px` diameter with `50%` or `999px` radius

## 4. Typography Rules

Typography should be clear, moderately dense, and stable for long reading.

### 4.1 Type Scale

Confirmed core sizes:

- Empty-state title: `28px / 700`
- Markdown `h1`: `22px / 600`
- Markdown `h2`: `18px / 600`
- Markdown `h3`: `16px / 600`
- Config-panel title: `18px / 700`
- Main chat body: `14px`
- Brand title: `14.5px / 700`
- General supporting text: `12px` to `13px`
- Labels / statuses / tool-button text: `11px` to `12px`

### 4.2 Text Style

- Body copy should generally stay between `1.5` and `1.8` line-height
- Secondary text should be weakened through `--text-muted` and `--text-dim`, not by shrinking it too aggressively
- Hierarchy should come from weight and spacing, not from saturated color
- Explanatory copy should stay short; do not stack long paragraphs inside panels

## 5. Layout Rules

### 5.1 App Shell

- Outermost container max width: `1440px`
- Main chat shell max width: `1260px`
- Outer horizontal padding: `12px`
- Desktop vertical offset: `3vh`
- Main viewport height: `94vh`

Layout characteristics:

- One centered shell; do not turn it into a portal-style multi-column home page
- Topic sidebar on the left, conversation area on the right
- The whole interface should feel like one continuous workspace, not a collage of separate cards

### 5.2 Sidebar and Conversation Area

- Expanded sidebar width: `264px`
- Collapsed sidebar width: `68px`
- Conversation area fills the remaining space
- Both panels share one outer silhouette, while the touching inner corners are removed

Specific requirements:

- `topics-panel` keeps only left-side outer radii
- `conversation-panel` keeps only right-side outer radii
- Do not introduce an obvious gap between them

### 5.3 Content Width

- Conversation content max width: `900px`
- Composer max width: `900px`
- Standard turn max width: follow the conversation content width
- Chat horizontal gutter: `24px`

Notes:

- Body content should not span the full conversation area; keep it centered and restrained for stable reading

## 6. Component Rules

### 6.1 Primary Panels

Primary chat panels and sidebar panels must follow these rules:

- Use `--bg-chat` as the panel background
- Use a subtle 1px border
- Use `20px` outer radius
- Use soft medium-to-large shadow
- Support glass-like blur

Do not:

- Use high-contrast outlines
- Use exaggerated floating shadows
- Overlay complex textures on panel surfaces

### 6.2 Top Bar

The top bar is a lightweight title bar, not a marketing navigation bar.

Rules:

- Minimum height: `60px`
- Horizontal layout
- Model information centered
- Interface actions on both sides
- Background should be transparent or near-transparent; do not create a heavy header slab

Model selector button:

- Height around `28px`
- Pill radius
- Transparent by default
- Hover only adds a subtle background change
- Use caret rotation as the open/close cue

### 6.3 Sidebar

Sidebar controls should feel small, light, and precise.

Rules:

- Top control buttons use a `34px` diameter
- Default background is transparent or barely visible
- Border uses `--border-strong`
- Text and icon color defaults to `--text-muted`
- `:active` may scale down slightly to `0.94`

Sidebar behavior:

- Support collapse
- Keep only essential controls when collapsed
- Use scrim + drawer behavior on mobile

### 6.4 Message Area

Message presentation should be content-first and should not turn into a wall of heavy chat bubbles.

User messages:

- Right-aligned
- Bubble background uses `--bg-active`
- Radius `16px`
- Padding `10px 14px`
- No obvious outline or shadow

Assistant messages:

- Transparent by default
- Do not wrap them in heavy cards
- Header row shows model / service information
- Footer carries actions like copy, retry, and delete

Multi-model comparison:

- Allow two columns on desktop
- Collapse to one column below `1200px`

### 6.5 Composer

The composer is a key action panel and must stay stable, restrained, and extensible.

Rules:

- Outer container max width `900px`
- Panel radius `16px`
- Use a light border plus an inner pseudo-surface for subtle depth
- Do not use a glowing blue input field
- Text area minimum height `52px`
- Text area maximum height `200px`
- Input text size `14px`
- Placeholder must use a softened neutral color

Composer bottom toolbar:

- Button height `34px`
- Standard tool-button radius `10px`
- Background uses `--bg-subtle`
- Hover moves to `--bg-hover`
- Icon-only and text buttons must share the same visual system

### 6.6 Buttons

Base button:

- Default text size `13px`
- Font weight `600`
- Radius `10px`
- Padding `8px 16px`

Primary button `btn-primary`:

- Background `--accent-strong`
- Text uses strong contrast against a darker base
- Hover may slightly increase brightness and shadow

Secondary button `btn-secondary`:

- Background `--bg-subtle`
- 1px border
- Default text color `--text-muted`

Floating round button:

- Size `34px`
- Pill or true round shape
- `blur(16px)` is allowed
- Use for floating actions like close preview, image actions, or scroll-to-bottom

Danger button:

- Use only for delete, clear, or destructive confirmation flows
- Do not spread it into routine actions

### 6.7 Tags and Status

Status blocks and light tags should stay in a low-saturation visual system.

Rules:

- Default status text size `12px`
- Radius `12px`
- Left dot size `7px`
- Use green for success
- Use orange for running
- Use red for error
- Use neutral light gray for complete / idle states

Model tags / chips:

- Pill style
- Subtle 1px border
- Very faint background
- Text must not become brighter than the main content

### 6.8 Markdown and Content Rendering

Chat output and preview content should follow one consistent content style.

Headings:

- `h1`: `22px`
- `h2`: `18px`
- `h3`: `16px`
- `h1` and `h2` include a bottom divider

Paragraphs and lists:

- Paragraph bottom spacing `12px`
- List left padding `24px`

Inline code:

- Use a subtle background
- Padding `2px 6px`
- Radius `4px`

Code blocks:

- Use `--bg-active` or `--bg-subtle` as background
- Use a subtle 1px border
- Container radius `8px` to `10px`
- Toolbar includes language label and copy / preview actions

Blockquotes:

- Left border uses `--accent`
- Text uses `--text-muted`
- Italic is allowed

Links:

- Use `--accent-strong`
- Add underline on hover

Tables:

- Allow horizontal scrolling
- Use subtle cell borders
- Use a very light table-header background

Images:

- Radius `16px`
- Do not frame them with a thick border treatment

### 6.9 Config Panels and Modals

The config panel is a full work area, not a tiny dialog.

Rules:

- The outer overlay uses blur
- `#configModal` behaves like a near-full shell panel on desktop
- Max width follows the app shell, and desktop runtime may tighten it to `1160px`
- Panel radius `20px`
- Keep clear `header / tabs / content / footer` structure
- The content area scrolls independently

Inside config panels:

- Tabs use horizontal pill / light-button styling
- Status strips use pill-shaped `status-pill`
- On mobile, form controls should drop strong focus glow
- On smaller screens, the config panel should switch directly to a full-screen layout

Confirmation dialogs:

- Use a tighter width around `420px`
- Keep the structure simple
- Destructive confirmation buttons may use stronger contrast, but do not flood the dialog with large red surfaces

## 7. Interaction and Motion

Motion should be short, light, and only serve state changes.

Timing references:

- Quick press-scale feedback: `0.12s` to `0.16s`
- Hover / color / border transitions: `0.18s` to `0.2s`
- Composer or edit-panel state transitions: `0.24s`
- Sidebar expand / collapse: `420ms`

Interaction requirements:

- Hover should primarily change background, border, and text color
- Active state may use very slight scaling
- Focus should use a low-intensity ring or remove glow entirely to preserve the calm visual tone
- Scrollbars stay hidden by default and appear during interaction
- Shimmer should be reserved for generating / connecting states; do not overuse it

## 8. Responsive Rules

Confirmed key breakpoints:

- Below `1200px`: multi-assistant layouts collapse to one column
- Above `901px`: config panels use desktop grid layout
- Below `900px`: config panels switch to full-screen mobile layout
- Below `1100px`: top spacing and empty-state title scale down slightly

Mobile requirements:

- The web container fills the viewport and drops desktop outer margins
- The main shell may drop large radii, shadows, and blur in favor of edge-to-edge layout
- The sidebar becomes a drawer with a scrim
- Form controls must not go below `16px`, to avoid unwanted browser zoom on focus

## 9. Do / Don't

### Do

- Use neutral gray-black as the primary visual language
- Preserve the desktop-workspace layout and stable content width
- Use the `20 / 16 / 12 / 8 / pill` radius scale consistently
- Keep borders and shadows low-contrast
- Make interaction feedback rely on subtle background changes
- Maintain readability and hierarchy consistency across dark and light themes
- Let the message area, composer, and config panels share one token system

### Don’t

- Do not use the old pure-white Ollama-like style that previously existed in this repository as a baseline
- Do not introduce high-saturation brand colors as large-area backgrounds
- Do not add exaggerated glassmorphism, neon outlines, or colorful glow
- Do not turn the chat area into a marketing homepage with hero + feature blocks
- Do not create a wall of heavy message cards
- Do not introduce oversized titles or highly decorative type
- Do not make hover, focus, or active feedback overly aggressive
- Do not make the light theme a mechanical color inversion

## 10. Prompts for Implementation Agents

If you want to keep implementing this visual system, you can use prompts like these:

- "Build a desktop-first AI chat workspace with a dark default theme, neutral gray-black colors, and low-contrast glass panels. Avoid strong brand-color dominance."
- "Use a main shell with max width 1260px, a 264px topic sidebar on the left, and a conversation area on the right. The two panels should read as one continuous surface."
- "Keep conversation body content centered with a max width of 900px. User messages are right-aligned bubbles; assistant messages stay in a transparent text-flow layout."
- "Design the composer as a lightly glassy edit panel with 16px radius, 52px starting height, and a bottom toolbar with 34px-tall buttons."
- "Keep action buttons neutral, with subtle hover states and slight press-scale feedback. Do not use strong blue focus glow."
- "Treat the config panel as a large work-area modal on desktop and a full-screen panel on mobile."
