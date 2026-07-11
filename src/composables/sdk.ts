import {type Ref, ref, unref, watchEffect} from 'vue';
import {Notify} from 'quasar';

class SDK {
  public apiUrl: string;
  public cdnUrl: string;
  public dbApiUrl: string;
  public readonly productionApiUrl = 'https://api.daziannetwork.com';

  private readonly logColor: string;

  private readonly useProductionAPI: boolean;

  constructor() {
    this.logColor = ENVIRONMENT === 'production' ? '#43bb88' : 'orange';
    this.apiUrl = API_URL;
    this.cdnUrl = CDN_URL;
    this.dbApiUrl = DB_API_URL;
    this.useProductionAPI = this.apiUrl === this.productionApiUrl;
  }

  printLogo(): void {
    // eslint-disable-next-line no-console
    console.log(
      `${LOGO}\n` + `Version ${VERSION}-${ENVIRONMENT}. `,
      `color: ${this.logColor}; font-size: 20px; font-weight: bold;`
    );
  }

  resolveUrl(url: string, useCustomPrefix = false): string {
    return useCustomPrefix ? url : `${this.apiUrl}${url}`;
  }

  async fetchJson<T>(
    url: string,
    useCustomPrefix = false,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(this.resolveUrl(url, useCustomPrefix), {
      signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      payload.status === -1
    ) {
      throw new Error(payload.message ?? 'API returned an error');
    }
    return payload as T;
  }

  fetchProductionJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    return this.fetchJson<T>(`${this.productionApiUrl}${url}`, true, signal);
  }

  useFetch<T>(url: string | Ref<string>, useCustomPrefix = false) {
    const data: Ref<Nullable<T>> = ref(undefined);
    const error = ref<Error | null>(null);

    const doFetch = async (requestUrl: string, signal?: AbortSignal) => {
      data.value = undefined;
      error.value = null;
      try {
        data.value = await this.fetchJson<T>(
          requestUrl,
          useCustomPrefix,
          signal
        );
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError')
          return;
        error.value = cause instanceof Error ? cause : new Error(String(cause));
        data.value = null;
        this.showNotification(
          'negative',
          `Failed to fetch ${requestUrl}: ${error.value.message}`
        );
      }
    };

    watchEffect((onCleanup) => {
      const controller = new AbortController();
      void doFetch(unref(url), controller.signal);
      onCleanup(() => controller.abort());
    });

    return {data, error};
  }

  showNotification(type: string, message: string) {
    Notify.create({
      type: type,
      message: message,
    });
    if (ENVIRONMENT !== 'production') console.error(message);
  }
}

const sdk = new SDK();

export default sdk;
