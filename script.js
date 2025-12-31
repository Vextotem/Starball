const BASE_URL = 'https://beta.adstrim.ru/api';
let allEvents = [];
let allChannels = [];
let currentView = 'events'; 
let activeChannelButton = null;

const LIVE_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateHeader(false);
    
    // Set up event listeners after DOM is loaded
    const sf = document.getElementById('sportFilter');
    const tf = document.getElementById('tournamentFilter');
    const searchf = document.getElementById('searchFilter');

    if(sf) sf.addEventListener('change', render);
    if(tf) tf.addEventListener('change', render);
    if(searchf) searchf.addEventListener('input', render);
});

async function loadData() {
    const container = document.getElementById('events');
    if (!container) return;
    
    container.innerHTML = '<p class="loading">Loading matches and channels...</p>';

    try {
        const [eventsRes, channelsRes] = await Promise.all([
            fetch(`${BASE_URL}/events`).then(r => r.json()),
            fetch(`${BASE_URL}/channels`).then(r => r.json())
        ]);

        const now = Math.floor(Date.now() / 1000);
        const CUTOFF_TIME = now - LIVE_DURATION_SECONDS; 

        allEvents = [];
        if (eventsRes.data && Array.isArray(eventsRes.data)) {
            allEvents = eventsRes.data
                .map(item => ({
                    id: item.id || '',
                    home_team: item.home_team || 'Unknown',
                    away_team: item.away_team || 'Unknown',
                    home_logo: item.home_team_image || '',
                    away_logo: item.away_team_image || '',
                    league_logo: item.league_image || '',
                    tournament: item.league || 'General',
                    sport: item.sport || 'Sports',
                    unix_timestamp: item.timestamp || 0,
                    channels: (item.channels || []).map(c => ({
                        name: c.name || 'Stream',
                        url: c.link || '#'
                    }))
                }))
                .filter(event => event.unix_timestamp > CUTOFF_TIME);
        }

        const rawChannels = channelsRes.channels || channelsRes.data || [];
        allChannels = rawChannels.map(c => ({
            name: c.name || 'Unknown Channel',
            url: c.link || c.url || '#'
        }));
        allEvents.sort((a, b) => a.unix_timestamp - b.unix_timestamp);

        populateFilters();
        render();

    } catch (error) {
        console.error("Error loading data:", error);
        container.innerHTML = '<div class="no-results">Error loading data. Please check connection.</div>';
    }
}

window.switchView = function(view) {
    currentView = view;
    const evBtn = document.getElementById('showEvents');
    const chBtn = document.getElementById('showChannels');
    if(evBtn) evBtn.classList.toggle('active', view === 'events');
    if(chBtn) chBtn.classList.toggle('active', view === 'channels');

    const displayStyle = (view === 'events') ? 'block' : 'none';
    const sGroup = document.getElementById('sport-filter-group');
    const tGroup = document.getElementById('tournament-filter-group');
    if(sGroup) sGroup.style.display = displayStyle;
    if(tGroup) tGroup.style.display = displayStyle;

    render();
}

function render() {
    const container = document.getElementById('events');
    const searchInput = document.getElementById('searchFilter');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    
    if (currentView === 'events') {
        const sEl = document.getElementById('sportFilter');
        const tEl = document.getElementById('tournamentFilter');
        const sport = sEl ? sEl.value : "";
        const tournament = tEl ? tEl.value : "";

        const filtered = allEvents.filter(e => {
            const matchName = `${e.home_team} ${e.away_team} ${e.tournament}`.toLowerCase();
            const matchSearch = matchName.includes(search);
            const matchSport = !sport || e.sport === sport;
            const matchTournament = !tournament || e.tournament === tournament;
            return matchSearch && matchSport && matchTournament;
        });

        displayEvents(filtered, container);
        updateStats(filtered.length, "Matches Today");
    } else {
        const filtered = allChannels.filter(c => {
            const name = c.name ? c.name.toLowerCase() : "";
            return name.includes(search);
        });
        displayChannels(filtered, container);
        updateStats(filtered.length, "TV Channels");
    }
}

function displayEvents(events, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!events.length) { 
        container.innerHTML = '<div class="no-results">No matches found for today.</div>'; 
        return; 
    }

    const now = Math.floor(Date.now() / 1000);

    events.forEach(event => {
        const isLive = event.unix_timestamp <= now && (now - event.unix_timestamp < LIVE_DURATION_SECONDS);
        const card = document.createElement('div');
        card.className = `event-card ${isLive ? 'live-event' : ''}`;
        
        const channelButtons = event.channels.map(c => 
            `<button class="channel-link" onclick="openChannel('${escapeHtml(c.url)}', '${escapeHtml(event.home_team + ' vs ' + event.away_team)}', this, event)">${escapeHtml(c.name)}</button>`
        ).join('');

        const timeString = new Date(event.unix_timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        card.innerHTML = `
            <div class="event-header">
                <div class="match-info-container">
                    <img src="${escapeHtml(event.league_logo)}" class="league-logo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/5351/5351486.png'">
                    <div>
                        <div class="teams-display">
                            <img src="${escapeHtml(event.home_logo)}" class="team-logo" onerror="this.style.display='none'">
                            <span>${escapeHtml(event.home_team)}</span>
                            <span class="vs-text">vs</span>
                            <span>${escapeHtml(event.away_team)}</span>
                            <img src="${escapeHtml(event.away_logo)}" class="team-logo" onerror="this.style.display='none'">
                            ${isLive ? '<span class="live-badge">LIVE</span>' : ''}
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
                ${channelButtons}
            </div>
        `;
        container.appendChild(card);
    });
}

function displayChannels(channels, container) {
    if(!container) return;
    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'channels-grid';

    channels.forEach(channel => {
        const btn = document.createElement('button');
        btn.className = 'channel-big';
        const url = channel.url || channel.link || '#'; 
        const name = channel.name || "Unknown Channel";
        btn.innerHTML = `<span>${escapeHtml(name)}</span>`;
        btn.onclick = (e) => openChannel(url, name, e.target, e);
        grid.appendChild(btn);
    });
    container.appendChild(grid);
}

function populateFilters() {
    const sF = document.getElementById('sportFilter');
    const tF = document.getElementById('tournamentFilter');
    if (sF && tF) {
        const curS = sF.value;
        const curT = tF.value;
        sF.innerHTML = '<option value="">All Sports</option>';
        tF.innerHTML = '<option value="">All Tournaments</option>';
        
        const sports = [...new Set(allEvents.map(e => e.sport))].filter(Boolean).sort();
        const tournaments = [...new Set(allEvents.map(e => e.tournament))].filter(Boolean).sort();
        
        sports.forEach(s => sF.appendChild(new Option(s, s)));
        tournaments.forEach(t => tF.appendChild(new Option(t, t)));
        sF.value = curS; tF.value = curT;
    }
}

function updateStats(count, label) {
    const stats = document.getElementById('stats');
    if (stats) stats.innerHTML = `<div class="stat-item"><div class="stat-value">${count}</div><div class="stat-label">${label}</div></div>`;
}

window.openChannel = function (url, info, btn, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const pSec = document.getElementById('player-section');
    const mPl = document.getElementById('main-player');
    const cCh = document.getElementById('current-channel');
    if (!pSec || !mPl) return;
    
    pSec.style.display = 'block';
    
    let finalUrl = '';
    
    // The user wants the format: https://topembed.pw/channel/ChannelName
    // If info contains ' vs ', it's an event, and 'url' is the channel link.
    // If info does NOT contain ' vs ', it's a TV channel, and 'info' is the channel name.
    
    if (info.includes(' vs ')) {
        // Event channel: use the link provided in 'url'
        let channelParam = url.replace('/channel/', '');
        finalUrl = 'https://topembed.pw/channel/' + encodeURIComponent(channelParam);
    } else {
        // TV channel: use the channel name provided in 'info'
        finalUrl = 'https://topembed.pw/channel/' + encodeURIComponent(info);
    }

    mPl.src = finalUrl;
    if(cCh) cCh.textContent = info;
    if (activeChannelButton) activeChannelButton.classList.remove('active');
    const actualBtn = btn && btn.tagName === 'BUTTON' ? btn : (btn ? btn.closest('button') : null);
    if (actualBtn) { actualBtn.classList.add('active'); activeChannelButton = actualBtn; }
    window.scrollTo({top: 0, behavior: 'smooth'});
    updateHeader(true);
};

window.closePlayer = function () {
    const pSec = document.getElementById('player-section');
    const mPl = document.getElementById('main-player');
    if(pSec) pSec.style.display = 'none';
    if(mPl) mPl.src = '';
    if (activeChannelButton) activeChannelButton.classList.remove('active');
    activeChannelButton = null;
    updateHeader(false);
};

function updateHeader(isPlaying) {
    const hDiv = document.getElementById('main-header');
    if(hDiv) hDiv.style.display = isPlaying ? 'none' : 'block';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

