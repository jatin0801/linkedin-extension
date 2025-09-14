// content.js
console.log('LinkedIn Connect Exporter loaded');

// Add error handling for the extension
window.addEventListener('error', (e) => {
    console.error('LinkedIn Extension Error:', e.error);
});

// Check if we're on LinkedIn
if (!window.location.hostname.includes('linkedin.com')) {
    console.warn('LinkedIn Connect Exporter: Not on LinkedIn domain');
}

function injectPopup(targetBtn, name, headline) {
    console.log('Injecting popup for:', name);
    
    // Remove existing popup
    let existing = document.getElementById("li-connect-popup");
    if (existing) existing.remove();

    let popup = document.createElement("div");
    popup.id = "li-connect-popup";
    // Detect if LinkedIn is in dark mode
    const isDarkMode = document.documentElement.classList.contains('theme--dark') || 
                      document.body.classList.contains('theme--dark') ||
                      document.querySelector('[data-theme="dark"]') ||
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const backgroundColor = isDarkMode ? '#1b1f23' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#000000';
    const borderColor = isDarkMode ? '#0a66c2' : '#0073b1';
    const subtitleColor = isDarkMode ? '#b0b7bf' : '#666666';
    const shadowColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)';
    
    popup.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 100000;
        background: ${backgroundColor};
        border: 2px solid ${borderColor};
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 12px ${shadowColor};
        max-width: 300px;
        color: ${textColor};
    `;
    
    const inputBackgroundColor = isDarkMode ? '#2d3339' : '#ffffff';
    const inputBorderColor = isDarkMode ? '#4a5568' : '#ddd';
    const inputTextColor = isDarkMode ? '#ffffff' : '#000000';
    const saveButtonBg = isDarkMode ? '#0a66c2' : '#0073b1';
    const cancelButtonBg = isDarkMode ? '#4a5568' : '#666';
    
    popup.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; font-size: 16px; color: ${borderColor};">
            Connection: ${name}
        </div>
        <div style="margin-bottom: 8px; font-size: 14px; color: ${subtitleColor};">
            ${headline}
        </div>
        <input type="text" id="connection-note" placeholder="Add a note..." 
               style="width: 100%; padding: 6px; margin-bottom: 8px; border: 1px solid ${inputBorderColor}; border-radius: 4px; background: ${inputBackgroundColor}; color: ${inputTextColor};">
        <input type="text" id="connection-tags" placeholder="Tags (comma-separated)" 
               style="width: 100%; padding: 6px; margin-bottom: 12px; border: 1px solid ${inputBorderColor}; border-radius: 4px; background: ${inputBackgroundColor}; color: ${inputTextColor};">
        <div style="display: flex; gap: 8px;">
            <button id="save-connection" style="flex: 1; padding: 8px; background: ${saveButtonBg}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Save
            </button>
            <button id="cancel-connection" style="flex: 1; padding: 8px; background: ${cancelButtonBg}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Add event listeners with error handling
    const saveBtn = document.getElementById('save-connection');
    const cancelBtn = document.getElementById('cancel-connection');
    const noteInput = document.getElementById('connection-note');
    const tagsInput = document.getElementById('connection-tags');
    
    if (saveBtn && cancelBtn && noteInput && tagsInput) {
        console.log('Popup elements found, adding event listeners');
        
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Save button clicked');
            
            const note = noteInput.value || '';
            const tags = tagsInput.value || '';
            
            console.log('Saving connection:', { name, headline, note, tags });
            
            chrome.runtime.sendMessage({
                action: "save_row",
                row: { name, headline, note, tags }
            }, (response) => {
                console.log('Save response:', response);
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                } else {
                    console.log('Connection saved successfully');
                }
                popup.remove();
            });
        });
        
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Cancel button clicked');
            popup.remove();
        });
        
        // Focus on the note input for better UX
        setTimeout(() => {
            noteInput.focus();
        }, 100);
        
    } else {
        console.error('Could not find popup form elements');
    }
}

// Function to extract profile information from a specific button's context
function extractProfileInfo(btn) {
    console.log('Extracting profile info from button:', btn);
    
    let name = 'Unknown';
    let headline = 'No headline';
    
    // Find the specific profile container for this button
    const profileCard = btn.closest('[data-test-id="people-card"]') || 
                       btn.closest('.reusable-search__result-container') ||
                       btn.closest('.search-result') ||
                       btn.closest('.entity-result') ||
                       btn.closest('.search-results__result-item') ||
                       btn.closest('.artdeco-entity-lockup') ||
                       btn.closest('.pv-top-card') ||
                       btn.closest('.ph5.pb5') || // Profile page container
                       btn.closest('[data-view-name="profile-component-entity"]') || // Recommendations
                       btn.closest('.pvs-entity') || // Entity cards
                       btn.closest('.discover-entity-type-card--mini-card') || // Discover mini cards
                       btn.closest('.artdeco-card') || // General card container
                       btn.closest('.fb04fdf9._097299df.b49ca3c4._4551b589') || // Network tab recommendations container
                       btn.closest('._4a88fdf8._0c0ea685._12403c90._3d196115') || // Recommendation section listitem
                       btn.closest('[role="listitem"]'); // General listitem container
    
    console.log('Profile card found for this specific button:', profileCard);
    
    if (profileCard) {
        console.log('Extracting from profile card container');
        
        // Try multiple selectors for name within this specific profile card
        const nameSelectors = [
            '.entity-result__title-text a',
            '[data-test-id="people-card-name"]',
            '.search-result__info .actor-name',
            '.artdeco-entity-lockup__title a',
            '.pv-text-details__left-panel h1',
            '.t-16 .t-black .t-bold',
            '.entity-result__title-text .t-16',
            'h1.t-24', // Profile page main heading
            'h1.inline.t-24', // Profile page name
            '.pv-top-card h1',
            '.hoverable-link-text.t-bold span[aria-hidden="true"]', // Recommendations name
            '.display-flex.align-items-center .hoverable-link-text.t-bold span', // Alternative recommendations
            '.optional-action-target-wrapper .hoverable-link-text.t-bold', // Recommendations wrapper
            '.discover-person-card__name', // Discover mini cards name
            '.discover-person-card__name.t-14.t-black.t-bold', // Specific discover card name
            '.fa0e7f7d', // Network tab recommendations name (screen reader text)
            'span.fa0e7f7d', // Alternative network tab name selector
            'p._4d766506._1c3a0067 span.fa0e7f7d', // Full network tab name path
            'p[class*="_4d766506"] span[class*="fa0e7f7d"]' // Flexible network tab name selector
        ];
        
        for (const selector of nameSelectors) {
            const nameElement = profileCard.querySelector(selector);
            if (nameElement?.textContent?.trim()) {
                let extractedName = nameElement.textContent.trim();
                // Clean up name - remove Premium, Verified badges and other suffixes
                extractedName = extractedName.replace(/,\s*(Premium|Verified)$/i, '').trim();
                if (extractedName && extractedName !== 'Unknown') {
                    name = extractedName;
                    console.log(`Found name using selector "${selector}": ${name}`);
                    break;
                }
            }
        }
        
        // Try multiple selectors for headline within this specific profile card
        const headlineSelectors = [
            '.entity-result__primary-subtitle',
            '[data-test-id="people-card-subtitle"]',
            '.search-result__info .subline-level-1',
            '.artdeco-entity-lockup__subtitle',
            '.pv-text-details__left-panel .text-body-medium',
            '.entity-result__summary',
            '.text-body-medium.break-words', // Profile page headline
            '.pv-top-card .text-body-medium',
            '.awmFNkjwZhKdIewYCijfrBuMZDYArXRREAfV .zanUwphmkGFHvxPZgiawLOdktecpOOqdQWc span[aria-hidden="true"]', // Recommendations headline
            '.t-14.t-normal .zanUwphmkGFHvxPZgiawLOdktecpOOqdQWc span', // Alternative recommendations headline
            '.full-width.t-14.t-normal span[aria-hidden="true"]', // Recommendations job title
            '.discover-person-card__occupation--mini-card', // Discover mini cards occupation
            '.discover-person-card__occupation--mini-card.t-12.t-black--light.t-normal', // Specific discover card occupation
            'p._4d766506._36b2a045._61f805c8', // Network tab recommendations headline
            'p[class*="_4d766506"][class*="_36b2a045"]', // Flexible network tab headline selector
            'p._4d766506._36b2a045', // Simplified network tab headline
            '.eaea9413 p._4d766506._36b2a045' // Network tab headline with parent context
        ];
        
        for (const selector of headlineSelectors) {
            const headlineElement = profileCard.querySelector(selector);
            if (headlineElement?.textContent?.trim()) {
                headline = headlineElement.textContent.trim();
                console.log(`Found headline using selector "${selector}": ${headline}`);
                break;
            }
        }
    } else {
        // Only fall back to page-level extraction if we're on a profile page (not a list)
        if (window.location.pathname.includes('/in/')) {
            console.log('No profile card found, but on profile page - trying page-level extraction');
            
            // Try to get name from page
            const pageNameSelectors = [
                'h1.t-24',
                'h1.inline.t-24',
                '.pv-top-card h1',
                'h1[class*="t-24"]'
            ];
            
            for (const selector of pageNameSelectors) {
                const nameElement = document.querySelector(selector);
                if (nameElement?.textContent?.trim()) {
                    name = nameElement.textContent.trim();
                    console.log(`Found page name using selector "${selector}": ${name}`);
                    break;
                }
            }
            
            // Try to get headline from page
            const pageHeadlineSelectors = [
                '.text-body-medium.break-words',
                '.pv-top-card .text-body-medium',
                '[data-generated-suggestion-target] .text-body-medium'
            ];
            
            for (const selector of pageHeadlineSelectors) {
                const headlineElement = document.querySelector(selector);
                if (headlineElement?.textContent?.trim()) {
                    headline = headlineElement.textContent.trim();
                    console.log(`Found page headline using selector "${selector}": ${headline}`);
                    break;
                }
            }
        } else {
            console.log('No profile card found and not on profile page - cannot extract profile info');
        }
    }
    
    console.log('Final extracted info - Name:', name, 'Headline:', headline);
    return { name, headline };
}

// Function to handle connect button click
function handleConnectClick(btn) {
    console.log('Connect button clicked!', btn);
    
    const { name, headline } = extractProfileInfo(btn);
    
    setTimeout(() => {
        injectPopup(btn, name, headline);
    }, 500);
}

// Function to track a single connect button with its associated profile data
function trackConnectButton(btn) {
    if (btn.dataset.tracked) return;
    btn.dataset.tracked = 'true';
    
    console.log('Tracking button:', btn.textContent?.trim(), btn.getAttribute('aria-label'));
    
    // Pre-extract and store profile info for this specific button
    const profileData = extractProfileInfo(btn);
    btn.dataset.profileName = profileData.name;
    btn.dataset.profileHeadline = profileData.headline;
    
    console.log(`Stored profile data for button: ${profileData.name} - ${profileData.headline}`);
    
    btn.addEventListener('click', () => {
        console.log('Connect button clicked!', btn);
        console.log('Using stored profile data:', btn.dataset.profileName, btn.dataset.profileHeadline);
        
        setTimeout(() => {
            injectPopup(btn, btn.dataset.profileName, btn.dataset.profileHeadline);
        }, 500);
    });
}

// Function to find and track connect buttons
function findConnectButtons() {
    console.log('Scanning for new connect buttons...');
    
    // Updated selectors for current LinkedIn interface
    const buttonSelectors = [
        'button[aria-label*="Invite"]:not([data-tracked])',
        'button[aria-label*="Connect"]:not([data-tracked])', 
        'button[data-control-name="connect"]:not([data-tracked])',
        'button[data-test-id="connect-cta"]:not([data-tracked])',
        'button[data-tracking-control-name="public_profile_topcard_connect"]:not([data-tracked])'
    ];
    
    let buttons = [];
    buttonSelectors.forEach(selector => {
        try {
            const found = document.querySelectorAll(selector);
            buttons = [...buttons, ...Array.from(found)];
        } catch (e) {
            // Some selectors might not work in all browsers
        }
    });
    
    // Also look for buttons with "Connect" text that aren't tracked
    const allButtons = document.querySelectorAll('button:not([data-tracked])');
    allButtons.forEach(btn => {
        const text = btn.textContent?.trim().toLowerCase();
        if (text === 'connect' || text === 'invite') {
            buttons.push(btn);
        }
    });
    
    // Look for Connect buttons inside dropdown menus
    const dropdownConnectSelectors = [
        'div[aria-label*="Invite"][role="button"]:not([data-tracked])',
        'div[aria-label*="Connect"][role="button"]:not([data-tracked])',
        '.artdeco-dropdown__item[aria-label*="Invite"]:not([data-tracked])',
        '.artdeco-dropdown__item[aria-label*="Connect"]:not([data-tracked])'
    ];
    
    dropdownConnectSelectors.forEach(selector => {
        try {
            const found = document.querySelectorAll(selector);
            buttons = [...buttons, ...Array.from(found)];
        } catch (e) {
            // Some selectors might not work in all browsers
        }
    });
    
    // Also look for dropdown items with "Connect" text
    const dropdownItems = document.querySelectorAll('.artdeco-dropdown__item:not([data-tracked])');
    dropdownItems.forEach(item => {
        const text = item.textContent?.trim().toLowerCase();
        const ariaLabel = item.getAttribute('aria-label')?.toLowerCase();
        if ((text && text.includes('connect')) || (ariaLabel && ariaLabel.includes('connect'))) {
            buttons.push(item);
        }
    });
    
    console.log(`Found ${buttons.length} new connect buttons`);
    
    buttons.forEach(trackConnectButton);
}

// Event-driven monitoring using MutationObserver
function startMonitoring() {
    console.log('Starting LinkedIn Connect monitoring...');
    console.log('Current URL:', window.location.href);
    console.log('Page title:', document.title);
    
    // Initial scan for existing buttons
    findConnectButtons();
    
    // Set up MutationObserver to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        
        mutations.forEach((mutation) => {
            // Check if new nodes were added
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes contain buttons or are buttons themselves
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        // Check if the added element is a button or contains buttons
                        if (element.tagName === 'BUTTON' || 
                            element.querySelector && element.querySelector('button') ||
                            element.classList?.contains('artdeco-dropdown__item') ||
                            element.querySelector && element.querySelector('.artdeco-dropdown__item')) {
                            shouldScan = true;
                        }
                    }
                });
            }
        });
        
        if (shouldScan) {
            console.log('DOM changes detected, scanning for new connect buttons...');
            // Debounce the scanning to avoid excessive calls
            clearTimeout(window.linkedinScanTimeout);
            window.linkedinScanTimeout = setTimeout(findConnectButtons, 300);
        }
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Also monitor for navigation changes (LinkedIn is a SPA)
    let lastUrl = location.href;
    const navigationObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('LinkedIn page changed to:', url);
            setTimeout(findConnectButtons, 3000); // Scan after navigation
        }
    });
    
    navigationObserver.observe(document, { subtree: true, childList: true });
    
    console.log('Event-driven monitoring started - will only scan when DOM changes');
}

// Start monitoring when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
    startMonitoring();
}
