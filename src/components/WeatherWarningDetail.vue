<!--suppress JSUnresolvedVariable -->
<template>
  <div>
    <div v-if="currentSelectedDistrict !== ''">
      {{ currentSelectedDistrict }}:
    </div>
    <div v-else>Select a district on map.</div>
    <template v-if="districtWarnings !== undefined">
      <div v-for="(i, index) in districtWarnings" :key="index"
           :class="`warning-${i.level}`" class="warning-wrapper text-center q-pa-xs q-mt-xs"
           @click="() => showWarningInfo(i)">
        {{ i.type }}{{ parseLevel(i.level) }}预警
      </div>
    </template>
    <template v-else-if="currentSelectedDistrict !== ''">
      <div class="warning-0 warning-wrapper q-pa-xs q-mt-xs text-center">
        无预警
      </div>
    </template>
    <q-dialog v-model="showDetails" persistent position="standard" style="z-index: 999">
      <q-card>
        <q-card-section :class="`warning-${details.level}`">
          <div class="text-h5">{{ details.type }}{{ parseLevel(details.level) }}预警</div>
          <div class="text-subtitle1">{{ details.name }} 发表于 {{ details.time }}</div>
        </q-card-section>

        <q-separator/>

        <q-card-section>
          {{ details.detail }}
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat @click="showDetails = false;">OK</q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, ref, Ref} from 'vue';
import {useWeatherWarningStore} from 'stores/weather-warning';

export default defineComponent({
  name: 'WeatherWarningDetail',
  setup() {
    const weatherWarningStore = useWeatherWarningStore();
    const currentSelectedDistrict = computed(() => weatherWarningStore.currentSelectedDistrict);
    const districtWarnings = computed(() => {
      return weatherWarningStore.currentWarningList.districts[currentSelectedDistrict.value]
    });
    const parseLevel = weatherWarningStore.parseLevel;

    const showDetails: Ref<boolean> = ref(false);
    const details: Ref<WeatherWarning | null> = ref(null);

    function showWarningInfo(warning: WeatherWarning) {
      showDetails.value = true;
      details.value = warning;
    }

    return {
      currentSelectedDistrict,
      districtWarnings,
      parseLevel,

      showWarningInfo,
      details,
      showDetails
    }
  }
})
</script>

<style lang="scss">
@import "src/css/app.scss";

.warning-wrapper {
  border: 1px solid black;
  cursor: pointer;
}

.warning-4 {
  background: $red-warning;
  color: white;
}

.warning-2 {
  background: $yellow-warning;
  color: black;
}

.warning-3 {
  background: $orange-warning;
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
