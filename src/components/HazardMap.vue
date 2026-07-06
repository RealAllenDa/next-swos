<template>
  <div ref="container" class="hazard-map" aria-label="灾害监测地图"></div>
</template>

<script lang="ts">
import {
  defineComponent,
  markRaw,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from 'vue';
import {
  FullscreenControl,
  Map,
  NavigationControl,
  Popup,
  ScaleControl,
  type GeoJSONSource,
  type ExpressionSpecification,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useQuasar } from 'quasar';
import { applyBaseMapTheme, createBaseMapStyle } from 'src/maps/base-style';
import {
  emptyFeatureCollection,
  floodStationLevel,
  maximumRiverLevel,
  pointFeature,
  validCoordinate,
} from 'src/composables/hazard-utils';

type MapData = {
  areas: FeatureCollection;
  points: FeatureCollection<Point>;
  directions: FeatureCollection<LineString>;
  rivers: FeatureCollection;
};

export default defineComponent({
  name: 'HazardMap',
  props: {
    mode: { type: String as PropType<HazardMode>, required: true },
    data: { type: Object as PropType<HazardApiState | null>, default: null },
    areaGeoJson: {
      type: Object as PropType<HazardGeoJSON | null>,
      default: null,
    },
    riverGeoJson: {
      type: Object as PropType<HazardGeoJSON | null>,
      default: null,
    },
    designatedOnly: { type: Boolean, default: true },
  },
  emits: ['selectFeature'],
  setup(props) {
    const $q = useQuasar();
    const container = ref<HTMLElement>();
    const map = shallowRef<Map>();
    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      maxWidth: '320px',
    });
    let resizeObserver: ResizeObserver | undefined;

    const levelColor = [
      'match',
      ['get', 'level'],
      1,
      '#1e90ff',
      2,
      '#eee414',
      3,
      '#f59e0b',
      4,
      '#ef4444',
      5,
      '#b31ab1',
      6,
      '#111827',
      '#9ca3af',
    ] as ExpressionSpecification;

    function cloneCollection(value: HazardGeoJSON | null): FeatureCollection {
      if (!value || value.type !== 'FeatureCollection')
        return emptyFeatureCollection();
      return JSON.parse(JSON.stringify(value)) as FeatureCollection;
    }

    function areaLevels(): Record<string, number> {
      const levels: Record<string, number> = {};
      if (!props.data) return levels;

      if (props.mode.startsWith('rain-')) {
        const state = props.data as RainState;
        for (const observation of state.rain ?? []) {
          const level =
            props.mode === 'rain-period'
              ? observation.period ?? 0
              : observation.level;
          levels[observation.area] = Math.max(
            levels[observation.area] ?? 0,
            level
          );
        }
      } else if (props.mode === 'flood-warning') {
        levels['上海市'] = (props.data as FloodWarningState).flood;
      }
      return levels;
    }

    function buildAreas(): FeatureCollection {
      const collection = cloneCollection(props.areaGeoJson);
      const levels = areaLevels();
      collection.features.forEach((feature) => {
        feature.properties ??= {};
        const name = String(feature.properties.name ?? '');
        const isShanghai =
          feature.properties.adcode === 310000 ||
          feature.properties.parent?.adcode === 310000;
        feature.properties.level =
          levels[name] ??
          (props.mode === 'flood-warning' && isShanghai
            ? levels['上海市'] ?? 0
            : 0);
      });
      return collection;
    }

    function buildPoints(): FeatureCollection<Point> {
      const collection = emptyFeatureCollection<Point>();
      if (!props.data) return collection;

      if (props.mode.startsWith('rain-')) {
        for (const item of (props.data as RainState).rain ?? []) {
          if (!validCoordinate(item.longitude, item.latitude)) continue;
          const level =
            props.mode === 'rain-period' ? item.period ?? 0 : item.level;
          if (level === 0) continue;
          collection.features.push(
            pointFeature(item.longitude, item.latitude, {
              id: item.id,
              name: item.name,
              area: item.area,
              level,
              detail: `${item.value} mm`,
            })
          );
        }
      } else if (props.mode === 'wind') {
        Object.entries((props.data as WindState).wind ?? {}).forEach(
          ([area, observations]) => {
            observations.forEach((item) => {
              if (!validCoordinate(item.longitude, item.latitude)) return;
              if (item.level === 0) return;
              collection.features.push(
                pointFeature(item.longitude, item.latitude, {
                  id: item.id,
                  name: item.name,
                  area,
                  level: item.level,
                  degrees: item.degrees,
                  detail: `${item.speed} m/s · ${item.direction} · ${item.wind_level}级风`,
                })
              );
            });
          }
        );
      } else if (props.mode === 'inundation') {
        Object.entries(
          (props.data as InundationState).inundation ?? {}
        ).forEach(([area, observations]) => {
          observations.forEach((item) => {
            if (!validCoordinate(item.longitude, item.latitude)) return;
            if (item.level === 0) return;
            collection.features.push(
              pointFeature(item.longitude, item.latitude, {
                id: item.id,
                name: item.name,
                area,
                level: item.level,
                detail: `${item.water_level} cm`,
              })
            );
          });
        });
      } else if (
        props.mode === 'flood-stations' ||
        props.mode === 'flood-rivers'
      ) {
        Object.entries((props.data as FloodState).station ?? {}).forEach(
          ([name, item]) => {
            if (!validCoordinate(item.longitude, item.latitude)) return;
            const level = floodStationLevel(item);
            if (level === 0) return;
            collection.features.push(
              pointFeature(item.longitude, item.latitude, {
                id: name,
                name,
                area: item.original_river,
                level,
                detail: `${item.current_level} m`,
              })
            );
          }
        );
      }
      return collection;
    }

    function buildDirections(
      points: FeatureCollection<Point>
    ): FeatureCollection<LineString> {
      const collection = emptyFeatureCollection<LineString>();
      if (props.mode !== 'wind') return collection;

      points.features.forEach((point) => {
        const [longitude, latitude] = point.geometry.coordinates;
        const radians =
          (Number(point.properties?.degrees ?? 0) * Math.PI) / 180;
        const distanceKm = Math.max(
          1.5,
          Number(String(point.properties?.detail ?? '').split(' ')[0]) * 0.8
        );
        const endLatitude = latitude + (Math.cos(radians) * distanceKm) / 111;
        const endLongitude =
          longitude +
          (Math.sin(radians) * distanceKm) /
            (111 * Math.cos((latitude * Math.PI) / 180));
        collection.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [longitude, latitude],
              [endLongitude, endLatitude],
            ],
          },
          properties: { level: point.properties?.level ?? 0 },
        });
      });
      return collection;
    }

    function buildRivers(): FeatureCollection {
      const collection = cloneCollection(props.riverGeoJson);
      const floodState =
        props.data &&
        (props.mode === 'flood-rivers' || props.mode === 'flood-stations')
          ? (props.data as FloodState)
          : null;
      const warningState =
        props.data && props.mode === 'flood-warning'
          ? (props.data as FloodWarningState)
          : null;

      collection.features = collection.features.filter((feature) => {
        feature.properties ??= {};
        const name = String(feature.properties.name ?? '');
        const important = Boolean(feature.properties.important);
        if (props.mode === 'flood-rivers' && props.designatedOnly && !important)
          return false;
        if (warningState) {
          feature.properties.level = name.includes('黄浦江')
            ? warningState.water_level
            : 0;
        } else {
          feature.properties.level = floodState?.flood[name]
            ? maximumRiverLevel(floodState.flood[name])
            : 0;
        }
        return true;
      });
      return collection;
    }

    function buildMapData(): MapData {
      const points = buildPoints();
      return {
        areas: buildAreas(),
        points,
        directions: buildDirections(points),
        rivers: buildRivers(),
      };
    }

    function setSourceData(sourceId: string, data: FeatureCollection) {
      (map.value?.getSource(sourceId) as GeoJSONSource | undefined)?.setData(
        data
      );
    }

    function refreshLayers() {
      if (!map.value?.isStyleLoaded()) return;
      const data = buildMapData();
      setSourceData('hazard-areas', data.areas);
      setSourceData('hazard-points', data.points);
      setSourceData('hazard-directions', data.directions);
      setSourceData('hazard-rivers', data.rivers);
    }

    function addDataLayers() {
      if (!map.value) return;
      const initial = buildMapData();
      map.value.addSource('hazard-areas', {
        type: 'geojson',
        data: initial.areas,
      });
      map.value.addSource('hazard-rivers', {
        type: 'geojson',
        data: initial.rivers,
      });
      map.value.addSource('hazard-directions', {
        type: 'geojson',
        data: initial.directions,
      });
      map.value.addSource('hazard-points', {
        type: 'geojson',
        data: initial.points,
      });

      map.value.addLayer({
        id: 'hazard-area-fill',
        type: 'fill',
        source: 'hazard-areas',
        paint: {
          'fill-color': levelColor,
          'fill-opacity': ['case', ['>', ['get', 'level'], 0], 0.42, 0.08],
        },
      });
      map.value.addLayer({
        id: 'hazard-area-outline',
        type: 'line',
        source: 'hazard-areas',
        paint: { 'line-color': '#4b5563', 'line-width': 1 },
      });
      map.value.addLayer({
        id: 'hazard-river-lines',
        type: 'line',
        source: 'hazard-rivers',
        paint: {
          'line-color': levelColor,
          'line-width': [
            'case',
            ['boolean', ['get', 'important'], false],
            6,
            2,
          ],
          'line-opacity': 0.9,
        },
      });
      map.value.addLayer({
        id: 'hazard-direction-lines',
        type: 'line',
        source: 'hazard-directions',
        paint: { 'line-color': levelColor, 'line-width': 3 },
      });
      map.value.addLayer({
        id: 'hazard-point-circles',
        type: 'circle',
        source: 'hazard-points',
        paint: {
          'circle-color': levelColor,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4, 12, 9],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-opacity': ['case', ['>', ['get', 'level'], 0], 0.95, 0.35],
        },
      });
    }

    function featurePopup(event: MapMouseEvent, features: MapGeoJSONFeature[]) {
      const currentMap = map.value;
      if (!currentMap || features.length === 0) {
        if (currentMap) currentMap.getCanvas().style.cursor = '';
        hoverPopup.remove();
        return;
      }
      currentMap.getCanvas().style.cursor = 'pointer';
      const wrapper = document.createElement('div');
      const seen = new Set<string>();
      features.slice(0, 8).forEach((feature) => {
        const properties = feature.properties;
        const isArea = feature.layer.id === 'hazard-area-fill';
        const isRiver = feature.layer.id === 'hazard-river-lines';
        const category = isArea ? '区域' : isRiver ? '河流' : '监测点';
        const name = String(properties.name ?? category);
        const detail = isArea
          ? Number(properties.level ?? 0) > 0
            ? `${properties.level} 级状态`
            : '当前正常'
          : [properties.area, properties.detail].filter(Boolean).join(' · ');
        const key = `${category}|${name}|${detail}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (wrapper.childNodes.length > 0) {
          const separator = document.createElement('div');
          separator.style.cssText =
            'height:1px;margin:7px 0;background:var(--swos-border)';
          wrapper.append(separator);
        }
        const title = document.createElement('strong');
        title.textContent = `${category} · ${name}`;
        wrapper.append(title);
        if (detail) {
          const detailElement = document.createElement('div');
          detailElement.textContent = detail;
          wrapper.append(detailElement);
        }
      });
      hoverPopup
        .setLngLat(event.lngLat)
        .setDOMContent(wrapper)
        .addTo(currentMap);
    }

    onMounted(() => {
      if (!container.value) return;
      map.value = markRaw(
        new Map({
          container: container.value,
          style: createBaseMapStyle($q.dark.isActive),
          center:
            props.mode === 'inundation' ? [121.4854, 31.283] : [121.51, 31.26],
          zoom: props.mode === 'inundation' ? 10.5 : 8.7,
          minZoom: 4,
          maxZoom: 16,
        })
      );
      map.value.addControl(new NavigationControl(), 'top-left');
      map.value.addControl(new FullscreenControl(), 'top-left');
      map.value.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.value.once('load', addDataLayers);
      map.value.on('mousemove', (event) => {
        const currentMap = map.value;
        if (!currentMap || !currentMap.isStyleLoaded()) return;
        const layers = [
          'hazard-point-circles',
          'hazard-river-lines',
          'hazard-area-fill',
        ].filter((id) => currentMap.getLayer(id));
        const features = currentMap.queryRenderedFeatures(event.point, {
          layers,
        });
        featurePopup(event, features);
      });
      map.value.on('mouseout', () => {
        if (map.value) map.value.getCanvas().style.cursor = '';
        hoverPopup.remove();
      });

      resizeObserver = new ResizeObserver(() => map.value?.resize());
      resizeObserver.observe(container.value);
    });

    watch(
      () => [
        props.data,
        props.areaGeoJson,
        props.riverGeoJson,
        props.designatedOnly,
      ],
      refreshLayers,
      { deep: false }
    );

    watch(
      () => props.mode,
      (mode) => {
        refreshLayers();
        map.value?.flyTo({
          center: mode === 'inundation' ? [121.4854, 31.283] : [121.51, 31.26],
          zoom: mode === 'inundation' ? 10.5 : 8.7,
          duration: 400,
        });
      }
    );
    watch(
      () => $q.dark.isActive,
      (dark) => applyBaseMapTheme(map.value, dark)
    );

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      map.value?.remove();
    });

    return { container };
  },
});
</script>

<style scoped>
.hazard-map {
  min-height: 480px;
  width: 100%;
  height: 100%;
}
</style>
