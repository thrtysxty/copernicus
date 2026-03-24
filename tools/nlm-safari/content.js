// tools/nlm-safari/content.js

// --- Export Functions ---

function scrapeNotebooks() {
    const notebooks = [];
    document.querySelectorAll('.notebook-card').forEach(card => {
        const name = card.querySelector('.notebook-card-title').textContent.trim();
        const idMatch = card.href ? card.href.match(/notebooks\/([^/]+)/) : null;
        const id = idMatch ? idMatch[1] : card.dataset.notebookId; // Fallback to data attribute

        const sources = [];
        card.querySelectorAll('.source-item').forEach(sourceEl => {
            const title = sourceEl.querySelector('.source-item-title').textContent.trim();
            const type = sourceEl.querySelector('.source-item-type').textContent.trim();
            const url = sourceEl.href; // Assumes source items have href
            sources.push({ title, type, url });
        });
        notebooks.push({ id, name, sources });
    });
    return notebooks;
}

// --- Import Functions (Simplified for illustration, actual DOM interaction might be complex) ---

async function simulateClick(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.click();
        return true;
    }
    console.warn('Element not found for click:', selector);
    return false;
}

async function simulateInput(selector, value) {
    const input = document.querySelector(selector);
    if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true })); // Some frameworks listen to 'change'
        return true;
    }
    console.warn('Input element not found:', selector);
    return false;
}

async function createNotebook(title) {
    if (await simulateClick('button[data-action="new-notebook"]')) {
        await new Promise(r => setTimeout(r, 500)); // Wait for dialog
        if (await simulateInput('input[placeholder="Notebook title"]', title)) {
            await simulateClick('button[data-action="create-notebook-confirm"]');
            return true;
        }
    }
    return false;
}

async function addSource(url) {
    if (await simulateClick('button[data-action="add-source"]')) {
        await new Promise(r => setTimeout(r, 500)); // Wait for dialog
        if (await simulateInput('input[placeholder="Enter URL"]', url)) {
            await simulateClick('button[data-action="add-source-confirm"]');
            return true;
        }
    }
    return false;
}

// --- Folder Sidebar ---

function injectFolderSidebar() {
    const nav = document.querySelector('.notebook-list-sidebar'); // Adjust selector as needed
    if (nav) {
        const aside = document.createElement('aside');
        aside.id = 'nlm-folder-sidebar';
        aside.innerHTML = `
            <h3>Folders <button id="nlm-add-folder">+</button></h3>
            <ul id="nlm-folders-list"></ul>
        `;
        nav.prepend(aside); // Or append, depending on desired placement

        document.getElementById('nlm-add-folder').addEventListener('click', async () => {
            const folderName = prompt('Enter new folder name:');
            if (folderName) {
                const folders = await browser.storage.local.get('nlm_folders') || {};
                const newFolderId = `folder-${Date.now()}`;
                folders.nlm_folders[newFolderId] = { name: folderName, notebookIds: [] };
                await browser.storage.local.set(folders);
                renderFolders();
            }
        });

        renderFolders(); // Initial render
    }
}

async function renderFolders() {
    const foldersContainer = document.getElementById('nlm-folders-list');
    if (foldersContainer) {
        foldersContainer.innerHTML = '';
        const stored = await browser.storage.local.get('nlm_folders');
        const folders = stored.nlm_folders || {};
        for (const id in folders) {
            const li = document.createElement('li');
            li.textContent = folders[id].name;
            foldersContainer.appendChild(li);
        }
    }
}

// --- Tags ---

function injectTagChips() {
    document.querySelectorAll('.notebook-card').forEach(card => {
        // Placeholder for injecting tag input
        const tagInputContainer = document.createElement('div');
        tagInputContainer.className = 'nlm-tag-input-container';
        tagInputContainer.innerHTML = `<input type="text" placeholder="Add tags...">`;
        card.appendChild(tagInputContainer); // Adjust placement

        // Logic to load/save tags from browser.storage.local 'nlm_tags'
    });

    // Placeholder for injecting tag filter bar
    const filterBar = document.createElement('div');
    filterBar.id = 'nlm-tag-filter-bar';
    filterBar.innerHTML = `<input type="text" placeholder="Filter by tag...">`;
    document.querySelector('.notebook-list-header').prepend(filterBar); // Adjust placement
}

// --- Saved Prompts ---

function injectPromptsButton() {
    const chatInputArea = document.querySelector('.chat-input-area'); // Adjust selector
    if (chatInputArea) {
        const promptsButton = document.createElement('button');
        promptsButton.id = 'nlm-prompts-button';
        promptsButton.textContent = 'Prompts';
        chatInputArea.prepend(promptsButton); // Adjust placement

        promptsButton.addEventListener('click', () => {
            // Logic to open prompts picker, load from browser.storage.local 'nlm_prompts'
            // and insert into chat textarea
        });
    }
}

// --- Bulk Import (exposed to window for popup) ---

window.__nlmBulkImport = async (urls) => {
    console.log('NLM Bulk Import started with URLs:', urls);
    for (const url of urls) {
        await addSource(url);
        await new Promise(r => setTimeout(r, 1000)); // Simulate delay
    }
    console.log('NLM Bulk Import finished.');
    return { success: true, count: urls.length };
};

// --- Message Listener from Popup ---

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'export') {
        const notebooks = scrapeNotebooks();
        sendResponse({ notebooks });
    } else if (request.action === 'createNotebook') {
        createNotebook(request.title).then(success => sendResponse({ success }));
        return true; // Indicate async response
    } else if (request.action === 'addSource') {
        addSource(request.url).then(success => sendResponse({ success }));
        return true;
    } else if (request.action === 'bulkImport') {
        window.__nlmBulkImport(request.urls).then(result => sendResponse(result));
        return true;
    }
    // Implement other actions as needed (e.g., folder, tag, prompt management)
});

// --- Initial Injections on page load ---
// These should be called when the DOM is ready and NotebookLM is loaded
// For simplicity, calling them directly for now. In a real scenario,
// you might observe DOM changes or use a more robust injection strategy.
// injectFolderSidebar();
// injectTagChips();
// injectPromptsButton();

