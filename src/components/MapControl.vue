<template>
  <div ref="root"
       class="non-selectable">
    <slot></slot>
  </div>
</template>

<script lang="ts">
import {defineComponent, ref} from 'vue';
import {Control, ControlPosition, DomEvent, Map} from 'leaflet';
import sdk from 'src/composables/sdk';

export default defineComponent({
  name: 'MapLegends',
  props: {
    position: {
      type: String,
      required: true
    },
    disableClickPropagation: {
      type: Boolean,
      default: true
    },
    disableScrollPropagation: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null);
    const LControl = Control.extend({
      element: undefined as HTMLElement | undefined,
      onAdd() {
        return this.element;
      },
      setElement(el: HTMLElement) {
        this.element = el;
      }
    });

    function addToMap(map: Map) {
      if (root.value === null) {
        sdk.showNotification('negative', 'Shouldn\'t happen! root is null');
        return
      }
      const controlObject = new LControl({
        position: props.position as ControlPosition
      })
      controlObject.setElement(root.value);
      if (props.disableClickPropagation) {
        DomEvent.disableClickPropagation(root.value);
      }
      if (props.disableScrollPropagation) {
        DomEvent.disableScrollPropagation(root.value);
      }
      controlObject.addTo(map);
    }

    return {
      root,
      addToMap
    }
  }
})
</script>
