-- Family viewers (role 'member') read what they were given and cannot change it.
-- Restrictive policies stack on top of the usual ones, for every shared table.
create or replace function private.can_write()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role <> 'member' from public.members where id = auth.uid()), false)
$$;
revoke all on function private.can_write() from public, anon;
grant execute on function private.can_write() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['categories','recurring','transactions','incomes','goals','debts','subscriptions','remittances',
    'businesses','files','business_months','tax_deadlines','tax_deductions','assets','debt_settings','fx_rates','tax_years',
    'import_mappings','merchant_rules','events','week_priorities','yearly_goals','goal_progress','learning_items',
    'learning_minutes','gym_sessions','date_ideas','date_nights','career_steps','networth_history'] loop
    execute format('create policy "viewers cannot add" on public.%I as restrictive for insert to authenticated with check ((select private.can_write()))', t);
    execute format('create policy "viewers cannot edit" on public.%I as restrictive for update to authenticated using ((select private.can_write()))', t);
    execute format('create policy "viewers cannot delete" on public.%I as restrictive for delete to authenticated using ((select private.can_write()))', t);
  end loop;
end $$;

-- "Load sample data": the prototype's sample household, written as the signed-in
-- person under normal RLS, into their own empty household. Real accounts start empty.
create or replace function public.load_sample_data()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := private.berlin_today();
  m0 date := date_trunc('month', private.berlin_today())::date;
  mon date := date_trunc('week', private.berlin_today())::date;
  studio uuid;
  atelier uuid;
  cat jsonb;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.categories) then raise exception 'not_empty'; end if;

  insert into public.categories (name, icon, monthly_limit, is_fixed, sort) values
    ('Rent & utilities', 'house', 1335, true, 1), ('Insurance & health', 'shield', 325, true, 2),
    ('Transport', 'train-front', 130, true, 3), ('Business tools', 'laptop', 220, true, 4),
    ('Streaming', 'tv', 60, true, 5), ('Groceries', 'shopping-cart', 620, false, 6),
    ('Online shopping', 'package', 250, false, 7), ('Eating out', 'utensils', 200, false, 8),
    ('Tobacco & drinks', 'cigarette', 100, false, 9), ('Personal & gifts', 'gift', 150, false, 10);
  select jsonb_object_agg(name, id) into cat from public.categories;

  insert into public.incomes (name, member_id, kind, monthly_amount) values
    ('Gasthof zur Linde · salary', me, 'Salary', 2150), ('Alex Studio', me, 'Business', 2600), ('Mira Atelier', null, 'Business', 1400);

  insert into public.recurring (name, icon, amount, category_id, day_of_month) values
    ('Rent · Wohnbau München', 'house', -1050, (cat ->> 'Rent & utilities')::uuid, 1),
    ('Stadtwerke · power & water', 'house', -185, (cat ->> 'Rent & utilities')::uuid, 1),
    ('Vodafone · internet & phones', 'smartphone', -100, (cat ->> 'Rent & utilities')::uuid, 1),
    ('Techniker Krankenkasse', 'shield', -280, (cat ->> 'Insurance & health')::uuid, 1),
    ('HUK · liability & home', 'shield', -45, (cat ->> 'Insurance & health')::uuid, 1),
    ('Deutschlandticket ×2', 'train-front', -116, (cat ->> 'Transport')::uuid, 1),
    ('Shopify · Mira Atelier', 'laptop', -39, (cat ->> 'Business tools')::uuid, 12),
    ('Gasthof zur Linde · salary', 'banknote', 2150, null, 28);

  insert into public.transactions (date, amount, payee, category_id) values
    (today, -46.80, 'REWE München', (cat ->> 'Groceries')::uuid),
    (greatest(m0, today - 1), -27.99, 'Amazon.de', (cat ->> 'Online shopping')::uuid),
    (greatest(m0, today - 1), -9.40, 'Aral Tankstelle', (cat ->> 'Tobacco & drinks')::uuid),
    (greatest(m0, today - 2), -59.95, 'Zalando', (cat ->> 'Online shopping')::uuid),
    (greatest(m0, today - 3), 312.40, 'Etsy payout · Mira Atelier', null),
    (greatest(m0, today - 4), -38.50, 'Pizzeria Da Gino', (cat ->> 'Eating out')::uuid);

  insert into public.goals (name, icon, target, current, monthly, is_emergency_fund, visibility) values
    ('Emergency fund · 6 months', 'life-buoy', 18000, 9450, 500, true, 'family'),
    ('Family car', 'car', 14000, 3200, 300, false, 'family'),
    ('Retirement ETF · first milestone', 'trending-up', 20000, 11870, 400, false, 'family'),
    ('Business capital', 'briefcase', 8000, 2750, 150, false, 'family'),
    ('Anniversary weekend, Lake Garda', 'mountain', 900, 540, 60, false, 'private');

  insert into public.debts (name, icon, lender, balance, original, rate_pct, monthly_payment) values
    ('Furniture loan', 'sofa', 'Sparkasse Ratenkredit', 3840, 6000, 6.9, 160),
    ('Family loan · Kopi Kita start', 'users', 'Family, Bandung', 1390, 2500, 0, 60),
    ('Phone financing', 'smartphone', 'o2', 456, 912, 0, 38),
    ('Klarna pay later', 'credit-card', 'Klarna', 286, 480, 0, 95);

  insert into public.remittances (to_name, eur, fee_eur, rate_idr_per_eur, idr_received, provider, purpose, date)
  select v.to_name, v.eur, v.fee, v.rate, round((v.eur - v.fee) * v.rate), v.via, v.purpose, v.d from (values
    ('Mama · Alex’s side', 200, 1.76, 18010, 'Wise', 'Monthly support', today - 30),
    ('Orang tua · Mira’s side', 150, 1.48, 18010, 'Wise', 'Monthly support', today - 30),
    ('Mama · Alex’s side', 200, 1.76, 17880, 'Wise', 'Monthly support', today - 60),
    ('Adik · school fees', 300, 15, 17950, 'Bank transfer', 'School fees', today - 90)
  ) as v(to_name, eur, fee, rate, via, purpose, d);
  insert into public.fx_rates (idr_per_eur) values (18010);

  insert into public.businesses (name, member_id, sort) values ('Alex Studio', me, 1) returning id into studio;
  insert into public.businesses (name, sort) values ('Mira Atelier', 2) returning id into atelier;
  insert into public.business_months (business_id, month, revenue, costs, tax_set_aside)
  select v.b, to_char(m0 - make_interval(months => v.ago), 'YYYY-MM'), v.rev, v.cost, v.tax from (values
    (studio, 1, 2840, 410, 690), (studio, 2, 2350, 395, 560), (studio, 3, 2610, 420, 630),
    (atelier, 1, 1380, 520, 240), (atelier, 2, 1450, 560, 250), (atelier, 3, 1210, 480, 205)
  ) as v(b, ago, rev, cost, tax);

  insert into public.tax_deadlines (title, due_date, amount, kind) values
    ('VAT pre-return', today + 5, 486, 'vat'), ('Income tax return (joint)', make_date(extract(year from today)::int + 1, 7, 31), null, 'return');

  insert into public.assets (name, icon, location, orig_currency, orig_value) values
    ('ETF savings plan', 'trending-up', 'Trade Republic · FTSE All-World', 'EUR', 11870),
    ('Tagesgeld', 'landmark', 'Trade Republic · 2.0% interest', 'EUR', 9450),
    ('Goal pots', 'target', 'Sparkasse sub-accounts', 'EUR', 5950),
    ('Gold', 'gem', '40 g in bars · home safe', 'EUR', 4160),
    ('BCA savings', 'landmark', 'Bank Central Asia', 'IDR', 45000000);

  insert into public.events (title, date, start_time, end_time, kind) values
    ('Pack Atelier orders', mon, '09:00', null, 'event'), ('AI lecture (online)', mon, '10:00', null, 'event'),
    ('Tax papers', mon + 1, '15:00', null, 'event'), ('Gym', mon + 2, '07:30', null, 'event'),
    ('Bar shift', mon + 2, '18:00', '01:00', 'shift'), ('Bar shift', mon + 3, '18:00', '01:00', 'shift'),
    ('Date night', mon + 4, '19:00', null, 'event'), ('VAT pre-return', mon + 5, '09:00', null, 'event');

  insert into public.yearly_goals (name, icon, target, unit, done, step) values
    ('AI studies: 30 ECTS this year', 'graduation-cap', 30, 'ECTS', 21, '6 study hours'),
    ('Alex Studio: 8 new clients', 'laptop', 8, 'clients', 6, '5 outreach messages'),
    ('Atelier: 500 orders', 'scissors', 500, 'orders', 412, '10 orders'),
    ('Gym 3× a week', 'dumbbell', 156, 'sessions', 104, '3 sessions'),
    ('45 date nights', 'heart', 45, 'dates', 33, '1 date night');

  insert into public.learning_items (track, title, type, pct, next) values
    ('Business & marketing', 'Building a StoryBrand', 'book', 60, 'chapter 8'),
    ('Business & marketing', 'Google Digital Marketing & E-commerce', 'course', 45, 'module 4'),
    ('Finance & investing', 'The Psychology of Money', 'book', 100, null),
    ('Finance & investing', 'ETF basics for Germany', 'course', 80, 'Vorabpauschale');

  insert into public.gym_sessions (type, date, time) values
    ('Strength', today, '07:30'), ('Strength', today - 2, '10:00'), ('Cardio', today - 4, '07:30');

  insert into public.date_ideas (name, short, icon, cost) values
    ('Trattoria am Markt + castle walk', 'Dinner, then up to the Willibaldsburg', 'utensils', 70),
    ('Altmühltal sunset walk', 'Picnic on the Jura cliffs', 'mountain', 15),
    ('Cook Sundanese food at home', 'Nasi timbel night, phones away', 'cooking-pot', 25),
    ('Therme Bad Gögging', 'Evening ticket for two', 'waves', 60);
  insert into public.date_nights (name, icon, date, cost, rating) values
    ('Trattoria am Markt + castle walk', 'utensils', today - 5, 64, 5), ('Cinema, Ingolstadt', 'clapperboard', today - 12, 32, 4);

  insert into public.journal_entries (date, text) values
    (today - 1, 'Weber call went fine, they say they''ll pay this week. Tired after the lecture, but the ML stuff is finally clicking.');
end $$;
revoke all on function public.load_sample_data() from public, anon, authenticated;
grant execute on function public.load_sample_data() to authenticated;
