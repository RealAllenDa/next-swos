declare interface PrecipitationAnalysisFile {
  time: number;
  file: string;
  bounds: [number, number][];
  torrential_zone: string;
}

declare interface PrecipitationAnalysisList {
  // eslint-disable-next-line camelcase
  twenty_four: PrecipitationAnalysisFile[];
  one: PrecipitationAnalysisFile[];
  three_five_km: PrecipitationAnalysisFile[];
  three_one_km: PrecipitationAnalysisFile[];
}
