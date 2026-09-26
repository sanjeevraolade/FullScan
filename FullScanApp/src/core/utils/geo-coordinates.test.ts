import { hasUsableGeoCoordinates, isValidGeoCoordinates } from './geo-coordinates';

describe('isValidGeoCoordinates', () => {
  it('accepts a point inside the valid ranges', () => {
    expect(isValidGeoCoordinates({ latitude: 17.4452, longitude: 78.3821 })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isValidGeoCoordinates(null)).toBe(false);
    expect(isValidGeoCoordinates(undefined)).toBe(false);
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(isValidGeoCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidGeoCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidGeoCoordinates({ latitude: Number.NaN, longitude: 78 })).toBe(false);
    expect(isValidGeoCoordinates({ latitude: 17, longitude: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
  });
});

describe('hasUsableGeoCoordinates', () => {
  it('accepts a real point', () => {
    expect(hasUsableGeoCoordinates({ latitude: 12.9716, longitude: 77.5946 })).toBe(true);
  });

  it('rejects the backend 0,0 "not geocoded yet" sentinel', () => {
    expect(hasUsableGeoCoordinates({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('still accepts a point that is legitimately on one axis', () => {
    expect(hasUsableGeoCoordinates({ latitude: 0, longitude: 78.3821 })).toBe(true);
    expect(hasUsableGeoCoordinates({ latitude: 17.4452, longitude: 0 })).toBe(true);
  });
});
