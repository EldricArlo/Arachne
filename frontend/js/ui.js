// --- ui.js ---
// Responsibility: All DOM manipulation, event listening, and UI state management.
// It acts as the "view" layer, completely decoupled from business logic.

class UI {
    /** 
     * Enforces the singleton pattern and caches all necessary DOM elements on creation 
     * to avoid repeated, costly queries to the DOM.
     */
    constructor() {
        if (UI._instance) { return UI._instance; }
        UI._instance = this;
        
        this._cacheDOMElements();
        this._handlers = {}; // This will store callback functions from the controller (main.js)
    }

    /** 
     * Queries and caches all required DOM elements on startup for performance.
     * @private 
     */
    _cacheDOMElements() {
        // Core navigation & feedback
        this.navLinks = document.querySelectorAll('.sidebar-nav .nav-item');
        this.views = document.querySelectorAll('.view');
        this.toastContainer = document.getElementById('toast-container');
        
        // Single Download View
        this.urlForm = document.getElementById('url-form');
        this.urlInput = document.getElementById('video-url-input');
        this.getInfoBtn = document.getElementById('get-info-btn');
        this.videoInfoContainer = document.getElementById('video-info-container');
        // --- MODIFICATION START ---
        this.singleViewTasksContainer = document.getElementById('single-view-tasks-container');
        // --- MODIFICATION END ---
        
        // Batch Download View
        this.batchUrlsInput = document.getElementById('batch-urls-input');
        this.batchDownloadBtn = document.getElementById('start-batch-btn');

        // History View
        this.historyContainer = document.querySelector('.history-list-container');
        this.refreshHistoryBtn = document.getElementById('refresh-history-btn');

        // Settings Modal
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-button');
        this.closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
        this.settingsForm = document.getElementById('settings-form');
        this.selectFolderBtn = document.getElementById('select-folder-btn');
        this.downloadsPathInput = document.getElementById('download-path');

        // Profile Elements
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

        // Interactive Glow Elements
        this.interactiveGlowElements = document.querySelectorAll('.interactive-glow');
    }

    /** 
     * Binds all event listeners. This method is the bridge between raw user input 
     * and the application's logic handlers provided by the controller.
     * @param {object} handlers - An object containing callback functions from main.js.
     */
    initialize(handlers) {
        this._handlers = handlers;

        // --- View Switching ---
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this._handlers.onSwitchView?.(link.dataset.view);
            });
        });

        // --- Single Video ---
        this.urlForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handlers.onGetInfo?.(this.urlInput.value.trim());
        });

        // --- Batch Download ---
        this.batchDownloadBtn.addEventListener('click', () => this._handlers.onStartBatch?.());

        // --- History View ---
        this.refreshHistoryBtn.addEventListener('click', () => this._handlers.onRefreshHistory?.());
        this.historyContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item-actions button, .history-item');
            if (!item) return;
            const { action, value } = item.dataset;
            if (action === 'open') this._handlers.onOpenFile?.(value);
            else if (action === 'delete') this._handlers.onDeleteFile?.(value);
        });
        
        // --- Settings Modal ---
        this.settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this._handlers.onShowSettings?.();
        });
        this.closeSettingsModalBtn.addEventListener('click', () => this.toggleSettingsModal(false));
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.toggleSettingsModal(false);
        });
        this.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handlers.onSaveSettings?.();
        });
        this.selectFolderBtn.addEventListener('click', () => this._handlers.onSelectFolder?.());

        // --- Profile Modal ---
        this.profileButton.addEventListener('click', () => this._handlers.onShowProfile?.());
        this.closeProfileModalBtn.addEventListener('click', () => this.toggleProfileModal(false));
        this.profileModal.addEventListener('click', (e) => {
            if (e.target === this.profileModal) this.toggleProfileModal(false);
        });
        this.profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handlers.onSaveProfile?.();
        });
        this.selectLocalAvatarBtn.addEventListener('click', () => this._handlers.onSelectLocalAvatar?.());

        // --- Dynamic Mouse Glow Effect ---
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

    displayVideoInfo(info) {
        const infoHTML = `
            <div class="video-info-card">
                <img src="${info.thumbnail}" alt="Video thumbnail" class="video-info-thumb">
                <div class="video-info-details">
                    <h3>${info.title}</h3>
                    <p>By: ${info.uploader}</p>
                    <p>Duration: ${new Date(info.duration * 1000).toISOString().substr(11, 8)}</p>
                    <div class="download-options">
                        <select id="quality-select"><option value="best">Best</option><option value="1080p" selected>1080p</option><option value="720p">720p</option><option value="worst">Worst</option></select>
                        <select id="format-select"><option value="mp4">MP4</option><option value="mkv">MKV</option><option value="webm">WebM</option></select>
                        <div class="audio-only-toggle"><input type="checkbox" id="audio-only-checkbox"><label for="audio-only-checkbox">Audio Only</label></div>
                    </div>
                    <button id="download-btn" class="cta-button"><i class="ri-download-2-line"></i> Download</button>
                </div>
            </div>`;
        this.videoInfoContainer.innerHTML = infoHTML;
        document.getElementById('download-btn').addEventListener('click', () => {
            const options = {
                quality: document.getElementById('quality-select').value,
                format: document.getElementById('format-select').value,
                audioOnly: document.getElementById('audio-only-checkbox').checked
            };
            this._handlers.onDownload?.(options);
        });
    }

    clearVideoInfo() { this.videoInfoContainer.innerHTML = ''; }
    clearUrlInput() { this.urlInput.value = ''; }
    getBatchUrls() { return this.batchUrlsInput.value.split('\n').map(url => url.trim()).filter(Boolean); }
    clearBatchUrls() { this.batchUrlsInput.value = ''; }
    displayError(message) { this.videoInfoContainer.innerHTML = `<p style="color: #f05a5a; text-align: center; margin-top: 1rem;">${message}</p>`; }

    renderHistory(files, activeTasks) {
        if (!this.historyContainer) return;
        let content = '';
        activeTasks.forEach(task => { content += this._createTaskItemHTML(task); });
        files.forEach(file => { content += this._createHistoryItemHTML(file); });
        if (!content) {
            content = '<p class="empty-history-message" style="text-align:center; color: var(--text-secondary);">No downloads yet. Your history will appear here.</p>';
        }
        this.historyContainer.innerHTML = content;
    }

    // --- MODIFICATION START ---
    /**
     * Adds a new task UI element specifically to the single video view's task container.
     * @param {object} task - The task data object.
     */
    addTaskToSingleView(task) {
        if (this.singleViewTasksContainer) {
            this.singleViewTasksContainer.insertAdjacentHTML('afterbegin', this._createTaskItemHTML(task));
        }
    }

    /**
     * Clears all task UI elements from the single video view's task container.
     */
    clearSingleViewTasks() {
        if (this.singleViewTasksContainer) {
            this.singleViewTasksContainer.innerHTML = '';
        }
    }

    /**
     * A generic function to update a task's UI, wherever it might be in the document.
     * If the task element doesn't exist, it adds it to the history view by default.
     * @param {object} task - The task data object with the latest progress.
     */
    addOrUpdateTask(task) {
        // Use getElementById for a global search, as the task could be in the single view or history view.
        const existingElement = document.getElementById(`task-${task.id}`);
        
        if (existingElement) {
            const progress = existingElement.querySelector('.progress-bar-inner');
            const statusText = existingElement.querySelector('.task-status-text');
            
            if (progress) {
                progress.style.width = `${task.percent || 0}%`;
            }
            if (statusText) {
                statusText.textContent = task.status === 'downloading' ? `${Math.round(task.percent || 0)}%` : (task.message || task.status);
            }
        } else {
            // Default behavior: if a task is not found, add it to the main history page.
            // This handles cases like batch downloads or tasks from a previous session.
            const emptyMessage = this.historyContainer.querySelector('.empty-history-message');
            if (emptyMessage) {
                emptyMessage.remove();
            }
            this.historyContainer.insertAdjacentHTML('afterbegin', this._createTaskItemHTML(task));
        }
    }
    // --- MODIFICATION END ---

    _createTaskItemHTML(task) {
        return `
            <div class="history-item task-item" id="task-${task.id}">
                <img src="${task.thumbnail || ''}" class="history-item-thumb" onerror="this.style.display='none'">
                <div class="history-item-info">
                    <span class="history-item-title">${task.title || 'Fetching title...'}</span>
                    <div class="task-status">
                        <div class="progress-bar"><div class="progress-bar-inner" style="width: ${task.percent || 0}%;"></div></div>
                        <span class="task-status-text">${task.status === 'downloading' ? `${Math.round(task.percent || 0)}%` : (task.message || task.status)}</span>
                    </div>
                </div>
            </div>`;
    }

    _createHistoryItemHTML(file) {
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        return `
            <div class="history-item" data-action="open" data-value="${file.path}">
                <div class="history-item-thumb icon-thumb"><i class="ri-file-video-line"></i></div>
                <div class="history-item-info">
                    <span class="history-item-title">${file.name}</span>
                    <span class="history-item-meta">Size: ${fileSize} MB | Completed: ${new Date(file.created * 1000).toLocaleString()}</span>
                </div>
                <div class="history-item-actions">
                    <button class="icon-button" data-action="delete" data-value="${file.name}" aria-label="Delete file"><i class="ri-delete-bin-line"></i></button>
                </div>
            </div>`;
    }

    toggleSettingsModal(show) { this.settingsModal.classList.toggle('visible', show); }
    
    loadSettings(config) {
        this.settingsForm.elements['downloads_dir'].value = config.downloads_dir || '';
        this.settingsForm.elements['max_concurrent_downloads'].value = config.max_concurrent_downloads || 3;
        this.settingsForm.elements['limit_rate'].value = config.limit_rate || '0';
        this.settingsForm.elements['use_aria2'].checked = config.use_aria2 || false;
        this.settingsForm.elements['embed_thumbnail'].checked = config.embed_thumbnail || false;
        this.settingsForm.elements['embed_subtitles'].checked = config.embed_subtitles || false;
    }

    collectSettings() {
        const formData = new FormData(this.settingsForm);
        const data = {};
        for (const [key, value] of formData.entries()) { data[key] = value; }
        data.use_aria2 = this.settingsForm.elements['use_aria2'].checked;
        data.embed_thumbnail = this.settingsForm.elements['embed_thumbnail'].checked;
        data.embed_subtitles = this.settingsForm.elements['embed_subtitles'].checked;
        return data;
    }

    updateDownloadsPathInput(path) { this.downloadsPathInput.value = path; }
    
    toggleProfileModal(show) { this.profileModal.classList.toggle('visible', show); }
    
    loadProfile(profileData) {
        if (profileData.userName) this.profileNameText.textContent = profileData.userName;
        if (profileData.avatarUrl) this.profileAvatarImg.src = profileData.avatarUrl;
        if (profileData.avatarPosition) this.profileAvatarImg.style.objectPosition = profileData.avatarPosition;
    }
    
    populateProfileForm(profileData) {
        this.profileNameInput.value = profileData.userName || '';
        this.profileAvatarInput.value = profileData.avatarUrl?.startsWith('data:') ? '' : profileData.avatarUrl || '';
        const currentPosition = profileData.avatarPosition || 'center';
        const radioToCheck = this.avatarPositionGroup.querySelector(`input[value="${currentPosition}"]`);
        if (radioToCheck) radioToCheck.checked = true;
    }
    
    collectProfileSettings() {
        const selectedRadio = this.avatarPositionGroup.querySelector('input[name="avatarPosition"]:checked');
        return {
            userName: this.profileNameInput.value.trim(),
            avatarUrl: this.profileAvatarInput.value.trim(),
            avatarPosition: selectedRadio ? selectedRadio.value : 'center'
        };
    }

    updateAvatarUrlInput(url) { this.profileAvatarInput.value = url; }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }
    
    showFatalError(message) {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `<div class="fatal-error" style="text-align:center; color: var(--aurora-3);">${message}</div>`;
    }
}

const ui = new UI();