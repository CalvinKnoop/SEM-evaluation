-- SEM Circle Study v0.2 -- im SQL Editor deines Supabase-Projekts einmal ausführen.
-- WICHTIG: Die Standard-RLS-Policies NICHT zusätzlich durch "public read" ersetzen.
create table if not exists public.sem_annotations (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null default auth.uid(),
  annotation_id text not null check (length(annotation_id) between 1 and 100),
  participant_id text not null check (length(participant_id) between 1 and 100),
  session_id text not null check (length(session_id) between 1 and 100),
  schema_version smallint not null,
  app_version text not null,
  mode text not null check (mode in ('calibration','real')),
  image_id text not null check (length(image_id) between 1 and 150),
  image_file text not null,
  image_version text not null default 'demo-v01',
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 0 and 604800),
  overlap_rule text not null,
  coordinate_system text not null,
  circles jsonb not null check (jsonb_typeof(circles) = 'array' and jsonb_array_length(circles) <= 3000),
  received_at timestamptz not null default now(),
  unique(auth_user_id,annotation_id)
);

create index if not exists sem_annotations_image_idx on public.sem_annotations (image_id);
create index if not exists sem_annotations_participant_idx on public.sem_annotations (participant_id);

alter table public.sem_annotations enable row level security;
-- Authentifizierte anonyme Nutzer dürfen nur eigene, neue Annotationen schreiben.
-- Keine SELECT-/UPDATE-/DELETE-Policies für Studienteilnehmende!
drop policy if exists "Participants insert own annotations" on public.sem_annotations;
create policy "Participants insert own annotations"
  on public.sem_annotations
  for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

revoke all on table public.sem_annotations from anon, authenticated;
grant insert on table public.sem_annotations to authenticated;
-- Einfügen nutzt die ID-Spalte mit IDENTITY: Postgres kümmert sich um die ID.

-- Stichprobe zur Kontrolle (nur im SQL Editor als Projektadmin ausführen):
-- select image_id, count(*) as annotations, sum(jsonb_array_length(circles)) as circles
-- from public.sem_annotations group by image_id order by image_id;
