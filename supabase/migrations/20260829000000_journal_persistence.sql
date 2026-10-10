-- Persistent General Ledger storage for imported and manually posted journal entries.
-- The client-side ERP store remains the working ledger; this schema makes the
-- explicit "save to database" action durable without changing the existing
-- operational tables.

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id text PRIMARY KEY,
  branch_id text NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  reference text,
  currency text NOT NULL DEFAULT 'USD',
  created_by text,
  is_approved boolean NOT NULL DEFAULT true,
  sequence integer,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id text PRIMARY KEY,
  journal_entry_id text NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  account_code text NOT NULL,
  debit numeric(24,8) NOT NULL DEFAULT 0,
  credit numeric(24,8) NOT NULL DEFAULT 0,
  currency text,
  rate numeric(24,10) NOT NULL DEFAULT 1,
  cost_center text,
  description text,
  UNIQUE (journal_entry_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries(reference);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_code);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read journal entries" ON public.journal_entries;
CREATE POLICY "authenticated read journal entries"
  ON public.journal_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated write journal entries" ON public.journal_entries;
CREATE POLICY "authenticated write journal entries"
  ON public.journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read journal lines" ON public.journal_lines;
CREATE POLICY "authenticated read journal lines"
  ON public.journal_lines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated write journal lines" ON public.journal_lines;
CREATE POLICY "authenticated write journal lines"
  ON public.journal_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
