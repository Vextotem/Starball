const BASE_URL = '/api'; // your backend
let allEvents = [];
let activeChannelButton = null;

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
});

async function loadEvents() {
    const container = document.getElementById('events');
    if (!container) return;

    container.innerHTML = '<p class="loading">Loading matches...</p>';

    try {
        const res = await fetch(`${BASE_URL}/events`);
        const data = await res.json();

        allEvents = Array.isArray(data) ? data : [];
        renderEvents(allEvents);

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="no-results">Failed to load events</div>';
    }
}

function renderEvents(events) {
    const container = document.getElementById('events');
    container.innerHTML = '';

    if (!events.length) {
        container.innerHTML = '<div class="no-results">No matches available</div>';
        return;
    }

    events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';

        const date = new Date(event.startTime).toLocaleString();

        card.innerHTML = `
            <div class="event-header">
                <div>
                    <strong>${escapeHtml(event.home)} vs ${escapeHtml(event.away)}</strong>
                    <div class="tournament-name">${escapeHtml(event.tournament)}</div>
                    <small>${date}</small>
                </div>
            </div>
            <div class="channels">
                <button class="channel-link"
                    onclick="loadStreams('${event.id}', this)">
                    Watch
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}

async function loadStreams(eventId, btn) {
    try {
        const res = await fetch(`${BASE_URL}/streams/${eventId}`);
        const streams = await res.json();

        if (!Array.isArray(streams) || !streams.length) {
            alert('No streams available');
            return;
        }

        showStreamOptions(streams, btn);

    } catch (err) {
        console.error(err);
        alert('Failed to load streams');
    }
}

function showStreamOptions(streams, btn) {
    const container = document.getElementById('events');
    container.innerHTML = '';

    streams.forEach(stream => {
        const button = document.createElement('button');
        button.className = 'channel-link';
        button.textContent = stream.label || 'Stream';

        button.onclick = () => openPlayer(stream.url, stream.label, button);
        container.appendChild(button);
    });
}

function openPlayer(url, label, btn) {
    const playerSection = document.getElementById('player-section');
    const iframe = document.getElementById('main-player');
    const currentChannel = document.getElementById('current-channel');

    if (!iframe || !playerSection) return;

    iframe.src = url;
    playerSection.style.display = 'block';

    if (currentChannel) currentChannel.textContent = label;

    if (activeChannelButton) {
        activeChannelButton.classList.remove('active');
    }

    btn.classList.add('active');
    activeChannelButton = btn;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.closePlayer = function () {
    const iframe = document.getElementById('main-player');
    const playerSection = document.getElementById('player-section');

    if (iframe) iframe.src = '';
    if (playerSection) playerSection.style.display = 'none';

    if (activeChannelButton) {
        activeChannelButton.classList.remove('active');
        activeChannelButton = null;
    }
};

function escapeHtml(text = '') {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
