const apiUrl = 'https://topembed.pw/api.php?format=json';
let allEvents = [];
let filterTimeout; 
let activeChannelButton = null; 
const LIVE_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

// --- Date Formatting Function ---
function getFormattedLocalDate() {
    const today = new Date();
    // Get year, month, and day respecting the user's local time zone
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Header Content Management ---

function getStaticHeaderContent() {
    const todayDate = getFormattedLocalDate();
    
    return `
        <h1>Home | Sports Events ${todayDate}</h1>
        <p>Live streaming schedules and channels</p>
      <a href="https://nunflix.shop" target="_blank" rel="noopener noreferrer">
      <p>Click to Watch Movies</p>
    </a>
    `;
}

function updateHeader(isPlaying) {
    const headerDiv = document.getElementById('main-header');
    const headerContentDiv = document.getElementById('header-content');

    if (isPlaying) {
        headerContentDiv.innerHTML = ''; // Clear content
        headerDiv.classList.add('collapsed'); // Add class to collapse padding
    } else {
        // Use the function to get the latest content with the correct date
        headerContentDiv.innerHTML = getStaticHeaderContent(); 
        headerDiv.classList.remove('collapsed'); // Remove class to restore padding
    }
}

// --- URL Parameter Initialization ---
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// --- Data Loading Functions ---

async function loadData() {
    const eventsContainer = document.getElementById('events');
    eventsContainer.innerHTML = '<div class="no-results">Loading events...</div>';
    
    try {
        const data = await loadWithFetch();
        processData(data);
    } catch (error) {
        try {
            const data = await loadWithIframe();
            processData(data);
        } catch (error2) {
            eventsContainer.innerHTML = 
                '<div class="no-results">Error loading data. Please check console.</div>';
            console.error('Data load error:', error, error2);
        }
    }
}

function loadWithFetch() {
    return fetch(apiUrl, { mode: 'cors', credentials: 'omit' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Fetch response not OK: ' + response.statusText);
            }
            return response.json();
        });
}

function loadWithIframe() {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = apiUrl;
        document.body.appendChild(iframe);
        
        const onMessage = (e) => {
            try {
                // NOTE: The origin check is speculative without knowing the iframe's exact origin policy.
                // Assuming topembed.pw includes the correct origin in postMessage data.
                if (e.origin.includes('topembed.pw')) {
                    window.removeEventListener('message', onMessage);
                    document.body.removeChild(iframe);
                    resolve(JSON.parse(e.data));
                }
            } catch (err) {
                reject(err);
            }
        };
        
        window.addEventListener('message', onMessage);
        
        setTimeout(() => {
            window.removeEventListener('message', onMessage);
            try { document.body.removeChild(iframe); } catch(e) {}
            reject(new Error('Iframe load method timed out'));
        }, 5000); 
    });
}

function processData(data) {
    // Flatten events
    allEvents = [];
    for (const [date, events] of Object.entries(data.events)) {
        events.forEach(event => {
            allEvents.push({...event, date});
        });
    }
    
    // Sort events: Live > Upcoming > Past (most recent first)
    const now = Date.now() / 1000;
    
    allEvents.sort((a, b) => {
        const aIsLive = (a.unix_timestamp <= now) && (now - a.unix_timestamp < LIVE_DURATION_SECONDS);
        const bIsLive = (b.unix_timestamp <= now) && (now - b.unix_timestamp < LIVE_DURATION_SECONDS);

        // 1. Prioritize Live events
        if (aIsLive && !bIsLive) return -1;
        if (!aIsLive && bIsLive) return 1;
        if (aIsLive && bIsLive) {
            return b.unix_timestamp - a.unix_timestamp; 
        }

        const aIsUpcoming = a.unix_timestamp > now;
        const bIsUpcoming = b.unix_timestamp > now;

        // 2. Prioritize Upcoming events
        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;
        if (aIsUpcoming && bIsUpcoming) {
            return a.unix_timestamp - b.unix_timestamp; 
        }

        // 3. Both are Past
        return b.unix_timestamp - a.unix_timestamp; 
    });
    
    populateFilters();
    
    // Apply URL Parameters and Filter on Load
    applyUrlFilters();
}

function applyUrlFilters() {
    const sportParam = getUrlParameter('sport');
    const tournamentParam = getUrlParameter('tournament');
    const searchParam = getUrlParameter('search');

    if (sportParam) {
        document.getElementById('sportFilter').value = sportParam;
    }
    if (tournamentParam) {
        document.getElementById('tournamentFilter').value = tournamentParam;
    }
    if (searchParam) {
        document.getElementById('searchFilter').value = searchParam;
    }
    
    filterEvents();
}


function populateFilters() {
    const sports = [...new Set(allEvents.map(e => e.sport))].sort();
    const tournaments = [...new Set(allEvents.map(e => e.tournament))].sort();
    
    const sportFilter = document.getElementById('sportFilter');
    const tournamentFilter = document.getElementById('tournamentFilter');
    
    const sportFrag = document.createDocumentFragment();
    sports.forEach(sport => {
        const option = document.createElement('option');
        option.value = sport;
        option.textContent = sport;
        sportFrag.appendChild(option);
    });
    sportFilter.appendChild(sportFrag);
    
    const tournFrag = document.createDocumentFragment();
    tournaments.forEach(tournament => {
        const option = document.createElement('option');
        option.value = tournament;
        option.textContent = tournament;
        tournFrag.appendChild(option);
    });
    tournamentFilter.appendChild(tournFrag);
}

function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function displayEvents(events) {
    const container = document.getElementById('events');
    
    if (events.length === 0) {
        container.innerHTML = '<div class="no-results">No events found matching your criteria.</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    const now = Date.now() / 1000;

    for (const event of events) {
        const isLive = (event.unix_timestamp <= now) && (now - event.unix_timestamp < LIVE_DURATION_SECONDS);
        
        const card = document.createElement('div');
        card.className = isLive ? 'event-card live-event' : 'event-card';
        
        const liveBadgeHtml = isLive ? '<span class="live-badge">LIVE</span>' : '';
        
        // Channel buttons with inline click handler
        const channelButtons = event.channels.map((channel, idx) => {
            const channelName = `Stream ${idx + 1}`; 
            // Escape single quotes for use in string literal passed to openChannel
            const channelInfoArg = `${channelName} - ${event.match.replace(/'/g, "\\'")}`;
            return `<button class="channel-link" data-url="${channel}" data-name="${channelInfoArg}" onclick="openChannel('${channel}', '${channelInfoArg}', this)">${channelName}</button>`;
        }).join('');
        
        card.innerHTML = `
            <div class="event-header">
                <div class="event-title">
                    <div class="match-name">${event.match} ${liveBadgeHtml}</div>
                    <div class="tournament-name">${event.tournament}</div>
                </div>
                <div class="event-meta">
                    <span class="sport-badge">${event.sport}</span>
                    <span class="time-badge">${formatTime(event.unix_timestamp)}</span>
                </div>
            </div>
            <div class="channels">
                <div class="channels-label">📺 Available Channels (${event.channels.length}):</div>
                <div class="channel-list">
                    ${channelButtons}
                </div>
            </div>
        `;
        fragment.appendChild(card);
    }
    
    container.innerHTML = ''; 
    container.appendChild(fragment); 
}

function updateStats(events) {
    const sports = new Set(events.map(e => e.sport));
    const tournaments = new Set(events.map(e => e.tournament));
    const channels = new Set(events.flatMap(e => e.channels));
    
    // Updated HTML structure for stats with ARIA Live Region
    const statsHtml = `
        <div class="stat-item">
            <div class="stat-value">${events.length}</div>
            <div class="stat-label">Total Events</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${sports.size}</div>
            <div class="stat-label">Sports</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${tournaments.size}</div>
            <div class="stat-label">Tournaments</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${channels.size}</div>
            <div class="stat-label">Channels</div>
        </div>
    `;

    const statsDiv = document.getElementById('stats');
    // Ensure the ARIA attribute is set on the container element in the HTML
    // For now, we update the innerHTML
    statsDiv.innerHTML = statsHtml;

    // Optional: Announce results for screen readers (using a simple text announcement)
    const announcement = `${events.length} events found. ${sports.size} sports, ${tournaments.size} tournaments.`;
    // Create a hidden live region for announcements if one doesn't exist
    let liveRegion = document.getElementById('live-announcement');
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'live-announcement';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.style.position = 'absolute';
        liveRegion.style.width = '1px';
        liveRegion.style.height = '1px';
        liveRegion.style.margin = '-1px';
        liveRegion.style.padding = '0';
        liveRegion.style.overflow = 'hidden';
        document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = announcement;
}

function filterEvents() {
    const sportFilter = document.getElementById('sportFilter').value;
    const tournamentFilter = document.getElementById('tournamentFilter').value;
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
    
    const filtered = allEvents.filter(event => {
        const sportMatch = !sportFilter || event.sport === sportFilter;
        const tournamentMatch = !tournamentFilter || event.tournament === tournamentFilter;
        
        const searchMatch = !searchFilter || 
                            event.match.toLowerCase().includes(searchFilter) ||
                            event.tournament.toLowerCase().includes(searchFilter) ||
                            event.sport.toLowerCase().includes(searchFilter);
        
        return sportMatch && tournamentMatch && searchMatch;
    });
    
    displayEvents(filtered);
    updateStats(filtered);

    updateUrlParameters(sportFilter, tournamentFilter, searchFilter);
}

function updateUrlParameters(sport, tournament, search) {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    sport ? params.set('sport', sport) : params.delete('sport');
    tournament ? params.set('tournament', tournament) : params.delete('tournament');
    search ? params.set('search', search) : params.delete('search');

    window.history.replaceState(null, '', url.toString());
}

// --- Event Listeners with Filter and URL Updates ---
document.getElementById('sportFilter').addEventListener('change', filterEvents);
document.getElementById('tournamentFilter').addEventListener('change', filterEvents);

document.getElementById('searchFilter').addEventListener('input', () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(filterEvents, 300); 
});

// Make openChannel globally accessible as it's used in inline onclick
window.openChannel = function(url, channelInfo, button) {
    const playerSection = document.getElementById('player-section');
    const mainPlayer = document.getElementById('main-player');
    const currentChannel = document.getElementById('current-channel');
    
    playerSection.style.display = 'block';
    mainPlayer.src = url;
    currentChannel.textContent = channelInfo;
    
    if (activeChannelButton) {
        activeChannelButton.classList.remove('active');
    }
    
    button.classList.add('active');
    activeChannelButton = button; 
    
    // Scroll the player section to the top of the viewport instantly.
    playerSection.scrollIntoView({ behavior: 'instant', block: 'start' });

    // Hide static header text and collapse container
    updateHeader(true);
}

// Make closePlayer globally accessible as it's used in inline onclick
window.closePlayer = function() {
    const playerSection = document.getElementById('player-section');
    const mainPlayer = document.getElementById('main-player');
    
    playerSection.style.display = 'none';
    mainPlayer.src = '';
    
    if (activeChannelButton) {
        activeChannelButton.classList.remove('active');
        activeChannelButton = null;
    }

    // Restore static header text and container size
    updateHeader(false);
}

// --- Initial Execution ---

// 1. Initialize the header immediately with the user's local date
updateHeader(false); 

// 2. Load the data
loadData();
