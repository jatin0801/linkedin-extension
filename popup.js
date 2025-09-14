// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const enableGoogleSheets = document.getElementById('enableGoogleSheets');
    const googleSheetsConfig = document.getElementById('googleSheetsConfig');
    const spreadsheetUrl = document.getElementById('spreadsheetUrl');
    const sheetName = document.getElementById('sheetName');
    const authenticateBtn = document.getElementById('authenticateBtn');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const downloadDataBtn = document.getElementById('downloadDataBtn');
    const authStatus = document.getElementById('authStatus');
    const connectionCount = document.getElementById('connectionCount');

    // Load saved settings
    const settings = await chrome.storage.sync.get([
        'googleSheetsEnabled',
        'spreadsheetUrl',
        'sheetName',
        'googleAccessToken'
    ]);

    enableGoogleSheets.checked = settings.googleSheetsEnabled || false;
    spreadsheetUrl.value = settings.spreadsheetUrl || '';
    sheetName.value = settings.sheetName || 'LinkedIn Connections';

    // Show/hide Google Sheets config
    function toggleGoogleSheetsConfig() {
        googleSheetsConfig.style.display = enableGoogleSheets.checked ? 'block' : 'none';
        if (enableGoogleSheets.checked && settings.googleAccessToken) {
            showAuthStatus('Authenticated with Google', 'success');
        }
    }

    toggleGoogleSheetsConfig();

    enableGoogleSheets.addEventListener('change', () => {
        toggleGoogleSheetsConfig();
        chrome.storage.sync.set({ googleSheetsEnabled: enableGoogleSheets.checked });
    });

    // Save settings when changed
    spreadsheetUrl.addEventListener('change', () => {
        chrome.storage.sync.set({ spreadsheetUrl: spreadsheetUrl.value });
    });

    sheetName.addEventListener('change', () => {
        chrome.storage.sync.set({ sheetName: sheetName.value });
    });

    // Authentication
    authenticateBtn.addEventListener('click', async () => {
        try {
            showAuthStatus('Authenticating...', 'info');
            
            const response = await chrome.runtime.sendMessage({
                action: 'authenticate_google'
            });

            if (response.success) {
                showAuthStatus('Successfully authenticated with Google!', 'success');
                authenticateBtn.textContent = 'Re-authenticate';
            } else {
                showAuthStatus('Authentication failed: ' + response.error, 'error');
            }
        } catch (error) {
            showAuthStatus('Authentication error: ' + error.message, 'error');
        }
    });

    // Test connection
    testConnectionBtn.addEventListener('click', async () => {
        if (!spreadsheetUrl.value) {
            showAuthStatus('Please enter a Google Sheets URL first', 'error');
            return;
        }

        try {
            showAuthStatus('Testing connection...', 'info');
            
            const response = await chrome.runtime.sendMessage({
                action: 'test_google_sheets',
                spreadsheetUrl: spreadsheetUrl.value,
                sheetName: sheetName.value
            });

            if (response.success) {
                showAuthStatus('Connection successful! Sheet is ready to use.', 'success');
            } else {
                showAuthStatus('Connection failed: ' + response.error, 'error');
            }
        } catch (error) {
            showAuthStatus('Test failed: ' + error.message, 'error');
        }
    });

    // Download current data
    downloadDataBtn.addEventListener('click', async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'download_current_data'
            });

            if (response.success) {
                showAuthStatus('Download started!', 'success');
            } else {
                showAuthStatus('Download failed: ' + response.error, 'error');
            }
        } catch (error) {
            showAuthStatus('Download error: ' + error.message, 'error');
        }
    });

    // Load connection count
    try {
        const data = await chrome.storage.local.get();
        let totalConnections = 0;
        
        Object.keys(data).forEach(key => {
            if (key.startsWith('connections_')) {
                const dayData = data[key];
                Object.values(dayData).forEach(tagConnections => {
                    totalConnections += tagConnections.length;
                });
            }
        });

        connectionCount.textContent = `Total connections logged: ${totalConnections}`;
    } catch (error) {
        connectionCount.textContent = 'Could not load connection count';
    }

    function showAuthStatus(message, type) {
        authStatus.textContent = message;
        authStatus.className = `status ${type}`;
        authStatus.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                authStatus.style.display = 'none';
            }, 3000);
        }
    }
});
