create policy "Users can insert their own sessions"
on sessions
for insert
with check (auth.uid() = user_id);
