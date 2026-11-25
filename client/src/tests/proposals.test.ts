import { describe, it, expect } from 'vitest';
import { extractProposals, visibleText } from '../utils/proposals';

const TWO = `Okay, turning them off.\n\n<proposal tool="jam" params='{"action":"stop"}' reason="Stopping music" />\n<proposal tool="soundscape" params='{"action":"stop"}' reason="Stopping soundscape" />\nSo what now?`;

describe('proposal tags in replies', () => {
  it('two tags in one reply: both become chips, neither shows as text', () => {
    const r = extractProposals(TWO);
    expect(r.proposals.map(p => p.tool)).toEqual(['jam', 'soundscape']);
    expect(r.proposals[1].params).toEqual({ action: 'stop' });
    expect(r.cleanText).not.toMatch(/proposal/);
    expect(r.cleanText).toBe('Okay, turning them off.\n\nSo what now?');
  });
  it('different attribute order, double quotes, no space before />', () => {
    const r = extractProposals(`Hi <proposal reason="Focus" tool="pomodoro" params="{&quot;focus&quot;:25}"/> there`);
    expect(r.proposals[0]).toEqual({ tool: 'pomodoro', params: { focus: 25 }, reason: 'Focus' });
    expect(r.cleanText).toBe('Hi  there');
  });
  it('a broken tag is hidden, not shown raw', () => {
    const r = extractProposals(`Sure <proposal tool="jam" params='{oops' reason="x" /> ok`);
    expect(r.proposals).toEqual([]);
    expect(r.cleanText).not.toMatch(/proposal/);
  });
  it('a half-arrived tag is hidden while streaming and when cut off', () => {
    expect(extractProposals(`Playing <propo`, true).cleanText).toBe('Playing');
    expect(extractProposals(`Playing <proposal tool="jam" params='{"q":`, true).cleanText).toBe('Playing');
    expect(extractProposals(`Playing <proposal tool="jam" params='{"q":`).cleanText).toBe('Playing');
  });
  it('copy/reply text has no tags', () => {
    expect(visibleText(TWO)).not.toMatch(/</);
  });
});

describe('what a tool button does', async () => {
  const { isStopAction, soundscapeConfig, proposalLabel } = await import('../utils/proposals');
  it('"stop the music / sounds" is a stop, not an open', () => {
    expect(isStopAction('jam', { action: 'stop' })).toBe(true);
    expect(isStopAction('soundscape', { action: 'Stop' })).toBe(true);
    expect(isStopAction('jam', { query: 'lofi' })).toBe(false);
    expect(isStopAction('pomodoro', { action: 'stop' })).toBe(false); // the timer handles its own stop
    expect(proposalLabel({ tool: 'jam', params: { action: 'stop' }, reason: '' })).toBe('Stop music');
    expect(proposalLabel({ tool: 'soundscape', params: { mix: { rain: 0.5 } }, reason: '' })).toBe('Play sounds');
  });
  it('soundscape mix from Aastha becomes the widget preset + volume', () => {
    expect(soundscapeConfig({ mix: { rain: 0.8, thunder: 0.3, master: 0.9 } })).toEqual({ preset: 'rain:0.8,thunder:0.3', volume: 0.9 });
    expect(soundscapeConfig({ preset: 'random' })).toEqual({ preset: 'random' });
    expect(soundscapeConfig({ mix: { rain: 4, master: -1 } })).toEqual({ preset: 'rain:1', volume: 0 });
  });
});

describe('Jam requests (2026-11-25)', async () => {
  const { requestMode, coverUrls } = await import('../utils/jamRequest');
  const { proposalLabel } = await import('../utils/proposals');
  it('play now / add to queue / unsure', () => {
    expect(requestMode('play')).toBe('play');
    expect(requestMode('Replace')).toBe('play');
    expect(requestMode('queue')).toBe('queue');
    expect(requestMode('next')).toBe('queue');
    expect(requestMode(undefined)).toBe('auto');
  });
  it('button says what will happen', () => {
    expect(proposalLabel({ tool: 'jam', params: { query: 'x', action: 'play' }, reason: '' })).toBe('Play now');
    expect(proposalLabel({ tool: 'jam', params: { query: 'x', action: 'queue' }, reason: '' })).toBe('Add to queue');
    expect(proposalLabel({ tool: 'jam', params: { songs: ['a', 'b', 'c'] }, reason: '' })).toBe('Play these 3 songs');
    expect(proposalLabel({ tool: 'jam', params: { query: 'x' }, reason: '' })).toBe('Play music');
  });
  it('a cover always exists: stored one first, then YouTube\'s own, no duplicates', () => {
    expect(coverUrls({ id: 'abc', thumbnail: '' })).toEqual(['https://i.ytimg.com/vi/abc/hqdefault.jpg', 'https://i.ytimg.com/vi/abc/mqdefault.jpg']);
    expect(coverUrls({ id: 'abc', thumbnail: 'https://x/y.jpg' })[0]).toBe('https://x/y.jpg');
    expect(coverUrls({ id: 'abc', thumbnail: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' }).length).toBe(2);
  });
});
