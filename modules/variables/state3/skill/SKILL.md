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

## How to express a rule

Definition format is `1`. JSON Schema describes structure; explicit conversions happen in action parameter conversions. Schema checks validate values as submitted: they insert no defaults, delete no unknown fields and coerce nothing.

Paths are string-segment arrays, such as `["hero", "health"]`. Access entries grant `direct` or named actions permission to change the specified subtree. Undeclared writes are rejected; an ancestor lock also covers its descendants. Derived outputs are calculated by their rules, not ordinary input.

Rules have `kind: "derive"` or `kind: "correct"`, an output `path`, a `value` expression and a description. Expressions read current state with `get`, the batch start with `before`, action parameters with `param`, or call a declared function with `call` and `args`. A correction must be stable after settlement; cycles and overlapping rule outputs are rejected.

An action declares its parameter schema, parameter conversions, precondition and effects. Effects observe the same pre-action state. Actions run in submitted order, with associated rules settled between actions. Final structure and constraints must pass before a candidate is accepted.

Use `triggers` for state-dependent consequences such as a first reward, a threshold event or an unlocked stage. Each trigger has `id`, `description`, `when`, `effects`, and optional `timing`. The default `batch` observes the completed batch; `action` observes each action after associated calculations. Conditions are evaluated in definition order, with associated calculations after each changed effect. The same trigger can run again until stable. Put one-time claim flags in ordinary state and change them with the reward. A cycle or an unbounded chain rejects the whole batch and reports the involved rules.

Ordinary input is an array of `{op:"set",path,value}`, `{op:"remove",path}` or `{action,params}` objects. Group related changes into one array. A failed batch publishes nothing.

Each input object may contain `reason`, one sentence citing the passage that supports this change, and `old`, its previous value for the reader. These annotations are shown beside the latest live result with their operation number; they do not execute, do not validate the previous value, and are discarded when the chat, swipe or message changes. For example, an equipment removal is `{ "action": "unequip", "params": {}, "reason": "The passage says the character takes off the amulet." }`.

## What the two models receive

The ordinary RP model writes the story. In normally enabled worldbook entries, use `{{xbgetvar::hero.health}}` to read a specific current value and `{{xbvardesc::character}}` to describe the fields selected by that view. `{{xbvardesc}}` supplies all view descriptions. Description macros contain section descriptions and field meanings, not current values. Use worldbook conditions and activation to select the needed subpaths and groups. A character-after constant entry is sufficient for always-visible values and meanings.

The independent update model receives SillyTavern's assembled context, including activated worldbook entries, with the target passage marked. It also receives the starting state, structure, writable fields, actions, rule and trigger descriptions generated from the definition, and submits one batch.

Put each instruction where its reader needs it:

- `access[].description` and view descriptions: field meaning, read by both models.
- `access[].update`: when and how the update model changes that field, read only by the update model.
- Action, rule, trigger and constraint descriptions: read by the update model, which receives each action's id, description and parameters, each rule's id, kind, output path and description, each trigger's id, description and timing, and each constraint's description. Expressions, requirements, effects and tests stay with the engine, so any judgement the update model needs belongs in a description.
- Worldbook prose: story context for both models.

Keeping maintenance instructions out of the RP context keeps the RP model from narrating them as story tasks. Macros expand before the host applies its worldbook budget; after enabling an isolated chat, `previewRequest()` returns the exact update request. A story behaviour that changes managed state needs a corresponding allowed field or action before the card can offer it to players.

Players normally update through the reply's update button or automatic post-reply updates. Only when the user requests story-body submission should the RP model emit `<state3>[...]</state3>`; multiple blocks in one reply form one atomic batch, and that reply is then updated only from its body.

## From a design to a playable card

1. Read the current card files and ask only for missing gameplay choices. Describe what players see and which story events cause state changes.
2. Make the definition: structure and initial state, direct inputs, action-owned fields, calculated fields, cross-field constraints and conditional consequences. Use pure functions where expressions would obscure the design.
3. Connect the RP views through worldbook macros, using the card-files skill for worldbook layout, activation and ordering. A 3.0 definition initializes its own state; a loop task is only needed for actual host automation or a persistent custom UI.
4. Trial the draft with a successful batch, a forbidden edit and a failed action. Check all linked fields and confirm failure leaves the supplied starting state untouched. Repair errors in the same editable draft.
5. Save the complete bundle and the changed worldbook files. Report the writeback receipts. With permission, enable an isolated chat and check the update button, visible result, save/reopen and undo before calling the card playable.

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

Tail deletion and swipe selection restore the recorded state for that position without running actions, conditions or triggers; later confirmed fields stay with the parent structure they require. Editing, hiding, moving and middle deletion leave variables as they are. When a changed passage needs a different result, the player updates it again; re-updating the current reply replaces its previous body/model submission.

`settings()` reads updater choices, defaulting to `{mode:'manual', source:'main'}`. `saveSettings({mode,source})` requires both fields. Modes are `off`, `manual`, `auto`; sources are `main`, `delegate`. These are player preferences, separate from the card definition.

## What to report

Report the rule changes, the actual trial inputs and outcomes, and the card-save receipt. A successful draft check is not a chat commit; a saved card does not initialize a chat. Keep failed trial diagnostics visible while repairing the draft, and leave unrelated card files and chat data unchanged.
