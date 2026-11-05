# AI assistant: realtime voice and per-user memory

The assistant's name is user-configurable (the `aiName` prop, default "Clopar"). In the prototype it answers with `window.claude.complete` and uses browser speech APIs. Production uses a realtime speech-to-speech model: OpenAI Realtime, or an equivalent behind the same interface.

## 1. Session flow

1. The client calls `POST /api/assistant/session` with the user's auth cookie.
2. The server checks the plan and voice quota (`vmin`, `aiUsed`), then mints a **short-lived ephemeral client token** for the realtime API. It sends:
   - system instructions (tone, language, "no specific investment picks"),
   - the tool list (section 3),
   - a memory preamble for **this user only** (section 4).
3. The client connects directly to the model over WebRTC (voice) or WebSocket (typed). The permanent API key never leaves the server.
4. Session events drive the character animation (`RideffParticles.setMode`):
   - mic open / user speaking: `listen`
   - waiting for a response or a tool call: `think`
   - audio output playing: `speak`
   - response done with a positive action (saved, confirmed): `confirm` for about 1.4 s, then `calm`
5. The caption above the character shows only the first sentence of the transcript (two-line clamp). The full transcript goes to the Ask chat history.
6. On session end, the server records the minutes used and runs memory extraction (section 4.3).

## 2. Where it appears

- **Map corner:** tap the character. It grows from 96 to 220 px in place. The mic, keyboard, mute and close buttons sit underneath.
- **Ask screen:** the full chat, with voice mode.
- **Tab bar / sidebar:** the character idles there. Tapping it opens Ask.

## 3. Tools (server-executed, row-level security)

The model never receives bulk data. It calls tools, and the server runs each one **as the signed-in user**:

| Tool | Returns |
|---|---|
| `get_budget(month)` | categories, spent, left (shared money) |
| `get_goals(scope)` | shared goals, plus the caller's own private goals |
| `get_week(range)` | events and shifts the caller is allowed to see |
| `get_net_worth()` | accounts marked shared, plus the caller's private ones |
| `simulate(changes)` | What-if result |
| `remember(text, scope)` | stores a memory (section 4) |
| `forget(memory_id)` | deletes a memory the caller owns |

Each tool applies the household share settings (`invShare`: money, goals, cal, docs, debts, remit). Something the user did not share with their partner is never returned in the partner's session.

## 4. Memory, separated per user

### 4.1 Table `assistant_memory`

```
id            uuid
household_id  uuid      -- tenant boundary
owner_id      uuid      -- the person who said it
scope         enum      -- 'private' | 'shared'
text          text      -- one short fact, no raw transcript
source        enum      -- 'voice' | 'chat' | 'manual'
created_at    timestamptz
embedding     vector    -- optional, for retrieval
```

Row-level security policy:

```
SELECT allowed if household_id = auth.household
  AND (scope = 'shared' OR owner_id = auth.uid)
UPDATE / DELETE allowed if owner_id = auth.uid
```

### 4.2 Loading memory into a session

- Load at most about 30 facts: the caller's `private` memories plus the household's `shared` memories, ranked by recency and relevance.
- Facts are injected into the system instructions as a bullet list, labelled per fact as private or shared.
- **Never** load another member's private rows. Isolation comes from the query and RLS, not from prompt wording.

### 4.3 Writing memory

- After each session, a small model call extracts 0–3 durable facts (plans, preferences, recurring habits). It skips one-off numbers already stored in the app data.
- The default scope is **private**. A fact becomes `shared` only if:
  - it concerns shared money or goals, **and**
  - the user said so, or confirmed the in-chat prompt "Save this for both of you?"
- Journal content and private goals are never auto-extracted into shared memory.

### 4.4 User controls (Settings → "What {aiName} remembers")

- A memory on/off toggle. When off, there is no load and no write, and sessions are stateless.
- Private and Shared tabs, with a per-item **Share / Make private** action (owner only) and **Forget**.
- "Forget all my private memories" / "Forget my shared memories" bulk actions.
- A data export includes the user's memories. Account deletion removes all rows where `owner_id` matches.

## 5. Privacy notes

- Audio is streamed and not stored. Transcripts are kept in chat history for 90 days (configurable), then deleted.
- Memories and transcripts are never used for training. Set the provider's zero-retention options where available.
- Support access (Settings → Support access) does **not** include private memories.
