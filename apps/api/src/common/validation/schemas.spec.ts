import { dateRangeQuerySchema } from './query.dto.js';
import { isoDate, latitude, longitude, nonEmptyString } from './schemas.js';

describe('isoDate', () => {
  it.each([
    '2026-01-15',
    '2026-01-15T08:30',
    '2026-01-15T08:30:00Z',
    '2026-01-15T08:30:00.123+02:00',
  ])('parses %s into a Date', (value) => {
    const result = isoDate().parse(value);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(new Date(value).getTime());
  });

  it.each(['15/01/2026', 'yesterday', '2026-1-5', '2026-13-45', ''])(
    'rejects %j',
    (value) => {
      expect(isoDate().safeParse(value).success).toBe(false);
    },
  );

  it('rejects non-strings', () => {
    expect(isoDate().safeParse(1_700_000_000_000).success).toBe(false);
  });
});

describe('nonEmptyString', () => {
  it('trims surrounding whitespace', () => {
    expect(nonEmptyString().parse('  Ada  ')).toBe('Ada');
  });

  it.each(['', '   '])('rejects %j', (value) => {
    expect(nonEmptyString().safeParse(value).success).toBe(false);
  });
});

describe('latitude / longitude', () => {
  it('accepts the boundaries', () => {
    expect(latitude().parse(-90)).toBe(-90);
    expect(latitude().parse(90)).toBe(90);
    expect(longitude().parse(-180)).toBe(-180);
    expect(longitude().parse(180)).toBe(180);
  });

  it('rejects values out of range', () => {
    expect(latitude().safeParse(90.1).success).toBe(false);
    expect(longitude().safeParse(-180.1).success).toBe(false);
  });
});

describe('dateRangeQuerySchema', () => {
  it('accepts an empty range or either bound alone', () => {
    expect(dateRangeQuerySchema.parse({})).toEqual({});
    expect(dateRangeQuerySchema.safeParse({ from: '2026-01-01' }).success).toBe(
      true,
    );
    expect(dateRangeQuerySchema.safeParse({ to: '2026-01-01' }).success).toBe(
      true,
    );
  });

  it('accepts from equal to to', () => {
    expect(
      dateRangeQuerySchema.safeParse({ from: '2026-01-01', to: '2026-01-01' })
        .success,
    ).toBe(true);
  });

  it('rejects from after to, reporting it on to', () => {
    const result = dateRangeQuerySchema.safeParse({
      from: '2026-02-01',
      to: '2026-01-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['to']);
  });
});
