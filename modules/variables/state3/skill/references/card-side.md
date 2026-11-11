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

`await api.apply(input, options)` submits an array of operations/actions. `await api.preview(input, options)` calculates the same result without changing the chat. Both accept optional `index` (the host chat-array message index), `source`, `replaceSource` and `signal`.

With no index, the target is the most recent non-user, non-system reply; if there is none, it is the last message. It is not automatically the iframe's own message or a newly sent player message. An explicit index targets that message's selected swipe. Choose the target from the gameplay journey, not from the visual location of the button. Writing into an earlier position retains later recorded results; it is not a fresh replay of the later story.

Each ordinary `apply` call appends another settlement (`source:'api'` by default). Two calls can spend or grant resources twice. A task that deliberately replaces its earlier changes can use a card-specific `source` and the same `replaceSource`; only that task's recorded changes at the target reply are replaced. The updater uses `model:before` on USER and `model:after` on AI replies to replace that stage's previous result. Use a card-specific name for card tasks, rather than sharing these updater identities. Stage assignments restrict model submissions; card-side actions without a `stage` use their normal action permissions.

The click journey is: read the current state → await one submission → inspect its result → reread the current native value → show feedback. Keep only the clicked operation pending while it runs; a timer refresh must not re-enable it mid-submit. The host refuses writes during story generation. Catch thrown/rejected calls as well as returned failures; not every unavailable-state error comes back as a result object.

| Result | Meaning | What the panel does |
| --- | --- | --- |
| `ok:false`, with `diagnostics` | None of the submitted changes took effect | Show the cause; no successful subset needs resending |
| `ok:true`, `committed:true`, `saved:true` | Values changed and saving succeeded | Show actual changes, or no change when `changes` is empty |
| `ok:true`, `committed:true`, `saved:false`, with `persistence` | Values already changed, save not confirmed | Show both facts; offer `retrySave()` instead of repeating `apply` |
| `ok:true`, `committed:true`, no `saved` field, with a normal before receipt | Values and receipt are published for prose; SillyTavern owns the upcoming chat save | Show the outcome, not a save failure or confirmed save |
| Preview with `committed:false` | Calculated without changing the chat | Do not label it saved or use it as the live panel state |

`changes` contains actual field/element differences, not full old and new arrays; `provenance` explains inputs, actions, corrections and triggers. Render these differences or the relevant fields instead of dumping two complete inventories. A correction can make an increment's actual effect smaller than the requested amount. Reread for the final display, including after failure; a concurrent restore or native edit can have changed the current state.

`diagnostics` may also accompany a successful commit, for example a notification problem. Such a warning, a failed redraw, or a lost response is not permission to replay the action. Inspect state/history if the outcome is unknown. `retrySave()` retries the pending save for the current chat without rerunning gameplay; it can reject when the pending save no longer matches the current state. Recheck the current result in that case. Do not automatically resend on a different chat or swipe.

`lastResult()` returns the current live result, or `undefined` after it is cleared. The example uses `receipt.id` (the settlement record's id) and `saved` to remove an outdated retry button when a newer result replaces it; this feedback is kept in the panel, not saved as a gameplay variable.

If the button already settled an event, its prose summary is a recap, not a second model instruction to settle it. Explain that division in the relevant update instructions. Distinct new story events may still affect the same fields.

## A complete example

The [camp definition](<examples/camp/definition.json>) and [panel](<examples/camp/panel.html.txt>) implement a rest button, actual stamina differences, independent refresh and save-only retry. Copy the definition into `variables/definition.json` in a new isolated example card; it declares no function files. Save it, select 3.0 and enable the test chat (new chats in 3.0 initialize automatically). Put the panel HTML inside a fenced HTML block in the greeting or a display-regex replacement. It uses the `camp` root, not the equipment starter's `hero`. Merely reading these files does not install them.

The panel reads on mount; it does not call `enable` or write initial values. It uses a local busy flag and the current chat identity, and releases its own timer on `pagehide`. Initialization belongs to the chat; reopening a panel cannot grant another rest. Copy the mechanics and feedback flow, then adapt the names and appearance to the actual card.

<a id="effects"></a>
## One-time animation, sound and notifications

Polling observes current values. An increase can mean a new reward, undoing damage or restoring a different swipe. Keep one-time effects out of the polling renderer. For a panel-owned action, use its own successful committed result and the relevant change/provenance once; save retry and redraw do not play the effect again.

For task-owned feedback, `document` on the host page receives the native DOM event `lwb:state3:committed`, whose `event.detail` contains the result that changed the chat. It is emitted after the API result is retained, including successful enable, apply, undo and selection restoration; `saved:false` is still a commit. It is not a jQuery `stateAtomsGenerated` event and is not forwarded to the iframe's `st-event` bridge. Register in the task, remove the same listener in `onCleanup`, and send any card-specific display message to the iframe through the documented task/iframe channel.

This notification does not cover every variable change: ordinary native-variable edits and opening a chat need not emit it, and a result may not be announced if the player switched chats or replies while it was running. Its name does not establish that a new gameplay action occurred. `actions` and `provenance` identify fresh settlement effects; undo/restoration have no freshly executed action/rule provenance, although the restored record can name an old action. If the card needs a particular reward effect, match that reward's provenance rather than a positive balance change or `receipt.actions`. Explicitly exclude initialization effects when they are not part of the intended presentation. The current-value panel still refreshes independently.

Sources: `runtime/api.ts`, `runtime/service.ts`, `runtime/host.ts`, `types.ts` and `index.ts` (`available`, `retain`, `retrySave`), relative to `modules/variables/state3/`.

<a id="acceptance"></a>
## Acceptance in the player's journey

- Open the iframe in an initialized test chat; it shows current state without submitting anything. Mount it again and verify no initialization/action repeats.
- Click once, double-click while pending, and activate it from the keyboard. One pending interaction submits once; after it finishes, another deliberate click is a new action. The displayed difference comes from the settled result, including a cap or a no-change result.
- Reject an action and simulate a save failure separately. Rejection changes nothing; save failure shows already-changed values. Retrying saving leaves gameplay and settlement count unchanged. Failure details remain available.
- Keep the panel open while an external update, undo, swipe or reset changes the root. Remove and restore the root with the same value; the error display must recover. Clear a root or switch chats without allowing the old panel to submit into another chat.
- Test a character's different openings using [the opening workflow](<state-design.md#alternate-openings>). Test a progressed chat separately from a fresh one.
- Close the iframe or stop the task and check that its timer/listeners are gone. For sound/animation, check that redraw, restore and save-only retry do not replay a new-action effect.
