<template>
  <q-toolbar class="q-mb-md q-mt-md">
    <q-space></q-space>
    <q-select
      v-model="selectedTyphoonId"
      :options="typhoonNames"
      emit-value
      label="Selected Typhoons"
      multiple
      outlined
      stack-label
      style="min-width: 200px;"
      use-chips></q-select>
    <q-btn
      class="q-ml-lg q-mr-lg"
      color="primary" icon="fa-solid fa-gear" @click="showSetting = true"/>
    <q-dialog v-model="showSetting" persistent>
      <q-card>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Settings</div>
          <q-space/>
          <q-btn v-close-popup dense flat icon="close" round/>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-toggle
            v-model="showInactiveTyphoons"
            label="Show inactive typhoons"
          ></q-toggle>
          <q-select
            v-model="showTyphoonForecastOrigins"
            :options="typhoonOrigins"
            emit-value
            label="Forecast Origin"
            multiple
            outlined
            stack-label
            style="min-width: 200px;"
            use-chips
          ></q-select>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-space></q-space>
  </q-toolbar>
</template>

<script lang="ts">
import {computed, defineComponent, ref} from 'vue';
import {useTyphoonStore} from 'stores/typhoon';

export default defineComponent({
  name: 'TyphoonMapSettings',
  setup() {
    const typhoonStore = useTyphoonStore()
    const typhoonNames = computed(() => typhoonStore.typhoonDisplayList);
    const typhoonOrigins = computed(() => typhoonStore.typhoonOrigins);

    const showInactiveTyphoons = computed({
      get() {
        return typhoonStore.showInactiveTyphoons
      },
      set(enabled: boolean) {
        typhoonStore.showInactiveTyphoons = enabled
        typhoonStore.updateList()
      }
    })
    const showTyphoonForecastOrigins = computed({
      get() {
        return typhoonStore.showTyphoonForecastOrigins
      },
      set(origins: string[]) {
        typhoonStore.showTyphoonForecastOrigins = origins
      }
    })

    const selectedTyphoonId = computed({
      get() {
        const typhoonSelectedNames: string[] = [];
        typhoonStore.selectedTyphoonsInList.forEach((ty) => {
          typhoonSelectedNames.push(typhoonStore.getTyphoonId(ty));
        })
        return typhoonSelectedNames;
      },
      set(value: string[]) {
        typhoonStore.updateSelectedTyphoon(value);
      }
    })

    return {
      selectedTyphoonId,
      typhoonNames,
      typhoonOrigins,

      showInactiveTyphoons,
      showTyphoonForecastOrigins,

      showSetting: ref(false)
    }
  }
})
</script>
