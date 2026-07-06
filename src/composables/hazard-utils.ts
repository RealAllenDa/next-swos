import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Point,
} from 'geojson';

export const HAZARD_COLORS = [
  '#9ca3af',
  '#1e90ff',
  '#eee414',
  '#f59e0b',
  '#ef4444',
  '#b31ab1',
  '#111827',
];

export function floodStationLevel(station: FloodStation): number {
  const current = Number(station.current_level);
  const levee =
    station.levee_crown === null ? null : Number(station.levee_crown);
  const danger =
    station.danger_level === null ? null : Number(station.danger_level);
  const historical =
    station.historical_highest === null
      ? null
      : Number(station.historical_highest);
  const warning =
    station.warning_level === null ? null : Number(station.warning_level);

  if (levee !== null && current >= levee) return 4;
  if (
    (danger !== null && current >= danger) ||
    (historical !== null && current >= historical)
  )
    return 3;
  if (warning !== null && current >= warning) return 2;
  if (warning !== null && current >= warning - 0.25) return 1;
  return 0;
}

export function maximumRiverLevel(
  river: Record<string, number | boolean>
): number {
  return Object.entries(river).reduce((maximum, [key, value]) => {
    if (key === 'important' || typeof value !== 'number') return maximum;
    return Math.max(maximum, value);
  }, 0);
}

export function pointFeature(
  longitude: number,
  latitude: number,
  properties: GeoJsonProperties
): Feature<Point> {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties,
  };
}

export function emptyFeatureCollection<
  G extends Geometry = Geometry
>(): FeatureCollection<G> {
  return { type: 'FeatureCollection', features: [] };
}

export function validCoordinate(
  longitude: unknown,
  latitude: unknown
): boolean {
  return (
    Number.isFinite(Number(longitude)) && Number.isFinite(Number(latitude))
  );
}
