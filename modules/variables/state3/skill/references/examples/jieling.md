# A complete card: 解铃会

A playable card built around variable 3.0: the story carries the people, the panel under the latest reply carries the decisions. Read it to see how a game's decisions become actions, derived values, prepared dice and a once-only reward. Its panel is deliberately plain; for presentation, read ReadSkill builtin-card-frontend.

The [jieling folder](<jieling/>) is a whole character card in the CardFiles layout: card fields, two openings, a linked worldbook, three regex scripts and a variable 3.0 package with functions and a prepare script. Reading it installs nothing. To build a card from it, write each file to the same relative path under the root returned by CardFiles open, then save them. The executable acceptance test is `modules/variables/state3/tests/jieling-example.test.ts`.

## The game, from the player's seat

The player has just taken over 解铃会, a peer-support center where people whose fetish has started to cost them something real meet in small rooms each week. The season is twelve weeks. The main opening leaves time to get acquainted; the alternative begins with tight funds and an unresolved argument.

Every week the player faces the same three questions, and none of them has a clean answer:

- **Who to admit.** Applicants arrive in the story. Each one brings 500 yuan and a person: an arrest, a marriage at risk, a sharp tongue. Turning someone away costs nothing but a place.
- **Who sits with whom.** A room only meets with three members, holds four, and the mix decides what happens. A retired woman drawn to young men and a student drawn to older women understand each other at once — and are the pair most likely to meet privately after class. A man who needs to be ordered about and a trainer who needs to be watched cannot stand each other — and when they break through, they leap ahead.
- **When to spend.** Rent is 2000 a week. Sessions pay 300 per member who attends. Hushing up an incident costs 600, and an incident left open keeps raising the outside world's attention until the center is shut down.

Members graduate when they can live with their fetish without it running their life. Graduates leave, which is the point of the center and also the end of their fees. The story is where these people live: interviews, sessions and the week's consequences are narrated; the panel under the latest reply is where the player decides.

## Two ways to start

`message/0.md` starts with the keys and register: 6000 yuan, no open incidents, and 何小满 still waiting for a room. `message/1.md` starts with an argument in the corridor: 2400 yuan, exposure 10, one open incident, and 何小满 already in the first room.

Both use the same people and gameplay rules. In `variables/definition.json`, `initial` holds their shared starting data, `openings[0]` is `{}`, and `openings[1]` supplies the different funds, incident and room assignment. The club's derived room list follows the member assignment. The player chooses with the greeting arrows; the panel reads the selected opening's variables. Read [alternate openings](<../state-design.md#alternate-openings>) when adapting this to another card.

## Why each variable exists

A field is stored only when a later rule or choice needs it and it cannot be computed from other fields.

| Field | Why it is stored | Who changes it |
| --- | --- | --- |
| `week` | The season ends after week 12. | `endweek` |
| `funds` | Rent can fail; every choice to spend is weighed against it. | `endweek`, `admit`, `handle`, the first-graduate trigger |
| `reputation` | Decides how many applicants arrive next week, so good weeks compound. | `endweek`, the trigger |
| `exposure` | The second way to lose; open incidents make it grow. | `endweek`, `report`, `handle` |
| `waiting` | Limits admissions to the interviews this week actually brought. | `endweek` renews it; `admit` and `decline` use it |
| `members.*.wants / is / hates` | The matching rule reads them to relate every pair in a room. | Set once by `admit` |
| `members.*.control` | Progress toward graduation; the panel shows it as the bar. | `endweek` |
| `members.*.room` | The player's assignment; rooms are derived from it. | `assign`, `leave`, `endweek` |
| `members.*.status` | Graduates and leavers stay in the register for the story but stop counting. | `endweek`, `leave` |
| `members.*.kink / note` | What the narrator needs to write the person again weeks later. | `admit`, `note` |
| `incidents` | Open incidents raise exposure each week until handled. | `endweek`, `report`, `handle` |
| `lastWeek` | The narrator must write exactly the week that was settled, not invent one. | `endweek` |
| `flags.firstGraduate` | The donation happens once. | the trigger |

Two things are deliberately **not** stored:

- **`rooms` and `phase` are derived.** Who is in a room is already on each member; whether it can meet and how each pair relates follows from their tags through `room_report`. Storing them would create a second source that could disagree with the register.
- **Pair relations are not a table.** Complementary, mirrored, conflicting and neutral are computed from `wants`, `is` and `hates`, so admitting a new member immediately gives every relation without anyone writing it.

## Who owns each change

- **The panel (`before` stage)** owns the player's decisions: `assign`, `handle` and `endweek`. They cost money, have limits and can be refused, and a typed player instruction settles the same way.
- **The update model (`after` stage)** records what the story established: `admit` an applicant the player accepted, `decline` one turned away, `note` how a member changed, `leave` when someone quits, `report` an incident that happened outside the sessions. It cannot write numbers or close a week.
- **`endweek`** settles a whole week in one pure function, `close_week`: sessions, slips, departures, graduations, rent, reputation, exposure and new interviews. Dice come from `prepare.js` through a parameter conversion, so recomputation gives the same week.
- **The trigger** adds the first graduate's donation once, with its flag in the same effects.

Every gameplay field has `direct: false`; actions own costs, limits and refusals. Descriptions carry the numbers, and both models read them through `xbvardesc`; the worldbook prose does not repeat them.

## What each file does

| Path | Role |
| --- | --- |
| `card.json`, `description.md`, `scenario.md` | Identity, premise and tone. `world` links the primary book. |
| `message/0.md`, `message/1.md` | Two openings: receiving the keys, or arriving during an unresolved argument. Both end with the panel marker `【解铃会】`. |
| `world_book/解铃会/经营状态.md` | Constant entry: current values via `xbgetvar`, meanings via `xbvardesc`, and how to narrate a settled week. |
| `world_book/解铃会/回复格式.md` | Constant entry at depth 0: every reply ends with the marker. |
| `world_book/解铃会/面谈.md`, `互助室.md` | Keyword entries for interviews and sessions. |
| `regex/解铃会：最新一楼.md` | Display regex, `maxDepth: 0`: the latest marker becomes the panel, an HTML code block. |
| `regex/解铃会：旧楼文字.md` | Display regex, `minDepth: 1`: older markers become one line. A panel already on screen stays until the chat is reopened; it reads the same state and settles the same way. |
| `regex/解铃会：不进提示词.md` | Prompt-only regex that removes the marker from the model's context. |
| `variables/definition.json` | State, rules, actions, trigger, view and script declarations. |
| `variables/functions/*.js` | Pure functions: the room report, the week, and small register/list helpers. |
| `variables/scripts/prepare.js` | The week's dice. |

## How the panel behaves

The panel reads `club` on mount and every 500 ms, and submits only when the player presses a button.

- **Rooms** show members, control bars, whether the room can meet and every pair's relation, so the player sees the consequence of an assignment before closing the week.
- **Success** shows the settled week from `lastWeek`, or each actual field difference from `changes`.
- **Refusal** names the shortfall — room full, not enough money, already handled, season over — read from the rejected condition; the state is unchanged and details are expandable.
- **Pending** disables every action until the settlement finishes, so a double click submits once.
- **Unsaved** results offer save-only retry; the action is not repeated.
- **Outside changes** (undo, swipe, the update model) replace the displayed values and clear old feedback.
- **Ending** replaces the controls with the season's result.
- **Lifetime**: a chat change marks the panel outdated; `pagehide` clears its timer and listeners.

Its script passes through SillyTavern's code-block text processing, so it writes no literal underscore, asterisk, `$` followed by a digit, or double braces, and keeps double quotes paired on each line. The host API name is written as `host['LWB\u005fStateV3']` for that reason, and action ids avoid underscores.

## Adapting it

Start from the player's repeated decision and what makes it hard, then store only what that decision and its consequences need. Keep the shape: the player's choices are `before` actions, story facts are `after` actions, anything computable is derived, randomness is prepared, once-only events are triggers with flags, and the panel shows settled results. Test in a new chat of an isolated card, as described in [acceptance](<../card-side.md#acceptance>).
