-- Phase 3E: a transaction can point to its receipt photo (files.kind = 'receipt').
alter table public.transactions
  add column receipt_file_id uuid references public.files (id) on delete set null;
create index on public.transactions (receipt_file_id) where receipt_file_id is not null;
grant update (receipt_file_id) on public.transactions to authenticated;
