import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CalendarDays, CheckCircle2, CircleAlert, Clapperboard, Gamepad2, LogOut, RefreshCw, ShieldCheck, Trophy, Users } from 'lucide-react';
import './admin.css';

function defaultDates() {
  const today = new Date();
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return { from: start.toISOString().slice(0, 10), to };
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed. Please try again.');
  return body;
}

function Metric({ icon: Icon, label, value, note }) {
  return <article className="admin-metric"><div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon"><Icon size={18}/></span></div><strong>{value}</strong><small>{note}</small></article>;
}

function SignIn({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); onLogin(username); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="admin-login-wrap"><form className="admin-login" onSubmit={submit}><div className="admin-logo"><Clapperboard size={22}/></div><p className="admin-eyebrow">MOVIEMATRIX / PRIVATE AREA</p><h1>Admin sign in</h1><p className="admin-subtitle">Sign in to view consent-based product analytics.</p><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required maxLength={200}/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={1000}/></label>{error && <p className="admin-error" role="alert"><CircleAlert size={16}/>{error}</p>}<button className="admin-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button><p className="admin-footnote"><ShieldCheck size={14}/> Protected by a server-side session. Analytics keys never reach this page.</p></form></main>;
}

function MiniBars({ daily }) {
  const max = Math.max(1, ...daily.map(day => day.started));
  if (!daily.length) return <div className="admin-empty">No events in this period.</div>;
  return <div className="admin-bars" aria-label="Games started per day">{daily.map(day => <div className="admin-bar-column" key={day.date} title={`${day.date}: ${day.started} games started`}><span className="admin-bar-value">{day.started}</span><div className="admin-bar-track"><span style={{ height: `${Math.max(day.started ? 5 : 0, day.started / max * 100)}%` }}/></div><small>{day.date.slice(5)}</small></div>)}</div>;
}

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [dates, setDates] = useState(defaultDates);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/session').then(result => { setAuthenticated(result.authenticated); setConfigured(result.configured); }).catch(() => setConfigured(false)).finally(() => setChecking(false));
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ from: dates.from, to: dates.to });
      setData(await api(`/api/admin/analytics?${params.toString()}`));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [dates]);

  useEffect(() => { if (authenticated) loadAnalytics(); }, [authenticated, loadAnalytics]);

  async function logout() {
    try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } finally { setAuthenticated(false); setData(null); }
  }

  const totals = data?.totals || { started: 0, completed: 0, wins: 0, losses: 0 };
  const dailyUsers = data?.daily?.reduce((sum, day) => sum + day.users, 0) || 0;
  const completion = totals.started ? Math.round(totals.completed / totals.started * 100) : 0;
  const winRate = totals.completed ? Math.round(totals.wins / totals.completed * 100) : 0;
  const rows = useMemo(() => [...(data?.games || [])].sort((a, b) => b.started - a.started), [data]);

  if (checking) return <main className="admin-login-wrap"><p className="admin-muted">Checking admin session…</p></main>;
  if (!authenticated) return <><SignIn onLogin={name => { setUsername(name); setAuthenticated(true); }}/> {!configured && <p className="admin-config-warning">Admin authentication is not configured yet. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET in Vercel server-side environment variables.</p>}</>;

  return <main className="admin-shell"><header className="admin-header"><a className="admin-brand" href="/"><span className="admin-logo"><Clapperboard size={20}/></span><span>MovieMatrix<small>ADMIN CONSOLE</small></span></a><div className="admin-header-actions"><span className="admin-secure"><ShieldCheck size={15}/> Private session</span><button className="admin-ghost" onClick={logout}><LogOut size={15}/> Sign out</button></div></header><section className="admin-welcome"><div><p className="admin-eyebrow">OVERVIEW / ANALYTICS</p><h1>Good to see you{username ? `, ${username}` : ''}.</h1><p>Understand how players discover and complete the daily MovieMatrix challenge.</p></div><div className="admin-date-filter"><label><CalendarDays size={15}/> From<input type="date" value={dates.from} max={dates.to} onChange={e => setDates(old => ({ ...old, from: e.target.value }))}/></label><label>To<input type="date" value={dates.to} min={dates.from} max={defaultDates().to} onChange={e => setDates(old => ({ ...old, to: e.target.value }))}/></label><button className="admin-primary admin-refresh" onClick={loadAnalytics} disabled={loading}><RefreshCw size={15} className={loading ? 'admin-spin' : ''}/> Refresh</button></div></section>
    {error && <div className="admin-alert" role="alert"><CircleAlert size={18}/><div><strong>Analytics unavailable</strong><p>{error}</p><button onClick={loadAnalytics}>Try again</button></div></div>}
    <div className="admin-source-note"><Activity size={15}/> Live data from PostHog · Only events recorded under the existing analytics consent policy are included.</div>
    <section className="admin-metrics"><Metric icon={Users} label="Daily users summed" value={loading && !data ? '—' : dailyUsers.toLocaleString()} note="Sum of daily unique visitors; not cross-day unique people"/><Metric icon={Gamepad2} label="Games started" value={totals.started.toLocaleString()} note="Tracked game-start events"/><Metric icon={CheckCircle2} label="Games completed" value={totals.completed.toLocaleString()} note={`${completion}% of starts in selected period`}/><Metric icon={Trophy} label="Win rate" value={`${winRate}%`} note={`${totals.wins} wins · ${totals.losses} losses`}/></section>
    <section className="admin-content-grid"><article className="admin-panel admin-chart-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">ACTIVITY</p><h2>Games started each day</h2></div><span className="admin-panel-icon"><BarChart3 size={19}/></span></div><MiniBars daily={data?.daily || []}/></article><article className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">GAME MIX</p><h2>Performance by game</h2></div><Gamepad2 size={19}/></div>{rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Game</th><th>Started</th><th>Completed</th><th>Wins</th></tr></thead><tbody>{rows.map(row => <tr key={row.type}><td>{row.type.replaceAll('_', ' ')}</td><td>{row.started}</td><td>{row.completed}</td><td>{row.wins}</td></tr>)}</tbody></table></div> : <div className="admin-empty">No game events received for this period.</div>}<p className="admin-table-note">New game types appear when their start and result events include a <code>game_type</code> property or use the documented event names.</p></article></section>
    <section className="admin-panel admin-daily-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">DAILY BREAKDOWN</p><h2>Recent activity</h2></div><span className="admin-date-range">{dates.from} — {dates.to}</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Daily users</th><th>Started</th><th>Completed</th><th>Wins</th><th>Losses</th></tr></thead><tbody>{(data?.daily || []).slice().reverse().map(day => <tr key={day.date}><td>{day.date}</td><td>{day.users}</td><td>{day.started}</td><td>{day.completed}</td><td>{day.wins}</td><td>{day.losses}</td></tr>)}</tbody></table></div>{!data?.daily?.length && !loading && <div className="admin-empty">No analytics rows found. Confirm that consented events are reaching the selected PostHog project.</div>}</section>
    <footer className="admin-footer"><span>MovieMatrix · Private analytics</span><a href="/">Return to game <span aria-hidden="true">↗</span></a></footer></main>;
}
