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

const rainColorThresholds = {
  '1h': [
    [1, 3, '#F2F2FF'],
    [3, 5, '#A0D2FF'],
    [5, 10, '#218CFF'],
    [10, 20, '#0041FF'],
    [20, 30, '#FFF500'],
    [30, 40, '#FF9900'],
    [40, 50, '#FF2800'],
    [50, Infinity, '#B40068'],
  ],
  '3h': [
    [1, 10, '#F2F2FF'],
    [10, 30, '#A0D2FF'],
    [30, 40, '#218CFF'],
    [40, 50, '#0041FF'],
    [50, 60, '#FFF500'],
    [60, 80, '#FF9900'],
    [80, 100, '#FF2800'],
    [100, Infinity, '#B40068'],
  ],
  '24h': [
    [1, 25, '#F2F2FF'],
    [25, 50, '#A0D2FF'],
    [50, 80, '#218CFF'],
    [80, 100, '#0041FF'],
    [100, 150, '#FFF500'],
    [150, 200, '#FF9900'],
    [200, 250, '#FF2800'],
    [250, Infinity, '#B40068'],
  ],
} as const;

export function hazardLevelColor(level: number): string {
  return HAZARD_COLORS[level] ?? HAZARD_COLORS[0];
}

export function floodLevelLabel(level: number): string {
  return (
    ['正常', '泛滥注意', '泛滥警戒', '泛滥危险', '发生泛滥'][level] ??
    `${level}级`
  );
}

export function rainMeasurementColor(
  precipitation: number,
  duration: keyof typeof rainColorThresholds = '1h'
): string {
  return (
    rainColorThresholds[duration].find(
      ([minimum, maximum], index) =>
        (index === 0 ? minimum < precipitation : minimum <= precipitation) &&
        precipitation < maximum
    )?.[2] ?? '#FFFFFF'
  );
}

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
