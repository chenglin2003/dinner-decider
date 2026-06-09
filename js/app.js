// js/app.js
import { fetchNearbyRestaurants, buildPhotoUrl, getLocation } from './places.js';
import { createRoom, getRoom, updateRoom, subscribeRoom, generateCode } from './sync.js';

// ── Constants ──────────────────────────────────────────────────────────────
const CUISINES = ['All','Japanese','Korean','Chinese','Western','Thai','Indian','Italian','Seafood','Cafe'];
const RADII    = [
  { label: '500 m', value: 500 },
  { label: '1 km',  value: 1000 },
  { label: '2 km',  value: 2000 },
  { label: '5 km',  value: 5000 },
];

// ── State ──────────────────────────────────────────────────────────────────
const S = {
  name: '',
  apiKey: '',
  roomCode: '',
  isHost: false,
  restaurants: [],
  mySwipes: {},     // { restaurantId: true/false }
  currentIdx: 0,
  cuisine: 'All',
  radius: 1000,
  coords: null,
  partnerName: '',
  unsubscribe: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${id}`).classList.add('active');
}
function setLoadingText(main, sub = '') {
  $('loading-text').textContent = main;
  const subEl = $('loading-sub');
  if (subEl) subEl.textContent = sub;
}

// ── Init ───────────────────────────────────────────────────────────────────
export const app = {
  init() {
    bindHome();
    buildCuisineChips();
    buildRadiusChips();
  }
};

// ── Home screen ────────────────────────────────────────────────────────────
function bindHome() {
  $('btn-create').addEventListener('click', onCreateRoom);
  $('btn-show-join').addEventListener('click', () => {
    const p = $('join-panel');
    p.classList.toggle('hidden');
    if (!p.classList.contains('hidden')) $('input-roomcode').focus();
  });
  $('btn-join').addEventListener('click', onJoinRoom);
  $('input-roomcode').addEventListener('keydown', e => { if (e.key === 'Enter') onJoinRoom(); });
}

async function onCreateRoom() {
  const name = $('input-name').value.trim();
  if (!name) { $('input-name').focus(); return; }

  S.name   = name;
  S.isHost = true;
  S.roomCode = generateCode();
  S.mySwipes = {};
  S.currentIdx = 0;

  const room = {
    host: name, guest: null,
    hostSwipes: {}, guestSwipes: {},
    restaurants: null,
    status: 'waiting',
    cuisine: S.cuisine,
    radius: S.radius,
    created: Date.now(),
  };
  await createRoom(S.roomCode, room);

  $('lobby-code').textContent = S.roomCode;
  updateLobbyStatus('Waiting for partner to join...');
  showScreen('lobby');
  startLobbyWatch();
}

async function onJoinRoom() {
  const code = $('input-roomcode').value.trim().toUpperCase();
  const name = $('input-name').value.trim();
  if (!name) { $('input-name').focus(); return; }
  if (code.length < 4) { $('input-roomcode').focus(); return; }

  const room = await getRoom(code);
  if (!room) { alert('Room not found. Check the code and try again.'); return; }

  S.name        = name;
  S.isHost      = false;
  S.roomCode    = code;
  S.partnerName = room.host;
  S.mySwipes    = {};
  S.currentIdx  = 0;
  S.cuisine     = room.cuisine || 'All';
  S.radius      = room.radius  || 1000;

  await updateRoom(code, { guest: name, status: 'loading' });

  $('lobby-code').textContent = code;
  updateLobbyStatus(`Connected! ${room.host} is the host.`);
  showScreen('lobby');

  // Guest triggers restaurant fetch
  await doFetchRestaurants(code);
}

function updateLobbyStatus(text) {
  $('lobby-status-text').textContent = text;
}

// ── Lobby ──────────────────────────────────────────────────────────────────
$('lobby-back').addEventListener('click', () => {
  if (S.unsubscribe) { S.unsubscribe(); S.unsubscribe = null; }
  showScreen('home');
});

function buildCuisineChips() {
  $('cuisine-chips').innerHTML = CUISINES.map(c =>
    `<button class="chip ${c === 'All' ? 'active' : ''}" data-cuisine="${c}">${c}</button>`
  ).join('');
  $('cuisine-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-cuisine]');
    if (!chip) return;
    S.cuisine = chip.dataset.cuisine;
    $('cuisine-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    if (S.isHost && S.roomCode) updateRoom(S.roomCode, { cuisine: S.cuisine });
  });
}

function buildRadiusChips() {
  $('radius-chips').innerHTML = RADII.map((r, i) =>
    `<button class="chip ${i === 1 ? 'active' : ''}" data-radius="${r.value}">${r.label}</button>`
  ).join('');
  $('radius-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-radius]');
    if (!chip) return;
    S.radius = Number(chip.dataset.radius);
    $('radius-chips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    if (S.isHost && S.roomCode) updateRoom(S.roomCode, { radius: S.radius });
  });
}

$('btn-start-search').addEventListener('click', async () => {
  if (!S.isHost) return;
  await doFetchRestaurants(S.roomCode);
});

// ── Lobby watch (host waits for guest) ────────────────────────────────────
function startLobbyWatch() {
  if (S.unsubscribe) S.unsubscribe();
  S.unsubscribe = subscribeRoom(S.roomCode, async room => {
    if (!room) return;
    if (room.guest) {
      S.partnerName = room.guest;
      updateLobbyStatus(`${room.guest} joined! Ready to search.`);
      const btn = $('btn-start-search');
      btn.disabled = false;
      $('start-btn-text').textContent = 'Find restaurants 🍽️';
    }
    // If guest already loaded restaurants, jump to swipe
    if (room.status === 'ready' && room.restaurants && S.isHost) {
      S.restaurants = room.restaurants;
      if (S.unsubscribe) { S.unsubscribe(); S.unsubscribe = null; }
      startSwipeScreen();
    }
  });
}

// ── Fetch restaurants ──────────────────────────────────────────────────────
async function doFetchRestaurants(code) {
  showScreen('loading');
  setLoadingText('Getting your location...', 'Please allow location access');

  try {
    S.coords = await getLocation();
  } catch (e) {
    alert(e.message);
    showScreen('lobby');
    return;
  }

  setLoadingText('Finding restaurants nearby...', `${S.cuisine} within ${S.radius >= 1000 ? S.radius/1000 + ' km' : S.radius + ' m'}`);

  try {
    const restaurants = await fetchNearbyRestaurants(S.apiKey, S.coords, S.cuisine, S.radius, 10);
    if (!restaurants.length) {
      alert('No restaurants found nearby. Try a wider radius or different cuisine.');
      showScreen('lobby');
      return;
    }
    S.restaurants = restaurants;
    await updateRoom(code, { restaurants, status: 'ready' });

    if (S.unsubscribe) { S.unsubscribe(); S.unsubscribe = null; }
    startSwipeScreen();
  } catch (e) {
    console.error(e);
    alert('Could not fetch restaurants: ' + e.message + '\n\nCheck your API key and make sure Places API (New) is enabled.');
    showScreen('lobby');
  }
}

// ── Swipe screen ───────────────────────────────────────────────────────────
function startSwipeScreen() {
  S.currentIdx = 0;
  S.mySwipes   = {};

  $('avatar-you').textContent         = S.name.substring(0, 2).toUpperCase();
  $('avatar-partner').textContent     = (S.partnerName || 'P').substring(0, 2).toUpperCase();
  $('swipe-you-name').textContent     = S.name;
  $('swipe-partner-name').textContent = S.partnerName || 'Partner';
  $('swipe-you-count').textContent    = '0';
  $('swipe-partner-count').textContent = '0';

  renderCard();
  showScreen('swipe');
  startSwipeWatch();
}

function renderCard() {
  updateProgress();
  const stack = $('card-stack');
  const r = S.restaurants[S.currentIdx];

  if (!r) {
    stack.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:14px;color:var(--text-secondary);">All swiped!</div>`;
    return;
  }

  // Build photo element
  const photoUrl = r.photoRef ? buildPhotoUrl(r.photoRef, S.apiKey, 600) : null;
  const photoHtml = photoUrl
    ? `<img class="card-photo" src="${photoUrl}" alt="${r.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="card-photo-placeholder" style="display:none">🍽️</div>`
    : `<div class="card-photo-placeholder">🍽️</div>`;

  // Tags
  const tags = [];
  if (r.rating)  tags.push({ label: `★ ${r.rating} (${r.ratingCount.toLocaleString()})`, cls: 'green' });
  if (r.price)   tags.push({ label: r.price, cls: r.price.length <= 1 ? 'green' : r.price.length === 2 ? 'amber' : 'red' });
  if (r.isOpen === true)  tags.push({ label: 'Open now', cls: 'green' });
  if (r.isOpen === false) tags.push({ label: 'Closed',   cls: 'red' });
  const tagsHtml = tags.map(t => `<span class="card-tag ${t.cls}">${t.label}</span>`).join('');

  const summaryHtml = r.summary
    ? `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;line-height:1.4;">${r.summary}</p>`
    : '';

  stack.innerHTML = `
    <div class="restaurant-card" id="active-card">
      <div class="swipe-stamp like">LIKE</div>
      <div class="swipe-stamp nope">NOPE</div>
      ${photoHtml}
      <div class="card-body">
        <div class="card-name">${r.name}</div>
        <div class="card-address">${r.address}</div>
        ${summaryHtml}
        <div class="card-tags">${tagsHtml}</div>
      </div>
    </div>
  `;

  setupDrag();
}

function updateProgress() {
  const total = S.restaurants.length;
  const done  = S.currentIdx;
  const pct   = total ? (done / total) * 100 : 0;
  $('progress-fill').style.width = pct + '%';
  $('progress-label').textContent = `${done + 1} / ${total}`;
}

// ── Drag & swipe ───────────────────────────────────────────────────────────
function setupDrag() {
  const card = $('active-card');
  if (!card) return;

  let startX = 0, dx = 0, dragging = false;

  const onStart = x => { startX = x; dragging = true; };
  const onMove  = x => {
    if (!dragging) return;
    dx = x - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
    const likeStamp = card.querySelector('.swipe-stamp.like');
    const nopeStamp = card.querySelector('.swipe-stamp.nope');
    if (likeStamp) likeStamp.style.opacity = dx > 30 ? Math.min((dx - 30) / 60, 1) : 0;
    if (nopeStamp) nopeStamp.style.opacity = dx < -30 ? Math.min((-dx - 30) / 60, 1) : 0;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    if      (dx >  80) commitSwipe(true);
    else if (dx < -80) commitSwipe(false);
    else {
      card.style.transition = 'transform 0.3s ease';
      card.style.transform  = '';
      setTimeout(() => { if (card) card.style.transition = ''; }, 300);
    }
    dx = 0;
  };

  card.addEventListener('mousedown',  e => onStart(e.clientX));
  window.addEventListener('mousemove', e => onMove(e.clientX));
  window.addEventListener('mouseup',   () => onEnd());
  card.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
  card.addEventListener('touchmove',  e => onMove(e.touches[0].clientX),  { passive: true });
  card.addEventListener('touchend',   () => onEnd());
}

$('btn-like').addEventListener('click', () => commitSwipe(true));
$('btn-nope').addEventListener('click', () => commitSwipe(false));

async function commitSwipe(liked) {
  const r = S.restaurants[S.currentIdx];
  if (!r) return;

  S.mySwipes[r.id] = liked;

  const card = $('active-card');
  if (card) {
    card.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
    card.style.transform  = `translateX(${liked ? 400 : -400}px) rotate(${liked ? 20 : -20}deg)`;
    card.style.opacity    = '0';
  }

  // Persist swipes to Firebase
  const swipeKey = S.isHost ? 'hostSwipes' : 'guestSwipes';
  await updateRoom(S.roomCode, { [swipeKey]: S.mySwipes });

  S.currentIdx++;
  $('swipe-you-count').textContent = S.currentIdx;

  setTimeout(() => {
    if (S.currentIdx >= S.restaurants.length) {
      showScreen('waiting');
      $('waiting-partner-name').textContent = S.partnerName || 'your partner';
    } else {
      renderCard();
    }
  }, 320);
}

// ── Swipe watch (real-time partner sync + match detection) ─────────────────
function startSwipeWatch() {
  if (S.unsubscribe) S.unsubscribe();
  S.unsubscribe = subscribeRoom(S.roomCode, room => {
    if (!room) return;

    const partnerSwipes = S.isHost ? room.guestSwipes : room.hostSwipes;
    const partnerCount  = Object.keys(partnerSwipes || {}).length;
    $('swipe-partner-count').textContent = partnerCount;

    const meDone      = S.currentIdx >= S.restaurants.length;
    const partnerDone = partnerCount  >= S.restaurants.length;

    if ($('waiting-status-text')) {
      $('waiting-status-text').textContent = partnerDone
        ? `${S.partnerName || 'Partner'} is done!`
        : `${S.partnerName || 'Partner'} has swiped ${partnerCount}/${S.restaurants.length}`;
    }

    if (meDone && partnerDone) {
      if (S.unsubscribe) { S.unsubscribe(); S.unsubscribe = null; }
      resolveMatch(partnerSwipes);
    }
  });
}

function resolveMatch(partnerSwipes) {
  const matches = S.restaurants.filter(r => S.mySwipes[r.id] && partnerSwipes[r.id]);
  if (!matches.length) {
    showScreen('nomatch');
    return;
  }
  // Pick highest-rated mutual like
  const pick = matches.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  showMatchScreen(pick);
}

// ── Match screen ───────────────────────────────────────────────────────────
function showMatchScreen(r) {
  $('match-name').textContent    = r.name;
  $('match-address').textContent = r.address;

  const tags = [];
  if (r.rating) tags.push(`★ ${r.rating}`);
  if (r.price)  tags.push(r.price);
  if (r.isOpen === true)  tags.push('Open now');
  if (r.isOpen === false) tags.push('Closed');
  $('match-tags').innerHTML = tags.map(t => `<span class="card-tag">${t}</span>`).join('');

  if (r.photoRef) {
    const photoUrl = buildPhotoUrl(r.photoRef, S.apiKey, 800);
    const img = $('match-photo');
    img.src = photoUrl;
    img.classList.remove('hidden');
    $('match-photo-placeholder').classList.add('hidden');
  } else {
    $('match-photo').classList.add('hidden');
    $('match-photo-placeholder').classList.remove('hidden');
  }

  launchConfetti();
  showScreen('match');

  $('btn-directions').onclick = () => {
    const url = r.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + r.address)}`;
    window.open(url, '_blank');
  };
}

function launchConfetti() {
  const colors = ['#FF6B4A','#2DB87A','#F5A623','#6B3FD4','#E8404A','#00BFFF'];
  const container = $('match-confetti');
  container.innerHTML = '';
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${6 + Math.random() * 6}px;
      height: ${10 + Math.random() * 8}px;
      animation-duration: ${2 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.8}s;
      transform: rotate(${Math.random() * 360}deg);
    `;
    container.appendChild(el);
  }
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

// ── Reset ──────────────────────────────────────────────────────────────────
function resetApp() {
  if (S.unsubscribe) { S.unsubscribe(); S.unsubscribe = null; }
  Object.assign(S, {
    name:'', roomCode:'', isHost:false,
    restaurants:[], mySwipes:{}, currentIdx:0,
    cuisine:'All', radius:1000, coords:null, partnerName:''
  });
  showScreen('home');
}
$('btn-reset').addEventListener('click', resetApp);
$('btn-retry').addEventListener('click', resetApp);

