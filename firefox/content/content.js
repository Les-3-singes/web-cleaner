// Polyfill pour compatibilité Chrome/Firefox
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// État du mode édition
let editModeEnabled = false;
let hoveredElement = null;
let currentDomain = window.location.hostname;
let overlay = null;
let overlayObserver = null;
let domObserver = null;
let maskedSelectors = [];

// Historique pour l'annulation (undo)
let undoHistory = [];

// Initialisation
(async function init() {
  await applyMaskedElements();
  await loadEditModeState();
  setupEventListeners();
  setupDOMObserver(); // Observer permanent pour les éléments dynamiques
})();

// Charger l'état du mode édition au chargement
async function loadEditModeState() {
  const data = await browserAPI.storage.local.get(['editModeEnabled']);
  if (data.editModeEnabled) {
    editModeEnabled = true;
    createOverlay();
  }
}

// Appliquer les éléments masqués au chargement
async function applyMaskedElements() {
  const data = await browserAPI.storage.local.get(['maskedElements']);
  const maskedElements = data.maskedElements || {};
  const elementsForThisSite = maskedElements[currentDomain] || [];

  // Sauvegarder les sélecteurs pour l'observer
  maskedSelectors = elementsForThisSite.map(item => item.selector);
  console.log('[Web Cleaner] Sélecteurs à surveiller:', maskedSelectors);

  elementsForThisSite.forEach(item => {
    try {
      // Masquer tous les éléments qui correspondent au sélecteur (pas juste le premier)
      const elements = document.querySelectorAll(item.selector);
      elements.forEach(element => {
        if (!element.hasAttribute('data-web-cleaner-masked')) {
          element.style.display = 'none';
          element.setAttribute('data-web-cleaner-masked', 'true');
          console.log('[Web Cleaner] Élément masqué:', item.selector);
        }
      });
    } catch (error) {
      console.warn('[Web Cleaner] Sélecteur invalide:', item.selector);
    }
  });
}

// Observer permanent du DOM pour masquer les éléments dynamiques
function setupDOMObserver() {
  // Si un observer existe déjà, le déconnecter
  if (domObserver) {
    domObserver.disconnect();
  }

  console.log('[Web Cleaner] Configuration de l\'observer DOM permanent...');

  domObserver = new MutationObserver((mutations) => {
    // Pour chaque mutation (ajout d'élément)
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        // Ignorer les nodes texte et notre propre overlay
        if (node.nodeType !== 1 || node.id === 'web-cleaner-overlay' || node.id === 'web-cleaner-notification') {
          return;
        }

        // Vérifier si le node ou ses enfants correspondent à nos sélecteurs
        maskedSelectors.forEach(selector => {
          try {
            // Vérifier le node lui-même
            if (node.matches && node.matches(selector)) {
              if (!node.hasAttribute('data-web-cleaner-masked')) {
                node.style.display = 'none';
                node.setAttribute('data-web-cleaner-masked', 'true');
                console.log('[Web Cleaner] Élément dynamique masqué:', selector, node);
              }
            }

            // Vérifier les enfants du node
            if (node.querySelectorAll) {
              const matchingChildren = node.querySelectorAll(selector);
              matchingChildren.forEach(child => {
                if (!child.hasAttribute('data-web-cleaner-masked')) {
                  child.style.display = 'none';
                  child.setAttribute('data-web-cleaner-masked', 'true');
                  console.log('[Web Cleaner] Enfant dynamique masqué:', selector, child);
                }
              });
            }
          } catch (error) {
            // Sélecteur invalide, ignorer
          }
        });
      });
    });
  });

  // Observer tout le body et ses descendants
  domObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  console.log('[Web Cleaner] Observer DOM permanent activé');
}

// Créer l'overlay transparent pour capturer les clics
function createOverlay() {
  if (overlay) {
    console.log('[Web Cleaner] Overlay existe déjà');
    return;
  }

  console.log('[Web Cleaner] Création de l\'overlay...');

  overlay = document.createElement('div');
  overlay.id = 'web-cleaner-overlay';

  // Forcer les styles inline pour override tout
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    cursor: crosshair !important;
    pointer-events: auto !important;
    background: rgba(199, 67, 117, 0.05) !important;
  `;

  // Event listeners sur l'overlay
  overlay.addEventListener('mousemove', handleOverlayMouseMove);
  overlay.addEventListener('click', handleOverlayClick, true);
  overlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    console.log('[Web Cleaner] Mousedown capturé par overlay');
  }, true);
  overlay.addEventListener('keydown', handleKeyDown);

  // Attendre que le body soit prêt
  if (document.body) {
    document.body.appendChild(overlay);
    console.log('[Web Cleaner] Overlay ajouté au body');
  } else {
    // Si le body n'existe pas encore, attendre
    const observer = new MutationObserver(() => {
      if (document.body) {
        document.body.appendChild(overlay);
        console.log('[Web Cleaner] Overlay ajouté au body (après attente)');
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }

  document.body.style.cursor = 'crosshair';

  // Observer pour détecter si l'overlay est supprimé
  if (overlayObserver) {
    overlayObserver.disconnect();
  }
  overlayObserver = new MutationObserver((mutations) => {
    if (!document.getElementById('web-cleaner-overlay') && editModeEnabled) {
      console.warn('[Web Cleaner] Overlay supprimé ! Recréation...');
      overlay = null;
      setTimeout(createOverlay, 100);
    }
  });
  overlayObserver.observe(document.body, { childList: true, subtree: true });
}

// Retirer l'overlay
function removeOverlay() {
  console.log('[Web Cleaner] Retrait de l\'overlay...');

  if (overlay) {
    overlay.remove();
    overlay = null;
    console.log('[Web Cleaner] Overlay retiré');
  }

  if (overlayObserver) {
    overlayObserver.disconnect();
    overlayObserver = null;
    console.log('[Web Cleaner] Observer déconnecté');
  }

  document.body.style.cursor = '';

  // Retirer le hover
  if (hoveredElement) {
    hoveredElement.classList.remove('web-cleaner-hover');
    hoveredElement = null;
  }

  console.log('[Web Cleaner] Mode édition désactivé');
}

// Configuration des event listeners
function setupEventListeners() {
  // Écouter Ctrl+Z globalement
  document.addEventListener('keydown', handleKeyDown, true);
}

// Gestion du mouvement de la souris sur l'overlay
function handleOverlayMouseMove(e) {
  if (!overlay) return;

  // Temporairement cacher l'overlay pour trouver l'élément en dessous
  overlay.style.visibility = 'hidden';
  const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
  overlay.style.visibility = 'visible';

  if (!elementBelow || elementBelow === overlay) return;

  // Retirer le highlight de l'élément précédent
  if (hoveredElement && hoveredElement !== elementBelow) {
    hoveredElement.classList.remove('web-cleaner-hover');
  }

  // Ne pas highlight le body ou html
  if (elementBelow.tagName === 'BODY' || elementBelow.tagName === 'HTML') {
    hoveredElement = null;
    return;
  }

  // Ajouter le highlight au nouvel élément
  hoveredElement = elementBelow;
  hoveredElement.classList.add('web-cleaner-hover');
}

// Gestion du clic sur l'overlay
async function handleOverlayClick(e) {
  console.log('[Web Cleaner] Clic capturé par overlay !', e.target);

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (!overlay) {
    console.error('[Web Cleaner] Overlay n\'existe plus !');
    return;
  }

  // Temporairement cacher l'overlay pour trouver l'élément en dessous
  overlay.style.visibility = 'hidden';
  const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
  overlay.style.visibility = 'visible';

  console.log('[Web Cleaner] Élément trouvé :', elementBelow?.tagName, elementBelow);

  if (!elementBelow || elementBelow === overlay) {
    console.warn('[Web Cleaner] Pas d\'élément trouvé sous l\'overlay');
    return;
  }

  // Ne pas masquer le body ou html
  if (elementBelow.tagName === 'BODY' || elementBelow.tagName === 'HTML') {
    console.log('[Web Cleaner] Ignoré : body ou html');
    return;
  }

  // Générer un sélecteur unique pour cet élément
  const selector = generateSelector(elementBelow);
  console.log('[Web Cleaner] Sélecteur généré :', selector);

  if (selector) {
    // Sauvegarder l'état original pour l'undo
    const originalDisplay = elementBelow.style.display;
    undoHistory.push({
      selector: selector,
      element: elementBelow,
      originalDisplay: originalDisplay,
      timestamp: Date.now()
    });

    // Masquer l'élément immédiatement
    elementBelow.style.display = 'none';
    elementBelow.setAttribute('data-web-cleaner-masked', 'true');
    console.log('[Web Cleaner] Élément masqué !');

    // Sauvegarder dans le storage
    await saveMaskedElement(selector);

    // Notifier le popup
    browserAPI.runtime.sendMessage({ type: 'ELEMENT_MASKED' }).catch(() => {});

    // Afficher un message discret
    showUndoNotification();
  }

  // Retirer le hover
  if (hoveredElement) {
    hoveredElement.classList.remove('web-cleaner-hover');
    hoveredElement = null;
  }
}

// Gestion du clavier (Ctrl+Z pour undo)
function handleKeyDown(e) {
  if (!editModeEnabled) return;

  // Ctrl+Z ou Cmd+Z
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    e.stopImmediatePropagation();
    undoLastAction();
    return false;
  }
}

// Annuler la dernière action
async function undoLastAction() {
  if (undoHistory.length === 0) {
    showNotification('Rien à annuler', 'info');
    return;
  }

  const lastAction = undoHistory.pop();
  const element = lastAction.element;

  // Restaurer l'affichage
  element.style.display = lastAction.originalDisplay || '';
  element.removeAttribute('data-web-cleaner-masked');

  // Retirer du storage
  const data = await browserAPI.storage.local.get(['maskedElements']);
  const maskedElements = data.maskedElements || {};

  if (maskedElements[currentDomain]) {
    maskedElements[currentDomain] = maskedElements[currentDomain].filter(
      item => item.selector !== lastAction.selector
    );

    if (maskedElements[currentDomain].length === 0) {
      delete maskedElements[currentDomain];
    }

    await browserAPI.storage.local.set({ maskedElements });

    // Retirer le sélecteur de la liste surveillée
    const index = maskedSelectors.indexOf(lastAction.selector);
    if (index > -1) {
      maskedSelectors.splice(index, 1);
      console.log('[Web Cleaner] Sélecteur retiré de la surveillance:', lastAction.selector);
    }
  }

  // Notifier
  browserAPI.runtime.sendMessage({ type: 'ELEMENT_MASKED' });
  showNotification('Annulé', 'success');
}

// Afficher notification discrète
function showUndoNotification() {
  showNotification('Masqué (Ctrl+Z pour annuler)', 'success');
}

function showNotification(message, type = 'info') {
  // Retirer notification existante
  const existing = document.getElementById('web-cleaner-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'web-cleaner-notification';
  notification.className = `web-cleaner-notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Animer l'apparition
  setTimeout(() => notification.classList.add('show'), 10);

  // Retirer après 3 secondes
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Générer un sélecteur CSS unique pour un élément
function generateSelector(element) {
  // Stratégie 1 : Utiliser l'ID si disponible
  if (element.id) {
    return `#${element.id}`;
  }

  // Stratégie 2 : Utiliser les classes
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c && !c.startsWith('web-cleaner'));
    if (classes.length > 0) {
      const classSelector = `.${classes.join('.')}`;
      // Vérifier que le sélecteur est unique
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }

  // Stratégie 3 : Utiliser le chemin DOM complet
  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('web-cleaner'));
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }

    // Ajouter l'index si nécessaire
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}

// Sauvegarder un élément masqué
async function saveMaskedElement(selector) {
  const data = await browserAPI.storage.local.get(['maskedElements']);
  const maskedElements = data.maskedElements || {};

  if (!maskedElements[currentDomain]) {
    maskedElements[currentDomain] = [];
  }

  // Vérifier que le sélecteur n'existe pas déjà
  const exists = maskedElements[currentDomain].some(item => item.selector === selector);
  if (!exists) {
    maskedElements[currentDomain].push({
      selector: selector,
      timestamp: Date.now()
    });

    await browserAPI.storage.local.set({ maskedElements });

    // Ajouter le sélecteur à la liste surveillée par l'observer
    if (!maskedSelectors.includes(selector)) {
      maskedSelectors.push(selector);
      console.log('[Web Cleaner] Nouveau sélecteur ajouté à la surveillance:', selector);
    }
  }
}

// Écouter les messages du popup
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Web Cleaner] Message reçu:', message);

  if (message.type === 'TOGGLE_EDIT_MODE') {
    editModeEnabled = message.enabled;
    console.log('[Web Cleaner] Mode édition:', editModeEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ');

    // Sauvegarder l'état dans le storage
    browserAPI.storage.local.set({ editModeEnabled: editModeEnabled }, () => {
      console.log('[Web Cleaner] État sauvegardé dans storage:', editModeEnabled);
    });

    if (editModeEnabled) {
      createOverlay();
    } else {
      removeOverlay();
    }

    // Confirmer au popup que le message a été reçu
    sendResponse({ success: true });
  }

  return true; // Garder le canal ouvert pour sendResponse
});
