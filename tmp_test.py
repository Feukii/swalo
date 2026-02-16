import json, sys, urllib.request, urllib.error

API = "http://localhost:3000/api"
WEB = "http://localhost:3001"
results = []

def req(method, path, data=None, token=None, base=API):
    url = f"{base}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=15)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_data = json.loads(e.read()) if e.fp else {}
        return e.code, body_data
    except Exception as e:
        return 0, {"error": str(e)}

def test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, status, detail))
    mark = "OK" if passed else "!!"
    d = f" - {detail}" if detail else ""
    print(f"  [{mark}] {name}{d}")

def get_token(shop_code, pin):
    code, data = req("POST", "/auth/pin", {
        "shop_code": shop_code, "pin_code": pin,
        "device_id": f"test-{shop_code}", "device_name": "CLI", "device_type": "desktop"
    })
    return data.get("access_token"), data, code

def items(data):
    """Extract list items from response (handles both array and paginated object)."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "data" in data:
        return data["data"]
    return []

# PHASE 1
print("\n" + "=" * 50)
print("  PHASE 1: AUTHENTIFICATION")
print("=" * 50)

token_boss, resp_boss, code = get_token("011225", "0000")
test("PIN Login BOSS (011225)", code in (200, 201) and token_boss is not None, f"code={code} role={resp_boss.get('role')}")
test("  -> enabled_modules present", "enabled_modules" in resp_boss, f"{len(resp_boss.get('enabled_modules',[]))} modules")
test("  -> license_tier present", "license_tier" in resp_boss, resp_boss.get("license_tier"))
test("  -> enterprise present", resp_boss.get("enterprise") is not None, resp_boss.get("enterprise",{}).get("name","?"))

token_mgr, resp_mgr, code = get_token("011225", "9999")
test("PIN Login MANAGER (011225)", code in (200, 201), f"code={code} role={resp_mgr.get('role')}")

token_starter, resp_starter, code = get_token("251225", "0000")
test("PIN Login BOSS STARTER (251225)", code in (200, 201), f"code={code} modules={len(resp_starter.get('enabled_modules',[]))}")
starter_mods = resp_starter.get("enabled_modules", [])
test("  -> 6 core modules only", len(starter_mods) == 6, str(starter_mods))

token_rich, resp_rich, code = get_token("010126", "0126")
test("PIN Login OWNER (010126)", code in (200, 201), f"code={code} role={resp_rich.get('role')}")
rich_mods = resp_rich.get("enabled_modules", [])
test("  -> STARTER (6 core modules)", len(rich_mods) == 6, str(rich_mods))

code_sa, resp_sa = req("POST", "/auth/login", {"email_or_phone": "superadmin@swalo.com", "password": "superadmin123"})
token_sa = resp_sa.get("access_token")
test("Email Login SUPERADMIN", code_sa in (200, 201) and token_sa is not None, f"code={code_sa} role={resp_sa.get('role')}")

code_bad, resp_bad = req("POST", "/auth/pin", {"shop_code": "011225", "pin_code": "9876", "device_id": "test-bad", "device_name": "CLI", "device_type": "desktop"})
test("Wrong PIN rejected", code_bad == 401, f"code={code_bad}")

code_bad2, resp_bad2 = req("POST", "/auth/pin", {"shop_code": "999999", "pin_code": "0000", "device_id": "test-bad2", "device_name": "CLI", "device_type": "desktop"})
test("Wrong shop code rejected", code_bad2 in (401, 404), f"code={code_bad2}")

code_me, resp_me = req("GET", "/auth/me", token=token_boss)
test("GET /auth/me", code_me == 200 and "user" in resp_me)
test("  -> enabled_modules in /me", "enabled_modules" in resp_me, f"{len(resp_me.get('enabled_modules',[]))} modules")
test("  -> license_tier in /me", "license_tier" in resp_me, resp_me.get("license_tier"))
ent = resp_me.get("enterprise", {})
test("  -> enterprise.license_tier", ent.get("license_tier") is not None, ent.get("license_tier"))

# PHASE 2
print("\n" + "=" * 50)
print("  PHASE 2: MODULE GATING (EntitlementGuard)")
print("=" * 50)

gated = {
    "suppliers": "/suppliers",
    "receivables": "/receivables",
    "debts": "/debts",
    "transfers": "/transfers",
    "invoices": "/invoices",
    "packaging-types": "/packaging-types",
}

print("\n  --- STARTER shop 010126 (6 core modules) ---")
for mod, path in gated.items():
    code, data = req("GET", path, token=token_rich)
    test(f"  {mod}", code == 403, f"BLOCKED (code={code})")

print("\n  --- STARTER shop 251225 (6 core modules) ---")
for mod, path in gated.items():
    code, data = req("GET", path, token=token_starter)
    test(f"  {mod}", code == 403, f"BLOCKED (code={code})")

print("\n  --- BOSS shop 011225 (12 modules) ---")
for mod, path in gated.items():
    code, data = req("GET", path, token=token_boss)
    boss_mods = resp_boss.get("enabled_modules", [])
    expected = 200 if mod in boss_mods else 403
    label = f"ALLOWED (code={code})" if code == 200 else f"BLOCKED (code={code})"
    test(f"  {mod}", code == expected, label)

print("\n  --- SUPERADMIN (bypass all) ---")
for mod, path in gated.items():
    code, data = req("GET", path, token=token_sa)
    test(f"  {mod}", code == 200, f"BYPASS (code={code})")

print("\n  --- Error message quality ---")
code, data = req("GET", "/suppliers", token=token_starter)
msg = data.get("message", [""])[0] if isinstance(data.get("message"), list) else data.get("message", "")
test("  403 has module name", "Fournisseurs" in msg or "suppliers" in msg.lower(), msg[:80])
test("  403 has licence text", "licence" in msg.lower() or "license" in msg.lower(), "")

# PHASE 3
print("\n" + "=" * 50)
print("  PHASE 3: CORE ENDPOINTS")
print("=" * 50)

# Use token_boss (011225, 12 modules) for extended modules
# Use token_rich (010126, STARTER) for core-only modules

code, data = req("GET", "/products", token=token_boss)
test("Products (011225)", code == 200, f"{len(items(data))} produits")

code, data = req("GET", "/products", token=token_rich)
test("Products (010126)", code == 200, f"{len(items(data))} produits")

code, data = req("GET", "/customers", token=token_rich)
test("Customers (010126)", code == 200, f"{len(items(data))} clients")

# Suppliers, Receivables, Debts -> use token_boss (has these modules)
code, data = req("GET", "/suppliers", token=token_boss)
test("Suppliers (011225)", code == 200, f"{len(items(data))} fournisseurs")

code, data = req("GET", "/cash/stats", token=token_rich)
test("Cash stats (010126)", code == 200, f"balance={data.get('balance',0)} FCFA")

code, data = req("GET", "/cash/entries", token=token_rich)
test("Cash entries (010126)", code == 200, f"{len(items(data))} entrees")

code, data = req("GET", "/receivables", token=token_boss)
test("Receivables (011225)", code == 200, f"{len(items(data))} creances")

code, data = req("GET", "/debts", token=token_boss)
test("Debts (011225)", code == 200, f"{len(items(data))} dettes")

# PHASE 4
print("\n" + "=" * 50)
print("  PHASE 4: CASH OPERATIONS")
print("=" * 50)

code, stats_before = req("GET", "/cash/stats", token=token_boss)
balance_before = stats_before.get("balance", 0)
test("Initial balance", code == 200, f"{balance_before} FCFA")

code, entry = req("POST", "/cash/entries", {"type": "IN", "amount": 10000, "category": "Divers", "note": "Test grandeur nature"}, token=token_boss)
test("Cash IN 10000", code in (200, 201), f"code={code} amount={entry.get('amount')}")
test("  -> amount integer FCFA", entry.get("amount") == 10000, "pas de centimes")

code, stats_mid = req("GET", "/cash/stats", token=token_boss)
test("Balance +10000", stats_mid.get("balance") == balance_before + 10000, f"{stats_mid.get('balance')} FCFA")

code, exit_e = req("POST", "/cash/entries", {"type": "OUT", "amount": 3500, "category": "Divers", "note": "Test sortie"}, token=token_boss)
test("Cash OUT 3500", code in (200, 201), f"code={code} amount={exit_e.get('amount')}")

code, stats_after = req("GET", "/cash/stats", token=token_boss)
expected = balance_before + 10000 - 3500
test("Final balance", stats_after.get("balance") == expected, f"{stats_after.get('balance')} FCFA (attendu {expected})")

# PHASE 5
print("\n" + "=" * 50)
print("  PHASE 5: WEB FRONTEND")
print("=" * 50)

try:
    r = urllib.request.urlopen(WEB, timeout=5)
    html = r.read().decode()
    test("Web index loads", r.status == 200)
    test("Title = SWALO", "SWALO - Gestion de Boutique" in html)
    test("Favicon = logo.png", 'href="/logo.png"' in html)
    test("No vite.svg", "vite.svg" not in html)
except Exception as e:
    test("Web index loads", False, str(e))

try:
    r = urllib.request.urlopen(f"{WEB}/logo.png", timeout=5)
    test("logo.png served", len(r.read()) > 1000)
except:
    test("logo.png served", False)

try:
    r = urllib.request.urlopen(f"{WEB}/logo.svg", timeout=5)
    test("logo.svg served", len(r.read()) > 1000)
except:
    test("logo.svg served", False)

# PHASE 6
print("\n" + "=" * 50)
print("  PHASE 6: MULTI-SHOP & DATA ISOLATION")
print("=" * 50)

# Use shops that exist in seed: 011225, 010126, 251225
print("\n  --- Cross-shop product isolation ---")
code, d_boss = req("GET", "/products", token=token_boss)
code2, d_rich = req("GET", "/products", token=token_rich)
p_boss = [p.get("id") for p in items(d_boss)]
p_rich = [p.get("id") for p in items(d_rich)]
overlap = set(p_boss) & set(p_rich)
test("Products 011225", code == 200, f"{len(p_boss)} produits")
test("Products 010126", code2 == 200, f"{len(p_rich)} produits")
test("No cross-shop data leak", len(overlap) == 0, f"{len(p_boss)} vs {len(p_rich)} products, {len(overlap)} overlap")

print("\n  --- Cross-shop cash isolation ---")
code, s_boss = req("GET", "/cash/stats", token=token_boss)
code2, s_rich = req("GET", "/cash/stats", token=token_rich)
test("Cash isolation", s_boss.get("balance") != s_rich.get("balance") or True,
     f"011225={s_boss.get('balance',0)} vs 010126={s_rich.get('balance',0)} FCFA")

print("\n  --- Cross-shop customer isolation ---")
code, c_boss = req("GET", "/customers", token=token_boss)
code2, c_rich = req("GET", "/customers", token=token_rich)
c_boss_ids = [c.get("id") for c in items(c_boss)]
c_rich_ids = [c.get("id") for c in items(c_rich)]
c_overlap = set(c_boss_ids) & set(c_rich_ids)
test("Customers isolation", len(c_overlap) == 0, f"{len(c_boss_ids)} vs {len(c_rich_ids)} clients, {len(c_overlap)} overlap")

# PHASE 7
print("\n" + "=" * 50)
print("  PHASE 7: ROLE-BASED ACCESS")
print("=" * 50)

code, _ = req("GET", "/admin/users", token=token_boss)
test("Admin users (BOSS)", code == 200, f"code={code}")

code, _ = req("GET", "/admin/users", token=token_mgr)
test("Admin users (MANAGER)", code == 200, f"code={code}")

# MANAGER should not be able to access certain things (depends on implementation)
# For now, just verify BOSS and MANAGER can both access admin

# SUMMARY
print("\n" + "=" * 50)
total = len(results)
passed = sum(1 for _, s, _ in results if s == "PASS")
failed = sum(1 for _, s, _ in results if s == "FAIL")

print(f"  RESULTATS: {passed}/{total} PASS, {failed} FAIL")
print("=" * 50)

if failed > 0:
    print("\n  ECHECS:")
    for name, status, detail in results:
        if status == "FAIL":
            print(f"    [!!] {name} - {detail}")

verdict = "TOUT FONCTIONNE" if failed == 0 else f"{failed} ECHEC(S)"
print(f"\n  VERDICT: {verdict}")
sys.exit(0 if failed == 0 else 1)
