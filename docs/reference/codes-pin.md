# Codes PIN de connexion

## Codes disponibles pour se connecter à l'application

| Rôle | Code PIN | Description |
|------|----------|-------------|
| **OWNER** | `0000` | Propriétaire - Accès complet + corrections |
| **ADMIN** | `9999` | Administrateur - Gestion complète |
| **MANAGER** | `2222` | Manager - Gestion & rapports |
| **EMPLOYEE** | `1234` | Employé - Accès basique caisse |

## Permissions par rôle

### OWNER (0000)
- ✅ Toutes les permissions
- ✅ Corrections avec montants négatifs
- ✅ Gestion utilisateurs
- ✅ Administration boutique
- ✅ Bilans et rapports

### ADMIN (9999)
- ✅ Gestion caisse
- ✅ Gestion clients/fournisseurs
- ✅ Administration boutique
- ✅ Bilans et rapports
- ❌ Corrections négatives

### MANAGER (2222)
- ✅ Gestion caisse
- ✅ Gestion clients/fournisseurs
- ✅ Bilans et rapports
- ❌ Administration
- ❌ Corrections négatives

### EMPLOYEE (1234)
- ✅ Gestion caisse
- ✅ Consultation clients/fournisseurs
- ❌ Bilans et rapports
- ❌ Administration
- ❌ Corrections négatives

## Utilisation

1. Ouvrez l'application mobile ou web
2. Entrez un des codes PIN ci-dessus
3. L'application vous connecte avec les permissions correspondantes

## Renouvellement

Les codes PIN sont valides jusqu'au **06/11/2026** (1 an).

Pour régénérer les codes PIN, exécutez:
```bash
docker exec -i swalo-postgres psql -U swalo -d swalo_db < scripts/generate-pin-codes.sql
```
