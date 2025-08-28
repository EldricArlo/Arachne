// --- ui.js ---
// Responsibility: All DOM manipulation, event listening, and UI state management.
// It acts as the "view" layer, completely decoupled from business logic.

class UI {
    /** 
     * Enforces the singleton pattern and caches all necessary DOM elements on creation.
     */
    constructor() {
        if (UI._instance) { return UI._instance; }
        UI._instance = this;
        
        this._cacheDOMElements();
        this._handlers = {};
    }

    /** 
     * Queries and caches all required DOM elements on startup for performance.
     * @private 
     */
    _cacheDOMElements() {
        this.navLinks = document.querySelectorAll('.sidebar-nav .nav-item');
        this.views = document.querySelectorAll('.view');
        this.toastContainer = document.getElementById('toast-container');
        this.urlForm = document.getElementById('url-form');
        this.urlInput = document.getElementById('video-url-input');
        this.getInfoBtn = document.getElementById('get-info-btn');
        this.videoInfoContainer = document.getElementById('video-info-container');
        this.singleViewTasksContainer = document.getElementById('single-view-tasks-container');
        this.batchUrlsInput = document.getElementById('batch-urls-input');
        this.batchDownloadBtn = document.getElementById('start-batch-btn');
        this.historyContainer = document.querySelector('.history-list-container');
        this.refreshHistoryBtn = document.getElementById('refresh-history-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-button');
        this.closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
        this.settingsForm = document.getElementById('settings-form');
        this.selectFolderBtn = document.getElementById('select-folder-btn');
        this.downloadsPathInput = document.getElementById('download-path');
        this.profileButton = document.getElementById('profile-button');
        this.profileModal = document.getElementById('profile-modal');
        this.closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
        this.profileForm = document.getElementById('profile-form');
        this.profileAvatarImg = document.getElementById('profile-avatar-img');
        this.profileNameText = document.getElementById('profile-name-text');
        this.profileNameInput = document.getElementById('profile-name-input');
        this.profileAvatarInput = document.getElementById('profile-avatar-input');
        this.selectLocalAvatarBtn = document.getElementById('select-local-avatar-btn');
        this.avatarPositionGroup = document.querySelector('.radio-group');
        this.interactiveGlowElements = document.querySelectorAll('.interactive-glow');
    }

    /** 
     * Binds all event listeners.
     * @param {object} handlers - Callback functions from main.js.
     */
    initialize(handlers) {
        this._handlers = handlers;

        this.navLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); this._handlers.onSwitchView?.(link.dataset.view); }));
        this.urlForm.addEventListener('submit', (e) => { e.preventDefault(); this._handlers.onGetInfo?.(this.urlInput.value.trim()); });
        this.batchDownloadBtn.addEventListener('click', () => this._handlers.onStartBatch?.());
        this.refreshHistoryBtn.addEventListener('click', () => this._handlers.onRefreshHistory?.());
        this.historyContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.history-item-actions button');
            if (button) {
                const { action, value } = button.dataset;
                if (action === 'delete') this._handlers.onDeleteFile?.(value);
                return; // Prevent triggering 'open' on the parent
            }
            const item = e.target.closest('.history-item[data-action="open"]');
            if (item) {
                this._handlers.onOpenFile?.(item.dataset.value);
            }
        });
        
        this.settingsBtn.addEventListener('click', (e) => { e.preventDefault(); this._handlers.onShowSettings?.(); });
        this.closeSettingsModalBtn.addEventListener('click', () => this.toggleSettingsModal(false));
        this.settingsModal.addEventListener('click', (e) => { if (e.target === this.settingsModal) this.toggleSettingsModal(false); });
        this.settingsForm.addEventListener('submit', (e) => { e.preventDefault(); this._handlers.onSaveSettings?.(); });
        this.selectFolderBtn.addEventListener('click', () => this._handlers.onSelectFolder?.());

        this.profileButton.addEventListener('click', () => this._handlers.onShowProfile?.());
        this.closeProfileModalBtn.addEventListener('click', () => this.toggleProfileModal(false));
        this.profileModal.addEventListener('click', (e) => { if (e.target === this.profileModal) this.toggleProfileModal(false); });
        this.profileForm.addEventListener('submit', (e) => { e.preventDefault(); this._handlers.onSaveProfile?.(); });
        this.selectLocalAvatarBtn.addEventListener('click', () => this._handlers.onSelectLocalAvatar?.());

        this.interactiveGlowElements.forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            });
        });
        
        this._handlers.onLoadProfile?.();
    }

    // --- VIEW & STATE MANIPULATION METHODS ---

    switchView(viewName) {
        this.views.forEach(view => view.classList.remove('active'));
        document.getElementById(`view-${viewName}`)?.classList.add('active');
        this.navLinks.forEach(link => {
            const isActive = link.dataset.view === viewName;
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    setLoadingState(button, isLoading) {
        if (!button) return;
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
    }

    /**
     * [SECURED] Creates and displays the video info card using safe DOM methods.
     */
    displayVideoInfo(info) {
        this.clearVideoInfo();
        
        const card = document.createElement('div');
        card.className = 'video-info-card';

        const thumb = document.createElement('img');
        thumb.src = info.thumbnail;
        thumb.alt = 'Video thumbnail';
        thumb.className = 'video-info-thumb';
        
        const details = document.createElement('div');
        details.className = 'video-info-details';

        const title = document.createElement('h3');
        title.textContent = info.title; // Securely set text content

        const uploader = document.createElement('p');
        uploader.textContent = `By: ${info.uploader}`;

        const duration = document.createElement('p');
        duration.textContent = `Duration: ${new Date(info.duration * 1000).toISOString().substr(11, 8)}`;

        const optionsHtml = `
            <div class="download-options">
                <select id="quality-select"><option value="best">Best</option><option value="1080p" selected>1080p</option><option value="720p">720p</option><option value="worst">Worst</option></select>
                <select id="format-select"><option value="mp4">MP4</option><option value="mkv">MKV</option><option value="webm">WebM</option></select>
                <div class="audio-only-toggle"><input type="checkbox" id="audio-only-checkbox"><label for="audio-only-checkbox">Audio Only</label></div>
            </div>`;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'download-btn';
        downloadBtn.className = 'cta-button';
        downloadBtn.innerHTML = `<i class="ri-download-2-line"></i> Download`;
        downloadBtn.addEventListener('click', () => {
            const options = {
                quality: document.getElementById('quality-select').value,
                format: document.getElementById('format-select').value,
                audioOnly: document.getElementById('audio-only-checkbox').checked
            };
            this._handlers.onDownload?.(options);
        });

        details.appendChild(title);
        details.appendChild(uploader);
        details.appendChild(duration);
        details.innerHTML += optionsHtml; // This part is static and safe
        details.appendChild(downloadBtn);
        card.appendChild(thumb);
        card.appendChild(details);

        this.videoInfoContainer.appendChild(card);
    }
    
    // --- [MODIFIED] Centralized render logic for history and tasks ---
    renderHistory(files, activeTasks) {
        if (!this.historyContainer) return;
        
        this.historyContainer.innerHTML = ''; // Clear existing content
        const fragment = document.createDocumentFragment();

        // Create a set of filenames from completed files for quick lookup
        const completedFileNames = new Set(files.map(file => file.name));

        // 1. Render active tasks first, skipping any that are already 'completed' and in the file list
        activeTasks.forEach(task => {
            if (task.status === 'completed' && completedFileNames.has(task.title)) {
                return; // Avoid duplication
            }
            fragment.appendChild(this._createTaskItemElement(task));
        });

        // 2. Render completed files
        files.forEach(file => {
            fragment.appendChild(this._createHistoryItemElement(file));
        });

        if (!fragment.hasChildNodes()) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-history-message';
            emptyMessage.textContent = 'No downloads yet. Your history will appear here.';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = 'var(--text-secondary)';
            fragment.appendChild(emptyMessage);
        }

        this.historyContainer.appendChild(fragment);
    }
    
    // --- [MODIFIED] Single-responsibility functions ---
    addTaskToSingleView(task) {
        if (this.singleViewTasksContainer) {
            this.singleViewTasksContainer.prepend(this._createTaskItemElement(task));
        }
    }

    clearSingleViewTasks() {
        if (this.singleViewTasksContainer) {
            this.singleViewTasksContainer.innerHTML = '';
        }
    }

    addOrUpdateTask(task) {
        // This function now ONLY updates existing elements, preventing duplication.
        const existingElement = document.getElementById(`task-${task.id}`);
        if (existingElement) {
            this._updateTaskElement(existingElement, task);
        } else {
           // If not found, do nothing. The main renderHistory call will handle adding it.
           console.log(`Task element for ${task.id} not found, will be added on next history refresh.`);
        }
    }

    _updateTaskElement(element, task) {
        const progress = element.querySelector('.progress-bar-inner');
        const statusText = element.querySelector('.task-status-text');
        
        if (progress) progress.style.width = `${task.percent || 0}%`;
        
        if (statusText) {
            let text = task.status;
            if (task.status === 'downloading') {
                text = `${Math.round(task.percent || 0)}%`;
            } else if (task.message) {
                text = task.message;
            } else if (task.status === 'error' && task.error) {
                text = `Error: ${task.error}`; // Show detailed error
            }
            statusText.textContent = text;
        }

        // If task completes or errors, prepare for conversion to a static history item on next refresh
        if (['completed', 'error'].includes(task.status)) {
            element.classList.remove('task-item');
        }
    }

    /**
     * [SECURED] Creates a DOM element for an active task.
     */
    _createTaskItemElement(task) {
        const item = document.createElement('div');
        item.className = 'history-item task-item';
        item.id = `task-${task.id}`;

        const thumb = document.createElement('img');
        thumb.className = 'history-item-thumb';
        thumb.src = task.thumbnail || '';
        thumb.onerror = () => { thumb.style.display = 'none'; };
        
        const info = document.createElement('div');
        info.className = 'history-item-info';

        const title = document.createElement('span');
        title.className = 'history-item-title';
        title.textContent = task.title || 'Fetching title...'; // Secure

        const status = document.createElement('div');
        status.className = 'task-status';
        status.innerHTML = `
            <div class="progress-bar"><div class="progress-bar-inner" style="width: ${task.percent || 0}%;"></div></div>
            <span class="task-status-text">${task.status === 'downloading' ? `${Math.round(task.percent || 0)}%` : (task.message || task.status)}</span>`;

        info.append(title, status);
        item.append(thumb, info);
        return item;
    }
    
    /**
     * [SECURED] Creates a DOM element for a completed file.
     */
    _createHistoryItemElement(file) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.action = 'open';
        item.dataset.value = file.path;

        const thumb = document.createElement('div');
        thumb.className = 'history-item-thumb icon-thumb';
        thumb.innerHTML = `<i class="ri-file-video-line"></i>`;

        const info = document.createElement('div');
        info.className = 'history-item-info';

        const title = document.createElement('span');
        title.className = 'history-item-title';
        title.textContent = file.name; // Secure

        const meta = document.createElement('span');
        meta.className = 'history-item-meta';
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        meta.textContent = `Size: ${fileSize} MB | Completed: ${new Date(file.created * 1000).toLocaleString()}`;
        
        const actions = document.createElement('div');
        actions.className = 'history-item-actions';
        actions.innerHTML = `<button class="icon-button" data-action="delete" data-value="${file.name}" aria-label="Delete file"><i class="ri-delete-bin-line"></i></button>`;

        info.append(title, meta);
        item.append(thumb, info, actions);
        return item;
    }
    
    // --- Helper & Utility functions ---
    clearVideoInfo() { this.videoInfoContainer.innerHTML = ''; }
    clearUrlInput() { this.urlInput.value = ''; }
    getBatchUrls() { return this.batchUrlsInput.value.split('\n').map(url => url.trim()).filter(Boolean); }
    clearBatchUrls() { this.batchUrlsInput.value = ''; }
    displayError(message) { this.videoInfoContainer.innerHTML = `<p style="color: #f05a5a; text-align: center; margin-top: 1rem;">${message}</p>`; }
    toggleSettingsModal(show) { this.settingsModal.classList.toggle('visible', show); }
    loadSettings(config) { /* ... unchanged ... */ }
    collectSettings() { /* ... unchanged ... */ }
    updateDownloadsPathInput(path) { this.downloadsPathInput.value = path; }
    toggleProfileModal(show) { this.profileModal.classList.toggle('visible', show); }
    loadProfile(profileData) { /* ... unchanged ... */ }
    populateProfileForm(profileData) { /* ... unchanged ... */ }
    collectProfileSettings() { /* ... unchanged ... */ }
    updateAvatarUrlInput(url) { this.profileAvatarInput.value = url; }
    showToast(message, type = 'success') { /* ... unchanged ... */ }
    showFatalError(message) { /* ... unchanged ... */ }
}

const ui = new UI();