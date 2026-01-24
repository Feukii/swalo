# Feature: Réorganisation de la documentation du projet SWALO

## Feature Description

Réorganiser la structure de documentation du projet SWALO qui est actuellement encombrée de 29 fichiers markdown à la racine. L'objectif est d'appliquer les bonnes pratiques de l'industrie pour les monorepos en centralisant la documentation dans un dossier `docs/` structuré par catégorie, en conservant uniquement les fichiers essentiels à la racine (README.md, CLAUDE.md), et en mettant en place un système de numérotation automatique pour les fichiers du dossier `.agents/plans/`.

## User Story

En tant que développeur travaillant sur le projet SWALO
Je veux avoir une structure de documentation claire et organisée
Afin de retrouver facilement l'information pertinente et maintenir une base de code propre

## Problem Statement

Le projet souffre actuellement de:
- **29 fichiers .md à la racine** - créant un encombrement visuel et rendant difficile la navigation
- **Mélange de types de documents** - spécifications, logs de session, guides, rapports de bugs, le tout au même niveau
- **Pas de convention de nommage** - fichiers en français/anglais, majuscules/minuscules, styles variés
- **Dossier `.agents/plans/` sans numérotation** - impossible de connaître l'ordre de création des plans

## Solution Statement

Appliquer les bonnes pratiques documentées par [MkDocs](https://www.mkdocs.org/user-guide/writing-your-docs/), [Nx](https://nx.dev/docs/concepts/decisions/folder-structure), et [Spotify Engineering](https://engineering.atspotify.com/2019/10/solving-documentation-for-monoliths-and-monorepos/):

1. **Racine épurée**: Garder uniquement README.md, CLAUDE.md, et les fichiers de configuration
2. **Dossier `docs/` restructuré** avec sous-dossiers par catégorie
3. **Archivage des logs de session** dans un sous-dossier dédié
4. **Système de numérotation** à 3 chiffres pour `.agents/plans/` (001-xxx.md, 002-xxx.md, etc.)
5. **Mise à jour de CLAUDE.md** avec les nouvelles conventions

## Feature Metadata

**Feature Type**: Refactor
**Estimated Complexity**: Medium
**Primary Systems Affected**: Documentation, Configuration files, CLAUDE.md
**Dependencies**: Aucune

---

## CONTEXT REFERENCES

### Fichiers actuels à la racine (29 fichiers .md)

| Fichier | Catégorie proposée | Action |
|---------|-------------------|--------|
| `README.md` | Racine | **Conserver** - Point d'entrée du projet |
| `CLAUDE.md` | Racine | **Conserver et mettre à jour** - Instructions pour Claude |
| `SWALO_Cahier_des_Charges_Unifie.md` | `docs/specs/` | Déplacer |
| `cahier_des_charges_technique_swalo_offline_first_oriente_ia_codeuse.md` | `docs/specs/` | Déplacer |
| `DOCUMENTATION_SWALO.md` | `docs/guides/` | Déplacer |
| `CHARTE_COULEURS.md` | `docs/design/` | Déplacer |
| `CODES_PIN.md` | `docs/reference/` | Déplacer |
| `IMPLEMENTATION_PLAN.md` | `docs/specs/` | Déplacer |
| `PRIX_HISTORISES_DESIGN.md` | `docs/design/` | Déplacer |
| `INTEGRATION_DATERANGEPICKER.md` | `docs/guides/` | Déplacer |
| `MANUAL_TESTING_GUIDE.md` | `docs/guides/` | Déplacer |
| `GUIDE_TEST_NOUVELLES_FONCTIONNALITES.md` | `docs/guides/` | Déplacer |
| `PRODUCT_CATALOG_DEPLOYMENT.md` | `docs/deployment/` | Déplacer |
| `CORRECTIFS_API_FINALE.md` | `docs/archive/sessions/` | Archiver |
| `CORRECTIFS_BUGS_CRITIQUES.md` | `docs/archive/sessions/` | Archiver |
| `CORRECTIFS_FINAUX_SESSION_5.md` | `docs/archive/sessions/` | Archiver |
| `DEBUG_PRODUCT_CATALOG.md` | `docs/archive/sessions/` | Archiver |
| `FINAL_IMPLEMENTATION_REPORT.md` | `docs/archive/sessions/` | Archiver |
| `IMPLEMENTATION_COMPLETE_SUMMARY.md` | `docs/archive/sessions/` | Archiver |
| `IMPLEMENTATION_STATUS.md` | `docs/archive/sessions/` | Archiver |
| `LOGIQUE_FINALE_CORRECTE.md` | `docs/archive/sessions/` | Archiver |
| `MISE_A_JOUR_VENTES_STOCK.md` | `docs/archive/sessions/` | Archiver |
| `MODIFICATIONS_REALISEES.md` | `docs/archive/sessions/` | Archiver |
| `RECAPITULATIF_COMPLET_TOUTES_MODIFICATIONS.md` | `docs/archive/sessions/` | Archiver |
| `RECAPITULATIF_SESSION_FINALE.md` | `docs/archive/sessions/` | Archiver |
| `RESUME_FINAL_SESSION.md` | `docs/archive/sessions/` | Archiver |
| `SESSION_COMPLETE_RESUME.md` | `docs/archive/sessions/` | Archiver |
| `SESSION_CONTINUATION_SUMMARY.md` | `docs/archive/sessions/` | Archiver |
| `STATUS_MODIFICATIONS.md` | `docs/archive/sessions/` | Archiver |

### Fichiers existants dans `docs/` à conserver

- `docs/ADMIN_FEATURES.md` → `docs/guides/admin-features.md`
- `docs/ARCHITECTURE.md` → `docs/architecture/overview.md`
- `docs/DEPLOYMENT.md` → `docs/deployment/guide.md`
- `docs/DEV_NOTES.md` → `docs/reference/dev-notes.md`
- `docs/ENVIRONMENTS.md` → `docs/deployment/environments.md`
- `docs/GETTING_STARTED.md` → `docs/guides/getting-started.md`
- `docs/OPERATIONS.md` → `docs/operations/guide.md`
- `docs/PRODUCT_CATALOG.md` → `docs/guides/product-catalog.md`
- `docs/PROGRESS.md` → `docs/archive/progress.md`
- `docs/STATUS.md` → `docs/archive/status.md`
- `docs/TESTING.md` → `docs/guides/testing.md`

### Fichiers dans `.agents/plans/` à numéroter

Fichiers existants (10) à renuméroter:
1. `catalog-stock-import-features.md` → `001-catalog-stock-import-features.md`
2. `deployment-infrastructure-setup.md` → `002-deployment-infrastructure-setup.md`
3. `fix-balance-display-division-by-100.md` → `003-fix-balance-display-division-by-100.md`
4. `fix-cash-stock-amounts-sync-catalog.md` → `004-fix-cash-stock-amounts-sync-catalog.md`
5. `fix-currency-format-and-splash-screen.md` → `005-fix-currency-format-and-splash-screen.md`
6. `fix-refunds-add-balance-summaries-hierarchy-crud.md` → `006-fix-refunds-add-balance-summaries-hierarchy-crud.md`
7. `fix-sync-hierarchy-payments-duplicates.md` → `007-fix-sync-hierarchy-payments-duplicates.md`
8. `harmonize-amounts-and-catalog-hierarchy.md` → `008-harmonize-amounts-and-catalog-hierarchy.md`
9. `improve-customer-supplier-balance-product-catalog.md` → `009-improve-customer-supplier-balance-product-catalog.md`
10. `login-slogan-balance-transactions-duplicate-entries.md` → `010-login-slogan-balance-transactions-duplicate-entries.md`

### Relevant Documentation (Bonnes pratiques recherchées)

- [MkDocs - Writing Your Docs](https://www.mkdocs.org/user-guide/writing-your-docs/) - Structure de documentation avec dossier `docs/`
- [Technical Documentation with Markdown: Best Practices](https://desktopcommander.app/blog/2025/12/08/markdown-best-practices-technical-documentation/) - Conventions de nommage
- [Nx Folder Structure](https://nx.dev/docs/concepts/decisions/folder-structure) - Organisation des monorepos
- [Spotify Engineering - Documentation for Monorepos](https://engineering.atspotify.com/2019/10/solving-documentation-for-monoliths-and-monorepos/) - Documentation proche du code
- [Building a Markdown-Based Documentation System](https://medium.com/@rosgluk/building-a-markdown-based-documentation-system-72bef3cb1db3) - Système de documentation modulaire

### Patterns to Follow

**Conventions de nommage adoptées:**
- Noms de fichiers en **kebab-case** (minuscules avec tirets)
- Préfixe numérique à 3 chiffres pour les plans (ex: `001-`, `002-`)
- Noms descriptifs en anglais pour la cohérence avec le code

**Structure hiérarchique:**
- Documentation organisée par **thème/catégorie**
- Archives séparées pour les documents historiques
- README.md dans chaque sous-dossier expliquant son contenu

---

## IMPLEMENTATION PLAN

### Phase 1: Préparation de la structure

Créer l'arborescence de dossiers dans `docs/`:
- `docs/specs/` - Spécifications et cahiers des charges
- `docs/guides/` - Guides utilisateur et développeur
- `docs/design/` - Documentation de design (UI, architecture)
- `docs/deployment/` - Documentation de déploiement
- `docs/reference/` - Références techniques
- `docs/architecture/` - Documentation d'architecture
- `docs/operations/` - Documentation opérationnelle
- `docs/archive/` - Documents archivés
- `docs/archive/sessions/` - Logs de sessions de développement

### Phase 2: Numérotation des plans existants

Renommer les 10 fichiers existants dans `.agents/plans/` avec préfixe numérique 001-010.

### Phase 3: Déplacement des fichiers de la racine

Déplacer les 27 fichiers markdown de la racine vers leurs dossiers cibles selon la table de catégorisation.

### Phase 4: Réorganisation du dossier docs existant

Déplacer et renommer les fichiers existants dans `docs/` selon les nouvelles conventions.

### Phase 5: Mise à jour des références

Mettre à jour les liens dans README.md et CLAUDE.md pour pointer vers les nouveaux emplacements.

### Phase 6: Création des fichiers README par dossier

Créer un README.md dans chaque sous-dossier de `docs/` décrivant son contenu.

### Phase 7: Mise à jour de CLAUDE.md

Ajouter les conventions de numérotation pour `.agents/plans/` dans CLAUDE.md.

---

## STEP-BY-STEP TASKS

### Task 1: CREATE structure de dossiers docs/

- **IMPLEMENT**: Créer les sous-dossiers suivants dans `docs/`:
  - `specs/` - Spécifications fonctionnelles et techniques
  - `guides/` - Guides d'utilisation et de développement
  - `design/` - Chartes graphiques et décisions de design
  - `deployment/` - Documentation de déploiement
  - `reference/` - Références techniques (codes, constantes)
  - `architecture/` - Diagrammes et décisions d'architecture
  - `operations/` - Procédures opérationnelles
  - `archive/sessions/` - Logs de sessions de développement archivés
- **VALIDATE**: `ls -la docs/`

### Task 2: RENAME fichiers .agents/plans avec numérotation

- **IMPLEMENT**: Renommer les 10 fichiers existants avec préfixe 001-010:
  - `catalog-stock-import-features.md` → `001-catalog-stock-import-features.md`
  - `deployment-infrastructure-setup.md` → `002-deployment-infrastructure-setup.md`
  - `fix-balance-display-division-by-100.md` → `003-fix-balance-display-division-by-100.md`
  - `fix-cash-stock-amounts-sync-catalog.md` → `004-fix-cash-stock-amounts-sync-catalog.md`
  - `fix-currency-format-and-splash-screen.md` → `005-fix-currency-format-and-splash-screen.md`
  - `fix-refunds-add-balance-summaries-hierarchy-crud.md` → `006-fix-refunds-add-balance-summaries-hierarchy-crud.md`
  - `fix-sync-hierarchy-payments-duplicates.md` → `007-fix-sync-hierarchy-payments-duplicates.md`
  - `harmonize-amounts-and-catalog-hierarchy.md` → `008-harmonize-amounts-and-catalog-hierarchy.md`
  - `improve-customer-supplier-balance-product-catalog.md` → `009-improve-customer-supplier-balance-product-catalog.md`
  - `login-slogan-balance-transactions-duplicate-entries.md` → `010-login-slogan-balance-transactions-duplicate-entries.md`
- **GOTCHA**: Ce plan lui-même doit être numéroté 011
- **VALIDATE**: `ls -la .agents/plans/`

### Task 3: MOVE spécifications vers docs/specs/

- **IMPLEMENT**: Déplacer les fichiers de spécification:
  - `SWALO_Cahier_des_Charges_Unifie.md` → `docs/specs/cahier-des-charges-unifie.md`
  - `cahier_des_charges_technique_swalo_offline_first_oriente_ia_codeuse.md` → `docs/specs/cahier-des-charges-technique-offline-first.md`
  - `IMPLEMENTATION_PLAN.md` → `docs/specs/implementation-plan.md`
- **VALIDATE**: `ls -la docs/specs/`

### Task 4: MOVE guides vers docs/guides/

- **IMPLEMENT**: Déplacer les guides:
  - `DOCUMENTATION_SWALO.md` → `docs/guides/documentation-swalo.md`
  - `INTEGRATION_DATERANGEPICKER.md` → `docs/guides/integration-daterangepicker.md`
  - `MANUAL_TESTING_GUIDE.md` → `docs/guides/manual-testing.md`
  - `GUIDE_TEST_NOUVELLES_FONCTIONNALITES.md` → `docs/guides/test-nouvelles-fonctionnalites.md`
  - `docs/GETTING_STARTED.md` → `docs/guides/getting-started.md`
  - `docs/ADMIN_FEATURES.md` → `docs/guides/admin-features.md`
  - `docs/TESTING.md` → `docs/guides/testing.md`
  - `docs/PRODUCT_CATALOG.md` → `docs/guides/product-catalog.md`
- **VALIDATE**: `ls -la docs/guides/`

### Task 5: MOVE design vers docs/design/

- **IMPLEMENT**: Déplacer les fichiers de design:
  - `CHARTE_COULEURS.md` → `docs/design/charte-couleurs.md`
  - `PRIX_HISTORISES_DESIGN.md` → `docs/design/prix-historises.md`
- **VALIDATE**: `ls -la docs/design/`

### Task 6: MOVE deployment vers docs/deployment/

- **IMPLEMENT**: Déplacer et organiser les fichiers de déploiement:
  - `PRODUCT_CATALOG_DEPLOYMENT.md` → `docs/deployment/product-catalog.md`
  - `docs/DEPLOYMENT.md` → `docs/deployment/guide.md`
  - `docs/ENVIRONMENTS.md` → `docs/deployment/environments.md`
- **VALIDATE**: `ls -la docs/deployment/`

### Task 7: MOVE reference vers docs/reference/

- **IMPLEMENT**: Déplacer les références techniques:
  - `CODES_PIN.md` → `docs/reference/codes-pin.md`
  - `docs/DEV_NOTES.md` → `docs/reference/dev-notes.md`
- **VALIDATE**: `ls -la docs/reference/`

### Task 8: MOVE architecture vers docs/architecture/

- **IMPLEMENT**: Déplacer les fichiers d'architecture:
  - `docs/ARCHITECTURE.md` → `docs/architecture/overview.md`
- **VALIDATE**: `ls -la docs/architecture/`

### Task 9: MOVE operations vers docs/operations/

- **IMPLEMENT**: Déplacer les fichiers opérationnels:
  - `docs/OPERATIONS.md` → `docs/operations/guide.md`
- **VALIDATE**: `ls -la docs/operations/`

### Task 10: ARCHIVE logs de session vers docs/archive/sessions/

- **IMPLEMENT**: Archiver tous les fichiers de log de session de développement:
  - `CORRECTIFS_API_FINALE.md`
  - `CORRECTIFS_BUGS_CRITIQUES.md`
  - `CORRECTIFS_FINAUX_SESSION_5.md`
  - `DEBUG_PRODUCT_CATALOG.md`
  - `FINAL_IMPLEMENTATION_REPORT.md`
  - `IMPLEMENTATION_COMPLETE_SUMMARY.md`
  - `IMPLEMENTATION_STATUS.md`
  - `LOGIQUE_FINALE_CORRECTE.md`
  - `MISE_A_JOUR_VENTES_STOCK.md`
  - `MODIFICATIONS_REALISEES.md`
  - `RECAPITULATIF_COMPLET_TOUTES_MODIFICATIONS.md`
  - `RECAPITULATIF_SESSION_FINALE.md`
  - `RESUME_FINAL_SESSION.md`
  - `SESSION_COMPLETE_RESUME.md`
  - `SESSION_CONTINUATION_SUMMARY.md`
  - `STATUS_MODIFICATIONS.md`
  - `docs/PROGRESS.md`
  - `docs/STATUS.md`
- **GOTCHA**: Conserver les noms originaux pour référence historique, juste convertir en kebab-case
- **VALIDATE**: `ls -la docs/archive/sessions/`

### Task 11: UPDATE README.md

- **IMPLEMENT**: Mettre à jour la section Documentation du README.md pour pointer vers les nouveaux emplacements des fichiers dans `docs/`
- **PATTERN**: Garder le même format de tableau mais avec les nouveaux chemins
- **VALIDATE**: Vérifier manuellement que les liens sont corrects

### Task 12: UPDATE CLAUDE.md

- **IMPLEMENT**: Ajouter une section "Documentation Conventions" dans CLAUDE.md avec:
  - Convention de numérotation des plans `.agents/plans/` (préfixe 3 chiffres)
  - Structure du dossier `docs/` et ses sous-dossiers
  - Règles de nommage (kebab-case, anglais)
  - Instructions pour incrémenter le numéro lors de création de nouveaux plans
- **GOTCHA**: S'assurer que les futures instructions Claude respectent ces conventions
- **VALIDATE**: Lire CLAUDE.md et vérifier la présence de la nouvelle section

### Task 13: CREATE docs/README.md

- **IMPLEMENT**: Créer un fichier README.md dans `docs/` servant d'index de la documentation avec:
  - Description de chaque sous-dossier
  - Liens vers les documents principaux
  - Guide pour trouver l'information
- **VALIDATE**: `cat docs/README.md`

### Task 14: CLEANUP vérification finale

- **IMPLEMENT**: Vérifier que:
  - Seuls README.md et CLAUDE.md restent à la racine comme fichiers .md
  - Tous les autres fichiers .md sont dans leurs dossiers respectifs
  - La numérotation dans `.agents/plans/` est continue (001-011)
- **VALIDATE**: `ls *.md` devrait retourner uniquement README.md et CLAUDE.md

---

## TESTING STRATEGY

### Unit Tests

Non applicable - ce refactoring ne modifie pas de code.

### Integration Tests

Non applicable - ce refactoring ne modifie pas de code.

### Validation manuelle

**Checklist de vérification:**

1. **Structure de dossiers**
   - `docs/specs/` contient 3 fichiers
   - `docs/guides/` contient 8 fichiers
   - `docs/design/` contient 2 fichiers
   - `docs/deployment/` contient 3 fichiers
   - `docs/reference/` contient 2 fichiers
   - `docs/architecture/` contient 1 fichier
   - `docs/operations/` contient 1 fichier
   - `docs/archive/sessions/` contient 18 fichiers

2. **Racine épurée**
   - Seuls README.md et CLAUDE.md comme fichiers .md

3. **Plans numérotés**
   - `.agents/plans/` contient des fichiers 001 à 011

4. **Liens fonctionnels**
   - Les liens dans README.md pointent vers des fichiers existants

---

## VALIDATION COMMANDS

### Level 1: Structure des dossiers

```bash
# Vérifier la structure docs/
ls -la docs/
ls -la docs/specs/
ls -la docs/guides/
ls -la docs/design/
ls -la docs/deployment/
ls -la docs/reference/
ls -la docs/architecture/
ls -la docs/operations/
ls -la docs/archive/sessions/
```

### Level 2: Racine épurée

```bash
# Lister les fichiers .md à la racine (devrait retourner uniquement README.md et CLAUDE.md)
ls *.md
```

### Level 3: Plans numérotés

```bash
# Vérifier la numérotation des plans
ls -la .agents/plans/
```

### Level 4: Comptage des fichiers

```bash
# Compter les fichiers .md dans docs/
find docs -name "*.md" | wc -l
# Attendu: environ 38 fichiers
```

---

## ACCEPTANCE CRITERIA

- [ ] **Racine épurée**: Seuls README.md et CLAUDE.md restent à la racine comme fichiers .md
- [ ] **Structure organisée**: Tous les fichiers sont dans des sous-dossiers thématiques de `docs/`
- [ ] **Plans numérotés**: Tous les fichiers de `.agents/plans/` ont un préfixe numérique 3 chiffres
- [ ] **CLAUDE.md mis à jour**: Contient les nouvelles conventions de documentation
- [ ] **README.md mis à jour**: Les liens pointent vers les nouveaux emplacements
- [ ] **docs/README.md créé**: Index de navigation de la documentation
- [ ] **Aucun fichier perdu**: Tous les fichiers originaux sont retrouvables dans leur nouvel emplacement
- [ ] **Conventions appliquées**: Noms de fichiers en kebab-case minuscules

---

## COMPLETION CHECKLIST

- [ ] Phase 1 complète: Structure de dossiers créée
- [ ] Phase 2 complète: Plans numérotés
- [ ] Phase 3 complète: Fichiers de la racine déplacés
- [ ] Phase 4 complète: Dossier docs réorganisé
- [ ] Phase 5 complète: Références mises à jour
- [ ] Phase 6 complète: README créés
- [ ] Phase 7 complète: CLAUDE.md mis à jour
- [ ] Validation finale: Toutes les commandes de validation passent

---

## EXTERNAL RESOURCES AND REFERENCES

### Bonnes pratiques consultées

- [MkDocs - Writing Your Docs](https://www.mkdocs.org/user-guide/writing-your-docs/)
- [Technical Documentation with Markdown: Best Practices](https://desktopcommander.app/blog/2025/12/08/markdown-best-practices-technical-documentation/)
- [Nx Folder Structure](https://nx.dev/docs/concepts/decisions/folder-structure)
- [Spotify Engineering - Documentation for Monorepos](https://engineering.atspotify.com/2019/10/solving-documentation-for-monoliths-and-monorepos/)
- [Building a Markdown-Based Documentation System](https://medium.com/@rosgluk/building-a-markdown-based-documentation-system-72bef3cb1db3)
- [Markdown Best Practices](https://www.markdowntoolbox.com/blog/markdown-best-practices-for-documentation/)

### Ressources internes

- `README.md` - Point d'entrée actuel du projet
- `CLAUDE.md` - Instructions pour Claude Code
- `docs/ARCHITECTURE.md` - Architecture actuelle du projet

---

## NOTES

### Décisions de design

1. **Pourquoi archiver les logs de session**: Ces fichiers documentent l'historique du développement mais ne sont pas utiles au quotidien. Les garder dans `archive/sessions/` permet de les conserver sans encombrer.

2. **Pourquoi kebab-case**: C'est la convention recommandée par [MkDocs](https://www.mkdocs.org/user-guide/writing-your-docs/) et permet d'éviter les problèmes d'URLs et de compatibilité cross-platform.

3. **Pourquoi numérotation à 3 chiffres**: Permet jusqu'à 999 plans, suffisant pour un projet de cette taille, et assure un tri alphabétique chronologique.

4. **Pourquoi garder français dans certains noms**: Pour les fichiers archivés, conserver les noms français permet de retrouver facilement l'historique. Les nouveaux fichiers suivront la convention anglaise.

### Risques identifiés

- **Liens cassés**: Certains documents peuvent avoir des liens internes vers d'autres fichiers. Une vérification manuelle des liens sera nécessaire après le déplacement.
- **Références externes**: Si des outils externes (CI/CD, scripts) référencent ces fichiers, ils devront être mis à jour.

<!-- EOF -->
