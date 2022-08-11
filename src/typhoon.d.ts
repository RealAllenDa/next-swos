declare interface TyphoonList {
  end_time: string;
  eng_name: string;
  is_active: number;
  name: string;
  start_time: string;
  id: string;
}

declare interface TyphoonLandDetail {
  info: string;
  land_address: string;
  land_time: string;
  latitude: string;
  longitude: string;
  strength: string;
}

declare interface TyphoonForecastPoint {
  latitude: string;
  longitude: string;
  power: string;
  pressure: string;
  speed: number;
  strength: string;
  forecast_time: string;
}

declare interface TyphoonForecast {
  forecast_points: TyphoonForecastPoint[];
  origin: string;
}

declare interface TyphoonPoints {
  forecast: TyphoonForecast[];
  latitude: string;
  longitude: string;
  move_direction: string;
  move_speed: number;
  power: number;
  pressure: number;
  r10: string;
  r12: string;
  r7: string;
  speed: number;
  strength: string;
  forecast_time: string;
  position_explanation?: string;
  typhoon_explanation?: string;
}

declare interface TyphoonDetail {
  center_latitude: string;
  center_longitude: string;
  end_time: string;
  eng_name: string;
  is_active: number;
  start_time: string;
  land_info: TyphoonLandDetail[];
  name: string;
  points: TyphoonPoints[];
  id: string;
}

declare interface TyphoonDetailTable {
  date: string;
  pressure: string;
  speed: string;
  move_speed: string;
  category: string;
  index: number;
}
