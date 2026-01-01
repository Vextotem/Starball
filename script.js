const BASE_URL = 'https://beta.adstrim.ru/api';
let allEvents = [];
let allChannels = [];
let currentView = 'events'; 
let activeChannelButton = null;

const LIVE_DURATION_SECONDS = 3 * 60 * 60; // 3 hours
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/* =====================
   INIT
===================== */
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateHeader(false);

    const sf = document.getElementById('sportFilter');
    const tf = document.getElementById('tournamentFilter');
    const searchf = document.getElementById('searchFilter');

    if (sf) sf.addEventListener('change', render);
    if (tf) tf.addEventListener('change', render);
    if (searchf) searchf.addEventListener('input', render);
});

/* =====================
   LIVE CHECK (UTC SAFE)
===================== */
function isLive(ts) {
    const now = Math.floor(Date.now() / 1000);
    return ts > 0 && ts <= now && (now - ts) <= LIVE_DURATION_SECONDS;
}

/* =====================
   LOAD DATA (NO FILTERING)
===================== */
async function loadData() {
    const container = document.getElementById('events');
    if (!container) return;

    container.innerHTML = '<p class="loading">Loading matches and channels...</p>';

    try {
        const [eventsRes, channelsRes] = await Promise.all([
            fetch(`${BASE_URL}/events`).then(r => r.json()),
            fetch(`${BASE_URL}/channels`).then(r => r.json())
        ]);

        allEvents = (eventsRes.data || []).map(item => ({
            id: item.id || '',
            home_team: item.home_team || 'Unknown',
            away_team: item.away_team || 'Unknown',
            home_logo: item.home_team_image || '',
            away_logo: item.away_team_image || '',
            league_logo: item.league_image || '',
            tournament: item.league || 'General',
            sport: item.sport || 'Sports',
            unix_timestamp: Number(item.timestamp) || 0,
            channels: (item.channels || []).map(c => ({
                name: c.name || 'Stream',
                url: c.link || '#'
            }))
        }));

        const rawChannels = channelsRes.channels || channelsRes.data || [];
        allChannels = rawChannels.map(c => ({
            name: c.name || 'Unknown Channel',
            url: c.link || c.url || '#'
        }));

        populateFilters();
        render();

    } catch (error) {
        console.error('Error loading data:', error);
        container.innerHTML =
            '<div class="no-results">Error loading data. Please check connection.</div>';
    }
}

/* =====================
   PRIORITY SORT
===================== */
function sortEventsByPriority(events) {
    const TOP_LEAGUES = [
        'premier league',
        'champions league',
        'europa league',
        'la liga',
        'serie a',
        'bundesliga',
        'ligue 1'
    ];

    return [...events].sort((a, b) => {
        const aLive = isLive(a.unix_timestamp);
        const bLive = isLive(b.unix_timestamp);
        if (aLive !== bLive) return aLive ? -1 : 1;

        const aFootball = /football|soccer/i.test(a.sport);
        const bFootball = /football|soccer/i.test(b.sport);
        if (aFootball !== bFootball) return aFootball ? -1 : 1;

        const aTop = TOP_LEAGUES.some(l => a.tournament.toLowerCase().includes(l));
        const bTop = TOP_LEAGUES.some(l => b.tournament.toLowerCase().includes(l));
        if (aTop !== bTop) return aTop ? -1 : 1;

        return (a.unix_timestamp || Infinity) - (b.unix_timestamp || Infinity);
    });
}

/* =====================
   VIEW SWITCH
===================== */
window.switchView = function (view) {
    currentView = view;

    document.getElementById('showEvents')?.classList.toggle('active', view === 'events');
    document.getElementById('showChannels')?.classList.toggle('active', view === 'channels');

    const show = view === 'events' ? 'block' : 'none';
    document.getElementById('sport-filter-group')?.style.setProperty('display', show);
    document.getElementById('tournament-filter-group')?.style.setProperty('display', show);

    render();
};

/* =====================
   RENDER
===================== */
function render() {
    const container = document.getElementById('events');
    const search = document.getElementById('searchFilter')?.value.toLowerCase() || '';

    if (currentView === 'events') {
        const sport = document.getElementById('sportFilter')?.value || '';
        const tournament = document.getElementById('tournamentFilter')?.value || '';

        const filtered = allEvents.filter(e => {
            const text = `${e.home_team} ${e.away_team} ${e.tournament}`.toLowerCase();
            return (
                text.includes(search) &&
                (!sport || e.sport === sport) &&
                (!tournament || e.tournament === tournament)
            );
        });

        const sorted = sortEventsByPriority(filtered);
        displayEvents(sorted, container);
        updateStats(sorted.length, 'Live & Upcoming Events');

    } else {
        const filtered = allChannels.filter(c =>
            (c.name || '').toLowerCase().includes(search)
        );
        displayChannels(filtered, container);
        updateStats(filtered.length, 'TV Channels');
    }
}

/* =====================
   DISPLAY EVENTS
===================== */
function displayEvents(events, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!events.length) {
        container.innerHTML = '<div class="no-results">No events found.</div>';
        return;
    }

    events.forEach(event => {
        const live = isLive(event.unix_timestamp);

        const timeString = new Date(event.unix_timestamp * 1000).toLocaleTimeString(
            undefined,
            { hour: '2-digit', minute: '2-digit', timeZone: USER_TIMEZONE }
        );

        const card = document.createElement('div');
        card.className = `event-card ${live ? 'live-event' : ''}`;

        card.innerHTML = `
            <div class="event-header">
                <div class="match-info-container">
                    <img src="${escapeHtml(event.league_logo)}" class="league-logo"
                         onerror="this.src='https://cdn-icons-png.flaticon.com/512/5351/5351486.png'">
                    <div>
                        <div class="teams-display">
                            <img src="${escapeHtml(event.home_logo)}" class="team-logo"
                                 onerror="this.style.display='none'">
                            ${escapeHtml(event.home_team)}
                            <span class="vs-text">vs</span>
                            ${escapeHtml(event.away_team)}
                            <img src="${escapeHtml(event.away_logo)}" class="team-logo"
                                 onerror="this.style.display='none'">
                            ${live ? '<span class="live-badge">LIVE</span>' : ''}
                        </div>
                        <div class="tournament-name">${escapeHtml(event.tournament)}</div>
                    </div>
                </div>
                <div class="event-meta">
                    <span class="sport-badge">${escapeHtml(event.sport)}</span>
                    <span class="time-badge">${timeString}</span>
                </div>
            </div>
            <div class="channels">
                ${event.channels.map(c =>
                    `<button class="channel-link"
                        onclick="openChannel('${escapeHtml(c.url)}',
                        '${escapeHtml(event.home_team + ' vs ' + event.away_team)}', this, event)">
                        ${escapeHtml(c.name)}
                    </button>`
                ).join('')}
            </div>
        `;

        container.appendChild(card);
    });
}

/* =====================
   REST OF YOUR CODE
   (unchanged / already correct)
===================== */
// displayChannels, populateFilters, updateStats,
// openChannel, closePlayer, updateHeader, escapeHtml
// remain exactly as you had them
