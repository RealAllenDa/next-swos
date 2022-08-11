declare interface WeatherWarning {
  name: string;
  time: string;
  type: string;
  level: number;
  detail: string;
}

declare interface WeatherWarningList {
  coloring: { [district: string]: number };
  districts: { [district: string]: WeatherWarning[] };
  message_time: string;
  timestamp: number;
}
