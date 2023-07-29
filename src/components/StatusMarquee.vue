<template>
  <marquee-text
    class="q-ml-xl"
    style="max-width: 600px;">
    Weather Warning in effect:
    <!--    <i v-for="i in weatherWarningStore.currentWarningList" :key="i">-->
    <!--    </i>-->
  </marquee-text>
</template>

<script lang="ts">
import {defineComponent, watch} from 'vue';
import MarqueeText from 'vue-marquee-text-component';
import {useQuasar} from 'quasar';
import 'qweather-icons/font/qweather-icons.css'
import {useWeatherWarningStore} from 'stores/weather-warning';
import sdk from 'src/composables/sdk';

export default defineComponent({
  name: 'StatusMarquee',
  components: {
    MarqueeText
  },
  setup() {
    const $q = useQuasar();
    const weatherWarningStore = useWeatherWarningStore();

    $q.iconMapFn = (iconName) => {
      if (iconName.startsWith('qweather:')) {
        const name = iconName.substring(9)
        return {
          cls: `qi-${name}`
        }
      }
    }


    const {data} = sdk.useFetch<WeatherWarningList>(
      'https://api.daziannetwork.com/warning/weather_warning',
      true);
    watch(data, () => {
      if (data.value === null || data.value === undefined) {
        sdk.showNotification('negative', 'Failed to refresh: list is null or undefined.')
      } else {
        weatherWarningStore.setCurrentWarningList(data.value);
      }
    });

    watch(weatherWarningStore.currentWarningList, () => {
      for (const i in weatherWarningStore.currentWarningList.districts) {
        const weatherWarnings = weatherWarningStore.currentWarningList.districts[i];

      }
    })

    return {
      weatherWarningStore
    }
  }
})
</script>

<style>
</style>
