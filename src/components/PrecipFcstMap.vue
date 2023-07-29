<template>
  <div id="map" ref="mapContainer">
    <MapControl ref="legendRain">
      <div class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm legend-rain">
        <PrecipFcstLegend></PrecipFcstLegend>
      </div>
    </MapControl>
    <MapControl ref="legendDescription">
      <div v-if="precipitationStore.initialized" class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm legend-description column">
        <div class="row">
          <span>{{ precipitationStore.selectedDuration.slice(0, -1) }}小时降雨量</span>
          <span class="q-ml-xl">{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div v-if="precipitationStore.displayTorrentialRain" class="legend-description-sub row">
          <span>猛烈降水带</span>
          <span>{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div v-if="precipitationStore.displayGpv" class="legend-description-sub row">
          <span>网格雨量</span>
          <span>{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div v-if="precipitationStore.displayRainMeasurements && isLastTime" class="legend-description-sub row">
          <span>1小时站点观测</span>
          <span>{{ precipitationStore.rainMeasurementsTime }}</span>
        </div>
      </div>
    </MapControl>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, markRaw, onMounted, ref, shallowRef, watch} from 'vue';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';
import type {Feature, FeatureCollection} from '@turf/turf'
import * as turf from '@turf/turf'
import {round} from '@turf/turf'
import {FullscreenControl, Map, NavigationControl, ScaleControl} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapControl from 'components/MLMapControl.vue';
import PrecipFcstLegend from 'components/PrecipFcstLegend.vue';

export default defineComponent({
  components: {MapControl, PrecipFcstLegend},
  setup() {
    const precipitationStore = usePrecipitationStore();
    const map = shallowRef<Map>();
    const mapContainer = shallowRef<HTMLElement>();

    const currentData = computed(() => precipitationStore.currentData);
    const dataChanged = computed({
      get() {
        return precipitationStore.dataChanged
      },
      set() {
        precipitationStore.dataChanged = !precipitationStore.dataChanged
      }
    });
    const torrentialRainDisplay = computed(() => precipitationStore.displayTorrentialRain);
    const gpvDisplay = computed(() => precipitationStore.displayGpv);
    const rainMeasurementsDisplay = computed(() => precipitationStore.displayRainMeasurements);
    const isLastTime = computed(() => precipitationStore.endTime === precipitationStore.currentTime);

    const legendRain = ref<typeof MapControl>();
    const legendDescription = ref<typeof MapControl>();

    const rainLayerInitialized = ref(false);
    const torrentialRainLayerInitialized = ref(false);
    const rainMeasurementsLayerInitialized = ref(false);
    const gpvLayerInitialized = ref(false);

    function refreshTorrentialRain() {
      if (!torrentialRainDisplay.value) {
        if (torrentialRainLayerInitialized.value) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('torrential-rain')?.setData({'type': 'FeatureCollection', 'features': []});
        }
        return
      }
      const {data: torrentialRainGeoJson} = sdk.useFetch<FeatureCollection>(`/parse/rain/tor_zone_3h_5km_${currentData.value?.time}.geojson`)
      watch(torrentialRainGeoJson, () => {
        if (torrentialRainGeoJson.value === undefined || torrentialRainGeoJson.value === null) {
          sdk.showNotification('negative', 'Failed to fetch torrential rain');
          return
        }
        if (torrentialRainGeoJson.value.features.length === 0) {
          return
        }

        let dataCollection: FeatureCollection = {'type': 'FeatureCollection', 'features': []}
        torrentialRainGeoJson.value.features.forEach(feature => {
          const bbox = turf.bbox(turf.explode(turf.envelope(feature)));
          const distanceA = Math.abs(bbox[3] - bbox[1])
          const distanceB = Math.abs(bbox[2] - bbox[0])
          let ratio;
          if (distanceB > distanceA) {
            ratio = distanceB / distanceA
          } else {
            ratio = distanceA / distanceB
          }
          console.debug('distanceA', distanceA, 'distanceB', distanceB, 'ratio', ratio)
          if (ratio <= 2.5) {
            console.debug('rejected: ratio <= 2.5, not a linear precipitation zone')
            return;
          }

          const area = turf.convertArea(turf.area(turf.envelope(feature)), 'meters', 'kilometers')
          console.debug('area', area)
          if (area < 500) {
            console.debug('rejected: area < 500, not a linear precipitation zone')
            return
          }

          dataCollection.features.push(turf.polygonSmooth(turf.envelope(feature), {
            iterations: 5
          }) as unknown as Feature);
        })
        if (!torrentialRainLayerInitialized.value) {
          map.value?.addSource('torrential-rain', {
            type: 'geojson',
            data: dataCollection
          })
          map.value?.addLayer({
            id: 'torrential-rain',
            type: 'line',
            source: 'torrential-rain',
            // 'source-layer': 'sliced',
            layout: {},
            paint: {
              'line-color': '#ff0000',
              'line-width': 6
            }
          })
          torrentialRainLayerInitialized.value = true;
        } else {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('torrential-rain')?.setData(dataCollection);
        }
      })

    }

    function refreshGpv() {
      if (!gpvDisplay.value) {
        if (gpvLayerInitialized.value) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('gpv')?.setData({'type': 'FeatureCollection', 'features': []});
        }
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!gpvLayerInitialized.value) {
        map.value?.addSource('gpv', {
          type: 'geojson',
          buffer: 0,
          tolerance: 0,
          data: `${sdk.apiUrl}/parse/rain/gpv_${precipitationStore.selectedDuration}_5km_${currentData.value?.time}.geojson`
        })
        map.value?.addLayer({
          id: 'gpv',
          type: 'symbol',
          source: 'gpv',
          minzoom: 9,
          layout: {
            'text-overlap': 'always',
            'text-font': ['Roboto Bold'],
            'text-field': ['get', 'value']
          },
          paint: {
            'text-color': '#FFF',
            'text-halo-color': '#000',
            'text-halo-width': 1,
            'text-halo-blur': 1
          }
        })
        gpvLayerInitialized.value = true;
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        map.value?.getSource('gpv')?.setData(`${sdk.apiUrl}/parse/rain/gpv_${precipitationStore.selectedDuration}_5km_${currentData.value?.time}.geojson`)
      }
    }

    function refreshRainMeasurements() {
      let dataCollection: FeatureCollection = {type: 'FeatureCollection', features: []}
      if (!isLastTime.value || !rainMeasurementsDisplay.value) {
        if (rainMeasurementsLayerInitialized.value) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('rain-measurements')?.setData(dataCollection);
        }
        return
      }
      const {data: rain} = sdk.useFetch<RainMeasurements>('https://api.daziannetwork.com/warning/rain_state_1h', true);
      watch(rain, () => {
        if (rain.value === undefined || rain.value === null) {
          sdk.showNotification('negative', 'Failed to fetch 1-hr. precipitation data');
          return;
        }
        rain.value.rain.forEach(station => {
          let color;
          const precipitation = station.value;
          if (1 < precipitation && precipitation < 3) {
            color = '#F2F2FF'
          } else if (3 <= precipitation && precipitation < 5) {
            color = '#A0D2FF'
          } else if (5 <= precipitation && precipitation < 10) {
            color = '#218CFF'
          } else if (10 <= precipitation && precipitation < 20) {
            color = '#0041FF'
          } else if (20 <= precipitation && precipitation < 30) {
            color = '#FFF500'
          } else if (30 <= precipitation && precipitation < 40) {
            color = '#FF9900'
          } else if (40 <= precipitation && precipitation < 50) {
            color = '#FF2800'
          } else if (50 <= precipitation) {
            color = '#B40068'
          } else {
            color = '#FFFFFF'
          }
          dataCollection.features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [station.longitude, station.latitude]
            },
            properties: {
              value: round(precipitation, 0),
              color: color
            }
          })
        })
        precipitationStore.rainMeasurementsTime = rain.value.message_time

        if (!rainMeasurementsLayerInitialized.value) {
          map.value?.addSource('rain-measurements', {
            type: 'geojson',
            data: dataCollection
          })
          // Layer for displaying numbers
          map.value?.addLayer({
            id: 'rain-measurements-label',
            type: 'symbol',
            source: 'rain-measurements',
            minzoom: 8,
            layout: {
              'text-allow-overlap': true,
              'text-font': ['Roboto Bold'],
              'text-field': ['get', 'value']
            },
            paint: {
              'text-color': ['get', 'color'],
              'text-halo-color': '#000',
              'text-halo-width': 3,
              'text-halo-blur': 1
            }
          })
          // Layer for displaying points
          map.value?.addLayer({
            id: 'rain-measurements-point',
            type: 'circle',
            source: 'rain-measurements',
            maxzoom: 8,
            layout: {},
            paint: {
              'circle-radius': 7,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#000'
            }
          })
          rainMeasurementsLayerInitialized.value = true;
        } else {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('rain-measurements')?.setData(dataCollection);
        }
      })
    }

    function refreshRainLayer() {
      precipitationStore.mapIsLoading = true;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!rainLayerInitialized.value) {
        map.value?.addSource('rain', {
          type: 'geojson',
          buffer: 0,
          tolerance: 0,
          data: `${sdk.apiUrl}/parse/rain/rain_${precipitationStore.selectedDuration}_${precipitationStore.selectedResolution}_${currentData.value?.time}.geojson`
          // type: 'vector',
          // tiles: [`http://localhost:3000/tile/${currentData.value?.time}/{z}/{x}/{y}`],
          // // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          // bounds: [currentData.value!.bounds[0][1], currentData.value!.bounds[1][0], currentData.value!.bounds[1][1], currentData.value!.bounds[0][0]]
        })
        map.value?.addLayer({
          id: 'rain',
          type: 'fill',
          source: 'rain',
          // 'source-layer': 'sliced',
          layout: {},
          paint: {
            'fill-color': ['to-color', ['concat', 'rgba(', ['get', 'c'], ')']],
            'fill-opacity': 0.7,
            'fill-outline-color': 'rgba(0,0,0,0)'
          }
        })
        rainLayerInitialized.value = true;
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        map.value?.getSource('rain')?.setData(`${sdk.apiUrl}/parse/rain/rain_${precipitationStore.selectedDuration}_${precipitationStore.selectedResolution}_${currentData.value?.time}.geojson`)
        // map.value?.getSource('rain').setTiles([`http://localhost:3000/tile/${currentData.value?.time}/{z}/{x}/{y}`])
      }
    }


    watch(dataChanged, () => {
      if (!dataChanged.value) {
        return;
      }
      if (currentData.value === undefined || currentData.value === null ||
        map.value === undefined) {
        return;
      }
      refreshRainLayer();
      refreshTorrentialRain();
      refreshGpv();
      refreshRainMeasurements();
      dataChanged.value = false;
    });

    watch(torrentialRainDisplay, refreshTorrentialRain);
    watch(gpvDisplay, refreshGpv)
    watch(rainMeasurementsDisplay, refreshRainMeasurements)

    onMounted(() => {
      map.value = markRaw(new Map({
        container: 'map',
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        keyboard: false,
        preserveDrawingBuffer: true,
        style: {
          'version': 8,
          'glyphs': './{fontstack}/{range}.pbf',
          'sources': {
            'base-raster': {
              'type': 'raster',
              'tiles': [
                'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
                'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
                'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
                'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
              ],
              'tileSize': 256,
              'attribution':
                `&copy; ${new Date().getFullYear()} SWoS, HomeNetwork, AllenDa.<br>
        Data source: <a href="https://www.rainviewer.com/" target="_blank">RainViewer</a><br>
        Map source: GaoDe`

            }
          },
          'layers': [
            {
              'id': 'base-map',
              'type': 'raster',
              'source': 'base-raster',
              'minzoom': 0,
              'maxzoom': 14
            }
          ]
        },
        center: [121.51016235351564, 31.259183024923097],
        zoom: 10
      }));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      map.value.addControl(new legendRain.value!.MapLegend(), 'bottom-right')
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      map.value.addControl(new legendDescription.value!.MapLegend(), 'top-right')

      map.value.addControl(new FullscreenControl(), 'top-left');
      map.value.addControl(new NavigationControl({showCompass: false}), 'top-left');
      map.value.addControl(new ScaleControl({unit: 'metric'}), 'bottom-left');

      map.value.on('sourcedata', (e) => {
        if (e.sourceId === 'rain') {
          precipitationStore.mapIsLoading = !e.isSourceLoaded
        }
      })
    });

    return {
      map,
      mapContainer,
      legendRain,
      legendDescription,
      currentData,
      rainMeasurementsDisplay,
      torrentialRainDisplay,
      precipitationStore,
      isLastTime
    };
  }
});
</script>

<style>
#map {
  height: 100%;
  width: 100%;
}

.clear-layer {
  image-rendering: pixelated;
}

.gpv-labels {
  background-color: transparent;
  border: transparent;
  box-shadow: none;
}

.legend-rain {
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.2);
  margin: 0 10px 10px 0;
}

.legend-description {
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.2);
  margin: 10px 10px 0 0;
  font-size: 17px;
  font-weight: 700;
  border-radius: 4px;
}

.legend-description-sub {
  font-size: 14px;
  justify-content: space-between;
}
</style>
