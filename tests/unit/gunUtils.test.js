import { gunSafe } from '../../packages/api/src/utils/gunUtils.js';

describe('gunUtils - gunSafe', () => {
  it('should remove null and undefined values', () => {
    const input = {
      title: 'Test Paper',
      content: 'Some content',
      missing: null,
      notDefined: undefined
    };
    const expected = {
      title: 'Test Paper',
      content: 'Some content'
    };
    expect(gunSafe(input)).toEqual(expected);
  });

  it('should stringify arrays', () => {
    const input = {
      tags: ['science', 'p2p'],
      authors: ['Alice', 'Bob']
    };
    const expected = {
      tags: JSON.stringify(['science', 'p2p']),
      authors: JSON.stringify(['Alice', 'Bob'])
    };
    expect(gunSafe(input)).toEqual(expected);
  });

  it('should return empty object for invalid inputs', () => {
    expect(gunSafe(null)).toEqual({});
    expect(gunSafe(undefined)).toEqual({});
    expect(gunSafe([])).toEqual({});
    expect(gunSafe('string')).toEqual({});
  });

  it('should keep numbers and booleans', () => {
    const input = {
      count: 42,
      isValid: true,
      score: 0.85
    };
    expect(gunSafe(input)).toEqual(input);
  });
});
