import {defineStore} from 'pinia';
import {LatLngExpression} from 'leaflet';

export const useMapStore = defineStore('map', {
  state: () => ({
    options: {
      center: [31.259183024923097, 121.51016235351564],
      zoom: 10,
      zoomSnap: 0.5,
      zoomDelta: 0.5
    } as MapOptions
  }),
  actions: {
    setZoom(zoom: number) {
      // TODO
    },
    setCenter(center: LatLngExpression) {
      // TODO
    }
  }
})
