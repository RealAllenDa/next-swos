import { defineStore } from 'pinia';

interface PageSpecOptions {
  headerSupported?: boolean;
  dashboardControlsSupported?: boolean;
}

interface VisibilityPreferences {
  showToolbar?: boolean;
  showHeaderDesktop?: boolean;
  showHeaderPhone?: boolean;
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

function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 600px)').matches;
}

function headerPreferenceKey(): 'showHeaderDesktop' | 'showHeaderPhone' {
  return isPhoneViewport() ? 'showHeaderPhone' : 'showHeaderDesktop';
}

function defaultHeaderVisibility(): boolean {
  return !isPhoneViewport();
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
      const headerPreference = preferences[headerPreferenceKey()];
      this.showToolbar = this.supportToolbar
        ? preferences.showToolbar ?? true
        : false;
      this.showHeader = this.supportHeader
        ? headerPreference ?? defaultHeaderVisibility()
        : false;
      this.screenshot = false;
      this.screenshotHandled = false;
      this.showStatusBar = preferences.showStatusBar ?? true;
      this.showInsightDock = preferences.showInsightDock ?? true;
      this.debuggingEnabled = false;
    },
    persistVisibility() {
      const preferences = loadVisibilityPreferences();
      const nextPreferences: VisibilityPreferences = {
        ...preferences,
        showToolbar: this.showToolbar,
        showStatusBar: this.showStatusBar,
        showInsightDock: this.showInsightDock,
      };
      if (this.supportHeader) {
        nextPreferences[headerPreferenceKey()] = this.showHeader;
      }
      saveVisibilityPreferences(nextPreferences);
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
