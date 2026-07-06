<template>
  <div ref="root" class="non-selectable maplibregl-ctrl">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { Map } from 'maplibre-gl';

export default defineComponent({
  name: 'MLMapControl',
  setup() {
    const root = ref<HTMLElement>();

    class MapLegend {
      private _map: Map | undefined;
      private _container: HTMLElement | undefined;

      onAdd(map: Map) {
        this._map = map;
        this._container = root.value;
        if (!this._container)
          throw new Error('Map control container is not mounted');
        return this._container;
      }

      onRemove() {
        this._container?.parentNode?.removeChild(this._container);
        this._map = undefined;
      }
    }

    return {
      MapLegend,
      root,
    };
  },
});
</script>
