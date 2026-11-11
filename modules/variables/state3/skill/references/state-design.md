# Choosing state structures and starting situations

This reference complements the definition format. Use the card's actual names and mechanics rather than adopting an example's categories.

## Stable addresses, people and inventory

Root names and paths are shared addresses for the updater, macros, rules and panels. Keep them stable while maintaining a card; renaming a definition field does not migrate an existing chat's values.

Choose an object keyed by a stable name or id when the model needs to find a person or item by identity. Choose an array when order or duplicate entries matter. JSON current-state macros contain array values, not annotated indices; a model that must edit an array needs to locate its current index. Removing an array element shifts later indices, including operations later in the same batch.

In JSON Schema, a dictionary's `additionalProperties` can be the schema for each member. Its containing object can start as `{}`. Fixed objects use `properties`, `required` and, when appropriate, `additionalProperties:false`; declaring `properties` alone does not require those fields. The [camp definition](<examples/camp/definition.json>) includes a dynamic `camp.people` dictionary and an ordered `camp.inventory` array.

Create a missing person's complete object before editing its children. `set` does not create missing parents; it replaces the value at its path, rather than merging omitted siblings. All required fields must exist by final validation. Ordinary initial data supplies its required fields and empty collections explicitly; schema defaults fill nothing. Derived/corrected values are produced by their declared rules before final validation.

The following batch works with the camp definition:

```json
[
  {"op":"set","path":["camp","people","Lv.3"],"value":{"present":true,"mood":0}},
  {"op":"inc","path":["camp","people","Lv.3","mood"],"delta":2},
  {"op":"set","path":["camp","inventory","0"],"value":"map"}
]
```

Every path segment is a string: `"0"` indexes an array, while `"00"` can be an object key. `"Lv.3"` above is one literal key, not two levels. Array writes can address an existing index or the current length to append; they do not create gaps. `remove` deletes the field or the indexed element, not an element found by its value.

Permissions follow literal subtree prefixes. Granting `direct` at `["camp","people"]` covers dynamically named descendants, subject to any more specific restrictions. `"*"` is a literal key here, not a wildcard. Replacing a parent is also checked for changes to protected children. The same literal-path rule applies to rule outputs and function read declarations; a calculation over dynamic members can read the collection and use a pure function.

Submission paths and macro paths have different notation. The member above is addressed by `{{xbgetvar::camp.people["Lv.3"].mood}}`; an array item uses `{{xbgetvar::camp.inventory[0]}}`. Whole-root `{{xbgetvar::camp}}` avoids reconstructing a path for every field. Verify the actual expansion after initialization, including keys with punctuation. Native `{{getvar::name}}` addresses a native variable by name, not a nested path.

## Limits, gradual changes and free text

Choose the consequence of an invalid value before choosing a constraint:

| Gameplay intention | Definition choice | Result |
| --- | --- | --- |
| Reject an invalid final number or finite choice | JSON Schema bounds/types/`enum`, or a cross-field `constraint` | The whole submission fails; chat values stay unchanged |
| Cap a valid change at a fixed or changing limit | A `correct` rule, such as `min(current, maximum)` | The corrected value and its source appear in the result |
| Calculate a value such as maximum health | A `derive` rule | Inputs change its dependencies; the rule computes the result |
| Limit how fast a relationship can change | Decide whether this is advice, a per-action limit or a per-batch rule, then express that choice | An absolute range alone does not limit one turn's change |

Use `enum` for genuinely finite choices such as a fixed quest stage. Locations, nicknames and evolving situations often need free text: an unlisted value would reject the batch. Give such fields a writing convention in `access[].update` and let the panel display unfamiliar values, rather than silently substituting a known location. For hierarchical locations, a panel can locate recognized segments and display an unfamiliar trailing segment literally.

For gradual narrative values, explain the evidence and typical change size in `update`. If the gameplay needs an enforced limit, an action's parameter schema can bound one submitted amount, or a constraint/correction can compare a field with `before`. `before` means the start of this entire batch, not the value before each operation; multiple actions in one batch are not multiple turns. A correction must reach a stable result. `inc` adds no implicit step limit, and a direct assignment is not an increment. Test the chosen rule with both assignments and increments instead of assuming the same limit applies to both.

Sources: `definition/compile.ts`, `engine/data.ts`, `engine/input.ts`, `engine/settle.ts`, `engine/validation.ts` and `definition/example.ts`, relative to `modules/variables/state3/`.

<a id="alternate-openings"></a>
## Alternate greetings and initial state

A card has one `initial` object. Enabling a chat fills missing native roots from it, retains existing roots and settles the result. These values are the chat's starting point; initialization is not recorded separately for each greeting. Selecting a different greeting restores that swipe's recorded settlements, if any; it does not select a different `initial` from the greeting text. Reopening a chat does not initialize it again. Calling `enable()` on an enabled chat fails rather than resetting it.

Start by listing each greeting's location, equipment, resources, people and active objectives:

- If the openings share those facts, one baseline is sufficient. Each greeting can differ in prose without inventing a second initialization task.
- If the openings require different facts, the card needs an explicit opening-selection design. One option is a common pre-choice state with a player-selected opening action that sets all opening-dependent fields together. If the native greeting swipe itself must select the state, that needs a card task connecting the selected greeting to its opening action; the definition alone does not provide that connection.
- A native-swipe task must initialize only before subsequent turns, await the chat being enabled, associate changes with greeting floor `0` and its selected swipe, and recognize an already-recorded selection. It must serialize or cancel stale work when the selection changes, release its event subscription on task cleanup, and leave progressed/reopened chats intact. `apply` appends by default; repeatedly calling it on every mount is not initialization. The [submission reference](<card-side.md#submission>) explains explicit indices and named replacement. Test the complete task in the host before offering it as a working multi-opening card.

Changing `initial` while visiting another greeting edits the card's shared definition; it is not a per-greeting switch. Plain native-variable assignment also bypasses settlement history. Neither implements the opening journey above. Retain an existing working opening mechanism when repairing a card. If a requested multi-start design has no implemented and verified connection yet, report that missing part rather than claiming the greetings are ready.

Acceptance: start each greeting directly in an isolated fresh chat, switch A → B → A before the first player turn, confirm each intended initial state and no duplicated reward, then play a turn and save/reopen. Reopening must preserve progress. Check the panel and both models' actual request data, not just the greeting prose.

Sources: `runtime/service.ts` (`enable`, `stage`, `restoreSelection`), `runtime/host.ts` (`capture`, `selectionChange`) and `index.ts` (`CHAT_CREATED`, `MESSAGE_SWIPED`), relative to `modules/variables/state3/`.
