import { distanceToSegmentKm, haversineKm } from './geo.js';

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(-1.95, 30.06, -1.95, 30.06)).toBe(0);
  });

  it('measures one degree of latitude as ~111.2 km', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });

  it('shrinks longitude distances away from the equator', () => {
    expect(haversineKm(60, 0, 60, 1)).toBeCloseTo(111.19 / 2, 1);
  });

  it('is symmetric', () => {
    expect(haversineKm(-1.95, 30.06, -2.6, 29.74)).toBeCloseTo(
      haversineKm(-2.6, 29.74, -1.95, 30.06),
      10,
    );
  });

  it('measures Kigali to Huye as ~80 km', () => {
    expect(haversineKm(-1.9441, 30.0619, -2.5967, 29.7394)).toBeCloseTo(
      80.9,
      0,
    );
  });
});

describe('distanceToSegmentKm', () => {
  // A north–south segment along longitude 30, from -2.1 to -1.9.
  const segment = [-2.1, 30, -1.9, 30] as const;

  it('is zero for a point on the segment', () => {
    expect(distanceToSegmentKm(-2, 30, ...segment)).toBeCloseTo(0, 10);
  });

  it('measures perpendicular distance beside the segment', () => {
    // Agrees with haversine to the foot of the perpendicular.
    expect(distanceToSegmentKm(-2, 30.01, ...segment)).toBeCloseTo(
      haversineKm(-2, 30.01, -2, 30),
      3,
    );
  });

  it('measures to the nearest endpoint past either end', () => {
    expect(distanceToSegmentKm(-1.8, 30, ...segment)).toBeCloseTo(
      haversineKm(-1.8, 30, -1.9, 30),
      3,
    );
    expect(distanceToSegmentKm(-2.2, 30.01, ...segment)).toBeCloseTo(
      haversineKm(-2.2, 30.01, -2.1, 30),
      2,
    );
  });

  it('works for diagonal segments', () => {
    // Segment from (0,0) to (1,1); the point (0,1) is ~78.6 km from its
    // midpoint, matching haversine to the foot of the perpendicular.
    expect(distanceToSegmentKm(0, 1, 0, 0, 1, 1)).toBeCloseTo(
      haversineKm(0, 1, 0.5, 0.5),
      0,
    );
  });

  it('treats a zero-length segment as a point', () => {
    expect(distanceToSegmentKm(-2, 30.01, -2, 30, -2, 30)).toBeCloseTo(
      haversineKm(-2, 30.01, -2, 30),
      3,
    );
  });

  it('accounts for longitude shrinking with latitude', () => {
    // 0.01° of longitude is half as far at 60° as at the equator.
    const atEquator = distanceToSegmentKm(0, 0.01, -0.1, 0, 0.1, 0);
    const at60 = distanceToSegmentKm(60, 0.01, 59.9, 0, 60.1, 0);
    expect(at60 / atEquator).toBeCloseTo(0.5, 2);
  });
});
