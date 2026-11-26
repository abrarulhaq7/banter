-- Minimal stand-ins for the parts of Supabase that the migrations depend on, so the
-- migrations and access rules can be tested on a plain local Postgres (scripts/test-db.sh).
-- This file is never applied to the real Supabase project.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase has historically granted everything on new public tables to these roles and
-- left protection to row-level security. Copy that here, so the tests prove the
-- migrations lock the tables down even when starting from the permissive setup.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

-- auth ---------------------------------------------------------------------------------
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Like Supabase: the signed-in user's id comes from the request's token.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

-- storage ------------------------------------------------------------------------------
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Same result as Supabase's storage.foldername: the folders of a path, without the file.
create function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- test helpers ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.ok(passed boolean, label text)
returns void
language plpgsql
as $$
begin
  if passed is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok - %', label;
end;
$$;

-- Passes when the statement is refused (by a privilege, a policy or a constraint).
create function tests.refused(statement text, label text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok - % [%]', label, sqlerrm;
    return;
  end;
  raise exception 'FAILED, the statement was allowed: %', label;
end;
$$;

-- Runs the statement and returns how many rows it changed.
create function tests.changed(statement text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;
