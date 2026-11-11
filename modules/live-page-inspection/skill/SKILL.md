---
name: builtin-live-page
description: Diagnose and repair a frontend card running in the chat: layout problems, unresponsive buttons, blank pages, startup errors, or saved changes missing from the page.
---

# Frontend card problems

A frontend card exists in three forms: the iframe running in the chat, the workspace draft, and the saved card. A repair moves from the running page to the source files and back to a rebuilt page.

## Finding what the user sees

- InspectPage reads the running iframes, independently of the JavaScript-execution permission setting.
- For layout problems, unresponsive buttons, blank pages, or saved changes missing from chat, inspect the live page first.
- Locate controls by the words the user sees on the page.
- A title or description shown inside a page can come from its HTML rather than the card fields. InspectPage identifies the displayed content; CardFiles open identifies the current card.
- A workspace folder left from earlier work can belong to another card.
- When the intended appearance or the problem location stays unclear after inspection, ask for a screenshot with the spot circled and what should look different.

## From symptom to source

- errors explains failures; inspect, dom and styles explain layout and element state.
- Record the affected floor and frame, then find the matching source in the card files.
- Edit with the file tools and save the affected paths through CardFiles.
- [references/verify-changes.md](references/verify-changes.md) describes rebuilding the affected floor and inspecting the replacement.

## Proving the repair

- A repair is proven by the replacement page: its layout, control state, startup errors, or the changed content now match what the user expected.
- When the saved source is already correct and the live page is stale, rebuild and inspect before changing more code.

## Actions with consequences

- Reading and rebuilding a page leave its controls untouched. Rebuilding reruns the startup scripts, so check what those scripts change first.
- Clicking a purchase, reward, send, delete, or variable-changing control needs the user's specific authorization or an isolated test state.
