create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  app text not null check (char_length(btrim(app)) between 1 and 100),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved'))
);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated;
grant insert (app, email, message) on public.support_requests to anon;
grant all on public.support_requests to service_role;
create policy "Public can submit support requests"
  on public.support_requests for insert to anon with check (true);
create unique index support_requests_email_minute
  on public.support_requests (lower(email), date_trunc('minute', created_at at time zone 'UTC'));
comment on table public.support_requests is 'Support submissions from aleksanderfigiel.pl/support. Public access is insert-only.';
