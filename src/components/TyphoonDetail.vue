<template>
  <div style="max-width: 460px;">
    <q-card>
      <q-tabs
        :model-value="currentTyphoonName"
        active-color="primary"
        align="justify"
        class="text-grey"
        dense
        indicator-color="primary"
        narrow-indicator
        @update:model-value="updateDetailTyphoon"
      >
        <q-tab v-for="i in typhoonToFocus" :key="i.value"
               :label="i.label" :name="i.value"/>
      </q-tabs>

      <q-separator/>

      <q-tab-panels v-model="currentTyphoonName" animated>
        <q-tab-panel v-for="i in typhoonToFocus" :key="i.value" :name="i.value">
          <q-table
            v-model:pagination="pagination"
            :columns="detailColumns"
            :rows="typhoonDetails"
            :rows-per-page-options="[0]"
            :virtual-scroll-sticky-size-start="48"
            bordered
            class="typhoon-detail-table"
            dense
            flat
            row-key="date"
            virtual-scroll
          >
            <template v-slot:body="props">
              <q-tr
                :class="
                  props.row.index === currentTyphoonFocusIndex ?
                  `bg-${getFillBrand(props.row.category)} text-${getFillBrand(props.row.category)}` : ''
                "
                :props="props"
                class="cursor-pointer"
                @click="() => changeTyphoonFocus(props.row)">
                <q-td
                  v-for="col in props.cols"
                  :key="col.name"
                  :props="props"
                >
                  <template v-if="col.name === 'category'">
                    <q-badge
                      :color="getFillBrand(col.value)"
                      :label="col.value"
                      :text-color="getFillBrand(col.value)"/>
                  </template>
                  <template v-else>
                    {{ col.value }}
                  </template>
                </q-td>
              </q-tr>
            </template>
            <template v-slot:header="props">
              <q-tr :props="props">
                <q-th
                  v-for="col in props.cols"
                  :key="col.name"
                  :props="props"
                >
                  {{ col.label }}<br>
                  <span v-if="col.name === 'pressure'" class="text-italic float-right">hPa</span>
                  <span v-else-if="col.name === 'speed'" class="text-italic float-right">m/s</span>
                  <span v-else-if="col.name === 'move_speed'" class="text-italic float-right">km/h</span>
                </q-th>
              </q-tr>
            </template>
          </q-table>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

  </div>
</template>

<script lang="ts">
import {computed, defineComponent, ref} from 'vue';
import {useTyphoonStore} from 'stores/typhoon';
import {format, parse} from 'date-fns';

export default defineComponent({
  name: 'TyphoonSelection',
  setup() {
    const typhoonStore = useTyphoonStore();
    const typhoonToFocus = computed(() => typhoonStore.typhoonsToFocus);
    const currentTyphoonName = computed(() => typhoonStore.currentTyphoonFocus);
    const detailColumns = computed(() => typhoonStore.detailColumns);
    const currentTyphoonFocusIndex = computed(() => typhoonStore.currentTyphoonIndex);

    const typhoonDetails = computed(() => {
      if (!Object.keys(typhoonStore.currentTyphoons).includes(currentTyphoonName.value)) {
        return;
      }
      const currentTyphoon = typhoonStore.currentTyphoons[currentTyphoonName.value];
      console.log(currentTyphoon)
      let content: TyphoonDetailTable[] = [];
      const reversedPoints = [...currentTyphoon.points].reverse();
      reversedPoints.forEach((point, index) => {
        // Time: yyyy/M/d H:mm:ss => MM/dd HH:mm
        const date = parse(point.forecast_time, 'yyyy/M/d H:mm:ss', new Date());
        content.push({
          date: format(date, 'MM/dd HH:mm'),
          pressure: point.pressure.toString(),
          speed: point.speed.toString(),
          move_speed: point.move_speed === 0 ? 'Slow' : point.move_speed.toString(),
          category: point.strength,
          index: index
        })
      })
      console.log(content)
      return content;
    });
    const getFillBrand = typhoonStore.getFillBrand;

    function updateDetailTyphoon(id: string) {
      typhoonStore.currentTyphoonFocus = id
    }

    function changeTyphoonFocus(row: TyphoonDetailTable) {
      typhoonStore.currentTyphoonIndex = row.index
    }

    return {
      typhoonToFocus,
      currentTyphoonName,
      detailColumns,
      typhoonDetails,
      currentTyphoonFocusIndex,

      updateDetailTyphoon,
      changeTyphoonFocus,
      getFillBrand,

      pagination: ref({
        rowsPerPage: 0
      })
    }
  }
})
</script>

<style lang="scss">
.typhoon-detail-table {
  height: 410px;

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th {
    /* bg color is important for th; just specify one */
    background-color: #fff;
  }

  thead tr th {
    position: sticky;
    z-index: 1;
  }

  /* this will be the loading indicator */
  thead tr:last-child th {
    /* height of all previous header rows */
    top: 48px;
  }

  thead tr:first-child th {
    top: 0;
  }
}
</style>
