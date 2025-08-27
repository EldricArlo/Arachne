# Application Architecture & Logic Flow

This document outlines the technical architecture of Aurora Downloader, explaining how its different components interact to provide a seamless user experience.

## 1. High-Level Architecture

Aurora Downloader is a multi-process application composed of three distinct, communicating parts:

1.  **Electron Main Process (`electron/`)**:
    *   **Role**: The application's backbone. It manages the application lifecycle, creates native OS windows, and handles interactions with the host operating system (e.g., file dialogs, menus).
    *   **Key Responsibility**: It spawns, monitors, and terminates the Python Backend process. It acts as a supervisor.

2.  **Electron Renderer Process (`frontend/`)**:
    *   **Role**: The user interface. This is essentially a Chromium browser window that runs the HTML, CSS, and JavaScript for the application's UI.
    *   **Key Responsibility**: It renders the UI, captures user input, and manages the visual state of the application. It is sandboxed for security and cannot directly access the file system or other powerful OS features.

3.  **Python Backend Process (`backend/`)**:
    *   **Role**: The application's engine. It runs as a completely separate process, started by the Electron Main process.
    *   **Key Responsibility**: It handles all heavy lifting: interacting with `yt-dlp`, managing the download queue with background threads, and handling file I/O. It exposes a REST API for the frontend to communicate with.

### Communication Channels

*   **Renderer <-> Main (IPC)**: The Renderer communicates with the Main process using Electron's Inter-Process Communication (IPC). This is a secure channel managed via `preload.js` and `ipc-handlers.js`. It's used for actions that require native OS privileges, like opening a folder or showing a confirmation dialog.
*   **Frontend <-> Backend (HTTP API)**: The Frontend communicates with the Python Backend via a local HTTP REST API. This is used for all core application logic, such as fetching video info, starting downloads, and polling for progress.

![Architecture Diagram](./photograph/logicofthisproject.png)

## 2. The Startup Sequence

The application's startup is carefully orchestrated to ensure all components are ready before the user can interact.

1.  **Execution Start**: The user runs `npm start`, which executes `electron electron/main.js`.
2.  **Main Process Initialization**: `main.js` initializes the application.
3.  **Port Discovery**: `python-manager.js` uses `portfinder` to find an available TCP port on the local machine (starting from 5000). This prevents conflicts if another service is using the default port.
4.  **Backend Spawn**: `python-manager.js` spawns the Python backend as a child process. It runs the command `python -m backend.app --port <found_port>`, passing the discovered port as a command-line argument.
5.  **Flask Server Start**: `backend/app.py` starts the Flask web server, making it listen only on `127.0.0.1` at the specified port.
6.  **Ready Signal**: Once the Flask server is successfully running, `app.py` prints a special string `BACKEND_READY_SIGNAL` to its standard output.
7.  **Signal Detection**: `python-manager.js`, which is listening to the child process's stdout, detects this signal.
8.  **Window Creation**: The Main process creates the `BrowserWindow` (the UI), injecting the `preload.js` script.
9.  **Frontend Notification**: The Main process sends an IPC message (`backend-ready`) to the Renderer process, containing the port number the backend is running on.
10. **Frontend Initialization**: In the Renderer, `main.js` (the App controller) receives this port via `window.electronAPI.waitForBackend()`. It uses this port to initialize the `api.js` module, setting the correct base URL (e.g., `http://127.0.0.1:5002/api`).
11. **Ready for Interaction**: The UI is now fully loaded and connected to the backend, ready for user input.

## 3. Core Logic: The Download Flow

This sequence details what happens when a user downloads a single video.

1.  **URL Input**: The user pastes a URL and clicks "Fetch Info". The `UI` class captures this and calls its `onGetInfo` handler.
2.  **API Call (Info)**: The `App` controller (`main.js`) calls `api.getVideoInfo()`. This sends a `POST` request to the backend's `/api/info` endpoint.
3.  **Backend Processing (Info)**: The Flask server routes the request. `downloader.py` uses `yt-dlp` with the `download=False` flag to fetch the video's metadata. This metadata is returned as JSON.
4.  **UI Update (Info)**: The JSON response travels back to the `App` controller, which then calls `ui.displayVideoInfo()` to render the video thumbnail, title, and download options on the screen.
5.  **Download Request**: The user clicks "Download". The `UI` class calls its `onDownload` handler.
6.  **API Call (Download)**: The `App` controller calls `api.startDownload()`. This sends a `POST` request to `/api/download` with the video URL and user-selected options.
7.  **Task Creation (Backend)**:
    *   The backend's `/api/download` route first checks if the number of active downloads is below the configured limit (`max_concurrent_downloads`).
    *   If there's capacity, `tasks.py` is called. It generates a unique `task_id` (a UUID).
    *   It creates a new entry in a global, thread-safe dictionary: `_tasks[task_id] = {'status': 'queued', ...}`.
    *   Crucially, it **spawns a new daemon background thread**, passing it the `task_id`, URL, options, and the downloader instance. This ensures the API request can return immediately without waiting for the download to finish, preventing the server from freezing.
    *   The `task_id` is immediately returned to the frontend.
8.  **Frontend State Update**:
    *   The `App` controller receives the `task_id`. It adds a new entry to its `activeTasks` map.
    *   It immediately calls `ui.addTaskToSingleView()` to render a new task progress item on the current page, showing "queued" status.
    *   It starts the progress polling interval (`_startProgressPolling`).
9.  **Download Execution (Backend Thread)**:
    *   Inside the background thread, `downloader.download()` is called.
    *   `yt-dlp` is configured with a `_progress_hook`. This hook is a function that `yt-dlp` calls periodically with progress updates (bytes downloaded, speed, eta, etc.).
    *   The hook function, `_progress_hook`, calls `_update_task_progress`. This function acquires a thread lock and updates the central `_tasks` dictionary with the latest percentage and status.
10. **Progress Polling (Frontend)**:
    *   Every second, the `_startProgressPolling` interval in the `App` controller fires.
    *   It iterates through all tasks in its `activeTasks` map and calls `api.getTaskProgress(taskId)` for each one.
    *   This sends a `GET` request to the backend's `/api/progress/<task_id>` endpoint.
    *   The backend route simply reads the current state for that task from the `_tasks` dictionary and returns it as JSON.
    *   The `App` controller receives the updated status and calls `ui.addOrUpdateTask()` to visually update the progress bar on the screen.
11. **Completion**:
    *   When the backend thread finishes the download, it updates the task status to `"completed"` or `"error"`.
    *   On the next poll, the frontend sees this terminal status. It updates the UI one last time and removes the task from its `activeTasks` map.
    *   When the `activeTasks` map is empty, the polling interval is cleared to save resources, and the history view is refreshed.

## 4. State Management

*   **Frontend State (`frontend/js/main.js`)**: The `App` class instance is the single source of truth for the UI. It holds the current configuration, active task progress, and info about the last-fetched video.

*   **Backend State (`backend/tasks.py`)**: The `_tasks` dictionary is the single source of truth for all download jobs. A `threading.Lock` (`_tasks_lock`) is used to protect this dictionary from race conditions, ensuring that updates from multiple download threads and reads from API routes are handled safely.
