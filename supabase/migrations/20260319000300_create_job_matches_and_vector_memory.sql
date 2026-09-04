-- Enable pgvector extension (idempotent)
create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- job_matches table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.job_matches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  title         text,
  company       text,
  url           text,
  description   text,
  match_score   integer not null default 0,
  quality_score integer,
  scam_risk     text not null default 'unknown',
  pay_amount    numeric,
  currency      text,
  source        text,
  raw_payload   jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_job_matches_user_id
  on public.job_matches (user_id);

create index if not exists idx_job_matches_score_risk
  on public.job_matches (match_score desc, scam_risk)
  where scam_risk = 'low';

-- ─────────────────────────────────────────────────────────────────────────────
-- Add vector column to ai_memory for pgvector similarity search
-- ─────────────────────────────────────────────────────────────────────────────
alter table if exists public.ai_memory
  add column if not exists embedding vector(1536);

create index if not exists idx_ai_memory_embedding
  on public.ai_memory
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: search_ai_memory_by_embedding
-- Returns top N memory rows ordered by cosine similarity to a query vector
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.search_ai_memory_by_embedding(
  query_embedding vector(1536),
  match_count     int default 5
)
returns table (
  id            uuid,
  job_match_id  text,
  context       jsonb,
  content       text,
  memory_type   text,
  similarity    float
)
language sql stable
as $$
  select
    id,
    job_match_id,
    context,
    content::text,
    memory_type,
    1 - (embedding <=> query_embedding) as similarity
  from public.ai_memory
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
