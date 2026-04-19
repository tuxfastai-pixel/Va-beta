alter table if exists public.users
  add column if not exists referral_code text,
  add column if not exists referred_by text;

create unique index if not exists idx_users_referral_code_unique
  on public.users (referral_code)
  where referral_code is not null;
