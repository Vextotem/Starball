const BASE_URL = 'https://beta.adstrim.ru/api';

let allEvents = [];
let allChannels = [];
let currentView = 'events'; 
let activeChannelButton = null;

const LIVE_DURATION_SECONDS = 3 * 60 * 60;

const POPULAR_LEAGUES = [
  'premier league','la liga','serie a','bundesliga','ligue 1',
  'champions league','uefa champions league',
  'europa league','uefa europa league',
  'world cup','copa america','euro'
];

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateHeader(false);

  document.getElementById('sportFilter')?.addEventListener('change', render);
  document.getElementById('tournamentFilter')?.addEventListener('change', render);
  document.getElementById('searchFilter')?.addEventListener('input', render);
});

async function loadData() {
  const container = document.getElementById('events');
  if (!container) return;

  container.innerHTML = '<p class="loading">Loading matches...</p>';

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
      unix_timestamp: item.timestamp || 0,
      channels: (item.channels || []).map(c => ({
        name: c.name || 'Stream',
        url: c.link || ''
      }))
    }));

    allChannels = (channelsRes.channels || channelsRes.data || []).map(c => ({
      name: c.name || 'Channel',
      url: c.link || c.url || ''
    }));

    populateFilters();
    render();

  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-results">Failed to load streams</div>';
  }
}

function sortEventsByPriority(events) {
  const now = Math.floor(Date.now() / 1000);

  return events.sort((a, b) => {
    const aLive = a.unix_timestamp <= now && now - a.unix_timestamp < LIVE_DURATION_SECONDS;
    const bLive = b.unix_timestamp <= now && now - b.unix_timestamp < LIVE_DURATION_SECONDS;

    if (aLive !== bLive) return aLive ? -1 : 1;

    const aFootball = /football|soccer/i.test(a.sport);
    const bFootball = /football|soccer/i.test(b.sport);
    if (aFootball !== bFootball) return aFootball ? -1 : 1;

    const aPopular = POPULAR_LEAGUES.some(l => a.tournament.toLowerCase().includes(l));
    const bPopular = POPULAR_LEAGUES.some(l => b.tournament.toLowerCase().includes(l));
    if (aPopular !== bPopular) return aPopular ? -1 : 1;

    return a.unix_timestamp - b.unix_timestamp;
  });
}

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

    displayEvents(sortEventsByPriority(filtered), container);
    updateStats(filtered.length, 'Matches');

  } else {
    const filtered = allChannels.filter(c =>
      c.name.toLowerCase().includes(search)
    );
    displayChannels(filtered, container);
    updateStats(filtered.length, 'Channels');
  }
}

function displayEvents(events, container) {
  container.innerHTML = '';
  if (!events.length) {
    container.innerHTML = '<div class="no-results">No matches found</div>';
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  events.forEach(event => {
    const isLive = event.unix_timestamp <= now && now - event.unix_timestamp < LIVE_DURATION_SECONDS;

    const card = document.createElement('div');
    card.className = `event-card ${isLive ? 'live-event' : ''}`;

    const buttons = event.channels.map(c => `
      <button class="channel-link"
        data-url="${c.url}"
        data-info="${event.home_team} vs ${event.away_team}">
        ${c.name}
      </button>
    `).join('');

    const d = new Date(event.unix_timestamp * 1000);

    card.innerHTML = `
      <div class="event-header">
        <strong>${event.home_team} vs ${event.away_team}</strong>
        ${isLive ? '<span class="live-badge">LIVE</span>' : ''}
        <div>${event.tournament}</div>
        <small>${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small>
      </div>
      <div class="channels">${buttons}</div>
    `;

    card.querySelectorAll('.channel-link').forEach(btn => {
      btn.addEventListener('click', e => {
        openChannel(btn.dataset.url, btn.dataset.info, btn, e);
      });
    });

    container.appendChild(card);
  });
}

function displayChannels(channels, container) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'channels-grid';

  channels.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'channel-big';
    btn.textContent = ch.name;
    btn.onclick = e => openChannel(ch.url, ch.name, btn, e);
    grid.appendChild(btn);
  });

  container.appendChild(grid);
}

function openChannel(url, info, btn, event) {
  event?.preventDefault();
  event?.stopPropagation();

  const player = document.getElementById('main-player');
  const section = document.getElementById('player-section');
  const label = document.getElementById('current-channel');

  if (!player || !section) return;

  let finalUrl = (url || '').trim();

  if (finalUrl.startsWith('/')) {
    finalUrl = 'https://dovkembed.pw' + finalUrl;
  }

  if (!finalUrl) return;

  player.src = finalUrl;
  section.style.display = 'block';
  if (label) label.textContent = info || 'Live Stream';

  activeChannelButton?.classList.remove('active');
  btn.classList.add('active');
  activeChannelButton = btn;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateHeader(true);
}

function closePlayer() {
  document.getElementById('player-section').style.display = 'none';
  document.getElementById('main-player').src = '';
  activeChannelButton?.classList.remove('active');
  activeChannelButton = null;
  updateHeader(false);
}

function updateHeader(isPlaying) {
  const header = document.getElementById('main-header');
  if (header) header.style.display = isPlaying ? 'none' : 'block';
}

function populateFilters() {
  const sF = document.getElementById('sportFilter');
  const tF = document.getElementById('tournamentFilter');
  if (!sF || !tF) return;

  sF.innerHTML = '<option value="">All Sports</option>';
  tF.innerHTML = '<option value="">All Tournaments</option>';

  [...new Set(allEvents.map(e => e.sport))].sort().forEach(v =>
    sF.appendChild(new Option(v, v))
  );
  [...new Set(allEvents.map(e => e.tournament))].sort().forEach(v =>
    tF.appendChild(new Option(v, v))
  );
}

function updateStats(count, label) {
  document.getElementById('stats').innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${count}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}
