<template>
  <div class="weather-map-wrapper">
    <div ref="mapContainer" class="weather-map"></div>
    <MLMapControl ref="legend" position="bottomright">
      <div class="map-card"><WeatherWarningLegend /></div>
    </MLMapControl>
    <MLMapControl ref="detail" position="topright">
      <div class="map-card"><WeatherWarningDetail /></div>
    </MLMapControl>
  </div>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {
  FullscreenControl,
  Map,
  NavigationControl,
  Popup,
  ScaleControl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection } from 'geojson';
import { useQuasar } from 'quasar';
import sdk from 'src/composables/sdk';
import { useWeatherWarningStore } from 'stores/weather-warning';
import MLMapControl from 'components/MLMapControl.vue';
import WeatherWarningLegend from 'components/WeatherWarningLegend.vue';
import WeatherWarningDetail from 'components/WeatherWarningDetail.vue';
import { applyBaseMapTheme, createBaseMapStyle } from 'src/maps/base-style';
import { addUserLocationControl } from 'src/maps/user-location-control';

export default defineComponent({
  name: 'WeatherWarningMap',
  components: { WeatherWarningDetail, WeatherWarningLegend, MLMapControl },
  setup() {
    const $q = useQuasar();
    const weatherWarningStore = useWeatherWarningStore();
    const mapContainer = ref<HTMLElement>();
    const map = shallowRef<Map>();
    const legend = ref<InstanceType<typeof MLMapControl>>();
    const detail = ref<InstanceType<typeof MLMapControl>>();
    const geoJson = ref<FeatureCollection | null>(null);
    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 8,
    });
    const centralDistricts = [
      '黄浦区',
      '徐汇区',
      '长宁区',
      '静安区',
      '普陀区',
      '闸北区',
      '虹口区',
      '杨浦区',
    ];
    const warningList = computed(() => weatherWarningStore.currentWarningList);

    function districtName(feature: Feature): string {
      const name = String(feature.properties?.name ?? '');
      return centralDistricts.includes(name) ? '上海市' : name;
    }

    function styledGeoJson(): FeatureCollection {
      if (!geoJson.value) return { type: 'FeatureCollection', features: [] };
      const collection = JSON.parse(
        JSON.stringify(geoJson.value)
      ) as FeatureCollection;
      collection.features = collection.features.filter(
        (feature) => !['江苏省', '浙江省'].includes(districtName(feature))
      );
      collection.features.forEach((feature) => {
        feature.properties ??= {};
        feature.properties.warningLevel =
          warningList.value.coloring?.[districtName(feature)] ?? 0;
      });
      return collection;
    }

    function refreshWarnings() {
      const source = map.value?.getSource('warning-districts') as
        | GeoJSONSource
        | undefined;
      source?.setData(styledGeoJson());
    }

    function addLayers() {
      const currentMap = map.value;
      if (!currentMap) return;
      currentMap.addSource('warning-districts', {
        type: 'geojson',
        data: styledGeoJson(),
      });
      currentMap.addLayer({
        id: 'warning-fill',
        type: 'fill',
        source: 'warning-districts',
        paint: {
          'fill-color': [
            'match',
            ['get', 'warningLevel'],
            1,
            '#41a0f8',
            2,
            '#f3e843',
            3,
            '#f8a931',
            4,
            '#f74e3b',
            '#c8c8cb',
          ],
          'fill-opacity': 0.78,
        },
      });
      currentMap.addLayer({
        id: 'warning-outline',
        type: 'line',
        source: 'warning-districts',
        paint: { 'line-color': '#27272a', 'line-width': 1 },
      });

      currentMap.on('mousemove', 'warning-fill', (event) => {
        currentMap.getCanvas().style.cursor = 'pointer';
        const feature = event.features?.[0];
        if (!feature) return;
        const name = districtName(feature);
        const warnings = warningList.value.districts?.[name] ?? [];
        const wrapper = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = name;
        wrapper.append(title);
        warnings.forEach((warning) => {
          const row = document.createElement('div');
          row.textContent = `${warning.type}${weatherWarningStore.parseLevel(
            warning.level
          )}预警`;
          wrapper.append(row);
        });
        if (warnings.length === 0)
          wrapper.append(document.createTextNode(' · 无预警'));
        hoverPopup
          .setLngLat(event.lngLat)
          .setDOMContent(wrapper)
          .addTo(currentMap);
      });
      currentMap.on('click', 'warning-fill', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        weatherWarningStore.currentSelectedDistrict = districtName(feature);
      });
      currentMap.on('mouseleave', 'warning-fill', () => {
        currentMap.getCanvas().style.cursor = '';
        hoverPopup.remove();
      });
    }

    const { data: geography } = sdk.useFetch<FeatureCollection>(
      `${sdk.productionApiUrl}/assets/generic/around_shanghai_geojson`,
      true
    );
    watch(geography, (value) => {
      if (!value) return;
      geoJson.value = value;
      refreshWarnings();
    });
    watch(warningList, refreshWarnings, { deep: true });

    onMounted(() => {
      if (!mapContainer.value) return;
      map.value = markRaw(
        new Map({
          container: mapContainer.value,
          style: createBaseMapStyle($q.dark.isActive),
          center: [121.51, 31.26],
          zoom: 8.8,
          preserveDrawingBuffer: true,
        })
      );
      map.value.addControl(new NavigationControl(), 'top-left');
      addUserLocationControl(map.value, 'top-left');
      map.value.addControl(new FullscreenControl(), 'top-left');
      map.value.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.value.once('load', () => {
        addLayers();
        if (legend.value)
          map.value?.addControl(new legend.value.MapLegend(), 'bottom-right');
        if (detail.value)
          map.value?.addControl(new detail.value.MapLegend(), 'top-right');
      });
    });

    watch(
      () => $q.dark.isActive,
      (dark) => applyBaseMapTheme(map.value, dark)
    );

    onBeforeUnmount(() => map.value?.remove());
    return { mapContainer, legend, detail };
  },
});
</script>

<style scoped>
.weather-map-wrapper,
.weather-map {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.map-card {
  max-width: 360px;
  padding: 12px;
  border: 1px solid var(--swos-border);
  background: var(--swos-map-card);
}
</style>
