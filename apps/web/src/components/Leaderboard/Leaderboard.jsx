import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../../api/leaderboard.js';
import { useAuth } from '../../hooks/useAuth.js';
import './Leaderboard.css';

const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const RANK_CHANGE_LABEL = {
  up: '▲',
  down: '▼',
  same: '–',
  new: 'NEW',
};

function RankChange({ rankChange }) {
  if (!rankChange) return null;
  return (
    <span className={`leaderboard__rank-change leaderboard__rank-change--${rankChange}`}>
      {RANK_CHANGE_LABEL[rankChange]}
    </span>
  );
}

export function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('weekly');
  // One atomic result object, only ever set from inside the fetch's
  // then/catch — never synchronously in the effect body. `loading` is
  // derived from whether the last-settled result is for the currently
  // selected period, rather than tracked as its own state.
  const [result, setResult] = useState({ period: null, board: null, error: null });

  useEffect(() => {
    let cancelled = false;

    fetchLeaderboard({ period })
      .then((data) => {
        if (!cancelled) setResult({ period, board: data, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ period, board: null, error: 'Could not load the leaderboard.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const loading = result.period !== period;
  const board = loading ? null : result.board;
  const error = loading ? null : result.error;

  return (
    <div className="leaderboard">
      <div className="leaderboard__tabs" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={period === p.value}
            className={
              period === p.value ? 'leaderboard__tab leaderboard__tab--active' : 'leaderboard__tab'
            }
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p className="leaderboard__status">Loading…</p>}
      {error && <p className="leaderboard__status">{error}</p>}
      {!loading && !error && board?.standings.length === 0 && (
        <p className="leaderboard__status">
          No runs yet this {period === 'weekly' ? 'week' : 'month'}.
        </p>
      )}

      {!loading && !error && board?.standings.length > 0 && (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>Rank</th>
              <th></th>
              <th>Name</th>
              <th>Best score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {board.standings.map((entry) => (
              <tr
                key={entry.userId}
                className={
                  entry.userId === user?.id
                    ? 'leaderboard__row leaderboard__row--highlighted'
                    : 'leaderboard__row'
                }
              >
                <td className="leaderboard__rank">{entry.rank}</td>
                <td>
                  <img className="leaderboard__avatar" src={entry.avatarUrl} alt="" />
                </td>
                <td className="leaderboard__name">{entry.displayName}</td>
                <td className="leaderboard__score">{entry.bestScore}</td>
                <td>
                  <RankChange rankChange={entry.rankChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
