<template>
  <slot>
    <q-inner-loading
      :showing="show"
      label="Loading..."
      label-style="font-size: 1.1em"
      style="z-index: 999">
    </q-inner-loading>
  </slot>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PageLoading',
  props: {
    show: {
      type: Boolean,
      required: true
    }
  }
})
</script>
