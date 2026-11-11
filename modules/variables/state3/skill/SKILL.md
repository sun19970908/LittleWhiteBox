---
name: builtin-state3
description: Write variable 3.0 rules and calculations in the current card workspace; check their results and save the rules and function files to the card.
---

# Variable 3.0 rule authoring

## What belongs to the card

The card defines the update stages, variable structure, initial values, write permissions, actions, derived values, corrections, constraints, triggers and model views. Current values live in SillyTavern's native chat variables, one top-level definition key per native variable. The original variable panel reads and edits these same values. All submitted changes are calculated together; current chat values change only if the whole submission succeeds. Preview and draft checks calculate results without changing the chat.

The variables mode (1.0, 2.0 or 3.0) is a player setting. A 3.0 definition runs while that setting is 3.0.

## Which files to edit

- `variables/definition.json` is the definition object. Its required fields and expression shapes are in [the current format](<../definition/format.ts>); a complete working equipment example is in [the starter definition](<../definition/example.ts>).
- `variables/functions/<name>.js` contains one JavaScript function expression. The matching `definition.functions[name]` contains `reads` and `description`. Names contain letters, digits, underscores or hyphens.
- Worldbooks, greetings and display regex are ordinary CardFiles files. Use ReadSkill builtin-card-files for those file layouts and prompt organization.

CardFiles open returns the current card's local workspace root and preserves existing edits; `st.state3.openDraft()` returns the same root. Read the related files before changing them, and edit them with the local Read, Write and apply_patch tools.

Saving any variable-definition/function file through CardFiles save writes the definition and all its function files together. Removing a function means removing its declaration and workspace file before saving the definition. CardFiles refresh of a variable file reloads the definition and all its functions, replacing those local edits.

Draft text can be incomplete. Subsequent updates, previews and descriptions use the rules saved on the card. Saving rules leaves current chat values unchanged and executes no action. Checking that rules work and confirming that they were saved are separate steps.

## How to design gameplay state

Gameplay comes before fields. For each mechanic, write out four things: the condition, its consequence, which state values change, and whether it can happen again. Fields follow from that list: a condition reads them, a consequence writes them, and a repeatable or one-time result needs its own record.

Also identify who submits each event: the independent updater, a player button, or a task. A button's completed action and a later narrative recap are one event, not two submissions. Put that ownership in the relevant `access[].update`; permissions alone do not distinguish a script from the model submitting the same action.

For example, "the first summit grants a relic" becomes: condition — the player reaches the summit; consequence — the relic is added; changes — inventory and a claimed flag; repeat — once, so the claimed flag is part of the condition.

Variables hold what later rules and choices depend on: completion flags, counts, stages, deadlines, resources and relationships. The plot summary module records what happened in the story, so a variable that retells events duplicates it. Text variables suit short current facts, such as a location or a mood.

Read [state design and openings](<references/state-design.md>) when choosing dynamic people/inventory structures, paths, numeric limits, finite choices or alternate greetings. It explains the authoring decisions as well as the format; a valid schema alone does not settle those decisions.

## When should a result become known?

Decide with the author which outcomes must be known before the story is written and which changes require reading the completed story. The required `updates` array declares `before`, `after`, or both.

- `before`: the player's new message is resolved automatically before prose generation. A complete combat turn, check or exploration outcome can be settled first, so prose narrates its actual result.
- `after`: the model reads the completed AI reply. The player chooses automatic updates or the reply's update button.
- When both are enabled, every action and every `access` entry allowing `direct` declares `stages`. A single-stage card inherits that stage without repeating it on each entry. The available tools, writable fields and settlement permissions all follow this assignment. Ordinary calculations, corrections, constraints and triggers are one shared set, executed in both stages; they have no `stages` field.

Each executed stage makes a separate paid model request; a correction may make another. Recommend a stage only when its job justifies that cost. A single health subtraction is usually an existing action effect, rule, panel operation or part of the other stage, not a reason to buy an extra model request. Explain this tradeoff to the author and review your own stage choices. Group a coherent gameplay decision into one update; extra fields or padding do not make a stage worthwhile. The equipment and camp examples use only `after`; their deterministic panel actions need no extra model stage.

Before results are written into the native variables and saved on the player's message before prose is assembled. Executed before actions retain their ids and complete parameters as used, including values produced by parameter conversions. Stop, prose failure, regeneration and reopening the chat reuse this saved result.

ENA previews do not settle; adopting the plan settles its final text and rebuilds the prose context. A failed action precondition can be narrated as failure; request, submission and execution errors stop prose and offer retry or explicit skip. Edited player text retains its previous result and offers recomputation, which replaces rather than adds to it. Undo retains an undone marker so regeneration does not silently apply it again.

The after updater receives the already settled before outcome with the current state. Give before and after distinct event ownership, including when an action is available in both. The result of a panel action is likewise an established fact, not a new event to submit again.

## How to express a rule

Definition format is `1`. JSON Schema describes structure; explicit conversions happen in action parameter conversions. Schema checks validate values as submitted: they insert no defaults, delete no unknown fields and coerce nothing.

Paths are string-segment arrays, such as `["hero", "health"]`. Access entries grant `direct` or named actions permission to change the specified subtree. Undeclared writes are rejected; an ancestor lock also covers its descendants. Derived outputs are calculated by their rules, not ordinary input.

Rules have `kind: "derive"` or `kind: "correct"`, an output `path`, a `value` expression and a description. Expressions read current state with `get`, the batch start with `before`, action parameters with `param`, or call a declared function with `call` and `args`. A correction must be stable after settlement; cycles and overlapping rule outputs are rejected.

An action declares its parameter schema, parameter conversions, condition (`requires`) and changes (`effects`). Every effect reads the values from before that action. Actions run in submitted order, with associated calculations between actions. The final values must pass the structure checks and constraints before they replace the chat's current values.

Use `triggers` for state-dependent consequences such as a first reward, a threshold event or an unlocked stage. Each trigger has `id`, `description`, `when`, `effects`, and optional `timing`. The default `batch` observes the completed batch; `action` observes each action after associated calculations. Conditions are evaluated in definition order, with associated calculations after each changed effect. The same trigger can run again until stable. Put one-time claim flags in ordinary state and change them with the reward. A cycle or an unbounded chain rejects the whole batch and reports the involved rules.

Ordinary input is an array of `{op:"set",path,value}`, `{op:"remove",path}`, `{op:"inc",path,delta}` or `{action,params}` objects. Group related changes into one array. If any part fails, the chat stays unchanged.

`inc` adds a signed numeric `delta` to the existing number at `path` when that item executes, including earlier edits and action effects in the batch. Negative deltas subtract; zero and fractional deltas are valid. The field, delta and result must be finite numbers. Initialize ordinary counters in `initial`; create a new optional field with an allowed `set` or action before incrementing it. `inc` uses the same `direct` permissions as `set`; derived and action-only fields remain owned by their rules and actions. Calculations, corrections and triggers keep their existing settlement timing, and the final schema decides whether the resulting field must be an integer. No rounding or step limit is added by the operation.

For example, a separate sale already completed outside a card action can submit `{ "op": "inc", "path": ["hero", "coins"], "delta": 5, "reason": "Sold an item elsewhere." }`. When this card's `sell` action already grants those coins, submit that action instead of also submitting its income. A reward trigger supplies its own reward after its condition becomes true. A separate event may still justify another increment to the same field.

Recommend `reason` for numeric changes or changes requiring judgement: one short sentence citing the supporting passage event. Straightforward factual updates need no restatement. Use `old` only when an explicit comparison with the prior value helps explain a change, rather than copying entire objects or arrays. These optional annotations explain the latest live result; they do not execute, validate the previous value, or enter saved history. Changes are grouped by source; explanations appear once, and added or removed structures can be expanded to inspect their fields. For a routine equipment removal, `{ "action": "unequip", "params": {} }` is sufficient.

## Names and explanations players see

Every action has a required `title`: the short name players see in results and failure messages, such as “购买” or “休息”. Its `id` is the name submitted by code and the update model. Its `description` explains the complete action. Action titles are used by the interface, not added to the update model's action list. Card panels supply their own controls; the plugin settings do not contain an action form.

JSON Schema `title` gives a field or parameter a readable name. Use it where a name helps players understand a failure; it is optional, and an unnamed field displays its path. A parameter's `description` explains its range, format and a useful example. When making a panel form, show these facts beside its inputs.

Failed conditions show the relevant comparison and actual values. A condition inside a custom function can only show the function name and description, so describe what that function checks. Use short, familiar player-facing names and explain failures with the affected value and what is needed. When explaining the editor, use its button names: “保存草稿”, “检查规则”, “存入角色卡”, “导入规则” and “导出规则”. Checking rules shows either the opening variables or the specific errors; it does not change the chat.

## What the two models receive

The ordinary RP model writes the story. Worldbook macros supply state and its meaning:

- `{{xbgetvar::path}}` expands to the current value at that path. A scalar expands as is, such as `{{xbgetvar::hero.health}}` inside a sentence; an object or array expands as compact JSON, so `{{xbgetvar::hero}}` shows the whole subtree with its current values.
- `{{xbvardesc::view}}` expands to that view's meanings: the section descriptions, the selected fields, and the descriptions of rules, actions, triggers and constraints that read or change those fields. It contains no current values. `{{xbvardesc}}` supplies all views; view names come from this card's `views`.

The RP model needs both: the values tell it what is true now, and the descriptions tell it what those values mean and how they change. A card whose story depends on inventory, people, time or progress shows those roots with `xbgetvar`. For the equipment starter, one character-after constant entry is:

```
The hero's current state, root path hero:
<hero>
{{xbgetvar::hero}}
</hero>

What these fields mean:
{{xbvardesc::character}}
```

Use worldbook conditions and activation to select further subpaths and groups when one constant entry would carry state the scene does not use.

Before results reach the RP model automatically when an action was executed, a value changed, or an action was rejected for an unmet precondition. An executed action still reaches prose when it changes no values. A successful before result with neither actions nor changes adds no reference block; skipped and undone results add none either.

This reference describes only the already resolved part of the latest player message; the rest remains for prose to develop. An unchanged before result says nothing about changes arising later in the reply. The RP model and the after updater read the same recorded outcome, including executed action parameters and rejection reasons. Raw JSON, field paths and outcome labels are reference data, not story text.

Normal before updates publish native variables and the USER receipt before prose, then rely on SillyTavern's chat save. They do not wait for a separate save before prose. Manual operations, undo and after updates save explicitly. Local execution-environment failures retry the same model submission once without another model request; if still failing, “重试结算” reuses the single pending submission while its message, state and rules remain current. That submission lives only in page memory and is released on success, cancellation or context change.

The independent update model receives SillyTavern's assembled context, including activated worldbook entries, with the target passage marked. It also receives the starting state, structure, writable fields, actions, rule and trigger descriptions generated from the definition, and submits one batch.

Put each instruction where its reader needs it:

- `access[].description`, view descriptions, and rule, action, trigger and constraint descriptions: how the world works, read by both models. Write them as facts of the world, such as "Wearing the amulet raises maximum health by 40." or "A healing spell restores 10 health."
- `access[].update`: when the passage calls for a change and which field or action to submit, read only by the update model. For example, "Submit heal when the passage casts a healing spell."
- The update model receives each action's id, description and parameters, each rule's id, kind, output path and description, each trigger's id, description and timing, and each constraint's description. Expressions, requirements, effects and tests stay with the engine, so any judgement a model needs belongs in a description.
- Worldbook prose: story context for both models.

The RP model narrates with the same rules the settlement applies, while submission instructions stay out of its context, so it does not narrate them as story tasks. Saving rules refreshes the description macros of an enabled chat. Macros expand before the host applies its worldbook budget; after enabling an isolated chat, `previewRequest()` returns the exact update request. A story behaviour that changes managed state needs a corresponding allowed field or action before the card can offer it to players.

The current-chat settings show the card's declared stages. Before updates run automatically; after updates use the reply's button or the player's automatic-update choice. Custom interfaces can submit through the state API without a model stage.

## How a card panel follows current state

For a panel that displays current values, follow the card-files reference on [reading and refreshing variables](<../../../card-workspace/skill/references/xiaobaix-capabilities.md#state-panel-refresh>). The native variable names are the top-level keys of this card's `initial`; the equipment starter uses `hero`. A panel reads these values for display; initialization and player actions use their separate state APIs.

For buttons and tasks, read [card-side settlement](<references/card-side.md>): the `window.LWB_StateV3` / `window.parent.LWB_StateV3` entry points, target reply, asynchronous results, save-only retry and one-time feedback. Its [complete camp panel](<references/examples/camp/panel.html.txt>) pairs with a [definition](<references/examples/camp/definition.json>); reading these files does not install them. Sending ordinary player text follows the shared [message-button guidance](<../../../card-workspace/skill/references/xiaobaix-capabilities.md#message-buttons>).

## From a design to a playable card

1. Read the current card files and ask only for missing gameplay choices. Describe what players see and list each mechanic as condition, consequence, changed state and repeatability.
2. Make the definition from that list: structure and initial state, direct inputs, action-owned fields, calculated fields, cross-field constraints and conditional consequences. Use pure functions where expressions would obscure the design.
3. Connect the RP views through worldbook macros, using the card-files skill for worldbook layout, activation and ordering. A 3.0 definition initializes its own state; a loop task is only needed for actual host automation or a persistent custom UI. Compare every greeting with its intended starting state using [the alternate-opening workflow](<references/state-design.md#alternate-openings>); changing greeting text does not select another `initial`.
4. Trial the draft against this card's own mechanics, each with `checkDraft` from a state that sets up the case: every consequence when its condition holds and when it does not, a one-time reward claimed twice, a time or count threshold crossed, a change after equipment or a stage switches, and the first action after a rule edit, started from state saved under the earlier rules. Also trial a forbidden edit and a failed action, and confirm failure leaves the supplied starting state untouched. For numeric inputs, mix assignments, increments and actions to verify execution order, and check a missing field, a final type violation and a rule correction. Repair errors in the same editable draft.
5. Trial every ending, stage and one-time reward as a route played from the initial state: one `checkDraft` call per player turn, each passing the input that turn would submit and the previous result's `state`, until the result shows that goal reached. Each condition can look satisfiable alone while another rule blocks its prerequisite, such as a repair that needs power while the only power source needs that repair; trials that start from a hand-set state skip exactly that path. A goal no route reaches gets its rules fixed before the card is saved.
6. Save the definition, its function files and the changed worldbook files. Check and report which files were saved. With permission, enable an isolated chat. Preview the assembled request with `previewRequest` and check each worldbook macro in its context: descriptions list the intended fields and values show the chat's actual current state. An empty field list means the view name or a view path misses the definition; an empty value means the path misses the managed roots. `ctx.substituteParams` can check `xbvardesc` on its own; `xbgetvar` needs the full request pipeline. Play one turn for a key mechanic: the reply's narration and the settled values agree, and numerical or judgement-based changes have a useful reason without repeating ordinary facts or whole inventories. Check the update button, save/reopen and undo before calling the card playable.
7. For a custom panel, test its [submission and refresh journey](<references/card-side.md#acceptance>) in the actual iframe. For alternate openings, start each directly in a fresh chat and switch away and back before the first player turn; check both the opening facts and the saved state, then reopen a progressed chat to confirm it was not reinitialized.
8. For a staged card, verify tools and requests contain only that stage's actions and direct writes. Play a before turn, stop and regenerate, reopen the chat and regenerate again: the same saved outcome must be reused. Confirm prose macros read the settled native values and after updates do not repeat the same event. Edit the player message and explicitly recompute; check replacement, undo, failure/retry and save-only retry. Historical swipe and suffix deletion restore records, not a newly simulated story.

## When a custom function is useful

Use a function when the expression format does not express the calculation clearly. It receives `(input, {get, before})`; `input` is the evaluated `args` array. Return a synchronous JSON value for the calling expression.

Declare every state-read subtree in `reads`. `get(path)` and `before(path)` authorize that path and descendants, not undeclared ancestors. Both use the same declarations. Returned objects are copies. Missing fields read as undefined; returning undefined is not a JSON result.

Functions run in an isolated engine with only their arguments and declared reads: there is no host, DOM, network, storage, current time or random input. Any event/time/random facts required by a card must be supplied as recorded input. Functions return synchronous JSON. Execution work and memory are bounded; trigger chains have cycle detection and a round limit. Browser scheduling delays do not consume those work limits.

For a function named `health_bonus`, declare `reads: [["hero", "baseHealth"]]` and a description, then write this expression into its function file. It adds an explicitly supplied bonus to the declared base health:

```javascript
(input, {get}) => get(['hero', 'baseHealth']) + input[0]
```

## How to check the actual draft

RunJavaScriptApi exposes these methods as `st.state3.<name>`. Existing JavaScript API permissions apply.

- Reads: `checkDraft`, `tryDefinition`, `inspect`, `preview`, `previewRequest`, `exportRules`, `prepareRuleImport`, `settings`.
- Effects: `openDraft` (opens the card workspace), `saveCardDraft`, `importRules`, `enable`, `apply`, `undo`, `retrySave`, `saveSettings`.

After editing local files, open a fresh draft snapshot and check it. `openDraft()` returns `{root,avatar,name,paths,reused,files}`; `files` contains the path/content pairs under `variables/`. `checkDraft(draft,input=[],{state})` settles the draft's bundle from `state`, or from the draft's initialized values when `state` is omitted. It changes no chat values and saves nothing.

A successful result contains `ok:true`, `state`, `changes`, `provenance`, `actions` and `diagnostics`. Each change contains `path`, `before`, `after` and `removed`; a missing value is omitted. Array element paths include their indices; added and removed elements are separate changes. Objects recurse to changed fields. Each `provenance` entry is a change plus `source: {kind, id, title?, description?}` naming what caused it. Source titles and descriptions belong to this live result, not saved history. A failed result contains `ok:false` and `diagnostics` identifying the operation, path or rule. Return the trial result directly when inspecting it, or select these documented fields.

For the equipment starter, this trials unequipping the amulet from the current chat's real state with the edited draft rules:

```js
const draft = await st.state3.openDraft();
const current = await st.state3.inspect();
return await st.state3.checkDraft(draft, [{action:'unequip',params:{}}], {state: current.state});
```

`inspect()` reads the current chat's saved state, rule version and bundle, or returns `ok:false` with `not-enabled` diagnostics before the chat is enabled. `tryDefinition(bundle,input=[],{state})` settles any explicit `{definition,functions}` bundle, such as one returned by `exportRules()`.

For a current chat already using saved rules, preview uses that chat's real rules and history without changing chat values:

```js
return await st.state3.preview([{action:'unequip',params:{}}]);
```

## How to save and enable

Save the definition path with CardFiles save; its function files are included automatically. `saveCardDraft(draft)` saves the same files after checking that the selected card matches the draft. Both write the workspace's current variable files, including edits made after the draft snapshot, and return `{ok, results:[{path, saved, unchanged?, hasUnsavedEdits?, error?}]}`. Inspect every result.

`enable()` fills missing native roots from the saved card's initial values and settles them with that definition. The managed roots are the top-level keys of `initial` at that moment, with all their descendants; a later settlement that would create another top-level key fails with `unowned-root`, and enabling an already enabled chat fails with `already-enabled`. Get the user's agreement before initializing or changing their active chat or mode. A new chat started in 3.0 mode with a card that has saved rules is enabled automatically.

`exportRules()` returns the saved card's complete `{definition,functions}` bundle. `prepareRuleImport(text)` validates JSON file text and returns `{bundle,avatar,previous}` for the selected card. With the user's approval, `importRules(prepared)` replaces that card's whole bundle, including removal of absent functions, and returns `{ok:true}` after read-back confirmation. If the selected card or its rules changed during confirmation, prepare the import again. Import changes only the card's rule bundle: chat values, history, other card fields and workspace drafts stay as they are. Existing drafts keep their conflict baseline; CardFiles refresh loads the replacement bundle when the author chooses to discard those edits.

The [card-side API reference](<references/card-side.md#submission>) explains the `apply` / `preview` options and commit/save result handling. `undo({index})` removes the last settlement at that reply; `undo({index,all:true})` removes that reply's whole group when repairing stale text-derived results.

Tail deletion and swipe selection restore the recorded state for that position without running actions, corrections or triggers; later confirmed fields stay with the parent structure they require. Switching an earlier reply while keeping later settlements also checks the restored state's schema and constraints. Conflicts are shown with the author's rule and current field values; the selection and restored values remain in place. A subsequent update is accepted when its resulting state satisfies the rules. Editing, hiding, moving and middle deletion leave variables as they are. Copied replies carry prose, not executed settlements. When a changed passage needs a different result, the player updates it again; re-updating the current reply replaces its previous model submission.

`settings()` reads updater choices, defaulting to `{auto:false, source:'main'}`. `saveSettings({auto,source})` requires both fields. `auto` controls after updates only; sources are `main`, `delegate`. These are player preferences, separate from the card definition. `previewRequest({stage:'before'})` previews the latest player message's update request; `previewRequest({stage:'after'})` previews the latest AI reply.

## What to report

Report what rules changed, what you submitted in each trial, the actual results, and whether saving succeeded. Passing a draft check does not change the chat; saving rules does not start a chat. Keep failed trial diagnostics visible while repairing the draft, and leave unrelated card files and chat data unchanged.
