# État des modifications - SWALO v2

## ✅ Corrections terminées

### 1. ProductCatalogScreen - Erreurs corrigées
- ✅ Ajout de l'icône `X` manquante dans [SimpleIcons.tsx](apps/mobile/src/components/icons/SimpleIcons.tsx:277-282)
- ✅ Suppression de `device_id` des appels API produits dans [api.ts](apps/mobile/src/lib/api.ts:415-460)
- ✅ Ajout de logs détaillés pour le débogage
- ✅ **RÉSULTAT** : Ajout, modification et filtres fonctionnent maintenant

## 🔄 En cours

### 2. Catalogue Hiérarchique
- ✅ Nouveau composant créé : [CatalogHierarchyScreen.tsx](apps/mobile/src/screens/CatalogHierarchyScreen.tsx)
- ⏳ **À faire** :
  - Ajouter la navigation vers ce nouvel écran
  - Implémenter la logique de sauvegarde des modifications (famille/article/marque/référence)
  - Tester la suppression avec vérification de stock

**Structure hiérarchique implémentée** :
```
Famille (GLASSES)
  └─ Article/Type (Glass 3D)
      └─ Marque (Samsung)
          └─ Référence (A10E) → Stock: 22 unités
```

**Fonctionnalités** :
- ✅ Arborescence expandable (chevrons)
- ✅ Boutons +/✏️ à chaque niveau
- ✅ Interdiction de supprimer si stock > 0
- ⏳ Sauvegarde des modifications (TODO)

## 📋 Modifications en attente

### 3. Prix historisés pour le stock
**Document de design créé** : [PRIX_HISTORISES_DESIGN.md](PRIX_HISTORISES_DESIGN.md)

**Besoin** : Quand on ajoute du stock, spécifier le prix d'achat et de vente de ce lot

**Solution** : Système de lots (batches) avec méthode FIFO

**Étapes** :
1. ⏳ Créer migration DB pour table `stock_batches`
2. ⏳ Service backend pour gérer les lots
3. ⏳ Modifier ventes pour utiliser FIFO
4. ⏳ UI mobile "Ajouter stock" avec prix
5. ⏳ Afficher les lots dans la page produit

### 4. Filtre calendrier dynamique
**Écrans concernés** :
- ⏳ TransactionHistoryScreen
- ⏳ BusinessReportsScreen

**Fonctionnalités** :
- Date de début + Date de fin
- Jours avec données : foncés
- Jours sans données : grisés

**À créer** :
- ⏳ Composant réutilisable `DateRangePicker.tsx`
- ⏳ Intégration dans les 2 écrans

### 5. Gestion soldes négatifs

#### Remboursement client
**Scénario** : Client a 10,000 FCFA, on rembourse 15,000 FCFA

**Comportement demandé** :
1. ⏳ Pop-up d'avertissement
2. ⏳ Permettre de continuer → solde = -5,000 FCFA
3. ⏳ Badge rouge sur page client
4. ⏳ Message : "⚠️ Vous devez rembourser 5,000 FCFA à ce client"

**Fichiers à modifier** :
- ⏳ `apps/mobile/src/screens/CustomerDetailsScreen.tsx`
- ⏳ `apps/mobile/src/screens/CashScreen.tsx`
- ⏳ `apps/api/src/modules/receivables/*`

#### Paiement fournisseur
**Scénario** : On doit 20,000 FCFA, on paie 25,000 FCFA

**Comportement demandé** :
1. ⏳ Pop-up d'avertissement
2. ⏳ Permettre de continuer → solde = -5,000 FCFA
3. ⏳ Badge rouge sur page fournisseur
4. ⏳ Message : "⚠️ Ce fournisseur doit vous rembourser 5,000 FCFA"

**Fichiers à modifier** :
- ⏳ `apps/mobile/src/screens/SupplierDetailsScreen.tsx`
- ⏳ `apps/mobile/src/screens/CashScreen.tsx`
- ⏳ `apps/api/src/modules/debts/*`

## 📊 Ordre de priorité recommandé

### Priorité 1 (Maintenant)
1. ✅ ~~Corriger erreurs ProductCatalogScreen~~ **FAIT**
2. 🔄 Finaliser Catalogue Hiérarchique
   - Connecter navigation
   - Implémenter sauvegarde

### Priorité 2 (Important)
3. Système de soldes négatifs (clients + fournisseurs)
   - Impact utilisateur immédiat
   - Relativement simple à implémenter

### Priorité 3 (Amélioration UX)
4. Filtre calendrier dynamique
   - Améliore l'expérience utilisateur
   - Composant réutilisable

### Priorité 4 (Fonctionnalité avancée)
5. Prix historisés pour stock
   - Nécessite migration DB
   - Changement architectural important
   - Peut être fait en plusieurs étapes

## 🎯 Prochaine action immédiate

**Finaliser l'écran Catalogue Hiérarchique** :
1. Ajouter route de navigation
2. Remplacer l'onglet "Catalogue" par un bouton vers la hiérarchie
3. Implémenter la sauvegarde (renommer famille/article/marque)
4. Tester la suppression avec vérification stock

Voulez-vous que je continue avec cette tâche ?
