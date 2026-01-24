# SWALO Mobile App

Application mobile React Native (Expo) pour SWALO - Système de gestion commerciale.

## Configuration Initiale

### 1. Prérequis

- Node.js 18+ et pnpm
- Expo CLI installé globalement: `npm install -g expo-cli`
- L'API backend doit être en cours d'exécution
- Un émulateur Android/iOS ou l'app Expo Go sur votre smartphone

### 2. Configuration de l'API

**IMPORTANT**: L'application mobile ne peut pas se connecter à `localhost` car elle s'exécute sur un émulateur ou un appareil physique.

#### Étape 1: Trouver votre adresse IP locale

**Windows:**
```bash
ipconfig
```
Cherchez "IPv4 Address" dans la section "Wireless LAN adapter Wi-Fi" ou "Ethernet adapter"

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

#### Étape 2: Créer le fichier .env

Créez un fichier `.env` dans `apps/mobile/` avec votre adresse IP:

```bash
# Remplacez 192.168.1.10 par VOTRE adresse IP locale
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api
```

**Pour la production:**
```bash
EXPO_PUBLIC_API_URL=https://votre-domaine.com/api
```

#### Étape 3: Vérifier la connexion API

Testez que l'API est accessible depuis votre réseau local:

```bash
# Remplacez l'IP par la vôtre
curl http://192.168.1.10:3000/api/health
```

Vous devriez voir: `{"status":"ok","timestamp":"...","uptime":...}`

## Installation et Démarrage

### Installation des dépendances

```bash
# Depuis la racine du projet
pnpm install

# Ou depuis apps/mobile
cd apps/mobile
pnpm install
```

### Démarrer l'application

```bash
# Depuis la racine du projet
pnpm --filter @swalo/mobile start

# Ou depuis apps/mobile
cd apps/mobile
npx expo start
```

### Options de lancement

- Appuyez sur `a` pour ouvrir sur Android
- Appuyez sur `i` pour ouvrir sur iOS
- Scannez le QR code avec l'app Expo Go sur votre smartphone

## Problèmes Courants

### Erreur "Network request failed"

**Cause:** L'application ne peut pas atteindre l'API backend.

**Solutions:**

1. **Vérifiez votre fichier .env**
   - Assurez-vous que `EXPO_PUBLIC_API_URL` utilise votre adresse IP locale (pas localhost)
   - L'adresse doit commencer par `http://` (ou `https://` pour la production)

2. **Vérifiez que l'API est accessible**
   ```bash
   curl http://VOTRE_IP:3000/api/health
   ```

3. **Vérifiez que votre appareil est sur le même réseau WiFi**
   - Votre smartphone/émulateur doit être sur le même réseau que votre ordinateur de développement

4. **Redémarrez Expo après avoir modifié .env**
   ```bash
   # Arrêtez l'application (Ctrl+C)
   # Puis relancez
   npx expo start --clear
   ```

5. **Windows Firewall**
   - Assurez-vous que le firewall Windows autorise les connexions entrantes sur le port 3000
   - Vous pouvez recevoir une popup au premier lancement

### Les données disparaissent

**Cause:** Les données sont stockées dans un volume Docker qui peut être supprimé.

**Solution:**

1. **Vérifiez que Docker Compose utilise un volume nommé**
   ```bash
   docker volume ls | grep swalo
   ```
   Vous devriez voir `swalo_postgres_data`

2. **Ne supprimez JAMAIS les volumes sans sauvegarde**
   ```bash
   # NE PAS faire: docker-compose down -v
   # À la place:
   docker-compose down
   ```

3. **Pour sauvegarder la base de données**
   ```bash
   docker exec swalo-postgres pg_dump -U swalo swalo_db > backup.sql
   ```

## Connexion à l'application

### Codes PIN par défaut

Après le seed de la base de données, utilisez ces codes PIN:

- **Propriétaire de boutique:** `1234`
- **Vendeur:** `5678`

### Obtenir votre adresse IP

L'application affiche votre IP locale dans le message d'erreur si la connexion échoue. Vérifiez les logs Expo pour voir l'URL utilisée.

## Construction pour la Production

### Android (APK/AAB)

```bash
# APK pour test
eas build --platform android --profile preview

# AAB pour Google Play
eas build --platform android --profile production
```

### iOS (IPA)

```bash
# Build pour TestFlight
eas build --platform ios --profile production
```

**Important:** Mettez à jour `EXPO_PUBLIC_API_URL` dans votre fichier `.env` avec l'URL de production avant de builder.

## Architecture

- **React Native + Expo** - Framework mobile cross-platform
- **TypeScript** - Typage statique
- **React Navigation** - Navigation entre écrans
- **AsyncStorage** - Stockage local des tokens
- **Expo Linear Gradient** - Gradients pour le design

## Sécurité

- Les tokens JWT sont stockés dans AsyncStorage (sécurisé sur iOS, chiffré sur Android)
- Les codes PIN sont hashés côté serveur avec bcrypt
- HTTPS recommandé pour la production
- Les device_id sont générés de manière unique pour chaque appareil

## Support

Pour toute question ou problème:
1. Vérifiez les logs Expo: regardez la console où vous avez lancé `expo start`
2. Vérifiez les logs de l'API: `docker logs swalo-api`
3. Consultez la documentation Expo: https://docs.expo.dev
