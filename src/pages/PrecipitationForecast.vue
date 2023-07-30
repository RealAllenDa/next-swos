<template>
  <q-page class="column items-stretch">
    <MapSettings
      @refresh="() => refreshPrecipitation('refresh')"
    ></MapSettings>
    <PrecipitationMap style="flex: 1"></PrecipitationMap>
    <PageLoading :show="!initialized"></PageLoading>
  </q-page>
</template>

<script lang="ts">
import {computed, defineComponent, onUnmounted, watch} from 'vue';
import MapSettings from 'components/PrecipFcstMapSettings.vue';
import PrecipitationMap from 'components/PrecipFcstMap.vue';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';
import {useRoute} from 'vue-router';
import PageLoading from 'components/PageLoading.vue';

export default defineComponent({
  name: 'PrecipitationForecast',
  components: {PageLoading, PrecipitationMap, MapSettings},
  setup() {
    const precipitationStore = usePrecipitationStore();
    const route = useRoute();
    const routeResolution = computed(() => route.query.resolution);
    const routeDuration = computed(() => route.query.duration);
    const routeTorrential = computed(() => route.query.torrential === 'y');
    const initialized = computed({
      get() {
        return precipitationStore.initialized
      },
      set() {
        precipitationStore.initialized = true;
      }
    });

    function initPrecipitation() {
      const {data: options} = sdk.useFetch<MapSpec>('/static/generic/analysis_map.json');
      watch(options, () => {
        if (options.value === null || options.value === undefined) {
          sdk.showNotification('negative', 'Failed to refresh: spec is null or undefined.')
        } else {
          precipitationStore.setSpec(options.value);
          precipitationStore.setOptions(<string>routeResolution.value, <string>routeDuration.value, routeTorrential.value);
        }
        refreshPrecipitation('initialize')
      })
    }

    function refreshPrecipitation(mutationType: string) {
      const {data} = sdk.useFetch<PrecipitationAnalysisList>('/precip/analysis/list');
      watch(data, () => {
        if (data.value === null || data.value === undefined) {
          sdk.showNotification('negative', 'Failed to refresh: data is null or undefined.')
        } else {
          precipitationStore.setList(data.value, mutationType);
          initialized.value = true;
        }
      })
    }

    initPrecipitation()

    onUnmounted(() => {
      precipitationStore.$dispose()
    })

    return {
      refreshPrecipitation,
      initialized
    }
  }
});
</script>
