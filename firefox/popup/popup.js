// Polyfill pour compatibilité Chrome/Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// État de l'extension
let isEditMode = false;
let currentDomain = '';

// Éléments DOM
const toggleEditModeBtn = document.getElementById('toggleEditMode');
const editModeText = document.getElementById('editModeText');
const sitesCountEl = document.getElementById('sitesCount');
const elementsCountEl = document.getElementById('elementsCount');
const sitesListEl = document.getElementById('sitesList');
const resetCurrentSiteBtn = document.getElementById('resetCurrentSite');
const resetAllBtn = document.getElementById('resetAll');

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentTab();
  await loadEditModeState();
  await loadStats();
  await loadSitesList();
  setupEventListeners();
});

// Charger l'état du mode édition
async function loadEditModeState() {
  const data = await browserAPI.storage.local.get(['editModeEnabled']);
  if (data.editModeEnabled) {
    isEditMode = true;
    toggleEditModeBtn.classList.add('active');
    editModeText.textContent = 'mode edition [actif]';
  }
}

// Charger l'onglet actuel
async function loadCurrentTab() {
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.url) {
    currentDomain = new URL(tab.url).hostname;
  }
}

// Charger les statistiques
async function loadStats() {
  const data = await browserAPI.storage.local.get(['maskedElements']);
  const maskedElements = data.maskedElements || {};

  const sitesCount = Object.keys(maskedElements).length;
  let elementsCount = 0;

  for (const domain in maskedElements) {
    elementsCount += maskedElements[domain].length;
  }

  sitesCountEl.textContent = sitesCount;
  elementsCountEl.textContent = elementsCount;
}

// Charger la liste des sites
let showAllSites = false;

async function loadSitesList() {
  const data = await browserAPI.storage.local.get(['maskedElements']);
  const maskedElements = data.maskedElements || {};

  if (Object.keys(maskedElements).length === 0) {
    sitesListEl.innerHTML = '<p class="empty-state">Aucun site nettoyé pour le moment</p>';
    return;
  }

  sitesListEl.innerHTML = '';

  const domains = Object.keys(maskedElements);
  const maxVisible = 3;
  const hasMore = domains.length > maxVisible;
  const domainsToShow = showAllSites ? domains : domains.slice(0, maxVisible);

  // Afficher les sites
  domainsToShow.forEach(domain => {
    const count = maskedElements[domain].length;
    const siteItem = createSiteItem(domain, count);
    sitesListEl.appendChild(siteItem);
  });

  // Ajouter le bouton "Voir plus" si nécessaire
  if (hasMore && !showAllSites) {
    const remaining = domains.length - maxVisible;
    const showMoreBtn = document.createElement('button');
    showMoreBtn.className = 'show-more-btn';
    showMoreBtn.textContent = `+ ${remaining} autre${remaining > 1 ? 's' : ''} site${remaining > 1 ? 's' : ''}`;
    showMoreBtn.addEventListener('click', () => {
      showAllSites = true;
      loadSitesList();
    });
    sitesListEl.appendChild(showMoreBtn);
  }

  // Ajouter le bouton "Voir moins" si tous les sites sont affichés
  if (hasMore && showAllSites) {
    const showLessBtn = document.createElement('button');
    showLessBtn.className = 'show-more-btn';
    showLessBtn.textContent = 'Voir moins';
    showLessBtn.addEventListener('click', () => {
      showAllSites = false;
      loadSitesList();
    });
    sitesListEl.appendChild(showLessBtn);
  }
}

// Créer un élément de site
function createSiteItem(domain, count) {
  const item = document.createElement('div');
  item.className = 'site-item';

  item.innerHTML = `
    <div class="site-info">
      <div class="site-name">${domain}</div>
      <div class="site-count">${count} élément${count > 1 ? 's' : ''} masqué${count > 1 ? 's' : ''}</div>
    </div>
    <button class="site-action" data-domain="${domain}">Reset</button>
  `;

  // Event listener pour le bouton reset
  item.querySelector('.site-action').addEventListener('click', async (e) => {
    e.stopPropagation();
    await resetSite(domain);
  });

  return item;
}

// Configuration des event listeners
function setupEventListeners() {
  toggleEditModeBtn.addEventListener('click', toggleEditMode);
  resetCurrentSiteBtn.addEventListener('click', resetCurrentSite);
  resetAllBtn.addEventListener('click', resetAll);
}

// Toggle du mode édition
async function toggleEditMode() {
  isEditMode = !isEditMode;

  // Mettre à jour l'UI
  if (isEditMode) {
    toggleEditModeBtn.classList.add('active');
    editModeText.textContent = 'mode edition [actif]';
  } else {
    toggleEditModeBtn.classList.remove('active');
    editModeText.textContent = 'mode edition';
  }

  // Envoyer le message au content script
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id) {
    browserAPI.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_EDIT_MODE',
      enabled: isEditMode
    });
  }
}

// Réinitialiser le site actuel
async function resetCurrentSite() {
  if (!currentDomain) return;

  if (!confirm(`Voulez-vous vraiment réinitialiser ${currentDomain} ?`)) {
    return;
  }

  await resetSite(currentDomain);

  // Recharger la page
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id) {
    browserAPI.tabs.reload(tab.id);
  }
}

// Réinitialiser un site spécifique
async function resetSite(domain) {
  const data = await browserAPI.storage.local.get(['maskedElements']);
  const maskedElements = data.maskedElements || {};

  delete maskedElements[domain];

  await browserAPI.storage.local.set({ maskedElements });

  // Recharger les stats et la liste
  await loadStats();
  await loadSitesList();
}

// Réinitialiser tout
async function resetAll() {
  if (!confirm('Voulez-vous vraiment tout réinitialiser ? Cette action est irréversible.')) {
    return;
  }

  await browserAPI.storage.local.set({ maskedElements: {} });

  // Recharger les stats et la liste
  await loadStats();
  await loadSitesList();

  // Recharger la page actuelle
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab?.id) {
    browserAPI.tabs.reload(tab.id);
  }
}

// Écouter les messages du content script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_MASKED') {
    loadStats();
    loadSitesList();
  }
});
