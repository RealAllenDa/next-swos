<template>
  <div class="typhoon-map-wrapper">
    <div ref="mapContainer" class="typhoon-map"></div>
    <MLMapControl ref="typhoonDetail">
      <TyphoonDetail />
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
  LngLatBounds,
  Map,
  NavigationControl,
  Popup,
  ScaleControl,
  type CircleLayerSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuasar } from 'quasar';
import type { FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { useTyphoonStore } from 'stores/typhoon';
import MLMapControl from 'components/MLMapControl.vue';
import TyphoonDetail from 'components/TyphoonDetail.vue';
import { applyBaseMapTheme, createBaseMapStyle } from 'src/maps/base-style';
import { addUserLocationControl } from 'src/maps/user-location-control';

interface TyphoonMapData {
  nowcastPoints: FeatureCollection<Point>;
  forecastPoints: FeatureCollection<Point>;
  nowcastLines: FeatureCollection<LineString>;
  forecastLines: FeatureCollection<LineString>;
  windAreas: FeatureCollection<Polygon>;
}

export default defineComponent({
  name: 'TyphoonMap',
  components: { TyphoonDetail, MLMapControl },
  setup() {
    const $q = useQuasar();
    const store = useTyphoonStore();
    const mapContainer = ref<HTMLElement>();
    const map = shallowRef<Map>();
    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    });
    const typhoonDetail = ref<InstanceType<typeof MLMapControl>>();
    const currentTyphoons = computed(() => store.currentTyphoons);
    const forecastOrigins = computed(() => store.showTyphoonForecastOrigins);
    const currentIndex = computed(() => store.currentTyphoonIndex);

    function emptyCollection<
      G extends Point | LineString | Polygon
    >(): FeatureCollection<G> {
      return { type: 'FeatureCollection', features: [] };
    }

    function strengthColor(strength: string): string {
      if (strength.includes('Super') || strength.includes('超强'))
        return '#c2218e';
      if (strength.includes('STY') || strength.includes('强台风'))
        return '#fc4d80';
      if (strength.includes('TY') || strength.includes('台风'))
        return '#fb3b00';
      if (strength.includes('STS') || strength.includes('强热带风暴'))
        return '#fdae0d';
      if (strength.includes('TS') || strength.includes('热带风暴'))
        return '#fcfa00';
      if (strength.includes('TD') || strength.includes('热带低压'))
        return '#00d5cb';
      return '#fff';
    }

    function originColor(origin: string): string {
      const colors: Record<string, string> = {
        中国: '#ef4444',
        日本: '#22c55e',
        中国香港: '#f59e0b',
        中国台湾: '#e879f9',
        美国: '#22d3ee',
      };
      return colors[origin] ?? '#fff';
    }

    function coordinate(point: {
      longitude: string;
      latitude: string;
    }): [number, number] {
      return [Number(point.longitude), Number(point.latitude)];
    }

    function destination(
      center: [number, number],
      radiusKm: number,
      bearing: number
    ): [number, number] {
      const angular = radiusKm / 6371;
      const bearingRadians = (bearing * Math.PI) / 180;
      const latitude = (center[1] * Math.PI) / 180;
      const longitude = (center[0] * Math.PI) / 180;
      const resultLatitude = Math.asin(
        Math.sin(latitude) * Math.cos(angular) +
          Math.cos(latitude) * Math.sin(angular) * Math.cos(bearingRadians)
      );
      const resultLongitude =
        longitude +
        Math.atan2(
          Math.sin(bearingRadians) * Math.sin(angular) * Math.cos(latitude),
          Math.cos(angular) - Math.sin(latitude) * Math.sin(resultLatitude)
        );
      return [
        (resultLongitude * 180) / Math.PI,
        (resultLatitude * 180) / Math.PI,
      ];
    }

    function addWindQuadrants(
      collection: FeatureCollection<Polygon>,
      center: [number, number],
      radius: TyphoonWindRadius,
      windLevel: number
    ) {
      if (!radius) return;
      const quadrants = [
        { start: 0, radius: radius.ne },
        { start: 90, radius: radius.se },
        { start: 180, radius: radius.sw },
        { start: 270, radius: radius.nw },
      ];
      quadrants.forEach((quadrant) => {
        if (!Number.isFinite(quadrant.radius) || quadrant.radius <= 0) return;
        const coordinates: [number, number][] = [center];
        for (
          let bearing = quadrant.start;
          bearing <= quadrant.start + 90;
          bearing += 5
        ) {
          coordinates.push(destination(center, quadrant.radius, bearing));
        }
        coordinates.push(center);
        collection.features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coordinates] },
          properties: { windLevel },
        });
      });
    }

    function selectedNowcastPoint(
      detail: TyphoonDetail
    ): TyphoonPoints | undefined {
      if (currentIndex.value < 0)
        return detail.points[detail.points.length - 1];
      return detail.points[detail.points.length - 1 - currentIndex.value];
    }

    function buildMapData(): TyphoonMapData {
      const result: TyphoonMapData = {
        nowcastPoints: emptyCollection<Point>(),
        forecastPoints: emptyCollection<Point>(),
        nowcastLines: emptyCollection<LineString>(),
        forecastLines: emptyCollection<LineString>(),
        windAreas: emptyCollection<Polygon>(),
      };

      Object.entries(currentTyphoons.value).forEach(([id, detail]) => {
        const nowcastCoordinates = detail.points
          .map(coordinate)
          .filter(
            ([longitude, latitude]) =>
              Number.isFinite(longitude) && Number.isFinite(latitude)
          );
        detail.points.forEach((point, index) => {
          const selected =
            currentIndex.value >= 0 &&
            index === detail.points.length - 1 - currentIndex.value;
          result.nowcastPoints.features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coordinate(point) },
            properties: {
              id,
              name: detail.name,
              strength: point.strong,
              color: strengthColor(point.strong),
              selected,
              time: point.time,
            },
          });
        });
        if (nowcastCoordinates.length > 1) {
          result.nowcastLines.features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: nowcastCoordinates },
            properties: { id },
          });
        }

        const lastPoint = detail.points[detail.points.length - 1];
        if (!lastPoint) return;
        (lastPoint.forecast ?? []).forEach((forecast) => {
          if (!forecastOrigins.value.includes(forecast.sets)) return;
          const forecastPoints = forecast.points.filter(
            (point) =>
              point.time !== lastPoint.time ||
              point.latitude !== lastPoint.latitude ||
              point.longitude !== lastPoint.longitude
          );
          const lineCoordinates = [
            coordinate(lastPoint),
            ...forecastPoints.map(coordinate),
          ];
          forecastPoints.forEach((point, index) => {
            result.forecastPoints.features.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: coordinate(point) },
              properties: {
                id,
                name: detail.name,
                origin: forecast.sets,
                strength: point.strong,
                color: strengthColor(point.strong),
                selected:
                  currentIndex.value < 0 &&
                  index === Math.abs(currentIndex.value) - 1,
                time: point.time,
              },
            });
          });
          result.forecastLines.features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: lineCoordinates },
            properties: {
              id,
              origin: forecast.sets,
              color: originColor(forecast.sets),
            },
          });
        });

        const selected = selectedNowcastPoint(detail);
        if (selected) {
          const center = coordinate(selected);
          addWindQuadrants(result.windAreas, center, selected.radius7_quad, 7);
          addWindQuadrants(
            result.windAreas,
            center,
            selected.radius10_quad,
            10
          );
          addWindQuadrants(
            result.windAreas,
            center,
            selected.radius12_quad,
            12
          );
        }
      });
      return result;
    }

    function setSourceData(id: keyof TyphoonMapData, data: FeatureCollection) {
      (map.value?.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    }

    function fitData(data: TyphoonMapData) {
      if (!map.value) return;
      const coordinates = [
        ...data.nowcastPoints.features,
        ...data.forecastPoints.features,
      ].map((feature) => feature.geometry.coordinates as [number, number]);
      if (coordinates.length === 0) return;
      const bounds = coordinates.reduce(
        (result, point) => result.extend(point),
        new LngLatBounds(coordinates[0], coordinates[0])
      );
      map.value.fitBounds(bounds, { padding: 80, maxZoom: 8, duration: 500 });
    }

    function refreshLayers(fit = false) {
      if (!map.value?.isStyleLoaded()) return;
      const data = buildMapData();
      setSourceData('nowcastPoints', data.nowcastPoints);
      setSourceData('forecastPoints', data.forecastPoints);
      setSourceData('nowcastLines', data.nowcastLines);
      setSourceData('forecastLines', data.forecastLines);
      setSourceData('windAreas', data.windAreas);
      if (fit) fitData(data);
    }

    function addLayers() {
      const currentMap = map.value;
      if (!currentMap) return;
      const data = buildMapData();
      Object.entries(data).forEach(([id, collection]) =>
        currentMap.addSource(id, { type: 'geojson', data: collection })
      );
      currentMap.addSource('attention-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [127, 34],
                  [127, 22],
                  [110, 15],
                ],
              },
              properties: { color: '#fde047' },
            },
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [132, 34],
                  [132, 22],
                  [125, 15],
                  [110, 15],
                ],
              },
              properties: { color: '#7dd3fc' },
            },
          ],
        },
      });
      currentMap.addLayer({
        id: 'wind-areas',
        type: 'fill',
        source: 'windAreas',
        paint: {
          'fill-color': [
            'match',
            ['get', 'windLevel'],
            7,
            '#fff500',
            10,
            '#ff4600',
            12,
            '#b40068',
            '#fff',
          ],
          'fill-opacity': 0.25,
        },
      });
      currentMap.addLayer({
        id: 'attention-lines',
        type: 'line',
        source: 'attention-lines',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1 },
      });
      currentMap.addLayer({
        id: 'nowcast-lines',
        type: 'line',
        source: 'nowcastLines',
        paint: { 'line-color': '#fff', 'line-width': 3 },
      });
      currentMap.addLayer({
        id: 'forecast-lines',
        type: 'line',
        source: 'forecastLines',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
      const pointPaint: CircleLayerSpecification['paint'] = {
        'circle-color': ['get', 'color'],
        'circle-radius': [
          'case',
          ['boolean', ['get', 'selected'], false],
          10,
          6,
        ],
        'circle-stroke-color': '#27272a',
        'circle-stroke-width': [
          'case',
          ['boolean', ['get', 'selected'], false],
          4,
          2,
        ],
      };
      currentMap.addLayer({
        id: 'nowcast-points',
        type: 'circle',
        source: 'nowcastPoints',
        paint: pointPaint,
      });
      currentMap.addLayer({
        id: 'forecast-points',
        type: 'circle',
        source: 'forecastPoints',
        paint: pointPaint,
      });

      const showPopup = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) {
          currentMap.getCanvas().style.cursor = '';
          hoverPopup.remove();
          return;
        }
        currentMap.getCanvas().style.cursor = 'pointer';
        const content = document.createElement('div');
        content.textContent = `${feature.properties.name} · ${feature.properties.time} · ${feature.properties.strength}`;
        hoverPopup
          .setLngLat(event.lngLat)
          .setDOMContent(content)
          .addTo(currentMap);
      };
      currentMap.on('mousemove', 'nowcast-points', showPopup);
      currentMap.on('mousemove', 'forecast-points', showPopup);
      const hidePopup = () => {
        currentMap.getCanvas().style.cursor = '';
        hoverPopup.remove();
      };
      currentMap.on('mouseleave', 'nowcast-points', hidePopup);
      currentMap.on('mouseleave', 'forecast-points', hidePopup);
      fitData(data);
    }

    watch(currentTyphoons, () => refreshLayers(true));
    watch(forecastOrigins, () => refreshLayers(true));
    watch(currentIndex, () => refreshLayers(false));

    onMounted(() => {
      if (!mapContainer.value) return;
      map.value = markRaw(
        new Map({
          container: mapContainer.value,
          style: createBaseMapStyle($q.dark.isActive),
          center: [120.29, 31.59],
          zoom: 4.5,
        })
      );
      map.value.addControl(new NavigationControl(), 'top-left');
      addUserLocationControl(map.value, 'top-left');
      map.value.addControl(new FullscreenControl(), 'top-left');
      map.value.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.value.once('load', () => {
        addLayers();
        if (typhoonDetail.value)
          map.value?.addControl(
            new typhoonDetail.value.MapLegend(),
            'top-right'
          );
      });
    });
    watch(
      () => $q.dark.isActive,
      (dark) => applyBaseMapTheme(map.value, dark)
    );
    onBeforeUnmount(() => map.value?.remove());

    return { mapContainer, typhoonDetail };
  },
});
</script>

<style scoped>
.typhoon-map-wrapper,
.typhoon-map {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
