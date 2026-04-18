# Scrollbar Press Glow Design

## Goal

Add a restrained pressed and dragging feedback effect to all scrollbars so mouse interaction is easier to notice without changing the current low-noise desktop UI direction.

## Scope

This change covers:

- global native scrollbars styled in `web/src/index.css`
- the shared `ScrollArea` primitive in `web/src/components/ui/scroll-area.tsx`

This change does not cover:

- layout changes
- new scrollbar sizing rules
- feature-local scrollbar redesigns
- high-saturation glow or decorative effects

## Confirmed Direction

The feedback should stay subtle and tool-like:

- default state remains close to the current thin monochrome scrollbar
- hover can slightly increase thumb contrast
- pressed state adds a soft glow and a small contrast lift
- dragging keeps the glow visible until pointer release
- release fades back smoothly to the resting state

The interaction must continue to match `DESIGN.md`:

- dark-first and light-mode compatible
- monochrome or near-monochrome
- low visual noise
- compact and practical rather than expressive

## Implementation Approach

Use a shared styling approach instead of feature-local overrides.

### Native Scrollbars

Update `web/src/index.css` so WebKit scrollbars gain:

- a subtle hover state on the thumb
- a visible `:active` pressed state
- a soft outer glow using neutral foreground or border-derived color
- reduced-motion-safe transitions on color and shadow only

Firefox should keep its existing thin scrollbar behavior unless a matching pressed effect can be added without introducing a separate complexity path.

### Shared ScrollArea

Update `web/src/components/ui/scroll-area.tsx` so the Radix scrollbar thumb gains:

- a slightly stronger hover state
- a pressed and dragging visual state that matches native scrollbars closely
- state-driven classes using Radix data attributes where available
- no JavaScript drag tracker unless CSS state is insufficient

## Accessibility And Motion

- Keep the scrollbar easy to perceive during drag without relying on color alone; the glow should be paired with a small contrast increase.
- Respect `prefers-reduced-motion` by minimizing or removing transitions.
- Do not remove existing keyboard or pointer behavior.

## Acceptance Criteria

This change is correct when:

- native scrollbars show a subtle glow while the thumb is pressed
- shared `ScrollArea` scrollbars show the same interaction language
- the effect is visible during mouse drag, not only on hover
- the result stays visually restrained in both dark and light themes
- no feature components need local scrollbar styling for this effect
