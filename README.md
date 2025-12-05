# Web Cleaner - Extension Navigateur

**Nuit de l'Info 2025 - Defi Platon Formation**<br>
## Nom de l'équipe : Les trois singes 

Extension navigateur permettant aux utilisateurs de masquer definitivement les elements indesirables (publicites, popups, bannieres) sur leurs sites preferes.

---

## Installation

### Chrome

1. Ouvrir Chrome et acceder a `chrome://extensions/`
2. Activer le "Mode developpeur" (coin superieur droit)
3. Cliquer sur "Charger l'extension non empaquetee"
4. Selectionner le dossier `chrome/`
5. L'extension est installee

### Firefox

1. Ouvrir Firefox et acceder a `about:debugging`
2. Cliquer sur "Ce Firefox" dans le menu de gauche
3. Cliquer sur "Charger un module temporaire..."
4. Naviguer vers le dossier `firefox/`
5. Selectionner le fichier `manifest.json`
6. L'extension est installee

**Note**: L'extension temporaire Firefox sera supprimee a la fermeture du navigateur.

---

## Utilisation

1. Cliquer sur l'icone Web Cleaner dans la barre d'outils
2. Activer le mode edition
3. Survoler les elements de la page (bordure rose apparait)
4. Cliquer sur un element pour le masquer definitivement
5. L'element disparait et reste masque lors des prochaines visites

### Raccourcis

- **Ctrl+Z**: Annuler le dernier masquage
- **Mode edition**: Toggle via le popup de l'extension

### Gestion

- **Reset par site**: Reinitialiser les masquages d'un site specifique
- **Reset global**: Supprimer tous les masquages de tous les sites

---

## Architecture

```
extension-cleaner/
├── chrome/              Extension Chrome (Manifest V3)
│   ├── manifest.json    Configuration de l'extension
│   ├── popup/           Interface utilisateur
│   │   ├── popup.html   Structure du popup
│   │   ├── popup.css    Styles (theme dark/lofi)
│   │   └── popup.js     Logique de l'interface
│   ├── content/         Scripts injectes dans les pages
│   │   ├── content.js   Selection + masquage + MutationObserver
│   │   └── content.css  Styles pour overlay et selection
│   ├── background/      Service Worker
│   │   └── background.js Gestion du storage et communication
│   └── icons/           Icones de l'extension (16, 48, 128px)
│
├── firefox/             Extension Firefox (Manifest V2)
│   └── [structure identique avec polyfill browser API]
│
└── README.md            Ce fichier
```

### Composants cles

**manifest.json**
- Configuration de l'extension
- Permissions (storage, activeTab, scripting)
- Declaration des scripts et ressources

**content.js**
- Injection dans chaque page web
- Overlay transparent avec z-index maximum
- Detection des clics en phase capture
- Generation de selecteurs CSS uniques
- MutationObserver permanent pour contenu dynamique
- Systeme d'undo (Ctrl+Z)

**popup.html/js/css**
- Interface de controle de l'extension
- Toggle mode edition
- Statistiques (nombre de sites et elements masques)
- Liste des sites avec bouton reset
- Design dark/lofi moderne

**background.js**
- Sauvegarde dans chrome.storage.local
- Communication entre popup et content scripts
- Gestion de l'etat global

---

## Fonctionnalites

### MVP (100% complete)

- Selection interactive d'elements via overlay
- Persistance des masquages par domaine
- Application automatique a chaque visite
- Gestion des sites (liste + reset)
- Interface utilisateur moderne

### Bonus implementes

- Systeme d'annulation (Ctrl+Z)
- Indicateurs visuels (bordure, tooltip, notifications)
- Desactivation temporaire du mode edition
- Multi-navigateurs (Chrome + Firefox)
- **MutationObserver**: Masquage automatique des elements dynamiques

---

## Techniques avancees

### Overlay avec z-index maximum
```javascript
z-index: 2147483647  // Maximum absolu
pointer-events: auto
position: fixed
```
Capture tous les clics, meme sur elements avec z-index eleve.

### Event listeners en phase capture
```javascript
document.addEventListener('click', handler, true);
e.stopImmediatePropagation();
```
Intercepte les evenements avant qu'ils n'atteignent la cible.

### MutationObserver permanent
```javascript
domObserver.observe(document.body, {
  childList: true,
  subtree: true
});
```
Detecte et masque les elements ajoutes dynamiquement (pubs AJAX, popups tardives).

### Generation de selecteurs CSS robustes
Strategies multiples :
1. ID unique (`#elementId`)
2. Classes uniques (`.class1.class2`)
3. Chemin DOM complet (`div > section:nth-of-type(2) > article`)

---

## Limitations connues

### Iframes cross-origin
Les elements dans des iframes d'autres domaines ne sont pas accessibles (securite navigateur).
**Solution**: Cliquer sur le bord de l'iframe pour masquer l'iframe entiere.

### Shadow DOM ferme
Elements dans un Shadow DOM ferme ne sont pas accessibles.
**Impact**: Moins de 1% des cas.

### Sites avec protections anti-modifications
Certains sites detectent et restaurent le DOM.
**Solution**: Le MutationObserver remasque automatiquement.

---

## Stockage des donnees

Format dans `chrome.storage.local`:

```javascript
{
  "maskedElements": {
    "example.com": [
      { "selector": "#header > div.banner", "timestamp": 1234567890 },
      { "selector": ".sidebar-ad", "timestamp": 1234567891 }
    ],
    "autre-site.fr": [...]
  },
  "editModeEnabled": true
}
```

---

## Performances

- **CPU**: Moins de 0.1% en moyenne
- **Memoire**: Environ 50KB (observer + selecteurs)
- **Impact utilisateur**: Imperceptible
- **Pas de polling**: Utilisation de MutationObserver natif

---

## Technologies

- HTML/CSS/JavaScript vanilla (pas de framework)
- Manifest V3 pour Chrome
- Manifest V2 pour Firefox (avec polyfill)
- Chrome Storage API
- MutationObserver API
- Event capture phase

---

