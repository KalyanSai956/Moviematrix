/* On-screen QWERTY keyboard for the new games. Uses the same markup and class
   names as the crossword keyboard so it inherits the existing look and the
   existing responsive rules (e.g. hidden on desktop with a real keyboard). */
const KEY_ROWS = [
  { keys: 'QWERTYUIOP' },
  { keys: 'ASDFGHJKL', pad: 0.5 },
  { keys: 'ZXCVBNM', pad: 1, back: true },
];

export default function LetterKeyboard({ onKey, onBackspace, disabled = false, keyStates = {} }) {
  return (
    <div className="virtual-keyboard" aria-label="On-screen keyboard">
      {KEY_ROWS.map((row) => (
        <div className="kb-row" key={row.keys}>
          {row.pad && <span className="kb-gap" style={{ flexGrow: row.pad }} />}
          {row.keys.split('').map((key) => (
            <button
              type="button"
              key={key}
              className={keyStates[key] ? `key-${keyStates[key]}` : undefined}
              onClick={() => onKey(key)}
              disabled={disabled || Boolean(keyStates[key])}
              aria-label={keyStates[key] ? `${key}, ${keyStates[key] === 'hit' ? 'in the title' : 'not in the title'}` : key}
            >
              {key}
            </button>
          ))}
          {row.back && onBackspace && (
            <button type="button" className="key-wide" aria-label="Backspace" onClick={onBackspace} disabled={disabled}>⌫</button>
          )}
          {row.pad && !(row.back && onBackspace) && <span className="kb-gap" style={{ flexGrow: row.pad }} />}
        </div>
      ))}
    </div>
  );
}
