const CONTENT = {
  crossword: {
    title: "One grid. One shot.",
    steps: [
      "Use the Across and Down clues to fill the crossword.",
      "Select a cell and type, or use the on-screen keyboard.",
      "Make sure every answer is filled before submitting.",
      "You get one complete submission per daily puzzle. Any wrong answer ends today's attempt.",
      "A new puzzle arrives at midnight India time.",
    ],
  },
  bgm: {
    title: "Name that tune.",
    steps: [
      "Press Play and listen to the background music. Nothing plays automatically.",
      "Work out which movie it comes from.",
      "Type the title into the boxes, or use the on-screen keyboard. One box per letter; spaces and capitals don't matter.",
      "Fill every box before submitting. You get one submission per daily puzzle.",
      "A new puzzle arrives at midnight India time.",
    ],
  },
  hangman: {
    title: "Five misses. One title.",
    steps: [
      "Guess one letter at a time, with the on-screen keyboard or your keyboard.",
      "Every matching letter is revealed everywhere it appears.",
      "Each letter that is not in the title costs one of your five guesses. Repeats and invalid keys are free.",
      "Reveal the whole title to win. Miss five times and the hint and answer appear.",
      "A new puzzle arrives at midnight India time.",
    ],
  },
};

export default function Rules({ onClose, gameType = "crossword" }) {
  const { title, steps } = CONTENT[gameType] || CONTENT.crossword;
  return <div className="modal-backdrop" role="presentation"><section className="rules modal" role="dialog" aria-modal="true" aria-labelledby="rules-title"><button className="icon-button modal-close" onClick={onClose} aria-label="Close rules">×</button><p className="eyebrow">HOW TO PLAY</p><h2 id="rules-title">{title}</h2><ol>{steps.map((step) => <li key={step}>{step}</li>)}</ol><button className="primary-button full" onClick={onClose}>Let's play</button></section></div>;
}
