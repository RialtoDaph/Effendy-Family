# Data model (Postgres / Supabase)

## Conventions
- Every table: `id uuid pk`, `household_id uuid`, `created_at`, `updated_at`.
- User-owned tables also: `owner_id uuid` → members, `visibility text check in ('family','private') default 'family'`.
- Money `numeric(12,2)` in EUR; foreign-currency rows keep `orig_amount`, `orig_currency`, `fx_rate`.
- Timezone per household (default Europe/Berlin).

## Row Level Security (every table with `visibility`)
```sql
using      ( household_id = my_household() and (visibility = 'family' or owner_id = auth.uid()) )
with check ( household_id = my_household() and (visibility = 'family' or owner_id = auth.uid()) )
```
Aggregates are views over these tables, so private rows never enter a partner's totals.

## Account & billing
| Table | Key fields |
|---|---|
| households | name, home_city, currency ('EUR'), timezone |
| members | user_id → auth.users, display_name, role ('owner','partner','member'), avatar_colors |
| subscriptions_billing | household_id, plan ('life','plus','together'), interval ('month','year'), status ('trial','active','past_due','cancelled'), seats, provider_ref, current_period_end |
| usage | member_id, month 'YYYY-MM', ai_messages, voice_seconds, extra_voice_seconds |
| member_settings | member_id, lang ('en','de','id'), theme, palette, ai_name ('Clopar'), voice ('text','audio','both'), brief_at, memory_shared bool, default_visibility jsonb, notif jsonb, warn_pct (80), ef_months (6) |
| security | member_id, pin_hash, pin_salt, failed_count, locked_until, auto_lock_min |
| passkeys | member_id, credential_id, public_key, sign_count, device_name |
| push_subscriptions | member_id, endpoint, p256dh, auth, user_agent |

## Assistant
| Table | Key fields |
|---|---|
| ai_memories | owner_id, scope ('private','shared'), kind ('fact','preference','plan','person'), text, source_session_id, last_used_at, embedding vector |
| ai_sessions | member_id, started_at, ended_at, mode ('voice','text'), seconds, tool_calls jsonb |
| ai_messages | member_id, role, text, cards jsonb — stored only if the user opts in |
| ai_pending_actions | member_id, tool, args jsonb, status ('pending','saved','undone','skipped') |

Memory RLS: `scope = 'private'` → owner only; `scope = 'shared'` → household members, **only when the owner has `memory_shared = true`**. Only the owner can move or delete a memory. See `AI_ASSISTANT.md` §4.

## Money
| Table | Key fields |
|---|---|
| categories | name, icon, monthly_limit, is_fixed, sort |
| transactions | date, amount (− out / + in), payee, category_id, paid_by, source ('manual','recurring','import','receipt','assistant'), import_hash unique, receipt_file_id, note |
| incomes | name, kind ('salary','business','other'), monthly_amount |
| recurring | name, icon, amount, direction ('out','in'), is_subscription bool, category_id, day_of_month 1–28, active, last_posted_month, last_used_at (subs) |
| debts | name, lender, balance, original, rate_pct, monthly_payment |
| debt_settings | strategy ('avalanche','snowball'), extra_per_month |
| goals | name, icon, target, current, monthly, deadline, is_emergency_fund |
| remittances | to_name, eur, fee_eur, rate_idr_per_eur, idr_received, provider, purpose, date |
| fx_rates | date, idr_per_eur, source |
| business_months | business, month 'YYYY-MM', revenue, costs, tax_set_aside, file_id, unique(business, month) |
| tax_deadlines | title, due_date, amount, kind ('vat','prepayment','return'), done |
| assets | name, icon, where, value_eur, orig_currency, orig_value |

Subscriptions are rows in `recurring` with `is_subscription = true` (merged screen).

## Time & health
| Table | Key fields |
|---|---|
| events | title, date, start, end, who, kind ('event','shift') |
| yearly_goals | name, icon, target, unit, done, this_week_step |
| learning_items | track, title, type, pct, next |
| gym_sessions | type, date, minutes |
| journal_entries | date, text — `visibility` forced to `private` |
| date_nights / date_ideas | name, date, cost, rating / name, cost |

## Support
| Table | Key fields |
|---|---|
| alerts_state | alert_key, dismissed_at, done_at (alerts are computed) |
| files | storage_path, kind ('receipt','statement','business_report','roster'), mime, size |
| import_mappings | bank_name, column_map jsonb, delimiter, encoding |
| merchant_rules | pattern, category_id |

## Jobs (Edge Functions + cron, household timezone)
- 05:00 daily: post recurring, update fx, compute alerts, queue pushes.
- Each member's `brief_at`: morning briefing push.
- Every 15 min: shift (−2h), tax (−3d), recurring (−1d) reminders.
- After each AI session: memory extraction → `ai_memories` (private by default).

## Computed
Money left = Σ flexible limits − Σ flexible spent · per day = left / days left · EF months = fund / Σ limits · goal ETA = remaining / monthly · debt payoff month-by-month (extra rolls over) · net worth = Σ assets − Σ debts.
