alter table users
add column if not exists max_concurrent_jobs int default 3;
