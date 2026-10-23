export default function Stats({ stats }) {
  const items = [
    ['Played', stats.played], ['Win %', `${stats.winPercent}%`],
    ['Current streak', stats.currentStreak], ['Max streak', stats.maxStreak]
  ];
  return <div className="stats-grid">{items.map(([label, value]) => <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}
