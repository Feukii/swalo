#!/bin/bash

# Test spécifique du système de créances clients

API_URL="https://swalo-api.onrender.com/api"

echo "🧪 Test du système de créances clients"
echo "======================================="
echo ""

# Connexion
echo "📌 Connexion..."
LOGIN=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d '{"shop_code":"011225","pin_code":"0000"}')

TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Échec de connexion"
  exit 1
fi

echo "✅ Connecté"
echo ""

# Créer un client unique
RANDOM_PHONE="+22177$(date +%s | tail -c 8)"
echo "📌 Création client avec téléphone: $RANDOM_PHONE"
CUSTOMER=$(curl -s -X POST "$API_URL/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"TEST\",\"first_name\":\"Client\",\"phone\":\"$RANDOM_PHONE\",\"credit_limit\":10000000}")

CUSTOMER_ID=$(echo "$CUSTOMER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Client créé: $CUSTOMER_ID"
echo ""

# Créer une créance de 80000 FCFA
echo "📌 Création créance de 80000 FCFA (8000000 centimes)"
RECEIVABLE=$(curl -s -X POST "$API_URL/receivables" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"customer_id\":\"$CUSTOMER_ID\",\"amount\":8000000,\"description\":\"Test vente à crédit\"}")

echo "$RECEIVABLE" | python -m json.tool 2>/dev/null || echo "$RECEIVABLE"
RECEIVABLE_ID=$(echo "$RECEIVABLE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""

# Vérifier la créance initiale
echo "📌 Vérification créance initiale"
RECEIVABLES_BEFORE=$(curl -s "$API_URL/receivables" -H "Authorization: Bearer $TOKEN")
echo "$RECEIVABLES_BEFORE" | python -m json.tool 2>/dev/null | grep -A 5 "$CUSTOMER_ID" | head -20
echo ""

# Remboursement partiel de 30000 FCFA via caisse
echo "📌 Remboursement partiel de 30000 FCFA (3000000 centimes) via caisse"
PAYMENT=$(curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"type\":\"IN\",\"category\":\"Remboursement client\",\"amount\":3000000,\"customer_id\":\"$CUSTOMER_ID\",\"note\":\"Remboursement partiel test\"}")

echo "$PAYMENT" | python -m json.tool 2>/dev/null || echo "$PAYMENT"
echo ""

# Vérifier la créance après remboursement
echo "📌 Vérification créance après remboursement (devrait être 50000 FCFA restant)"
RECEIVABLES_AFTER=$(curl -s "$API_URL/receivables" -H "Authorization: Bearer $TOKEN")
echo "$RECEIVABLES_AFTER" | python -m json.tool 2>/dev/null | grep -A 10 "$CUSTOMER_ID"
echo ""

# Vérifier les paiements de la créance
echo "📌 Vérification des paiements de la créance"
RECEIVABLE_DETAIL=$(curl -s "$API_URL/receivables/$RECEIVABLE_ID" -H "Authorization: Bearer $TOKEN")
echo "$RECEIVABLE_DETAIL" | python -m json.tool 2>/dev/null || echo "$RECEIVABLE_DETAIL"
echo ""

# Vérifier le solde de caisse
echo "📌 Vérification du solde de caisse (devrait avoir augmenté de 30000 FCFA)"
CASH_BALANCE=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
echo "$CASH_BALANCE" | python -m json.tool 2>/dev/null || echo "$CASH_BALANCE"
echo ""

echo "✅ Test terminé!"
echo ""
echo "📊 Résultats attendus:"
echo "  - Créance initiale: 80000 FCFA"
echo "  - Remboursement: 30000 FCFA"
echo "  - Solde créance: 50000 FCFA"
echo "  - Statut: PARTIAL"
echo "  - 1 paiement enregistré"
