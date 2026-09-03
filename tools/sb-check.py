import json, urllib.request, urllib.parse

URL = "https://flcctajtgoyzzrdkdsof.supabase.co"
KEY = "sb_publishable_Fauh0Z9v8wAEwyB_Jqkf7A_O_llF9Ex"
EMAIL = "desk-test-1788428098@example.com"
PWD = "Test12345!"

def req(method, path, body=None, token=None, anon=True):
    h = {"Content-Type": "application/json"}
    if anon: h["apikey"] = KEY
    if token: h["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            txt = resp.read().decode()
            return resp.status, txt
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# 1. 登录拿 access token
st, txt = req("POST", "/auth/v1/token?grant_type=password",
              {"email": EMAIL, "password": PWD})
print(f"[1] login: http {st}")
token = json.loads(txt).get("access_token")
print(f"    token: {token[:40]}...")

# 2. sync_store 写入
st, txt = req("POST", "/rest/v1/rpc/sync_store",
              {"p_key": "app_tasks",
               "p_value": {"items": [{"id": 1, "text": "云端闭环测试"}]},
               "p_updated_at": "2026-09-03T09:35:00Z"},
              token=token)
print(f"[2] sync_store: http {st} → {txt[:120]}")

# 3. pull_store 拉回
st, txt = req("POST", "/rest/v1/rpc/pull_store", None, token=token)
print(f"[3] pull_store: http {st} → {txt[:200]}")

# 4. RLS 隔离：anon key 不带 token
st, txt = req("GET", "/rest/v1/user_store?select=*")
print(f"[4] anon read (RLS): http {st} → {txt[:80]}")
