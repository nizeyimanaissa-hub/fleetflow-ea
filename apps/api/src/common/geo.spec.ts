import { haversineKm } from './geo.js';

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
