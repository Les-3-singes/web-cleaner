// Polyfill pour compatibilité Chrome/Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Installation de l'extension
browserAPI.runtime.onInstalled.addListener(() => {
  console.log('Web Cleaner extension installée');

  // Initialiser le storage si nécessaire
  browserAPI.storage.local.get(['maskedElements']).then((result) => {
    if (!result.maskedElements) {
      browserAPI.storage.local.set({
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
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ELEMENT_MASKED') {
    // Propager le message au popup si ouvert
    browserAPI.runtime.sendMessage(message).catch(() => {
      // Le popup n'est pas ouvert, c'est normal
    });
  }
});
