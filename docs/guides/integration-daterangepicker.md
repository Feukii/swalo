# Intégration DateRangePicker - Guide complet

## ✅ TransactionHistoryScreen - FAIT

### Modifications apportées

**1. Imports ajoutés** (ligne 13)
```typescript
import DateRangePicker from '../components/ui/DateRangePicker';
```

**2. États ajoutés** (lignes 61-63)
```typescript
// Date range filter
const [startDate, setStartDate] = useState<Date | null>(null);
const [endDate, setEndDate] = useState<Date | null>(null);
const [datesWithData, setDatesWithData] = useState<string[]>([]);
```

**3. Fonction `getPeriodDates` modifiée** (lignes 76-83)
```typescript
const getPeriodDates = (): { start: Date; end: Date } => {
  // Si des dates personnalisées sont sélectionnées, les utiliser
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // ... reste du code
};
```

**4. Extraction des dates avec données** (lignes 192-198)
```typescript
// Extraire les dates uniques avec données pour le calendrier
const uniqueDates = new Set<string>();
allTransactions.forEach(t => {
  const date = new Date(t.created_at);
  const dateKey = date.toISOString().split('T')[0];
  uniqueDates.add(dateKey);
});
setDatesWithData(Array.from(uniqueDates));
```

**5. Composant DateRangePicker ajouté dans la vue** (lignes 316-328)
```tsx
{/* Date Range Picker */}
<View style={styles.datePickerContainer}>
  <DateRangePicker
    startDate={startDate}
    endDate={endDate}
    onDateChange={(start, end) => {
      setStartDate(start);
      setEndDate(end);
      // Réinitialiser le filtre de période prédéfini
      if (start || end) {
        setSelectedPeriod('all');
      }
    }}
    datesWithData={datesWithData}
  />
</View>
```

**6. Period Selector modifié** (lignes 334-351)
- Reset des dates au clic sur période prédéfinie
- Style actif uniquement si pas de dates personnalisées

**7. Style ajouté**
```typescript
datePickerContainer: {
  marginBottom: Spacing.md,
},
```

---

## ⏳ BusinessReportsScreen - À FAIRE

### Modifications à appliquer

**1. Ajouter imports**
```typescript
// Ligne ~14, après les autres imports
import DateRangePicker from '../components/ui/DateRangePicker';
```

**2. Ajouter états**
```typescript
// Ligne ~79, après selectedPeriod
// Date range filter
const [startDate, setStartDate] = useState<Date | null>(null);
const [endDate, setEndDate] = useState<Date | null>(null);
const [datesWithData, setDatesWithData] = useState<string[]>([]);
```

**3. Modifier `getPeriodDates`**
```typescript
const getPeriodDates = (): { start: Date; end: Date } => {
  // Si des dates personnalisées sont sélectionnées, les utiliser
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (selectedPeriod) {
    case 'today':
      // start est déjà aujourd'hui
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setDate(1); // Premier jour du mois
      break;
    case 'year':
      start.setMonth(0, 1); // 1er janvier
      break;
  }

  return { start, end };
};
```

**4. Extraire dates avec données dans `loadSalesStats`**
```typescript
// À la fin de la fonction, après setEntriesByCategory/setExitsByCategory
const allEntries: any[] = [...cashData, ...receivablesData, ...debtsData];
const uniqueDates = new Set<string>();
allEntries.forEach((entry: any) => {
  const date = new Date(entry.created_at);
  const dateKey = date.toISOString().split('T')[0];
  uniqueDates.add(dateKey);
});
setDatesWithData(Array.from(uniqueDates));
```

**5. Ajouter composant dans la vue**
```tsx
{/* Avant le Period Selector */}
<View style={styles.datePickerContainer}>
  <DateRangePicker
    startDate={startDate}
    endDate={endDate}
    onDateChange={(start, end) => {
      setStartDate(start);
      setEndDate(end);
      if (start || end) {
        setSelectedPeriod('today');
      }
    }}
    datesWithData={datesWithData}
  />
</View>
```

**6. Modifier Period Selector**
```tsx
{(['today', 'week', 'month', 'year'] as Period[]).map((period) => (
  <TouchableOpacity
    key={period}
    style={[
      styles.periodButton,
      selectedPeriod === period && !startDate && !endDate && styles.periodButtonActive,
    ]}
    onPress={() => {
      setSelectedPeriod(period);
      setStartDate(null);
      setEndDate(null);
    }}
  >
    <Text
      style={[
        styles.periodButtonText,
        selectedPeriod === period && !startDate && !endDate && styles.periodButtonTextActive,
      ]}
    >
      {getPeriodLabel(period)}
    </Text>
  </TouchableOpacity>
))}
```

**7. Ajouter style**
```typescript
datePickerContainer: {
  marginBottom: Spacing.md,
},
```

---

## 🎯 Résultat attendu

### Comportement
1. **Par défaut** : Filtres prédéfinis (Aujourd'hui, Semaine, Mois, Année)
2. **Avec DateRangePicker** : L'utilisateur sélectionne date début + date fin
3. **Indicateurs visuels** :
   - Jours avec transactions : point coloré
   - Jours sans transactions : grisés
4. **Reset automatique** : Cliquer sur un filtre prédéfini réinitialise les dates personnalisées

### Avantages
- ✅ Plus de flexibilité pour l'utilisateur
- ✅ Visualisation intuitive des jours avec données
- ✅ Interface cohérente sur les 2 écrans
- ✅ Composant réutilisable pour futurs écrans

---

## 📝 Checklist d'implémentation

### TransactionHistoryScreen
- [x] Importer DateRangePicker
- [x] Ajouter états (startDate, endDate, datesWithData)
- [x] Modifier getPeriodDates
- [x] Extraire dates avec données
- [x] Ajouter composant dans la vue
- [x] Modifier Period Selector
- [x] Ajouter style

### BusinessReportsScreen
- [ ] Importer DateRangePicker
- [ ] Ajouter états (startDate, endDate, datesWithData)
- [ ] Modifier getPeriodDates
- [ ] Extraire dates avec données
- [ ] Ajouter composant dans la vue
- [ ] Modifier Period Selector
- [ ] Ajouter style

---

## 🧪 Tests à effectuer

### Tests fonctionnels
1. ✅ Sélectionner "Aujourd'hui" → Voir les transactions du jour
2. ✅ Sélectionner une plage personnalisée → Voir les transactions de la plage
3. ✅ Cliquer sur un jour avec point → Voir qu'il a des données
4. ✅ Cliquer sur "Réinitialiser" → Revenir aux filtres par défaut
5. ⏳ Tester avec de vraies données sur plusieurs jours

### Tests d'intégration
1. ✅ TransactionHistoryScreen charge correctement
2. ⏳ BusinessReportsScreen charge correctement
3. ⏳ Les dates avec données sont correctement affichées
4. ⏳ Le filtrage fonctionne avec les dates personnalisées

---

## 🔧 Code à copier-coller pour BusinessReportsScreen

```bash
# COMMANDE : Ouvrir le fichier
code apps/mobile/src/screens/BusinessReportsScreen.tsx
```

### Étape 1 : Imports (ligne ~14)
```typescript
import DateRangePicker from '../components/ui/DateRangePicker';
```

### Étape 2 : États (après ligne 79)
```typescript
// Date range filter
const [startDate, setStartDate] = useState<Date | null>(null);
const [endDate, setEndDate] = useState<Date | null>(null);
const [datesWithData, setDatesWithData] = useState<string[]>([]);
```

### Étape 3 : Dans la vue (chercher "Period Selector")
**AVANT** :
```tsx
<View style={styles.periodSelector}>
```

**INSÉRER** :
```tsx
{/* Date Range Picker */}
<View style={styles.datePickerContainer}>
  <DateRangePicker
    startDate={startDate}
    endDate={endDate}
    onDateChange={(start, end) => {
      setStartDate(start);
      setEndDate(end);
      if (start || end) {
        setSelectedPeriod('today');
      }
    }}
    datesWithData={datesWithData}
  />
</View>

```

### Étape 4 : Styles (chercher "StyleSheet.create")
**AJOUTER** après `content:` :
```typescript
datePickerContainer: {
  marginBottom: Spacing.md,
},
```

---

**Date de création** : 20 janvier 2026
**État** : TransactionHistoryScreen ✅ | BusinessReportsScreen ⏳
