<template>
  <svg v-if="legendOptions !== undefined"
       height="205" viewBox="0, 0, 396, 615" width="132" xmlns="http://www.w3.org/2000/svg">
    <text font-family="Verdana" font-size="36" x="12" y="48">{{ legendOptions.title }}</text>
    <path d="M24 96 h 90 v 60 h -90 z" fill="rgb(180,000,104)" opacity=".75" stroke="none"/>
    <path d="M24 156 h 90 v 60 h -90 z" fill="rgb(255,040,000)" opacity=".75" stroke="none"/>
    <path d="M24 216 h 90 v 60 h -90 z" fill="rgb(255,153,000)" opacity=".75" stroke="none"/>
    <path d="M24 276 h 90 v 60 h -90 z" fill="rgb(255,245,000)" opacity=".75" stroke="none"/>
    <path d="M24 336 h 90 v 60 h -90 z" fill="rgb(000,065,255)" opacity=".75" stroke="none"/>
    <path d="M24 396 h 90 v 60 h -90 z" fill="rgb(033,140,255)" opacity=".75" stroke="none"/>
    <path d="M24 456 h 90 v 60 h -90 z" fill="rgb(160,210,255)" opacity=".75" stroke="none"/>
    <path d="M24 516 h 90 v 60 h -90 z" fill="rgb(242,242,255)" opacity=".75" stroke="none"/>
    <path
      d="M24 96 h 90 v 480 h -90 z M24 156 h 90 M24 216 h 90 M24 276 h 90 M24 336 h 90 M24 396 h 90 M24 456 h 90 M24 516 h 90"
      fill="none" stroke="#444" stroke-width="2"/>
    <text font-family="Verdana" font-size="32" x="126" y="96">{{ legendOptions.unit }}</text>
    <text v-for="(i, index) in legendOptions.levels" :key="index" :y="index*60+172" font-family="Verdana"
          font-size="36"
          x="126">
      {{ i }}
    </text>
  </svg>
  <svg v-if="torrentialZone" height="60" viewBox="0 0 540 180" width="180">
    <ellipse fill="none" rx="70" ry="30" stroke="red" stroke-width="9" transform="translate(85 85)"/>
    <text font-family="Verdana" font-size="36" x="180" y="70">猛烈</text>
    <text font-family="Verdana" font-size="36" x="180" y="120">降水带</text>
  </svg>
</template>

<script>
import {computed, defineComponent} from 'vue';
import {usePrecipitationStore} from 'src/stores/precipitation';

export default defineComponent({
  name: 'PrecipFcstLegend',
  setup() {
    const precipitationStore = usePrecipitationStore();
    const legendOptions = computed(() => precipitationStore.legendOptions);
    const torrentialZone = computed(() => precipitationStore.displayTorrentialRain);

    return {
      legendOptions,
      torrentialZone
    }
  }
})
</script>
