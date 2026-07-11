# Rollback da migration financeira

Migration: `20260711150000_real_finance_imports.sql`

Não executar automaticamente. O rollback destrói somente objetos criados por esta migration e pode apagar dados inseridos neles. Antes de usar, faça backup lógico e confirme que não existem dados aprovados.

```sql
begin;
drop table if exists public.transaction_links;
drop table if exists public.installments;
drop table if exists public.installment_groups;
drop table if exists public.invoice_items;
drop table if exists public.receivable_receipts;
drop table if exists public.future_expense_predictions;
drop table if exists public.receivables;
drop table if exists public.import_rows;
drop table if exists public.import_files;
drop table if exists public.import_batches;
drop table if exists public.invoices;
drop table if exists public.merchants;
drop table if exists public.categories;
drop table if exists public.credit_cards;
drop table if exists public.financial_accounts;
drop function if exists public.set_updated_at();
commit;
```
