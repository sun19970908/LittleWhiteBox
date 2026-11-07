---
name: builtin-state3
description: Author variable 3.0 rule definitions and pure calculations in the current card workspace; check real settlement results and save the complete definition bundle.
---

# Variable 3.0 rule authoring

## What belongs to the card

The card owns the state structure, initial values, write permissions, actions, derived values, corrections, constraints, triggers and model views. A settlement computes one isolated candidate and publishes it only after the whole batch succeeds. Preview and draft checks compute candidates without publishing chat state.

CardFiles open returns the current card's local workspace root and preserves existing edits. Read the related files before changing them. Existing 2.0 cards keep their own engine; choosing 3.0 is an explicit player action.

## Which files to edit

- `variables/definition.json` is the definition object. Its required fields and expression shapes are in [the current format](<../definition/format.ts>); a complete working equipment example is in [the starter definition](<../definition/example.ts>).
- `variables/functions/<name>.js` contains one JavaScript function expression. The matching `definition.functions[name]` contains `reads` and `description`. Names contain letters, digits, underscores or hyphens.
- Worldbooks, greetings and display regex remain ordinary CardFiles files. Use ReadSkill builtin-card-files for those file layouts and prompt organization.

Edit files through the existing local Read, Write and apply_patch tools. The root comes from CardFiles open or `st.state3.openDraft()`, not from the character's display name.

Saving any variable-definition/function file through CardFiles save writes that root's complete variable bundle in one operation. All current function files belong to that bundle; removing a function means removing its declaration and workspace file before saving the definition. CardFiles refresh of a variable file refreshes the whole variable bundle and replaces those local edits.

Draft text can be incomplete. Saving the card does not enable its rules, change the current chat or execute an action. Check results and card-save receipts are separate evidence.

## How to express a rule

Definition format is `1`. JSON Schema describes structure; explicit conversions happen in action parameter conversions. Schema checks do not insert defaults, delete unknown fields or coerce values.

Paths are string-segment arrays, such as `["hero", "health"]`. Access entries grant `direct` or named actions permission to change the specified subtree. Undeclared writes are rejected; an ancestor lock also covers its descendants. Derived outputs are calculated by their rules, not ordinary input.

Rules have `kind: "derive"` or `kind: "correct"`, an output `path`, a `value` expression and a description. Expressions read current state with `get`, the batch start with `before`, action parameters with `param`, or call a declared function with `call` and `args`. A correction must be stable after settlement; cycles and overlapping rule outputs are rejected.

An action declares its parameter schema, parameter conversions, precondition and effects. Effects observe the same pre-action state. Actions run in submitted order, with associated rules settled between actions. Final structure and constraints must pass before a candidate is accepted.

Use `triggers` for state-dependent consequences such as a first reward, a threshold event or an unlocked stage. Each trigger has `id`, `description`, `when`, `effects`, and optional `timing`. The default `batch` observes the completed batch; `action` observes each action after associated calculations. Conditions are evaluated in definition order, with associated calculations after each changed effect. The same trigger can run again until stable. Put one-time claim flags in ordinary state and change them with the reward. A cycle or an unbounded chain rejects the batch and reports the involved rules; it does not publish a partial reward.

Ordinary input is an array of `{op:"set",path,value}`, `{op:"remove",path}` or `{action,params}` objects. Group related changes into one array. Failed batches do not publish a partial state.

Each input object may contain `reason`, one sentence citing the passage that supports this change, and `old`, its previous value for the reader. These annotations do not execute or validate the previous value. For example, an equipment removal is `{ "action": "unequip", "params": {}, "reason": "The passage says the character takes off the amulet." }`.

## What the two models receive

The ordinary RP model writes the story. Place the required scoped macros in the card's worldbook: a view named `character` becomes `{{lwb3_character}}`; a view named `equipment` becomes `{{lwb3_equipment}}`. Each supplies current values and their related rule descriptions. `{{lwb3_result}}` supplies the latest confirmed changes and actions. Select small relevant sections rather than repeating the whole state in every entry. Use a constant entry for essentials and keyword-triggered entries for situational sections; check their ordering and activation through the normal worldbook workflow.

Macros expand before the host applies its worldbook budget. Inspect `previewRequest()` after enabling the isolated chat to check what the update model actually receives. Put each section where it is needed once; worldbook prose supplies story context, while calculations, access and action descriptions come from the definition. A story behaviour that changes managed state needs a corresponding allowed field or action before the card can offer it to players.

The independent update model receives SillyTavern's assembled context, including activated worldbook entries, with the target passage marked explicitly. It also receives the exact starting state, structure, writable fields, actions and rule descriptions generated from the definition. The platform supplies `read_manuscript`, `read_writing_guide`, and `request_write_approval` tool exchanges. The model submits once through `write({state: [...]})`; native tool choice is automatic and Agent API handles protocol compatibility.

Default to the reply's update button or automatic post-reply updates. Write the narrative evidence for changes in field/action descriptions, adding worldbook context where activation matters. Calculation, access and reward ownership belong in the definition. Only when the user requests story-body submission should the RP model emit `<state3>[...]</state3>`; multiple blocks in one reply form one atomic batch. A reply containing these blocks is owned by that submission route.

## From a design to a playable card

1. Read the current card files and ask only for missing gameplay choices. Describe what players see and which story events cause state changes.
2. Make the definition: structure and initial state, direct inputs, action-owned fields, calculated fields, cross-field constraints and conditional consequences. Use pure functions where expressions would obscure the design.
3. Connect the RP views through worldbook macros. Use the card-files skill for worldbook layout, activation and ordering, not for the 2.0 initialization recipe. A 3.0 definition initializes its own state; a loop task is only needed for actual host automation or a persistent custom UI.
4. Trial the real definition with a successful batch, a forbidden edit and a failed action. Check all linked fields and confirm failure leaves the supplied starting state untouched. Repair errors in the same editable draft.
5. Save the complete bundle and the changed worldbook files. Report the writeback receipts. With permission, enable an isolated chat and check the update button, visible result, save/reopen and undo before calling the card playable.

## When a custom function is useful

Use a function when the expression format does not express the calculation clearly. It receives `(input, {get, before})`; `input` is the evaluated `args` array. Return a synchronous JSON value for the calling expression.

Declare every state-read subtree in `reads`. `get(path)` and `before(path)` authorize that path and descendants, not undeclared ancestors. Both use the same declarations. Returned objects are copies. Missing fields read as undefined; returning undefined is not a JSON result.

Execution has no host, DOM, network, storage, current time or random input. Any event/time/random facts required by a card must already be supplied as recorded input. Async results are rejected; infinite loops are interrupted and cancellation terminates the isolated worker.

For a function named `health_bonus`, declare `reads: [["hero", "baseHealth"]]` and a description, then write this expression into its function file. It adds an explicitly supplied bonus to the declared base health:

```javascript
(input, {get}) => get(['hero', 'baseHealth']) + input[0]
```

## How to check the actual draft

RunJavaScriptApi exposes the real `LWB_StateV3` methods through `st.state3`. Existing JavaScript API permissions apply. Read-only trials are classified as reads; opening/importing a workspace, saving a draft/card, enabling rules or committing state are effects.

After editing local files, open a fresh draft snapshot and check its initialized candidate. `openDraft()` returns `{root,avatar,name,paths,reused,files}`; `files` contains path/content pairs. `checkDraft(draft,input=[])` returns a settlement result with `ok`, and either state/changes/provenance/actions or diagnostics. It does not publish or save the card.

Each change contains `path`, `before`, `after` and `removed`; a missing value is omitted. A live action result contains `id` and `params`; saved history keeps its `id` and actual changes, not another copy of its input. On failure, `diagnostics` identifies the operation, path or rule; `state` is only present on success. Return the trial result directly when inspecting it, or select these documented fields.

```js
const draft = await st.state3.openDraft();
return await st.state3.checkDraft(draft, []);
```

For the equipment starter, trial unloading the charm from a separate explicit starting state. `tryDefinition(bundle,input=[],{state})` accepts `{definition,functions}`; omitted state uses the definition's initialized values. This trial leaves the chat untouched:

```js
const current = await st.state3.inspect();
return await st.state3.tryDefinition(current.bundle, [{action:'unequip',params:{}}], {state:current.state});
```

`inspect()` reads the saved current state, rule version and bundle. If it reports `ok:false`, inspect its diagnostics before trying another action.

For a current chat already using the equipment starter, preview uses that chat's real rules and history without publishing:

```js
return await st.state3.preview([{action:'unequip',params:{}}]);
```

## How to save and enable

Write back the definition path with CardFiles save; its function files are included automatically. `saveCardDraft(draft)` performs the same variable-bundle writeback after checking card identity. Inspect every returned save result, including `saved`, `unchanged` and `hasUnsavedEdits`.

`enable()` initializes an unenabled current chat from the saved card bundle. `upgrade({preview:true})` trials the saved rules against an existing 3.0 chat; `upgrade()` explicitly applies them without resetting to the definition's initial values. Get the user's agreement before changing their active chat or mode.

`apply(input,options)` commits through the same settlement used by `preview(input,options)`. A committed result distinguishes `saved:true` from `saved:false`; `retrySave()` retries persistence without executing actions again. `undo({index})` removes the last settlement at that reply; explicit `undo({index,all:true})` removes that reply's whole group when repairing stale text-derived results.

Stored swipe records contain actual reversible changes. Reopening reads current state; tail deletion and swipe selection undo or restore changes without running actions, conditions or triggers. Editing, hiding, moving and middle deletion do not update variables. When a changed passage needs a different result, the player explicitly updates it again. Re-updating the current reply starts before its previous body/model submission and replaces that submission.

`settings()` reads updater choices; `saveSettings({mode,source})` changes them. Modes are `off`, `manual`, `auto`; sources are `main`, `delegate`. These are player preferences, separate from the card definition.

## What to report

Report the rule changes, the actual trial inputs and outcomes, and the card-save receipt. A successful draft check is not a chat commit; a saved card is not an enabled rule version. Keep failed trial diagnostics visible while repairing the draft, and leave unrelated card files and chat data unchanged.
