import { evaluateGeoFence } from './geo-fence.service';

describe('evaluateGeoFence', () => {
  it('passes when the distance is inside the radius', () => {
    const evaluation = evaluateGeoFence({
      distanceMeters: 42,
      radiusMeters: 200,
      distanceMethod: 'local',
    });

    expect(evaluation.isWithinFence).toBe(true);
    expect(evaluation.distanceMeters).toBe(42);
    expect(evaluation.radiusMeters).toBe(200);
  });

  it('fails when the distance is outside the radius', () => {
    expect(
      evaluateGeoFence({ distanceMeters: 200.5, radiusMeters: 200, distanceMethod: 'local' })
        .isWithinFence,
    ).toBe(false);
  });

  it('treats the boundary as inside — GPS accuracy makes an exclusive edge meaningless', () => {
    expect(
      evaluateGeoFence({ distanceMeters: 200, radiusMeters: 200, distanceMethod: 'local' })
        .isWithinFence,
    ).toBe(true);
  });

  it('reports which strategy produced the distance', () => {
    expect(
      evaluateGeoFence({ distanceMeters: 10, radiusMeters: 200, distanceMethod: 'directions' })
        .distanceMethod,
    ).toBe('directions');
  });

  it('fails closed on a non-finite distance or radius', () => {
    expect(
      evaluateGeoFence({
        distanceMeters: Number.NaN,
        radiusMeters: 200,
        distanceMethod: 'local',
      }).isWithinFence,
    ).toBe(false);
    expect(
      evaluateGeoFence({
        distanceMeters: 10,
        radiusMeters: Number.NaN,
        distanceMethod: 'local',
      }).isWithinFence,
    ).toBe(false);
  });
});
