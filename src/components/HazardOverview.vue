<template>
  <q-page class="hazard-page column no-wrap">
    <q-toolbar class="hazard-toolbar">
      <div>
        <div class="text-h6">{{ config.title }}</div>
        <div class="text-caption text-grey-7">{{ config.subtitle }}</div>
      </div>
      <q-space />
      <div v-if="messageTime" class="text-caption q-mr-md">
        更新时间：{{ messageTime }}
      </div>
      <q-btn
        flat
        round
        icon="refresh"
        :loading="loading"
        aria-label="刷新"
        @click="refresh"
      />
    </q-toolbar>

    <div class="hazard-content row no-wrap">
      <div class="col hazard-map-column">
        <HazardMap
          :mode="config.mode"
          :data="data"
          :area-geo-json="areaGeoJson"
          :river-geo-json="riverGeoJson"
          :designated-only="designatedOnly"
          @select-feature="selectFeature"
        />
      </div>

      <q-card flat bordered square class="hazard-panel column no-wrap">
        <q-card-section class="q-gutter-sm">
          <q-btn-toggle
            v-if="isRain"
            v-model="rainGrouping"
            spread
            no-caps
            toggle-color="primary"
            :options="[
              { label: '按区域', value: 'area' },
              { label: '按站点', value: 'station' },
            ]"
          />
          <q-toggle
            v-if="config.mode === 'flood-rivers'"
            v-model="designatedOnly"
            label="仅显示指定河流"
          />
          <q-toggle v-model="showNormal" label="显示正常级别" />
        </q-card-section>
        <q-separator />
        <q-scroll-area class="col">
          <q-list separator>
            <template v-for="group in visibleGroups" :key="group.level">
              <q-item-label header class="row items-center">
                <span
                  class="level-dot q-mr-sm"
                  :style="{ backgroundColor: levelColor(group.level) }"
                ></span>
                {{ levelLabel(group.level) }}（{{ group.items.length }}）
              </q-item-label>
              <q-item
                v-for="item in group.items"
                :key="item.id"
                :clickable="config.mode === 'flood-stations'"
                @click="openStation(item.id)"
              >
                <q-item-section>
                  <q-item-label>{{ item.name }}</q-item-label>
                  <q-item-label v-if="item.detail" caption>{{
                    item.detail
                  }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <q-item v-if="!loading && visibleGroups.length === 0">
              <q-item-section class="text-grey-7"
                >当前没有符合条件的数据。</q-item-section
              >
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card>
    </div>

    <q-inner-loading :showing="loading" label="正在加载监测数据…" />
    <FloodStationHistory v-model="historyOpen" :station="selectedStation" />
  </q-page>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, type PropType } from 'vue';
import type { GeoJsonProperties } from 'geojson';
import HazardMap from 'components/HazardMap.vue';
import FloodStationHistory from 'components/FloodStationHistory.vue';
import { useProductionPollingFetch } from 'src/composables/use-polling-fetch';
import {
  floodStationLevel,
  HAZARD_COLORS,
  maximumRiverLevel,
} from 'src/composables/hazard-utils';
import { useGenericStore } from 'stores/generic';

interface GroupItem {
  id: string;
  name: string;
  detail?: string;
  level: number;
}

export default defineComponent({
  name: 'HazardOverview',
  components: { FloodStationHistory, HazardMap },
  props: {
    config: { type: Object as PropType<HazardConfig>, required: true },
  },
  setup(props) {
    const endpoint = computed(() => props.config.endpoint);
    const { data, loading, refresh } =
      useProductionPollingFetch<HazardApiState>(endpoint);
    const { data: areaGeoJson } = useProductionPollingFetch<HazardGeoJSON>(
      '/assets/generic/around_shanghai_geojson',
      86_400_000
    );
    const { data: riverGeoJson } = useProductionPollingFetch<HazardGeoJSON>(
      '/assets/flood/river_geojson',
      86_400_000,
      computed(() => props.config.mode.startsWith('flood-'))
    );
    const showNormal = ref(false);
    const designatedOnly = ref(true);
    const rainGrouping = ref<'area' | 'station'>('area');
    const selectedStation = ref('');
    const historyOpen = ref(false);

    const isRain = computed(() => props.config.mode.startsWith('rain-'));
    const messageTime = computed(() => {
      if (!data.value) return '';
      if ('message_time' in data.value) return data.value.message_time ?? '';
      return '';
    });

    function rainItems(): GroupItem[] {
      const state = data.value as RainState;
      if (rainGrouping.value === 'station') {
        return (state.rain ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          detail: `${item.area} · ${item.value} mm`,
          level:
            props.config.mode === 'rain-period' ? item.period ?? 0 : item.level,
        }));
      }
      const areas = new Map<string, GroupItem>();
      (state.rain ?? []).forEach((item) => {
        const level =
          props.config.mode === 'rain-period' ? item.period ?? 0 : item.level;
        const current = areas.get(item.area);
        if (!current || level > current.level) {
          areas.set(item.area, {
            id: item.area,
            name: item.area,
            detail: `最高 ${item.value} mm`,
            level,
          });
        }
      });
      return [...areas.values()];
    }

    function windItems(): GroupItem[] {
      return Object.entries((data.value as WindState).wind ?? {}).flatMap(
        ([area, observations]) =>
          observations.map((item) => ({
            id: item.id,
            name: item.name,
            detail: `${area} · ${item.speed} m/s · ${item.direction}`,
            level: item.level,
          }))
      );
    }

    function inundationItems(): GroupItem[] {
      return Object.entries(
        (data.value as InundationState).inundation ?? {}
      ).flatMap(([area, observations]) =>
        observations.map((item) => ({
          id: item.id,
          name: item.name,
          detail: `${area} · ${item.water_level} cm`,
          level: item.level,
        }))
      );
    }

    function floodItems(): GroupItem[] {
      const state = data.value as FloodState;
      if (props.config.mode === 'flood-stations') {
        return Object.entries(state.station ?? {}).map(([name, station]) => ({
          id: name,
          name,
          detail: `${station.original_river} · ${station.current_level} m`,
          level: floodStationLevel(station),
        }));
      }
      return Object.entries(state.flood ?? {})
        .filter(
          ([, river]) => !designatedOnly.value || Boolean(river.important)
        )
        .map(([name, river]) => ({
          id: name,
          name,
          level: maximumRiverLevel(river),
        }));
    }

    function warningItems(): GroupItem[] {
      const state = data.value as FloodWarningState;
      return [
        { id: 'flood', name: '防汛防台应急响应', level: state.flood },
        {
          id: 'water-level',
          name: '黄浦江高潮位预警',
          level: state.water_level,
        },
      ];
    }

    const items = computed<GroupItem[]>(() => {
      if (!data.value) return [];
      if (isRain.value) return rainItems();
      if (props.config.mode === 'wind') return windItems();
      if (props.config.mode === 'inundation') return inundationItems();
      if (props.config.mode === 'flood-warning') return warningItems();
      return floodItems();
    });

    const visibleGroups = computed(() => {
      const groups = new Map<number, GroupItem[]>();
      items.value.forEach((item) => {
        if (!showNormal.value && item.level === 0) return;
        groups.set(item.level, [...(groups.get(item.level) ?? []), item]);
      });
      return [...groups.entries()]
        .sort(([levelA], [levelB]) => levelB - levelA)
        .map(([level, groupItems]) => ({
          level,
          items: groupItems.sort((a, b) =>
            a.name.localeCompare(b.name, 'zh-CN')
          ),
        }));
    });

    function levelLabel(level: number): string {
      if (level === 0) return '正常';
      if (props.config.mode === 'rain-period') {
        return (
          [
            '正常',
            '1–10年一遇',
            '10–30年一遇',
            '30–50年一遇',
            '50–70年一遇',
            '70–90年一遇',
            '100年以上一遇',
          ][level] ?? `${level}级`
        );
      }
      if (isRain.value)
        return (
          ['正常', '小雨', '中雨', '大雨', '暴雨', '大暴雨', '特大暴雨'][
            level
          ] ?? `${level}级`
        );
      if (props.config.mode === 'wind')
        return (
          ['无风', '1–4级', '5–6级', '7–9级', '10–12级', '12级以上'][level] ??
          `${level}级`
        );
      if (props.config.mode === 'inundation')
        return (
          ['正常', '轻度积水', '中度积水', '重度积水', '严重积水'][level] ??
          `${level}级`
        );
      if (props.config.mode === 'flood-warning')
        return (
          ['未发布', '蓝色', '黄色', '橙色', '红色'][level] ?? `${level}级`
        );
      return (
        ['正常', '泛滥注意', '泛滥警戒', '泛滥危险', '发生泛滥'][level] ??
        `${level}级`
      );
    }

    function levelColor(level: number): string {
      return HAZARD_COLORS[level] ?? HAZARD_COLORS[0];
    }

    function openStation(station: string) {
      if (props.config.mode !== 'flood-stations') return;
      selectedStation.value = station;
      historyOpen.value = true;
    }

    function selectFeature(properties: GeoJsonProperties) {
      if (props.config.mode === 'flood-stations' && properties?.id)
        openStation(String(properties.id));
    }

    onMounted(() => useGenericStore().initPageSpec(false, false, false));

    return {
      data,
      loading,
      refresh,
      areaGeoJson,
      riverGeoJson,
      showNormal,
      designatedOnly,
      rainGrouping,
      isRain,
      messageTime,
      visibleGroups,
      levelLabel,
      levelColor,
      selectedStation,
      historyOpen,
      openStation,
      selectFeature,
    };
  },
});
</script>

<style scoped>
.hazard-page {
  height: 100dvh;
  min-height: 600px;
}

.hazard-toolbar {
  min-height: 68px;
  padding-right: 160px;
  padding-left: 76px;
  color: inherit;
  background: var(--swos-surface-soft);
}

.hazard-content {
  flex: 1;
  min-height: 0;
}

.hazard-map-column {
  min-width: 0;
}

.hazard-panel {
  width: min(360px, 35vw);
}

.level-dot {
  width: 12px;
  height: 12px;
  border: 1px solid rgb(0 0 0 / 25%);
  border-radius: 50%;
}

@media (max-width: 700px) {
  .hazard-toolbar {
    min-height: 112px;
    padding: 58px 12px 8px;
  }

  .hazard-content {
    flex-direction: column;
  }

  .hazard-map-column {
    min-height: 55vh;
  }

  .hazard-panel {
    width: 100%;
    max-height: 35vh;
  }
}
</style>
