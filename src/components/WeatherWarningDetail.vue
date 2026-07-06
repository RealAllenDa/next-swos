<template>
  <div>
    <div v-if="currentSelectedDistrict" class="text-h6">
      {{ currentSelectedDistrict }}
    </div>
    <div v-else>请在地图上选择一个区。</div>
    <template v-if="districtWarnings?.length">
      <div
        v-for="(warning, index) in districtWarnings"
        :key="index"
        :class="`warning-${warning.level}`"
        class="warning-wrapper text-center q-pa-xs q-mt-xs"
        @click="showWarningInfo(warning)"
      >
        {{ warning.type }}{{ parseLevel(warning.level) }}预警
      </div>
    </template>
    <div
      v-else-if="currentSelectedDistrict"
      class="warning-0 warning-wrapper q-pa-xs q-mt-xs text-center"
    >
      无预警
    </div>

    <q-dialog v-model="showDetails">
      <q-card v-if="details">
        <q-card-section :class="`warning-${details.level}`">
          <div class="text-h5">
            {{ details.type }}{{ parseLevel(details.level) }}预警
          </div>
          <div class="text-subtitle1">
            {{ details.name }} 发布于 {{ details.time }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section>{{ details.detail }}</q-card-section>
        <q-card-actions align="right"
          ><q-btn v-close-popup flat label="确定"
        /></q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWeatherWarningStore } from 'stores/weather-warning';

const store = useWeatherWarningStore();
const currentSelectedDistrict = computed(() => store.currentSelectedDistrict);
const districtWarnings = computed(
  () => store.currentWarningList.districts?.[currentSelectedDistrict.value]
);
const showDetails = ref(false);
const details = ref<WeatherWarning | null>(null);
const parseLevel = store.parseLevel;
function showWarningInfo(warning: WeatherWarning) {
  details.value = warning;
  showDetails.value = true;
}
</script>

<style lang="scss">
@import 'src/css/app.scss';
.warning-wrapper {
  border: 1px solid black;
  cursor: pointer;
}
.warning-4 {
  background: $red-warning;
  color: white;
}
.warning-3 {
  background: $orange-warning;
  color: black;
}
.warning-2 {
  background: $yellow-warning;
  color: black;
}
.warning-1 {
  background: $blue-warning;
  color: white;
}
.warning-0 {
  background: $no-warning;
  cursor: default;
}
</style>
