# Guide de test - Nouvelles fonctionnalités

**Date**: 20 janvier 2026
**Version**: SWALO v2

---

## 📋 Récapitulatif des améliorations

### ✅ Fonctionnalités implémentées

1. **Onglet Ventes** - Synchronisé avec le catalogue
2. **Onglet Stock** - Nouvelle interface de gestion avec approvisionnement
3. **Filtres de date** - BusinessReportsScreen et TransactionHistoryScreen
4. **Soldes négatifs** - Clients et fournisseurs
5. **Catalogue hiérarchique** - Navigation Famille → Article → Marque → Référence

---

## 🧪 Plan de test

### **Test 1 : Onglet Ventes (SaleScreen)** ⭐ PRIORITÉ

#### Objectif
Vérifier que les ventes utilisent bien le catalogue de produits.

#### Étapes
1. **Ouvrir l'application** → Onglet "Vente"
2. **Vérifier l'affichage** :
   - Les produits s'affichent avec : Famille / Article Marque / Stock
   - Exemple attendu : "GLASSES / Glass 3D Samsung / 72 unités"
3. **Rechercher un produit** :
   - Taper dans la barre de recherche (ex: "Samsung")
   - Vérifier que le filtrage fonctionne
4. **Ajouter au panier** :
   - Cliquer sur un produit
   - Vérifier qu'il apparaît dans le panier en bas
   - Badge bleu avec la quantité doit s'afficher
5. **Modifier la quantité** :
   - Utiliser + et - dans le panier
   - Vérifier la limite de stock (alerte si dépassement)
6. **Valider une vente** :
   - Cliquer sur "Valider la vente"
   - Sélectionner un client (ou "Client comptant")
   - Entrer le prix total (ex: 5000 FCFA)
   - Choisir le mode : Espèces / Mobile / Crédit
   - Confirmer
7. **Vérifier le stock** :
   - Aller dans l'onglet "Stock"
   - Vérifier que le stock du produit a diminué

#### Résultat attendu
✅ Les produits du catalogue s'affichent correctement
✅ Le panier fonctionne (ajout, modification, suppression)
✅ La vente met à jour le stock automatiquement
✅ Alerte si stock insuffisant

#### En cas d'erreur
- Vérifier que l'API est démarrée (`npm run dev` dans apps/api)
- Vérifier qu'il y a des produits dans le catalogue (onglet Catalogue)
- Regarder les logs de la console

---

### **Test 2 : Onglet Stock (StockManagementScreen)** ⭐ PRIORITÉ

#### Objectif
Tester la nouvelle interface de gestion du stock avec approvisionnement.

#### Étapes
1. **Ouvrir l'application** → Onglet "Stock"
2. **Vérifier les KPIs en haut** :
   - Stock faible : Nombre de produits sous le seuil
   - Rupture : Nombre de produits à 0
   - Valeur totale : Somme (stock × prix d'achat)
3. **Rechercher un produit** :
   - Utiliser la barre de recherche
   - Tester avec : référence, famille, article, marque
4. **Vérifier les statuts** :
   - 🟢 Vert = En stock
   - 🟠 Orange = Stock faible
   - 🔴 Rouge = Rupture
5. **Approvisionner un produit** :
   - Cliquer sur "Approvisionner" sur une carte
   - Entrer :
     - Quantité : 50
     - Prix d'achat : 500 FCFA
     - Prix de vente : 750 FCFA
   - Vérifier le résumé :
     - Quantité ajoutée : +50 unités
     - Nouveau stock : (ancien stock + 50)
     - Coût total : 25 000 FCFA
     - Marge unitaire : 250 FCFA ✓
   - Valider
6. **Vérifier la mise à jour** :
   - Le stock doit augmenter immédiatement
   - Les prix doivent être mis à jour
   - Pull-to-refresh pour actualiser si besoin

#### Résultat attendu
✅ Les KPIs s'affichent correctement
✅ La recherche fonctionne
✅ Les statuts sont corrects (couleurs)
✅ L'approvisionnement ajoute bien le stock
✅ Les prix sont enregistrés
✅ La marge est calculée automatiquement

#### En cas d'erreur
- Vérifier que `productsApi.update()` fonctionne
- Vérifier les logs de l'API
- S'assurer qu'il y a des produits dans le catalogue

---

### **Test 3 : Filtres de date dans les rapports**

#### Objectif
Vérifier le fonctionnement du DateRangePicker.

#### Étapes
1. **Aller dans** "Plus" → "Bilans & Rapports"
2. **Tester le filtre de date** :
   - Cliquer sur le calendrier en haut
   - Sélectionner une date de début (ex: 1er janvier)
   - Sélectionner une date de fin (ex: 20 janvier)
   - Observer les jours avec un point (= jours avec données)
   - Cliquer sur "Appliquer"
3. **Vérifier les données** :
   - Les rapports doivent se mettre à jour
   - Afficher uniquement les transactions de la période
4. **Tester les filtres prédéfinis** :
   - Cliquer sur "Jour", "Semaine", "Mois"
   - Vérifier que le filtre personnalisé se réinitialise
5. **Tester dans Historique transactions** :
   - Aller dans "Plus" → "Historique des transactions"
   - Répéter les mêmes tests

#### Résultat attendu
✅ Le calendrier s'ouvre correctement
✅ Les jours avec données ont un point
✅ La sélection de plage fonctionne
✅ Les rapports se filtrent correctement
✅ Les boutons prédéfinis réinitialisent le filtre

---

### **Test 4 : Soldes négatifs clients**

#### Objectif
Vérifier qu'on peut rembourser plus que la dette d'un client.

#### Étapes
1. **Trouver un client sans dette** :
   - Aller dans "Plus" → "Clients"
   - Sélectionner un client avec solde = 0 FCFA
2. **Recevoir un paiement** :
   - Cliquer sur "Recevoir paiement"
   - Entrer un montant : 5000 FCFA
   - Ajouter une note (optionnel)
3. **Vérifier l'alerte** :
   - Message : "Le client n'a pas de dette. En recevant 5000 FCFA, vous devrez rendre cette somme au client."
   - Options : Annuler / Confirmer
   - Cliquer sur "Confirmer"
4. **Vérifier le résultat** :
   - Alert : "Paiement enregistré. ⚠️ Vous devez rendre 5000 FCFA au client."
   - Le solde du client devient : -5000 FCFA (négatif)
   - Un badge rouge s'affiche sur la page du client
   - Message : "⚠️ Vous devez rendre 5000 FCFA au client"

#### Résultat attendu
✅ Alerte avant création du solde négatif
✅ Création d'une créance négative
✅ Badge rouge visible
✅ Message d'avertissement clair

---

### **Test 5 : Soldes négatifs fournisseurs**

#### Objectif
Vérifier qu'on peut payer plus que la dette d'un fournisseur.

#### Étapes
1. **Trouver un fournisseur sans dette** :
   - Aller dans "Plus" → "Fournisseurs"
   - Sélectionner un fournisseur avec solde = 0 FCFA
2. **Effectuer un paiement** :
   - Cliquer sur "Effectuer paiement"
   - Entrer un montant : 3000 FCFA
   - Ajouter une note (optionnel)
3. **Vérifier l'alerte** :
   - Message : "Le fournisseur n'a pas de dette. En payant 3000 FCFA, il devra vous rembourser cette somme."
   - Options : Annuler / Confirmer
   - Cliquer sur "Confirmer"
4. **Vérifier le résultat** :
   - Alert : "Paiement enregistré. ⚠️ Ce fournisseur doit vous rendre 3000 FCFA."
   - Le solde du fournisseur devient : -3000 FCFA (négatif)
   - Un badge rouge s'affiche sur la page du fournisseur
   - Message : "⚠️ Ce fournisseur doit vous rendre 3000 FCFA"

#### Résultat attendu
✅ Alerte avant création du solde négatif
✅ Création d'une dette négative
✅ Badge rouge visible
✅ Message d'avertissement clair

---

### **Test 6 : Catalogue hiérarchique**

#### Objectif
Vérifier la navigation dans la hiérarchie des produits.

#### Étapes
1. **Aller dans le catalogue** :
   - "Plus" → "Catalogue de produits"
   - Cliquer sur "Hiérarchie" en haut à droite
2. **Naviguer dans l'arborescence** :
   - Voir les familles (ex: GLASSES)
   - Cliquer sur le chevron pour déplier
   - Voir les articles (ex: Glass 3D)
   - Déplier encore
   - Voir les marques (ex: Samsung)
   - Déplier encore
   - Voir les références avec le stock
3. **Tester les boutons** :
   - Bouton "+" pour ajouter
   - Bouton "✏️" pour modifier
   - Vérifier qu'on ne peut pas supprimer si stock > 0

#### Résultat attendu
✅ L'arborescence s'affiche correctement
✅ Les niveaux se déplient/replient
✅ Les boutons + et ✏️ sont visibles
✅ Blocage de suppression si stock > 0

---

## 🐛 Problèmes connus à surveiller

### Problème potentiel 1 : Produits vides
**Symptôme** : L'onglet Ventes ou Stock est vide
**Cause** : Pas de produits dans le catalogue
**Solution** :
1. Aller dans "Plus" → "Catalogue de produits"
2. Ajouter au moins un produit avec stock > 0
3. Retourner dans Ventes/Stock

### Problème potentiel 2 : API non démarrée
**Symptôme** : Erreur "Impossible de charger les produits"
**Cause** : L'API backend n'est pas lancée
**Solution** :
```bash
cd apps/api
npm run dev
```

### Problème potentiel 3 : Stock non mis à jour
**Symptôme** : Après une vente, le stock ne change pas
**Cause** : Erreur lors de l'appel API
**Solution** :
1. Vérifier les logs de l'API
2. Vérifier que `productsApi.update()` fonctionne
3. Tester manuellement avec Postman

### Problème potentiel 4 : Prix non enregistrés
**Symptôme** : Après approvisionnement, les prix ne s'affichent pas
**Cause** : Champs `unit_price` et `selling_price` non mis à jour
**Solution** :
1. Vérifier la structure de la table `products` dans Prisma
2. S'assurer que ces champs existent
3. Régénérer le client Prisma si besoin : `npx prisma generate`

---

## ✅ Checklist complète

### Onglet Ventes
- [ ] Les produits du catalogue s'affichent
- [ ] La recherche fonctionne
- [ ] Ajout au panier OK
- [ ] Modification quantité OK
- [ ] Validation vente OK
- [ ] Stock mis à jour après vente

### Onglet Stock
- [ ] KPIs affichés correctement
- [ ] Recherche multi-critères OK
- [ ] Statuts de stock (couleurs) corrects
- [ ] Modal d'approvisionnement s'ouvre
- [ ] Résumé calcule la marge
- [ ] Stock augmente après validation
- [ ] Prix enregistrés correctement

### Filtres de date
- [ ] DateRangePicker s'ouvre (Rapports)
- [ ] Jours avec données marqués
- [ ] Filtrage fonctionne
- [ ] Filtres prédéfinis reset la sélection
- [ ] DateRangePicker fonctionne (Transactions)

### Soldes négatifs
- [ ] Alerte client sans dette
- [ ] Création créance négative OK
- [ ] Badge rouge visible (client)
- [ ] Message d'avertissement clair (client)
- [ ] Alerte fournisseur sans dette
- [ ] Création dette négative OK
- [ ] Badge rouge visible (fournisseur)
- [ ] Message d'avertissement clair (fournisseur)

### Catalogue hiérarchique
- [ ] Navigation Famille → Article → Marque → Référence
- [ ] Expand/collapse fonctionne
- [ ] Boutons + et ✏️ visibles
- [ ] Blocage suppression si stock > 0

---

## 📊 Rapport de test

### Format
Après les tests, créer un rapport avec :

```
✅ Fonctionnalité testée
❌ Problème rencontré
⚠️ Amélioration suggérée
```

### Exemple
```
✅ Ventes - Affichage produits : OK
✅ Ventes - Ajout panier : OK
❌ Ventes - Stock non mis à jour (erreur API)
⚠️ Améliorer le message d'erreur si API offline

✅ Stock - KPIs : OK
✅ Stock - Approvisionnement : OK
✅ Stock - Recherche : OK
⚠️ Ajouter un bouton "Rafraîchir"
```

---

## 🚀 Prochaines étapes après validation

Si tous les tests passent :

1. **Committer les changements** :
```bash
git add .
git commit -m "feat: Sync sales with catalog, new stock management with pricing

- Sync SaleScreen with product catalog API
- Create StockManagementScreen with stock replenishment
- Add unit price and selling price fields
- Implement automatic margin calculation
- Add visual stock alerts (low, out of stock)
- Multi-criteria search (reference, family, article, brand)
- KPIs: low stock count, out of stock count, total value

Closes: Ventes and Stock tabs improvement"
```

2. **Finaliser le système FIFO** (Task 3 - 65% restant)
   - Backend service pour gérer les lots
   - Consommation FIFO lors des ventes
   - Affichage de l'historique des lots

3. **Déployer en test** (optionnel)
   - Tester sur un vrai appareil Android
   - Recueillir les retours utilisateurs
   - Ajuster si besoin

---

**Date de création** : 20 janvier 2026
**Dernière mise à jour** : 20 janvier 2026
**Statut** : Prêt pour test
