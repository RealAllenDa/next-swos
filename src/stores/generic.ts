import { defineStore } from 'pinia';

interface PageSpecOptions {
  headerSupported?: boolean;
  dashboardControlsSupported?: boolean;
}

interface VisibilityPreferences {
  showToolbar?: boolean;
  showHeader?: boolean;
  showStatusBar?: boolean;
  showInsightDock?: boolean;
}

const VISIBILITY_STORAGE_KEY = 'swos-ui-visibility';

function loadVisibilityPreferences(): VisibilityPreferences {
  if (typeof localStorage === 'undefined') return {};
  try {
    const value = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    return value ? (JSON.parse(value) as VisibilityPreferences) : {};
  } catch {
    return {};
  }
}

function saveVisibilityPreferences(preferences: VisibilityPreferences) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(preferences));
}

export const useGenericStore = defineStore('generic', {
  state: () => ({
    supportToolbar: false,
    showToolbar: true,

    supportHeader: true,
    showHeader: true,

    supportScreenshot: false,
    screenshot: false,
    screenshotHandled: false,

    supportDashboardControls: false,
    showStatusBar: true,
    showInsightDock: true,

    supportDebugging: false,
    debuggingEnabled: false,
  }),
  actions: {
    initPageSpec(
      toolbarSupported: boolean,
      screenshotSupported: boolean,
      debuggingSupported: boolean,
      options: PageSpecOptions = {}
    ) {
      this.supportToolbar = toolbarSupported;
      this.supportDebugging = debuggingSupported;
      this.supportScreenshot = screenshotSupported;
      this.supportHeader = options.headerSupported ?? true;
      this.supportDashboardControls =
        options.dashboardControlsSupported ?? false;

      const preferences = loadVisibilityPreferences();
      this.showToolbar = this.supportToolbar
        ? preferences.showToolbar ?? true
        : false;
      this.showHeader = this.supportHeader
        ? preferences.showHeader ?? true
        : false;
      this.screenshot = false;
      this.screenshotHandled = false;
      this.showStatusBar = preferences.showStatusBar ?? true;
      this.showInsightDock = preferences.showInsightDock ?? true;
      this.debuggingEnabled = false;
    },
    persistVisibility() {
      saveVisibilityPreferences({
        showToolbar: this.showToolbar,
        showHeader: this.showHeader,
        showStatusBar: this.showStatusBar,
        showInsightDock: this.showInsightDock,
      });
    },
    toggleToolbar() {
      if (!this.supportToolbar) return;
      this.showToolbar = !this.showToolbar;
      this.persistVisibility();
    },
    toggleHeader() {
      if (!this.supportHeader) return;
      this.showHeader = !this.showHeader;
      this.persistVisibility();
    },
    toggleStatusBar() {
      if (!this.supportDashboardControls) return;
      this.showStatusBar = !this.showStatusBar;
      this.persistVisibility();
    },
    toggleInsightDock() {
      if (!this.supportDashboardControls) return;
      this.showInsightDock = !this.showInsightDock;
      this.persistVisibility();
    },
  },
});
