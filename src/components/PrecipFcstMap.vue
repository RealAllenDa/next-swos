<template>
  <div id="map">
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, onMounted, ref, Ref, watch} from 'vue';
import 'leaflet/dist/leaflet.css';
import {ImageOverlay, LatLngBounds, LayerGroup, Map, TileLayer} from 'leaflet';
import {useMapStore} from 'stores/map';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';

export default defineComponent({
  setup() {
    const mapStore = useMapStore();
    const precipitationStore = usePrecipitationStore();
    const map: Ref<Nullable<Map>> = ref();
    const currentData = computed(() => precipitationStore.currentData);
    let layerGroup: Ref<Nullable<LayerGroup>> = ref();
    const layer: Ref<Nullable<ImageOverlay>> = ref();

    watch(currentData, () => {
      if (currentData.value === undefined || currentData.value === null ||
        layerGroup.value === undefined || layerGroup.value === null ||
        map.value === undefined || map.value === null) {
        return;
      }
      if (layer.value === undefined || layer.value === null) {
        layer.value = new ImageOverlay(
          `${sdk.apiUrl}/static/parses/${currentData.value.file}`,
          currentData.value.bounds,
          {
            opacity: 0.75,
            className: 'clear-layer'
          }
        ).addTo(map.value)
      } else {
        layer.value.setUrl(`${sdk.apiUrl}/static/parses/${currentData.value.file}`);
        layer.value.setBounds(new LatLngBounds(currentData.value.bounds));
      }
    });

    onMounted(() => {
      map.value = new Map('map', mapStore.options);
      new TileLayer('http://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetPurplishBlue/MapServer/tile/{z}/{y}/{x}')
        .addTo(map.value)
      layerGroup.value = new LayerGroup().addTo(map.value);
    });

    return {
      map,
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
