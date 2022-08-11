<template>
  <div>
    <div class="weather-warning-legend">
      <div class="legend-color q-mr-xs warning-4"></div>
      <div class="legend-text">Red Warning</div>
    </div>
    <div class="weather-warning-legend">
      <div class="legend-color q-mr-xs warning-3"></div>
      <div class="legend-text">Orange Warning</div>
    </div>
    <div class="weather-warning-legend">
      <div class="legend-color q-mr-xs warning-2"></div>
      <div class="legend-text">Yellow Warning</div>
    </div>
    <div class="weather-warning-legend">
      <div class="legend-color q-mr-xs warning-1"></div>
      <div class="legend-text">Blue Warning</div>
    </div>
    <div class="weather-warning-legend">
      <div class="legend-color q-mr-xs warning-0"></div>
      <div class="legend-text">No Warnings</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'WeatherWarningLegend'
})
</script>

<style lang="scss" scoped>
@import "src/css/app.scss";

.weather-warning-legend {
  display: flex;
  align-items: center;
}

.legend-color {
  width: 15px;
  height: 15px;
  border: 1px solid #000;
}
</style>
