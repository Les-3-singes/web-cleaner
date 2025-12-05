// Service Worker pour l'extension Web Cleaner

// Installation de l'extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Web Cleaner extension installée');

  // Initialiser le storage si nécessaire
  chrome.storage.local.get(['maskedElements'], (result) => {
    if (!result.maskedElements) {
      chrome.storage.local.set({
        maskedElements: {},
        settings: {
          enabled: true,
          showIndicators: true
        }
      });
    }
  });
});

// Écouter les messages des content scripts et du popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_MASKED') {
    // Propager le message au popup si ouvert
    chrome.runtime.sendMessage(message).catch(() => {
      // Le popup n'est pas ouvert, c'est normal
    });
  }
});

// Gestion des mises à jour de l'extension
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('Mise à jour disponible');
});
