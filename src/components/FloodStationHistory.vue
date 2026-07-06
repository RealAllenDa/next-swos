<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="history-card">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ station }} 水位历史</div>
        <q-space />
        <q-btn v-close-popup flat round dense icon="close" aria-label="关闭" />
      </q-card-section>
      <q-card-section class="row q-col-gutter-md">
        <q-input
          v-model="startDate"
          type="date"
          label="开始日期"
          outlined
          dense
        />
        <q-input
          v-model="endDate"
          type="date"
          label="结束日期"
          outlined
          dense
        />
        <q-btn
          color="primary"
          label="查询"
          :loading="loading"
          @click="loadHistory"
        />
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div v-if="error" class="text-negative">{{ error }}</div>
        <div v-else-if="!loading && points.length === 0" class="text-grey-7">
          该时段没有数据。
        </div>
        <svg
          v-else
          class="history-chart"
          viewBox="0 0 700 260"
          role="img"
          :aria-label="`${station} 水位变化图`"
        >
          <line x1="48" y1="15" x2="48" y2="225" stroke="#9ca3af" />
          <line x1="48" y1="225" x2="680" y2="225" stroke="#9ca3af" />
          <polyline
            :points="chartPoints"
            fill="none"
            stroke="#1976d2"
            stroke-width="3"
          />
          <text x="8" y="24" font-size="12">{{ maximum.toFixed(2) }}m</text>
          <text x="8" y="225" font-size="12">{{ minimum.toFixed(2) }}m</text>
          <text x="48" y="250" font-size="12">{{ firstTime }}</text>
          <text x="680" y="250" text-anchor="end" font-size="12">
            {{ lastTime }}
          </text>
        </svg>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { format, subDays } from 'date-fns';
import sdk from 'src/composables/sdk';

interface HistoryPoint {
  time: string;
  level: number;
}

const props = defineProps<{
  modelValue: boolean;
  station: string;
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const startDate = ref(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));
const points = ref<HistoryPoint[]>([]);
const loading = ref(false);
const error = ref('');

const minimum = computed(() =>
  points.value.length
    ? Math.min(...points.value.map((point) => point.level))
    : 0
);
const maximum = computed(() =>
  points.value.length
    ? Math.max(...points.value.map((point) => point.level))
    : 0
);
const firstTime = computed(() => points.value[0]?.time ?? '');
const lastTime = computed(
  () => points.value[points.value.length - 1]?.time ?? ''
);
const chartPoints = computed(() => {
  const range = maximum.value - minimum.value || 1;
  return points.value
    .map((point, index) => {
      const x = 48 + (index / Math.max(points.value.length - 1, 1)) * 632;
      const y = 225 - ((point.level - minimum.value) / range) * 210;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});

async function loadHistory() {
  if (!props.station) return;
  if (startDate.value > endDate.value) {
    error.value = '开始日期不能晚于结束日期。';
    points.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const query = new URLSearchParams({
      start_time: startDate.value,
      end_time: endDate.value,
      is_station: 'true',
    });
    const response = await sdk.fetchProductionJson<
      Record<string, Record<string, FloodStation>>
    >(`/warning/previous_flood_state?${query.toString()}`);
    points.value = Object.entries(response)
      .map(([time, stations]) => ({
        time,
        level: Number(stations[props.station]?.current_level),
      }))
      .filter((point) => Number.isFinite(point.level));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
    points.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.modelValue, props.station],
  ([open]) => {
    if (open) void loadHistory();
  }
);
</script>

<style scoped>
.history-card {
  width: min(760px, 95vw);
  max-width: 95vw;
}

.history-chart {
  width: 100%;
  min-height: 260px;
}
</style>
