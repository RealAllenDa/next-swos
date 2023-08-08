<template>
  <q-page class="column items-stretch">
    <WeatherWarningMap v-if="initialized" style="flex: 1;"></WeatherWarningMap>
    <PageLoading :show="!initialized"></PageLoading>
  </q-page>
</template>

<script lang="ts">
import {defineComponent, onUnmounted, ref, Ref, watch} from 'vue';
import WeatherWarningMap from 'components/WeatherWarningMap.vue';
import sdk from 'src/composables/sdk';
import {useWeatherWarningStore} from 'stores/weather-warning';
import PageLoading from 'components/PageLoading.vue';
import {useGenericStore} from 'stores/generic';

export default defineComponent({
  name: 'WeatherWarning',
  components: {PageLoading, WeatherWarningMap},
  setup() {
    const initialized: Ref<boolean> = ref(false);
    const weatherWarningStore = useWeatherWarningStore();

    const {data} = sdk.useFetch<WeatherWarningList>(
      'https://api.daziannetwork.com/warning/weather_warning',
      true);
    watch(data, () => {
      if (data.value === null || data.value === undefined) {
        sdk.showNotification('negative', 'Failed to refresh: list is null or undefined.')
      } else {
        weatherWarningStore.setCurrentWarningList(data.value);
        initialized.value = true;
      }
    });

    useGenericStore().initPageSpec(false, false, false)
    onUnmounted(() => {
      weatherWarningStore.$dispose()
    })

    return {
      initialized
    }
  }
})
</script>
