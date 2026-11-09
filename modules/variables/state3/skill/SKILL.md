---
name: builtin-state3
description: Author variable 3.0 rule definitions and pure calculations in the current card workspace; check real settlement results and save the complete definition bundle.
---

# Variable 3.0 rule authoring

## What belongs to the card

The card owns the state structure, initial values, write permissions, actions, derived values, corrections, constraints, triggers and model views. Current values live in SillyTavern's native chat variables, one top-level definition key per native variable. The original variable panel reads and edits these same values. A settlement computes one isolated candidate and publishes it only after the whole batch succeeds. Preview and draft checks compute candidates without publishing chat state.

The variables mode (1.0, 2.0 or 3.0) is a player setting. A 3.0 definition runs while that setting is 3.0.

## Which files to edit

- `variables/definition.json` is the definition object. Its required fields and expression shapes are in [the current format](<../definition/format.ts>); a complete working equipment example is in [the starter definition](<../definition/example.ts>).
- `variables/functions/<name>.js` contains one JavaScript function expression. The matching `definition.functions[name]` contains `reads` and `description`. Names contain letters, digits, underscores or hyphens.
- Worldbooks, greetings and display regex are ordinary CardFiles files. Use ReadSkill builtin-card-files for those file layouts and prompt organization.

CardFiles open returns the current card's local workspace root and preserves existing edits; `st.state3.openDraft()` returns the same root. Read the related files before changing them, and edit them with the local Read, Write and apply_patch tools.

Saving any variable-definition/function file through CardFiles save writes that root's complete variable bundle in one operation. All current function files belong to that bundle; removing a function means removing its declaration and workspace file before saving the definition. CardFiles refresh of a variable file refreshes the whole variable bundle and replaces those local edits.

Draft text can be incomplete. Saved card rules are the sole definition used by subsequent updates, previews and descriptions. Saving rules leaves current chat values unchanged and executes no action. Check results and card-save receipts are separate evidence.

## How to design gameplay state

Gameplay comes before fields. For each mechanic, write out four things: the condition, its consequence, which state values change, and whether it can happen again. Fields follow from that list: a condition reads them, a consequence writes them, and a repeatable or one-time result needs its own record.

For example, "the first summit grants a relic" becomes: condition — the player reaches the summit; consequence — the relic is added; changes — inventory and a claimed flag; repeat — once, so the claimed flag is part of the condition.

Variables hold what later rules and choices depend on: completion flags, counts, stages, deadlines, resources and relationships. The plot summary module records what happened in the story, so a variable that retells events duplicates it. Text variables suit short current facts, such as a location or a mood.

## How to express a rule

Definition format is `1`. JSON Schema describes structure; explicit conversions happen in action parameter conversions. Schema checks validate values as submitted: they insert no defaults, delete no unknown fields and coerce nothing.

Paths are string-segment arrays, such as `["hero", "health"]`. Access entries grant `direct` or named actions permission to change the specified subtree. Undeclared writes are rejected; an ancestor lock also covers its descendants. Derived outputs are calculated by their rules, not ordinary input.

Rules have `kind: "derive"` or `kind: "correct"`, an output `path`, a `value` expression and a description. Expressions read current state with `get`, the batch start with `before`, action parameters with `param`, or call a declared function with `call` and `args`. A correction must be stable after settlement; cycles and overlapping rule outputs are rejected.

An action declares its parameter schema, parameter conversions, precondition and effects. Effects observe the same pre-action state. Actions run in submitted order, with associated rules settled between actions. Final structure and constraints must pass before a candidate is accepted.

Use `triggers` for state-dependent consequences such as a first reward, a threshold event or an unlocked stage. Each trigger has `id`, `description`, `when`, `effects`, and optional `timing`. The default `batch` observes the completed batch; `action` observes each action after associated calculations. Conditions are evaluated in definition order, with associated calculations after each changed effect. The same trigger can run again until stable. Put one-time claim flags in ordinary state and change them with the reward. A cycle or an unbounded chain rejects the whole batch and reports the involved rules.

Ordinary input is an array of `{op:"set",path,value}`, `{op:"remove",path}`, `{op:"inc",path,delta}` or `{action,params}` objects. Group related changes into one array. A failed batch publishes nothing.

`inc` adds a signed numeric `delta` to the existing number at `path` when that item executes, including earlier edits and action effects in the batch. Negative deltas subtract; zero and fractional deltas are valid. The field, delta and result must be finite numbers. Initialize ordinary counters in `initial`; create a new optional field with an allowed `set` or action before incrementing it. `inc` uses the same `direct` permissions as `set`; derived and action-only fields remain owned by their rules and actions. Calculations, corrections and triggers keep their existing settlement timing, and the final schema decides whether the resulting field must be an integer. No rounding or step limit is added by the operation.

For example, a separate sale already completed outside a card action can submit `{ "op": "inc", "path": ["hero", "coins"], "delta": 5, "reason": "Sold an item elsewhere." }`. When this card's `sell` action already grants those coins, submit that action instead of also submitting its income. A reward trigger supplies its own reward after its condition becomes true. A separate event may still justify another increment to the same field.

Each input object carries `reason`, one sentence citing the passage that supports this change, and may carry `old`, its previous value for the reader. Players read `reason` to see why a number moved, and changes made by rules and triggers show the rule that made them. These annotations are shown beside the latest live result with their operation number; they do not execute, do not validate the previous value, and are discarded when the chat, swipe or message changes. A batch without them is still accepted. For example, an equipment removal is `{ "action": "unequip", "params": {}, "reason": "The passage says the character takes off the amulet." }`.

## What the two models receive

The ordinary RP model writes the story. In normally enabled worldbook entries, use `{{xbgetvar::hero.health}}` to read a specific current value and `{{xbvardesc::character}}` to describe that view. `{{xbvardesc}}` supplies all views. View names come from this card's `views`. A description lists the section descriptions, the meanings of the selected fields, and the descriptions of rules, actions, triggers and constraints that read or change those fields; it contains no current values. Use worldbook conditions and activation to select the needed subpaths and groups. A character-after constant entry is sufficient for always-visible values and meanings.

The independent update model receives SillyTavern's assembled context, including activated worldbook entries, with the target passage marked. It also receives the starting state, structure, writable fields, actions, rule and trigger descriptions generated from the definition, and submits one batch.

Put each instruction where its reader needs it:

- `access[].description`, view descriptions, and rule, action, trigger and constraint descriptions: how the world works, read by both models. Write them as facts of the world, such as "Wearing the amulet raises maximum health by 40." or "A healing spell restores 10 health."
- `access[].update`: when the passage calls for a change and which field or action to submit, read only by the update model. For example, "Submit heal when the passage casts a healing spell."
- The update model receives each action's id, description and parameters, each rule's id, kind, output path and description, each trigger's id, description and timing, and each constraint's description. Expressions, requirements, effects and tests stay with the engine, so any judgement a model needs belongs in a description.
- Worldbook prose: story context for both models.

The RP model narrates with the same rules the settlement applies, while submission instructions stay out of its context, so it does not narrate them as story tasks. Saving rules refreshes the description macros of an enabled chat. Macros expand before the host applies its worldbook budget; after enabling an isolated chat, `previewRequest()` returns the exact update request. A story behaviour that changes managed state needs a corresponding allowed field or action before the card can offer it to players.

Players update through the reply's update button or automatic post-reply updates. Both use the independent update model; custom interfaces can submit through the state API.

## From a design to a playable card

1. Read the current card files and ask only for missing gameplay choices. Describe what players see and list each mechanic as condition, consequence, changed state and repeatability.
2. Make the definition from that list: structure and initial state, direct inputs, action-owned fields, calculated fields, cross-field constraints and conditional consequences. Use pure functions where expressions would obscure the design.
3. Connect the RP views through worldbook macros, using the card-files skill for worldbook layout, activation and ordering. A 3.0 definition initializes its own state; a loop task is only needed for actual host automation or a persistent custom UI.
4. Trial the draft against this card's own mechanics, each with `checkDraft` from a state that sets up the case: every consequence when its condition holds and when it does not, a one-time reward claimed twice, a time or count threshold crossed, a change after equipment or a stage switches, and the first action after a rule edit, started from state saved under the earlier rules. Also trial a forbidden edit and a failed action, and confirm failure leaves the supplied starting state untouched. For numeric inputs, mix assignments, increments and actions to verify execution order, and check a missing field, a final type violation and a rule correction. Repair errors in the same editable draft.
5. Save the complete bundle and the changed worldbook files. Report the writeback receipts. With permission, enable an isolated chat. Description macros follow the enabled chat's saved rules: expand each macro used by the worldbooks once, for example `ctx.substituteParams('{{xbvardesc::character}}')`, and confirm it lists the intended fields; an empty field list means the view name or a view path misses the definition. Play one turn for a key mechanic: the reply's narration and the settled values agree, and the visible result shows each change with its reason. Check the update button, save/reopen and undo before calling the card playable.

## When a custom function is useful

Use a function when the expression format does not express the calculation clearly. It receives `(input, {get, before})`; `input` is the evaluated `args` array. Return a synchronous JSON value for the calling expression.

Declare every state-read subtree in `reads`. `get(path)` and `before(path)` authorize that path and descendants, not undeclared ancestors. Both use the same declarations. Returned objects are copies. Missing fields read as undefined; returning undefined is not a JSON result.

Functions run in an isolated engine with only their arguments and declared reads: there is no host, DOM, network, storage, current time or random input. Any event/time/random facts required by a card must be supplied as recorded input. Async results are rejected, and a function running longer than 250 ms fails the batch.

For a function named `health_bonus`, declare `reads: [["hero", "baseHealth"]]` and a description, then write this expression into its function file. It adds an explicitly supplied bonus to the declared base health:

```javascript
(input, {get}) => get(['hero', 'baseHealth']) + input[0]
```

## How to check the actual draft

RunJavaScriptApi exposes these methods as `st.state3.<name>`. Existing JavaScript API permissions apply.

- Reads: `checkDraft`, `tryDefinition`, `inspect`, `preview`, `previewRequest`, `exportRules`, `prepareRuleImport`, `settings`.
- Effects: `openDraft` (opens the card workspace), `saveCardDraft`, `importRules`, `enable`, `apply`, `undo`, `retrySave`, `saveSettings`.

After editing local files, open a fresh draft snapshot and check it. `openDraft()` returns `{root,avatar,name,paths,reused,files}`; `files` contains the path/content pairs under `variables/`. `checkDraft(draft,input=[],{state})` settles the draft's bundle from `state`, or from the draft's initialized values when `state` is omitted. It publishes nothing and saves nothing.

A successful result contains `ok:true`, `state`, `changes`, `provenance`, `actions` and `diagnostics`. Each change contains `path`, `before`, `after` and `removed`; a missing value is omitted. Array element paths include their indices; added and removed elements are separate changes. Objects recurse to changed fields. Each provenance entry is a change plus `source: {kind, id}` naming the input, action, rule or trigger that made it. A failed result contains `ok:false` and `diagnostics` identifying the operation, path or rule. Return the trial result directly when inspecting it, or select these documented fields.

For the equipment starter, this trials unequipping the amulet from the current chat's real state with the edited draft rules:

```js
const draft = await st.state3.openDraft();
const current = await st.state3.inspect();
return await st.state3.checkDraft(draft, [{action:'unequip',params:{}}], {state: current.state});
```

`inspect()` reads the current chat's saved state, rule version and bundle, or returns `ok:false` with `not-enabled` diagnostics before the chat is enabled. `tryDefinition(bundle,input=[],{state})` settles any explicit `{definition,functions}` bundle, such as one returned by `exportRules()`.

For a current chat already using saved rules, preview uses that chat's real rules and history and publishes nothing:

```js
return await st.state3.preview([{action:'unequip',params:{}}]);
```

## How to save and enable

Write back the definition path with CardFiles save; its function files are included automatically. `saveCardDraft(draft)` performs the same writeback for the draft's card after checking card identity. Both write the workspace's current variable files, including edits made after the draft snapshot, and return `{ok, results:[{path, saved, unchanged?, hasUnsavedEdits?, error?}]}`. Inspect every result.

`enable()` fills missing native roots from the saved card's initial values and settles them with that definition. The managed roots are the top-level keys of `initial` at that moment, with all their descendants; a later settlement that would create another top-level key fails with `unowned-root`, and enabling an already enabled chat fails with `already-enabled`. Get the user's agreement before initializing or changing their active chat or mode. A new chat started in 3.0 mode with a card that has saved rules is enabled automatically.

`exportRules()` returns the saved card's complete `{definition,functions}` bundle. `prepareRuleImport(text)` validates JSON file text and returns `{bundle,avatar,previous}` for the selected card. With the user's approval, `importRules(prepared)` replaces that card's whole bundle, including removal of absent functions, and returns `{ok:true}` after read-back confirmation. If the selected card or its rules changed during confirmation, prepare the import again. Import changes only the card's rule bundle: chat values, history, other card fields and workspace drafts stay as they are. Existing drafts keep their conflict baseline; CardFiles refresh loads the replacement bundle when the author chooses to discard those edits.

`apply(input,options)` commits through the same settlement used by `preview(input,options)`. A committed result distinguishes `saved:true` from `saved:false`; `retrySave()` retries persistence without executing actions again. `undo({index})` removes the last settlement at that reply; `undo({index,all:true})` removes that reply's whole group when repairing stale text-derived results.

Tail deletion and swipe selection restore the recorded state for that position without running actions, corrections or triggers; later confirmed fields stay with the parent structure they require. Switching an earlier reply while keeping later settlements also checks the restored state's schema and constraints. Conflicts are shown with the author's rule and current field values; the selection and restored values remain in place. A subsequent update is accepted when its resulting state satisfies the rules. Editing, hiding, moving and middle deletion leave variables as they are. Copied replies carry prose, not executed settlements. When a changed passage needs a different result, the player updates it again; re-updating the current reply replaces its previous model submission.

`settings()` reads updater choices, defaulting to `{mode:'manual', source:'main'}`. `saveSettings({mode,source})` requires both fields. Modes are `off`, `manual`, `auto`; sources are `main`, `delegate`. These are player preferences, separate from the card definition.

## What to report

Report the rule changes, the actual trial inputs and outcomes, and the card-save receipt. A successful draft check is not a chat commit; a saved card does not initialize a chat. Keep failed trial diagnostics visible while repairing the draft, and leave unrelated card files and chat data unchanged.
