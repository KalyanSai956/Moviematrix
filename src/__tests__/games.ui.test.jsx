// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BgmGuess from '../features/bgm/BgmGuess.jsx';
import Hangman from '../features/hangman/Hangman.jsx';

const press = (...keys) => keys.forEach((key) => fireEvent.keyDown(window, { key }));

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  localStorage.clear();
});
afterEach(cleanup);

describe('BGM Movie Guess component', () => {
  const puzzle = { date: '2026-10-23', puzzleNumber: 2, gameType: 'bgm', answer: 'DJ Tillu', audio: '/audio/bgm/2026-10-23.mp3' };
  const setup = () => {
    const onSubmit = vi.fn();
    const utils = render(<BgmGuess puzzle={puzzle} onSubmit={onSubmit} onContinue={() => {}} />);
    return { onSubmit, ...utils };
  };

  it('uses the configured audio path, does not autoplay, and shows one box per letter', () => {
    const { container } = setup();
    expect(screen.getByTestId('bgm-audio').getAttribute('src')).toBe('/audio/bgm/2026-10-23.mp3');
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /^Letter \d+ of 7/ })).toHaveLength(7);
    expect(container.querySelectorAll('.mm-word')).toHaveLength(2);
  });

  it('toggles Play / Pause', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play music' }));
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    fireEvent.play(screen.getByTestId('bgm-audio'));
    expect(screen.getByRole('button', { name: 'Pause music' })).toBeTruthy();
  });

  it('rejects empty and incomplete submissions', () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('status').textContent).toMatch(/Enter the movie title/);
    press('D', 'J');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('status').textContent).toMatch(/Fill every letter box/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('records a win for a correct answer (case-insensitive) and stops the audio', () => {
    const { onSubmit } = setup();
    press('d', 'j', 't', 'i', 'l', 'l', 'u');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ won: true, score: 1, total: 1, gameType: 'bgm' });
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'See results' })).toBeTruthy();
  });

  it('records a loss for a wrong answer and only submits once', () => {
    const { onSubmit } = setup();
    press('D', 'J', 'T', 'I', 'L', 'L', 'Y');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit.mock.calls[0][0].won).toBe(false);
    press('A');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a configuration error naming the expected asset path when the clip fails to load', () => {
    setup();
    fireEvent.error(screen.getByTestId('bgm-audio'));
    expect(screen.getByRole('alert').textContent).toContain('public/audio/bgm/2026-10-23.mp3');
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
  });

  it('releases the audio on unmount', () => {
    const { unmount } = setup();
    window.HTMLMediaElement.prototype.pause.mockClear();
    unmount();
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(window.HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });
});

describe('Hangman component', () => {
  const puzzle = { date: '2026-10-24', puzzleNumber: 3, gameType: 'hangman', answer: 'Eega', hint: 'A housefly takes revenge' };
  const setup = (p = puzzle) => {
    const onSubmit = vi.fn();
    const utils = render(<Hangman puzzle={p} onSubmit={onSubmit} onContinue={() => {}} />);
    return { onSubmit, ...utils };
  };
  const remaining = () => screen.getByTestId('remaining').textContent;

  it('starts with hidden letters, five guesses and no hint or answer', () => {
    const { container } = setup();
    expect(remaining()).toBe('5');
    expect(container.querySelectorAll('.mm-box.hidden')).toHaveLength(4);
    expect(screen.queryByTestId('hint')).toBeNull();
    expect(container.textContent.includes('Eega') || container.textContent.includes('EEGA')).toBe(false);
  });

  it('reveals every occurrence of a correct letter without costing a guess', () => {
    const { container } = setup();
    press('e');
    expect(container.querySelectorAll('.mm-box.revealed')).toHaveLength(2);
    expect(remaining()).toBe('5');
  });

  it('costs one guess per wrong letter and says so', () => {
    setup();
    press('q');
    expect(remaining()).toBe('4');
    expect(screen.getByRole('status').textContent).toMatch(/No letter in the word/);
  });

  it('does not charge for repeated or invalid input', () => {
    setup();
    press('q', 'q');
    expect(remaining()).toBe('4');
    expect(screen.getByRole('status').textContent).toMatch(/already tried/);
    press('7');
    expect(remaining()).toBe('4');
    expect(screen.getByRole('status').textContent).toMatch(/Only the letters/);
  });

  it('keeps the hint hidden through four misses, then shows hint and answer on the fifth and locks', () => {
    const { onSubmit, container } = setup();
    press('q', 'x', 'z', 'w');
    expect(screen.queryByTestId('hint')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    press('j');
    expect(screen.getByTestId('hint').textContent).toContain('A housefly takes revenge');
    expect(container.querySelectorAll('.mm-box.missed').length + container.querySelectorAll('.mm-box.revealed').length).toBe(4);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ won: false, score: 0, gameType: 'hangman', wrongGuesses: 5 });
    press('e', 'k');
    expect(remaining()).toBe('0');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('finishes as a win without showing the hint when the word is solved', () => {
    const { onSubmit } = setup();
    press('e', 'g', 'a');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ won: true, score: 1, wrongGuesses: 0 });
    expect(screen.queryByTestId('hint')).toBeNull();
  });

  it('keeps guesses across a reload so the five chances cannot be reset', () => {
    const first = setup();
    press('q', 'x');
    first.unmount();
    setup();
    expect(remaining()).toBe('3');
  });
});
