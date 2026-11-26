/* Plain browser JavaScript. No build step, framework, or third-party scripts. */
import { ElevatorMusic } from './music.js';
const app = document.querySelector('#app');
const toastNode = document.querySelector('#toast');
const rules = document.querySelector('#rules');
let session = null;
let state = null;
let screen = 'home';
let mode = 'reveal';
let connected = true;
let serverOffset = 0;
let pollTimer = null;
let generation = 0;
let renderKey = '';
let toastTimer;
let pending = Promise.resolve();
let lastStoredSession = null;
let busy = false;
let selectedDifficulty = storageChoice();
let zoom = 'fit';
let boardLayout = '';
const boardOptions = [
  { id: 'easy', name: 'Easy', rows: 9, columns: 9, mines: 10 },
  { id: 'medium', name: 'Medium', rows: 16, columns: 16, mines: 40 },
  { id: 'hard', name: 'Hard', rows: 30, columns: 16, mines: 99 },
];
function storageChoice() { try { return ['easy', 'medium', 'hard'].includes(localStorage.getItem('sweep-difficulty')) ? localStorage.getItem('sweep-difficulty') : 'easy'; } catch { return 'easy'; } }
let invite = new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) || '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing can restrict storage. */ } },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};
const music = new ElevatorMusic({ storage, onChange: updateMusicControl });
function updateMusicControl() {
  const button = document.querySelector('#music-toggle');
  if (!button) return;
  const blocked = music.enabled && music.phase === 'playing' && !music.playing;
  button.textContent = music.unavailable ? 'Music unavailable' : !music.enabled ? '♫ Music off' : blocked ? '♫ Tap for music' : '♫ Music on';
  button.disabled = music.unavailable;
  button.setAttribute('aria-pressed', music.enabled ? 'true' : 'false');
  button.setAttribute('aria-label', blocked ? 'Tap to start music' : music.enabled ? 'Mute music' : 'Turn music on');
  button.dataset.musicState = music.playing ? 'playing' : !music.enabled ? 'muted' : 'silent';
}
try { lastStoredSession = JSON.parse(storage.get('sweep-session')); } catch {}
if (!lastStoredSession?.code || !lastStoredSession?.token) lastStoredSession = null;

function toast(message) {
  toastNode.textContent = message; toastNode.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastNode.hidden = true; }, 4500);
}

async function api(path, data, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`/api/rooms${path}`, {
      method: data ? 'POST' : 'GET',
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal, cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Please try again.'); error.status = response.status; throw error; }
    return result;
  } finally { clearTimeout(timer); }
}

function adopt(next) {
  if (state && next.code === state.code && (next.round < state.round || next.revision < state.revision)) return;
  serverOffset = next.serverNow - Date.now();
  state = next; connected = true;
  renderRace();
}

function saveSession(code, token) {
  session = { code, token }; lastStoredSession = session;
  storage.set('sweep-session', JSON.stringify(session));
  // The code is shareable; the secret player token stays out of the URL.
  history.replaceState(null, '', `/?room=${code}`);
}

function activate(result) {
  generation++; clearTimeout(pollTimer); renderKey = ''; mode = 'reveal';
  state = null; saveSession(result.state.code, result.token); screen = 'race';
  adopt(result.state); poll(generation);
}

async function poll(epoch) {
  if (epoch !== generation || !session || document.hidden) return;
  const active = { ...session };
  try {
    const next = await api(`/${active.code}`, null, active.token);
    if (epoch !== generation) return;
    adopt(next);
  } catch (error) {
    if (epoch !== generation) return;
    if ([401, 404].includes(error.status)) {
      goHome(); storage.remove('sweep-session'); lastStoredSession = null;
      renderHome(); toast(error.message); return;
    }
    connected = false; renderKey = ''; renderRace();
  }
  if (epoch === generation) pollTimer = setTimeout(() => poll(epoch), connected ? 750 : 2000);
}

function move(type, index, extra = {}) {
  if (!session || !state) return;
  if (!connected) return toast('Reconnecting. Your board will resume when connected.');
  const active = { ...session }, round = state.round, epoch = generation;
  pending = pending.catch(() => {}).then(async () => {
    if (epoch !== generation || state?.round !== round) return;
    try {
      const next = await api(`/${active.code}/actions`, { type, index, round, ...extra }, active.token);
      if (epoch === generation) adopt(next);
    } catch (error) {
      if (epoch !== generation) return;
      toast(error.status ? error.message : 'Connection interrupted. Check your board before trying again.');
      if (!error.status) { connected = false; renderKey = ''; renderRace(); }
    }
  });
}

function renderHome() {
  screen = 'home';
  music.update({ phase: 'home', visible: !document.hidden, connected: false });
  boardLayout = '';
  app.innerHTML = `
    <section class="hero" aria-labelledby="home-title">
      <img src="/field.svg" alt="A cheerful Minesweeper mine with a smiling face">
      <div class="hero-copy"><div class="eyebrow">THE MULTIPLAYER MINESWEEPER CLUB</div>
        <h1 id="home-title">Small mine.<br>Big rivalries.</h1><p>Bring your nerve.<br>And up to seven friends.</p></div>
      <div class="hero-chip"><span aria-hidden="true">☺</span><div><small>THE CHALLENGE</small><strong>One board. Up to eight players.</strong></div></div>
    </section>
    <section class="section">
      <div class="name-row"><label class="field-label" for="player-name">What should we call you?</label>
        <input class="name-input" id="player-name" placeholder="Your name" maxlength="20" autocomplete="nickname" value="${esc(storage.get('sweep-name') || '')}"></div>
      <fieldset class="difficulty-picker"><legend class="field-label">Choose your board</legend>${difficultyButtons(selectedDifficulty)}</fieldset>
      <div class="button-row">
        <button id="create" class="button green"><span class="button-icon" aria-hidden="true">⚑</span><span class="button-copy">Create race<small>Invite your friends</small></span></button>
        <button id="show-join" class="button blue"><span class="button-icon" aria-hidden="true">♧</span><span class="button-copy">Join race<small>Enter a room code</small></span></button>
      </div>
      <p class="micro-note">FREE TO PLAY · NO ACCOUNT NEEDED</p>
      <div class="join-area" id="join-area" ${invite ? '' : 'hidden'}>
        <label class="field-label" for="join-code">Your friend’s six-character invite code</label>
        <form class="join-form" id="join-form"><input id="join-code" class="code-input" maxlength="6" minlength="6" placeholder="ABC234" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Invite code" value="${esc(invite)}" required><button class="button blue" type="submit">Join</button></form>
      </div>
      ${lastStoredSession ? `<div class="resume-box">Have an unfinished rivalry?<button id="resume">Return to room ${esc(lastStoredSession.code)}</button></div>` : ''}
      <div class="mini-row"><div class="mini-card"><span class="mini-icon" aria-hidden="true">▦</span><div><strong>Identical boards</strong><small>A fair start, every time</small></div></div>
        <div class="mini-card"><span class="mini-icon" aria-hidden="true">◷</span><div><strong>2–8 players</strong><small>Room for your rivals</small></div></div></div>
    </section>`;
}

function goHome() {
  generation++; clearTimeout(pollTimer); session = null; state = null; renderKey = ''; invite = '';
  history.replaceState(null, '', '/'); renderHome();
}

function you() { return state.players.find(p => p.id === state.you); }
function rivals() { return state.players.filter(p => p.id !== state.you); }
function difficultyButtons(selected, disabled = false) {
  return boardOptions.map(b => `<button type="button" class="difficulty-option ${selected === b.id ? 'chosen' : ''}" data-difficulty="${b.id}" aria-pressed="${selected === b.id}" ${disabled ? 'disabled' : ''}><strong>${b.name}</strong><span>${b.rows} × ${b.columns}</span><small>${b.mines} mines</small></button>`).join('');
}
function boardDescription() { return `${state.difficulty[0].toUpperCase() + state.difficulty.slice(1)} · ${state.rows} rows × ${state.columns} columns · ${state.mines} mines`; }

function renderRace() {
  if (!state || screen !== 'race') return;
  music.update({ phase: state.phase, visible: !document.hidden, connected });
  const key = [state.code, state.revision, mode, connected, ...state.players.map(p => p.online)].join(':');
  if (key === renderKey) return;
  renderKey = key;
  if (state.phase === 'lobby') { boardLayout = ''; renderLobby(); } else renderBoard();
  updateClock();
}

function renderLobby() {
  const me = you(), host = me.id === state.host;
  const allReady = state.players.length >= 2 && state.players.every(p => p.ready);
  app.innerHTML = `<section class="room-heading"><div class="eyebrow">YOUR PRIVATE FIELD · ${state.players.length} / ${state.maxPlayers} PLAYERS</div><h1>Bring a little competition.</h1><p>Invite up to seven friends.<br>The host starts when everyone is ready.</p></section>
    <section class="invite-card"><div class="eyebrow">INVITE CODE</div><div class="invite-code">${esc(state.code)}</div>
      <div class="invite-buttons"><button id="copy-code" class="button light">Copy code</button><button id="share" class="button light">Share invite</button></div></section>
    <section class="lobby-settings"><fieldset class="difficulty-picker"><legend class="field-label">${host ? 'Your board · changing it resets everyone’s Ready' : 'The host’s board choice'}</legend>${difficultyButtons(state.difficulty, !host || !connected)}</fieldset><p class="small-note">Rows × columns. Everyone starts with all tiles hidden on the same randomly mined board. Your first click can hit a mine.</p></section>
    <div class="players">${state.players.map(p => `<div class="player-card"><div class="avatar ${p.id === me.id ? '' : 'rival'}">${esc(p.name[0].toUpperCase())}</div><div class="player-info"><strong>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</strong><small>${p.id === state.host ? 'Host · ' : ''}${p.online ? 'In the clubhouse' : 'Reconnecting…'}</small></div><span class="player-status ${p.ready ? 'ready' : ''}">${p.ready ? '✓ Ready' : 'Not ready'}</span></div>`).join('')}</div>
    <div class="section"><button id="ready" class="button ${me.ready ? 'light' : 'green'} full" ${!connected ? 'disabled' : ''}>${me.ready ? 'Ready ✓ · tap to cancel' : 'I’m ready'}</button>
      ${host ? `<button id="start-race" class="button blue full start-race" ${!allReady || !connected ? 'disabled' : ''}>Start race · ${state.players.length} ${state.players.length === 1 ? 'player' : 'players'}</button>` : ''}
      <p class="lobby-note">${host ? 'Invite everyone first. Once all players are ready, tap Start race for the shared countdown.' : 'Mark yourself ready. The host will start the shared countdown.'}</p>
      <div class="race-footer"><button id="leave" class="text-button">Leave room</button><span class="connection ${connected ? '' : 'offline'}">${connected ? 'Connected' : 'Reconnecting…'}</span></div></div>`;
}

function raceMessage() {
  const me = you(), others = rivals();
  if (state.phase === 'finished') {
    const winner = state.players.find(p => p.id === state.winner);
    const title = !winner ? 'An even match.' : winner.id === me.id ? 'This field is yours.' : `${esc(winner.name)} takes the field.`;
    const details = {
      cleared: 'All safe tiles cleared. That’s a clean sweep.',
      passed: 'The last survivor passed every frozen score.',
      'all-mines': 'Every player hit a mine. The highest safe-tile count decided it.',
      forfeit: 'The other players conceded the race.',
    };
    const tiedNames = state.players.filter(p => state.leaders.includes(p.id)).map(p => esc(p.name)).join(', ');
    return `<div class="race-message result" role="status"><strong>${title}</strong>${details[state.reason] || ''} ${!winner ? tiedNames ? `Draw: ${tiedNames}.` : 'No winner this time.' : ''}</div>`;
  }
  if (state.phase === 'countdown') return '<div class="race-message"><strong>A hidden field.</strong>Every tile stays covered when the countdown ends. Mines can be anywhere, including your first click.</div>';
  if (me.forfeited) return '<div class="race-message warning" role="status"><strong>You conceded.</strong>You can watch the remaining players finish the race.</div>';
  if (me.hit) return `<div class="race-message warning" role="status"><strong>You hit a mine.</strong>Your score is frozen at ${me.revealed}. The remaining players can still pass it or clear the board.</div>`;
  const frozen = others.filter(p => p.hit && !p.forfeited), active = others.filter(p => !p.hit && !p.forfeited);
  if (frozen.length) {
    const target = Math.max(...frozen.map(p => p.revealed)) + 1;
    return `<div class="race-message warning" role="status"><strong>${frozen.length} frozen ${frozen.length === 1 ? 'score' : 'scores'}.</strong>${active.length ? `Keep racing ${active.length} other active ${active.length === 1 ? 'player' : 'players'}. A full clear wins immediately.` : `You’re the last survivor. Reveal ${Math.max(0, target - me.revealed)} more safe tiles to beat every frozen score.`}</div>`;
  }
  return '<div class="race-message"><strong>Every safe tile counts.</strong>First to clear wins. Hitting a mine freezes your score while the remaining players keep going.</div>';
}

function renderBoard() {
  const me = you(), finished = state.phase === 'finished';
  const canPlay = state.phase === 'playing' && !me.hit && !me.forfeited && connected;
  const layout = `${state.code}:${state.round}:${state.rows}:${state.columns}`;
  if (layout !== boardLayout) {
    boardLayout = layout; mode = 'reveal'; zoom = state.columns === 9 ? 'fit' : 'normal';
    app.innerHTML = `<div class="status-strip"><span class="room-id">${esc(state.code)} · ROUND ${state.round}</span><span class="timer" id="clock">00:00</span></div>
      <section class="scoreboard" id="scores" aria-label="Live scores. Swipe to see all players."></section>
      <details class="standings"><summary>All ${state.players.length} players · standings</summary><div id="standings-list"></div></details>
      <div class="board-heading"><div class="board-info">${esc(boardDescription())}</div><button id="music-toggle" class="music-toggle" type="button">♫ Music on</button></div>
      <div class="move-tools"><div class="segmented" role="group" aria-label="Tile action"><button id="mode-reveal" class="mode-button">▦ Reveal</button><button id="mode-flag" class="mode-button">⚑ Flag</button></div><span class="mines-left" id="flags-left"></span></div>
      <div class="zoom-tools" role="group" aria-label="Board zoom"><button id="zoom-out" class="zoom-button" aria-label="Zoom out">−</button><output id="zoom-label">Fit</output><button id="zoom-in" class="zoom-button" aria-label="Zoom in">+</button><button id="zoom-fit" class="zoom-button text-zoom">Fit</button></div>
      <div class="board-wrap"><div id="board-viewport" class="board-viewport"><div class="board cols-${state.columns}" id="board" role="group" aria-label="Your Minesweeper board. Arrow keys move focus; Enter reveals; F flags.">${state.board.map((_, i) => `<button class="tile" data-cell="${i}"></button>`).join('')}</div></div><div class="board-mask" id="countdown-mask" hidden><small>GET READY</small><strong id="countdown">3</strong><small>SAME BOARD. SAME START.</small></div></div>
      <p class="pan-hint">Drag to explore a large board. Zoom in for bigger tiles.</p>
      <div id="race-feedback"></div><div id="result-actions" class="result-actions"></div>
      <div class="race-footer"><button id="concede" class="text-button">Concede race</button><button id="leave" class="text-button" hidden>Leave room</button><span id="connection" class="connection"></span></div>`;
  }
  // Keep the actual board/scroll container mounted while live scores change.
  // Rebuilding it on every rival move interrupts touch scrolling on iOS.
  const scores = document.querySelector('#scores'), scoreScroll = scores.scrollLeft;
  const ordered = [me, ...state.players.filter(p => p.id !== me.id)];
  scores.innerHTML = ordered.map(p => `<div class="score-card ${p.id === me.id ? '' : 'rival'}"><div class="score-name"><strong>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</strong><span class="score-tag">${p.forfeited ? 'OUT' : p.hit ? 'MINE' : p.online ? 'LIVE' : 'AWAY'}</span></div><div class="score-count">${p.revealed}<small> / ${state.safe}</small></div><progress max="${state.safe}" value="${p.revealed}" aria-label="${esc(p.name)}: ${p.revealed} of ${state.safe} safe tiles"></progress></div>`).join('');
  scores.scrollLeft = scoreScroll;
  document.querySelector('#standings-list').innerHTML = [...state.players].sort((a, b) => Number(a.forfeited) - Number(b.forfeited) || b.revealed - a.revealed).map(p => `<div class="standing-row"><strong>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</strong><span>${p.revealed} safe · ${p.left ? 'left' : p.forfeited ? 'conceded' : p.hit ? 'mine' : finished ? p.id === state.winner ? 'winner' : 'finished' : 'racing'}</span></div>`).join('');
  const opened = new Set(state.opened), flags = new Set(state.flags);
  document.querySelectorAll('[data-cell]').forEach((tile, i) => {
      const value = state.board[i];
      const isOpen = opened.has(i), flagged = flags.has(i);
      const classes = ['tile', isOpen ? `open n${value}` : '', value === -1 ? 'mine' : '', i === state.hit ? 'exploded' : '', flagged && !isOpen && value !== -1 ? 'flag' : ''].filter(Boolean).join(' ');
      const row = Math.floor(i / state.columns) + 1, col = i % state.columns + 1;
      const label = value === -1 ? 'mine' : isOpen || finished ? value ? `${value} adjacent mines` : 'empty' : flagged ? 'flagged' : 'covered';
      const text = value === -1 ? '✹' : flagged && !isOpen ? '⚑' : isOpen || finished ? value > 0 ? value : '' : '';
      tile.className = classes; tile.textContent = text; tile.disabled = !canPlay;
      tile.setAttribute('aria-label', `Row ${row}, column ${col}, ${label}`);
  });
  for (const value of ['reveal', 'flag']) {
    const button = document.querySelector(`#mode-${value}`);
    button.classList.toggle('active', mode === value); button.setAttribute('aria-pressed', mode === value);
  }
  document.querySelector('#flags-left').innerHTML = `<strong>${state.mines - state.flags.length}</strong>flags left`;
  document.querySelector('#countdown-mask').hidden = state.phase !== 'countdown';
  document.querySelector('#race-feedback').innerHTML = raceMessage();
  document.querySelector('#result-actions').innerHTML = finished ? `${state.host === me.id ? '<button id="next-lobby" class="button green full">Back to lobby · fresh board</button>' : '<p class="lobby-note">Waiting for the host to open the next lobby.</p>'}<p class="micro-note">MATCH WINS · ${state.players.map(p => `${esc(p.name)} ${p.wins}`).join(' / ')}</p>` : '';
  document.querySelector('#concede').hidden = finished || me.forfeited || me.hit;
  document.querySelector('#concede').disabled = !connected;
  document.querySelector('#leave').hidden = !finished && !me.forfeited && !me.hit;
  const connection = document.querySelector('#connection');
  connection.textContent = connected ? 'Connected' : 'Reconnecting…'; connection.classList.toggle('offline', !connected);
  applyZoom();
  updateMusicControl();
}

function applyZoom() {
  const viewport = document.querySelector('#board-viewport'); if (!viewport) return;
  viewport.className = `board-viewport zoom-${zoom}`;
  document.querySelector('#zoom-label').textContent = ({ fit: 'Fit', normal: '36 px', large: '44 px', xlarge: '52 px' })[zoom];
  document.querySelector('#zoom-out').disabled = zoom === 'fit';
  document.querySelector('#zoom-in').disabled = zoom === 'xlarge';
}
function changeZoom(direction) {
  const viewport = document.querySelector('#board-viewport'); if (!viewport) return;
  const x = (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth;
  const y = (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight;
  const levels = ['fit', 'normal', 'large', 'xlarge'];
  zoom = direction === 'fit' ? 'fit' : levels[Math.max(0, Math.min(3, levels.indexOf(zoom) + direction))];
  applyZoom();
  viewport.scrollLeft = x * viewport.scrollWidth - viewport.clientWidth / 2;
  viewport.scrollTop = y * viewport.scrollHeight - viewport.clientHeight / 2;
}

function updateClock() {
  if (!state || screen !== 'race') return;
  const now = Date.now() + serverOffset;
  const count = document.querySelector('#countdown');
  if (count) count.textContent = Math.max(1, Math.ceil((state.startAt - now) / 1000));
  const clock = document.querySelector('#clock');
  if (clock && state.startAt !== null) {
    const seconds = Math.floor(Math.max(0, (state.endAt ?? now) - state.startAt) / 1000);
    clock.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
}
setInterval(updateClock, 100);

async function enterRoom(kind) {
  if (busy) return;
  const input = document.querySelector('#player-name');
  const name = input?.value.trim();
  if (!name) { input?.focus(); return toast('First, enter your player name.'); }
  const code = document.querySelector('#join-code')?.value.trim().toUpperCase();
  if (kind === 'join' && !/^[A-Z2-9]{6}$/.test(code)) return toast('Enter the six-character room code.');
  storage.set('sweep-name', name); busy = true;
  const buttons = app.querySelectorAll('#create, #show-join, #join-form button');
  buttons.forEach(button => { button.disabled = true; });
  try {
    const result = await api(kind === 'create' ? '' : `/${code}/join`, { name, ...(kind === 'create' ? { difficulty: selectedDifficulty } : {}) });
    activate(result);
  } catch (error) { toast(error.status ? error.message : 'Couldn’t reach the server. Please try again.'); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
}

async function resume() {
  if (!lastStoredSession || busy) return;
  busy = true;
  const saved = { ...lastStoredSession };
  try { const next = await api(`/${saved.code}`, null, saved.token); activate({ token: saved.token, state: next }); }
  catch (error) {
    if ([401, 404].includes(error.status)) { storage.remove('sweep-session'); lastStoredSession = null; renderHome(); }
    toast(error.status ? error.message : 'Couldn’t reconnect. Try again in a moment.');
  } finally { busy = false; }
}

async function copy(text, success) {
  try { await navigator.clipboard.writeText(text); toast(success); }
  catch { window.prompt('Copy this invite:', text); }
}

async function leave() {
  if (!session || busy) return;
  const active = { ...session }; busy = true;
  try {
    await api(`/${active.code}/leave`, {}, active.token);
    storage.remove('sweep-session'); lastStoredSession = null; goHome();
  } catch (error) { toast(error.status ? error.message : 'Couldn’t leave the room. Please try again.'); }
  finally { busy = false; }
}

app.addEventListener('submit', event => { if (event.target.id === 'join-form') { event.preventDefault(); enterRoom('join'); } });
app.addEventListener('input', event => {
  if (event.target.id === 'join-code') event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
});
app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.difficulty) {
    const difficulty = button.dataset.difficulty;
    if (screen === 'home') {
      selectedDifficulty = difficulty; storage.set('sweep-difficulty', difficulty);
      app.querySelectorAll('[data-difficulty]').forEach(b => { b.classList.toggle('chosen', b.dataset.difficulty === difficulty); b.setAttribute('aria-pressed', b.dataset.difficulty === difficulty); });
    } else if (difficulty !== state.difficulty) move('settings', undefined, { difficulty });
    return;
  }
  if (button.dataset.cell !== undefined) {
    music.unlock();
    const index = Number(button.dataset.cell);
    const type = mode === 'flag' ? 'flag' : state.opened.includes(index) ? 'chord' : 'reveal';
    move(type, index); return;
  }
  switch (button.id) {
    case 'create': enterRoom('create'); break;
    case 'show-join': document.querySelector('#join-area').hidden = false; document.querySelector('#join-code').focus(); break;
    case 'resume': resume(); break;
    case 'ready': music.unlock(); move('ready'); break;
    case 'start-race': music.unlock(); move('start'); break;
    case 'music-toggle': music.toggle(); break;
    case 'next-lobby': move('lobby'); break;
    case 'leave': leave(); break;
    case 'concede': if (window.confirm('Concede this race? Your score will no longer count.')) move('forfeit'); break;
    case 'mode-reveal': mode = 'reveal'; renderRace(); break;
    case 'mode-flag': mode = 'flag'; renderRace(); break;
    case 'zoom-in': changeZoom(1); break;
    case 'zoom-out': changeZoom(-1); break;
    case 'zoom-fit': changeZoom('fit'); break;
    case 'copy-code': copy(state.code, 'Invite code copied.'); break;
    case 'share': {
      const url = `${location.origin}/?room=${state.code}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Race me at Minesweeper', text: `Join my Sweep Race. Code: ${state.code}`, url }); }
        catch (error) { if (error.name !== 'AbortError') copy(url, 'Invite link copied.'); }
      } else copy(url, 'Invite link copied.');
      break;
    }
  }
});
app.addEventListener('contextmenu', event => {
  const tile = event.target.closest('[data-cell]');
  if (!tile) return;
  event.preventDefault(); if (!tile.disabled) move('flag', Number(tile.dataset.cell));
});
app.addEventListener('keydown', event => {
  const tile = event.target.closest('[data-cell]');
  if (!tile || tile.disabled) return;
  const index = Number(tile.dataset.cell), row = Math.floor(index / state.columns), col = index % state.columns;
  let next = index;
  if (event.key === 'ArrowLeft' && col > 0) next--;
  else if (event.key === 'ArrowRight' && col < state.columns - 1) next++;
  else if (event.key === 'ArrowUp' && row > 0) next -= state.columns;
  else if (event.key === 'ArrowDown' && row < state.rows - 1) next += state.columns;
  else if (event.key.toLowerCase() === 'f') { event.preventDefault(); move('flag', index); return; }
  else return;
  event.preventDefault(); app.querySelector(`[data-cell="${next}"]`)?.focus();
});

for (const id of ['help', 'nav-rules']) document.getElementById(id).addEventListener('click', () => rules.showModal());
for (const id of ['close-rules', 'got-it']) document.getElementById(id).addEventListener('click', () => rules.close());
document.querySelector('#nav-play').addEventListener('click', () => {
  if (screen === 'home') return;
  if (['playing', 'countdown'].includes(state?.phase)) return toast('Finish or concede your race to leave the board.');
  leave();
});
document.addEventListener('visibilitychange', () => {
  // iOS suspends hidden tabs. Resume by fetching the authoritative server state.
  generation++; clearTimeout(pollTimer);
  music.update({ phase: 'paused', visible: false, connected: false });
  if (!document.hidden && session) poll(generation);
});
window.addEventListener('pageshow', event => {
  if (event.persisted && session) { generation++; clearTimeout(pollTimer); poll(generation); }
});
window.addEventListener('online', () => { if (session) { generation++; clearTimeout(pollTimer); poll(generation); } });
window.addEventListener('offline', () => { if (session) { connected = false; renderKey = ''; renderRace(); } });
window.addEventListener('pagehide', () => music.update({ phase: 'paused', visible: false, connected: false }));

renderHome();
if (lastStoredSession && (!invite || lastStoredSession.code === invite)) resume();
