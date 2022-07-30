import {defineStore} from 'pinia';

export const useMapStore = defineStore('map', {
  state: () => ({
    options: {
      center: [31.710978666793125, 121.75599178974481],
      zoom: 7.61,
      zoomSnap: 0.5,
      zoomDelta: 0.5
    } as MapOptions
  }),
  actions: {
    setOptions(options: MapOptions) {
      this.options = options;
    }
  }
})
