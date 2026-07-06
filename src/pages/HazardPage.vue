<template>
  <HazardOverview :config="config" />
</template>

<script setup lang="ts">
import HazardOverview from 'components/HazardOverview.vue';

defineProps<{
  config: HazardConfig;
}>();
</script>
