export function formatDuration(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function shareDaily(run, attempts, origin) {
  const cleared = run.outcome === 'cleared';
  const lines = [
    `💣 Sweep Race Daily · ${run.date}`,
    cleared ? `✅ Cleared in ${formatDuration(run.endAt - run.startAt)}` : `💥 ${run.revealed}/256 tiles revealed (safe tiles only).`,
    'Medium · 16×16 · 40 mines',
    `Attempt #${run.attempt} · ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'} today`,
  ];
  if (attempts > 1) lines.push([
    'One try was apparently beneath me.',
    'Just needed a few rehearsals for all that natural talent.',
    'The mines and I are in a committed, deeply unhealthy relationship.',
  ][(attempts - 2) % 3]);
  lines.push(`${origin}/?daily=1`);
  return lines.join('\n');
}

export class DailyJournal {
  constructor(storage) { this.storage = storage; }
  read(date) {
    try {
      const record = JSON.parse(this.storage.get(`sweep-daily:${date}`));
      if (record && Number.isInteger(record.attempts) && record.attempts >= 0 && record.runs) return record;
    } catch {}
    return { attempts: 0, latest: 0, runs: {} };
  }
  save(date, record) { this.storage.set(`sweep-daily:${date}`, JSON.stringify(record)); }
  start(state, token) {
    const record = this.read(state.date), attempt = record.attempts + 1;
    record.attempts = attempt; record.latest = attempt;
    record.runs[attempt] = { date: state.date, attempt, session: { code: state.code, token }, outcome: 'playing', startAt: state.startAt, endAt: null, revealed: 0 };
    this.save(state.date, record); return attempt;
  }
  update(state, attempt) {
    const record = this.read(state.date), run = record.runs[attempt];
    if (!run) return;
    Object.assign(run, { revealed: state.opened.length, startAt: state.startAt, endAt: state.endAt, outcome: state.phase === 'finished' ? state.reason : 'playing' });
    this.save(state.date, record);
  }
  interrupt(date, attempt, now) {
    const record = this.read(date), run = record.runs[attempt];
    if (run?.outcome === 'playing') { run.outcome = 'interrupted'; run.endAt = now; run.session = null; this.save(date, record); }
  }
}
