import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  type WatchStopHandle,
} from 'vue';
import sdk from 'src/composables/sdk';

export interface PollingFetch<T> {
  data: Ref<T | null>;
  error: Ref<Error | null>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
}

function createPollingFetch<T>(
  url: MaybeRefOrGetter<string>,
  intervalMs: number,
  enabled: MaybeRefOrGetter<boolean>,
  fetcher: (url: string, signal: AbortSignal) => Promise<T>
): PollingFetch<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<Error | null>(null);
  const loading = ref(true);
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  let stopSourceWatch: WatchStopHandle | undefined;
  let requestVersion = 0;
  const requestUrl = computed(() => toValue(url));
  const requestEnabled = computed(() => toValue(enabled));

  function stopPolling() {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  async function refresh() {
    if (!requestEnabled.value) return;
    controller?.abort();
    controller = new AbortController();
    const version = ++requestVersion;
    const currentUrl = requestUrl.value;
    loading.value = data.value === null;
    error.value = null;

    try {
      const response = await fetcher(currentUrl, controller.signal);
      if (version === requestVersion && currentUrl === requestUrl.value)
        data.value = response;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (version !== requestVersion) return;
      error.value = cause instanceof Error ? cause : new Error(String(cause));
      sdk.showNotification('negative', `数据加载失败：${error.value.message}`);
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  onMounted(() => {
    stopSourceWatch = watch(
      [requestUrl, requestEnabled],
      ([, isEnabled], previous) => {
        controller?.abort();
        requestVersion += 1;
        stopPolling();

        const sourceChanged = previous !== undefined;
        if (sourceChanged) data.value = null;
        error.value = null;
        loading.value = isEnabled;
        if (!isEnabled) return;

        void refresh();
        timer = setInterval(() => void refresh(), intervalMs);
      },
      { immediate: true }
    );
  });

  onBeforeUnmount(() => {
    controller?.abort();
    stopPolling();
    stopSourceWatch?.();
  });

  return { data, error, loading, refresh };
}

export function usePollingFetch<T>(
  url: MaybeRefOrGetter<string>,
  intervalMs = 60_000,
  enabled: MaybeRefOrGetter<boolean> = true,
  useCustomPrefix = false
): PollingFetch<T> {
  return createPollingFetch(url, intervalMs, enabled, (requestUrl, signal) =>
    sdk.fetchJson<T>(requestUrl, useCustomPrefix, signal)
  );
}

export function useProductionPollingFetch<T>(
  url: MaybeRefOrGetter<string>,
  intervalMs = 60_000,
  enabled: MaybeRefOrGetter<boolean> = true
): PollingFetch<T> {
  return createPollingFetch(url, intervalMs, enabled, (requestUrl, signal) =>
    sdk.fetchProductionJson<T>(requestUrl, signal)
  );
}
