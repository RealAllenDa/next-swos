import type { GeoJSON } from 'geojson';

declare global {
  type HazardMode =
    | 'rain-1h'
    | 'rain-24h'
    | 'rain-period'
    | 'wind'
    | 'inundation'
    | 'flood-rivers'
    | 'flood-stations'
    | 'flood-warning';

  interface RainObservation {
    longitude: number;
    latitude: number;
    area: string;
    id: string;
    name: string;
    value: number;
    level: number;
    period?: number;
  }

  interface RainState {
    timestamp?: number;
    message_time?: string;
    rain: RainObservation[];
  }

  interface WindObservation {
    longitude: number;
    latitude: number;
    id: string;
    name: string;
    speed: number;
    degrees: number;
    direction: string;
    level: number;
    wind_level: string;
  }

  interface WindState {
    timestamp: number;
    message_time: string;
    wind: Record<string, WindObservation[]>;
  }

  interface InundationObservation {
    longitude: number;
    latitude: number;
    id: string;
    name: string;
    water_level: number;
    level: number;
  }

  interface InundationState {
    timestamp: number;
    message_time: string;
    inundation: Record<string, InundationObservation[]>;
  }

  interface FloodStation {
    name?: string;
    longitude: number;
    latitude: number;
    original_river: string;
    current_level: number;
    warning_level: number | string | null;
    danger_level: number | string | null;
    historical_highest: number | string | null;
    levee_crown: number | string | null;
  }

  interface FloodState {
    timestamp: number;
    message_time?: string;
    flood: Record<string, Record<string, number | boolean>>;
    station: Record<string, FloodStation>;
  }

  interface FloodWarningState {
    timestamp: number;
    message_time: string;
    flood: number;
    water_level: number;
  }

  interface RiverAnnotation {
    id: string;
    name: string;
    marker: { lat: number; lng: number };
  }

  interface HazardConfig {
    mode: HazardMode;
    title: string;
    subtitle: string;
    endpoint: string;
  }

  type HazardApiState =
    | RainState
    | WindState
    | InundationState
    | FloodState
    | FloodWarningState;

  type HazardGeoJSON = GeoJSON;
}

export {};
