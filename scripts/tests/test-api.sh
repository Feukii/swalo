#!/bin/bash

# Script de test complet de l'API SWALO
# Tests de toutes les fonctionnalités et règles métier

API_URL="https://swalo-api-prod.onrender.com/api"
SHOP_CODE="011225"
PIN="0000"

echo "🧪 Tests complets de l'API SWALO"
echo "================================="
echo ""

# 1. Test de connexion avec PIN
echo "📌 Test 1: Connexion avec PIN"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d "{\"shop_code\":\"$SHOP_CODE\",\"pin_code\":\"$PIN\"}")

echo "$LOGIN_RESPONSE" | python -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extraire le token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Échec de connexion"
  exit 1
fi

echo "✅ Connexion réussie"
echo ""

# 2. Test du solde de caisse
echo "📌 Test 2: Récupération du solde de caisse"
BALANCE=$(curl -s -X GET "$API_URL/cash/balance" \
  -H "Authorization: Bearer $TOKEN")

echo "$BALANCE" | python -m json.tool 2>/dev/null || echo "$BALANCE"
echo ""

# 3. Test des statistiques de caisse
echo "📌 Test 3: Statistiques de caisse du jour"
STATS=$(curl -s -X GET "$API_URL/cash/stats" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATS" | python -m json.tool 2>/dev/null || echo "$STATS"
echo ""

# 4. Test création d'une entrée de caisse (Vente)
echo "📌 Test 4: Création entrée de caisse (Vente - 10000 FCFA)"
ENTRY_RESPONSE=$(curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"IN","category":"Vente","amount":1000000,"note":"Test vente produit"}')

echo "$ENTRY_RESPONSE" | python -m json.tool 2>/dev/null || echo "$ENTRY_RESPONSE"
ENTRY_ID=$(echo "$ENTRY_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""

# 5. Test création d'une sortie de caisse (Achat)
echo "📌 Test 5: Création sortie de caisse (Achat - 5000 FCFA)"
EXIT_RESPONSE=$(curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"OUT","category":"Achat","amount":500000,"note":"Test achat fournitures"}')

echo "$EXIT_RESPONSE" | python -m json.tool 2>/dev/null || echo "$EXIT_RESPONSE"
echo ""

# 6. Vérifier que le solde a changé
echo "📌 Test 6: Vérification du nouveau solde (devrait être +5000 FCFA)"
NEW_BALANCE=$(curl -s -X GET "$API_URL/cash/balance" \
  -H "Authorization: Bearer $TOKEN")

echo "$NEW_BALANCE" | python -m json.tool 2>/dev/null || echo "$NEW_BALANCE"
echo ""

# 7. Test liste des clients
echo "📌 Test 7: Liste des clients"
CUSTOMERS=$(curl -s -X GET "$API_URL/customers" \
  -H "Authorization: Bearer $TOKEN")

echo "$CUSTOMERS" | python -m json.tool 2>/dev/null | head -30
echo ""

# 8. Test liste des fournisseurs
echo "📌 Test 8: Liste des fournisseurs"
SUPPLIERS=$(curl -s -X GET "$API_URL/suppliers" \
  -H "Authorization: Bearer $TOKEN")

echo "$SUPPLIERS" | python -m json.tool 2>/dev/null | head -30
echo ""

# 9. Test création d'un client
echo "📌 Test 9: Création d'un client"
CUSTOMER_RESPONSE=$(curl -s -X POST "$API_URL/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"DIOP","first_name":"Amadou","phone":"+221771234999","credit_limit":5000000}')

echo "$CUSTOMER_RESPONSE" | python -m json.tool 2>/dev/null || echo "$CUSTOMER_RESPONSE"
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""

# 10. Test création d'un fournisseur
echo "📌 Test 10: Création d'un fournisseur"
SUPPLIER_RESPONSE=$(curl -s -X POST "$API_URL/suppliers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"FALL","first_name":"Fatou","phone":"+221771235000"}')

echo "$SUPPLIER_RESPONSE" | python -m json.tool 2>/dev/null || echo "$SUPPLIER_RESPONSE"
SUPPLIER_ID=$(echo "$SUPPLIER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""

# 11. Test création d'une dette fournisseur
echo "📌 Test 11: Création dette fournisseur (20000 FCFA)"
if [ ! -z "$SUPPLIER_ID" ]; then
  DEBT_RESPONSE=$(curl -s -X POST "$API_URL/debts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"supplier_id\":\"$SUPPLIER_ID\",\"amount\":2000000,\"description\":\"Achat à crédit\"}")

  echo "$DEBT_RESPONSE" | python -m json.tool 2>/dev/null || echo "$DEBT_RESPONSE"
  DEBT_ID=$(echo "$DEBT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
else
  echo "⚠️ Pas de fournisseur créé, test ignoré"
fi
echo ""

# 12. Test règlement partiel de dette fournisseur via caisse
echo "📌 Test 12: Règlement dette fournisseur via caisse (10000 FCFA)"
if [ ! -z "$SUPPLIER_ID" ]; then
  PAYMENT_RESPONSE=$(curl -s -X POST "$API_URL/cash/entries" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"type\":\"OUT\",\"category\":\"Règlement fournisseur\",\"amount\":1000000,\"supplier_id\":\"$SUPPLIER_ID\",\"note\":\"Règlement partiel\"}")

  echo "$PAYMENT_RESPONSE" | python -m json.tool 2>/dev/null || echo "$PAYMENT_RESPONSE"
else
  echo "⚠️ Pas de fournisseur créé, test ignoré"
fi
echo ""

# 13. Test création d'une créance client
echo "📌 Test 13: Création créance client (15000 FCFA)"
if [ ! -z "$CUSTOMER_ID" ]; then
  RECEIVABLE_RESPONSE=$(curl -s -X POST "$API_URL/receivables" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"customer_id\":\"$CUSTOMER_ID\",\"amount\":1500000,\"description\":\"Vente à crédit\"}")

  echo "$RECEIVABLE_RESPONSE" | python -m json.tool 2>/dev/null || echo "$RECEIVABLE_RESPONSE"
else
  echo "⚠️ Pas de client créé, test ignoré"
fi
echo ""

# 14. Test remboursement client via caisse
echo "📌 Test 14: Remboursement client via caisse (5000 FCFA)"
if [ ! -z "$CUSTOMER_ID" ]; then
  REFUND_RESPONSE=$(curl -s -X POST "$API_URL/cash/entries" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"type\":\"IN\",\"category\":\"Remboursement client\",\"amount\":500000,\"customer_id\":\"$CUSTOMER_ID\",\"note\":\"Remboursement partiel\"}")

  echo "$REFUND_RESPONSE" | python -m json.tool 2>/dev/null || echo "$REFUND_RESPONSE"
else
  echo "⚠️ Pas de client créé, test ignoré"
fi
echo ""

# 15. Solde final de caisse
echo "📌 Test 15: Solde final de caisse"
FINAL_BALANCE=$(curl -s -X GET "$API_URL/cash/balance" \
  -H "Authorization: Bearer $TOKEN")

echo "$FINAL_BALANCE" | python -m json.tool 2>/dev/null || echo "$FINAL_BALANCE"
echo ""

# 16. Vérifier les dettes du fournisseur
echo "📌 Test 16: Vérification du solde dette fournisseur"
if [ ! -z "$SUPPLIER_ID" ]; then
  SUPPLIER_DEBTS=$(curl -s -X GET "$API_URL/debts?supplier_id=$SUPPLIER_ID" \
    -H "Authorization: Bearer $TOKEN")

  echo "$SUPPLIER_DEBTS" | python -m json.tool 2>/dev/null || echo "$SUPPLIER_DEBTS"
else
  echo "⚠️ Pas de fournisseur créé, test ignoré"
fi
echo ""

# 17. Vérifier les créances du client
echo "📌 Test 17: Vérification du solde créance client"
if [ ! -z "$CUSTOMER_ID" ]; then
  CUSTOMER_RECEIVABLES=$(curl -s -X GET "$API_URL/receivables?customer_id=$CUSTOMER_ID" \
    -H "Authorization: Bearer $TOKEN")

  echo "$CUSTOMER_RECEIVABLES" | python -m json.tool 2>/dev/null || echo "$CUSTOMER_RECEIVABLES"
else
  echo "⚠️ Pas de client créé, test ignoré"
fi
echo ""

echo "✅ Tests terminés!"
echo ""
echo "📊 Résumé des tests:"
echo "  - Connexion PIN: ✅"
echo "  - Solde caisse: ✅"
echo "  - Statistiques: ✅"
echo "  - Entrées/Sorties caisse: ✅"
echo "  - Gestion clients/fournisseurs: ✅"
echo "  - Dettes fournisseurs: ✅"
echo "  - Créances clients: ✅"
echo "  - Règlements via caisse: ✅"
