# Welcome Subtitle Design

## Context

The welcome state in the chat panel currently shows a single heading:

- `准备好开始了吗？`

This is clear, but it does not yet express the product tone the user wants for the first-run empty state. The requested adjustment is to add a subtitle that feels human, warm, and dependable without turning the interface into a marketing-style hero section.

This change must stay aligned with the existing desktop-first utility UI defined by the shipped interface and `DESIGN.md`.

## Goal

Add a secondary line beneath the existing welcome heading so the empty state feels like a calm, reliable assistant inviting the user to begin.

## Approved Copy

- Heading: `准备好开始了吗？`
- Subtitle: `把你想做的事告诉我，我们一起把它理清楚。`

## Design Direction

The subtitle should feel:

- warm, but not cute
- human, but not chatty
- dependable, but not stiff

It should read like a capable assistant offering help, not like product branding or promotional copy.

## Layout

In the welcome state stack inside the centered chat column:

1. Keep the current heading in place.
2. Insert the subtitle directly below the heading.
3. Keep the existing centered composition.
4. Maintain compact vertical spacing so the welcome state still feels like tool UI rather than a landing page.

## Visual Rules

The subtitle should use restrained styling consistent with the current design system:

- centered alignment
- smaller size than the heading
- lower contrast than the heading through existing semantic text color treatment
- no accent color emphasis
- no decorative border, badge, card, or illustration

The heading remains the primary focal point. The subtitle only supports it.

## Accessibility And Content Rules

- The subtitle must remain plain text in the DOM.
- It should wrap naturally on narrower widths without forcing manual line breaks.
- The copy should remain readable in both dark and light themes through semantic colors already used by the app.

## Scope

In scope:

- welcome-state subtitle copy
- minimal spacing and text-style adjustment needed to support that copy

Out of scope:

- changing the main heading copy
- redesigning the welcome layout
- adding icons, cards, animations, or illustrations
- changing the conversation-state composer layout

## Implementation Notes

The change should be made in the welcome-state branch of `web/src/agent/AgentChatPanel.tsx`, using existing utility classes and semantic tokens. Avoid introducing new global tokens or feature-local visual systems for this small copy change.

## Testing

Manual verification is sufficient for this change:

- confirm the subtitle appears only in the welcome state
- confirm it remains visually secondary to the heading
- confirm the text remains readable in light and dark themes
- confirm the layout still feels compact on typical desktop widths
