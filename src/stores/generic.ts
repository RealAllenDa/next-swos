import {defineStore} from 'pinia';

export const useGenericStore = defineStore('generic', {
  state: () => ({
    supportToolbar: false,
    showToolbar: true,

    supportScreenshot: false,
    screenshot: false,

    supportDebugging: false,
    debuggingEnabled: false
  }),
  actions: {
    initPageSpec(toolbarSupported: boolean, screenshotSupported: boolean, debuggingSupported: boolean) {
      this.supportToolbar = toolbarSupported
      this.supportDebugging = debuggingSupported
      this.supportScreenshot = screenshotSupported

      this.showToolbar = this.supportToolbar
    }
  }
})
