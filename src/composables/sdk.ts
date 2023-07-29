import {isRef, Ref, ref, unref, watchEffect} from 'vue';
import {Notify} from 'quasar';

class SDK {
  public apiUrl: string;

  private readonly logColor: string;

  private readonly useProductionAPI: boolean;

  constructor(useProductionAPI = false) {
    this.logColor = ENVIRONMENT === 'production' ? '#43bb88' : 'orange';

    if (ENVIRONMENT === 'development') {
      this.useProductionAPI = useProductionAPI;
    } else {
      this.useProductionAPI = true;
    }
    if (!this.useProductionAPI) {
      this.apiUrl = 'http://10.0.0.100:8000';
    } else {
      this.apiUrl = 'https://api.daziannetwork.com'; // TODO
    }
  }

  printLogo(): void {
    // eslint-disable-next-line no-console
    console.log(
      `${LOGO}\n`
      + `Version ${VERSION}-${ENVIRONMENT}. `,
      `color: ${this.logColor}; font-size: 20px; font-weight: bold;`
    );
    if (this.useProductionAPI) {
      // eslint-disable-next-line no-console
      console.warn(
        '%c!!! Using Production API Server.',
        'color: orange; font-size: 20px; font-weight: bold;'
      );
    }
  }

  useFetch<T>(url: string, useCustomPrefix = false) {
    // IMPORTANT: Set data to undefined first
    // Undefined is for not-fetched data; null is for errored data
    const data: Ref<Nullable<T>> = ref(undefined)
    const error = ref(null)

    function doFetch(apiUrl: string, that: SDK) {
      data.value = undefined
      error.value = null
      fetch(`${apiUrl}${unref(url)}`)
        .then((res) => res.json())
        .then((json) => (data.value = json['status'] !== -1 ? json : null))
        .catch((err) => {
          error.value = err;
          that.showNotification('negative', `Failed to fetch ${url}: ${err}`)
        })
    }

    if (!useCustomPrefix) {
      if (isRef(url)) {
        watchEffect(() => doFetch(this.apiUrl, this))
      } else {
        doFetch(this.apiUrl, this)
      }
    } else {
      if (isRef(url)) {
        watchEffect(() => doFetch('', this))
      } else {
        doFetch('', this)
      }
    }

    if (error.value !== null) {
      this.showNotification('negative', error.value)
    }


    return {data, error}
  }

  showNotification(type: string, message: string) {
    Notify.create({
      type: type,
      message: message
    })
    console.error(message)
  }
}

const sdk = new SDK();

export default sdk;
