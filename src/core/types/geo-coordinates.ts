/**
 * A single WGS-84 point.
 *
 * Deliberately the *only* coordinate shape in the app: the location service,
 * the geocoding providers, both distance strategies and the geo-fence rule all
 * speak this, so none of them needs to know where a point came from.
 */
export interface GeoCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}
