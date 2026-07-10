<template>
  <q-layout view="lHh Lpr lFf">
    <div
      :class="{
        'floating-nav--dashboard': route.path === '/',
        'floating-nav--dashboard-compact':
          route.path === '/' && !genericStore.showHeader,
      }"
      class="floating-nav"
    >
      <q-btn
        aria-label="打开导航"
        class="floating-button"
        color="primary"
        icon="menu"
        round
        unelevated
      >
        <q-tooltip>导航</q-tooltip>
        <q-menu
          :offset="[0, 10]"
          anchor="bottom left"
          class="floating-menu"
          self="top left"
        >
          <div class="floating-menu-heading">
            <div class="text-overline text-primary">SWoS</div>
            <div class="text-subtitle1 text-weight-medium">
              {{ currentTitle }}
            </div>
          </div>
          <q-separator/>
          <q-list class="floating-menu-list">
            <template v-for="section in navigationSections" :key="section.id">
              <q-item-label class="floating-menu-category" header>
                <q-icon :name="section.icon"/>
                <span>{{ section.label }}</span>
              </q-item-label>
              <q-item
                v-for="item in section.items"
                :key="item.id"
                v-close-popup
                v-ripple
                :active="item.href === selectedNavItem"
                :to="item.href"
                clickable
              >
                <q-item-section avatar>
                  <q-icon :name="item.icon"/>
                </q-item-section>
                <q-item-section>{{ item.name }}</q-item-section>
              </q-item>
            </template>
          </q-list>
          <q-separator class="mobile-menu-disclaimer-separator"/>
          <div
            aria-label="无非官方预报数据。数据未经官方质控，仅供参考，不应用于防灾，也不代表官方。"
            class="mobile-menu-disclaimer"
          >
            <q-icon name="info_outline"/>
            <span>无非官方预报数据。数据未经官方质控，仅供参考，不应用于防灾，也不代表官方。</span>
          </div>
        </q-menu>
      </q-btn>
    </div>

    <div
      :class="{
        'floating-actions--dashboard': route.path === '/',
        'floating-actions--dashboard-compact':
          route.path === '/' && !genericStore.showHeader,
      }"
      class="floating-actions"
    >
      <q-btn
        :aria-label="$q.dark.isActive ? '切换到浅色模式' : '切换到深色模式'"
        :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
        class="floating-button"
        round
        unelevated
        @click="toggleDarkMode"
      >
        <q-tooltip>{{ $q.dark.isActive ? '浅色模式' : '深色模式' }}</q-tooltip>
      </q-btn>
      <q-btn
        v-if="genericStore.supportScreenshot"
        aria-label="截图"
        class="floating-button"
        icon="screenshot_monitor"
        round
        unelevated
        @click="downloadPage"
      >
        <q-tooltip>截图</q-tooltip>
      </q-btn>
      <q-btn
        v-if="genericStore.supportHeader"
        :aria-label="genericStore.showHeader ? '隐藏标题栏' : '显示标题栏'"
        :icon="genericStore.showHeader ? 'web_asset_off' : 'web_asset'"
        class="floating-button"
        round
        unelevated
        @click="toggleHeader"
      >
        <q-tooltip>{{
          genericStore.showHeader ? '隐藏标题栏' : '显示标题栏'
        }}</q-tooltip>
      </q-btn>
      <q-btn
        v-if="genericStore.supportDashboardControls"
        :aria-label="genericStore.showStatusBar ? '隐藏状态栏' : '显示状态栏'"
        :icon="genericStore.showStatusBar ? 'notifications_off' : 'notifications'"
        class="floating-button"
        round
        unelevated
        @click="toggleStatusBar"
      >
        <q-tooltip>{{
          genericStore.showStatusBar ? '隐藏状态栏' : '显示状态栏'
        }}</q-tooltip>
      </q-btn>
      <q-btn
        v-if="genericStore.supportDashboardControls"
        :aria-label="genericStore.showInsightDock ? '隐藏信息卡片' : '显示信息卡片'"
        :icon="genericStore.showInsightDock ? 'dashboard_customize' : 'dashboard'"
        class="floating-button"
        round
        unelevated
        @click="toggleInsightDock"
      >
        <q-tooltip>{{
          genericStore.showInsightDock ? '隐藏信息卡片' : '显示信息卡片'
        }}</q-tooltip>
      </q-btn>
      <q-btn
        v-if="genericStore.supportToolbar"
        :aria-label="genericStore.showToolbar ? '隐藏工具栏' : '显示工具栏'"
        :icon="genericStore.showToolbar ? 'visibility' : 'visibility_off'"
        class="floating-button"
        round
        unelevated
        @click="toggleToolbar"
      >
        <q-tooltip
        >{{ genericStore.showToolbar ? '隐藏工具栏' : '显示工具栏' }}
        </q-tooltip>
      </q-btn>
    </div>

    <div
      aria-label="无非官方预报数据。数据未经官方质控，仅供参考，不应用于防灾，也不代表官方。"
      class="floating-disclaimer"
    >
      <q-icon name="info_outline"/>
      <span>无非官方预报数据。数据未经官方质控，仅供参考，不应用于防灾，也不代表官方。</span>
    </div>

    <q-page-container>
      <router-view/>
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useQuasar} from 'quasar';
import {useRoute} from 'vue-router';
import {format} from 'date-fns';
import html2canvas from 'html2canvas';
import sdk from 'src/composables/sdk';
import {useGenericStore} from 'stores/generic';

const genericStore = useGenericStore();
const $q = useQuasar();
const route = useRoute();
const isScreenshotting = ref(false);
const keyBuffer = ref('');
let screenshotTimeout: ReturnType<typeof setTimeout> | undefined;
let screenshotFallbackTimeout: ReturnType<typeof setTimeout> | undefined;
const {data: navigationList} = sdk.useFetch<NavigationList[]>(
  '/assets/page-list.json',
  true
);
const selectedNavItem = computed(() => route.path);
const currentTitle = computed(() => {
  if (route.path === '/') return '首页';
  return (
    navigationList.value?.find((item) => item.href === route.path)?.name ?? ''
  );
});
const navigationSections = computed(() => {
  const items = navigationList.value ?? [];
  const usedIds = new Set<string>();
  const itemByIds = (ids: string[]) =>
    ids
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is NavigationList => {
        if (!item) return false;
        usedIds.add(item.id);
        return true;
      });
  const sections = [
    {
      id: 'overview',
      label: '总览',
      icon: 'dashboard',
      items: [{id: 'home', name: '首页', icon: 'home', href: '/'}],
    },
    {
      id: 'rain',
      label: '降雨',
      icon: 'water_drop',
      items: itemByIds(['prec-forecast', 'rain-1h', 'rain-24h', 'rain-period']),
    },
    {
      id: 'water',
      label: '水情与积水',
      icon: 'waves',
      items: itemByIds(['inundation', 'flood-rivers', 'flood-stations']),
    },
    {
      id: 'warnings',
      label: '预警',
      icon: 'warning',
      items: itemByIds([
        'warning-overview',
        'weather-warning',
        'flood-warning',
      ]),
    },
    {
      id: 'weather',
      label: '风与台风',
      icon: 'air',
      items: itemByIds(['wind', 'typhoon']),
    },
  ];
  const uncategorized = items.filter((item) => !usedIds.has(item.id));
  if (uncategorized.length > 0) {
    sections.push({
      id: 'other',
      label: '其他',
      icon: 'more_horiz',
      items: uncategorized,
    });
  }
  return sections.filter((section) => section.items.length > 0);
});

function toggleToolbar() {
  if (!isScreenshotting.value) genericStore.toggleToolbar();
}

function toggleHeader() {
  if (!isScreenshotting.value) genericStore.toggleHeader();
}

function toggleStatusBar() {
  if (!isScreenshotting.value) genericStore.toggleStatusBar();
}

function toggleInsightDock() {
  if (!isScreenshotting.value) genericStore.toggleInsightDock();
}

function toggleDarkMode() {
  $q.dark.set(!$q.dark.isActive);
  localStorage.setItem(
    'swos-color-scheme',
    $q.dark.isActive ? 'dark' : 'light'
  );
}

async function captureCurrentPage() {
  const target =
    document.querySelector<HTMLElement>('.q-page') ??
    document.querySelector<HTMLElement>('.q-page-container');
  if (!target) throw new Error('No page element found for screenshot');

  const canvas = await html2canvas(target, {
    backgroundColor: $q.dark.isActive ? '#07111f' : '#fff',
    useCORS: true,
  });
  const anchor = document.createElement('a');
  const routeLabel =
    route.path === '/'
      ? 'Home'
      : route.path.replace(/^\/+/, '').replace(/[\\/:*?"<>|]+/g, '_') ||
        'Page';
  anchor.setAttribute('href', canvas.toDataURL());
  anchor.setAttribute(
    'download',
    `SWoS_${routeLabel}_${format(new Date(), 'yyyy_MM_dd_HH_mm_ss')}.png`
  );
  anchor.click();
  genericStore.screenshotHandled = true;
}

function downloadPage() {
  if (isScreenshotting.value) return;
  isScreenshotting.value = true;
  const previousState = genericStore.showToolbar;
  genericStore.showToolbar = false;
  genericStore.screenshotHandled = false;
  genericStore.screenshot = true;

  const stop = watch(
    () => genericStore.screenshot,
    (screenshotting) => {
      if (screenshotting) return;
      stop();
      if (screenshotTimeout) clearTimeout(screenshotTimeout);
      if (screenshotFallbackTimeout) clearTimeout(screenshotFallbackTimeout);
      genericStore.showToolbar = previousState;
      isScreenshotting.value = false;
    }
  );
  screenshotFallbackTimeout = setTimeout(() => {
    void (async () => {
      await nextTick();
      if (!genericStore.screenshot || genericStore.screenshotHandled) return;
      try {
        await captureCurrentPage();
      } catch (cause) {
        sdk.showNotification(
          'negative',
          `截图失败：${cause instanceof Error ? cause.message : String(cause)}`
        );
      } finally {
        if (genericStore.screenshot) genericStore.screenshot = false;
      }
    })();
  }, 250);
  screenshotTimeout = setTimeout(() => {
    if (!genericStore.screenshot) return;
    genericStore.screenshot = false;
    sdk.showNotification('negative', '截图失败');
  }, 5000);
}

function hotKeyHandler(event: KeyboardEvent) {
  keyBuffer.value = `${keyBuffer.value}${event.key.toLowerCase()}`.slice(-5);
  if (keyBuffer.value === 'debug' && genericStore.supportDebugging) {
    genericStore.debuggingEnabled = true;
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('swos-color-scheme');
  $q.dark.set(
    savedTheme === 'dark' ||
    (savedTheme === null &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  sdk.printLogo();
  document.addEventListener('keydown', hotKeyHandler);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', hotKeyHandler);
  if (screenshotTimeout) clearTimeout(screenshotTimeout);
  if (screenshotFallbackTimeout) clearTimeout(screenshotFallbackTimeout);
});
</script>

<style scoped>
.floating-nav,
.floating-actions,
.floating-disclaimer {
  position: fixed;
  z-index: 2100;
}

.floating-nav {
  top: 12px;
  left: 12px;
}

.floating-nav--dashboard {
  top: 25px;
}

.floating-nav--dashboard-compact {
  top: 16px;
}

.floating-actions {
  top: 12px;
  right: 20px;
  display: flex;
  max-width: calc(100vw - 96px);
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.floating-actions--dashboard {
  top: 25px;
}

.floating-actions--dashboard-compact {
  top: 16px;
}

.floating-button {
  color: var(--q-primary);
  border: 1px solid var(--swos-border);
  background: var(--swos-map-card);
  box-shadow: 0 8px 24px rgb(15 23 42 / 14%);
  backdrop-filter: blur(14px);
}

.floating-nav .floating-button {
  color: white;
  border-color: transparent;
  background: var(--q-primary);
}

.floating-disclaimer {
  right: 50%;
  top: 12px;
  display: flex;
  max-width: calc(100vw - 24px);
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  color: var(--swos-text-muted);
  border: 1px solid var(--swos-border);
  border-radius: 999px;
  background: var(--swos-map-card);
  box-shadow: 0 8px 24px rgb(15 23 42 / 12%);
  backdrop-filter: blur(14px);
  font-size: 12px;
  line-height: 1.25;
  transform: translateX(50%);
}

:global(.floating-menu) {
  width: min(320px, calc(100vw - 24px));
  max-height: min(680px, calc(100vh - 84px));
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--swos-border);
  border-radius: 16px;
  background: var(--swos-map-card);
  box-shadow: 0 18px 50px rgb(15 23 42 / 22%);
  backdrop-filter: blur(18px);
}

.floating-menu-heading {
  padding: 16px 18px 12px;
}

.floating-menu-list {
  flex: 1 1 auto;
  max-height: min(580px, calc(100vh - 170px));
  overflow-y: auto;
  padding: 8px;
}

.floating-menu-category {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 8px 6px;
  color: var(--swos-text-muted);
  font-size: 11px;
  font-weight: 700;
}

.floating-menu-list .q-item {
  border-radius: 10px;
}

.mobile-menu-disclaimer-separator,
.mobile-menu-disclaimer {
  display: none;
}

.mobile-menu-disclaimer {
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px 14px;
  color: var(--swos-text-muted);
  background: color-mix(in srgb, var(--swos-surface-soft) 68%, transparent);
  font-size: 12px;
  line-height: 1.45;
}

.mobile-menu-disclaimer .q-icon {
  margin-top: 2px;
  color: var(--q-primary);
  font-size: 18px;
}

@media (max-width: 600px) {
  .floating-nav--dashboard {
    top: 12px;
  }

  .floating-nav--dashboard-compact {
    top: 12px;
  }

  .floating-actions--dashboard {
    top: 12px;
  }

  .floating-actions--dashboard-compact {
    top: 12px;
  }

  .floating-actions {
    right: 12px;
    max-width: calc(100vw - 84px);
    gap: 4px;
  }
}

@media (max-width: 900px) {
  .floating-disclaimer {
    display: none;
  }

  .mobile-menu-disclaimer-separator {
    display: block;
  }

  .mobile-menu-disclaimer {
    display: flex;
  }
}
</style>
