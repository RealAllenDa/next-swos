import {
  GeolocateControl,
  type ControlPosition,
  type Map,
} from 'maplibre-gl';

export function addUserLocationControl(
  map: Map,
  position: ControlPosition
) {
  map.addControl(
    new GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
      },
      fitBoundsOptions: {
        maxZoom: 14,
      },
      showAccuracyCircle: true,
      showUserLocation: true,
      trackUserLocation: false,
    }),
    position
  );
}
