create table user_reputation (
 id uuid default uuid_generate_v4() primary key,
 user_id text,
 jobs_completed int default 0,
 client_rating numeric default 5.0,
 response_speed numeric default 100,
 automation_success numeric default 100,
 reputation_score numeric default 50,
 updated_at timestamp default now()
);
