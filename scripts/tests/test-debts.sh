#!/bin/bash

# Test spécifique du système de dettes/créances

API_URL="https://swalo-api.onrender.com/api"

echo "🧪 Test du système de dettes et créances"
echo "========================================="
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

# Créer un fournisseur unique
RANDOM_PHONE="+22177$(date +%s | tail -c 8)"
echo "📌 Création fournisseur avec téléphone: $RANDOM_PHONE"
SUPPLIER=$(curl -s -X POST "$API_URL/suppliers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"TEST\",\"first_name\":\"Fournisseur\",\"phone\":\"$RANDOM_PHONE\"}")

SUPPLIER_ID=$(echo "$SUPPLIER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Fournisseur créé: $SUPPLIER_ID"
echo ""

# Créer une dette de 50000 FCFA
echo "📌 Création dette de 50000 FCFA (5000000 centimes)"
DEBT=$(curl -s -X POST "$API_URL/debts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"supplier_id\":\"$SUPPLIER_ID\",\"amount\":5000000,\"description\":\"Test dette\"}")

echo "$DEBT" | python -m json.tool 2>/dev/null || echo "$DEBT"
DEBT_ID=$(echo "$DEBT" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""

# Vérifier la dette initiale
echo "📌 Vérification dette initiale"
DEBTS_BEFORE=$(curl -s "$API_URL/debts" -H "Authorization: Bearer $TOKEN")
echo "$DEBTS_BEFORE" | python -m json.tool 2>/dev/null | grep -A 5 "$SUPPLIER_ID" | head -20
echo ""

# Règlement partiel de 20000 FCFA via caisse
echo "📌 Règlement partiel de 20000 FCFA (2000000 centimes) via caisse"
PAYMENT=$(curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"type\":\"OUT\",\"category\":\"Règlement fournisseur\",\"amount\":2000000,\"supplier_id\":\"$SUPPLIER_ID\",\"note\":\"Règlement partiel test\"}")

echo "$PAYMENT" | python -m json.tool 2>/dev/null || echo "$PAYMENT"
echo ""

# Vérifier la dette après règlement
echo "📌 Vérification dette après règlement (devrait être 30000 FCFA restant)"
DEBTS_AFTER=$(curl -s "$API_URL/debts" -H "Authorization: Bearer $TOKEN")
echo "$DEBTS_AFTER" | python -m json.tool 2>/dev/null | grep -A 10 "$SUPPLIER_ID"
echo ""

# Vérifier les paiements de la dette
echo "📌 Vérification des paiements de la dette"
DEBT_DETAIL=$(curl -s "$API_URL/debts/$DEBT_ID" -H "Authorization: Bearer $TOKEN")
echo "$DEBT_DETAIL" | python -m json.tool 2>/dev/null || echo "$DEBT_DETAIL"
echo ""

echo "✅ Test terminé!"
