declare interface PrecipitationAnalysisFile {
  time: number;
}

declare interface PrecipitationAnalysisList {
  // eslint-disable-next-line camelcase
  twenty_four: PrecipitationAnalysisFile[];
  one: PrecipitationAnalysisFile[];
  three: PrecipitationAnalysisFile[];
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
