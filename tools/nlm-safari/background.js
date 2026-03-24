// tools/nlm-safari/background.js

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    // Forward messages to content script or handle background tasks here
    // For this extension, most heavy lifting is in content script,
    // so we primarily relay messages to the active tab.

    if (request.action) {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs[0]) {
                browser.tabs.sendMessage(tabs[0].id, request).then(sendResponse);
            }
        });
        return true; // Indicate async response
    }
});

browser.action.onClicked.addListener((tab) => {
    console.log('Browser action clicked on tab:', tab.id);
    // You might want to send a message to the content script here
    // or perform some action when the extension icon is clicked.
});

