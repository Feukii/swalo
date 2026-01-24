#!/bin/bash

# Script pour tester l'API des produits avec les nouveaux champs
# Assurez-vous que l'API est démarrée (cd apps/api && npm run dev)

echo "🧪 Test de l'API Produits - Catalogue"
echo "======================================"
echo ""

# Couleurs pour le terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api"

# 1. Se connecter pour obtenir un token
echo -e "${BLUE}1. Connexion avec PIN 0126...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login-pin" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_code": "010126",
    "pin_code": "0126"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Échec de connexion${NC}"
  echo "Réponse: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Connecté avec succès${NC}"
echo ""

# 2. Récupérer tous les produits
echo -e "${BLUE}2. Récupération de tous les produits...${NC}"
PRODUCTS=$(curl -s -X GET "$API_URL/products" \
  -H "Authorization: Bearer $TOKEN")

PRODUCT_COUNT=$(echo $PRODUCTS | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ $PRODUCT_COUNT produits trouvés${NC}"
echo ""

# 3. Récupérer les filtres disponibles
echo -e "${BLUE}3. Récupération des filtres...${NC}"
FILTERS=$(curl -s -X GET "$API_URL/products/filters" \
  -H "Authorization: Bearer $TOKEN")

echo "Familles: $(echo $FILTERS | grep -o '"families":\[[^]]*\]')"
echo "Marques: $(echo $FILTERS | grep -o '"brands":\[[^]]*\]')"
echo "Types: $(echo $FILTERS | grep -o '"article_types":\[[^]]*\]')"
echo ""

# 4. Filtrer par famille GLASSES
echo -e "${BLUE}4. Filtrage par famille GLASSES...${NC}"
GLASSES=$(curl -s -X GET "$API_URL/products?family=GLASSES" \
  -H "Authorization: Bearer $TOKEN")

GLASSES_COUNT=$(echo $GLASSES | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ $GLASSES_COUNT produits GLASSES trouvés${NC}"
echo ""

# 5. Rechercher "Samsung"
echo -e "${BLUE}5. Recherche de 'Samsung'...${NC}"
SAMSUNG=$(curl -s -X GET "$API_URL/products?search=Samsung" \
  -H "Authorization: Bearer $TOKEN")

SAMSUNG_COUNT=$(echo $SAMSUNG | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ $SAMSUNG_COUNT produits Samsung trouvés${NC}"
echo ""

# 6. Récupérer un produit spécifique (Glass 3D Tecno Spark 4)
echo -e "${BLUE}6. Récupération d'un produit par SKU...${NC}"
TECNO=$(curl -s -X GET "$API_URL/products/sku/GLA01TECSpk4" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TECNO" | grep -q '"sku":"GLA01TECSpk4"'; then
  echo -e "${GREEN}✅ Produit GLA01TECSpk4 trouvé${NC}"
  echo "Détails:"
  echo "$TECNO" | grep -o '"name":"[^"]*' | sed 's/"name":"/  Nom: /'
  echo "$TECNO" | grep -o '"family":"[^"]*' | sed 's/"family":"/  Famille: /'
  echo "$TECNO" | grep -o '"brand":"[^"]*' | sed 's/"brand":"/  Marque: /'
  echo "$TECNO" | grep -o '"current_stock":[0-9]*' | sed 's/"current_stock":/  Stock: /'
else
  echo -e "${RED}❌ Produit non trouvé${NC}"
fi
echo ""

# 7. Créer un nouveau produit
echo -e "${BLUE}7. Création d'un nouveau produit...${NC}"
NEW_PRODUCT=$(curl -s -X POST "$API_URL/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST01NEWPROD",
    "name": "Produit de Test API",
    "family": "TEST",
    "article_type": "Test Type",
    "brand": "Test Brand",
    "reference": "Test-001",
    "cost_price": 1000,
    "sell_price": 1500,
    "unit": "unit",
    "alert_threshold": 5,
    "is_active": true
  }')

if echo "$NEW_PRODUCT" | grep -q '"sku":"TEST01NEWPROD"'; then
  echo -e "${GREEN}✅ Produit créé avec succès${NC}"
  PRODUCT_ID=$(echo $NEW_PRODUCT | grep -o '"id":"[^"]*' | sed 's/"id":"//')
  echo "  ID: $PRODUCT_ID"
else
  echo -e "${RED}❌ Échec de création${NC}"
  echo "Réponse: $NEW_PRODUCT"
fi
echo ""

echo "======================================"
echo -e "${GREEN}🎉 Tests terminés avec succès !${NC}"
echo ""
echo "💡 Pour voir tous les produits dans l'app mobile:"
echo "   1. Démarrer l'app: cd apps/mobile && npm start"
echo "   2. Se connecter avec PIN 0126"
echo "   3. Aller dans Plus > Catalogue Articles"
