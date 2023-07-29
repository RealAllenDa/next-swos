declare interface PrecipitationAnalysisFile {
  time: number;
  file: string;
  bounds: [number, number][];
  torrential_zone: string;
  gpv?: string;
}

declare interface PrecipitationAnalysisList {
  // eslint-disable-next-line camelcase
  twenty_four: PrecipitationAnalysisFile[];
  one: PrecipitationAnalysisFile[];
  three_five_km: PrecipitationAnalysisFile[];
  three_one_km: PrecipitationAnalysisFile[];
}

declare interface RainMeasurementStation {
  area: string;
  id: string;
  latitude: number;
  level: number;
  longitude: number;
  name: string;
  period: number;
  value: number;
}

declare interface RainMeasurements {
  message_time: string;
  rain: RainMeasurementStation[];
  timestamp: number;
}
