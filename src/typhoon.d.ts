declare interface TyphoonList {
  end_time: string;
  eng_name: string;
  is_active: number;
  name: string;
  start_time: string;
  tfid: string;
}

declare interface TyphoonLandDetail {
  land_info: string;
  land_address: string;
  land_time: string;
  latitude: string; // FIXME Not present
  longitude: string; // FIXME Not present
  level: string;
}

declare interface TyphoonForecastPoint {
  latitude: string;
  longitude: string;
  power: string;
  speed: number;
  strong: string;
  time: string;
}

declare interface TyphoonForecast {
  points: TyphoonForecastPoint[];
  sets: string;
}

declare interface TyphoonWindRadius {
  ne: number;
  se: number;
  sw: number;
  nw: number;
}

declare interface TyphoonPoints {
  forecast: TyphoonForecast[] | null;
  latitude: string;
  longitude: string;
  move_dir: string;
  move_speed: number;
  power: number;
  pressure: number;
  radius10_quad: TyphoonWindRadius;
  radius12_quad: TyphoonWindRadius;
  radius7_quad: TyphoonWindRadius;
  speed: number;
  strong: string;
  time: string;
  position_explanation?: string;
  typhoon_explanation?: string;
}

declare interface TyphoonDetail {
  land: TyphoonLandDetail[];
  name: string;
  points: TyphoonPoints[];
}

declare interface TyphoonDetailTable {
  date: string;
  pressure: string;
  speed: string;
  move_speed: string;
  category: string;
  index: number;
  is_forecast: boolean;
}
