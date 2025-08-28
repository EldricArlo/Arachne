// --- renderer.js ---
// This is the entry point script linked in the HTML.
// Its only job is to initialize the main application controller.

// The 'DOMContentLoaded' event ensures the script runs only after the
// entire HTML document has been loaded and parsed.
window.addEventListener('DOMContentLoaded', () => {
    // Start the application by calling the init method on our App singleton.
    app.init();
});