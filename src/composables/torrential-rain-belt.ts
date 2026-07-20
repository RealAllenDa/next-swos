import {computed, type MaybeRefOrGetter, onBeforeUnmount, ref, toValue, watch,} from 'vue';
import type {FeatureCollection} from 'geojson';
import {area, convertArea} from '@turf/turf';
import sdk from 'src/composables/sdk';
import {usePollingFetch} from 'src/composables/use-polling-fetch';

const TORRENTIAL_RAIN_BELT_MIN_AREA_KM2 = 500;
const EMPTY_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export const TORRENTIAL_RAIN_BELT_NONE_LABEL = '无';
export const TORRENTIAL_RAIN_BELT_WARNING_TEXT =
  '线状降雨带已生成！请关注短时强降水和积涝风险。';

export function qualifiedTorrentialRainBeltCollection(
  collection: FeatureCollection | null | undefined
): FeatureCollection {
  if (!collection) return EMPTY_COLLECTION;
  return {
    type: 'FeatureCollection',
    features: collection.features.filter(
      (feature) =>
        convertArea(area(feature), 'meters', 'kilometers') >=
        TORRENTIAL_RAIN_BELT_MIN_AREA_KM2
    ),
  };
}

export function latestPrecipitationAnalysisTime(
  list: PrecipitationAnalysisList | null | undefined
): number | undefined {
  const records: PrecipitationAnalysisFile[] = list
    ? Object.values(list).flat()
    : [];
  return records
    .sort((a, b) => a.time - b.time)
    .at(-1)?.time;
}

export function useTorrentialRainBelt(
  time: MaybeRefOrGetter<number | null | undefined>,
  enabled: MaybeRefOrGetter<boolean> = true
) {
  const collection = ref<FeatureCollection>(EMPTY_COLLECTION);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const requestTime = computed(() => toValue(time));
  const requestEnabled = computed(() => toValue(enabled));
  let controller: AbortController | undefined;
  let requestVersion = 0;

  watch(
    [requestTime, requestEnabled],
    async ([currentTime, isEnabled]) => {
      controller?.abort();
      requestVersion += 1;
      error.value = null;
      if (!isEnabled || currentTime === undefined || currentTime === null) {
        collection.value = EMPTY_COLLECTION;
        loading.value = false;
        return;
      }

      const version = requestVersion;
      controller = new AbortController();
      loading.value = true;
      try {
        const response = await sdk.fetchJson<FeatureCollection>(
          `${sdk.cdnUrl}/analysis/rain/tor_zone_3h_5km_${currentTime}.geojson`,
          true,
          controller.signal
        );
        if (version !== requestVersion) return;
        collection.value = qualifiedTorrentialRainBeltCollection(response);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        if (version !== requestVersion) return;
        error.value = cause instanceof Error ? cause : new Error(String(cause));
        collection.value = EMPTY_COLLECTION;
      } finally {
        if (version === requestVersion) loading.value = false;
      }
    },
    {immediate: true}
  );

  onBeforeUnmount(() => controller?.abort());

  return {
    collection,
    loading,
    error,
    exists: computed(() => collection.value.features.length > 0),
  };
}

export function useLatestTorrentialRainBelt(
  enabled: MaybeRefOrGetter<boolean> = true
) {
  const listFetch = usePollingFetch<PrecipitationAnalysisList>(
    `${sdk.cdnUrl}/analysis/list`,
    600_000,
    enabled,
    true
  );
  const time = computed(() =>
    latestPrecipitationAnalysisTime(listFetch.data.value)
  );
  const belt = useTorrentialRainBelt(
    time,
    computed(() => toValue(enabled) && time.value !== undefined)
  );

  return {
    ...belt,
    time,
    loading: computed(() => listFetch.loading.value || belt.loading.value),
  };
}
