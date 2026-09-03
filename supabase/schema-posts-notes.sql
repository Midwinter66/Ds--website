-- =============================================================
-- 冬 · 个人数字花园 —— 文章 + 便签 表结构（增量）
-- 在 Supabase 控制台 → SQL Editor 整段粘贴执行一次即可
-- 前置：先执行过 schema.sql（建过 user_store）
-- =============================================================

-- 1. 博客文章表：公开读（published=true 时任何人可见），本人可改删
create table if not exists public.posts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  title       text        not null,
  content_md  text        not null default '',
  tags        text[]      not null default '{}',
  category    text        not null default 'snow',  -- snow/ice/frost/soil/night
  published   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_created_idx
  on public.posts (created_at desc);
create index if not exists posts_user_idx
  on public.posts (user_id);
create index if not exists posts_published_idx
  on public.posts (published) where published = true;

comment on table public.posts is '博客文章。published=true 时匿名可读，本人全权';

alter table public.posts enable row level security;

-- 任何人（含 anon）可读已发布文章
drop policy if exists "公开可读已发布文章" on public.posts;
create policy "公开可读已发布文章"
  on public.posts for select
  to anon, authenticated
  using (published = true);

-- 本人可读自己的所有文章（含草稿）
drop policy if exists "本人可读全部文章" on public.posts;
create policy "本人可读全部文章"
  on public.posts for select
  to authenticated
  using (auth.uid() = user_id);

-- 本人可写/改/删
drop policy if exists "本人可写文章" on public.posts;
create policy "本人可写文章"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "本人可改文章" on public.posts;
create policy "本人可改文章"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "本人可删文章" on public.posts;
create policy "本人可删文章"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- 自动维护 updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();


-- =============================================================
-- 2. 便签表：本人私有，外部完全不可见
-- =============================================================
create table if not exists public.notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  content_md  text        not null default '',
  tags        text[]      not null default '{}',
  color       text        not null default 'default',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_created_idx
  on public.notes (created_at desc);
create index if not exists notes_user_idx
  on public.notes (user_id);

comment on table public.notes is '便签/速记。仅本人可见';

alter table public.notes enable row level security;

drop policy if exists "本人可读便签" on public.notes;
create policy "本人可读便签"
  on public.notes for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "本人可写便签" on public.notes;
create policy "本人可写便签"
  on public.notes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "本人可改便签" on public.notes;
create policy "本人可改便签"
  on public.notes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "本人可删便签" on public.notes;
create policy "本人可删便签"
  on public.notes for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();


-- =============================================================
-- 验证：执行完应看到 posts 5 条策略 + notes 4 条策略
-- select tablename, count(*) from pg_policies where tablename in ('posts','notes') group by 1 order by 1;
-- =============================================================
