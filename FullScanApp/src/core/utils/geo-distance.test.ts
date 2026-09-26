import { calculateHaversineDistanceMeters, resolveDistanceDisplayValue } from './geo-distance';

/**
 * Reference values come from the same great-circle formula applied to
 * well-known coordinate pairs, with tolerances that reflect Haversine's own
 * spherical-Earth approximation (a few metres per 100km).
 */
describe('calculateHaversineDistanceMeters', () => {
  it('returns zero for the same point', () => {
    const point = { latitude: 17.4452, longitude: 78.3821 };

    expect(calculateHaversineDistanceMeters(point, point)).toBe(0);
  });

  it('measures a short in-city distance in metres', () => {
    // ~0.001 degree of latitude at the equator-ish scale used by Hyderabad.
    const distance = calculateHaversineDistanceMeters(
      { latitude: 17.4452, longitude: 78.3821 },
      { latitude: 17.4461, longitude: 78.3821 },
    );

    expect(distance).toBeGreaterThan(95);
    expect(distance).toBeLessThan(105);
  });

  it('measures a long inter-city distance', () => {
    // Hyderabad → Bengaluru, roughly 500km great-circle.
    const distance = calculateHaversineDistanceMeters(
      { latitude: 17.385, longitude: 78.4867 },
      { latitude: 12.9716, longitude: 77.5946 },
    );

    expect(distance).toBeGreaterThan(495_000);
    expect(distance).toBeLessThan(510_000);
  });

  it('is symmetric', () => {
    const from = { latitude: 28.6139, longitude: 77.209 };
    const to = { latitude: 19.076, longitude: 72.8777 };

    expect(calculateHaversineDistanceMeters(from, to)).toBeCloseTo(
      calculateHaversineDistanceMeters(to, from),
      6,
    );
  });

  it('handles points straddling the antimeridian without inflating the distance', () => {
    const distance = calculateHaversineDistanceMeters(
      { latitude: 0, longitude: 179.99 },
      { latitude: 0, longitude: -179.99 },
    );

    // ~2.2km apart, not most of the way around the planet.
    expect(distance).toBeLessThan(3000);
  });
});

describe('resolveDistanceDisplayValue', () => {
  it('keeps sub-kilometre distances in whole metres', () => {
    expect(resolveDistanceDisplayValue(42.4)).toEqual({ unit: 'meters', value: 42 });
    expect(resolveDistanceDisplayValue(999.4)).toEqual({ unit: 'meters', value: 999 });
  });

  it('switches to kilometres at one kilometre', () => {
    expect(resolveDistanceDisplayValue(1000)).toEqual({ unit: 'kilometers', value: 1 });
  });

  it('rounds kilometres to one decimal', () => {
    expect(resolveDistanceDisplayValue(2100)).toEqual({ unit: 'kilometers', value: 2.1 });
    expect(resolveDistanceDisplayValue(15_460)).toEqual({ unit: 'kilometers', value: 15.5 });
  });

  it('reports zero metres for a non-finite distance rather than NaN in the UI', () => {
    expect(resolveDistanceDisplayValue(Number.NaN)).toEqual({ unit: 'meters', value: 0 });
    expect(resolveDistanceDisplayValue(Number.POSITIVE_INFINITY)).toEqual({
      unit: 'meters',
      value: 0,
    });
  });
});
