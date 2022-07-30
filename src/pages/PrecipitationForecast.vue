<template>
  <q-page class="column items-stretch">
    <MapSettings
      @refresh="() => refreshPrecipitation('refresh')"
    ></MapSettings>
    <PrecipitationMap style="flex: 1"></PrecipitationMap>
  </q-page>
</template>

<script lang="ts">
import {defineComponent, unref, watch} from 'vue';
import MapSettings from 'components/PrecipFcstMapSettings.vue';
import PrecipitationMap from 'components/PrecipFcstMap.vue';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';

export default defineComponent({
  name: 'PrecipitationForecast',
  components: {PrecipitationMap, MapSettings},
  setup() {
    const precipitationStore = usePrecipitationStore();

    function initPrecipitation() {
      const {data: options} = sdk.useFetch<MapSpec>('/static/generic/analysis_map.json');
      watch(options, () => {
        if (options.value === null || options.value === undefined) {
          throw new Error('Failed to refresh: spec is null or undefined.')
        } else {
          precipitationStore.setSpec(unref(options));
        }
        refreshPrecipitation('initialize')
      })
    }

    function refreshPrecipitation(mutationType: string) {
      const {data} = sdk.useFetch<PrecipitationAnalysisList>('/precip/analysis/list');
      watch(data, () => {
        if (data.value === null || data.value === undefined) {
          throw new Error('Failed to refresh: data is null or undefined.')
        } else {
          precipitationStore.setList(unref(data), mutationType);
        }
      })
    }

    initPrecipitation()

    return {
      refreshPrecipitation
    }
  }
});
</script>
