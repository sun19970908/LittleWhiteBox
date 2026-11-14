# Tools and the three script positions

## Choose the position by its job

Simple story-driven edits use `access.direct`; complete consequences use actions. A pure reusable formula goes in `functions`. The extension positions are optional:

- Facts needed only to calculate an already chosen submission belong in prepare, including dice. If the model must inspect a result before deciding what to submit, use a tool, for example reading current prices before selecting goods to sell.
- State, rules and the current passage are already in the model request. A tool that returns those same values adds cost without new information.
- A simple consequence expressible as an action effect stays in that action. Calculate is for a batch-level algorithm that needs the completed candidate state, such as integrating an existing pure combat routine.
- A story fact recorded alongside the final submission uses a direct field. It needs neither a tool call nor a script.
- Sound, animation and other new-settlement effects use committed. A before-stage committed script runs before prose is generated; it cannot voice prose that does not yet exist. Reading completed prose belongs to the after stage or the host's actual generation-completed facility.

| Job | Declaration | Source |
| --- | --- | --- |
| Let the update model call a host operation when needed | `extensions.tools[name]` | `variables/tools/<name>.js` |
| Acquire facts once for a submitted batch | `extensions.scripts.prepare` | `variables/scripts/prepare.js` |
| Compute additional edits after ordinary operations | `extensions.scripts.calculate` | `variables/scripts/calculate.js` |
| Perform host feedback after a new settlement | `extensions.scripts.committed` | `variables/scripts/committed.js` |

Each declaration has `title`, `description`, `enabled`. Tools also have a JSON Schema `parameters` object and `stages` (`before`, `after`, or both). The declaration is in `definition.json`; source files contain code only. Disabled entries retain their source. Delete both declaration and source to remove an entry when the complete bundle is saved.

The executable [dice example](<../../extensions/example.ts>) uses only prepare, an action and committed. `extensionExample()` returns the bundle; `marketToolExample` separately demonstrates querying an author-provided market worldbook with the host's `ctx.loadWorldInfo`. Install only the entries needed for the card. Project `definition` into definition.json and source maps into their matching directories.

## Host code inputs

Tools, prepare and committed files contain an async JavaScript **function body**. Top-level `await` is available. Their bindings are:

- `input`: tool arguments, the submitted operation array for prepare, or `{state,changes,actions}` for committed.
- `run.state`: starting state snapshot; committed receives the applied state.
- `run.rules`, `run.target`, `run.text`, `run.stage`, `run.signal`: card definition, target `{floor,swipeId}`, target passage, optional update stage and cancellation signal.
- `run.prepared`: prepared JSON or null; `run.tools`: successful tool calls as `{name,input,output}` entries.
- `ctx` and `getContext()`: the real SillyTavern context. Host globals such as `window` and `document` are available.
- `run.apply(operations)`, in committed code: start a separate checked settlement on the same target, inheriting the current stage and cancellation. Await it and check its returned `ok`. It runs preparation and calculation, but does not invoke committed again. In a single-entry test it is a draft trial instead (see below).

Query the actual installed interface before calling another plugin or global task. Use the assistant's API search/inspection tools and inspect the owner's source when needed. The card may call a documented public global supplied by that owner; it does not acquire ownership of that plugin/task's lifetime. Report a missing required interface as an error. Return JSON; a body with no return yields null.

Code executes with the player's authority after confirmation. Use `run.signal` for cancellable network requests. Cancellation is checked at every await; the target and cancellation are checked again before the returned value is accepted. Host operations that already happened are not undone. Managed variable changes belong in a settlement; committed code uses `run.apply` for a follow-up batch while the current update is finishing. Other callers use `st.state3.apply` or `window.LWB_StateV3.apply`.

## Preparation and calculation

Prepare runs after the first structurally valid submission. Correction and local calculation retry reuse the successful prepared value. A deliberate new update starts a new run. Tool results and prepared data are temporary, not saved in message history.

An action expression `{ "prepared": ["roll"] }` reads the prepared object's roll. It can be used in action conversions, requirements and effects, or passed as a function argument. Derived rules, corrections, triggers and constraints read durable game state. When prose needs a fact again after regeneration, copy it into an action parameter through `conversions`, as the example does, or into real game state. The model's before-stage record retains converted action parameters; ordinary API settlements record only action ids.

Calculate is a synchronous function expression `(input, {get,before}) => [...]` in the same pure engine as ordinary functions. `input.submission` is the submitted array, `input.prepared` is the prepared JSON or null. `get(path)` reads the pending state, `before(path)` the batch starting state; managed roots are readable. Return an array of `set`, `remove` or `inc` items. These authored changes bypass model direct-write switches but retain derived-value protection, owned-root limits, format checks and final constraints.

Ordinary operations and action-level triggers finish first. Calculate edits then run, followed by recalculation/correction, batch triggers and final validation. Failure publishes none of the batch. Initialization and restoration skip extension scripts. Committed executes once after a newly published settlement, including a settlement whose disk save needs retry. Its failure adds an `extension-after-failed` diagnostic to the still-successful result, without undoing state or stopping prose. Undo, swipe, reopen and save-only retry do not replay it.

## Model turns and testing

The updater injects existing context, state, rules and the enabled stage's tool declarations. Each update allows five custom tool calls in total, counted across the correction. A response whose tool calls would exceed that total fails the update with `extension-limit` and runs none of them. Invalid tool arguments and tool execution errors return `{ok:false,error}` to the model and still count; other tool failures, such as code the player has not allowed, end the update. A successful write ends immediately. Write is submitted alone; a batch mixing it with other tools executes nothing. The initial failed submission permits one correction. Every tool result continues the same model conversation.

`checkDraft` and `tryDefinition` ([signatures](<../SKILL.md#how-to-check-the-actual-draft>)) are pure trials. `preview(input,{prepared})` uses the chat's saved rules and changes no variables, history or `lastResult()`. Supply simulated preparation explicitly. Use the returned state for the next trial. These calls do not ask the host for data or run committed feedback.

Actual submissions obtain preparation from the card's enabled prepare script. Passing `prepared` to a real commit is rejected. An action that references prepared data requires an enabled prepare script at check/save time.

`checkDraft(draft,[],{checkOnly:true})` validates definitions, source syntax and initialization without running an extension; 检查规则 uses this mode. You conduct consecutive trials through `checkDraft`, constructing each input from the card's mechanics and passing the returned state into the next turn.

`testExtension(draft,{kind,name?,input,state?,beforeState?,prepared?,stage?,target?,text?,tools?},{stage?,signal?})` runs one entry of the draft and returns `{ok:true,output,extensions}` or `{ok:false,diagnostics,extensions}`. Kinds are `tool`, `prepare`, `calculate`, `committed`; name selects the tool. It can test a disabled entry. An omitted `state` is the draft's opening state; `target` defaults to `{floor:-1,swipeId:0}`, so pass `text` when the code reads the passage.

- Tool, prepare and committed tests ask the player to confirm each run. Their host operations, such as sound, network or other plugins, really happen; use isolated data.
- In a committed test, `run.apply` settles the draft rules from the test state, including its prepare and calculate scripts, and returns `committed:false`. Nothing is written to the chat and the live result is unchanged; consecutive calls continue from the previous trial state.
- Calculate tests use the pure engine without confirmation; `state` is pending state and `beforeState` is batch starting state.

A single-entry test checks its execution; a subsequent full trial checks its effects against the complete rules. Verifying the real settlement after committed code, including its follow-up batch, needs the saved card in an isolated chat.

`extensions.calls` holds position, source path, input, output or error, and `context` for this live result. To reproduce a failed entry, copy its context into the test alongside kind, name and input; for calculate, use `call.input.submission` as input and `call.input.prepared` as prepared. Context retains the actual state, phase, passage, prepared data and successful tool results. Model updates that involve extensions also report `modelRequests`. These details disappear with the current context and never enter recovery records. `previewRequest({stage})` shows the declarations actually offered for saved rules.

## Complete the authoring journey

The authoring handoff supplies a selected source path in editor context. Read its declaration from definition.json to choose the test kind/name. Construct inputs from the actual mechanics; use the API above for single-entry tests, then continue pure trials from each returned state. On failure, repair the current draft and rerun the captured failing context. Save the package and verify normal updates and restoration in an isolated chat. Checking syntax executes no host code.

Sources: `extensions/definition.ts`, `extensions/runtime.ts`, `extensions/testing.ts`, `engine/settle.ts`, `model/updater.ts`, `runtime/service.ts`, `definition/card-files.ts`, `skill/public-api.ts`, relative to `modules/variables/state3/`.
