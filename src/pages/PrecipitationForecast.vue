<template>
  <q-page class="precipitation-page column items-stretch no-wrap">
    <q-toolbar
      :class="{ 'precipitation-toolbar--compact': !showHeader }"
      class="precipitation-toolbar"
    >
      <div>
        <div class="text-h6">降雨分析</div>
        <div class="text-caption text-grey-7">
          Precipitation Analysis
        </div>
      </div>
    </q-toolbar>
    <q-banner
      v-if="showTorrentialRainBanner"
      class="precipitation-alert-banner torrential-rain-banner"
      dense
    >
      <template v-slot:avatar>
        <q-icon
          color="negative"
          name="fa-solid fa-cloud-showers-heavy"
          size="16px"
        />
      </template>
      {{ torrentialRainWarningText }}
    </q-banner>
    <q-banner
      v-if="showRadarLayerBanner"
      class="precipitation-alert-banner radar-layer-banner"
      dense
    >
      <template v-slot:avatar>
        <q-icon color="warning" name="layers_clear" size="16px"/>
      </template>
      {{ radarLayerWarningText }}
    </q-banner>
    <MapSettings
      v-show="showToolbar"
      class="gt-sm"
      @refresh="() => refreshPrecipitation('refresh')"
    ></MapSettings>
    <PrecipitationMap style="flex: 1"></PrecipitationMap>
    <PrecipFcstMapSettingsMobile
      v-show="showToolbar"
      class="lt-md"
      @refresh="() => refreshPrecipitation('refresh')"
    ></PrecipFcstMapSettingsMobile>
    <PageLoading :show="!initialized"></PageLoading>
  </q-page>
</template>

<script lang="ts">
import {computed, defineComponent, onBeforeUnmount, onMounted} from 'vue';
import MapSettings from 'components/PrecipFcstMapSettings.vue';
import PrecipitationMap from 'components/PrecipFcstMap.vue';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';
import {useRoute} from 'vue-router';
import PageLoading from 'components/PageLoading.vue';
import {useGenericStore} from 'stores/generic';
import PrecipFcstMapSettingsMobile from 'components/PrecipFcstMapSettingsMobile.vue';
import {
  TORRENTIAL_RAIN_BELT_WARNING_TEXT,
  latestPrecipitationAnalysisTime,
  useTorrentialRainBelt,
} from 'src/composables/torrential-rain-belt';

export default defineComponent({
  name: 'PrecipitationForecast',
  components: {
    PrecipFcstMapSettingsMobile,
    PageLoading,
    PrecipitationMap,
    MapSettings,
  },
  setup() {
    const genericStore = useGenericStore();
    const precipitationStore = usePrecipitationStore();
    const route = useRoute();
    const routeResolution = computed(() => route.query.resolution);
    const routeDuration = computed(() => route.query.duration);
    const routeTorrential = computed(() => route.query.torrential === 'y');
    const routeGpv = computed(() => route.query.gpv === 'y');
    const routeStation = computed(() => route.query.station === 'y');
    const initialized = computed(() => precipitationStore.initialized);
    const showToolbar = computed(() => {
      return genericStore.showToolbar;
    });
    const showHeader = computed(() => {
      return genericStore.showHeader;
    });
    const torrentialRainBelt = useTorrentialRainBelt(
      computed(() => latestPrecipitationAnalysisTime(precipitationStore.list))
    );
    const showTorrentialRainBanner = computed(
      () => showHeader.value && torrentialRainBelt.exists.value
    );
    const showRadarLayerBanner = computed(
      () =>
        showHeader.value &&
        precipitationStore.initialized &&
        !precipitationStore.radarLayerAvailable
    );

    let controller: AbortController | undefined;

    async function initPrecipitation() {
      controller?.abort();
      controller = new AbortController();
      try {
        const options = await sdk.fetchJson<MapSpec>(
          `${sdk.cdnUrl}/static/generic/analysis_map.json`,
          true,
          controller.signal
        );
        precipitationStore.setSpec(options);
        await refreshPrecipitation('initialize', controller.signal);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        sdk.showNotification(
          'negative',
          `降雨分析初始化失败：${
            cause instanceof Error ? cause.message : String(cause)
          }`
        );
      }
    }

    async function refreshPrecipitation(
      mutationType: string,
      signal?: AbortSignal
    ) {
      try {
        const data = await sdk.fetchJson<PrecipitationAnalysisList>(
          `${sdk.cdnUrl}/analysis/list`,
          true,
          signal
        );
        if (mutationType !== 'refresh') {
          precipitationStore.setOptions(
            typeof routeResolution.value === 'string'
              ? routeResolution.value
              : undefined,
            typeof routeDuration.value === 'string'
              ? routeDuration.value
              : undefined,
            undefined,
            undefined,
            undefined
          );
        }
        precipitationStore.setList(data, mutationType);
        if (mutationType !== 'refresh') {
          precipitationStore.setOptions(
            undefined,
            undefined,
            routeTorrential.value,
            routeGpv.value,
            routeStation.value
          );
        }
        precipitationStore.initialized = true;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        sdk.showNotification(
          'negative',
          `降雨分析刷新失败：${
            cause instanceof Error ? cause.message : String(cause)
          }`
        );
      }
    }

    useGenericStore().initPageSpec(true, true, true);

    onMounted(() => {
      precipitationStore.$reset();
      initPrecipitation();
    });
    onBeforeUnmount(() => controller?.abort());

    return {
      showToolbar,
      showHeader,
      refreshPrecipitation,
      initialized,
      showTorrentialRainBanner,
      showRadarLayerBanner,
      torrentialRainWarningText: TORRENTIAL_RAIN_BELT_WARNING_TEXT,
      radarLayerWarningText: '所选时段无雷达图层，仅提供站点观测数据。',
    };
  },
});
</script>

<style scoped>
.precipitation-page {
  height: 100dvh;
  min-height: 600px;
}

.precipitation-toolbar {
  min-height: 68px;
  padding-right: 224px;
  padding-left: 76px;
  color: inherit;
  background: var(--swos-surface-soft);
}

.precipitation-toolbar--compact {
  min-height: 64px;
  padding-top: 0;
  padding-bottom: 0;
}

.precipitation-toolbar--compact > * {
  display: none;
}

.precipitation-alert-banner {
  min-height: 34px;
  padding-top: 5px;
  padding-bottom: 5px;
  font-weight: 700;
}

.precipitation-alert-banner :deep(.q-banner__avatar) {
  display: flex;
  min-width: 24px;
  align-items: center;
  align-self: center;
  justify-content: center;
}

.torrential-rain-banner {
  color: #991b1b;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
}

.radar-layer-banner {
  color: #854d0e;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
}

@media (max-width: 600px) {
  .precipitation-toolbar {
    min-height: 112px;
    padding: 66px 12px 8px;
  }

  .precipitation-toolbar--compact {
    min-height: 64px;
    padding-top: 0;
    padding-bottom: 0;
  }
}
</style>
