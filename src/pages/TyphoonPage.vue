<template>
  <q-page class="fullscreen-map-page column items-stretch no-wrap">
    <q-toolbar
      :class="{ 'dashboard-title-toolbar--compact': !genericStore.showHeader }"
      class="dashboard-title-toolbar"
    >
      <div>
        <div class="text-h6">台风</div>
        <div class="text-caption text-grey-7">Typhoon Tracking</div>
      </div>
    </q-toolbar>
    <TyphoonMapSettings />
    <TyphoonMap style="flex: 1" />
    <PageLoading :show="loading" />
    <q-inner-loading
      :showing="!loading && selectedTyphoons.length === 0"
      style="z-index: 999; font-size: 2.5em; user-select: none"
      label="当前没有活动台风。"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import TyphoonMap from 'components/TyphoonMap.vue';
import TyphoonMapSettings from 'components/TyphoonMapSettings.vue';
import PageLoading from 'components/PageLoading.vue';
import sdk from 'src/composables/sdk';
import { useProductionPollingFetch } from 'src/composables/use-polling-fetch';
import { useTyphoonStore } from 'stores/typhoon';
import { useGenericStore } from 'stores/generic';

const store = useTyphoonStore();
store.$reset();
const genericStore = useGenericStore();
genericStore.initPageSpec(false, true, false);

const selectedTyphoons = computed(() => store.selectedTyphoonsInList);
const detailsLoading = ref(false);
const { data: typhoonList, loading: listLoading } = useProductionPollingFetch<
  TyphoonList[]
>('/warning/typhoon_activity');
const loading = computed(() => listLoading.value || detailsLoading.value);
let detailController: AbortController | undefined;
let requestVersion = 0;

watch(typhoonList, (list) => {
  if (list) store.setList(list);
});

watch(
  selectedTyphoons,
  async (list) => {
    detailController?.abort();
    detailController = new AbortController();
    const version = ++requestVersion;
    if (list.length === 0) {
      store.currentTyphoons = {};
      detailsLoading.value = false;
      return;
    }

    detailsLoading.value = true;
    try {
      const entries = await Promise.all(
        list.map(async (typhoon) => {
          const details = await sdk.fetchProductionJson<TyphoonDetail[]>(
            `/warning/typhoon_detail?id=${encodeURIComponent(
              typhoon.tfid
            )}&_=${Date.now()}`,
            detailController?.signal
          );
          if (!details[0]) throw new Error(`台风 ${typhoon.tfid} 缺少详情`);
          return [typhoon.tfid, details[0]] as const;
        })
      );
      if (version === requestVersion)
        store.currentTyphoons = Object.fromEntries(entries);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      sdk.showNotification(
        'negative',
        cause instanceof Error ? cause.message : String(cause)
      );
    } finally {
      if (version === requestVersion) detailsLoading.value = false;
    }
  },
  { deep: true }
);

onBeforeUnmount(() => detailController?.abort());
</script>

<style lang="scss">
.text-td,
.text-ts,
.text-sts {
  color: #000;
}
.text-ty,
.text-sty,
.text-super-ty {
  color: #fff;
}
.bg-td {
  background: #00d5cb;
}
.bg-ts {
  background: #fcfa00;
}
.bg-sts {
  background: #fdae0d;
}
.bg-ty {
  background: #fb3b00;
}
.bg-sty {
  background: #fc4d80;
}
.bg-super-ty {
  background: #c2218e;
}
</style>
