/* ===========================
   AD ROTATION HELPERS
=========================== */

let adToggle = 0;

function createImageBanner() {
    const adDiv = document.createElement('div');
    adDiv.className = 'match-ad-separator';
    adDiv.innerHTML = `
        <div class="separator" style="text-align:center;width:100%;">
            <a href="https://ey43.com/4/6860097" target="_blank" rel="noopener">
                <img src="https://embedsportex.pages.dev/api/ads-desk.gif"
                     style="width:100%;height:auto;" alt="Advertisement">
            </a>
        </div>
    `;
    return adDiv;
}

function createIframeAd() {
    const adDiv = document.createElement('div');
    adDiv.className = 'match-ad-separator';

    const script1 = document.createElement('script');
    script1.text = `
        atOptions = {
            'key' : 'fe1c9e71cfc90fa0ffd2cdf0b4f11418',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
        };
    `;

    const script2 = document.createElement('script');
    script2.src = 'https://brookrivet.com/fe1c9e71cfc90fa0ffd2cdf0b4f11418/invoke.js';
    script2.async = true;

    adDiv.appendChild(script1);
    adDiv.appendChild(script2);

    return adDiv;
}

function getAlternatingAd() {
    adToggle++;
    return adToggle % 2 === 0 ? createIframeAd() : createImageBanner();
}

/* ===========================
   MAIN SCHEDULE LOGIC
=========================== */

let matchElements = [];

function displaySchedules() {
    const container = document.getElementById('match-schedule');
    container.innerHTML = '';
    matchElements = [];
    adToggle = 0;

    const sortedSchedules = sortSchedulesByLiveStatus([...schedules]);
    let currentSection = '';

    sortedSchedules.forEach((schedule, index) => {
        const localDateTime = convertToLocalTime(schedule.time, schedule.date);
        const matchStatus = getMatchStatus(schedule);

        let sectionTitle = '';
        if (matchStatus.status === 'live' && currentSection !== 'live') {
            sectionTitle = '🔴 LIVE NOW';
            currentSection = 'live';
        } else if (matchStatus.status === 'upcoming-soon' && currentSection !== 'upcoming-soon') {
            sectionTitle = '🕡 STARTING SOON';
            currentSection = 'upcoming-soon';
        } else if (matchStatus.status === 'upcoming' && currentSection !== 'upcoming') {
            sectionTitle = '📅 UPCOMING MATCHES';
            currentSection = 'upcoming';
        }

        if (sectionTitle) {
            const sectionHeader = document.createElement('div');
            sectionHeader.className = `section-header ${matchStatus.status === 'live' ? 'live' : ''}`;
            sectionHeader.textContent = sectionTitle;
            container.appendChild(sectionHeader);
        }

        const matchLink = document.createElement('a');
        matchLink.href = schedule.buttons?.[0]?.link || 'javascript:void(0)';
        matchLink.className = 'match-link';

        const matchContainer = document.createElement('div');
        matchContainer.className = `match-container ${matchStatus.status === 'live' ? 'live-match' : ''}`;

        matchContainer.innerHTML = `
            <div class="event-header">
                <img class="event-logo" src="${schedule.eventLogo}" width="30">
                <span>${schedule.event}</span>
            </div>

            <div class="team-images">
                <img src="${schedule.team1Image}" width="40">
                <img src="${schedule.team2Image}" width="40">
            </div>

            <div class="matchup">${schedule.matchup}</div>

            <div class="details">
                <div class="date">${localDateTime.date}</div>
                <div class="time">${localDateTime.time} (24 HOURS)</div>
            </div>
        `;

        if (matchStatus.status === 'live') {
            matchContainer.innerHTML += `<div class="status Online">Live Now</div>`;
        } else if (matchStatus.status === 'upcoming-soon') {
            matchContainer.innerHTML += `<div class="live-icon">Starting Soon</div>`;
        } else {
            const hours = Math.floor(matchStatus.timeDiff / 3600000);
            const minutes = Math.floor((matchStatus.timeDiff % 3600000) / 60000);
            matchContainer.innerHTML += `<div class="countdown">Upcoming in ${hours}h ${minutes}m</div>`;
        }

        matchLink.appendChild(matchContainer);
        container.appendChild(matchLink);

        matchElements.push({
            element: matchLink,
            searchData: {
                event: schedule.event.toLowerCase(),
                matchup: schedule.matchup.toLowerCase(),
                date: localDateTime.date.toLowerCase(),
                time: localDateTime.time.toLowerCase()
            }
        });

        /* 🔥 INSERT AD EVERY 4 MATCHES */
        if ((index + 1) % 4 === 0) {
            container.appendChild(getAlternatingAd());
        }
    });

    updateSearchStats(sortedSchedules.length, sortedSchedules.length);
}

/* ===========================
   SEARCH (ADS SAFE)
=========================== */

function setupSearch() {
    const searchInput = document.getElementById('searchInput');

    searchInput.addEventListener('input', function () {
        const term = this.value.toLowerCase().trim();
        const ads = document.querySelectorAll('.match-ad-separator');
        const headers = document.querySelectorAll('.section-header');

        let visible = 0;

        matchElements.forEach(match => {
            const data = match.searchData;
            const show =
                data.event.includes(term) ||
                data.matchup.includes(term) ||
                data.date.includes(term) ||
                data.time.includes(term);

            match.element.style.display = show ? 'block' : 'none';
            if (show) visible++;
        });

        headers.forEach(h => h.style.display = term ? 'none' : 'block');
        ads.forEach(ad => ad.style.display = term ? 'none' : 'block');

        updateSearchStats(visible, schedules.length);
    });
}

/* ===========================
   INIT
=========================== */

displaySchedules();
setupSearch();
