-- =============================================================
-- 冬 · 个人数字花园 —— Supabase 云存储表结构
-- 在 Supabase 控制台 → SQL Editor 里整段粘贴执行一次即可
-- =============================================================

-- 1. 主数据表：每个用户每个 key 一行，value 存 JSON
create table if not exists public.user_store (
  user_id     uuid           not null references auth.users (id) on delete cascade,
  key         text           not null,
  value       jsonb          not null default 'null'::jsonb,
  updated_at  timestamptz    not null default now(),
  primary key (user_id, key)
);

create index if not exists user_store_user_id_idx
  on public.user_store (user_id);

comment on table public.user_store is '前端 localStorage 的云端镜像，key/value 与 app_* 键一一对应';

-- 2. 行级安全：只允许本人读写自己的数据
alter table public.user_store enable row level security;

drop policy if exists "本人可读" on public.user_store;
create policy "本人可读"
  on public.user_store for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "本人可写" on public.user_store;
create policy "本人可写"
  on public.user_store for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "本人可改" on public.user_store;
create policy "本人可改"
  on public.user_store for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "本人可删" on public.user_store;
create policy "本人可删"
  on public.user_store for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3. 同步函数：按客户端时间戳做「最后写入者胜」合并
--    本地比云端新 → 写入并返回本地值
--    云端比本地新 → 不写入，返回云端值（由前端覆盖本地）
create or replace function public.sync_store(
  p_key        text,
  p_value      jsonb,
  p_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_remote_at timestamptz;
begin
  if v_uid is null then
    raise exception '未登录，拒绝同步';
  end if;

  select updated_at into v_remote_at
    from public.user_store
   where user_id = v_uid and key = p_key;

  if v_remote_at is null or p_updated_at >= v_remote_at then
    insert into public.user_store (user_id, key, value, updated_at)
      values (v_uid, p_key, p_value, p_updated_at)
    on conflict (user_id, key) do update
      set value      = excluded.value,
          updated_at = excluded.updated_at;
    return p_value;
  end if;

  -- 云端更新，把云端值回给前端
  return (select value from public.user_store where user_id = v_uid and key = p_key);
end;
$$;

revoke all on function public.sync_store(text, jsonb, timestamptz) from anon;
grant execute on function public.sync_store(text, jsonb, timestamptz) to authenticated;

-- 4. 全量拉取函数（可选，前端直接查表也行）
create or replace function public.pull_store()
returns table (key text, value jsonb, updated_at timestamptz)
language sql
security invoker
set search_path = public
as $$
  select s.key, s.value, s.updated_at
    from public.user_store s
   where s.user_id = auth.uid();
$$;

revoke all on function public.pull_store() from anon;
grant execute on function public.pull_store() to authenticated;

-- =============================================================
-- 验证：执行完应看到 4 条策略 + 2 个函数
-- select tablename, count(*) from pg_policies where tablename='user_store' group by 1;
-- =============================================================
