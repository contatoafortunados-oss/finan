create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, institution text, account_type text not null default 'checking',
  currency char(3) not null default 'BRL', status text not null default 'active', source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, issuer text, last_four text, closing_day smallint check (closing_day between 1 and 31), due_day smallint check (due_day between 1 and 31),
  credit_limit numeric(14,2) check (credit_limit >= 0), status text not null default 'active', source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'review', file_count integer not null default 0, row_count integer not null default 0,
  imported_count integer not null default 0, duplicate_count integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid references public.credit_cards(id) on delete set null, reference_month date not null,
  opened_at date, closed_at date, due_at date, total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0, status text not null default 'open', source text not null default 'manual',
  source_file_hash text, import_batch_id uuid references public.import_batches(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique nulls not distinct(user_id, credit_card_id, reference_month)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, parent_id uuid references public.categories(id) on delete set null, source text not null default 'system',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique nulls not distinct(user_id, name, parent_id)
);

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, name)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade, transaction_id uuid references public.transactions(id) on delete set null,
  original_description text not null, normalized_description text, merchant_id uuid references public.merchants(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null, transaction_date date, amount numeric(14,2) not null check (amount >= 0),
  type text not null default 'expense' check (type in ('income','expense','credit','refund','fee','interest')),
  installment_number integer, installment_total integer, source text not null default 'invoice', status text not null default 'review',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists public.import_files (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid references public.import_batches(id) on delete set null, filename text not null, mime_type text not null,
  file_hash text not null, file_size bigint not null check (file_size >= 0), page_count integer, parser_status text not null default 'needs_review',
  created_at timestamptz not null default now(), unique(user_id, file_hash)
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade, import_file_id uuid references public.import_files(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null, original_description text, normalized_description text,
  merchant_name text, category_id uuid references public.categories(id) on delete set null, transaction_date date, amount numeric(14,2),
  type text check (type in ('income','expense','credit','refund','fee','interest')), installment_number integer, installment_total integer,
  duplicate_status text not null default 'not_duplicate', review_status text not null default 'pending', confidence text not null default 'unclassified',
  note text, raw_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  description text not null, origin text, payer text, category_id uuid references public.categories(id) on delete set null,
  expected_amount numeric(14,2) not null check (expected_amount >= 0), received_amount numeric(14,2) not null default 0 check (received_amount >= 0),
  expected_date date, effective_date date, account_id uuid references public.financial_accounts(id) on delete set null,
  certainty text not null default 'possible' check (certainty in ('confirmed','probable','possible')),
  status text not null default 'forecast', source text not null default 'manual', note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (received_amount <= expected_amount)
);

create table if not exists public.receivable_receipts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  receivable_id uuid not null references public.receivables(id) on delete cascade, amount numeric(14,2) not null check (amount > 0), received_at date not null, note text, created_at timestamptz not null default now()
);

create table if not exists public.future_expense_predictions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  description text not null, estimated_amount numeric(14,2) not null check (estimated_amount >= 0), estimated_date date,
  category_id uuid references public.categories(id) on delete set null, credit_card_id uuid references public.credit_cards(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null, certainty text not null default 'possible' check (certainty in ('confirmed','probable','possible')),
  recurring boolean not null default false, status text not null default 'active', linked_transaction_id uuid references public.transactions(id) on delete set null,
  note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  action text not null, entity_type text not null, entity_id uuid, before_data jsonb, after_data jsonb, source text not null default 'app', created_at timestamptz not null default now()
);

create table if not exists public.installment_groups (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  description text not null, merchant_id uuid references public.merchants(id) on delete set null, credit_card_id uuid references public.credit_cards(id) on delete set null,
  total_installments integer check (total_installments > 0), total_amount numeric(14,2) check (total_amount >= 0), source text not null default 'manual', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.installment_groups(id) on delete cascade, invoice_id uuid references public.invoices(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null, installment_number integer not null check (installment_number > 0), amount numeric(14,2) not null check (amount >= 0), due_date date, status text not null default 'forecast', created_at timestamptz not null default now(), unique(user_id, group_id, installment_number)
);

create table if not exists public.transaction_links (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete cascade, target_transaction_id uuid references public.transactions(id) on delete cascade,
  prediction_id uuid references public.future_expense_predictions(id) on delete cascade, link_type text not null, created_at timestamptz not null default now(), check (target_transaction_id is not null or prediction_id is not null)
);

do $$ declare t text; begin
  foreach t in array array['financial_accounts','credit_cards','invoices','invoice_items','categories','merchants','import_batches','import_files','import_rows','receivables','receivable_receipts','future_expense_predictions','audit_logs','installment_groups','installments','transaction_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner access" on public.%I', t);
    execute format('create policy "owner access" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke delete on public.%I from authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

create index if not exists import_rows_batch_idx on public.import_rows(user_id, import_batch_id);
create index if not exists receivables_expected_date_idx on public.receivables(user_id, expected_date);
create index if not exists predictions_date_idx on public.future_expense_predictions(user_id, estimated_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['financial_accounts','credit_cards','invoices','invoice_items','categories','merchants','import_batches','import_files','import_rows','receivables','future_expense_predictions','installment_groups'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
