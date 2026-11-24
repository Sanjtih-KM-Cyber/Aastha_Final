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
