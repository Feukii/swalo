# 🎨 Charte des Couleurs SWALO - Guide Visuel

## 📱 Système de Thème Centralisé

Fichier source : `apps/mobile/src/constants/theme.ts`

Toutes les couleurs suivent la palette **Tailwind CSS** pour la cohérence et la maintenabilité.

---

## 🌈 Palette Principale

### Couleurs de Marque

#### Primaire - Bleu Sky
```
Principal    : #0ea5e9  ████████  Sky Blue 500
Foncé        : #0284c7  ████████  Sky Blue 600
Clair        : #38bdf8  ████████  Sky Blue 400

Utilisation  : Navigation, boutons principaux, actions neutres
Gradient     : ['#0ea5e9', '#0284c7']
```

#### Secondaire - Violet
```
Principal    : #8b5cf6  ████████  Violet 500
Foncé        : #7c3aed  ████████  Violet 600
Clair        : #a78bfa  ████████  Violet 400

Utilisation  : Caisse, accents, éléments spéciaux
Gradient     : ['#8b5cf6', '#7c3aed']
```

---

## 🎯 Couleurs Sémantiques

### Succès - Vert Emerald
```
Principal    : #10b981  ████████  Emerald 500
Foncé        : #059669  ████████  Emerald 600
Clair        : #34d399  ████████  Emerald 400
Fond         : #dcfce7  ████████  Emerald 100
Texte        : #16a34a  ████████  Green 600

Utilisation  : Paiements reçus, confirmations, soldes positifs, états actifs
Gradient     : ['#10b981', '#059669']
```

### Danger - Rouge Red
```
Principal    : #ef4444  ████████  Red 500
Foncé        : #dc2626  ████████  Red 600
Très foncé   : #b91c1c  ████████  Red 700
Clair        : #f87171  ████████  Red 400
Fond         : #fee2e2  ████████  Red 100
Texte        : #dc2626  ████████  Red 600

Utilisation  : Erreurs, dettes fournisseurs, suppressions, alertes critiques
Gradient     : ['#ef4444', '#dc2626']
```

### Attention - Amber Orange
```
Principal    : #f59e0b  ████████  Amber 500
Foncé        : #d97706  ████████  Amber 600
Clair        : #fbbf24  ████████  Amber 400
Fond         : #fef3c7  ████████  Amber 100
Texte        : #92400e  ████████  Amber 800

Utilisation  : Créances clients, paiements partiels, avertissements
Gradient     : ['#f59e0b', '#d97706']
```

### Information - Bleu Blue
```
Principal    : #3b82f6  ████████  Blue 500
Foncé        : #2563eb  ████████  Blue 600
Clair        : #60a5fa  ████████  Blue 400
Fond         : #dbeafe  ████████  Blue 100
Texte        : #1e40af  ████████  Blue 800

Utilisation  : Messages informatifs, états en attente, rôle EMPLOYEE
Gradient     : ['#3b82f6', '#2563eb']
```

---

## 🏢 Couleurs Contextuelles par Module

### 💰 Module Clients / Créances (Receivables)

**Thème : Amber/Orange**

```
┌─────────────────────────────────────────────────────┐
│  SOLDE CLIENT AVEC DETTE                            │
│  Gradient : ['#f59e0b', '#d97706']  ████████        │
│  Amber 500 → Amber 600                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SOLDE CLIENT PAYÉ                                  │
│  Gradient : ['#10b981', '#059669']  ████████        │
│  Emerald 500 → Emerald 600                          │
└─────────────────────────────────────────────────────┘

Boutons d'action :
  📝 Créer une créance  : Gradient Amber   ['#f59e0b', '#d97706']
  💰 Recevoir paiement  : Gradient Vert    ['#10b981', '#059669']
```

### 📦 Module Fournisseurs / Dettes (Debts)

**Thème : Rouge**

```
┌─────────────────────────────────────────────────────┐
│  SOLDE FOURNISSEUR AVEC DETTE                       │
│  Gradient : ['#ef4444', '#dc2626']  ████████        │
│  Red 500 → Red 600                                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SOLDE FOURNISSEUR PAYÉ                             │
│  Gradient : ['#10b981', '#059669']  ████████        │
│  Emerald 500 → Emerald 600                          │
└─────────────────────────────────────────────────────┘

Boutons d'action :
  📝 Créer une dette    : Gradient Rouge   ['#ef4444', '#dc2626']
  💰 Payer fournisseur  : Gradient Vert    ['#10b981', '#059669']
```

### 💵 Module Gestion de Caisse (Cash)

**Thème : Violet/Vert/Rouge**

```
Header de page         : Gradient Violet  ['#8b5cf6', '#7c3aed']
Entrées de caisse (+)  : Gradient Vert    ['#10b981', '#059669']
Sorties de caisse (-)  : Gradient Rouge   ['#ef4444', '#dc2626']
Solde actuel           : Gradient Violet  ['#8b5cf6', '#7c3aed']
```

---

## 👥 Couleurs des Rôles Utilisateurs

```
SUPERADMIN  : #9333ea  ████████  Purple 600
OWNER       : #dc2626  ████████  Red 600
ADMIN       : #ea580c  ████████  Orange 600
MANAGER     : #0284c7  ████████  Sky 600
EMPLOYEE    : #2563eb  ████████  Blue 600
```

### Badges de Rôles (avec fonds clairs)

```
SUPERADMIN  : Fond #f3e8ff ████████  Texte #6b21a8 ████████
OWNER       : Fond #dcfce7 ████████  Texte #16a34a ████████
ADMIN       : Fond #fef3c7 ████████  Texte #92400e ████████
MANAGER     : Fond #e0e7ff ████████  Texte #3730a3 ████████
EMPLOYEE    : Fond #dbeafe ████████  Texte #1e40af ████████
```

---

## 🎨 Couleurs Neutres

### Arrière-plans
```
Blanc           : #ffffff  ████████  Fond des cartes
Gris très clair : #f9fafb  ████████  Gray 50 - Fond de page
Gris clair      : #f3f4f6  ████████  Gray 100 - Fond plus foncé
```

### Bordures
```
Bordure claire  : #e5e7eb  ████████  Gray 200
Bordure foncée  : #d1d5db  ████████  Gray 300
Désactivé       : #9ca3af  ████████  Gray 400
```

### Hiérarchie de Texte
```
Primaire        : #111827  ████████  Gray 900 - Titres
Secondaire      : #374151  ████████  Gray 700 - Sous-titres
Tertiaire       : #6b7280  ████████  Gray 500 - Aide
Désactivé       : #9ca3af  ████████  Gray 400 - Désactivé
Inverse         : #ffffff  ████████  Sur fonds sombres
```

---

## 📊 Badges de Statut

### Statut Actif
```
Fond   : #dcfce7  ████████  Emerald 100
Texte  : #16a34a  ████████  Green 600
```

### Statut Inactif
```
Fond   : #fee2e2  ████████  Red 100
Texte  : #dc2626  ████████  Red 600
```

### Statut En attente
```
Fond   : #dbeafe  ████████  Blue 100
Texte  : #1e40af  ████████  Blue 800
```

### Statut Partiel
```
Fond   : #fef3c7  ████████  Amber 100
Texte  : #92400e  ████████  Amber 800
```

### Statut Payé
```
Fond   : #dcfce7  ████████  Emerald 100
Texte  : #16a34a  ████████  Green 600
```

### Statut Annulé
```
Fond   : #f3f4f6  ████████  Gray 100
Texte  : #6b7280  ████████  Gray 500
```

---

## 🔄 Types de Transactions

```
Vente      : #10b981  ████████  Green - Vente complétée
Dette      : #ef4444  ████████  Red - Dette créée
Paiement   : #0ea5e9  ████████  Sky Blue - Paiement effectué/reçu
Rembours.  : #f59e0b  ████████  Amber - Remboursement émis
```

---

## 💡 Principes d'Utilisation

### 1. Cohérence Sémantique
- **Vert** : Toujours pour les actions positives (paiements, confirmations)
- **Rouge** : Toujours pour les dettes, erreurs, suppressions
- **Amber** : Toujours pour les créances clients, avertissements
- **Bleu** : Toujours pour les actions neutres, informations

### 2. Distinction Contextuelle
- **Clients** utilisent le thème **Amber** (créances à recevoir)
- **Fournisseurs** utilisent le thème **Rouge** (dettes à payer)
- Cette distinction facilite la compréhension immédiate du contexte

### 3. Gradients
- Tous les gradients utilisent la forme `[couleur_principale, couleur_foncée]`
- Exemple : `['#10b981', '#059669']` pour le vert
- Direction : De gauche à droite ou de haut en bas selon le composant

### 4. Accessibilité
- Ratio de contraste respecté pour tous les textes sur fonds colorés
- Bordures visibles pour les éléments interactifs
- États visuels clairs (hover, pressed, disabled)

---

## 📦 Importation dans le Code

```typescript
import { Colors } from '../constants/theme';

// Utilisation des couleurs
<LinearGradient colors={Colors.primary.gradient} />
<LinearGradient colors={Colors.customer.balance.debt} />
<LinearGradient colors={Colors.supplier.payment} />

// Couleurs simples
backgroundColor: Colors.neutral.white
color: Colors.text.primary
borderColor: Colors.neutral.border
```

---

## 🎯 Checklist de Cohérence

Lors de l'ajout de nouveaux composants :

- [ ] Utiliser les couleurs depuis `Colors.*` et non des codes hex en dur
- [ ] Respecter la sémantique : vert = positif, rouge = négatif, amber = attention
- [ ] Utiliser les gradients appropriés au contexte (customer vs supplier)
- [ ] Vérifier le contraste texte/fond pour l'accessibilité
- [ ] Utiliser la hiérarchie de texte appropriée (primary, secondary, tertiary)
- [ ] Appliquer les badges de statut de manière cohérente

---

**Dernière mise à jour** : 27 décembre 2025
**Mainteneur** : Équipe SWALO
