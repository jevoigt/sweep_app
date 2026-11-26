/* Plain browser JavaScript. No build step, framework, or third-party scripts. */
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
let invite = new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) || '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing can restrict storage. */ } },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};
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

function move(type, index) {
  if (!session || !state) return;
  if (!connected) return toast('Reconnecting. Your board will resume when connected.');
  const active = { ...session }, round = state.round, epoch = generation;
  pending = pending.catch(() => {}).then(async () => {
    if (epoch !== generation || state?.round !== round) return;
    try {
      const next = await api(`/${active.code}/actions`, { type, index, round }, active.token);
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
  app.innerHTML = `
    <section class="hero" aria-labelledby="home-title">
      <img src="/field.svg" alt="A green Minesweeper field beneath a flag in a mountain landscape">
      <div class="hero-copy"><div class="eyebrow">THE TWO-PLAYER MINESWEEPER CLUB</div>
        <h1 id="home-title">One board.<br>Two rivals.</h1><p>A little nerve. A little logic.<br>A race against your favorite person.</p></div>
      <div class="hero-chip"><span aria-hidden="true">⚑</span><div><small>THE CHALLENGE</small><strong>81 tiles. 12 mines. Just you two.</strong></div></div>
    </section>
    <section class="section">
      <div class="name-row"><label class="field-label" for="player-name">What should we call you?</label>
        <input class="name-input" id="player-name" placeholder="Your name" maxlength="20" autocomplete="nickname" value="${esc(storage.get('sweep-name') || '')}"></div>
      <div class="button-row">
        <button id="create" class="button green"><span class="button-icon" aria-hidden="true">⚑</span><span class="button-copy">Create race<small>Invite a friend</small></span></button>
        <button id="show-join" class="button blue"><span class="button-icon" aria-hidden="true">♧</span><span class="button-copy">Join race<small>Enter a room code</small></span></button>
      </div>
      <p class="micro-note">FREE TO PLAY · NO ACCOUNT NEEDED</p>
      <div class="join-area" id="join-area" ${invite ? '' : 'hidden'}>
        <label class="field-label" for="join-code">Your friend’s six-character invite code</label>
        <form class="join-form" id="join-form"><input id="join-code" class="code-input" maxlength="6" minlength="6" placeholder="ABC234" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Invite code" value="${esc(invite)}" required><button class="button blue" type="submit">Join</button></form>
      </div>
      ${lastStoredSession ? `<div class="resume-box">Have an unfinished rivalry?<button id="resume">Return to room ${esc(lastStoredSession.code)}</button></div>` : ''}
      <div class="mini-row"><div class="mini-card"><span class="mini-icon" aria-hidden="true">▦</span><div><strong>Identical boards</strong><small>A fair start, every time</small></div></div>
        <div class="mini-card"><span class="mini-icon" aria-hidden="true">◷</span><div><strong>Live rivalry</strong><small>Watch their progress</small></div></div></div>
    </section>`;
}

function goHome() {
  generation++; clearTimeout(pollTimer); session = null; state = null; renderKey = ''; invite = '';
  history.replaceState(null, '', '/'); renderHome();
}

function you() { return state.players.find(p => p.id === state.you); }
function opponent() { return state.players.find(p => p.id !== state.you); }

function renderRace() {
  if (!state || screen !== 'race') return;
  const key = [state.code, state.revision, mode, connected, ...state.players.map(p => p.online)].join(':');
  if (key === renderKey) return;
  renderKey = key;
  const focusIndex = document.activeElement?.dataset?.cell;
  if (state.phase === 'lobby') renderLobby(); else renderBoard();
  if (focusIndex !== undefined) app.querySelector(`[data-cell="${focusIndex}"]`)?.focus({ preventScroll: true });
  updateClock();
}

function renderLobby() {
  const me = you(), rival = opponent();
  app.innerHTML = `<section class="room-heading"><div class="eyebrow">YOUR PRIVATE FIELD</div><h1>Bring a little competition.</h1><p>Send your friend the code.<br>Same board. Same start. Best sweeper wins.</p></section>
    <section class="invite-card"><div class="eyebrow">INVITE CODE</div><div class="invite-code">${esc(state.code)}</div>
      <div class="invite-buttons"><button id="copy-code" class="button light">Copy code</button><button id="share" class="button light">Share invite</button></div></section>
    <div class="players">${state.players.map(p => `<div class="player-card"><div class="avatar ${p.id === me.id ? '' : 'rival'}">${esc(p.name[0].toUpperCase())}</div><div class="player-info"><strong>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</strong><small>${p.online ? 'In the clubhouse' : 'Reconnecting…'}</small></div><span class="player-status ${p.ready ? 'ready' : ''}">${p.ready ? '✓ Ready' : 'Not ready'}</span></div>`).join('')}
    ${!rival ? '<div class="player-card"><div class="avatar rival">?</div><div class="player-info"><strong>A spot for your rival</strong><small>Waiting for them to join…</small></div></div>' : ''}</div>
    <div class="section"><button id="ready" class="button green full" ${!rival || !connected ? 'disabled' : ''}>${me.ready ? 'Ready ✓ · tap to cancel' : rival ? 'I’m ready. Let’s race.' : 'Waiting for your friend…'}</button>
      <p class="lobby-note">Once you’re both ready, a three-second countdown starts the race.</p>
      <div class="race-footer"><button id="leave" class="text-button">Leave room</button><span class="connection ${connected ? '' : 'offline'}">${connected ? 'Connected' : 'Reconnecting…'}</span></div></div>`;
}

function raceMessage() {
  const me = you(), rival = opponent();
  if (state.phase === 'finished') {
    const winner = state.players.find(p => p.id === state.winner);
    const title = !winner ? 'An even match.' : winner.id === me.id ? 'This field is yours.' : `${esc(winner.name)} takes the field.`;
    const details = {
      cleared: 'All safe tiles cleared. That’s a clean sweep.',
      passed: 'The surviving player passed the frozen score.',
      'both-mines': 'Both hit mines. The safe-tile count decided it.',
      forfeit: 'The other player conceded the race.',
    };
    return `<div class="race-message result" role="status"><strong>${title}</strong>${details[state.reason] || ''} ${!winner ? 'Same score, shared honors.' : ''}</div>`;
  }
  if (state.phase === 'countdown') return '<div class="race-message"><strong>A fair start.</strong>Your identical safe opening will reveal when the countdown ends.</div>';
  if (me.hit) return `<div class="race-message warning" role="status"><strong>You hit a mine.</strong>Your score is frozen at ${me.revealed}. ${esc(rival.name)} needs ${me.revealed + 1} safe tiles to win.</div>`;
  if (rival.hit) return `<div class="race-message warning" role="status"><strong>Your rival hit a mine.</strong>Reveal ${Math.max(0, rival.revealed + 1 - me.revealed)} more safe ${rival.revealed - me.revealed === 0 ? 'tile' : 'tiles'} to win. Keep your nerve.</div>`;
  return '<div class="race-message"><strong>Every safe tile counts.</strong>Clear the board first to win. If you hit a mine, your rival gets a chance to beat your score.</div>';
}

function renderBoard() {
  const me = you(), finished = state.phase === 'finished';
  const canPlay = state.phase === 'playing' && !me.hit && connected;
  const opened = new Set(state.opened);
  app.innerHTML = `<div class="status-strip"><span class="room-id">${esc(state.code)} · ROUND ${state.round}</span><span class="timer" id="clock">00:00</span></div>
    <section class="scoreboard" aria-label="Live scores">${state.players.map(p => `<div class="score-card ${p.id === me.id ? '' : 'rival'}"><div class="score-name"><strong>${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</strong><span class="score-tag">${p.hit ? 'MINE' : p.online ? 'LIVE' : 'AWAY'}</span></div><div class="score-count">${p.revealed}<small> / ${state.safe} safe</small></div><progress max="${state.safe}" value="${p.revealed}" aria-label="${esc(p.name)}: ${p.revealed} of ${state.safe} safe tiles"></progress></div>`).join('')}</section>
    <div class="board-wrap"><div class="board" role="group" aria-label="Your Minesweeper board. Arrow keys move focus; Enter reveals; F flags.">${state.board.map((value, i) => {
      const isOpen = opened.has(i), flagged = state.flags.includes(i);
      const classes = ['tile', isOpen ? `open n${value}` : '', value === -1 ? 'mine' : '', i === state.hit ? 'exploded' : '', flagged && !isOpen && value !== -1 ? 'flag' : ''].filter(Boolean).join(' ');
      const row = Math.floor(i / state.size) + 1, col = i % state.size + 1;
      const label = isOpen ? value ? `${value} adjacent mines` : 'empty' : value === -1 ? 'mine' : flagged ? 'flagged' : 'covered';
      const text = value === -1 ? '✹' : flagged && !isOpen ? '⚑' : isOpen || finished ? value > 0 ? value : '' : '';
      return `<button class="${classes}" data-cell="${i}" aria-label="Row ${row}, column ${col}, ${label}" ${canPlay ? '' : 'disabled'}>${text}</button>`;
    }).join('')}</div>${state.phase === 'countdown' ? '<div class="board-mask"><small>GET READY</small><strong id="countdown">3</strong><small>SAME BOARD. SAME START.</small></div>' : ''}</div>
    <div class="move-tools"><div class="segmented" role="group" aria-label="Tile action"><button id="mode-reveal" class="mode-button ${mode === 'reveal' ? 'active' : ''}" aria-pressed="${mode === 'reveal'}">▦ Reveal</button><button id="mode-flag" class="mode-button ${mode === 'flag' ? 'active' : ''}" aria-pressed="${mode === 'flag'}">⚑ Flag</button></div><span class="mines-left"><strong>${state.mines - state.flags.length}</strong>flags left</span></div>
    ${raceMessage()}
    ${finished ? `<div class="result-actions"><button id="rematch" class="button green full" ${me.rematch || !connected ? 'disabled' : ''}>${me.rematch ? 'Waiting for your rival…' : opponent().rematch ? 'Your rival wants a rematch. Play again?' : 'Same rival. Fresh board.'}</button><p class="micro-note">MATCH WINS · ${state.players.map(p => `${esc(p.name)} ${p.wins}`).join(' / ')}</p></div>` : ''}
    <div class="race-footer"><button id="${finished ? 'leave' : 'concede'}" class="text-button" ${state.phase === 'countdown' ? 'disabled' : ''}>${finished ? 'Back to clubhouse' : 'Concede race'}</button><span class="connection ${connected ? '' : 'offline'}">${connected ? 'Connected' : 'Reconnecting…'}</span></div>`;
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
    const result = await api(kind === 'create' ? '' : `/${code}/join`, { name });
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

app.addEventListener('submit', event => { if (event.target.id === 'join-form') { event.preventDefault(); enterRoom('join'); } });
app.addEventListener('input', event => {
  if (event.target.id === 'join-code') event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
});
app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.cell !== undefined) {
    const index = Number(button.dataset.cell);
    const type = mode === 'flag' ? 'flag' : state.opened.includes(index) ? 'chord' : 'reveal';
    move(type, index); return;
  }
  switch (button.id) {
    case 'create': enterRoom('create'); break;
    case 'show-join': document.querySelector('#join-area').hidden = false; document.querySelector('#join-code').focus(); break;
    case 'resume': resume(); break;
    case 'ready': move('ready'); break;
    case 'rematch': move('rematch'); break;
    case 'leave': goHome(); break;
    case 'concede': if (window.confirm('Concede this race? Your rival will win.')) move('forfeit'); break;
    case 'mode-reveal': mode = 'reveal'; renderRace(); break;
    case 'mode-flag': mode = 'flag'; renderRace(); break;
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
  const index = Number(tile.dataset.cell), row = Math.floor(index / 9), col = index % 9;
  let next = index;
  if (event.key === 'ArrowLeft' && col > 0) next--;
  else if (event.key === 'ArrowRight' && col < 8) next++;
  else if (event.key === 'ArrowUp' && row > 0) next -= 9;
  else if (event.key === 'ArrowDown' && row < 8) next += 9;
  else if (event.key.toLowerCase() === 'f') { event.preventDefault(); move('flag', index); return; }
  else return;
  event.preventDefault(); app.querySelector(`[data-cell="${next}"]`)?.focus();
});

for (const id of ['help', 'nav-rules']) document.getElementById(id).addEventListener('click', () => rules.showModal());
for (const id of ['close-rules', 'got-it']) document.getElementById(id).addEventListener('click', () => rules.close());
document.querySelector('#nav-play').addEventListener('click', () => {
  if (screen === 'home') return;
  if (['playing', 'countdown'].includes(state?.phase)) return toast('Finish or concede your race to leave the board.');
  goHome();
});
document.addEventListener('visibilitychange', () => {
  // iOS suspends hidden tabs. Resume by fetching the authoritative server state.
  generation++; clearTimeout(pollTimer);
  if (!document.hidden && session) poll(generation);
});
window.addEventListener('pageshow', event => {
  if (event.persisted && session) { generation++; clearTimeout(pollTimer); poll(generation); }
});
window.addEventListener('online', () => { if (session) { generation++; clearTimeout(pollTimer); poll(generation); } });
window.addEventListener('offline', () => { if (session) { connected = false; renderKey = ''; renderRace(); } });

renderHome();
if (lastStoredSession && (!invite || lastStoredSession.code === invite)) resume();
