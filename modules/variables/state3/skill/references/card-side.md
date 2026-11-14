# Connecting a 3.0 card panel or task

## Which API runs where

| Caller | State API | Current variables |
| --- | --- | --- |
| Assistant RunJavaScriptApi | `st.state3` | `inspect()` for inspection and trials |
| Card task in the host page | `window.LWB_StateV3` | `SillyTavern.getContext().variables.local.get(root)` |
| Same-origin message iframe | `window.parent.LWB_StateV3` | `window.parent.SillyTavern.getContext().variables.local.get(root)` |

The assistant's `st` namespace is not an injected card-panel global. The public API is present while the variable module is loaded; writes still require 3.0 mode and an enabled chat. Group chats are not supported by this card-owned API. Show an actionable unavailable-state message instead of silently falling back to plain variable writes. Reading a native root for display does not initialize it or establish ownership.

Use the shared [refresh guidance](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md#state-panel-refresh>) for display and [message buttons](<../../../../card-workspace/skill/references/xiaobaix-capabilities.md#message-buttons>) for ordinary player text. Pure UI preferences remain outside the managed roots.

<a id="submission"></a>
## Submitting an action and interpreting the result

`await api.apply(input, options)` submits an array of operations/actions. `await api.preview(input, options)` calculates the same result without changing the chat. Both accept optional `index` (the host chat-array message index), `source`, `replace`, `stage` and `signal`; `preview` also accepts simulated `prepared` data.

With no index, the target is the most recent non-user, non-system reply; if there is none, it is the last message. An explicit index targets that message's selected swipe. Writes and undo are limited to the latest USER or latest AI message; ordinary appends require no later recorded settlements. The iframe's visual location does not select its target.

Each ordinary `apply` call appends another settlement (`source:'api'` by default). Two calls can spend or grant resources twice. `replace:true` replaces gameplay settlements on the target floor and its suffix, including panel operations, while preserving the selected opening's starting values: the API rolls those gameplay changes back and confirms saving before executing the new submission. Failed execution leaves that rollback in place. Preview calculates against the rollback baseline without publishing it. The updater follows the same rollback-first journey and labels its receipts `model:before` or `model:after`. Card tasks use their own source labels; `source:'opening'` is reserved for 3.0 opening initialization. A call without the `stage` option ignores the stage assignments of actions and fields; passing `stage` applies the same stage limits as the model. Either way, direct writes still need `direct: true`, and actions still obey their parameters, conditions, derived-value protection and final-state checks.

The click journey is: read the current state → await one submission → inspect its result → reread the current native value → show feedback. Keep only the clicked operation pending while it runs; a timer refresh must not re-enable it mid-submit. The host refuses writes during story generation. Catch thrown/rejected calls as well as returned failures; not every unavailable-state error comes back as a result object.

| Result | Meaning | What the panel does |
| --- | --- | --- |
| `ok:false`, with `diagnostics` | None of the submitted changes took effect; with `replace:true`, the gameplay rollback is already published | Show the cause; no successful subset needs resending |
| `ok:true`, `committed:true`, `saved:true` | Values changed and saving succeeded | Show actual changes, or no change when `changes` is empty |
| `ok:true`, `committed:true`, `saved:false`, with `persistence` | Values already changed, save not confirmed | Show both facts; offer `retrySave()` instead of repeating `apply` |
| `ok:true`, `committed:true`, no `saved` field, with a normal before receipt | Values and receipt are published for prose; SillyTavern owns the upcoming chat save | Show the outcome, not a save failure or confirmed save |
| Preview with `committed:false` | Calculated without changing the chat | Do not label it saved or use it as the live panel state |

`changes` contains actual field/element differences, not full old and new arrays; `provenance` explains inputs, actions, corrections and triggers. Render these differences or the relevant fields instead of dumping two complete inventories. A correction can make an increment's actual effect smaller than the requested amount. Reread for the final display, including after failure; a concurrent restore or native edit can have changed the current state.

`diagnostics` may also accompany a successful commit, for example a notification problem. Such a warning, a failed redraw, or a lost response is not permission to replay the action. Inspect state/history if the outcome is unknown. `retrySave()` retries the pending save for the current chat without rerunning gameplay; it can reject when the pending save no longer matches the current state. Recheck the current result in that case. Do not automatically resend on a different chat or swipe.

`lastResult()` returns the most recent result of `apply`, `undo`, `enable`, a model update or a swipe/deletion restoration, including failures, or `undefined` after it is cleared by a chat change or rewind. Previews never replace it. Check `ok`, `committed` and `receipt` before relying on it. The example uses `receipt.id` (the settlement record's id) and `saved` to remove an outdated retry button when a newer result replaces it; this feedback is kept in the panel, not saved as a gameplay variable.

If the button already settled an event, its prose summary is a recap, not a second model instruction to settle it. Explain that division in the relevant update instructions. Distinct new story events may still affect the same fields.

## A complete example

The [camp definition](<examples/camp/definition.json>) and [panel](<examples/camp/panel.html.txt>) implement a rest button, actual stamina differences, independent refresh and save-only retry. Copy the definition into `variables/definition.json` in a new isolated example card; it declares no function files. Save it, select 3.0 and enable the test chat (new chats in 3.0 initialize automatically). Put the panel HTML inside a fenced HTML block in the greeting or a display-regex replacement. It uses the `camp` root, not the equipment starter's `hero`. Merely reading these files does not install them.

The panel reads on mount; it does not call `enable` or write initial values. It uses a local busy flag and the current chat identity, and releases its own timer on `pagehide`. Initialization belongs to the chat; reopening a panel cannot grant another rest. Copy the mechanics and feedback flow, then adapt the names and appearance to the actual card.

The [解铃会 card](<examples/jieling.md>) extends this to a whole game: player decisions in the panel, story facts from the update model, derived rooms, explained refusals, a season ending and a panel kept only on the latest message.

<a id="effects"></a>
## One-time animation, sound and notifications

One-time sound, animation and notifications belong in the card's committed script, described in [extensions](<extensions.md>). It runs only for a new settlement. A panel's apply result is for showing success/failure and refreshing values; it does not duplicate that host effect.

The host DOM event `lwb:state3:committed` is available to refresh external displays. Its detail contains the retained result, including initialization, undo and restoration, so it is not a new-action animation trigger. Register display listeners in their owning task and remove them in `onCleanup`.

Native manual edits and opening a chat need not emit that event; a current-value panel still follows the shared refresh guidance. A restored value is existing progress, not a newly earned reward.

Sources: `runtime/api.ts`, `runtime/service.ts`, `runtime/host.ts`, `types.ts` and `index.ts` (`available`, `retain`, `retrySave`), relative to `modules/variables/state3/`.

<a id="acceptance"></a>
## Acceptance in the player's journey

- Open the iframe in an initialized test chat; it shows current state without submitting anything. Mount it again and verify no initialization/action repeats.
- Click once, double-click while pending, and activate it from the keyboard. One pending interaction submits once; after it finishes, another deliberate click is a new action. The displayed difference comes from the settled result, including a cap or a no-change result.
- Reject an action and simulate a save failure separately. Rejection changes nothing; save failure shows already-changed values. Retrying saving leaves gameplay and settlement count unchanged. Failure details remain available.
- Keep the panel open while an external update, undo, swipe or reset changes the root. Remove and restore the root with the same value; the error display must recover. Clear a root or switch chats without allowing the old panel to submit into another chat.
- Test a character's different openings using [the opening workflow](<state-design.md#alternate-openings>). Test a progressed chat separately from a fresh one.
- Close the iframe or stop the task and check that its timer/listeners are gone. For sound/animation, check that redraw, restore and save-only retry do not replay a new-action effect.
