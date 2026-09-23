-- Align public.leads with the inbound lead insertion contract.
alter table public.leads
  add column if not exists phone text,
  add column if not exists score integer default 0;
