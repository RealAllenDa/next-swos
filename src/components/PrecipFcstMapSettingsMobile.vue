<template>
  <q-toolbar class="q-mt-sm row" style="flex-wrap: wrap !important;">

    <q-btn v-if="isInPlayback"
           class="q-mr-sm"
           color="primary"
           icon="stop"
           outline
           padding="sm"
           @click="endPlayback">
    </q-btn>
    <q-btn v-else
           class="q-mr-sm"
           color="primary"
           icon="play_arrow"
           outline
           padding="sm"
           @click="startPlayback">
    </q-btn>
    <q-btn :disable="timeLabel === startTime || isInPlayback"
           color="primary"
           icon="skip_previous"
           outline
           padding="sm"
           @click="timeBackward">
    </q-btn>
    <q-slider
      :disable="isInPlayback"
      :label-value="formatTime(hoverTime)"
      :max="latestTime"
      :min="startTime"
      :model-value="timeLabel"
      :step="step"
      class="q-ml-md q-mr-md col"
      label
      markers
      snap
      style="min-width: 150px;"
      @change="val => {timeLabel = val; hoverTime = val}"
      @update:model-value="val => {hoverTime = val}"
    ></q-slider>
    <q-btn :disable="timeLabel === latestTime || isInPlayback"
           class="q-mr-sm"
           color="primary"
           icon="skip_next"
           outline
           padding="sm"
           @click="timeForward">
    </q-btn>
    <q-btn :disable="isInPlayback"
           class="q-mr-sm"
           color="primary"
           icon="update"
           padding="sm"
           round
           @click="$emit('refresh')">
    </q-btn>
    <q-btn-toggle
      v-model="selectedTime"
      :options="timeOptions">
    </q-btn-toggle>

    <q-btn-toggle
      v-if="genericStore.debuggingEnabled"
      v-model="selectedResolution"
      :options="resolutionOptions"
      class="q-ml-md">
    </q-btn-toggle>

    <q-btn class="q-mr-md q-ml-md"
           color="primary"
           icon="speed"
           outline
           padding="sm">
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
    <q-btn :disable="!torrentialRainAvailable"
           :outline="!displayTorrentialRain"
           class="q-mr-sm"
           color="primary"
           icon="fa-solid fa-cloud-showers-heavy"
           padding="sm"
           @click="displayTorrentialRain = !displayTorrentialRain">
    </q-btn>
    <q-btn :disable="!gpvAvailable"
           :outline="!displayGpv"
           class="q-mr-sm"
           color="primary"
           icon="fa-solid fa-table-cells"
           padding="sm"
           @click="displayGpv = !displayGpv">
    </q-btn>
    <q-btn-dropdown :disable="!rainMeasurementsAvailable"
                    :outline="!displayRainMeasurements"
                    class="q-mr-xl"
                    color="primary"
                    icon="fa-solid fa-droplet"
                    padding="sm"
                    split
                    @click="displayRainMeasurements = !displayRainMeasurements">
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
  </q-toolbar>
</template>

<script lang="ts">
import {computed, defineComponent, onBeforeUnmount, onMounted, onUnmounted, ref, Ref, watch} from 'vue';
import {usePrecipitationStore} from 'stores/precipitation';
import {setInterval} from 'timers';
import {useGenericStore} from 'stores/generic';

export default defineComponent({
  emits: ['refresh'],
  setup(_, {emit}) {
    const genericStore = useGenericStore();
    const precipitationStore = usePrecipitationStore();

    // Register Hotkeys
    function hotKeyHandler(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        timeBackward()
      } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault()
        timeForward()
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (isInPlayback.value) {
          endPlayback()
        } else {
          startPlayback()
        }
      } else if (e.shiftKey && e.key === 'Enter') {
        emit('refresh')
      }
    }

    onMounted(() => {
      document.addEventListener('keydown', hotKeyHandler);
    })
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', hotKeyHandler);
    })

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
    const hoverTime = ref(precipitationStore.currentTime);
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

    function labelTime(time: number): string {
      if ((latestTime.value - time) % 3600 === 0) {
        const date = new Date(time * 1000);
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
      } else {
        return ' ';
      }
    }

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

    onUnmounted(() => {
      endPlayback()
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
      genericStore,
      precipitationStore,

      // Resolution
      resolutionOptions,
      selectedResolution,

      // Time
      hoverTime,
      startTime,
      step,
      latestTime,
      selectedTime,
      timeOptions,
      timeLabel,
      timeBackward,
      timeForward,
      formatTime,

      // Label
      labelTime,

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
