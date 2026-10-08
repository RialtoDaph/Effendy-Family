# Data model (Postgres / Supabase)

## Conventions
- Every table has: `id uuid pk`, `household_id uuid`, `created_at`, `updated_at`.
- Every user-owned table also has: `owner_id uuid` (references a member) and `visibility text check in ('family','private') default 'family'`.
- Money is stored as `numeric(12,2)` in **EUR**. Rows that started in another currency also keep `orig_amount`, `orig_currency` ('IDR') and `fx_rate`.
- Dates are stored as `date`; times as `time`; timezone is Europe/Berlin.

## Row Level Security (apply to every table with `visibility`)
```sql
-- read
using ( household_id = my_household()
        and (visibility = 'family' or owner_id = auth.uid()) )
-- write
with check ( household_id = my_household()
             and (visibility = 'family' or owner_id = auth.uid()) )
```
`my_household()` is a SQL function that returns the household of `auth.uid()`. Aggregates, such as budget totals, are views on top of these tables, so private rows are automatically left out of the partner's totals.

## Tables
| Table | Key fields |
|---|---|
| households | name, home_city, currency ('EUR') |
| members | user_id → auth.users, display_name, role ('admin'), avatar_colors |
| member_settings | member_id, theme, palette, default_visibility jsonb (per module), notif jsonb {bills,tax,shifts,budget,goals,time}, warn_pct (80), ef_months (6) |
| security | member_id, pin_hash, pin_salt, failed_count, locked_until, auto_lock_min (0/1/5) |
| passkeys | member_id, credential_id, public_key, sign_count, device_name |
| push_subscriptions | member_id, endpoint, p256dh, auth, user_agent |
| categories | name, icon, monthly_limit, is_fixed, sort |
| transactions | date, amount (− out / + in), payee, category_id, paid_by (member or 'family'), source ('manual','recurring','import','receipt'), import_hash unique, receipt_file_id, note |
| incomes | name, owner, kind ('Salary','Business','Other'), monthly_amount |
| recurring | name, icon, amount, category_id, paid_by, day_of_month 1–28, active bool, last_posted_month 'YYYY-MM' |
| subscriptions | name, monthly_price, for_whom, last_used_at, status ('active','cancel_requested','cancelled') |
| debts | name, lender, balance, original, rate_pct, monthly_payment |
| debt_settings | strategy ('avalanche','snowball'), extra_per_month |
| goals | name, icon, target, current, monthly, deadline, is_emergency_fund bool |
| remittances | to_name, eur, fee_eur, rate_idr_per_eur, idr_received, provider, purpose, date |
| fx_rates | date, idr_per_eur, source |
| business_months | business ('studio','atelier'), month 'YYYY-MM', revenue, costs, tax_set_aside, file_id, unique(business, month) |
| tax_deadlines | title, due_date, amount, kind ('vat','prepayment','return'), done |
| assets | name, icon, where, value_eur, orig_currency, orig_value, facts jsonb |
| events | title, day/date, start, end, who ('r','a','t'), kind ('event','shift') |
| yearly_goals | name, icon, target, unit, done, this_week_step |
| learning_items | track, title, type, pct, next |
| learning_minutes | member, week, minutes |
| gym_sessions | type, icon, date |
| journal_entries | date, text (default visibility = private) |
| date_nights | name, icon, date, cost, rating |
| date_ideas | name, short, cost, from_category |
| alerts_state | alert_key, dismissed_at / done_at (alerts themselves are computed, not stored) |
| files | storage_path, kind ('receipt','statement','business_report','roster'), mime, size, uploaded_by |
| import_mappings | bank_name, column_map jsonb, delimiter, encoding |
| merchant_rules | pattern, category_id (learned from user corrections) |
| ai_messages | member, role, text, numbers jsonb (only stored if the user opts in) |

## Server jobs (Edge Functions + cron, Europe/Berlin)
- **05:00 daily:** post recurring items; update fx_rates (optional); compute the alerts; queue pushes.
- **At each member's summary time:** send the morning summary push.
- **Every 15 minutes:** shift reminders (2 hours before), tax deadlines (3 days before), recurring items (1 day before).

## Computed (not stored)
- Flexible money left = Σ flexible limits − Σ flexible spent.
- Daily allowance = flexible left / days left in the month.
- Emergency-fund months = fund.current / Σ category limits.
- Budget statuses: see the README.
- Goal ETA = remaining / monthly.
- Debt payoff simulation: month-by-month; avalanche (highest rate first) or snowball (smallest balance first); extra money rolls over to the next debt.
- Net worth = Σ assets − Σ debts.
