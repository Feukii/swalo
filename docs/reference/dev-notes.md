# SWALO - Dev notes

Notes techniques courtes, utiles pour les ajouts rapides.

## Mobile - Creer une dette fournisseur

Ecran cible: `apps/mobile/src/screens/SupplierDetailsScreen.tsx`

- Ajouter un modal "create debt"
- Valider le montant, convertir en centimes
- Appeler `debtsApi.create` avec `supplier_id`, `amount`, `description`, `notes`

## Mobile - Creer une creance client

Ecran cible: `apps/mobile/src/screens/CustomerDetailsScreen.tsx`

- Ajouter un modal "create receivable"
- Valider le montant, convertir en centimes
- Appeler `receivablesApi.create` avec `customer_id`, `amount`, `description`, `notes`
