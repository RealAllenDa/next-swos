<template>
  <q-page class="warning-overview-page">
    <q-toolbar
      :class="{ 'dashboard-title-toolbar--compact': !genericStore.showHeader }"
      class="dashboard-title-toolbar"
    >
      <div>
        <div class="text-h6">警报预报一览</div>
        <div class="text-caption text-grey-7">Warnings Overview</div>
      </div>
      <q-space/>
      <div v-if="latestUpdate" class="update-time text-caption text-grey-7">
        更新时间：{{ latestUpdate }}
      </div>
    </q-toolbar>

    <main class="warning-content">
      <section>
        <div class="section-heading">
          <div class="heading-icon weather-icon">
            <q-icon name="fa-solid fa-triangle-exclamation"/>
          </div>
          <div>
            <div class="text-h6 text-weight-bold">天气预警</div>
            <div class="text-caption text-grey-7">
              {{ weatherWarnings.length }} 条生效预警
            </div>
          </div>
          <q-space/>
          <q-btn color="primary" flat label="查看地图" to="/warning/weather"/>
        </div>

        <div v-if="weatherWarnings.length" class="warning-grid">
          <article
            v-for="warning in weatherWarnings"
            :key="warning.id"
            :style="{ '--warning-color': levelColor(warning.level) }"
            class="warning-card"
          >
            <div class="warning-card-top">
              <div>
                <div class="warning-location">{{ warning.district }}</div>
                <div class="text-h6">
                  {{ warning.type }}{{ levelLabel(warning.level) }}预警
                </div>
              </div>
              <q-badge
                :label="levelLabel(warning.level)"
                :style="{ backgroundColor: levelColor(warning.level) }"
                :text-color="
                  warning.level === 2 || warning.level === 3 ? 'dark' : 'white'
                "
                rounded
              />
            </div>
            <div class="warning-meta">
              <span><q-icon name="campaign"/> {{ warning.name }}</span>
              <span><q-icon name="schedule"/> {{ warning.time }}</span>
            </div>
            <p class="warning-detail">
              {{ warning.detail || '暂无详细说明。' }}
            </p>
          </article>
        </div>
        <q-banner v-else-if="!weatherLoading" class="empty-state" rounded>
          <template #avatar
          >
            <q-icon color="positive" name="verified"
            />
          </template>
          当前没有生效的天气预警。
        </q-banner>
      </section>

      <section>
        <div class="section-heading">
          <div class="heading-icon flood-icon">
            <q-icon name="fa-solid fa-water"/>
          </div>
          <div>
            <div class="text-h6 text-weight-bold">防汛预警</div>
            <div class="text-caption text-grey-7">全部防汛响应与高潮位预警</div>
          </div>
          <q-space/>
          <q-btn color="primary" flat label="查看地图" to="/warning/flood"/>
        </div>

        <div class="flood-grid">
          <article
            v-for="warning in floodWarnings"
            :key="warning.id"
            :style="{ '--warning-color': levelColor(warning.level) }"
            class="flood-card"
          >
            <q-icon :name="warning.icon" class="flood-card-icon"/>
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">
                {{ warning.title }}
              </div>
              <div class="text-caption text-grey-7">
                {{ warning.description }}
              </div>
            </div>
            <div class="flood-level">
              <strong>{{ levelLabel(warning.level) }}</strong>
              <span>{{
                  warning.level ? `${5 - warning.level} 级` : '未发布'
                }}</span>
            </div>
          </article>
        </div>
      </section>
    </main>

    <q-inner-loading :showing="weatherLoading || floodLoading"/>
  </q-page>
</template>

<script lang="ts" setup>
import {computed} from 'vue';
import {useProductionPollingFetch} from 'src/composables/use-polling-fetch';
import {useGenericStore} from 'stores/generic';

interface WeatherWarningItem extends WeatherWarning {
  id: string;
  district: string;
}

interface FloodWarningItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  level: number;
}

const excludedDistricts = new Set(['江苏省', '浙江省']);
const {data: weather, loading: weatherLoading} =
  useProductionPollingFetch<WeatherWarningList>('/warning/weather_warning');
const {data: flood, loading: floodLoading} =
  useProductionPollingFetch<FloodWarningState>('/warning/flood_warning');

const weatherWarnings = computed<WeatherWarningItem[]>(() =>
  Object.entries(weather.value?.districts ?? {})
    .filter(([district]) => !excludedDistricts.has(district))
    .flatMap(([district, warnings]) =>
      warnings.map((warning, index) => ({
        ...warning,
        district,
        id: `${district}-${warning.type}-${warning.time}-${index}`,
      }))
    )
    .sort(
      (a, b) =>
        b.level - a.level || a.district.localeCompare(b.district, 'zh-CN')
    )
);

const floodWarnings = computed<FloodWarningItem[]>(() => [
  {
    id: 'flood',
    title: '防汛防台应急响应',
    description: '上海市防汛防台应急响应等级',
    icon: 'shield',
    level: flood.value?.flood ?? 0,
  },
  {
    id: 'water-level',
    title: '黄浦江高潮位预警',
    description: '黄浦江沿线高潮位风险预警等级',
    icon: 'waves',
    level: flood.value?.water_level ?? 0,
  },
]);

const latestUpdate = computed(() =>
  [weather.value?.message_time, flood.value?.message_time]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
);

function levelLabel(level: number): string {
  return ['正常', '蓝色', '黄色', '橙色', '红色'][level] ?? `${level} 级`;
}

function levelColor(level: number): string {
  return (
    ['#94a3b8', '#41a0f8', '#f3e843', '#f8a931', '#f74e3b'][level] ?? '#94a3b8'
  );
}

const genericStore = useGenericStore();
genericStore.initPageSpec(false, true, false);
</script>

<style scoped>
.warning-overview-page {
  min-height: 100dvh;
  background: var(--swos-page);
}

.warning-content {
  display: grid;
  max-width: 1400px;
  gap: 32px;
  padding: 28px;
  margin: 0 auto;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.heading-icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
  font-size: 20px;
}

.weather-icon {
  color: #ea580c;
  background: rgb(249 115 22 / 14%);
}

.flood-icon {
  color: #0284c7;
  background: rgb(14 165 233 / 14%);
}

.warning-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.warning-card,
.flood-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--swos-border);
  border-radius: 16px;
  background: var(--swos-surface);
  box-shadow: 0 10px 28px rgb(15 23 42 / 7%);
}

.warning-card::before,
.flood-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background: var(--warning-color);
  content: '';
}

.warning-card {
  padding: 18px 20px 16px 22px;
}

.warning-card-top,
.warning-meta,
.flood-card {
  display: flex;
  align-items: center;
}

.warning-card-top {
  justify-content: space-between;
  gap: 16px;
}

.warning-location {
  margin-bottom: 2px;
  color: var(--swos-text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.warning-meta {
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 12px;
  color: var(--swos-text-muted);
  font-size: 12px;
}

.warning-detail {
  margin: 12px 0 0;
  line-height: 1.65;
}

.empty-state {
  border: 1px solid var(--swos-border);
  background: var(--swos-surface);
}

.flood-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.flood-card {
  gap: 16px;
  min-height: 112px;
  padding: 20px 22px 20px 26px;
}

.flood-card-icon {
  color: var(--warning-color);
  font-size: 30px;
}

.flood-level {
  display: flex;
  min-width: 76px;
  flex-direction: column;
  color: var(--warning-color);
  text-align: right;
}

.flood-level strong {
  font-size: 20px;
}

.flood-level span {
  color: var(--swos-text-muted);
  font-size: 11px;
}

@media (max-width: 700px) {
  .update-time {
    display: none;
  }

  .warning-content {
    gap: 24px;
    padding: 18px 12px 72px;
  }

  .warning-grid,
  .flood-grid {
    grid-template-columns: 1fr;
  }

  .section-heading .q-btn {
    display: none;
  }
}
</style>
