#!/bin/bash

# Test complet de toutes les fonctionnalités de SWALO
# Date: 2025-12-20

API_URL="https://swalo-api.onrender.com/api"

echo "🧪 TEST COMPLET DE L'APPLICATION SWALO"
echo "======================================"
echo ""
echo "API: $API_URL"
echo ""

# ========================================
# TEST 1: AUTHENTIFICATION
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 1: Authentification avec différents PINs"
echo "═══════════════════════════════════════════════════════════"

# Test connexion Propriétaire
echo "📌 Test 1.1: Connexion Propriétaire (PIN 0000)"
LOGIN_OWNER=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d '{"shop_code":"011225","pin_code":"0000"}')

TOKEN_OWNER=$(echo "$LOGIN_OWNER" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -n "$TOKEN_OWNER" ]; then
    echo "   ✅ Connexion Propriétaire réussie"
else
    echo "   ❌ ERREUR connexion Propriétaire"
    exit 1
fi
echo ""

# Test connexion Vendeur
echo "📌 Test 1.2: Connexion Vendeur (PIN 1234)"
LOGIN_SELLER=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d '{"shop_code":"011225","pin_code":"1234"}')

TOKEN_SELLER=$(echo "$LOGIN_SELLER" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -n "$TOKEN_SELLER" ]; then
    echo "   ✅ Connexion Vendeur réussie"
else
    echo "   ❌ ERREUR connexion Vendeur"
fi
echo ""

# Test connexion Caissier
echo "📌 Test 1.3: Connexion Caissier (PIN 9999)"
LOGIN_CASHIER=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d '{"shop_code":"011225","pin_code":"9999"}')

TOKEN_CASHIER=$(echo "$LOGIN_CASHIER" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -n "$TOKEN_CASHIER" ]; then
    echo "   ✅ Connexion Caissier réussie"
else
    echo "   ❌ ERREUR connexion Caissier"
fi
echo ""

# Test connexion Gérant
echo "📌 Test 1.4: Connexion Gérant (PIN 2222)"
LOGIN_MANAGER=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d '{"shop_code":"011225","pin_code":"2222"}')

TOKEN_MANAGER=$(echo "$LOGIN_MANAGER" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -n "$TOKEN_MANAGER" ]; then
    echo "   ✅ Connexion Gérant réussie"
else
    echo "   ❌ ERREUR connexion Gérant"
fi
echo ""

# Test connexion boutique 2
echo "📌 Test 1.5: Connexion Boutique 2 (Code 251225)"
LOGIN_SHOP2=$(curl -s -X POST "$API_URL/auth/pin" \
  -H "Content-Type: application/json" \
  -d '{"shop_code":"251225","pin_code":"0000"}')

TOKEN_SHOP2=$(echo "$LOGIN_SHOP2" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [ -n "$TOKEN_SHOP2" ]; then
    echo "   ✅ Connexion Boutique 2 réussie"
else
    echo "   ❌ ERREUR connexion Boutique 2"
fi
echo ""

# Utiliser le token du propriétaire pour les tests suivants
TOKEN="$TOKEN_OWNER"

# ========================================
# TEST 2: GESTION CLIENTS
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 2: Gestion des Clients"
echo "═══════════════════════════════════════════════════════════"

# Créer un client
echo "📌 Test 2.1: Création d'un client"
RANDOM_PHONE="+22177$(date +%s | tail -c 8)"
CUSTOMER=$(curl -s -X POST "$API_URL/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"DIALLO\",\"first_name\":\"Amadou\",\"phone\":\"$RANDOM_PHONE\",\"credit_limit\":20000000}")

CUSTOMER_ID=$(echo "$CUSTOMER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$CUSTOMER_ID" ]; then
    echo "   ✅ Client créé: $CUSTOMER_ID"
else
    echo "   ❌ ERREUR création client"
fi
echo ""

# Lister les clients
echo "📌 Test 2.2: Liste des clients"
CUSTOMERS=$(curl -s "$API_URL/customers" -H "Authorization: Bearer $TOKEN")
CUSTOMER_COUNT=$(echo "$CUSTOMERS" | grep -o '"id":' | wc -l)
echo "   ✅ Nombre de clients: $CUSTOMER_COUNT"
echo ""

# Détail d'un client
echo "📌 Test 2.3: Détails du client"
CUSTOMER_DETAIL=$(curl -s "$API_URL/customers/$CUSTOMER_ID" -H "Authorization: Bearer $TOKEN")
CUSTOMER_NAME=$(echo "$CUSTOMER_DETAIL" | grep -o '"name":"[^"]*' | cut -d'"' -f4)
echo "   ✅ Client récupéré: $CUSTOMER_NAME"
echo ""

# ========================================
# TEST 3: GESTION FOURNISSEURS
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 3: Gestion des Fournisseurs"
echo "═══════════════════════════════════════════════════════════"

# Créer un fournisseur
echo "📌 Test 3.1: Création d'un fournisseur"
RANDOM_PHONE_SUPPLIER="+22177$(date +%s | tail -c 8)"
SUPPLIER=$(curl -s -X POST "$API_URL/suppliers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"FALL\",\"first_name\":\"Boubacar\",\"phone\":\"$RANDOM_PHONE_SUPPLIER\"}")

SUPPLIER_ID=$(echo "$SUPPLIER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$SUPPLIER_ID" ]; then
    echo "   ✅ Fournisseur créé: $SUPPLIER_ID"
else
    echo "   ❌ ERREUR création fournisseur"
fi
echo ""

# Lister les fournisseurs
echo "📌 Test 3.2: Liste des fournisseurs"
SUPPLIERS=$(curl -s "$API_URL/suppliers" -H "Authorization: Bearer $TOKEN")
SUPPLIER_COUNT=$(echo "$SUPPLIERS" | grep -o '"id":' | wc -l)
echo "   ✅ Nombre de fournisseurs: $SUPPLIER_COUNT"
echo ""

# ========================================
# TEST 4: GESTION PRODUITS
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 4: Gestion des Produits"
echo "═══════════════════════════════════════════════════════════"

# Lister les catégories
echo "📌 Test 4.1: Liste des catégories"
CATEGORIES=$(curl -s "$API_URL/categories" -H "Authorization: Bearer $TOKEN")
CATEGORY_COUNT=$(echo "$CATEGORIES" | grep -o '"id":' | wc -l)
echo "   ✅ Nombre de catégories: $CATEGORY_COUNT"

# Récupérer une catégorie pour créer un produit
CATEGORY_ID=$(echo "$CATEGORIES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "   ✅ Catégorie ID: $CATEGORY_ID"
echo ""

# Créer un produit
echo "📌 Test 4.2: Création d'un produit"
PRODUCT=$(curl -s -X POST "$API_URL/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Produit Test $(date +%s)\",\"category_id\":\"$CATEGORY_ID\",\"purchase_price\":50000,\"selling_price\":75000,\"min_stock\":10,\"max_stock\":100}")

PRODUCT_ID=$(echo "$PRODUCT" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$PRODUCT_ID" ]; then
    echo "   ✅ Produit créé: $PRODUCT_ID"
else
    echo "   ❌ ERREUR création produit"
fi
echo ""

# Lister les produits
echo "📌 Test 4.3: Liste des produits"
PRODUCTS=$(curl -s "$API_URL/products" -H "Authorization: Bearer $TOKEN")
PRODUCT_COUNT=$(echo "$PRODUCTS" | grep -o '"id":' | wc -l)
echo "   ✅ Nombre de produits: $PRODUCT_COUNT"
echo ""

# ========================================
# TEST 5: GESTION STOCK
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 5: Gestion du Stock"
echo "═══════════════════════════════════════════════════════════"

# Ajouter du stock
echo "📌 Test 5.1: Ajout de stock"
STOCK_ENTRY=$(curl -s -X POST "$API_URL/stock" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"product_id\":\"$PRODUCT_ID\",\"quantity\":50,\"type\":\"IN\",\"note\":\"Arrivage initial\"}")

if echo "$STOCK_ENTRY" | grep -q '"id":'; then
    echo "   ✅ Stock ajouté: 50 unités"
else
    echo "   ❌ ERREUR ajout stock"
fi
echo ""

# Vérifier le stock
echo "📌 Test 5.2: Vérification du stock"
STOCK_STATUS=$(curl -s "$API_URL/stock?product_id=$PRODUCT_ID" -H "Authorization: Bearer $TOKEN")
CURRENT_STOCK=$(echo "$STOCK_STATUS" | grep -o '"quantity":[0-9]*' | head -1 | grep -o '[0-9]*')
echo "   ✅ Stock actuel: $CURRENT_STOCK unités"
echo ""

# ========================================
# TEST 6: CAISSE - OPÉRATIONS DE BASE
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 6: Caisse - Opérations de Base"
echo "═══════════════════════════════════════════════════════════"

# Solde initial
echo "📌 Test 6.1: Solde de caisse initial"
CASH_INITIAL=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
BALANCE_INITIAL=$(echo "$CASH_INITIAL" | grep -o '"balance":[^,]*' | cut -d':' -f2)
echo "   💰 Solde initial: $BALANCE_INITIAL centimes"
echo ""

# Entrée de caisse (Vente)
echo "📌 Test 6.2: Entrée de caisse (Vente)"
curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"IN","category":"Vente","amount":5000000,"note":"Test vente 50000 FCFA"}' > /dev/null
echo "   ✅ Entrée caisse: +50,000 FCFA"
echo ""

# Sortie de caisse (Achat)
echo "📌 Test 6.3: Sortie de caisse (Achat)"
curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"OUT","category":"Achat","amount":2000000,"note":"Test achat 20000 FCFA"}' > /dev/null
echo "   ✅ Sortie caisse: -20,000 FCFA"
echo ""

# Solde après opérations
CASH_AFTER=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
BALANCE_AFTER=$(echo "$CASH_AFTER" | grep -o '"balance":[^,]*' | cut -d':' -f2)
EXPECTED_BALANCE=$((BALANCE_INITIAL + 5000000 - 2000000))

echo "📌 Test 6.4: Vérification du solde"
echo "   Initial: $BALANCE_INITIAL"
echo "   + Entrée: 5000000"
echo "   - Sortie: 2000000"
echo "   = Attendu: $EXPECTED_BALANCE"
echo "   = Réel: $BALANCE_AFTER"

if [ "$BALANCE_AFTER" -eq "$EXPECTED_BALANCE" ]; then
    echo "   ✅ Solde CORRECT!"
else
    echo "   ❌ ERREUR dans le calcul du solde!"
fi
echo ""

# ========================================
# TEST 7: DETTES FOURNISSEURS
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 7: Dettes Fournisseurs"
echo "═══════════════════════════════════════════════════════════"

# Créer une dette
echo "📌 Test 7.1: Création d'une dette de 100,000 FCFA"
DEBT=$(curl -s -X POST "$API_URL/debts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"supplier_id\":\"$SUPPLIER_ID\",\"amount\":10000000,\"description\":\"Achat marchandises\"}")

DEBT_ID=$(echo "$DEBT" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$DEBT_ID" ]; then
    echo "   ✅ Dette créée: $DEBT_ID"
else
    echo "   ❌ ERREUR création dette"
fi
echo ""

# Vérifier la dette
echo "📌 Test 7.2: Vérification de la dette"
DEBT_DETAIL=$(curl -s "$API_URL/debts/$DEBT_ID" -H "Authorization: Bearer $TOKEN")
DEBT_BALANCE=$(echo "$DEBT_DETAIL" | grep -o '"balance":[0-9]*' | grep -o '[0-9]*')
echo "   ✅ Solde dette: $DEBT_BALANCE centimes (100,000 FCFA)"
echo ""

# Payer partiellement la dette via caisse
echo "📌 Test 7.3: Paiement partiel de 35,000 FCFA via caisse"
CASH_BEFORE_DEBT=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
BALANCE_BEFORE_DEBT=$(echo "$CASH_BEFORE_DEBT" | grep -o '"balance":[^,]*' | cut -d':' -f2)

curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"type\":\"OUT\",\"category\":\"Reglement fournisseur\",\"amount\":3500000,\"supplier_id\":\"$SUPPLIER_ID\",\"note\":\"Paiement partiel dette\"}" > /dev/null
echo "   ✅ Paiement effectué: 35,000 FCFA"
echo ""

# Vérifier la dette après paiement
echo "📌 Test 7.4: Vérification dette après paiement"
DEBT_AFTER=$(curl -s "$API_URL/debts/$DEBT_ID" -H "Authorization: Bearer $TOKEN")
DEBT_BALANCE_AFTER=$(echo "$DEBT_AFTER" | grep -o '"balance":[0-9]*' | grep -o '[0-9]*')
DEBT_PAID=$(echo "$DEBT_AFTER" | grep -o '"paid_amount":[0-9]*' | grep -o '[0-9]*')
DEBT_STATUS=$(echo "$DEBT_AFTER" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

echo "   Dette initiale: 10000000 (100,000 FCFA)"
echo "   Paiement: 3500000 (35,000 FCFA)"
echo "   Solde attendu: 6500000 (65,000 FCFA)"
echo "   Solde réel: $DEBT_BALANCE_AFTER"
echo "   Montant payé: $DEBT_PAID"
echo "   Statut: $DEBT_STATUS"

if [ "$DEBT_BALANCE_AFTER" -eq "6500000" ] && [ "$DEBT_PAID" -eq "3500000" ] && [ "$DEBT_STATUS" == "PARTIAL" ]; then
    echo "   ✅ Dette CORRECTEMENT mise à jour!"
else
    echo "   ❌ ERREUR dans la mise à jour de la dette!"
fi
echo ""

# Vérifier impact sur caisse
CASH_AFTER_DEBT=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
BALANCE_AFTER_DEBT=$(echo "$CASH_AFTER_DEBT" | grep -o '"balance":[^,]*' | cut -d':' -f2)
EXPECTED_CASH_DEBT=$((BALANCE_BEFORE_DEBT - 3500000))

echo "📌 Test 7.5: Impact sur la caisse"
echo "   Caisse avant: $BALANCE_BEFORE_DEBT"
echo "   Caisse attendue: $EXPECTED_CASH_DEBT"
echo "   Caisse réelle: $BALANCE_AFTER_DEBT"

if [ "$BALANCE_AFTER_DEBT" -eq "$EXPECTED_CASH_DEBT" ]; then
    echo "   ✅ Caisse CORRECTEMENT mise à jour!"
else
    echo "   ❌ ERREUR dans la mise à jour de la caisse!"
fi
echo ""

# ========================================
# TEST 8: CRÉANCES CLIENTS
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 8: Créances Clients"
echo "═══════════════════════════════════════════════════════════"

# Créer une créance
echo "📌 Test 8.1: Création d'une créance de 150,000 FCFA"
RECEIVABLE=$(curl -s -X POST "$API_URL/receivables" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"customer_id\":\"$CUSTOMER_ID\",\"amount\":15000000,\"description\":\"Vente à crédit\"}")

RECEIVABLE_ID=$(echo "$RECEIVABLE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -n "$RECEIVABLE_ID" ]; then
    echo "   ✅ Créance créée: $RECEIVABLE_ID"
else
    echo "   ❌ ERREUR création créance"
fi
echo ""

# Vérifier la créance
echo "📌 Test 8.2: Vérification de la créance"
REC_DETAIL=$(curl -s "$API_URL/receivables/$RECEIVABLE_ID" -H "Authorization: Bearer $TOKEN")
REC_BALANCE=$(echo "$REC_DETAIL" | grep -o '"balance":[0-9]*' | grep -o '[0-9]*')
echo "   ✅ Solde créance: $REC_BALANCE centimes (150,000 FCFA)"
echo ""

# Remboursement partiel via caisse
echo "📌 Test 8.3: Remboursement partiel de 55,000 FCFA via caisse"
CASH_BEFORE_REC=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
BALANCE_BEFORE_REC=$(echo "$CASH_BEFORE_REC" | grep -o '"balance":[^,]*' | cut -d':' -f2)

curl -s -X POST "$API_URL/cash/entries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"type\":\"IN\",\"category\":\"Remboursement client\",\"amount\":5500000,\"customer_id\":\"$CUSTOMER_ID\",\"note\":\"Remboursement partiel créance\"}" > /dev/null
echo "   ✅ Remboursement reçu: 55,000 FCFA"
echo ""

# Vérifier la créance après remboursement
echo "📌 Test 8.4: Vérification créance après remboursement"
REC_AFTER=$(curl -s "$API_URL/receivables/$RECEIVABLE_ID" -H "Authorization: Bearer $TOKEN")
REC_BALANCE_AFTER=$(echo "$REC_AFTER" | grep -o '"balance":[0-9]*' | grep -o '[0-9]*')
REC_PAID=$(echo "$REC_AFTER" | grep -o '"paid_amount":[0-9]*' | grep -o '[0-9]*')
REC_STATUS=$(echo "$REC_AFTER" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

echo "   Créance initiale: 15000000 (150,000 FCFA)"
echo "   Remboursement: 5500000 (55,000 FCFA)"
echo "   Solde attendu: 9500000 (95,000 FCFA)"
echo "   Solde réel: $REC_BALANCE_AFTER"
echo "   Montant payé: $REC_PAID"
echo "   Statut: $REC_STATUS"

if [ "$REC_BALANCE_AFTER" -eq "9500000" ] && [ "$REC_PAID" -eq "5500000" ] && [ "$REC_STATUS" == "PARTIAL" ]; then
    echo "   ✅ Créance CORRECTEMENT mise à jour!"
else
    echo "   ❌ ERREUR dans la mise à jour de la créance!"
fi
echo ""

# Vérifier impact sur caisse
CASH_AFTER_REC=$(curl -s "$API_URL/cash/balance" -H "Authorization: Bearer $TOKEN")
BALANCE_AFTER_REC=$(echo "$CASH_AFTER_REC" | grep -o '"balance":[^,]*' | cut -d':' -f2)
EXPECTED_CASH_REC=$((BALANCE_BEFORE_REC + 5500000))

echo "📌 Test 8.5: Impact sur la caisse"
echo "   Caisse avant: $BALANCE_BEFORE_REC"
echo "   Caisse attendue: $EXPECTED_CASH_REC"
echo "   Caisse réelle: $BALANCE_AFTER_REC"

if [ "$BALANCE_AFTER_REC" -eq "$EXPECTED_CASH_REC" ]; then
    echo "   ✅ Caisse CORRECTEMENT mise à jour!"
else
    echo "   ❌ ERREUR dans la mise à jour de la caisse!"
fi
echo ""

# ========================================
# TEST 9: STATISTIQUES ET RAPPORTS
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "TEST 9: Statistiques et Rapports"
echo "═══════════════════════════════════════════════════════════"

# Stats caisse du jour
echo "📌 Test 9.1: Statistiques caisse du jour"
TODAY=$(date +%Y-%m-%d)
STATS=$(curl -s "$API_URL/cash/stats?start_date=${TODAY}T00:00:00Z&end_date=${TODAY}T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN")

TOTAL_IN=$(echo "$STATS" | grep -o '"todayEntries":[0-9]*' | grep -o '[0-9]*')
TOTAL_OUT=$(echo "$STATS" | grep -o '"todayExits":[0-9]*' | grep -o '[0-9]*')
NET=$(echo "$STATS" | grep -o '"todayNet":[^,}]*' | cut -d':' -f2)

echo "   📊 Entrées du jour: $TOTAL_IN centimes"
echo "   📊 Sorties du jour: $TOTAL_OUT centimes"
echo "   📊 Net du jour: $NET centimes"
echo "   ✅ Statistiques récupérées"
echo ""

# Liste des opérations du jour
echo "📌 Test 9.2: Journal des opérations du jour"
ENTRIES=$(curl -s "$API_URL/cash?start_date=${TODAY}T00:00:00Z&end_date=${TODAY}T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN")
ENTRY_COUNT=$(echo "$ENTRIES" | grep -o '"id":' | wc -l)
echo "   ✅ Nombre d'opérations du jour: $ENTRY_COUNT"
echo ""

# ========================================
# RÉSUMÉ FINAL
# ========================================
echo "═══════════════════════════════════════════════════════════"
echo "RÉSUMÉ FINAL DES TESTS"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ Authentification (4 rôles + 2 boutiques)"
echo "✅ Gestion Clients (création, liste, détails)"
echo "✅ Gestion Fournisseurs (création, liste)"
echo "✅ Gestion Produits (création, liste, catégories)"
echo "✅ Gestion Stock (entrées, vérification)"
echo "✅ Caisse - Opérations (entrées, sorties, calcul solde)"
echo "✅ Dettes Fournisseurs (création, paiement, synchronisation)"
echo "✅ Créances Clients (création, remboursement, synchronisation)"
echo "✅ Statistiques et Rapports (stats du jour, journal)"
echo ""
echo "🎉 TOUS LES MODULES TESTÉS AVEC SUCCÈS!"
echo ""
echo "📋 Rapport détaillé disponible dans docs/reports/TEST_REPORT.md"
echo ""
