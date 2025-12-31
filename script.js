/* =======================
   API CONFIG
   ======================= */
const EVENTS_API = 'https://beta.adstrim.ru/api/events';
const CHANNELS_API = 'https://beta.adstrim.ru/api/channels';

let allEvents = [];
let activeChannelButton = null;
const LIVE_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

/* =======================
   FOOTBALL PRIORITY
   ======================= */
const PRIORITY_SPORT = 'Football';

const POPULAR_FOOTBALL_LEAGUES = [
    'Premier League',
    'La Liga',
    'Serie A',
    'Bundesliga',
    'Ligue 1',
    'UEFA Champions League',
    'UEFA Europa League',
    'UEFA Conference League',
    'FA Cup',
    'Copa del Rey',
    'World Cup',
    'Euro'
];

/* =======================
   DATE
   ======================= */
function getFormattedLocalDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* =======================
   HEADER
   ======================= */
function getStaticHeaderContent() {
    return `
        <h1>Home | Sports Events ${getFormattedLocalDate()}</h1>
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

/* =======================
   URL PARAMS
   ======================= */
function getUrlParameter(name) {
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : '';
}

/* =======================
   LOAD DATA
   ======================= */
async function loadData() {
    const eventsContainer = document.getElementById('events');
    eventsContainer.innerHTML = '<div class="no-results">Loading events...</div>';

    try {
        const [eventsRes, channelsRes] = await Promise.all([
            fetch(EVENTS_API),
            fetch(CHANNELS_API)
        ]);

        const eventsJson = await eventsRes.json();
        const channelsJson = await channelsRes.json();

        if (eventsJson.status !== 'success') {
            throw new Error('Events API failed');
        }

        processData(eventsJson.data, channelsJson.data || []);
    } catch (err) {
        console.error(err);
        eventsContainer.innerHTML = '<div class="no-results">Error loading data.</div>';
    }
}

/* =======================
   PROCESS DATA
   ======================= */
function processData(events, channels) {
    allEvents = [];

    const channelMap = {};
    channels.forEach(c => {
        if (!channelMap[c.event_id]) channelMap[c.event_id] = [];
        channelMap[c.event_id].push(c.stream_url);
    });

    events.forEach(e => {
        allEvents.push({
            id: e.id,
            sport: e.sport_name,
            tournament: e.league_name,
            match: `${e.home_team} vs ${e.away_team}`,
            unix_timestamp: e.start_time,
            channels: channelMap[e.id] || []
        });
    });

    sortEvents();
    populateFilters();
    applyUrlFilters();
}

/* =======================
   SORT EVENTS
   ======================= */
function sortEvents() {
    const now = Date.now() / 1000;

    allEvents.sort((a, b) => {
        const aLive = a.unix_timestamp <= now && now - a.unix_timestamp < LIVE_DURATION_SECONDS;
        const bLive = b.unix_timestamp <= now && now - b.unix_timestamp < LIVE_DURATION_SECONDS;

        const aFoot = a.sport === PRIORITY_SPORT;
        const bFoot = b.sport === PRIORITY_SPORT;

        const aPop = aFoot && POPULAR_FOOTBALL_LEAGUES.some(l => a.tournament.toLowerCase().includes(l.toLowerCase()));
        const bPop = bFoot && POPULAR_FOOTBALL_LEAGUES.some(l => b.tournament.toLowerCase().includes(l.toLowerCase()));

        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;

        if (aLive && bLive) {
            if (aFoot && !bFoot) return -1;
            if (!aFoot && bFoot) return 1;
            if (aPop && !bPop) return -1;
            if (!aPop && bPop) return 1;
            return b.unix_timestamp - a.unix_timestamp;
        }

        if (aFoot && !bFoot) return -1;
        if (!aFoot && bFoot) return 1;
        if (aPop && !bPop) return -1;
        if (!aPop && bPop) return 1;

        return a.unix_timestamp - b.unix_timestamp;
    });
}

/* =======================
   FILTERS
   ======================= */
function populateFilters() {
    const sportFilter = document.getElementById('sportFilter');
    const tournamentFilter = document.getElementById('tournamentFilter');

    sportFilter.innerHTML = '<option value="">All Sports</option>';
    tournamentFilter.innerHTML = '<option value="">All Tournaments</option>';

    [...new Set(allEvents.map(e => e.sport))].sort()
        .forEach(s => sportFilter.append(new Option(s, s)));

    [...new Set(allEvents.map(e => e.tournament))].sort()
        .forEach(t => tournamentFilter.append(new Option(t, t)));
}

function applyUrlFilters() {
    document.getElementById('sportFilter').value = getUrlParameter('sport');
    document.getElementById('tournamentFilter').value = getUrlParameter('tournament');
    document.getElementById('searchFilter').value = getUrlParameter('search');
    filterEvents();
}

function filterEvents() {
    const sport = sportFilter.value;
    const tournament = tournamentFilter.value;
    const search = searchFilter.value.toLowerCase();

    const filtered = allEvents.filter(e =>
        (!sport || e.sport === sport) &&
        (!tournament || e.tournament === tournament) &&
        (!search || e.match.toLowerCase().includes(search) || e.tournament.toLowerCase().includes(search))
    );

    displayEvents(filtered);
    updateStats(filtered);
}

/* =======================
   DISPLAY
   ======================= */
function formatTime(ts) {
    return new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function displayEvents(events) {
    const container = document.getElementById('events');
    container.innerHTML = '';

    if (!events.length) {
        container.innerHTML = '<div class="no-results">No events found.</div>';
        return;
    }

    const now = Date.now() / 1000;

    events.forEach(e => {
        const isLive = e.unix_timestamp <= now && now - e.unix_timestamp < LIVE_DURATION_SECONDS;

        const card = document.createElement('div');
        card.className = `event-card ${isLive ? 'live-event' : ''}`;

        card.innerHTML = `
            <div class="event-header">
                <div>
                    <div class="match-name">${e.match} ${isLive ? '<span class="live-badge">LIVE</span>' : ''}</div>
                    <div class="tournament-name">${e.tournament}</div>
                </div>
                <div>
                    <span class="sport-badge">${e.sport}</span>
                    <span class="time-badge">${formatTime(e.unix_timestamp)}</span>
                </div>
            </div>
            <div class="channels">
                ${e.channels.length
                    ? e.channels.map((c, i) =>
                        `<button class="channel-link" onclick="openChannel('${c}','Stream ${i + 1} - ${e.match}',this)">Stream ${i + 1}</button>`
                      ).join('')
                    : '<span class="no-channels">No streams available</span>'
                }
            </div>
        `;

        container.appendChild(card);
    });
}

/* =======================
   STATS
   ======================= */
function updateStats(events) {
    stats.innerHTML = `
        <div class="stat-item"><div class="stat-value">${events.length}</div><div class="stat-label">Events</div></div>
        <div class="stat-item"><div class="stat-value">${new Set(events.map(e => e.sport)).size}</div><div class="stat-label">Sports</div></div>
        <div class="stat-item"><div class="stat-value">${new Set(events.map(e => e.tournament)).size}</div><div class="stat-label">Leagues</div></div>
    `;
}

/* =======================
   PLAYER
   ======================= */
window.openChannel = function (url, info, btn) {
    document.getElementById('player-section').style.display = 'block';
    document.getElementById('main-player').src = url;
    document.getElementById('current-channel').textContent = info;

    activeChannelButton?.classList.remove('active');
    btn.classList.add('active');
    activeChannelButton = btn;

    updateHeader(true);
};

window.closePlayer = function () {
    document.getElementById('player-section').style.display = 'none';
    document.getElementById('main-player').src = '';
    activeChannelButton?.classList.remove('active');
    activeChannelButton = null;
    updateHeader(false);
};

/* =======================
   INIT
   ======================= */
updateHeader(false);
loadData();
