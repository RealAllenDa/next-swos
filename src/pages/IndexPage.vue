<template>
  <q-page class="dashboard-page column no-wrap">
    <section class="dashboard-header row items-center q-px-lg q-py-md">
      <div>
        <div class="text-h4 text-weight-bold">综合态势</div>
        <div class="text-subtitle2 text-grey-7">
          Shanghai Weather & Warning Observation System
        </div>
      </div>
      <q-space />
      <div class="latest-status text-right">
        <div class="text-caption text-grey-7">最近数据时间</div>
        <div class="text-subtitle2 text-weight-medium">{{ latestUpdate }}</div>
      </div>
    </section>

    <section class="map-section">
      <ComprehensiveMap :data="dashboardData" />
      <q-linear-progress
        v-if="initialLoading"
        class="dashboard-progress"
        indeterminate
      />

      <div class="dashboard-top-overlay">
        <div
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
                <q-icon :name="status.icon" size="1.1rem" />
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
              <q-icon :name="currentDetailStatus.icon" size="1.1rem" />
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

        <div class="map-insight-dock">
          <router-link class="map-insight rain-insight" to="/precip/forecast">
            <div class="insight-heading">
              <span><q-icon name="water_drop" /> 降雨</span>
              <q-icon name="arrow_forward" />
            </div>
            <div class="rain-comparison">
              <div
                v-for="rain in rainSummary"
                :key="rain.label"
                class="rain-period"
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
            to="/wind"
          >
            <div class="metric-icon wind-compass">
              <q-icon :style="windDirectionStyle" name="navigation" />
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
            class="map-insight metric-insight water-insight"
            to="/inundation"
          >
            <div class="metric-icon water-level-icon">
              <q-icon name="water_drop" />
            </div>
            <div>
              <span class="insight-label">道路积水</span>
              <strong>{{ inundationSummary.active }} <small>处</small></strong>
              <span class="insight-note"
                >最高 {{ inundationSummary.maximum.toFixed(1) }} cm</span
              >
            </div>
          </router-link>

          <div class="map-insight hydro-insight">
            <span class="insight-label">水情</span>
            <div class="hydro-metrics">
              <router-link to="/flood/rivers"
                ><strong>{{ elevatedRiverCount }}</strong
                ><span>异常河流</span></router-link
              >
              <router-link to="/flood/stations"
                ><strong>{{ elevatedStationCount }}</strong
                ><span>异常站点</span></router-link
              >
            </div>
          </div>
        </div>
      </div>
    </section>
  </q-page>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ComprehensiveMap from 'components/ComprehensiveMap.vue';
import sdk from 'src/composables/sdk';
import {
  usePollingFetch,
  useProductionPollingFetch,
} from 'src/composables/use-polling-fetch';
import {
  floodStationLevel,
  maximumRiverLevel,
} from 'src/composables/hazard-utils';
import { useGenericStore } from 'stores/generic';

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

type StatusPhase = 'overview' | 'detail';

const warningLevelLabels = ['未知', '蓝色', '黄色', '橙色', '红色'];

function weatherWarningTone(level: number): DashboardStatusTone {
  if (level >= 4) return 'negative';
  if (level >= 2) return 'warning';
  if (level === 1) return 'info';
  return 'grey';
}

function timestampValue(value?: string) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

useGenericStore().initPageSpec(false, false, false);
const { data: geography, loading: geographyLoading } =
  useProductionPollingFetch<HazardGeoJSON>(
    '/assets/generic/around_shanghai_geojson',
    86_400_000
  );
const { data: rivers, loading: riversLoading } =
  useProductionPollingFetch<HazardGeoJSON>(
    '/assets/flood/river_geojson',
    86_400_000
  );
const { data: rain1h, loading: rain1hLoading } =
  useProductionPollingFetch<RainState>('/warning/rain_state_1h');
const { data: rain24h, loading: rain24hLoading } =
  useProductionPollingFetch<RainState>('/warning/rain_state');
const { data: wind, loading: windLoading } =
  useProductionPollingFetch<WindState>('/warning/wind_state');
const { data: inundation, loading: inundationLoading } =
  useProductionPollingFetch<InundationState>('/warning/inundation_state');
const { data: flood, loading: floodLoading } =
  useProductionPollingFetch<FloodState>('/warning/flood_state');
const { data: weatherWarnings, loading: warningLoading } =
  useProductionPollingFetch<WeatherWarningList>('/warning/weather_warning');
const { data: floodWarning, loading: floodWarningLoading } =
  useProductionPollingFetch<FloodWarningState>('/warning/flood_warning');
const { data: typhoonList, loading: typhoonLoading } =
  useProductionPollingFetch<TyphoonList[]>('/warning/typhoon_activity');
const { data: radar, loading: radarLoading } = usePollingFetch<RainViewerMaps>(
  'https://api.rainviewer.com/public/weather-maps.json',
  600_000,
  true,
  true
);
const typhoons = ref<Record<string, TyphoonDetail>>({});
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
    { label: '近 1 小时', observations: rain1h.value?.rain ?? [] },
    { label: '近 24 小时', observations: rain24h.value?.rain ?? [] },
  ].map(({ label, observations }) => ({
    label,
    active: observations.filter((item) => item.level > 0).length,
    maximum: Math.max(0, ...observations.map((item) => Number(item.value))),
  }));
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
  const radarTime = radar.value?.radar.past.at(-1)?.time;
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
  padding-right: 56px !important;
  padding-left: 76px !important;
  background: linear-gradient(
    120deg,
    var(--swos-surface),
    var(--swos-surface-soft)
  );
  border-bottom: 1px solid var(--swos-border);
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
  right: 298px;
  left: 16px;
  display: grid;
  gap: 10px;
  pointer-events: none;
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
  min-width: 200%;
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
  min-width: 50%;
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
  background: color-mix(in srgb, var(--status-color) 12%, transparent);
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
  background: color-mix(in srgb, var(--status-color) 6%, transparent);
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
  animation: status-detail-marquee var(--status-detail-duration, 26s) linear
    infinite;
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
}

.status-detail--info {
  --status-color: #0284c7;
}

.status-detail--warning {
  --status-color: #d97706;
}

.status-detail--negative {
  --status-color: #dc2626;
}

.status-detail--grey {
  --status-color: #64748b;
}

.status-item {
  --status-color: #94a3b8;
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
  background: color-mix(in srgb, var(--status-color) 8%, transparent);
  font-size: 12px;
  line-height: 1.2;
  text-decoration: none;
  transition: background 160ms ease;
}

.status-item:last-child {
  border-right: 0;
}

.status-item:hover {
  background: color-mix(in srgb, var(--status-color) 14%, transparent);
}

.status-item--positive {
  --status-color: #16a34a;
}

.status-item--info {
  --status-color: #0284c7;
}

.status-item--warning {
  --status-color: #d97706;
}

.status-item--negative {
  --status-color: #dc2626;
}

.status-item--grey {
  --status-color: #64748b;
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
  border: 1px solid var(--swos-border);
  border-radius: 8px;
  background: var(--swos-map-card);
  box-shadow: 0 12px 32px rgb(15 23 42 / 18%);
  backdrop-filter: blur(16px);
  text-decoration: none;
  pointer-events: auto;
  transition: border-color 160ms ease, transform 160ms ease;
}

.map-insight:hover {
  border-color: color-mix(in srgb, var(--q-primary) 50%, var(--swos-border));
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

.rain-value {
  gap: 8px;
  font-size: 11px;
}

.rain-value strong {
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
  background: rgb(59 130 246 / 14%);
}

.rain-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38bdf8, #2563eb, #7c3aed);
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
  color: #0d9488;
  background: rgb(20 184 166 / 14%);
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

.hydro-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 5px;
}

.hydro-metrics a {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: inherit;
  text-decoration: none;
}

.hydro-metrics strong {
  color: #6366f1;
  font-size: 20px;
}

.hydro-metrics span {
  color: var(--swos-text-muted);
  font-size: 10px;
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
}

@media (max-width: 650px) {
  .dashboard-header {
    padding-top: 66px !important;
    padding-right: 16px !important;
    padding-left: 16px !important;
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
}
</style>
