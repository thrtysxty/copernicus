// tools/nlm-safari/popup/popup.js

document.addEventListener('DOMContentLoaded', () => {
    const toolsTabBtn = document.getElementById('tools-tab-btn');
    const promptsTabBtn = document.getElementById('prompts-tab-btn');
    const toolsTabContent = document.getElementById('tools-tab-content');
    const promptsTabContent = document.getElementById('prompts-tab-content');

    const exportNotebooksBtn = document.getElementById('export-notebooks');
    const importNotebooksFile = document.getElementById('import-notebooks-file');
    const importNotebooksBtn = document.getElementById('import-notebooks-btn');
    const bulkImportUrlsTextarea = document.getElementById('bulk-import-urls');
    const bulkImportBtn = document.getElementById('bulk-import-btn');
    const progressDiv = document.getElementById('progress');

    const promptsListDiv = document.getElementById('prompts-list');
    const newPromptTitleInput = document.getElementById('new-prompt-title');
    const newPromptBodyTextarea = document.getElementById('new-prompt-body');
    const addPromptBtn = document.getElementById('add-prompt-btn');

    // --- Tab Switching ---
    toolsTabBtn.addEventListener('click', () => {
        toolsTabContent.style.display = 'block';
        promptsTabContent.style.display = 'none';
    });

    promptsTabBtn.addEventListener('click', () => {
        toolsTabContent.style.display = 'none';
        promptsTabContent.style.display = 'block';
        renderPrompts();
    });

    // --- Export Logic ---
    exportNotebooksBtn.addEventListener('click', async () => {
        progressDiv.textContent = 'Exporting...';
        const response = await browser.runtime.sendMessage({ action: 'export' });
        if (response && response.notebooks) {
            const data = {
                exportedAt: new Date().toISOString(),
                notebooks: response.notebooks
            };
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nlm-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            progressDiv.textContent = 'Export complete!';
        } else {
            progressDiv.textContent = 'Export failed or no notebooks found.';
        }
    });

    // --- Import Logic ---
    importNotebooksBtn.addEventListener('click', () => {
        const file = importNotebooksFile.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.notebooks && Array.isArray(data.notebooks)) {
                        progressDiv.textContent = `Importing ${data.notebooks.length} notebooks...`;
                        for (const notebook of data.notebooks) {
                            progressDiv.textContent = `Creating notebook: ${notebook.name}...`;
                            await browser.runtime.sendMessage({ action: 'createNotebook', title: notebook.name });
                            // Need to find the newly created notebook's ID to add sources
                            // This part is complex and needs sophisticated content script logic
                            // For simplicity, we're skipping source import for now in popup.js
                            // A full implementation would involve the content script
                            // returning the new notebook ID after creation.
                        }
                        progressDiv.textContent = 'Import process initiated (notebook creation only). Source import requires further implementation.';
                    } else {
                        progressDiv.textContent = 'Invalid import file format.';
                    }
                } catch (error) {
                    progressDiv.textContent = `Error importing file: ${error.message}`;
                }
            };
            reader.readAsText(file);
        } else {
            progressDiv.textContent = 'Please select a file to import.';
        }
    });

    // --- Bulk Import Logic ---
    bulkImportBtn.addEventListener('click', async () => {
        const urls = bulkImportUrlsTextarea.value.split('
').map(url => url.trim()).filter(url => url.length > 0);
        if (urls.length > 0) {
            progressDiv.textContent = `Bulk importing ${urls.length} URLs...`;
            const response = await browser.runtime.sendMessage({ action: 'bulkImport', urls: urls });
            if (response && response.success) {
                progressDiv.textContent = `Bulk import complete: ${response.count} URLs processed.`;
            } else {
                progressDiv.textContent = 'Bulk import failed.';
            }
        } else {
            progressDiv.textContent = 'Please enter URLs for bulk import.';
        }
    });

    // --- Prompts Tab Logic ---
    async function getPrompts() {
        const stored = await browser.storage.local.get('nlm_prompts');
        return stored.nlm_prompts || {};
    }

    async function savePrompts(prompts) {
        await browser.storage.local.set({ nlm_prompts: prompts });
    }

    async function renderPrompts() {
        promptsListDiv.innerHTML = '';
        const prompts = await getPrompts();
        for (const id in prompts) {
            const prompt = prompts[id];
            const div = document.createElement('div');
            div.className = 'prompt-item';
            div.innerHTML = `
                <span><strong>${prompt.title}</strong>: ${prompt.body.substring(0, 50)}...</span>
                <div>
                    <button data-id="${id}" class="edit-prompt-btn">Edit</button>
                    <button data-id="${id}" class="delete-prompt-btn">Delete</button>
                </div>
            `;
            promptsListDiv.appendChild(div);
        }

        document.querySelectorAll('.delete-prompt-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const idToDelete = e.target.dataset.id;
                const currentPrompts = await getPrompts();
                delete currentPrompts[idToDelete];
                await savePrompts(currentPrompts);
                renderPrompts();
            });
        });

        // Edit functionality is more complex and left for future implementation
        document.querySelectorAll('.edit-prompt-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                alert('Edit functionality not yet implemented.');
            });
        });
    }

    addPromptBtn.addEventListener('click', async () => {
        const title = newPromptTitleInput.value.trim();
        const body = newPromptBodyTextarea.value.trim();

        if (title && body) {
            const currentPrompts = await getPrompts();
            const newId = `prompt-${Date.now()}`;
            currentPrompts[newId] = { title, body };
            await savePrompts(currentPrompts);
            newPromptTitleInput.value = '';
            newPromptBodyTextarea.value = '';
            renderPrompts();
        } else {
            alert('Please enter both title and body for the prompt.');
        }
    });

    renderPrompts(); // Initial render for prompts tab
});

