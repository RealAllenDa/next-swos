<template>
  <div ref="root"
       class="non-selectable maplibregl-ctrl">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref} from 'vue';
import {Map} from 'maplibre-gl';

export default defineComponent({
  name: 'MapLegends',
  setup() {
    const root = ref<HTMLElement>();

    class MapLegend {
      private _map: Map | undefined;
      private _container: HTMLElement | undefined;

      onAdd(map: Map) {
        this._map = map;
        this._container = root.value;
        return this._container;
      }

      onRemove() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this._container!.parentNode!.removeChild(this._container!);
        this._map = undefined;
      }
    }

    return {
      MapLegend,
      root
    }
  }
})
</script>
