/* =============================================================
 * 配置：把 Supabase 的 URL 和 anon key 填进来即可启用云同步
 *
 * 获取方式：Supabase 控制台 → Project Settings → API
 *   - Project URL        → supabaseUrl
 *   - anon public key    → supabaseAnonKey
 *
 * 留空则自动降级为「纯本地模式」，所有功能照常使用，只是不同步。
 * 注意：anon key 是公开可见的前端密钥，安全由 RLS 策略保证，不要填 service_role key。
 * ============================================================= */
window.APP_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
