// background.js
console.log('backg.js running');

let connectionsByDate = {}; // {date: {tag: [rows]}}

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

        // Store data in chrome.storage and trigger download
        chrome.storage.local.set({[`connections_${today}`]: connectionsByDate[today]}, () => {
            console.log('Data saved to storage');
            downloadExcel(today, connectionsByDate[today]);
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
