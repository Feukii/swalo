# Plan d'implémentation des corrections

## 1. ProductCatalogScreen - Corrections urgentes

### Problèmes identifiés

- ❌ Erreurs lors de l'ajout de produits
- ❌ Erreurs lors de la modification de produits
- ❌ Filtres ne fonctionnent pas correctement

### Actions à faire

1. Ajouter meilleure gestion d'erreur avec logs détaillés
2. Vérifier que l'API répond correctement
3. Tester avec des console.log pour identifier le point de défaillance

## 2. Onglet Catalogue - Refonte complète

### Nouvelle architecture demandée

L'onglet Catalogue doit permettre de :

- ✅ Voir tous les produits groupés par famille
- ✅ Ajouter une nouvelle famille
- ✅ Modifier une famille existante
- ✅ Ajouter/modifier un article (type d'article)
- ✅ Ajouter/modifier une marque
- ✅ Ajouter/modifier une référence
- ❌ Interdire la suppression d'un produit ayant du stock

### Structure hiérarchique

```
Famille (GLASSES)
  └─ Article/Type (Glass 3D)
      ├─ Marque (Tecno)
      │   └─ Référence (Spark 4) → Stock: 24 unités
      ├─ Marque (Samsung)
      │   └─ Référence (A10E) → Stock: 22 unités
      └─ Marque (Infinix)
          └─ Référence (Hot 12) → Stock: 22 unités
```

### Interface à créer

- Modal "Ajouter Famille"
- Modal "Modifier Famille"
- Modal "Ajouter Article" (sous une famille)
- Modal "Modifier Article"
- Modal "Ajouter Marque" (sous un article)
- Modal "Modifier Marque"
- Modal "Ajouter Référence" (sous une marque)
- Modal "Modifier Référence"
- Accordion expansible pour naviguer dans la hiérarchie

## 3. Filtre Calendrier Dynamique

### Historique Transactions

- Remplacer les filtres fixes (aujourd'hui, semaine, mois) par un calendrier
- Date de début et date de fin sélectionnables
- Jours avec données : foncés
- Jours sans données : grisés/désactivés

### Bilans & Rapports

- Même système de filtre calendrier
- Période personnalisée
- Indicateurs visuels des jours avec transactions

## 4. Gestion Remboursement/Paiement avec Solde Négatif

### Remboursement Client

**Scénario** : Le client a un solde de 10,000 FCFA et on lui rembourse 15,000 FCFA

**Comportement actuel** : Probablement bloqué ou erreur

**Comportement demandé** :

1. Pop-up d'avertissement : "⚠️ Le montant à rembourser (15,000 FCFA) dépasse le solde actuel (10,000 FCFA). Le solde deviendra négatif (-5,000 FCFA). Voulez-vous continuer ?"
2. Boutons : [Annuler] [Confirmer]
3. Si confirmé :
   - Enregistrer la transaction
   - Solde client = -5,000 FCFA
4. Sur la page du client, si solde < 0 :
   - Badge rouge visible
   - Message : "⚠️ Vous devez rembourser 5,000 FCFA à ce client"

### Paiement Fournisseur

**Scénario** : On doit 20,000 FCFA au fournisseur et on paie 25,000 FCFA

**Comportement demandé** :

1. Pop-up d'avertissement : "⚠️ Le montant à payer (25,000 FCFA) dépasse la dette actuelle (20,000 FCFA). Le solde deviendra négatif (-5,000 FCFA). Voulez-vous continuer ?"
2. Si confirmé :
   - Enregistrer le paiement
   - Solde fournisseur = -5,000 FCFA
3. Sur la page du fournisseur, si solde < 0 :
   - Badge rouge visible
   - Message : "⚠️ Ce fournisseur doit vous rembourser 5,000 FCFA"

## Ordre d'implémentation

### Phase 1 - Corrections critiques (EN COURS)

1. ✅ Déboguer ProductCatalogScreen (logs détaillés ajoutés)
2. 🔄 **EN ATTENTE DE TEST** : L'utilisateur doit tester avec les logs pour identifier l'erreur exacte
   - Voir [DEBUG_PRODUCT_CATALOG.md](DEBUG_PRODUCT_CATALOG.md) pour le guide de test
   - Logs ajoutés dans loadData() et saveProduct()
   - Besoin des logs console pour diagnostiquer

### Phase 2 - Gestion soldes négatifs (important)

3. Implémenter remboursement client avec solde négatif
4. Implémenter paiement fournisseur avec solde négatif
5. Ajouter badges et messages sur pages clients/fournisseurs

### Phase 3 - Filtre calendrier (amélioration UX)

6. Créer composant DateRangePicker réutilisable
7. Intégrer dans TransactionHistoryScreen
8. Intégrer dans BusinessReportsScreen

### Phase 4 - Refonte onglet Catalogue (fonctionnalité avancée)

9. Créer nouveau design avec hiérarchie expandable
10. Implémenter modals de gestion (famille/article/marque/référence)
11. Ajouter validation (interdire suppression si stock > 0)

## Fichiers à modifier

### Phase 1

- `apps/mobile/src/screens/ProductCatalogScreen.tsx`
- `apps/mobile/src/lib/api.ts`

### Phase 2

- `apps/mobile/src/screens/CustomerDetailsScreen.tsx`
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx`
- `apps/mobile/src/screens/CashScreen.tsx`
- `apps/api/src/modules/receivables/*`
- `apps/api/src/modules/debts/*`

### Phase 3

- `apps/mobile/src/components/ui/DateRangePicker.tsx` (NOUVEAU)
- `apps/mobile/src/screens/TransactionHistoryScreen.tsx`
- `apps/mobile/src/screens/BusinessReportsScreen.tsx`

### Phase 4

- `apps/mobile/src/screens/ProductCatalogScreen.tsx` (refonte majeure)
- Potentiellement créer de nouveaux composants
