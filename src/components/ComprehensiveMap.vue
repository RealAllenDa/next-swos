<template>
  <div class="overview-map-shell">
    <div ref="mapContainer" class="overview-map"></div>

    <q-btn
      v-if="!layerPanelOpen"
      aria-label="打开综合图层"
      class="layer-toggle"
      color="primary"
      icon="layers"
      round
      @click="layerPanelOpen = true"
    >
      <q-tooltip>综合图层</q-tooltip>
    </q-btn>

    <q-card v-show="layerPanelOpen" bordered class="layer-panel">
      <q-card-section class="q-pa-sm">
        <div class="row items-center no-wrap">
          <div>
            <div class="text-subtitle1 text-weight-medium">综合图层</div>
            <div class="text-caption text-grey-7">悬停要素可查看详情</div>
          </div>
          <q-space />
          <q-btn
            aria-label="定位上海"
            dense
            flat
            icon="my_location"
            round
            @click="focusShanghai"
          >
            <q-tooltip>定位上海</q-tooltip>
          </q-btn>
          <q-btn
            :disable="typhoonCoordinates.length === 0"
            aria-label="查看台风"
            dense
            flat
            icon="fa-solid fa-hurricane"
            round
            @click="focusTyphoons"
          >
            <q-tooltip>查看台风</q-tooltip>
          </q-btn>
          <q-btn
            aria-label="收起综合图层"
            dense
            flat
            icon="close"
            round
            @click="layerPanelOpen = false"
          />
        </div>
      </q-card-section>
      <q-separator />
      <q-list dense>
        <template v-for="group in layerGroups" :key="group.id">
          <q-item-label class="layer-category" header>
            <q-icon :name="group.icon" />
            <span>{{ group.label }}</span>
          </q-item-label>
          <q-item v-for="layer in group.layers" :key="layer.id" tag="label">
            <q-item-section avatar>
              <q-icon :color="layer.color" :name="layer.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ layer.name }}</q-item-label>
              <q-item-label caption>{{ layer.countLabel }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                v-model="visibleLayers[layer.id]"
                :aria-label="`切换${layer.name}`"
                :disable="!layer.available"
                dense
              />
            </q-item-section>
          </q-item>
        </template>
      </q-list>
      <q-separator />
      <!--      <q-card-section class="q-pa-sm text-caption text-grey-7">-->
      <!--        雷达数据：<a-->
      <!--          href="https://www.rainviewer.com/"-->
      <!--          target="_blank"-->
      <!--          rel="noopener"-->
      <!--          >RainViewer</a-->
      <!--        >-->
      <!--      </q-card-section>-->
    </q-card>
  </div>
</template>

<script lang="ts" setup>
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {
  type ExpressionSpecification,
  FullscreenControl,
  type GeoJSONSource,
  LngLatBounds,
  Map,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  NavigationControl,
  Popup,
  ScaleControl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { useQuasar } from 'quasar';
import { applyBaseMapTheme, createBaseMapStyle } from 'src/maps/base-style';
import {
  emptyFeatureCollection,
  floodStationLevel,
  maximumRiverLevel,
  pointFeature,
  validCoordinate,
} from 'src/composables/hazard-utils';

const props = defineProps<{ data: DashboardData }>();
const $q = useQuasar();
const mapContainer = ref<HTMLElement>();
const map = shallowRef<Map>();
const layerPanelOpen = ref($q.screen.gt.xs);
const hoverPopup = new Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 12,
  maxWidth: '340px',
});
let resizeObserver: ResizeObserver | undefined;

const visibleLayers = reactive<Record<DashboardLayerId, boolean>>({
  radar: true,
  weatherWarnings: true,
  rain1h: true,
  rain24h: false,
  wind: false,
  inundation: true,
  rivers: true,
  stations: true,
  typhoons: true,
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
const layerIds: Record<DashboardLayerId, string[]> = {
  radar: ['dashboard-radar'],
  weatherWarnings: [
    'dashboard-warning-fill',
    'dashboard-flood-boundary',
    'dashboard-area-outline',
  ],
  rain1h: ['dashboard-rain-1h'],
  rain24h: ['dashboard-rain-24h'],
  wind: ['dashboard-wind-lines', 'dashboard-wind-points'],
  inundation: ['dashboard-inundation'],
  rivers: ['dashboard-rivers'],
  stations: ['dashboard-stations'],
  typhoons: ['dashboard-typhoon-lines', 'dashboard-typhoon-points'],
};

function cloneCollection(value: HazardGeoJSON | null): FeatureCollection {
  if (!value || value.type !== 'FeatureCollection')
    return emptyFeatureCollection();
  return JSON.parse(JSON.stringify(value)) as FeatureCollection;
}

function normalizedDistrictName(feature: Feature): string {
  const name = String(feature.properties?.name ?? '');
  return centralDistricts.includes(name) ? '上海市' : name;
}

function areaCollection(): FeatureCollection {
  const collection = cloneCollection(props.data.geography);
  const floodLevel = props.data.floodWarning?.flood ?? 0;
  collection.features.forEach((feature) => {
    feature.properties ??= {};
    const isShanghai =
      feature.properties.adcode === 310000 ||
      feature.properties.parent?.adcode === 310000;
    feature.properties.weatherLevel =
      props.data.weatherWarnings?.coloring?.[normalizedDistrictName(feature)] ??
      0;
    feature.properties.floodLevel = isShanghai ? floodLevel : 0;
  });
  return collection;
}

function rainCollection(
  state: RainState | null,
  usePeriod = false
): FeatureCollection<Point> {
  const collection = emptyFeatureCollection<Point>();
  (state?.rain ?? []).forEach((item) => {
    const level = usePeriod ? item.period ?? 0 : item.level;
    if (level === 0 || !validCoordinate(item.longitude, item.latitude)) return;
    collection.features.push(
      pointFeature(item.longitude, item.latitude, {
        category: '降雨',
        name: item.name,
        area: item.area,
        detail: `${item.value} mm`,
        level,
      })
    );
  });
  return collection;
}

function windCollections(): {
  points: FeatureCollection<Point>;
  lines: FeatureCollection<LineString>;
} {
  const points = emptyFeatureCollection<Point>();
  const lines = emptyFeatureCollection<LineString>();
  Object.entries(props.data.wind?.wind ?? {}).forEach(
    ([area, observations]) => {
      observations.forEach((item) => {
        if (item.level === 0 || !validCoordinate(item.longitude, item.latitude))
          return;
        points.features.push(
          pointFeature(item.longitude, item.latitude, {
            category: '风速风向',
            name: item.name,
            area,
            detail: `${item.speed} m/s · ${item.direction} · ${item.wind_level}级风`,
            level: item.level,
          })
        );
        const radians = (item.degrees * Math.PI) / 180;
        const distanceKm = Math.max(1.5, item.speed * 0.8);
        const endLatitude =
          item.latitude + (Math.cos(radians) * distanceKm) / 111;
        const endLongitude =
          item.longitude +
          (Math.sin(radians) * distanceKm) /
            (111 * Math.cos((item.latitude * Math.PI) / 180));
        lines.features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [item.longitude, item.latitude],
              [endLongitude, endLatitude],
            ],
          },
          properties: { level: item.level },
        });
      });
    }
  );
  return { points, lines };
}

function inundationCollection(): FeatureCollection<Point> {
  const collection = emptyFeatureCollection<Point>();
  Object.entries(props.data.inundation?.inundation ?? {}).forEach(
    ([area, observations]) => {
      observations.forEach((item) => {
        if (item.level === 0 || !validCoordinate(item.longitude, item.latitude))
          return;
        collection.features.push(
          pointFeature(item.longitude, item.latitude, {
            category: '道路积水',
            name: item.name,
            area,
            detail: `${item.water_level} cm`,
            level: item.level,
          })
        );
      });
    }
  );
  return collection;
}

function riverCollection(): FeatureCollection {
  const collection = cloneCollection(props.data.rivers);
  collection.features.forEach((feature) => {
    feature.properties ??= {};
    const name = String(feature.properties.name ?? '');
    const riverState = props.data.flood?.flood?.[name];
    feature.properties.level = riverState ? maximumRiverLevel(riverState) : 0;
  });
  return collection;
}

function stationCollection(): FeatureCollection<Point> {
  const collection = emptyFeatureCollection<Point>();
  Object.entries(props.data.flood?.station ?? {}).forEach(([name, station]) => {
    const level = floodStationLevel(station);
    if (level === 0 || !validCoordinate(station.longitude, station.latitude))
      return;
    collection.features.push(
      pointFeature(station.longitude, station.latitude, {
        category: '水位站',
        name,
        area: station.original_river,
        detail: `${station.current_level} m`,
        level,
      })
    );
  });
  return collection;
}

function typhoonCollections(): {
  points: FeatureCollection<Point>;
  lines: FeatureCollection<LineString>;
} {
  const points = emptyFeatureCollection<Point>();
  const lines = emptyFeatureCollection<LineString>();
  Object.entries(props.data.typhoons).forEach(([id, detail]) => {
    const coordinates = detail.points
      .map(
        (point) =>
          [Number(point.longitude), Number(point.latitude)] as [number, number]
      )
      .filter(
        ([longitude, latitude]) =>
          Number.isFinite(longitude) && Number.isFinite(latitude)
      );
    if (coordinates.length > 1) {
      lines.features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { id, forecast: false, color: '#fff' },
      });
    }
    const current = detail.points.at(-1);
    if (!current) return;
    points.features.push(
      pointFeature(Number(current.longitude), Number(current.latitude), {
        category: '台风',
        name: `${detail.name} (${id})`,
        detail: `${current.strong} · ${current.time}`,
        color: strengthColor(current.strong),
        current: true,
      })
    );
    (current.forecast ?? []).forEach((forecast) => {
      const forecastCoordinates = forecast.points
        .map(
          (point) =>
            [Number(point.longitude), Number(point.latitude)] as [
              number,
              number
            ]
        )
        .filter(
          ([longitude, latitude]) =>
            Number.isFinite(longitude) && Number.isFinite(latitude)
        );
      if (forecastCoordinates.length === 0) return;
      lines.features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [Number(current.longitude), Number(current.latitude)],
            ...forecastCoordinates,
          ],
        },
        properties: { id, forecast: true, color: forecastColor(forecast.sets) },
      });
    });
  });
  return { points, lines };
}

function strengthColor(strength: string): string {
  if (strength.includes('Super') || strength.includes('超强')) return '#c2218e';
  if (strength.includes('STY') || strength.includes('强台风')) return '#fc4d80';
  if (strength.includes('TY') || strength.includes('台风')) return '#fb3b00';
  if (strength.includes('STS') || strength.includes('强热带风暴'))
    return '#fdae0d';
  if (strength.includes('TS') || strength.includes('热带风暴'))
    return '#fcfa00';
  return '#00d5cb';
}

function forecastColor(origin: string): string {
  return (
    (
      {
        中国: '#ef4444',
        日本: '#22c55e',
        中国香港: '#f59e0b',
        中国台湾: '#e879f9',
        美国: '#22d3ee',
      } as Record<string, string>
    )[origin] ?? '#fff'
  );
}

const typhoonCoordinates = computed(() =>
  Object.values(props.data.typhoons)
    .flatMap((detail) =>
      detail.points.map(
        (point) =>
          [Number(point.longitude), Number(point.latitude)] as [number, number]
      )
    )
    .filter(
      ([longitude, latitude]) =>
        Number.isFinite(longitude) && Number.isFinite(latitude)
    )
);

const latestRadar = computed(() => props.data.radar?.radar.past.at(-1) ?? null);
const layerOptions = computed(() => {
  const weatherCount = Object.values(
    props.data.weatherWarnings?.districts ?? {}
  ).reduce((total, warnings) => total + warnings.length, 0);
  const rain1hCount = (props.data.rain1h?.rain ?? []).filter(
    (item) => item.level > 0
  ).length;
  const rain24hCount = (props.data.rain24h?.rain ?? []).filter(
    (item) => item.level > 0
  ).length;
  const windCount = Object.values(props.data.wind?.wind ?? {})
    .flat()
    .filter((item) => item.level > 0).length;
  const inundationCount = Object.values(props.data.inundation?.inundation ?? {})
    .flat()
    .filter((item) => item.level > 0).length;
  const riverCount = Object.values(props.data.flood?.flood ?? {}).filter(
    (river) => maximumRiverLevel(river) > 0
  ).length;
  const stationCount = Object.values(props.data.flood?.station ?? {}).filter(
    (station) => floodStationLevel(station) > 0
  ).length;
  return [
    {
      id: 'radar',
      name: '天气雷达',
      icon: 'fa-solid fa-cloud-rain',
      color: 'blue',
      available: Boolean(latestRadar.value),
      countLabel: latestRadar.value
        ? new Date(latestRadar.value.time * 1000).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '暂无数据',
    },
    {
      id: 'weatherWarnings',
      name: '预警区域',
      icon: 'fa-solid fa-triangle-exclamation',
      color: 'orange',
      available: Boolean(props.data.geography),
      countLabel: `${weatherCount} 条天气预警`,
    },
    {
      id: 'rain1h',
      name: '1小时降雨',
      icon: 'fa-solid fa-cloud-rain',
      color: 'cyan',
      available: Boolean(props.data.rain1h),
      countLabel: `${rain1hCount} 个有雨站点`,
    },
    {
      id: 'rain24h',
      name: '24小时降雨',
      icon: 'fa-solid fa-cloud-showers-heavy',
      color: 'indigo',
      available: Boolean(props.data.rain24h),
      countLabel: `${rain24hCount} 个有雨站点`,
    },
    {
      id: 'wind',
      name: '风速风向',
      icon: 'fa-solid fa-wind',
      color: 'teal',
      available: Boolean(props.data.wind),
      countLabel: `${windCount} 个有风站点`,
    },
    {
      id: 'inundation',
      name: '道路积水',
      icon: 'fa-solid fa-house-flood-water',
      color: 'deep-orange',
      available: Boolean(props.data.inundation),
      countLabel: `${inundationCount} 个积水点`,
    },
    {
      id: 'rivers',
      name: '河流水位',
      icon: 'fa-solid fa-water',
      color: 'blue',
      available: Boolean(props.data.rivers),
      countLabel: `${riverCount} 条异常河流`,
    },
    {
      id: 'stations',
      name: '异常水位站',
      icon: 'fa-solid fa-gauge-high',
      color: 'purple',
      available: Boolean(props.data.flood),
      countLabel: `${stationCount} 个站点`,
    },
    {
      id: 'typhoons',
      name: '台风路径',
      icon: 'fa-solid fa-hurricane',
      color: 'red',
      available: typhoonCoordinates.value.length > 0,
      countLabel: `${Object.keys(props.data.typhoons).length} 个活动台风`,
    },
  ] as Array<{
    id: DashboardLayerId;
    name: string;
    icon: string;
    color: string;
    available: boolean;
    countLabel: string;
  }>;
});
const layerGroups = computed(() =>
  [
    {
      id: 'status',
      label: '实况与预警',
      icon: 'campaign',
      layers: layerOptions.value.filter((layer) =>
        (['radar', 'weatherWarnings'] as DashboardLayerId[]).includes(layer.id)
      ),
    },
    {
      id: 'rain-wind',
      label: '降雨与风',
      icon: 'thunderstorm',
      layers: layerOptions.value.filter((layer) =>
        (['rain1h', 'rain24h', 'wind'] as DashboardLayerId[]).includes(layer.id)
      ),
    },
    {
      id: 'water',
      label: '水情与积水',
      icon: 'waves',
      layers: layerOptions.value.filter((layer) =>
        (['inundation', 'rivers', 'stations'] as DashboardLayerId[]).includes(
          layer.id
        )
      ),
    },
    {
      id: 'typhoon',
      label: '台风',
      icon: 'fa-solid fa-hurricane',
      layers: layerOptions.value.filter((layer) => layer.id === 'typhoons'),
    },
  ].filter((group) => group.layers.length > 0)
);

function setSourceData(id: string, data: FeatureCollection) {
  (map.value?.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

function refreshGeoJsonSources() {
  if (!map.value?.isStyleLoaded()) return;
  const wind = windCollections();
  const typhoons = typhoonCollections();
  setSourceData('dashboard-areas', areaCollection());
  setSourceData('dashboard-rain-1h', rainCollection(props.data.rain1h));
  setSourceData('dashboard-rain-24h', rainCollection(props.data.rain24h));
  setSourceData('dashboard-wind-points', wind.points);
  setSourceData('dashboard-wind-lines', wind.lines);
  setSourceData('dashboard-inundation', inundationCollection());
  setSourceData('dashboard-rivers', riverCollection());
  setSourceData('dashboard-stations', stationCollection());
  setSourceData('dashboard-typhoon-points', typhoons.points);
  setSourceData('dashboard-typhoon-lines', typhoons.lines);
}

function refreshRadar() {
  const currentMap = map.value;
  if (!currentMap?.isStyleLoaded()) return;
  if (currentMap.getLayer('dashboard-radar'))
    currentMap.removeLayer('dashboard-radar');
  if (currentMap.getSource('dashboard-radar'))
    currentMap.removeSource('dashboard-radar');
  const frame = latestRadar.value;
  const radar = props.data.radar;
  if (!frame || !radar) return;
  currentMap.addSource('dashboard-radar', {
    type: 'raster',
    tiles: [`${radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`],
    tileSize: 256,
    maxzoom: 7,
    attribution:
      'Weather data by <a href="https://www.rainviewer.com/">RainViewer</a>',
  });
  currentMap.addLayer(
    {
      id: 'dashboard-radar',
      type: 'raster',
      source: 'dashboard-radar',
      layout: { visibility: visibleLayers.radar ? 'visible' : 'none' },
      paint: { 'raster-opacity': 0.58, 'raster-fade-duration': 300 },
    },
    'dashboard-warning-fill'
  );
}

function addSourcesAndLayers() {
  const currentMap = map.value;
  if (!currentMap) return;
  const wind = windCollections();
  const typhoons = typhoonCollections();
  const sources: Record<string, FeatureCollection> = {
    'dashboard-areas': areaCollection(),
    'dashboard-rain-1h': rainCollection(props.data.rain1h),
    'dashboard-rain-24h': rainCollection(props.data.rain24h),
    'dashboard-wind-points': wind.points,
    'dashboard-wind-lines': wind.lines,
    'dashboard-inundation': inundationCollection(),
    'dashboard-rivers': riverCollection(),
    'dashboard-stations': stationCollection(),
    'dashboard-typhoon-points': typhoons.points,
    'dashboard-typhoon-lines': typhoons.lines,
  };
  Object.entries(sources).forEach(([id, data]) =>
    currentMap.addSource(id, { type: 'geojson', data })
  );

  const levelColor: ExpressionSpecification = [
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
  ];
  currentMap.addLayer({
    id: 'dashboard-warning-fill',
    type: 'fill',
    source: 'dashboard-areas',
    paint: {
      'fill-color': [
        'match',
        ['get', 'weatherLevel'],
        1,
        '#41a0f8',
        2,
        '#f3e843',
        3,
        '#f8a931',
        4,
        '#f74e3b',
        '#000',
      ],
      'fill-opacity': ['case', ['>', ['get', 'weatherLevel'], 0], 0.38, 0],
    },
  });
  currentMap.addLayer({
    id: 'dashboard-area-outline',
    type: 'line',
    source: 'dashboard-areas',
    paint: { 'line-color': '#64748b', 'line-width': 0.8, 'line-opacity': 0.55 },
  });
  currentMap.addLayer({
    id: 'dashboard-flood-boundary',
    type: 'line',
    source: 'dashboard-areas',
    paint: {
      'line-color': [
        'match',
        ['get', 'floodLevel'],
        1,
        '#41a0f8',
        2,
        '#f3e843',
        3,
        '#f8a931',
        4,
        '#f74e3b',
        '#000',
      ],
      'line-width': ['case', ['>', ['get', 'floodLevel'], 0], 4, 0],
    },
  });
  currentMap.addLayer({
    id: 'dashboard-rivers',
    type: 'line',
    source: 'dashboard-rivers',
    paint: {
      'line-color': levelColor,
      'line-width': ['case', ['boolean', ['get', 'important'], false], 5, 2],
      'line-opacity': 0.85,
    },
  });
  currentMap.addLayer({
    id: 'dashboard-typhoon-lines',
    type: 'line',
    source: 'dashboard-typhoon-lines',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['case', ['boolean', ['get', 'forecast'], false], 2, 3],
      'line-dasharray': [3, 2],
    },
  });
  currentMap.addLayer({
    id: 'dashboard-wind-lines',
    type: 'line',
    source: 'dashboard-wind-lines',
    layout: { visibility: 'none' },
    paint: { 'line-color': levelColor, 'line-width': 2.5 },
  });

  addRainHeatmapLayer(
    currentMap,
    'dashboard-rain-24h',
    'dashboard-rain-24h',
    false
  );
  addRainHeatmapLayer(currentMap, 'dashboard-rain-1h', 'dashboard-rain-1h');
  addCircleLayer(
    currentMap,
    'dashboard-wind-points',
    'dashboard-wind-points',
    levelColor,
    5,
    false
  );
  addCircleLayer(
    currentMap,
    'dashboard-inundation',
    'dashboard-inundation',
    levelColor,
    8
  );
  addCircleLayer(
    currentMap,
    'dashboard-stations',
    'dashboard-stations',
    levelColor,
    7
  );
  addCircleLayer(
    currentMap,
    'dashboard-typhoon-points',
    'dashboard-typhoon-points',
    ['get', 'color'],
    10
  );

  refreshRadar();
  applyLayerVisibility();
  registerInteractions(currentMap);
}

function addRainHeatmapLayer(
  currentMap: Map,
  id: string,
  source: string,
  visible = true
) {
  currentMap.addLayer({
    id,
    type: 'heatmap',
    source,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['get', 'level'],
        1,
        0.2,
        6,
        1,
      ],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 14, 12, 30],
      'heatmap-opacity': 0.78,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(56, 189, 248, 0)',
        0.2,
        '#38bdf8',
        0.45,
        '#2563eb',
        0.7,
        '#facc15',
        1,
        '#ef4444',
      ],
    },
  });
}

function addCircleLayer(
  currentMap: Map,
  id: string,
  source: string,
  color: string | ExpressionSpecification,
  radius: number,
  visible = true
) {
  currentMap.addLayer({
    id,
    type: 'circle',
    source,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'circle-color': color,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        7,
        radius * 0.65,
        12,
        radius,
      ],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.92,
    },
  });
}

function registerInteractions(currentMap: Map) {
  const interactiveLayers = [
    'dashboard-warning-fill',
    'dashboard-rivers',
    'dashboard-rain-1h',
    'dashboard-rain-24h',
    'dashboard-wind-points',
    'dashboard-inundation',
    'dashboard-stations',
    'dashboard-typhoon-points',
  ];
  currentMap.on('mousemove', (event) => {
    const availableLayers = interactiveLayers.filter((id) =>
      currentMap.getLayer(id)
    );
    const features = currentMap.queryRenderedFeatures(event.point, {
      layers: availableLayers,
    });
    showCombinedPopup(event, features);
  });
  currentMap.on('mouseout', () => {
    currentMap.getCanvas().style.cursor = '';
    hoverPopup.remove();
  });
}

function showCombinedPopup(
  event: MapMouseEvent,
  features: MapGeoJSONFeature[]
) {
  const currentMap = map.value;
  if (!currentMap || features.length === 0) {
    if (currentMap) currentMap.getCanvas().style.cursor = '';
    hoverPopup.remove();
    return;
  }

  currentMap.getCanvas().style.cursor = 'pointer';
  const wrapper = document.createElement('div');
  wrapper.className = 'dashboard-hover-popup';
  const seen = new Set<string>();
  const areaFeature = features.find(
    (feature) => feature.layer.id === 'dashboard-warning-fill'
  );

  if (areaFeature) {
    const district = normalizedDistrictName(areaFeature);
    const title = document.createElement('strong');
    title.className = 'dashboard-hover-title';
    title.textContent = district;
    wrapper.append(title);
    const warnings = props.data.weatherWarnings?.districts?.[district] ?? [];
    warnings.forEach((warning) => {
      const row = document.createElement('div');
      row.textContent = `${warning.type} · ${
        ['未知', '蓝色', '黄色', '橙色', '红色'][warning.level] ?? '未知'
      }预警`;
      wrapper.append(row);
    });
    const floodLevel = Number(areaFeature.properties.floodLevel ?? 0);
    if (floodLevel > 0) {
      const row = document.createElement('div');
      row.textContent = `防汛防台 ${floodLevel} 级响应`;
      wrapper.append(row);
    }
    if (warnings.length === 0 && floodLevel === 0) {
      const row = document.createElement('div');
      row.textContent = '当前无区域预警';
      wrapper.append(row);
    }
  }

  features
    .filter((feature) => feature !== areaFeature)
    .slice(0, 8)
    .forEach((feature) => {
      const properties = feature.properties;
      const category = String(
        properties.category ??
          (feature.layer.id === 'dashboard-rivers' ? '河流' : '监测')
      );
      const name = String(properties.name ?? '未命名要素');
      const detail = [properties.area, properties.detail]
        .filter(Boolean)
        .join(' · ');
      const key = `${category}|${name}|${detail}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (wrapper.childNodes.length > 0) {
        const separator = document.createElement('div');
        separator.className = 'dashboard-hover-separator';
        wrapper.append(separator);
      }
      const heading = document.createElement('strong');
      heading.textContent = `${category} · ${name}`;
      wrapper.append(heading);
      if (detail) {
        const row = document.createElement('div');
        row.textContent = detail;
        wrapper.append(row);
      }
    });

  hoverPopup.setLngLat(event.lngLat).setDOMContent(wrapper).addTo(currentMap);
}

function applyLayerVisibility() {
  const currentMap = map.value;
  if (!currentMap?.isStyleLoaded()) return;
  Object.entries(layerIds).forEach(([key, ids]) => {
    ids.forEach((id) => {
      if (currentMap.getLayer(id)) {
        currentMap.setLayoutProperty(
          id,
          'visibility',
          visibleLayers[key as DashboardLayerId] ? 'visible' : 'none'
        );
      }
    });
  });
}

function focusShanghai() {
  map.value?.flyTo({ center: [121.51, 31.26], zoom: 8.7, duration: 800 });
}

function focusTyphoons() {
  if (!map.value || typhoonCoordinates.value.length === 0) return;
  const bounds = typhoonCoordinates.value.reduce(
    (result, coordinate) => result.extend(coordinate),
    new LngLatBounds(typhoonCoordinates.value[0], typhoonCoordinates.value[0])
  );
  map.value.fitBounds(bounds, { padding: 80, maxZoom: 7, duration: 800 });
}

watch(() => props.data, refreshGeoJsonSources);
watch(() => props.data.radar, refreshRadar);
watch(visibleLayers, applyLayerVisibility, { deep: true });
watch(
  () => $q.dark.isActive,
  (dark) => applyBaseMapTheme(map.value, dark)
);

onMounted(() => {
  if (!mapContainer.value) return;
  map.value = markRaw(
    new Map({
      container: mapContainer.value,
      style: createBaseMapStyle($q.dark.isActive),
      center: [121.51, 31.26],
      zoom: 8.7,
      minZoom: 3,
      maxZoom: 16,
    })
  );
  map.value.addControl(new NavigationControl(), 'bottom-left');
  map.value.addControl(new FullscreenControl(), 'bottom-left');
  map.value.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
  map.value.once('load', addSourcesAndLayers);
  resizeObserver = new ResizeObserver(() => map.value?.resize());
  resizeObserver.observe(mapContainer.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  map.value?.remove();
});
</script>

<style scoped>
.overview-map-shell,
.overview-map {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 520px;
}

.layer-panel {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  width: 285px;
  max-height: calc(100% - 24px);
  overflow-y: auto;
  background: var(--swos-map-card);
  backdrop-filter: blur(8px);
}

.layer-toggle {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
}

.layer-panel a {
  color: inherit;
}

.layer-category {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 4px;
  color: var(--swos-text-muted);
  font-size: 11px;
  font-weight: 700;
}

:global(.dashboard-hover-popup) {
  min-width: 180px;
  line-height: 1.5;
}

:global(.dashboard-hover-title) {
  display: block;
  margin-bottom: 3px;
  font-size: 14px;
}

:global(.dashboard-hover-separator) {
  height: 1px;
  margin: 7px 0;
  background: var(--swos-border);
}

@media (max-width: 650px) {
  .layer-panel {
    width: 245px;
    max-height: 46%;
  }
}
</style>
