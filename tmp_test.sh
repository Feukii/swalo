#!/bin/bash
# Get fresh tokens
SA_RESP=$(curl -s http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email_or_phone":"superadmin@swalo.com","password":"superadmin123"}')
SA=$(echo "$SA_RESP" | grep -o '"access_token":"[^"]*"' | sed 's/"access_token":"//;s/"//')

EMP_RESP=$(curl -s http://localhost:3000/api/auth/pin -H "Content-Type: application/json" -d '{"shop_code":"011225","pin_code":"1234"}')
EMPLOYEE=$(echo "$EMP_RESP" | grep -o '"access_token":"[^"]*"' | sed 's/"access_token":"//;s/"//')

# Also get BOSS token for shop 011225
BOSS_RESP=$(curl -s http://localhost:3000/api/auth/pin -H "Content-Type: application/json" -d '{"shop_code":"011225","pin_code":"0000"}')
BOSS=$(echo "$BOSS_RESP" | grep -o '"access_token":"[^"]*"' | sed 's/"access_token":"//;s/"//')

API="http://localhost:3000/api"
pass=0
fail=0

if [ -z "$SA" ]; then
  echo "FATAL: Could not get SUPERADMIN token"
  echo "Response: $SA_RESP"
  exit 1
fi
echo "Tokens obtained: SA=${#SA}c, EMP=${#EMPLOYEE}c, BOSS=${#BOSS}c"

test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local token="$4"
  local expect_code="$5"
  local data="$6"

  if [ -n "$data" ]; then
    result=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$data")
  elif [ -n "$token" ]; then
    result=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $token")
  else
    result=$(curl -s -w "\n%{http_code}" -X "$method" "$url")
  fi

  code=$(echo "$result" | tail -1)
  body=$(echo "$result" | head -n -1)

  if [ "$code" = "$expect_code" ]; then
    echo "  PASS  [$name] HTTP $code"
    pass=$((pass + 1))
  else
    echo "  FAIL  [$name] Expected $expect_code, got $code"
    echo "        Body: $(echo "$body" | head -c 200)"
    fail=$((fail + 1))
  fi
}

echo ""
echo "============================================"
echo "  SWALO - TEST EN GRANDEUR NATURE"
echo "  $(date)"
echo "============================================"

# 1. Public endpoints
echo ""
echo "--- 1. ENDPOINTS PUBLICS ---"
test_endpoint "Health (public)" GET "$API/health" "" "200"
test_endpoint "Login endpoint (public, 400=no body)" POST "$API/auth/login" "" "400"
test_endpoint "Verify shop (public)" GET "$API/auth/verify-shop/011225" "" "200"

# 2. Auth guard (401 sans token)
echo ""
echo "--- 2. AUTH GUARD (401 sans token) ---"
test_endpoint "Products sans token" GET "$API/products" "" "401"
test_endpoint "Customers sans token" GET "$API/customers" "" "401"
test_endpoint "Sales sans token" GET "$API/sales" "" "401"
test_endpoint "Cash sans token" GET "$API/cash/entries" "" "401"
test_endpoint "Admin sans token" GET "$API/admin/enterprises" "" "401"
test_endpoint "Suppliers sans token" GET "$API/suppliers" "" "401"

# 3. CRUD endpoints (SUPERADMIN)
echo ""
echo "--- 3. CRUD ENDPOINTS (SUPERADMIN) ---"
test_endpoint "GET Products" GET "$API/products" "$SA" "200"
test_endpoint "GET Customers" GET "$API/customers" "$SA" "200"
test_endpoint "GET Suppliers" GET "$API/suppliers" "$SA" "200"
test_endpoint "GET Sales" GET "$API/sales" "$SA" "200"
test_endpoint "GET Sales stats" GET "$API/sales/stats" "$SA" "200"
test_endpoint "GET Cash entries" GET "$API/cash/entries" "$SA" "200"
test_endpoint "GET Cash balance" GET "$API/cash/balance" "$SA" "200"
test_endpoint "GET Receivables" GET "$API/receivables" "$SA" "200"
test_endpoint "GET Debts" GET "$API/debts" "$SA" "200"
test_endpoint "GET Packaging types" GET "$API/packaging-types" "$SA" "200"
test_endpoint "GET Invoices" GET "$API/invoices" "$SA" "200"
test_endpoint "GET Auth me" GET "$API/auth/me" "$SA" "200"

# 4. FIFO/Multi-prix
echo ""
echo "--- 4. FIFO / MULTI-PRIX ---"
PRODUCT_ID=$(curl -s "$API/products" -H "Authorization: Bearer $SA" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
test_endpoint "GET Product batches" GET "$API/inventory/products/$PRODUCT_ID/batches" "$SA" "200"

# 5. Admin endpoints (SUPERADMIN only)
echo ""
echo "--- 5. ADMIN ENDPOINTS (SUPERADMIN) ---"
test_endpoint "GET Enterprises" GET "$API/admin/enterprises" "$SA" "200"
test_endpoint "GET Shops" GET "$API/admin/shops" "$SA" "200"
test_endpoint "GET Global users" GET "$API/admin/users/global" "$SA" "200"
test_endpoint "GET System stats" GET "$API/admin/stats/system" "$SA" "200"
test_endpoint "GET System config" GET "$API/admin/system-config" "$SA" "200"
test_endpoint "GET Audit logs" GET "$API/admin/audit-logs" "$SA" "200"

# 6. Roles guard (EMPLOYEE restricted)
echo ""
echo "--- 6. ROLES GUARD ---"
test_endpoint "EMPLOYEE -> Admin enterprises (403)" GET "$API/admin/enterprises" "$EMPLOYEE" "403"
test_endpoint "EMPLOYEE -> Admin shops (403)" GET "$API/admin/shops" "$EMPLOYEE" "403"
test_endpoint "EMPLOYEE -> GET Products (200)" GET "$API/products" "$EMPLOYEE" "200"
test_endpoint "EMPLOYEE -> GET Sales (200)" GET "$API/sales" "$EMPLOYEE" "200"

# 7. Block status guard
echo ""
echo "--- 7. BLOCK STATUS GUARD ---"
SHOP_ID=$(echo "$EMP_RESP" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | sed 's/"id":"//;s/"//')
echo "  Shop ID: $SHOP_ID"

test_endpoint "Block shop" POST "$API/admin/shops/$SHOP_ID/block" "$SA" "201" '{"reason":"Test blocage"}'

# Login on blocked shop should fail
BLOCK_LOGIN=$(curl -s -w "\n%{http_code}" "$API/auth/pin" -H "Content-Type: application/json" -d '{"shop_code":"011225","pin_code":"1234"}')
BLOCK_CODE=$(echo "$BLOCK_LOGIN" | tail -1)
BLOCK_BODY=$(echo "$BLOCK_LOGIN" | head -n -1)
if echo "$BLOCK_BODY" | grep -q "bloquée"; then
  echo "  PASS  [Login blocked shop -> rejected] HTTP $BLOCK_CODE (message: bloquee)"
  pass=$((pass + 1))
else
  echo "  FAIL  [Login blocked shop] Expected rejection, got $BLOCK_CODE"
  echo "        Body: $(echo "$BLOCK_BODY" | head -c 200)"
  fail=$((fail + 1))
fi

# Existing token on blocked shop
test_endpoint "Existing token blocked (403)" GET "$API/products" "$EMPLOYEE" "403"

# Unblock
test_endpoint "Unblock shop" POST "$API/admin/shops/$SHOP_ID/unblock" "$SA" "201"
test_endpoint "Access restored" GET "$API/products" "$SA" "200"

# 8. Entitlement guard
echo ""
echo "--- 8. ENTITLEMENT GUARD ---"
test_endpoint "Suppliers module accessible" GET "$API/suppliers" "$EMPLOYEE" "200"
test_endpoint "Receivables module accessible" GET "$API/receivables" "$EMPLOYEE" "200"
test_endpoint "Debts module accessible" GET "$API/debts" "$EMPLOYEE" "200"

# 9. Enterprise management
echo ""
echo "--- 9. ENTERPRISE MANAGEMENT ---"
test_endpoint "GET Enterprise list" GET "$API/enterprises" "$SA" "200"

# 10. Create a sale (write test)
echo ""
echo "--- 10. WRITE OPERATIONS ---"
# Create a customer first
CUST_RESP=$(curl -s "$API/customers" -H "Authorization: Bearer $SA")
CUST_ID=$(echo "$CUST_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
echo "  Using customer: $CUST_ID, product: $PRODUCT_ID"

# Get current stock
STOCK_BEFORE=$(curl -s "$API/inventory/products/$PRODUCT_ID/batches" -H "Authorization: Bearer $SA" | grep -o '"remaining_quantity":[0-9]*' | head -1 | sed 's/"remaining_quantity"://')
echo "  Stock before sale: $STOCK_BEFORE"

# Create a sale
SALE_DATA="{\"items\":[{\"product_id\":\"$PRODUCT_ID\",\"quantity\":1,\"unit_price\":3000}],\"payment_method\":\"CASH\"}"
test_endpoint "Create sale" POST "$API/sales" "$SA" "201" "$SALE_DATA"

# Check stock decreased
STOCK_AFTER=$(curl -s "$API/inventory/products/$PRODUCT_ID/batches" -H "Authorization: Bearer $SA" | grep -o '"remaining_quantity":[0-9]*' | head -1 | sed 's/"remaining_quantity"://')
echo "  Stock after sale: $STOCK_AFTER"
if [ -n "$STOCK_BEFORE" ] && [ -n "$STOCK_AFTER" ] && [ "$STOCK_AFTER" -lt "$STOCK_BEFORE" ]; then
  echo "  PASS  [FIFO destocking] $STOCK_BEFORE -> $STOCK_AFTER"
  pass=$((pass + 1))
else
  echo "  FAIL  [FIFO destocking] Before=$STOCK_BEFORE, After=$STOCK_AFTER"
  fail=$((fail + 1))
fi

echo ""
echo "============================================"
echo "  RESULTATS: $pass PASS / $fail FAIL"
echo "  Total: $((pass + fail)) tests"
echo "============================================"
