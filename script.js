const apiUrl = 'https://topembed.pw/api.php?format=json';
let allEvents = [];
let filterTimeout;
let activeChannelButton = null;
const LIVE_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

/* =======================
   FOOTBALL PRIORITY SETUP
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
   DATE FORMAT
   ======================= */
function getFormattedLocalDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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
   DATA LOADING
   ======================= */
async function loadData() {
    const eventsContainer = document.getElementById('events');
    eventsContainer.innerHTML = '<div class="no-results">Loading events...</div>';

    try {
        const data = await fetch(apiUrl, { mode: 'cors', credentials: 'omit' }).then(r => r.json());
        processData(data);
    } catch {
        eventsContainer.innerHTML = '<div class="no-results">Error loading data.</div>';
    }
}

/* =======================
   PROCESS & SORT DATA
   ======================= */
function processData(data) {
    allEvents = [];

    for (const [date, events] of Object.entries(data.events)) {
        events.forEach(event => allEvents.push({ ...event, date }));
    }

    const now = Date.now() / 1000;

    allEvents.sort((a, b) => {
        const aIsLive = a.unix_timestamp <= now && (now - a.unix_timestamp < LIVE_DURATION_SECONDS);
        const bIsLive = b.unix_timestamp <= now && (now - b.unix_timestamp < LIVE_DURATION_SECONDS);

        const aIsFootball = a.sport === PRIORITY_SPORT;
        const bIsFootball = b.sport === PRIORITY_SPORT;

        const aPopular = aIsFootball && POPULAR_FOOTBALL_LEAGUES.some(l =>
            a.tournament.toLowerCase().includes(l.toLowerCase())
        );
        const bPopular = bIsFootball && POPULAR_FOOTBALL_LEAGUES.some(l =>
            b.tournament.toLowerCase().includes(l.toLowerCase())
        );

        /* LIVE first */
        if (aIsLive && !bIsLive) return -1;
        if (!aIsLive && bIsLive) return 1;

        /* LIVE football first */
        if (aIsLive && bIsLive) {
            if (aIsFootball && !bIsFootball) return -1;
            if (!aIsFootball && bIsFootball) return 1;

            if (aPopular && !bPopular) return -1;
            if (!aPopular && bPopular) return 1;

            return b.unix_timestamp - a.unix_timestamp;
        }

        /* Upcoming football first */
        if (aIsFootball && !bIsFootball) return -1;
        if (!aIsFootball && bIsFootball) return 1;

        if (aPopular && !bPopular) return -1;
        if (!aPopular && bPopular) return 1;

        return a.unix_timestamp - b.unix_timestamp;
    });

    populateFilters();
    applyUrlFilters();
}

/* =======================
   FILTERS
   ======================= */
function populateFilters() {
    const sports = [...new Set(allEvents.map(e => e.sport))].sort();
    const tournaments = [...new Set(allEvents.map(e => e.tournament))].sort();

    const sportFilter = document.getElementById('sportFilter');
    const tournamentFilter = document.getElementById('tournamentFilter');

    sports.forEach(s => sportFilter.append(new Option(s, s)));
    tournaments.forEach(t => tournamentFilter.append(new Option(t, t)));
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
    return new Date(ts * 1000).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function displayEvents(events) {
    const container = document.getElementById('events');
    container.innerHTML = '';

    if (!events.length) {
        container.innerHTML = '<div class="no-results">No events found.</div>';
        return;
    }

    const now = Date.now() / 1000;

    events.forEach(event => {
        const isLive = event.unix_timestamp <= now && (now - event.unix_timestamp < LIVE_DURATION_SECONDS);

        const card = document.createElement('div');
        card.className = `event-card ${isLive ? 'live-event' : ''}`;

        card.innerHTML = `
            <div class="event-header">
                <div>
                    <div class="match-name">${event.match} ${isLive ? '<span class="live-badge">LIVE</span>' : ''}</div>
                    <div class="tournament-name">${event.tournament}</div>
                </div>
                <div>
                    <span class="sport-badge">${event.sport}</span>
                    <span class="time-badge">${formatTime(event.unix_timestamp)}</span>
                </div>
            </div>
            <div class="channels">
                ${event.channels.map((c, i) =>
                    `<button class="channel-link" onclick="openChannel('${c}','Stream ${i + 1} - ${event.match}',this)">Stream ${i + 1}</button>`
                ).join('')}
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
        <div class="stat-item"><div class="stat-value">${events.length}</div><div class="stat-label">Total Events</div></div>
        <div class="stat-item"><div class="stat-value">${new Set(events.map(e => e.sport)).size}</div><div class="stat-label">Sports</div></div>
        <div class="stat-item"><div class="stat-value">${new Set(events.map(e => e.tournament)).size}</div><div class="stat-label">Tournaments</div></div>
    `;
}

/* =======================
   PLAYER
   ======================= */
window.openChannel = function (url, info, btn) {
    player-section.style.display = 'block';
    main-player.src = url;
    current-channel.textContent = info;

    activeChannelButton?.classList.remove('active');
    btn.classList.add('active');
    activeChannelButton = btn;

    updateHeader(true);
};

window.closePlayer = function () {
    player-section.style.display = 'none';
    main-player.src = '';
    activeChannelButton?.classList.remove('active');
    activeChannelButton = null;
    updateHeader(false);
};

/* =======================
   INIT
   ======================= */
updateHeader(false);
loadData();
