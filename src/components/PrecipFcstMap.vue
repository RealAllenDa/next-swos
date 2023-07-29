<template>
  <div id="map">
    <MapControl ref="legend" position="bottomright">
      <div class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm" style="background: white; border: 2px solid black;">
        <PrecipFcstLegend></PrecipFcstLegend>
      </div>
    </MapControl>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, onMounted, ref, Ref, watch} from 'vue';
import 'leaflet/dist/leaflet.css';
import {Canvas, Control, GeoJSON, ImageOverlay, LatLngBounds, Map} from 'leaflet';
import {useMapStore} from 'stores/map';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';
import MapControl from 'components/MapControl.vue';
import PrecipFcstLegend from 'components/PrecipFcstLegend.vue';
import type {FeatureCollection} from '@turf/turf'
import * as turf from '@turf/turf'
import 'src/composables/leaflet-geojson-vt'
import 'leaflet.vectorgrid'
import 'leaflet.chinatmsproviders'

export default defineComponent({
  components: {PrecipFcstLegend, MapControl},
  setup() {
    const mapStore = useMapStore();
    const precipitationStore = usePrecipitationStore();
    const map: Ref<Nullable<Map>> = ref();
    const currentData = computed(() => precipitationStore.currentData);
    const torrentialRainDisplay = computed(() => precipitationStore.displayTorrentialRain);
    const gpvDisplay = computed(() => precipitationStore.displayGpv);
    const rainMeasurementsDisplay = computed(() => precipitationStore.displayRainMeasurements);
    const isLastTime = computed(() => precipitationStore.endTime === precipitationStore.currentTime);

    const legend: Ref<typeof MapControl | null> = ref(null);
    const layer: Ref<Nullable<ImageOverlay>> = ref();
    const torrentialRainLayer: Ref<Nullable<GeoJSON>> = ref();
    const gpvLayer: Ref<Nullable<GeoJSON>> = ref();
    const gpvRenderer: Ref<Nullable<Canvas>> = ref();

    const rainMeasurementsLayer = ref(new L.LayerGroup(undefined, {
      pane: 'shadowPane'
    }));


    function refreshTorrentialRain() {
      if (currentData.value === undefined || currentData.value === null ||
        map.value === undefined || map.value === null ||
        torrentialRainLayer.value === undefined || torrentialRainLayer.value === null) {
        return;
      }
      torrentialRainLayer.value.clearLayers();
      if (torrentialRainDisplay.value) {
        const {data: torrentialRainGeoJson} = sdk.useFetch<FeatureCollection>(`/parse/rain/${currentData.value.torrential_zone}`)
        watch(torrentialRainGeoJson, () => {
          if (torrentialRainGeoJson.value === undefined || torrentialRainGeoJson.value === null) {
            sdk.showNotification('negative', 'Failed to fetch torrential rain');
            return
          }
          if (torrentialRainLayer.value === undefined || torrentialRainLayer.value === null) {
            sdk.showNotification('negative', 'Torrential layer not found');
            return
          }
          if (torrentialRainGeoJson.value.features.length === 0) {
            return
          }

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

            // torrentialRainLayer.value?.addData(feature);
            // torrentialRainLayer.value.addData(torrentialRainGeoJson.value);
            torrentialRainLayer.value?.addData(turf.polygonSmooth(turf.envelope(feature), {
              iterations: 5
            }));
          })
        })
      }
    }

    function refreshGpv() {
      if (map.value === undefined || map.value === null ||
        gpvLayer.value === undefined || gpvLayer.value === null) {
        return;
      }
      if (gpvDisplay.value) {
        const {data: gpvGeoJson} = sdk.useFetch<FeatureCollection>(`/parse/rain/${currentData.value?.gpv}`)
        watch(gpvGeoJson, () => {
          if (map.value === undefined || map.value === null ||
            gpvLayer.value === undefined || gpvLayer.value === null) {
            return;
          }
          if (gpvGeoJson.value === undefined || gpvGeoJson.value === null) {
            sdk.showNotification('negative', 'Failed to fetch gpv');
            return
          }
          gpvLayer.value.setData(gpvGeoJson.value)
          if (map.value.getZoom() >= 10 && !map.value.hasLayer(gpvLayer.value) && gpvDisplay.value) {
            map.value.addLayer(gpvLayer.value);
          }
          gpvLayer.value.redraw()
        })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        map.value?.removeLayer(gpvLayer.value!)
      }
    }

    function refreshRainMeasurements() {
      rainMeasurementsLayer.value.clearLayers();
      if (!isLastTime.value || !rainMeasurementsDisplay.value) {
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
          const layer = new L.CircleMarker([station.latitude, station.longitude], {
            pane: 'markerPane',
            fillColor: color,
            radius: 7,
            stroke: true,
            weight: 1,
            color: '#000000',
            fill: true,
            fillOpacity: 1
          })
          rainMeasurementsLayer.value.addLayer(layer)
        })
      })
    }

    watch(currentData, () => {
      if (currentData.value === undefined || currentData.value === null ||
        map.value === undefined || map.value === null) {
        return;
      }
      if (layer.value === undefined || layer.value === null) {
        layer.value = new ImageOverlay(
          `${sdk.apiUrl}/parse/rain/${currentData.value.file}`,
          currentData.value.bounds,
          {
            opacity: 0.75,
            className: 'clear-layer'
          }
        ).addTo(map.value)
      } else {
        layer.value.setUrl(`${sdk.apiUrl}/parse/rain/${currentData.value.file}`);
        layer.value.setBounds(new LatLngBounds(currentData.value.bounds));
      }
      refreshTorrentialRain();
      refreshGpv();
      refreshRainMeasurements()
    });

    watch(torrentialRainDisplay, refreshTorrentialRain);
    watch(gpvDisplay, refreshGpv)
    watch(rainMeasurementsDisplay, refreshRainMeasurements)

    onMounted(() => {
      map.value = new Map('map', mapStore.options);
      // TODO: Replace in future
      L.tileLayer.chinaProvider('GaoDe.Satellite.Map', {
        maxZoom: 11,
        minZoom: 5
      }).addTo(map.value);
      torrentialRainLayer.value = new GeoJSON(
        undefined,
        {
          style: () => {
            return {
              fillOpacity: 1,
              fillColor: '#FF00FF',
              stroke: true,
              fill: false,
              color: '#ff0000',
              weight: 6
            }
          }
        }
      ).addTo(map.value)
      gpvLayer.value = L.geoJson.vt(undefined, {
        maxZoom: 20,
        tolerance: 3,
        debug: 0,
        pane: 'shadowPane',
        style: {
          fill: false,
          stroke: true,
          color: 'black',
          font: 'bold 11px serif',
          opacity: 1,
          fillColor: 'white',
          textAlign: 'center',
          textBaseline: 'middle'
        }
      })
      rainMeasurementsLayer.value.addTo(map.value)

      if (legend.value === null) {
        sdk.showNotification('negative', 'Shouldn\'t happen! Legend element not found')
        return
      }
      legend.value.addToMap(map.value);

      new Control.Scale({
        metric: true,
        imperial: false
      }).addTo(map.value);
      map.value.attributionControl.setPrefix(false).addAttribution(
        `&copy; ${new Date().getFullYear()} SWoS, HomeNetwork, AllenDa.<br>
        Data source: <a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>`
      )

      map.value.on('zoomstart', () => {
        if (map.value === null || map.value === undefined || gpvLayer.value === null || gpvLayer.value === undefined) {
          return;
        }
        map.value.removeLayer(gpvLayer.value);
      })
      map.value.on('zoomend', () => {
        if (map.value === null || map.value === undefined || gpvLayer.value === null || gpvLayer.value === undefined) {
          return;
        }
        var size = Math.floor(11 + ((map.value.getZoom() - 10) > 0 ? 5 : 0));
        gpvLayer.value.setStyleOptions({
          fill: false,
          stroke: true,
          color: 'black',
          font: `bold ${size}px serif`,
          opacity: 1,
          fillColor: 'white',
          textAlign: 'center',
          textBaseline: 'middle'
        })
        if (map.value.getZoom() >= 10 && !map.value.hasLayer(gpvLayer.value) && gpvDisplay.value) {
          map.value.addLayer(gpvLayer.value);
        }
      })
    });

    return {
      map,
      legend,
      currentData
    };
  }
});
</script>

<style>
#map {
  width: 100%;
  z-index: 1;
}

.clear-layer {
  image-rendering: pixelated;
}

.gpv-labels {
  background-color: transparent;
  border: transparent;
  box-shadow: none;
}

.leaflet-control-attribution {
  user-select: none;
}
</style>
