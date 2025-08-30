// --- ui.js ---
// Responsibility: All DOM manipulation, event listening, and UI state management.
// It acts as the "view" layer, completely decoupled from business logic.

class UI {
    /** Enforces the singleton pattern and caches DOM elements on creation. */
    constructor() {
        if (UI._instance) { return UI._instance; }
        UI._instance = this;
        
        this._cacheDOMElements();
        this._handlers = {}; // To store callbacks from the controller (main.js)
    }

    /** Queries and caches all required DOM elements on startup for performance. @private */
    _cacheDOMElements() {
        // FIX #2: Make the navLinks query more specific to exclude the settings button.
        // It now only selects items within the main navigation area.
        this.navLinks = document.querySelectorAll('.sidebar-nav .nav-item');
        this.views = document.querySelectorAll('.view');
        
        // Single Download View
        this.urlForm = document.getElementById('url-form');
        this.urlInput = document.getElementById('video-url-input');
        this.getInfoBtn = document.getElementById('get-info-btn');
        this.videoInfoContainer = document.getElementById('video-info-container');
        
        // Settings Modal
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsBtn = document.getElementById('settings-button');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.settingsForm = document.getElementById('settings-form');

        // Interactive Glow Elements
        this.interactiveGlowElements = document.querySelectorAll('.interactive-glow');
    }

    /** Binds all event listeners. This method is the bridge between raw user input and the application's logic handlers provided by main.js. */
    initialize(handlers) {
        this._handlers = handlers;

        // View switching - now correctly ignores the settings button
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewName = link.dataset.view;
                this.switchView(viewName);
            });
        });

        // Single video info fetching form submission
        this.urlForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handlers.onGetInfo?.(this.urlInput.value);
        });

        // Settings Modal events are handled separately and correctly
        this.settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this._handlers.onShowSettings?.();
        });
        this.closeModalBtn.addEventListener('click', () => this.toggleSettingsModal(false));
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.toggleSettingsModal(false); // Close on overlay click
        });
        this.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handlers.onSaveSettings?.();
        });

        // Aurora mouse glow effect
        this.interactiveGlowElements.forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                el.style.setProperty('--mouse-x', `${x}px`);
                el.style.setProperty('--mouse-y', `${y}px`);
            });
        });
    }

    // --- ATOMIC UI MANIPULATION METHODS ---

    /** Switches the currently visible content view. */
    switchView(viewName) {
        this.views.forEach(view => view.classList.remove('active'));
        document.getElementById(`view-${viewName}`)?.classList.add('active');

        this.navLinks.forEach(link => {
            const isActive = link.dataset.view === viewName;
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    /** Renders video information into its container using styled components. */
    displayVideoInfo(info) {
        const infoHTML = `
            <div class="video-info-card">
                <img src="${info.thumbnail}" alt="Video thumbnail" class="video-info-thumb">
                <div class="video-info-details">
                    <h3>${info.title}</h3>
                    <p>By ${info.author}</p>
                    <p>Duration: ${info.duration}</p>
                    <button class="cta-button">Download</button>
                </div>
            </div>`;
        this.videoInfoContainer.innerHTML = infoHTML;
    }

    /** Clears the video information container. */
    clearVideoInfo() {
        this.videoInfoContainer.innerHTML = '';
    }

    /** Displays a formatted error message in the video info container. */
    displayError(message) {
        this.videoInfoContainer.innerHTML = `<p style="color: var(--aurora-3); text-align: center; margin-top: 1.5rem;">${message}</p>`;
    }

    /** Sets the loading state for a button, showing/hiding the custom loader. */
    setLoadingState(button, isLoading) {
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
    }

    /** Shows or hides the settings modal with smooth transitions. */
    toggleSettingsModal(show) {
        this.settingsModal.classList.toggle('visible', show);
    }
    
    /** Populates the settings form with data from a configuration object. */
    loadSettings(config) {
        this.settingsForm.elements.downloadPath.value = config.downloadPath || '';
        this.settingsForm.elements.videoQuality.value = config.videoQuality || 'best';
        this.settingsForm.elements.maxConcurrent.value = config.maxConcurrent || 3;
    }

    /** Collects and returns the current values from the settings form. */
    collectSettings() {
        const formData = new FormData(this.settingsForm);
        return Object.fromEntries(formData.entries());
    }
}

const ui = new UI();