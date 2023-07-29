<template>
  <q-toolbar class="q-mt-lg q-pt-md q-pl-xl q-pr-xl">
    <q-btn-toggle
      v-model="selectedTime"
      :options="timeOptions"
      class="q-ml-xl">
    </q-btn-toggle>

    <q-separator
      spaced="lg"
      vertical></q-separator>

    <q-btn-toggle
      v-model="selectedResolution"
      :options="resolutionOptions">
    </q-btn-toggle>

    <q-separator
      spaced="lg"
      vertical></q-separator>

    <q-btn :disable="timeLabel === startTime || isInPlayback"
           color="primary"
           icon="skip_previous"
           outline
           @click="timeBackward">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        Previous (Ctrl+←)
      </q-tooltip>
    </q-btn>
    <q-slider
      v-model="timeLabel"
      :disable="isInPlayback"
      :label-value="formatTime(timeLabel)"
      :marker-labels="val => ({label: labelTime(val)})"
      :max="latestTime"
      :min="startTime"
      :step="step"
      class="q-ml-xl q-mr-xl"
      label
      label-always
      markers
      snap
    ></q-slider>
    <q-btn :disable="timeLabel === latestTime || isInPlayback"
           class="q-mr-sm"
           color="primary"
           icon="skip_next"
           outline
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
    <q-btn :disable="!rainMeasurementsAvailable"
           :outline="!displayRainMeasurements"
           class="q-mr-xl"
           color="primary"
           icon="fa-solid fa-droplet"
           @click="displayRainMeasurements = !displayRainMeasurements">
      <q-tooltip :offset="[0, 20]" anchor="top middle"
                 class="text-bold" self="center middle"
                 transition-duration="0">
        1-hr. precipitation
      </q-tooltip>
    </q-btn>
  </q-toolbar>
</template>

<script lang="ts">
import {computed, defineComponent, onBeforeUnmount, onMounted, onUnmounted, ref, Ref, watch} from 'vue';
import {usePrecipitationStore} from 'stores/precipitation';
import {setInterval} from 'timers';

export default defineComponent({
  emits: ['refresh'],
  setup(_, {emit}) {
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
    const isInPlayback: Ref<boolean> = ref(false);
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
      displayRainMeasurements,
      rainMeasurementsAvailable
    };
  }
});
</script>
