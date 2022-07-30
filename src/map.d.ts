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

declare interface MapInterface {
  data_id: string;
  resolution: ChooseOptions[];
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
