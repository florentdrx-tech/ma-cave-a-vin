# 🍷 Ma Cave à Vin

Application web installable (PWA) pour gérer sa cave à vin : **simple, rapide, sans compte, sans publicité, sans abonnement**.
Les données restent sur votre appareil.

## Fonctionnalités

- **Inventaire** : domaine, cuvée, appellation, région, couleur, millésime, contenance, prix, fournisseur, cépages, photo d'étiquette
- **Saisie rapide** : seuls le domaine (ou l'appellation) et la couleur sont nécessaires. Autocomplétion à partir des vins déjà saisis,
  « Enregistrer + autre » pour enchaîner les millésimes, « Autre millésime » depuis une fiche, boutons −/+ directement dans la liste
- **Scan des étiquettes** : prenez l'étiquette en photo, les champs se remplissent tout seuls.
  Par défaut, le texte est lu sur l'appareil (Tesseract, gratuit). Pour une lecture bien plus fiable, vous pouvez ajouter votre clé d'API
  Anthropic dans ⚙️ Réglages : la photo est alors lue par Claude, à environ un centime l'étiquette, sans abonnement
- **Vue « Bouteilles »** : chaque vin est dessiné sous forme de bouteille (forme selon la région, teinte selon la couleur), avec soit une
  image d'étiquette trouvée sur internet (Open Food Facts, Wikimedia Commons, ou une adresse d'image collée depuis Google Images), soit votre photo,
  soit une étiquette dessinée automatiquement à partir de la fiche
- **Casiers** : plan visuel de chaque casier (rangées × colonnes, avec plusieurs bouteilles par case pour le vrac), rangement en touchant les cases,
  déplacement, surlignage d'un vin dans le plan
- **Apogée** : fenêtre de dégustation (avec estimation indicative selon la couleur), statuts « À garder / À boire / À boire vite / Dépassée »,
  liste « À boire en priorité » sur l'accueil
- **Dégustations** : note sur 5 étoiles, impressions et accord mets-vin, saisis en sortant la bouteille. Journal des dégustations et des sorties
- **Température** : conditions idéales de conservation et de service, relevés manuels, courbe d'historique,
  **connexion d'un thermomètre / hygromètre Bluetooth** (Web Bluetooth) avec enregistrement automatique toutes les 10 minutes
- **Sauvegarde** : export / restauration JSON, export CSV (compatible Excel), **import CSV** depuis Viniou ou une autre application
  (colonnes reconnues automatiquement, correspondance modifiable)
- Fonctionne **hors connexion**, thème clair et sombre

### Thermomètres compatibles

Web Bluetooth est disponible sur Chrome / Edge (Android, Windows, macOS, ChromeOS), mais **pas sur iPhone/iPad**.

| Capteur | Profil |
|---|---|
| Xiaomi LYWSD03MMC (firmware d'origine) | Service propriétaire Xiaomi |
| Xiaomi LYWSD03MMC / MHO-C401 / CGG1 avec firmware [pvvx](https://github.com/pvvx/ATC_MiThermometer) ou ATC | Environmental Sensing (0x181A) |
| Capteurs génériques « Environmental Sensing » | 0x181A : température 0x2A6E, humidité 0x2A6F |
| Thermomètres « Health Thermometer » | 0x1809 / 0x2A1C |

## Développement

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
```

Stack : React 18, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa, tesseract.js, SDK Anthropic.

## Mise en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` publie l'application à chaque push sur `main`.
Pour l'activer : **Settings → Pages → Source : GitHub Actions**.
L'application est alors disponible sur `https://<utilisateur>.github.io/ma-cave-a-vin/`.
Ouvrez cette adresse sur votre téléphone, puis « Ajouter à l'écran d'accueil ».
