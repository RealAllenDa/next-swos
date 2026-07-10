<template>
  <q-page class="fullscreen-map-page column items-stretch no-wrap">
    <q-toolbar
      :class="{ 'dashboard-title-toolbar--compact': !genericStore.showHeader }"
      class="dashboard-title-toolbar"
    >
      <div>
        <div class="text-h6">天气预警</div>
        <div class="text-caption text-grey-7">Weather Warnings</div>
      </div>
    </q-toolbar>
    <WeatherWarningMap v-if="data" style="flex: 1" />
    <PageLoading :show="loading" />
  </q-page>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import WeatherWarningMap from 'components/WeatherWarningMap.vue';
import PageLoading from 'components/PageLoading.vue';
import { useProductionPollingFetch } from 'src/composables/use-polling-fetch';
import { useWeatherWarningStore } from 'stores/weather-warning';
import { useGenericStore } from 'stores/generic';

const store = useWeatherWarningStore();
store.$reset();
const genericStore = useGenericStore();
genericStore.initPageSpec(false, true, false);
const { data, loading } = useProductionPollingFetch<WeatherWarningList>(
  '/warning/weather_warning'
);
watch(data, (warnings) => {
  if (warnings) store.setCurrentWarningList(warnings);
});
</script>
