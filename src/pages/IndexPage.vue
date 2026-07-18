<template>
  <q-page
    :class="{ 'dashboard-page--screenshot': genericStore.screenshot }"
    class="dashboard-page column no-wrap"
  >
    <section
      :class="{ 'dashboard-header--compact': !genericStore.showHeader }"
      class="dashboard-header row items-center q-px-lg q-py-md"
    >
      <div>
        <div class="text-h4 text-weight-bold">综合态势</div>
        <div class="text-subtitle2 text-grey-7">
          Shanghai Weather Warning & Observation System
        </div>
      </div>
      <q-space/>
      <div class="latest-status text-right">
        <div class="text-caption text-grey-7">最近数据时间</div>
        <div class="text-subtitle2 text-weight-medium">{{ latestUpdate }}</div>
      </div>
    </section>

    <section class="map-section">
      <ComprehensiveMap
        v-model:layer-panel-open="dashboardLayerPanelOpen"
        :data="dashboardData"
        :layer-controls-hidden="genericStore.screenshot"
      />
      <q-linear-progress
        v-if="initialLoading"
        class="dashboard-progress"
        indeterminate
      />

      <div
        :class="{
          'dashboard-top-overlay--panel-open': dashboardLayerPanelVisible,
        }"
        class="dashboard-top-overlay"
      >
        <div
          v-show="genericStore.showStatusBar"
          :class="`status-bar--${topStatusTone}`"
          class="status-bar map-glass-panel"
        >
          <div
            v-if="statusPhase === 'overview'"
            :style="{ '--status-marquee-duration': statusMarqueeDuration }"
            class="status-marquee"
          >
            <div
              v-for="copy in 2"
              :key="copy"
              :aria-hidden="copy === 2 ? 'true' : undefined"
              class="status-marquee-group"
            >
              <router-link
                v-for="(status, statusIndex) in statusItems"
                :key="`${copy}-${statusIndex}-${status.label}-${status.message}`"
                :class="`status-item--${status.tone}`"
                :tabindex="copy === 2 ? -1 : undefined"
                :to="status.href"
                class="status-item"
              >
                <q-icon :name="status.icon" size="1.1rem"/>
                <span class="status-label">{{ status.label }}</span>
                <span class="status-message">{{ status.message }}</span>
                <span v-if="status.time" class="status-time">{{
                    status.time
                  }}</span>
              </router-link>
            </div>
          </div>
          <router-link
            v-else-if="currentDetailStatus"
            :class="`status-detail--${currentDetailStatus.tone}`"
            :to="currentDetailStatus.href"
            class="status-detail"
          >
            <div class="status-detail-title">
              <q-icon :name="currentDetailStatus.icon" size="1.1rem"/>
              <span class="status-label">{{ currentDetailStatus.label }}</span>
              <span class="status-message">{{
                  currentDetailStatus.message
                }}</span>
            </div>
            <div class="status-detail-viewport">
              <div
                :style="{
                  '--status-detail-duration': statusDetailMarqueeDuration,
                }"
                class="status-detail-marquee"
              >
                <span>{{ currentDetailStatus.detail }}</span>
                <span aria-hidden="true">{{ currentDetailStatus.detail }}</span>
              </div>
            </div>
          </router-link>
        </div>

        <div v-show="genericStore.showInsightDock" class="map-insight-dock">
          <router-link class="map-insight rain-insight" to="/precip/forecast">
            <div class="insight-heading">
              <span><q-icon name="water_drop"/> 降雨</span>
              <q-icon name="arrow_forward"/>
            </div>
            <div class="rain-comparison">
              <div
                v-for="rain in rainSummary"
                :key="rain.label"
                :style="intensityStyle(rain.color, rain.level)"
                class="rain-period intensity-panel"
              >
                <div class="rain-value">
                  <span>{{ rain.label }}</span>
                  <strong
                  >{{ rain.maximum.toFixed(1) }}<small> mm</small></strong
                  >
                </div>
                <div class="rain-track">
                  <div
                    :style="{ width: `${rain.percent}%` }"
                    class="rain-fill"
                  ></div>
                </div>
                <div class="insight-note">{{ rain.active }} 个有雨站点</div>
              </div>
            </div>
          </router-link>

          <router-link
            class="map-insight metric-insight wind-insight"
            :style="windIntensityPanelStyle"
            to="/wind"
          >
            <div class="metric-icon wind-compass">
              <q-icon :style="windDirectionStyle" name="navigation"/>
            </div>
            <div>
              <span class="insight-label">风场</span>
              <strong
              >{{ maximumWind.speed.toFixed(1) }} <small>m/s</small></strong
              >
              <span class="insight-note"
              >{{ maximumWind.direction }} ·
                {{ strongWindCount }} 个强风站点</span
              >
            </div>
          </router-link>

          <router-link
            v-if="activeTyphoonSummaries.length === 0"
            class="map-insight metric-insight water-insight"
            to="/inundation"
          >
            <div class="metric-icon water-level-icon">
              <q-icon name="water_drop"/>
            </div>
            <div>
              <span class="insight-label">道路积水</span>
              <strong>{{ inundationSummary.active }} <small>处</small></strong>
              <span class="insight-note"
              >最高 {{ inundationSummary.maximum.toFixed(1) }} cm</span
              >
            </div>
          </router-link>

          <div v-else class="map-insight typhoon-insight">
            <div class="insight-heading typhoon-heading">
              <router-link class="typhoon-heading-link" to="/typhoon">
                <span><q-icon name="fa-solid fa-hurricane"/> 活动台风</span>
                <q-badge
                  :label="`${activeTyphoonSummaries.length} 个`"
                  color="negative"
                  rounded
                />
              </router-link>
              <q-icon name="swipe"/>
            </div>
            <q-carousel
              v-model="activeTyphoonSlide"
              :animated="!genericStore.screenshot"
              :arrows="activeTyphoonSummaries.length > 1"
              :autoplay="
                !genericStore.screenshot && activeTyphoonSummaries.length > 1
                  ? 6500
                  : false
              "
              :navigation="activeTyphoonSummaries.length > 1"
              class="typhoon-carousel"
              control-color="negative"
              height="92px"
              infinite
              swipeable
            >
              <q-carousel-slide
                v-for="typhoon in activeTyphoonSummaries"
                :key="typhoon.id"
                :name="typhoon.id"
                class="typhoon-carousel-slide"
              >
                <router-link class="typhoon-card" to="/typhoon">
                  <div class="typhoon-card-main">
                    <div class="typhoon-card-icon">
                      <q-icon name="fa-solid fa-hurricane"/>
                    </div>
                    <div class="typhoon-card-content">
                      <div class="typhoon-card-top">
                        <strong>{{ typhoon.name }}</strong>
                        <span>{{ typhoon.strength }}</span>
                      </div>
                      <div class="typhoon-location">
                        <q-icon name="place"/>
                        <span>{{ typhoon.location }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="typhoon-stat-row">
                    <span
                    ><q-icon name="compress"/> {{ typhoon.pressure }}</span
                    >
                    <span><q-icon name="air"/> {{ typhoon.speed }}</span>
                    <span
                    ><q-icon name="near_me"/> {{ typhoon.movement }}</span
                    >
                    <span><q-icon name="schedule"/> {{ typhoon.time }}</span>
                  </div>
                </router-link>
              </q-carousel-slide>
            </q-carousel>
          </div>

          <router-link class="map-insight warning-insight" to="/generic">
            <div class="insight-heading warning-heading">
              <span><q-icon name="warning"/> 预警</span>
              <q-icon name="arrow_forward"/>
            </div>
            <div class="warning-summary-grid">
              <div
                :style="{ '--summary-color': weatherWarningSummary.color }"
                class="warning-summary-item"
              >
                <span>天气预警</span>
                <strong>{{ weatherWarningSummary.count }}</strong>
                <small>{{ weatherWarningSummary.message }}</small>
              </div>
              <div
                :style="{ '--summary-color': floodWarningSummary.color }"
                class="warning-summary-item"
              >
                <span>防汛预警</span>
                <strong>{{ floodWarningSummary.count }}</strong>
                <small>{{ floodWarningSummary.message }}</small>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
  </q-page>
</template>

<script lang="ts" setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import ComprehensiveMap from 'components/ComprehensiveMap.vue';
import sdk from 'src/composables/sdk';
import {usePollingFetch, useProductionPollingFetch,} from 'src/composables/use-polling-fetch';
import {
  EXTREME_RAIN_BORDER_COLOR,
  EXTREME_RAIN_FILL_COLOR,
  EXTREME_RAIN_LEVEL,
  floodStationLevel,
  hazardLevelColor,
  maximumRiverLevel,
} from 'src/composables/hazard-utils';
import {useGenericStore} from 'stores/generic';
import {useQuasar} from 'quasar';

interface DashboardStatusItem {
  label: string;
  message: string;
  href: string;
  icon: string;
  tone: DashboardStatusTone;
  priority: number;
  detail?: string;
  time?: string;
}

interface WeatherWarningSummaryItem extends WeatherWarning {
  district: string;
  id: string;
}

interface ActiveTyphoonSummary {
  id: string;
  name: string;
  location: string;
  strength: string;
  pressure: string;
  speed: string;
  movement: string;
  time: string;
  rawTime: string;
}

interface OverviewWarningSummary {
  count: number;
  message: string;
  color: string;
}

type StatusPhase = 'overview' | 'detail';

const $q = useQuasar();
const genericStore = useGenericStore();
const dashboardLayerPanelOpen = ref($q.screen.gt.xs);
const dashboardLayerPanelVisible = computed(
  () => dashboardLayerPanelOpen.value && !genericStore.screenshot
);
let previousDashboardLayerPanelOpen: boolean | undefined;

const warningLevelLabels = ['未知', '蓝色', '黄色', '橙色', '红色'];
const warningLevelColors = [
  '#94a3b8',
  '#41a0f8',
  '#f3e843',
  '#f8a931',
  '#f74e3b',
];
const excludedWarningDistricts = new Set(['江苏省', '浙江省']);

function weatherWarningTone(level: number): DashboardStatusTone {
  if (level >= 4) return 'negative';
  if (level >= 2) return 'warning';
  if (level === 1) return 'info';
  return 'grey';
}

function warningLevelColor(level: number): string {
  return warningLevelColors[level] ?? warningLevelColors[0];
}

function timestampValue(value?: string) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactTimestamp(value?: string): string {
  const parsed = Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) return value || '时间待确认';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(parsed)
    .replace(/\//g, '-');
}

function formatTyphoonLocation(point: TyphoonPoints): string {
  const longitude = Number(point.longitude);
  const latitude = Number(point.latitude);
  const coordinate =
    Number.isFinite(longitude) && Number.isFinite(latitude)
      ? `${latitude.toFixed(1)}°N ${longitude.toFixed(1)}°E`
      : '位置待确认';
  return point.position_explanation?.trim() || coordinate;
}

genericStore.initPageSpec(false, true, false, {
  dashboardControlsSupported: true,
});
watch(
  () => genericStore.screenshot,
  (screenshotting) => {
    if (screenshotting) {
      previousDashboardLayerPanelOpen = dashboardLayerPanelOpen.value;
      dashboardLayerPanelOpen.value = false;
      return;
    }
    if (previousDashboardLayerPanelOpen === undefined) return;
    dashboardLayerPanelOpen.value = previousDashboardLayerPanelOpen;
    previousDashboardLayerPanelOpen = undefined;
  },
  {flush: 'sync'}
);
const {data: geography, loading: geographyLoading} =
  useProductionPollingFetch<HazardGeoJSON>(
    '/assets/generic/around_shanghai_geojson',
    86_400_000
  );
const {data: rivers, loading: riversLoading} =
  useProductionPollingFetch<HazardGeoJSON>(
    '/assets/flood/river_geojson',
    86_400_000
  );
const {data: rain1h, loading: rain1hLoading} =
  useProductionPollingFetch<RainState>('/warning/rain_state_1h');
const {data: rain24h, loading: rain24hLoading} =
  useProductionPollingFetch<RainState>('/warning/rain_state');
const {data: wind, loading: windLoading} =
  useProductionPollingFetch<WindState>('/warning/wind_state');
const {data: inundation, loading: inundationLoading} =
  useProductionPollingFetch<InundationState>('/warning/inundation_state');
const {data: flood, loading: floodLoading} =
  useProductionPollingFetch<FloodState>('/warning/flood_state');
const {data: weatherWarnings, loading: warningLoading} =
  useProductionPollingFetch<WeatherWarningList>('/warning/weather_warning');
const {data: floodWarning, loading: floodWarningLoading} =
  useProductionPollingFetch<FloodWarningState>('/warning/flood_warning');
const {data: typhoonList, loading: typhoonLoading} =
  useProductionPollingFetch<TyphoonList[]>('/warning/typhoon_activity');
const {data: precipitationRadarList, loading: radarLoading} =
  usePollingFetch<PrecipitationAnalysisList>(`${sdk.cdnUrl}/analysis/list`, 600_000, true, true);
const typhoons = ref<Record<string, TyphoonDetail>>({});
const activeTyphoonSlide = ref('');
let typhoonController: AbortController | undefined;
let typhoonRequestVersion = 0;

watch(typhoonList, async (list) => {
  typhoonController?.abort();
  typhoonController = new AbortController();
  const version = ++typhoonRequestVersion;
  const active = (list ?? []).filter((item) => item.is_active === 1);
  if (active.length === 0) {
    typhoons.value = {};
    return;
  }
  try {
    const entries = await Promise.all(
      active.map(async (typhoon) => {
        const detail = await sdk.fetchProductionJson<TyphoonDetail[]>(
          `/warning/typhoon_detail?id=${encodeURIComponent(
            typhoon.tfid
          )}&_=${Date.now()}`,
          typhoonController?.signal
        );
        return detail[0] ? ([typhoon.tfid, detail[0]] as const) : null;
      })
    );
    if (version === typhoonRequestVersion) {
      typhoons.value = Object.fromEntries(
        entries.filter(
          (entry): entry is readonly [string, TyphoonDetail] => entry !== null
        )
      );
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return;
    sdk.showNotification(
      'negative',
      `台风综合数据加载失败：${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }
});

onBeforeUnmount(() => typhoonController?.abort());

const radar = computed<DashboardPrecipitationRadar | null>(() => {
  const latest = [...(precipitationRadarList.value?.one ?? [])]
    .sort((a, b) => a.time - b.time)
    .at(-1);
  if (!latest) return null;
  return {
    time: latest.time,
    duration: '1h',
    resolution: '5km',
    dataUrl: `${sdk.cdnUrl.replace(/\/$/, '')}/analysis/rain/rain_1h_5km_${
      latest.time
    }.geojson`,
  };
});

const dashboardData = computed<DashboardData>(() => ({
  geography: geography.value,
  rivers: rivers.value,
  rain1h: rain1h.value,
  rain24h: rain24h.value,
  wind: wind.value,
  inundation: inundation.value,
  flood: flood.value,
  weatherWarnings: weatherWarnings.value,
  floodWarning: floodWarning.value,
  typhoons: typhoons.value,
  radar: radar.value,
}));

const initialLoading = computed(() =>
  [
    geographyLoading,
    riversLoading,
    rain1hLoading,
    rain24hLoading,
    windLoading,
    inundationLoading,
    floodLoading,
    warningLoading,
    floodWarningLoading,
    typhoonLoading,
    radarLoading,
  ].some((loading) => loading.value)
);

const elevatedRiverCount = computed(
  () =>
    Object.values(flood.value?.flood ?? {}).filter(
      (river) => maximumRiverLevel(river) > 0
    ).length
);
const elevatedStationCount = computed(
  () =>
    Object.values(flood.value?.station ?? {}).filter(
      (station) => floodStationLevel(station) > 0
    ).length
);

const rainSummary = computed(() => {
  const values = [
    {label: '近 1 小时', observations: rain1h.value?.rain ?? []},
    {label: '近 24 小时', observations: rain24h.value?.rain ?? []},
  ].map(({label, observations}) => {
    const level = Math.max(
      0,
      ...observations.map((item) => Number(item.level) || 0)
    );
    return {
      label,
      level,
      color: hazardLevelColor(level),
      active: observations.filter((item) => Number(item.level) > 0).length,
      maximum: Math.max(0, ...observations.map((item) => Number(item.value))),
    };
  });
  const scale = Math.max(1, ...values.map((item) => item.maximum));
  return values.map((item) => ({
    ...item,
    percent: Math.max(3, (item.maximum / scale) * 100),
  }));
});

const windObservations = computed(() =>
  Object.values(wind.value?.wind ?? {}).flat()
);
const strongWindCount = computed(
  () => windObservations.value.filter((item) => item.level >= 2).length
);
const maximumWind = computed<WindObservation>(() =>
  windObservations.value.reduce<WindObservation>(
    (maximum, item) => (item.speed > maximum.speed ? item : maximum),
    {
      longitude: 0,
      latitude: 0,
      id: '',
      name: '暂无数据',
      speed: 0,
      degrees: 0,
      direction: '静风',
      level: 0,
      wind_level: '0',
    }
  )
);
const windDirectionStyle = computed(() => ({
  transform: `rotate(${maximumWind.value.degrees}deg)`,
}));
const windIntensityPanelStyle = computed(() =>
  intensityStyle(hazardLevelColor(maximumWind.value.level))
);

function colorWithAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(normalized)) return `rgba(100, 116, 139, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function intensityStyle(color: string, level?: number): Record<string, string> {
  if (level === EXTREME_RAIN_LEVEL) {
    return {
      '--insight-color': EXTREME_RAIN_FILL_COLOR,
      '--insight-bg': EXTREME_RAIN_FILL_COLOR,
      '--insight-bg-strong': colorWithAlpha(EXTREME_RAIN_BORDER_COLOR, 0.24),
      '--insight-border': EXTREME_RAIN_BORDER_COLOR,
      '--rain-period-accent': EXTREME_RAIN_BORDER_COLOR,
      '--rain-period-bg': EXTREME_RAIN_FILL_COLOR,
      '--rain-period-border': EXTREME_RAIN_BORDER_COLOR,
      '--rain-period-note': colorWithAlpha(EXTREME_RAIN_BORDER_COLOR, 0.82),
      '--rain-period-text': EXTREME_RAIN_BORDER_COLOR,
      '--rain-track-bg': colorWithAlpha(EXTREME_RAIN_BORDER_COLOR, 0.24),
    };
  }

  return {
    '--insight-color': color,
    '--insight-bg': colorWithAlpha(color, 0.13),
    '--insight-bg-strong': colorWithAlpha(color, 0.24),
    '--insight-border': colorWithAlpha(color, 0.45),
  };
}

const inundationSummary = computed(() => {
  const points = Object.values(inundation.value?.inundation ?? {}).flat();
  const maximum = Math.max(
    0,
    ...points.map((item) => Number(item.water_level))
  );
  return {
    active: points.filter((item) => item.level > 0).length,
    maximum,
    percent: Math.min(100, Math.max(8, maximum * 2)),
  };
});

const activeTyphoonSummaries = computed<ActiveTyphoonSummary[]>(() =>
  (typhoonList.value ?? [])
    .filter((typhoon) => typhoon.is_active === 1)
    .map((typhoon) => {
      const detail = typhoons.value[typhoon.tfid];
      const current = detail?.points.at(-1);
      if (!current) {
        return {
          id: typhoon.tfid,
          name: typhoon.name
            ? `${typhoon.name} (${typhoon.tfid})`
            : typhoon.tfid,
          location: '详情加载中',
          strength: typhoon.eng_name || '活动中',
          pressure: '-- hPa',
          speed: '-- m/s',
          movement: '路径加载中',
          time: compactTimestamp(typhoon.start_time),
          rawTime: typhoon.start_time,
        };
      }
      return {
        id: typhoon.tfid,
        name: detail.name ? `${detail.name} (${typhoon.tfid})` : typhoon.tfid,
        location: formatTyphoonLocation(current),
        strength: current.strong || '活动中',
        pressure: `${current.pressure} hPa`,
        speed: `${current.speed} m/s`,
        movement: `${current.move_dir || '移动'} ${current.move_speed} km/h`,
        time: compactTimestamp(current.time),
        rawTime: current.time,
      };
    })
    .sort((a, b) => timestampValue(b.rawTime) - timestampValue(a.rawTime))
);

watch(
  activeTyphoonSummaries,
  (summaries) => {
    if (summaries.some((typhoon) => typhoon.id === activeTyphoonSlide.value))
      return;
    activeTyphoonSlide.value = summaries[0]?.id ?? '';
  },
  {immediate: true}
);

const effectiveWeatherWarnings = computed<WeatherWarningSummaryItem[]>(() =>
  Object.entries(weatherWarnings.value?.districts ?? {})
    .filter(([district]) => !excludedWarningDistricts.has(district))
    .flatMap(([district, warnings]) =>
      warnings.map((warning, index) => ({
        ...warning,
        district,
        id: `${district}-${warning.type}-${warning.time}-${index}`,
      }))
    )
    .sort(
      (a, b) =>
        b.level - a.level ||
        timestampValue(b.time) - timestampValue(a.time) ||
        a.district.localeCompare(b.district, 'zh-CN')
    )
);

const weatherWarningSummary = computed<OverviewWarningSummary>(() => {
  const topWarning = effectiveWeatherWarnings.value[0];
  if (!topWarning) {
    return {
      count: 0,
      message: '当前无生效天气预警',
      color: warningLevelColor(0),
    };
  }
  return {
    count: effectiveWeatherWarnings.value.length,
    message: `${topWarning.district} ${topWarning.type}${
      warningLevelLabels[topWarning.level] ?? '未知'
    }预警${(effectiveWeatherWarnings.value.length > 1) ? '等' : ''}`,
    color: warningLevelColor(topWarning.level),
  };
});

const floodWarningItems = computed(() => [
  {
    id: 'flood',
    title: '防汛防台应急响应',
    level: floodWarning.value?.flood ?? 0,
  },
  {
    id: 'water-level',
    title: '黄浦江高潮位预警',
    level: floodWarning.value?.water_level ?? 0,
  },
]);

const floodWarningSummary = computed<OverviewWarningSummary>(() => {
  const active = floodWarningItems.value
    .filter((item) => item.level > 0)
    .sort((a, b) => b.level - a.level);
  const topWarning = active[0] ?? floodWarningItems.value[0];
  return {
    count: active.length,
    message:
      active.length > 0
        ? active
          .map(
            (item) =>
              `${item.title}${
                warningLevelLabels[item.level] ?? `${item.level}级`
              }`
          )
          .join('；')
        : '当前未发布防汛预警',
    color: warningLevelColor(topWarning?.level ?? 0),
  };
});

const latestUpdate = computed(() => {
  const values = [
    rain1h.value?.message_time,
    rain24h.value?.message_time,
    wind.value?.message_time,
    inundation.value?.message_time,
    flood.value?.message_time,
    weatherWarnings.value?.message_time,
    floodWarning.value?.message_time,
  ].filter((value): value is string => Boolean(value));
  if (values.length > 0) return values.sort().at(-1);
  const radarTime = radar.value?.time;
  return radarTime
    ? new Date(radarTime * 1000).toLocaleString('zh-CN')
    : '正在加载';
});

const statusItems = computed<DashboardStatusItem[]>(() => {
  const items: DashboardStatusItem[] = [];
  Object.entries(weatherWarnings.value?.districts ?? {}).forEach(
    ([district, warnings]) => {
      warnings.forEach((warning) => {
        items.push({
          label: '天气预警',
          message: `${district} ${warning.type}${
            warningLevelLabels[warning.level] ?? '未知'
          }预警`,
          detail: [
            warning.detail || '暂无详细说明。',
            `${warning.name} 发布于 ${warning.time}`,
          ].join(' '),
          time: warning.time,
          href: '/warning/weather',
          icon: 'warning',
          tone: weatherWarningTone(warning.level),
          priority: 90 + warning.level * 10,
        });
      });
    }
  );

  const floodLevel = floodWarning.value?.flood ?? 0;
  if (floodLevel > 0) {
    items.push({
      label: '防汛响应',
      message: `防汛防台 ${floodLevel} 级响应`,
      detail: `当前防汛防台响应等级为 ${floodLevel} 级，黄浦江高潮位预警等级为 ${
        floodWarning.value?.water_level ?? 0
      } 级。`,
      time: floodWarning.value?.message_time,
      href: '/warning/flood',
      icon: 'shield',
      tone: floodLevel >= 3 ? 'negative' : 'warning',
      priority: 82 + floodLevel * 5,
    });
  }

  const waterLevelWarning = floodWarning.value?.water_level ?? 0;
  if (waterLevelWarning > 0) {
    items.push({
      label: '高潮位',
      message: `黄浦江高潮位 ${waterLevelWarning} 级预警`,
      detail: `黄浦江沿线高潮位风险预警等级为 ${waterLevelWarning} 级，防汛防台响应等级为 ${
        floodWarning.value?.flood ?? 0
      } 级。`,
      time: floodWarning.value?.message_time,
      href: '/warning/flood',
      icon: 'water',
      tone: waterLevelWarning >= 3 ? 'negative' : 'warning',
      priority: 78 + waterLevelWarning * 5,
    });
  }

  const activeTyphoons = Object.values(typhoons.value);
  if (activeTyphoons.length > 0) {
    const names = activeTyphoons
      .map((typhoon) => typhoon.name)
      .filter((name) => name.length > 0);
    const nameText = names.length > 0 ? names.slice(0, 3).join('、') : '台风';
    const time = activeTyphoons
      .map((typhoon) => typhoon.points.at(-1)?.time)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const latestPoint = activeTyphoons[0]?.points.at(-1);
    items.push({
      label: '活动台风',
      message:
        names.length > 3
          ? `${nameText}等 ${activeTyphoons.length} 个活动台风`
          : `${nameText} 活动中`,
      detail: latestPoint
        ? `${nameText} 最新强度 ${latestPoint.strong}，中心气压 ${
          latestPoint.pressure
        } hPa，近中心最大风速 ${latestPoint.speed} m/s，移向 ${
          latestPoint.move_dir
        }，移速 ${latestPoint.move_speed} km/h。${
          latestPoint.position_explanation ??
          latestPoint.typhoon_explanation ??
          ''
        }`
        : `${nameText} 活动中。`,
      time,
      href: '/typhoon',
      icon: 'fa-solid fa-hurricane',
      tone: 'negative',
      priority: 72 + activeTyphoons.length,
    });
  }

  if (strongWindCount.value > 0) {
    items.push({
      label: '风',
      message: `${maximumWind.value.name} ${maximumWind.value.speed.toFixed(
        1
      )} m/s ${maximumWind.value.direction}`,
      detail: `${
        maximumWind.value.name
      } 观测到最大风速 ${maximumWind.value.speed.toFixed(1)} m/s，风向 ${
        maximumWind.value.direction
      }，风力 ${maximumWind.value.wind_level} 级；当前共有 ${
        strongWindCount.value
      } 个强风站点。`,
      time: wind.value?.message_time,
      href: '/wind',
      icon: 'air',
      tone: maximumWind.value.level >= 3 ? 'warning' : 'info',
      priority: 54 + maximumWind.value.level * 4,
    });
  }

  if (inundationSummary.value.active > 0) {
    items.push({
      label: '道路积水',
      message: `${
        inundationSummary.value.active
      } 处积水，最高 ${inundationSummary.value.maximum.toFixed(1)} cm`,
      detail: `当前共有 ${
        inundationSummary.value.active
      } 处道路积水点，最高水深 ${inundationSummary.value.maximum.toFixed(
        1
      )} cm。`,
      time: inundation.value?.message_time,
      href: '/inundation',
      icon: 'water_drop',
      tone: 'warning',
      priority: 58,
    });
  }

  if (elevatedRiverCount.value + elevatedStationCount.value > 0) {
    items.push({
      label: '水情',
      message: `${elevatedRiverCount.value} 条异常河流，${elevatedStationCount.value} 个异常站点`,
      detail: `水情监测显示 ${elevatedRiverCount.value} 条河流处于异常状态，${elevatedStationCount.value} 个水位站接近或超过关注阈值。`,
      time: flood.value?.message_time,
      href: '/flood/rivers',
      icon: 'waves',
      tone: 'info',
      priority: 50,
    });
  }

  const maxRain = rainSummary.value.reduce((maximum, item) =>
    item.maximum > maximum.maximum ? item : maximum
  );
  if (maxRain.maximum > 0) {
    items.push({
      label: '降雨',
      message: `${maxRain.label}最大 ${maxRain.maximum.toFixed(1)} mm`,
      detail: `${maxRain.label}最大站点雨量 ${maxRain.maximum.toFixed(
        1
      )} mm，当前有 ${maxRain.active} 个站点观测到降雨。`,
      time: maxRain.label.includes('24')
        ? rain24h.value?.message_time
        : rain1h.value?.message_time,
      href: '/precip/forecast',
      icon: 'water_drop',
      tone: maxRain.maximum >= 30 ? 'warning' : 'info',
      priority: 42 + Math.min(10, maxRain.maximum / 5),
    });
  }

  const sorted = items.sort(
    (a, b) =>
      b.priority - a.priority ||
      timestampValue(b.time) - timestampValue(a.time) ||
      a.message.localeCompare(b.message, 'zh-CN')
  );
  return [
    ...sorted.slice(0, 11),
    {
      label: '最新信息',
      message: `数据更新 ${latestUpdate.value}`,
      href: '/',
      icon: 'schedule',
      tone: initialLoading.value ? 'grey' : 'positive',
      priority: 0,
    },
  ];
});

const topStatusTone = computed<DashboardStatusTone>(
  () => statusItems.value[0]?.tone ?? 'grey'
);

const detailStatusItems = computed<DashboardStatusItem[]>(() =>
  statusItems.value.filter((item) => Boolean(item.detail))
);
const statusPhase = ref<StatusPhase>('overview');
const detailStatusIndex = ref(0);
const currentDetailStatus = computed(() => {
  const details = detailStatusItems.value;
  if (details.length === 0) return null;
  return details[detailStatusIndex.value % details.length];
});

const statusMarqueeDuration = computed(() => {
  const hasUrgentItem = statusItems.value.some(
    (item) => item.tone === 'negative'
  );
  const duration = statusItems.value.length * 5 + (hasUrgentItem ? 18 : 24);
  return `${Math.min(86, Math.max(34, duration))}s`;
});

const statusDetailMarqueeDuration = computed(() => {
  const characterCount = currentDetailStatus.value?.detail?.length ?? 0;
  return `${Math.min(90, Math.max(18, characterCount * 0.28))}s`;
});

let statusCycleTimer: ReturnType<typeof setTimeout> | undefined;

function stopStatusCycle() {
  if (statusCycleTimer) clearTimeout(statusCycleTimer);
  statusCycleTimer = undefined;
}

function startStatusCycle() {
  stopStatusCycle();
  if (detailStatusItems.value.length === 0) {
    statusPhase.value = 'overview';
    return;
  }

  const detailCharacterCount = currentDetailStatus.value?.detail?.length ?? 0;
  const detailDelay = Math.min(
    25000,
    Math.max(8000, detailCharacterCount * 240)
  );
  const delay = statusPhase.value === 'overview' ? 8000 : detailDelay;
  statusCycleTimer = setTimeout(() => {
    if (statusPhase.value === 'overview') {
      statusPhase.value = 'detail';
    } else {
      detailStatusIndex.value =
        (detailStatusIndex.value + 1) % detailStatusItems.value.length;
      statusPhase.value = 'overview';
    }
    startStatusCycle();
  }, delay);
}

onMounted(startStatusCycle);
watch(detailStatusItems, () => {
  detailStatusIndex.value = 0;
  statusPhase.value = 'overview';
  startStatusCycle();
});
onBeforeUnmount(stopStatusCycle);
</script>

<style scoped>
.dashboard-page {
  height: 100dvh;
  min-height: 600px;
  background: var(--swos-page);
}

.dashboard-header {
  min-height: 92px;
  padding-right: 288px !important;
  padding-left: 76px !important;
  background: linear-gradient(
    120deg,
    var(--swos-surface),
    var(--swos-surface-soft)
  );
  border-bottom: 1px solid var(--swos-border);
}

.dashboard-header--compact {
  min-height: 72px;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.dashboard-header--compact > * {
  display: none;
}

.latest-status {
  margin-right: 18px;
}

.map-section {
  position: relative;
  min-height: 0;
  flex: 1;
}

.dashboard-progress {
  position: absolute;
  z-index: 4;
  top: 0;
  right: 0;
  left: 0;
}

.dashboard-top-overlay {
  position: absolute;
  z-index: 3;
  top: 16px;
  right: 64px;
  left: 16px;
  display: grid;
  gap: 10px;
  pointer-events: none;
  transition: right 180ms ease;
}

.dashboard-top-overlay--panel-open {
  right: 298px;
}

.dashboard-page--screenshot .dashboard-top-overlay {
  right: 16px !important;
  transition: none;
}

.dashboard-page--screenshot :deep(.typhoon-carousel),
.dashboard-page--screenshot :deep(.typhoon-carousel .q-panel),
.dashboard-page--screenshot :deep(.typhoon-carousel .q-carousel__slides-container),
.dashboard-page--screenshot :deep(.typhoon-carousel .q-carousel__slide) {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: 0 !important;
}

.dashboard-page--screenshot :deep(.typhoon-carousel .q-carousel__control),
.dashboard-page--screenshot :deep(.typhoon-carousel .q-focus-helper) {
  display: none !important;
}

.status-bar {
  --status-bar-color: #64748b;
  position: relative;
  min-height: 46px;
  overflow: hidden;
  border: 1px solid var(--swos-border);
  border-left: 5px solid var(--status-bar-color);
  border-radius: 8px;
  background: var(--swos-map-card);
  box-shadow: 0 12px 32px rgb(15 23 42 / 16%);
  backdrop-filter: blur(16px);
  pointer-events: auto;
}

.status-bar--positive {
  --status-bar-color: #16a34a;
}

.status-bar--info {
  --status-bar-color: #0284c7;
}

.status-bar--warning {
  --status-bar-color: #d97706;
}

.status-bar--negative {
  --status-bar-color: #dc2626;
}

.status-bar--grey {
  --status-bar-color: #64748b;
}

.status-marquee {
  display: flex;
  width: max-content;
  animation: status-marquee var(--status-marquee-duration, 48s) linear infinite;
  will-change: transform;
}

.status-bar:hover .status-marquee {
  animation-play-state: paused;
}

.status-bar:hover .status-detail-marquee {
  animation-play-state: paused;
}

.status-marquee-group {
  display: flex;
  flex: 0 0 auto;
}

@keyframes status-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

.status-detail {
  --status-color: #94a3b8;
  --status-bg-subtle: rgba(148, 163, 184, 0.06);
  --status-bg: rgba(148, 163, 184, 0.08);
  --status-bg-title: rgba(148, 163, 184, 0.12);
  --status-bg-hover: rgba(148, 163, 184, 0.14);
  display: grid;
  min-height: 46px;
  grid-template-columns: fit-content(320px) minmax(0, 1fr);
  color: inherit;
  text-decoration: none;
}

.status-detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 12px 8px 10px;
  border-right: 1px solid var(--swos-border);
  border-left: 3px solid var(--status-color);
  background: var(--status-bg-title);
}

.status-detail-title .status-label {
  font-size: 10px;
}

.status-detail-title .status-message {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
}

.status-detail-viewport {
  min-width: 0;
  overflow: hidden;
  background: var(--status-bg-subtle);
}

.status-detail-marquee {
  display: flex;
  width: max-content;
  min-width: 200%;
  gap: 40px;
  min-height: 46px;
  align-items: center;
  padding: 0 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  animation: status-detail-marquee var(--status-detail-duration, 26s) linear infinite;
  will-change: transform;
}

@keyframes status-detail-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}

.status-detail--positive {
  --status-color: #16a34a;
  --status-bg-subtle: rgba(22, 163, 74, 0.06);
  --status-bg: rgba(22, 163, 74, 0.08);
  --status-bg-title: rgba(22, 163, 74, 0.12);
  --status-bg-hover: rgba(22, 163, 74, 0.14);
}

.status-detail--info {
  --status-color: #0284c7;
  --status-bg-subtle: rgba(2, 132, 199, 0.06);
  --status-bg: rgba(2, 132, 199, 0.08);
  --status-bg-title: rgba(2, 132, 199, 0.12);
  --status-bg-hover: rgba(2, 132, 199, 0.14);
}

.status-detail--warning {
  --status-color: #d97706;
  --status-bg-subtle: rgba(217, 119, 6, 0.06);
  --status-bg: rgba(217, 119, 6, 0.08);
  --status-bg-title: rgba(217, 119, 6, 0.12);
  --status-bg-hover: rgba(217, 119, 6, 0.14);
}

.status-detail--negative {
  --status-color: #dc2626;
  --status-bg-subtle: rgba(220, 38, 38, 0.06);
  --status-bg: rgba(220, 38, 38, 0.08);
  --status-bg-title: rgba(220, 38, 38, 0.12);
  --status-bg-hover: rgba(220, 38, 38, 0.14);
}

.status-detail--grey {
  --status-color: #64748b;
  --status-bg-subtle: rgba(100, 116, 139, 0.06);
  --status-bg: rgba(100, 116, 139, 0.08);
  --status-bg-title: rgba(100, 116, 139, 0.12);
  --status-bg-hover: rgba(100, 116, 139, 0.14);
}

.status-item {
  --status-color: #94a3b8;
  --status-bg-subtle: rgba(148, 163, 184, 0.06);
  --status-bg: rgba(148, 163, 184, 0.08);
  --status-bg-title: rgba(148, 163, 184, 0.12);
  --status-bg-hover: rgba(148, 163, 184, 0.14);
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  min-height: 46px;
  padding: 8px 12px 8px 10px;
  color: inherit;
  border: 0;
  border-right: 1px solid var(--swos-border);
  border-left: 3px solid var(--status-color);
  background: var(--status-bg);
  font-size: 12px;
  line-height: 1.2;
  text-decoration: none;
  transition: background 160ms ease;
}

.status-item:hover {
  background: var(--status-bg-hover);
}

.status-item--positive {
  --status-color: #16a34a;
  --status-bg-subtle: rgba(22, 163, 74, 0.06);
  --status-bg: rgba(22, 163, 74, 0.08);
  --status-bg-title: rgba(22, 163, 74, 0.12);
  --status-bg-hover: rgba(22, 163, 74, 0.14);
}

.status-item--info {
  --status-color: #0284c7;
  --status-bg-subtle: rgba(2, 132, 199, 0.06);
  --status-bg: rgba(2, 132, 199, 0.08);
  --status-bg-title: rgba(2, 132, 199, 0.12);
  --status-bg-hover: rgba(2, 132, 199, 0.14);
}

.status-item--warning {
  --status-color: #d97706;
  --status-bg-subtle: rgba(217, 119, 6, 0.06);
  --status-bg: rgba(217, 119, 6, 0.08);
  --status-bg-title: rgba(217, 119, 6, 0.12);
  --status-bg-hover: rgba(217, 119, 6, 0.14);
}

.status-item--negative {
  --status-color: #dc2626;
  --status-bg-subtle: rgba(220, 38, 38, 0.06);
  --status-bg: rgba(220, 38, 38, 0.08);
  --status-bg-title: rgba(220, 38, 38, 0.12);
  --status-bg-hover: rgba(220, 38, 38, 0.14);
}

.status-item--grey {
  --status-color: #64748b;
  --status-bg-subtle: rgba(100, 116, 139, 0.06);
  --status-bg: rgba(100, 116, 139, 0.08);
  --status-bg-title: rgba(100, 116, 139, 0.12);
  --status-bg-hover: rgba(100, 116, 139, 0.14);
}

.status-label {
  color: var(--status-color);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.status-message {
  font-weight: 600;
  white-space: nowrap;
}

.status-time {
  color: var(--swos-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.map-insight-dock {
  display: grid;
  grid-template-columns: minmax(250px, 1.35fr) repeat(3, minmax(150px, 1fr));
  gap: 10px;
  pointer-events: none;
}

.map-insight {
  min-width: 0;
  min-height: 88px;
  padding: 12px 14px;
  color: inherit;
  overflow: hidden;
  border: 1px solid var(--insight-border, var(--swos-border));
  border-radius: 8px;
  background: linear-gradient(
      135deg,
      var(--insight-bg, transparent),
      transparent 62%
    ),
    var(--swos-map-card);
  box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
  backdrop-filter: blur(16px);
  text-decoration: none;
  pointer-events: auto;
  transition: border-color 160ms ease, transform 160ms ease;
}

.map-insight:hover {
  border-color: var(--insight-color, rgba(25, 118, 210, 0.5));
  transform: translateY(-2px);
}

.insight-heading,
.rain-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.insight-heading {
  margin-bottom: 7px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
}

.rain-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rain-period {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--rain-period-border, var(--insight-border));
  border-left: 4px solid var(--rain-period-accent, var(--insight-color));
  border-radius: 6px;
  background: var(
    --rain-period-bg,
    linear-gradient(135deg, var(--insight-bg), transparent 74%)
  );
}

.rain-value {
  gap: 8px;
  font-size: 11px;
}

.rain-value span {
  color: var(--rain-period-text, var(--insight-color));
  font-weight: 700;
}

.rain-value strong {
  color: var(--rain-period-text, var(--insight-color));
  font-size: 16px;
}

.rain-value small {
  font-size: 9px;
}

.rain-track {
  height: 5px;
  margin: 6px 0 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--rain-track-bg, var(--insight-bg-strong));
}

.rain-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--rain-period-accent, var(--insight-color));
}

.rain-period .insight-note {
  color: var(--rain-period-note, var(--swos-text-muted));
}

.metric-insight {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  font-size: 21px;
}

.wind-compass {
  color: var(--insight-color, #0d9488);
  background: var(--insight-bg-strong, rgb(20 184 166 / 14%));
}

.wind-insight .insight-label,
.wind-insight strong {
  color: var(--insight-color);
}

.water-level-icon {
  color: #0284c7;
  background: rgb(14 165 233 / 14%);
}

.metric-insight > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.metric-insight strong {
  font-size: 20px;
  line-height: 1.15;
}

.metric-insight small {
  font-size: 11px;
  font-weight: 500;
}

.insight-label {
  color: var(--swos-text-muted);
  font-size: 11px;
}

.insight-note {
  overflow: hidden;
  color: var(--swos-text-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.typhoon-insight {
  display: grid;
  min-height: 126px;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 10px 12px 12px;
  background: linear-gradient(
    135deg,
    rgb(220 38 38 / 12%),
    rgb(14 165 233 / 8%)
  ),
  var(--swos-map-card);
}

.typhoon-heading {
  margin-bottom: 6px;
  color: #dc2626;
}

.typhoon-heading-link {
  display: flex;
  align-items: center;
  gap: 7px;
  color: inherit;
  text-decoration: none;
}

.typhoon-carousel {
  min-width: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
}

:deep(.typhoon-carousel .q-carousel__slide) {
  padding: 0;
}

:deep(.typhoon-carousel .q-carousel__navigation) {
  bottom: -6px;
}

:deep(.typhoon-carousel .q-carousel__navigation .q-btn) {
  width: 16px;
  height: 16px;
  min-height: 16px;
  margin: 0 1px;
}

:deep(.typhoon-carousel .q-carousel__arrow .q-btn) {
  width: 24px;
  height: 24px;
  min-height: 24px;
  background: var(--swos-surface);
  box-shadow: 0 4px 12px rgb(15 23 42 / 18%);
}

.typhoon-card {
  display: grid;
  height: 100%;
  min-width: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid rgb(220 38 38 / 14%);
  border-radius: 8px;
  background: var(--swos-surface-overlay);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%);
  color: inherit;
  text-decoration: none;
}

.typhoon-card-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.typhoon-card-icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(220 38 38 / 22%);
  border-radius: 50%;
  color: #dc2626;
  background: rgb(220 38 38 / 13%);
  font-size: 18px;
}

.typhoon-card-content {
  min-width: 0;
}

.typhoon-card-top,
.typhoon-location,
.typhoon-stat-row {
  display: flex;
  min-width: 0;
  align-items: center;
}

.typhoon-card-top {
  gap: 7px;
}

.typhoon-card-top strong {
  min-width: 0;
  overflow: hidden;
  color: #991b1b;
  font-size: 15px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.typhoon-card-top span {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  color: #b45309;
  background: rgb(245 158 11 / 15%);
  font-size: 10px;
  font-weight: 700;
}

.typhoon-location {
  gap: 3px;
  margin-top: 3px;
  color: var(--swos-text-muted);
  font-size: 10px;
}

.typhoon-location span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.typhoon-stat-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 8px;
  color: var(--swos-text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.typhoon-stat-row span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.warning-heading {
  color: #d97706;
}

.warning-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.warning-summary-item {
  --summary-color: #94a3b8;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding-left: 8px;
  border-left: 3px solid var(--summary-color);
}

.warning-summary-item span {
  color: var(--swos-text-muted);
  font-size: 10px;
}

.warning-summary-item strong {
  color: var(--summary-color);
  font-size: 19px;
  line-height: 1.05;
}

.warning-summary-item small {
  overflow: hidden;
  color: var(--swos-text-muted);
  font-size: 10px;
  text-overflow: ellipsis;
}

@media (max-width: 1200px) {
  .map-insight-dock {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }

  .map-insight-dock::-webkit-scrollbar {
    display: none;
  }

  .map-insight {
    flex: 0 0 196px;
    scroll-snap-align: start;
  }

  .rain-insight {
    flex-basis: 312px;
  }

  .warning-insight,
  .typhoon-insight {
    flex-basis: 260px;
  }
}

@media (max-width: 800px) {
  .status-detail {
    grid-template-columns: fit-content(230px) minmax(0, 1fr);
  }

  .status-time {
    display: none;
  }

  .map-insight {
    flex-basis: 190px;
  }

  .rain-insight {
    flex-basis: 292px;
  }

  .warning-insight,
  .typhoon-insight {
    flex-basis: 252px;
  }
}

@media (max-width: 650px) {
  .dashboard-top-overlay--panel-open {
    right: 258px;
  }

  .dashboard-header {
    padding-top: 66px !important;
    padding-right: 12px !important;
    padding-left: 16px !important;
  }

  .dashboard-header--compact {
    min-height: 64px;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  .latest-status {
    width: 100%;
    margin-right: 0;
    margin-top: 8px;
    text-align: left;
  }
}

@media (max-width: 600px) {
  .dashboard-top-overlay {
    top: 10px;
    right: 64px;
    left: 10px;
  }

  .dashboard-top-overlay.dashboard-top-overlay--panel-open {
    right: 258px;
  }

  .status-marquee {
    animation-duration: max(
      30s,
      calc(var(--status-marquee-duration, 48s) - 6s)
    );
  }

  .status-detail {
    grid-template-columns: fit-content(170px) minmax(0, 1fr);
  }

  .status-detail-title {
    gap: 5px;
    padding-right: 8px;
  }

  .status-detail-title .status-message {
    font-size: 10px;
  }

  .status-detail-marquee {
    padding: 0 12px;
  }

  .map-insight {
    flex-basis: 184px;
    min-height: 82px;
  }

  .rain-insight {
    flex-basis: 284px;
  }

  .warning-insight,
  .typhoon-insight {
    flex-basis: 246px;
  }
}
</style>
