// background.js
console.log('backg.js running');

let connectionsByDate = {}; // {date: {tag: [rows]}}

// Google Sheets API configuration
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_AUTH_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('bg.js received message:', request);
    
    if (request.action === "save_row") {
        const {name, headline, note, tags} = request.row;
        const tagList = (tags || "untagged").split(',').map(s => s.trim()).filter(Boolean);
        const today = getToday();

        if (!connectionsByDate[today]) connectionsByDate[today] = {};

        tagList.forEach(tag => {
            if (!connectionsByDate[today][tag]) connectionsByDate[today][tag] = [];
            connectionsByDate[today][tag].push({
                name, 
                headline, 
                note, 
                ts: new Date().toISOString()
            });
        });

        // Store data in chrome.storage and sync to Google Sheets or download
        chrome.storage.local.set({[`connections_${today}`]: connectionsByDate[today]}, async () => {
            console.log('Data saved to storage');
            
            // Check if Google Sheets sync is enabled
            const settings = await chrome.storage.sync.get(['googleSheetsEnabled', 'spreadsheetUrl', 'sheetName', 'googleAccessToken']);
            
            if (settings.googleSheetsEnabled && settings.spreadsheetUrl && settings.googleAccessToken) {
                console.log('Syncing to Google Sheets...');
                try {
                    await syncToGoogleSheets({
                        name,
                        headline,
                        note,
                        tags,
                        date: today,
                        timestamp: new Date().toISOString()
                    }, settings);
                    console.log('Successfully synced to Google Sheets');
                } catch (error) {
                    console.error('Failed to sync to Google Sheets:', error);
                    // Fallback to download if sync fails
                    downloadExcel(today, connectionsByDate[today]);
                }
            } else {
                // Use traditional download if Google Sheets not configured
                downloadExcel(today, connectionsByDate[today]);
            }
        });

        sendResponse({ok: true});
        return true; // Keep message channel open for async response
    }
});

function downloadExcel(date, data) {
    console.log('downloadExcel called with data:', data);
    
    // Create CSV content since XLSX is not available in service worker
    let csvContent = 'Date,Name,Headline,Note,Tags,Timestamp\n';
    
    for (let tag in data) {
        console.log(`Processing tag: ${tag} with ${data[tag].length} connections`);
        
        data[tag].forEach(row => {
            const csvRow = `"${date}","${row.name}","${row.headline}","${row.note}","${tag}","${row.ts}"\n`;
            csvContent += csvRow;
        });
    }
    
    console.log('CSV content generated:', csvContent);
    
    // Use data URI for service worker compatibility
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    
    console.log('Attempting to download file:', `linkedin_connections_${date}.csv`);
    
    chrome.downloads.download({
        url: encodedUri,
        filename: `linkedin_connections_${date}.csv`,
        saveAs: false // Auto-download to default Downloads folder
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error('Download failed:', chrome.runtime.lastError);
        } else {
            console.log('Download started with ID:', downloadId);
        }
    });
}

// Google Sheets integration functions
async function syncToGoogleSheets(connectionData, settings) {
    const spreadsheetId = extractSpreadsheetId(settings.spreadsheetUrl);
    if (!spreadsheetId) {
        throw new Error('Invalid spreadsheet URL');
    }

    const sheetName = settings.sheetName || 'LinkedIn Connections';
    
    // Ensure the sheet exists and has headers
    await ensureSheetExists(spreadsheetId, sheetName, settings.googleAccessToken);
    
    // Append the new row
    const values = [[
        connectionData.date,
        connectionData.name,
        connectionData.headline,
        connectionData.note,
        connectionData.tags,
        connectionData.timestamp
    ]];
    
    const response = await fetch(
        `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${sheetName}:append?valueInputOption=RAW`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.googleAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: values
            })
        }
    );
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Google Sheets API error: ${error.error?.message || response.statusText}`);
    }
    
    return await response.json();
}

async function ensureSheetExists(spreadsheetId, sheetName, accessToken) {
    // First, check if sheet exists
    const sheetsResponse = await fetch(
        `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );
    
    if (!sheetsResponse.ok) {
        throw new Error('Failed to access spreadsheet');
    }
    
    const spreadsheet = await sheetsResponse.json();
    const sheetExists = spreadsheet.sheets?.some(sheet => sheet.properties.title === sheetName);
    
    if (!sheetExists) {
        // Create the sheet
        await fetch(
            `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                })
            }
        );
    }
    
    // Check if headers exist
    const valuesResponse = await fetch(
        `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${sheetName}!A1:F1`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );
    
    const valuesData = await valuesResponse.json();
    
    if (!valuesData.values || valuesData.values.length === 0) {
        // Add headers with formatting
        await fetch(
            `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}/values/${sheetName}!A1:F1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [['Date', 'Name', 'Headline', 'Note', 'Tags', 'Timestamp']]
                })
            }
        );
        
        // Format headers to be bold and set column widths
        await fetch(
            `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [
                        {
                            // Make header row bold
                            repeatCell: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 6
                                },
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: {
                                            bold: true
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat.textFormat.bold'
                            }
                        },
                        {
                            // Set column widths
                            updateDimensionProperties: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    dimension: 'COLUMNS',
                                    startIndex: 0,
                                    endIndex: 1
                                },
                                properties: {
                                    pixelSize: 100
                                },
                                fields: 'pixelSize'
                            }
                        },
                        {
                            // Name column width
                            updateDimensionProperties: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    dimension: 'COLUMNS',
                                    startIndex: 1,
                                    endIndex: 2
                                },
                                properties: {
                                    pixelSize: 200
                                },
                                fields: 'pixelSize'
                            }
                        },
                        {
                            // Headline column width
                            updateDimensionProperties: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    dimension: 'COLUMNS',
                                    startIndex: 2,
                                    endIndex: 3
                                },
                                properties: {
                                    pixelSize: 300
                                },
                                fields: 'pixelSize'
                            }
                        },
                        {
                            // Note column width
                            updateDimensionProperties: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    dimension: 'COLUMNS',
                                    startIndex: 3,
                                    endIndex: 4
                                },
                                properties: {
                                    pixelSize: 250
                                },
                                fields: 'pixelSize'
                            }
                        },
                        {
                            // Tags column width
                            updateDimensionProperties: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    dimension: 'COLUMNS',
                                    startIndex: 4,
                                    endIndex: 5
                                },
                                properties: {
                                    pixelSize: 150
                                },
                                fields: 'pixelSize'
                            }
                        },
                        {
                            // Timestamp column width
                            updateDimensionProperties: {
                                range: {
                                    sheetId: await getSheetId(spreadsheetId, sheetName, accessToken),
                                    dimension: 'COLUMNS',
                                    startIndex: 5,
                                    endIndex: 6
                                },
                                properties: {
                                    pixelSize: 180
                                },
                                fields: 'pixelSize'
                            }
                        }
                    ]
                })
            }
        );
    }
}

function extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

async function getSheetId(spreadsheetId, sheetName, accessToken) {
    const response = await fetch(
        `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to get sheet information');
    }
    
    const spreadsheet = await response.json();
    const sheet = spreadsheet.sheets?.find(sheet => sheet.properties.title === sheetName);
    
    return sheet ? sheet.properties.sheetId : 0; // Default to 0 if not found
}

// Handle authentication and other popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authenticate_google') {
        authenticateWithGoogle()
            .then(token => {
                sendResponse({ success: true, token });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.action === 'test_google_sheets') {
        testGoogleSheetsConnection(request.spreadsheetUrl, request.sheetName)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.action === 'download_current_data') {
        downloadAllData()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function authenticateWithGoogle() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
            { 
                interactive: true,
                scopes: [GOOGLE_AUTH_SCOPE]
            },
            (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    chrome.storage.sync.set({ googleAccessToken: token });
                    resolve(token);
                }
            }
        );
    });
}

async function testGoogleSheetsConnection(spreadsheetUrl, sheetName) {
    const settings = await chrome.storage.sync.get(['googleAccessToken']);
    
    if (!settings.googleAccessToken) {
        throw new Error('Not authenticated with Google');
    }
    
    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
        throw new Error('Invalid spreadsheet URL');
    }
    
    // Test access to the spreadsheet
    const response = await fetch(
        `${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}`,
        {
            headers: {
                'Authorization': `Bearer ${settings.googleAccessToken}`
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Cannot access spreadsheet. Check URL and permissions.');
    }
    
    // Ensure sheet exists
    await ensureSheetExists(spreadsheetId, sheetName || 'LinkedIn Connections', settings.googleAccessToken);
}

async function downloadAllData() {
    const data = await chrome.storage.local.get();
    const allConnections = {};
    
    // Combine all stored data
    Object.keys(data).forEach(key => {
        if (key.startsWith('connections_')) {
            const date = key.replace('connections_', '');
            allConnections[date] = data[key];
        }
    });
    
    if (Object.keys(allConnections).length === 0) {
        throw new Error('No connection data found');
    }
    
    // Generate combined CSV
    let csvContent = 'Date,Name,Headline,Note,Tags,Timestamp\n';
    
    Object.keys(allConnections).forEach(date => {
        const dayData = allConnections[date];
        Object.keys(dayData).forEach(tag => {
            dayData[tag].forEach(row => {
                const csvRow = `"${date}","${row.name}","${row.headline}","${row.note}","${tag}","${row.ts}"\n`;
                csvContent += csvRow;
            });
        });
    });
    
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    
    chrome.downloads.download({
        url: encodedUri,
        filename: `linkedin_connections_all_data.csv`,
        saveAs: false
    });
}
