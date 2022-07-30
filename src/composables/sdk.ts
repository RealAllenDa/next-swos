import {isRef, Ref, ref, unref, watchEffect} from 'vue';

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
      this.apiUrl = 'http://127.0.0.1:8000';
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

  useFetch<T>(url: string) {
    const data: Ref<Nullable<T>> = ref(null)
    const error = ref(null)

    function doFetch(apiUrl: string) {
      data.value = null
      error.value = null
      fetch(`${apiUrl}${unref(url)}`)
        .then((res) => res.json())
        .then((json) => (data.value = json))
        .catch((err) => {
          error.value = err;
          console.error(err)
        })
    }

    if (isRef(url)) {
      watchEffect(() => doFetch(this.apiUrl))
    } else {
      doFetch(this.apiUrl)
    }

    return {data, error}
  }
}

const sdk = new SDK();

export default sdk;
