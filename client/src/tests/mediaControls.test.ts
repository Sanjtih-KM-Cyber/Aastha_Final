import { describe, it, expect } from 'vitest';
import { artworkFor } from '../services/mediaControls';

describe('lock-screen player artwork', () => {
  it('only https covers go to the system player (a missing/odd one becomes an empty list, never undefined)', () => {
    expect(artworkFor('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toEqual([{ src: 'https://i.ytimg.com/vi/abc/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' }]);
    expect(artworkFor(undefined)).toEqual([]);
    expect(artworkFor('blob:xyz')).toEqual([]);
    expect(artworkFor('http://insecure.jpg')).toEqual([]);
  });
});
