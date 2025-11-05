const apiUrl = 'https://topembed.pw/api.php?format=json';
let allEvents = [];
let filterTimeout; 
let activeChannelButton = null; 
const LIVE_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

// --- Date Formatting Function ---
function getFormattedLocalDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
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
        headerContentDiv.innerHTML = ''; 
        headerDiv.classList.add('collapsed');
    } else {
        headerContentDiv.innerHTML = getStaticHeaderContent(); 
        headerDiv.classList.remove('collapsed');
    }
}

// --- URL Parameter Helper ---
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// --- Data Loading ---
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
    allEvents = [];
    for (const [date, events] of Object.entries(data.events)) {
        events.forEach(event => {
            allEvents.push({...event, date});
        });
    }
    
    const now = Date.now() / 1000;
    
    allEvents.sort((a, b) => {
        const aIsLive = (a.unix_timestamp <= now) && (now - a.unix_timestamp < LIVE_DURATION_SECONDS);
        const bIsLive = (b.unix_timestamp <= now) && (now - b.unix_timestamp < LIVE_DURATION_SECONDS);

        if (aIsLive && !bIsLive) return -1;
        if (!aIsLive && bIsLive) return 1;
        if (aIsLive && bIsLive) return b.unix_timestamp - a.unix_timestamp; 

        const aIsUpcoming = a.unix_timestamp > now;
        const bIsUpcoming = b.unix_timestamp > now;

        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;
        if (aIsUpcoming && bIsUpcoming) {
            return a.unix_timestamp - b.unix_timestamp; 
        }

        return b.unix_timestamp - a.unix_timestamp; 
    });
    
    populateFilters();
    applyUrlFilters();
}

function applyUrlFilters() {
    const sportParam = getUrlParameter('sport');
    const tournamentParam = getUrlParameter('tournament');
    const searchParam = getUrlParameter('search');

    if (sportParam) document.getElementById('sportFilter').value = sportParam;
    if (tournamentParam) document.getElementById('tournamentFilter').value = tournamentParam;
    if (searchParam) document.getElementById('searchFilter').value = searchParam;
    
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
        
        const channelButtons = event.channels.map((channel, idx) => {
            const channelName = `Stream ${idx + 1}`; 
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
    statsDiv.innerHTML = statsHtml;
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

// --- Event Listeners ---
document.getElementById('sportFilter').addEventListener('change', filterEvents);
document.getElementById('tournamentFilter').addEventListener('change', filterEvents);
document.getElementById('searchFilter').addEventListener('input', () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(filterEvents, 300); 
});

// --- Global Player Functions ---
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
    
    playerSection.scrollIntoView({ behavior: 'instant', block: 'start' });
    updateHeader(true);
}

window.closePlayer = function() {
    const playerSection = document.getElementById('player-section');
    const mainPlayer = document.getElementById('main-player');
    
    playerSection.style.display = 'none';
    mainPlayer.src = '';
    
    if (activeChannelButton) {
        activeChannelButton.classList.remove('active');
        activeChannelButton = null;
    }

    updateHeader(false);
}

// --- Initialize ---
updateHeader(false);
loadData();

// --- Auto-update the date at midnight ---
(function autoUpdateHeaderAtMidnight() {
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    setTimeout(() => {
        updateHeader(false);
        autoUpdateHeaderAtMidnight(); // reset timer
    }, msUntilMidnight);
})();
