# Debug ProductCatalogScreen - Guide de test

## Modifications apportées

J'ai ajouté des logs détaillés dans [ProductCatalogScreen.tsx](apps/mobile/src/screens/ProductCatalogScreen.tsx) pour identifier les erreurs :

### 1. Logs dans `loadData()` (ligne 115-135)

- `📦 Loading products with params:` - Affiche les paramètres de recherche/filtre
- `✅ Products loaded:` - Nombre de produits chargés
- `✅ Filters loaded:` - Filtres disponibles (families, brands, article_types)
- `❌ Error loading products:` - Erreur détaillée avec message et réponse

### 2. Logs dans `saveProduct()` (ligne 192-242)

- `💾 Saving product:` - Données du produit à sauvegarder
- `📝 Updating product:` - ID du produit en modification
- `➕ Creating new product` - Création d'un nouveau produit
- `✅ Product created/updated:` - Résultat de l'opération
- `❌ Error saving product:` - Erreur détaillée (message, status, data)

## Comment tester

### Étape 1 : Démarrer l'API

```bash
cd apps/api
npm run dev
```

✅ **Vérification** : L'API doit afficher `Nest application successfully started` sur le port 3000

### Étape 2 : Démarrer l'application mobile

```bash
cd apps/mobile
npm start
```

### Étape 3 : Se connecter

- **Code Boutique** : 010126
- **Code PIN** : 0126

### Étape 4 : Ouvrir l'onglet Catalogue

1. Aller dans **Plus** (menu)
2. Cliquer sur **Catalogue Articles**
3. **Ouvrir la console de développement** pour voir les logs

### Étape 5 : Tester chaque fonctionnalité

#### Test 1 : Chargement initial

**Action** : Ouvrir l'onglet Catalogue Articles

**Logs attendus** :

```
🔗 API URL configurée: http://localhost:3000/api
📦 Loading products with params: { search: undefined, family: undefined, brand: undefined, article_type: undefined }
✅ Products loaded: 11
✅ Filters loaded: { families: ["GLASSES", "CHARGEURS", ...], brands: [...], article_types: [...] }
```

**Si erreur** :

```
❌ Error loading products: [message d'erreur]
❌ Error message: [détails]
❌ Error response: [réponse du serveur]
```

#### Test 2 : Recherche

**Action** : Taper "Samsung" dans la barre de recherche

**Logs attendus** :

```
📦 Loading products with params: { search: "Samsung", ... }
✅ Products loaded: 2
```

#### Test 3 : Filtres

**Action** :

1. Cliquer sur l'icône filtre
2. Sélectionner famille "GLASSES"
3. Appliquer

**Logs attendus** :

```
📦 Loading products with params: { family: "GLASSES", ... }
✅ Products loaded: 3
```

#### Test 4 : Ajouter un produit

**Action** :

1. Cliquer sur le bouton + (flottant)
2. Remplir le formulaire :
   - Famille : TEST
   - Type : Test Type
   - Marque : Test Brand
   - Référence : Test-001
   - SKU : TEST01 (ou cliquer "Générer")
   - Libellé : Produit de test
   - Prix achat : 1000
   - Prix vente : 1500
3. Cliquer "Ajouter"

**Logs attendus** :

```
💾 Saving product: { isEditing: false, productId: undefined, data: {...} }
➕ Creating new product
✅ Product created: { id: "...", sku: "TEST01", ... }
```

**Si erreur** :

```
❌ Error saving product: [erreur]
❌ Error message: [message]
❌ Error response: [réponse API]
❌ Error status: [code HTTP]
```

#### Test 5 : Modifier un produit

**Action** :

1. Cliquer sur un produit existant
2. Modifier le prix de vente (ex: 2000)
3. Cliquer "Enregistrer"

**Logs attendus** :

```
💾 Saving product: { isEditing: true, productId: "...", data: {...} }
📝 Updating product: [id du produit]
✅ Product updated: { ... }
```

## Erreurs possibles et solutions

### Erreur 1 : "Network request failed"

**Cause** : L'API n'est pas démarrée ou pas accessible

**Solution** :

1. Vérifier que l'API tourne sur http://localhost:3000
2. Tester : `curl http://localhost:3000/api/health`
3. Si Docker : Vérifier que PostgreSQL est démarré

### Erreur 2 : "Unauthorized" (401)

**Cause** : Token expiré ou invalide

**Solution** :

1. Se déconnecter et se reconnecter
2. Vérifier que le code PIN est correct
3. Vérifier les logs de connexion

### Erreur 3 : "Validation failed"

**Cause** : Données invalides (SKU dupliqué, champs requis manquants)

**Solution** :

1. Vérifier que le SKU est unique
2. Vérifier que famille, nom et SKU sont remplis
3. Lire le message d'erreur dans les logs

### Erreur 4 : Les filtres ne fonctionnent pas

**Cause possible** : Paramètres de filtre incorrects

**Vérifier dans les logs** :

- Les paramètres envoyés : `📦 Loading products with params`
- La réponse de l'API : `✅ Products loaded: X`

### Erreur 5 : L'ajout/modification ne fonctionne pas

**Cause possible** : Erreur de validation côté API

**Vérifier dans les logs** :

- Les données envoyées : `💾 Saving product`
- Le code d'erreur HTTP : `❌ Error status: XXX`
- Le message d'erreur : `❌ Error response: {...}`

## Informations de débogage à fournir

Si les erreurs persistent, **copiez et envoyez les logs suivants** :

1. **Logs de chargement** :

   ```
   📦 Loading products with params: ...
   ❌ Error loading products: ...
   ```

2. **Logs de sauvegarde** :

   ```
   💾 Saving product: ...
   ❌ Error saving product: ...
   ```

3. **Réponse de l'API** :

   ```
   ❌ Error response: { ... }
   ❌ Error status: XXX
   ```

4. **URL de l'API utilisée** :
   ```
   🔗 API URL configurée: ...
   ```

## Prochaines étapes

Une fois les erreurs identifiées et corrigées, nous pourrons passer aux autres tâches :

1. ✅ Corriger les erreurs d'ajout/modification/filtres (EN COURS)
2. ⏳ Améliorer l'onglet Catalogue avec gestion hiérarchique
3. ⏳ Ajouter filtre calendrier dynamique
4. ⏳ Implémenter gestion remboursement/paiement avec solde négatif

## Notes importantes

- Les logs commencent par des emojis pour faciliter le filtrage dans la console
- 📦 = Chargement
- ✅ = Succès
- ❌ = Erreur
- 💾 = Sauvegarde
- 📝 = Modification
- ➕ = Création

**Gardez la console ouverte pendant les tests !**
