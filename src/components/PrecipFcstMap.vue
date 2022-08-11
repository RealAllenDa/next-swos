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
import {GeoJSON, ImageOverlay, LatLngBounds, Map, TileLayer} from 'leaflet';
import {useMapStore} from 'stores/map';
import {usePrecipitationStore} from 'stores/precipitation';
import {GeoJsonObject} from 'geojson';
import sdk from 'src/composables/sdk';
import MapControl from 'components/MapControl.vue';
import PrecipFcstLegend from 'components/PrecipFcstLegend.vue';

export default defineComponent({
  components: {PrecipFcstLegend, MapControl},
  setup() {
    const mapStore = useMapStore();
    const precipitationStore = usePrecipitationStore();
    const map: Ref<Nullable<Map>> = ref();
    const currentData = computed(() => precipitationStore.currentData);
    const torrentialRainDisplay = computed(() => precipitationStore.displayTorrentialRain);

    const legend: Ref<typeof MapControl | null> = ref(null);
    const layer: Ref<Nullable<ImageOverlay>> = ref();
    const torrentialRainLayer: Ref<Nullable<GeoJSON>> = ref();

    function refreshTorrentialRain() {
      if (currentData.value === undefined || currentData.value === null ||
        map.value === undefined || map.value === null ||
        torrentialRainLayer.value === undefined || torrentialRainLayer.value === null) {
        return;
      }
      torrentialRainLayer.value.clearLayers();
      if (torrentialRainDisplay.value) {
        const {data: torrentialRainGeoJson} = sdk.useFetch<GeoJsonObject>(`/parse/rain/${currentData.value.torrential_zone}`)
        watch(torrentialRainGeoJson, () => {
          if (torrentialRainGeoJson.value === undefined || torrentialRainGeoJson.value === null) {
            sdk.showNotification('negative', 'Failed to fetch torrential rain');
            return
          }
          if (torrentialRainLayer.value === undefined || torrentialRainLayer.value === null) {
            sdk.showNotification('negative', 'Torrential layer not found');
            return
          }
          torrentialRainLayer.value.addData(torrentialRainGeoJson.value);
        })
      }
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
    });

    watch(torrentialRainDisplay, refreshTorrentialRain);

    onMounted(() => {
      map.value = new Map('map', mapStore.options);
      // TODO: Replace in future
      new TileLayer('http://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetPurplishBlue/MapServer/tile/{z}/{y}/{x}')
        .addTo(map.value)
      torrentialRainLayer.value = new GeoJSON(
        undefined,
        {
          style: () => {
            return {
              fillOpacity: 1,
              fillColor: '#FF00FF',
              stroke: false
            }
          }
        }
      ).addTo(map.value)
      if (legend.value === null) {
        sdk.showNotification('negative', 'Shouldn\'t happen! Legend element not found')
        return
      }
      legend.value.addToMap(map.value);
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
</style>
