<template>
  <q-page class="column items-stretch">
    <TyphoonMapSettings></TyphoonMapSettings>
    <TyphoonMap ref="typhoonMap" style="flex: 1"></TyphoonMap>
    <PageLoading :show="!initialized"></PageLoading>
  </q-page>
</template>

<script lang="ts">
import {computed, defineComponent, onUnmounted, ref, Ref, watch} from 'vue';
import TyphoonMap from 'src/components/TyphoonMap.vue';
import TyphoonMapSettings from 'src/components/TyphoonMapSettings.vue';
import sdk from 'src/composables/sdk';
import {useTyphoonStore} from 'stores/typhoon';
import PageLoading from 'components/PageLoading.vue';
import {useGenericStore} from 'stores/generic';

export default defineComponent({
  name: 'TyphoonPage',
  components: {PageLoading, TyphoonMapSettings, TyphoonMap},
  setup() {
    const initialized: Ref<boolean> = ref(false);
    const typhoonStore = useTyphoonStore()
    const selectedTyphoonsInList = computed(() => typhoonStore.selectedTyphoonsInList)

    typhoonStore.clearLists();

    function initTyphoonList() {
      initialized.value = false;
      const typhoons = {} as { [id: string]: TyphoonDetail };
      if (selectedTyphoonsInList.value.length === 0) {
        typhoonStore.currentTyphoons = {};
        initialized.value = true;
      }
      selectedTyphoonsInList.value.forEach(typhoon => {
        const {data} = sdk.useFetch<TyphoonDetail[]>(`https://api.daziannetwork.com/warning/typhoon_detail?id=${typhoon.tfid}&_=${new Date().getTime()}`, true);
        watch(data, () => {
          if (data.value === null || data.value === undefined) {
            sdk.showNotification('negative', 'Failed to fetch typhoon detail')
            return
          }
          typhoons[typhoon.tfid] = data.value[0];
          if (Object.keys(typhoons).length === selectedTyphoonsInList.value.length) {
            typhoonStore.currentTyphoons = typhoons;

            initialized.value = true;
          }
        })
      });
    }

    const {data: typhoonList} = sdk.useFetch<TyphoonList[]>(`https://api.daziannetwork.com/warning/typhoon_activity?_=${new Date().getTime()}`, true);
    watch(typhoonList, () => {
      if (typhoonList.value === null || typhoonList.value === undefined) {
        sdk.showNotification('negative', 'Failed to refresh: list is null or undefined.')
      } else {
        typhoonStore.setList(typhoonList.value);
        initTyphoonList();
      }
    });

    watch(selectedTyphoonsInList, () => {
      initTyphoonList();
    });

    useGenericStore().initPageSpec(false, false, false)
    onUnmounted(() => {
      typhoonStore.$dispose()
    })

    return {
      initialized
    }
  }
});
</script>

<style lang="scss">
.text-td {
  color: #000;
}

.bg-td {
  background: #00D5CB;
}

.text-ts {
  color: #000;
}

.bg-ts {
  background: #FCFA00;
}

.text-sts {
  color: #000;
}

.bg-sts {
  background: #FDAE0D;
}

.text-ty {
  color: #FFFFFF;
}

.bg-ty {
  background: #FB3B00;
}

.text-sty {
  color: #FFFFFF;
}

.bg-sty {
  background: #FC4D80;
}

.text-super-ty {
  color: #FFFFFF;
}

.bg-super-ty {
  background: #C2218E;
}
</style>
