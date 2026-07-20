declare const ENVIRONMENT: string;
declare const VERSION: string;
declare const LOGO: string;
declare const API_URL: string;
declare const CDN_URL: string;
declare const DB_API_URL: string;

declare type Nullable<T> = T | null | undefined;

declare type DashboardLayerId =
  | 'radar'
  | 'weatherWarnings'
  | 'rain1h'
  | 'rain24h'
  | 'wind'
  | 'inundation'
  | 'rivers'
  | 'stations'
  | 'typhoons';

declare type DashboardStatusTone =
  | 'positive'
  | 'info'
  | 'warning'
  | 'negative'
  | 'grey';

declare interface DashboardPrecipitationRadar {
  time: number;
  duration: '1h';
  resolution: '1km';
  dataUrl: string;
}

declare interface DashboardData {
  geography: HazardGeoJSON | null;
  rivers: HazardGeoJSON | null;
  rain1h: RainState | null;
  rain24h: RainState | null;
  wind: WindState | null;
  inundation: InundationState | null;
  flood: FloodState | null;
  weatherWarnings: WeatherWarningList | null;
  floodWarning: FloodWarningState | null;
  typhoons: Record<string, TyphoonDetail>;
  radar: DashboardPrecipitationRadar | null;
}
