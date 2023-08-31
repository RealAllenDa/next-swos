<template>
  <q-toolbar class="q-pl-xl q-pr-xl row q-mb-lg q-mt-lg q-pb-sm" style="flex-wrap: wrap !important;">
    <q-btn-toggle
        v-model="selectedTime"
        :options="timeOptions">
    </q-btn-toggle>

    <q-separator
        spaced="lg"
        vertical></q-separator>

    <q-btn-toggle
        v-if="genericStore.debuggingEnabled"
        v-model="selectedResolution"
        :options="resolutionOptions">
    </q-btn-toggle>

    <q-separator
        v-if="genericStore.debuggingEnabled"
        spaced="lg"
        vertical></q-separator>

    <q-btn :disable="timeLabel === startTime || isInPlayback"
           color="primary"
           icon="skip_previous"
           outline
           type="a"
           @click="timeBackward">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Previous (Ctrl+←)
      </q-tooltip>
    </q-btn>
    <div ref="slider" class="q-ml-lg q-mr-lg col" style="min-width: 250px;"></div>
    <q-btn :disable="timeLabel === latestTime || isInPlayback"
           class="q-mr-sm"
           color="primary"
           icon="skip_next"
           outline
           type="a"
           @click="timeForward">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Next (Ctrl+→)
      </q-tooltip>
    </q-btn>
    <q-btn :disable="isInPlayback"
           class="q-mr-lg"
           color="primary"
           icon="update"
           @click="$emit('refresh')">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Refresh (Shift+Enter)
      </q-tooltip>
    </q-btn>
    <q-btn v-if="isInPlayback"
           class="q-mr-sm"
           color="primary"
           icon="stop"
           outline
           @click="endPlayback">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Stop (Ctrl+Enter)
      </q-tooltip>
    </q-btn>
    <q-btn v-else
           class="q-mr-sm"
           color="primary"
           icon="play_arrow"
           outline
           @click="startPlayback">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Play (Ctrl+Enter)
      </q-tooltip>
    </q-btn>
    <q-btn class="q-mr-lg"
           color="primary"
           icon="speed"
           outline>
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Animation Speed
      </q-tooltip>
      <q-menu auto-close>
        <q-list style="min-width: 200px;">
          <q-item v-for="i in playbackSpeedList" :key="i.id"
                  clickable style="align-items: center;"
                  @click="playbackSpeed = i.id">
            <q-icon v-if="playbackSpeed === i.id" class="q-mr-md" name="check"
                    size="24px"></q-icon>
            <q-item-section :class="i.id === playbackSpeed ? 'q-ml-sm' : 'q-ml-xl'">
              {{ Array(i.id + 1).join('■') }}
            </q-item-section>
            <q-item-section class="float-right" style="align-content: flex-end">{{ i.description }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
    <div>
      <q-btn :disable="!torrentialRainAvailable"
             :outline="!displayTorrentialRain"
             class="q-mr-sm"
             color="primary"
             icon="fa-solid fa-cloud-showers-heavy"
             @click="displayTorrentialRain = !displayTorrentialRain">
        <q-tooltip :offset="[0, 20]" anchor="top middle"
                   class="text-bold" self="center middle"
                   transition-duration="0">
          Localized Torrential Rain
        </q-tooltip>
      </q-btn>
      <q-btn :disable="!gpvAvailable"
             :outline="!displayGpv"
             class="q-mr-sm"
             color="primary"
             icon="fa-solid fa-table-cells"
             @click="displayGpv = !displayGpv">
        <q-tooltip :offset="[0, 20]" anchor="top middle"
                   class="text-bold" self="center middle"
                   transition-duration="0">
          GPV
        </q-tooltip>
      </q-btn>
      <q-btn-dropdown :disable="!rainMeasurementsAvailable"
                      :outline="!displayRainMeasurements"
                      class="q-mr-xl"
                      color="primary"
                      icon="fa-solid fa-droplet"
                      split
                      @click="displayRainMeasurements = !displayRainMeasurements">
        <template v-slot:label>
          <q-tooltip :offset="[0, 20]" anchor="top middle"
                     class="text-bold" self="center middle"
                     transition-duration="0">
            {{ precipitationStore.selectedDuration.replace('h', '') }}-hr. precipitation
          </q-tooltip>
        </template>
        <q-list>
          <q-item v-close-popup clickable @click="() => {changeRainMeasurements('3d')}">
            <q-item-section>
              <q-icon v-if="precipitationStore.rainMeasurementsDisplayOption === '3d'" class="q-mr-md"
                      name="check" size="24px"></q-icon>
            </q-item-section>
            <q-item-section>
              3D
            </q-item-section>
          </q-item>
          <q-item v-close-popup clickable @click="() => {changeRainMeasurements('text')}">
            <q-item-section>
              <q-icon v-if="precipitationStore.rainMeasurementsDisplayOption === 'text'" class="q-mr-md"
                      name="check" size="24px"></q-icon>
            </q-item-section>
            <q-item-section>
              Text
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>
  </q-toolbar>
</template>

<script lang="ts">
import {computed, defineComponent, onUnmounted, ref, Ref, shallowRef, watch} from 'vue';
import {usePrecipitationStore} from 'stores/precipitation';
import {setInterval} from 'timers';
import noUiSlider, {PipsMode} from 'nouislider';
import 'nouislider/dist/nouislider.min.css';
import {useGenericStore} from 'stores/generic';

export default defineComponent({
  emits: ['refresh'],
  setup(_, {emit}) {
    const slider = shallowRef();
    const genericStore = useGenericStore();
    const precipitationStore = usePrecipitationStore();

    // Resolution
    const resolutionOptions = computed(() => precipitationStore.resolutionOptions);
    const selectedResolution = computed({
      get() {
        return precipitationStore.selectedResolution
      },
      set(resolution: string) {
        precipitationStore.changeResolution(resolution);
      }
    });

    // Time
    const startTime = computed(() => precipitationStore.startTime);
    const step = computed(() => precipitationStore.step);
    const latestTime = computed(() => precipitationStore.endTime);
    const selectedTime = computed({
      get() {
        return precipitationStore.selectedDuration
      },
      set(duration: string) {
        precipitationStore.changeDuration(duration);
      }
    });
    const timeOptions = computed(() => precipitationStore.timeOptions);
    const timeLabel = computed({
      get() {
        return precipitationStore.currentTime
      },
      set(time: number) {
        precipitationStore.changeTime(time);
      }
    });

    function timeBackward() {
      if (timeLabel.value === startTime.value) {
        return;
      }
      precipitationStore.changeTime(precipitationStore.currentTime - precipitationStore.step);
    }

    function timeForward() {
      if (timeLabel.value === latestTime.value) {
        return;
      }
      precipitationStore.changeTime(precipitationStore.currentTime + precipitationStore.step);
    }

    function formatTime(time: number): string {
      const date = new Date(time * 1000);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
    }

    function formatTimeBack(time: string): number {
      return parseInt(time);
    }


    // Slider
    function initializeSlider(ignoreReinitialization = false) {
      if (sliderInitialized.value && !ignoreReinitialization) {
        throw new Error('re-initialization of slider');
      }
      if (!precipitationStore.initialized) {
        // This is expected behavior. When a user navigates to another page then re-navigates
        // back to this page, we dispose & reset the precipitation store.
        // So, there is a chance that it is called before initialization takes place.
        return
      }
      noUiSlider.create(slider.value, {
        start: latestTime.value,
        keyboardSupport: false,
        range: {
          min: startTime.value,
          max: latestTime.value
        },
        pips: {
          mode: PipsMode.Count,
          values: 7,
          density: 3,
          stepped: true,
          format: {
            to: formatTime,
            from: formatTimeBack
          }
        },
        tooltips: {
          to: formatTime,
          from: formatTimeBack
        },
        step: step.value,
        format: {
          to: (val) => {
            return val
          },
          from: formatTimeBack
        }
      })
      slider.value.noUiSlider.on('change', (values: number[]) => {
        timeLabel.value = values[0];
      })
      sliderInitialized.value = true;
    }

    const sliderInitialized = ref(false);
    watch(computed(() => {
      return precipitationStore.initialized
    }), initializeSlider)
    watch(timeLabel, () => {
      if (!sliderInitialized.value) {
        return
      }
      slider.value.noUiSlider.set(timeLabel.value);
    })
    watch(latestTime, () => {
      if (!sliderInitialized.value) {
        return;
      }
      slider.value.noUiSlider.updateOptions({
        start: latestTime.value,
        range: {
          min: startTime.value,
          max: latestTime.value
        },
        step: step.value
      }, false)
    })

    // Playback
    const playbackSpeed: Ref<number> = ref(3);
    const playbackSpeedList: Ref<PlaybackSpeed[]> = ref([
      {id: 5, description: 'Fast', speed: 100},
      {id: 4, description: '', speed: 300},
      {id: 3, description: '', speed: 500},
      {id: 2, description: '', speed: 700},
      {id: 1, description: 'Slow', speed: 900},
    ]);
    const selectedSpeed = computed(() => {
      const speed: PlaybackSpeed | undefined = playbackSpeedList.value.find(obj => {
        return obj.id === playbackSpeed.value
      });
      if (speed === undefined) {
        console.error('Shouldn\'t happen! Speed is undefined')
        return 0;
      }
      return speed.speed;
    });
    const isInPlayback = computed({
      get() {
        return precipitationStore.isInPlayback
      },
      set(is: boolean) {
        precipitationStore.isInPlayback = is;
      }
    });
    const playbackInterval: Ref<Nullable<ReturnType<typeof setInterval> | number>> = ref();

    function startPlayback() {
      if (playbackInterval.value && isInPlayback.value) {
        console.warn('Already in playback!');
      } else {
        playbackInterval.value = window.setInterval(() => {
          if (timeLabel.value === latestTime.value) {
            // Reached the end
            timeLabel.value = startTime.value;
          } else {
            timeForward();
          }
        }, selectedSpeed.value);
        isInPlayback.value = true;
      }
    }

    function endPlayback() {
      if (playbackInterval.value && isInPlayback.value) {
        window.clearInterval(playbackInterval.value);
        isInPlayback.value = false;
        playbackInterval.value = undefined;
      }
    }

    watch(selectedSpeed, () => {
      if (isInPlayback.value && playbackInterval.value) {
        // Speed changed in playback!
        endPlayback();
        startPlayback();
      }
    });

    watch(isInPlayback, () => {
      if (isInPlayback.value) {
        slider.value.noUiSlider.disable();
      } else {
        slider.value.noUiSlider.enable();
      }
    })

    onUnmounted(() => {
      endPlayback()
      sliderInitialized.value = false;
    })

    // Torrential Rain
    const displayTorrentialRain = computed({
      get() {
        return precipitationStore.displayTorrentialRain
      },
      set() {
        precipitationStore.displayTorrentialRain = !precipitationStore.displayTorrentialRain
      }
    });
    const torrentialRainAvailable = computed(() => precipitationStore.torrentialRainAvailable)

    // GPV
    const displayGpv = computed({
      get() {
        return precipitationStore.displayGpv
      },
      set() {
        precipitationStore.displayGpv = !precipitationStore.displayGpv
      }
    });
    const gpvAvailable = computed(() => precipitationStore.gpvAvailable)

    // Rain Measurements
    function changeRainMeasurements(target: string) {
      precipitationStore.rainMeasurementsDisplayOption = target
    }

    const displayRainMeasurements = computed({
      get() {
        return precipitationStore.displayRainMeasurements
      },
      set() {
        precipitationStore.displayRainMeasurements = !precipitationStore.displayRainMeasurements
      }
    });
    const rainMeasurementsAvailable = computed(() => precipitationStore.rainMeasurementsAvailable)

    return {
      // Store
      precipitationStore,
      genericStore,

      // Slider
      slider,

      // Resolution
      resolutionOptions,
      selectedResolution,

      // Time
      startTime,
      step,
      latestTime,
      selectedTime,
      timeOptions,
      timeLabel,
      timeBackward,
      timeForward,

      // Playback
      playbackSpeed,
      playbackSpeedList,
      isInPlayback,
      startPlayback,
      endPlayback,

      // Torrential Rain
      displayTorrentialRain,
      torrentialRainAvailable,

      // GPV
      displayGpv,
      gpvAvailable,

      // Rain Measurements
      changeRainMeasurements,
      displayRainMeasurements,
      rainMeasurementsAvailable
    };
  }
});
</script>

<!--suppress CssUnusedSymbol -->
<style>
.noUi-horizontal .noUi-handle {
  border-radius: 12px;
  box-shadow: 0 3px 1px -2px rgba(0, 0, 0, .2), 0 2px 2px 0 rgba(0, 0, 0, .14), 0 1px 5px 0 rgba(0, 0, 0, .12);
  height: 24px;
  width: 24px;
  top: -5px;
  right: -12px;
}

.noUi-handle:before, .noUi-handle:after {
  background: none;
}

.noUi-tooltip {
  padding: 0 4px 0 4px;
}
</style>
