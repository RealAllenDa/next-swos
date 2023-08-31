declare interface MapOptions {
  center: [number, number];
  zoom: number;
  zoomSnap: number;
  zoomDelta: number;
}

declare interface MapResolutionDuration {
  resolution: string;
  duration: string;
}

declare interface ChooseOptions {
  label: string;
  value: string;
}

declare interface ResolutionOptions extends ChooseOptions {
  thumbnail?: boolean;
}

declare interface LegendOptions {
  title: string;
  unit: string;
  levels: string[];
}

declare interface MapInterface {
  data_id: string;
  resolution: ResolutionOptions[];
  legends: LegendOptions;
  torrential_avail: boolean;
  gpv_avail: boolean;
  rain_measurements_avail: boolean;
}

declare interface MapSpec {
  name: string;
  default: MapResolutionDuration;
  durations: ChooseOptions[];
  maps: { [name: string]: MapInterface };
}

declare interface PlaybackSpeed {
  id: number;
  description: string;
  speed: number;
}
