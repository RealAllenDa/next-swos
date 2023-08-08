<template>
  <q-layout view="hHh lpR fFf">

    <q-header class="bg-primary text-white" elevated reveal>
      <q-toolbar>
        <q-btn dense flat icon="menu" round @click="toggleLeftDrawer"/>

        <q-toolbar-title>
          SWoS - {{ currentTitle }}
        </q-toolbar-title>

        <span class="gt-sm">
          数据未经官方质控，仅供参考，不应用于防灾，也不代表官方。
        </span>

        <q-btn v-if="genericStore.supportScreenshot" dense flat icon="screenshot_monitor" round @click="downloadPage">
          <q-tooltip>
            Screenshot
          </q-tooltip>
        </q-btn>
        <template v-if="genericStore.supportToolbar">
          <q-btn v-if="genericStore.showToolbar" dense flat icon="visibility" round @click="toggleToolbar">
            <q-tooltip>
              Hide Toolbar
            </q-tooltip>
          </q-btn>
          <q-btn v-else dense flat icon="visibility_off" round @click="toggleToolbar">
            <q-tooltip>
              Show Toolbar
            </q-tooltip>
          </q-btn>
        </template>
        <!--        <StatusMarquee></StatusMarquee>-->
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered overlay side="left">
      <q-scroll-area class="fit">
        <q-list>

          <template v-for="i in navigationList" :key="i.id">
            <q-item v-ripple :active="i.href === selectedNavItem" :to="i.href"
                    clickable>
              <q-item-section avatar>
                <q-icon :name="i.icon"/>
              </q-item-section>
              <q-item-section>
                {{ i.name }}
              </q-item-section>
            </q-item>
          </template>

        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view/>
    </q-page-container>

  </q-layout>
</template>

<script lang="ts">
import {computed, defineComponent, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import sdk from 'src/composables/sdk';
import {useRoute} from 'vue-router';
import {useGenericStore} from 'stores/generic';

export default defineComponent({
  name: 'MainLayout',

  components: {},

  setup() {
    const pressedKeys = ref<string[]>([]);
    const genericStore = useGenericStore()
    const isScreenshotting = ref(false);
    const route = useRoute()
    const leftDrawerOpen = ref(false)
    const {data: navigationList} = sdk.useFetch<NavigationList[]>('/assets/generic/nav_list');
    const selectedNavItem = computed(() => {
      return route.path;
    })
    const currentTitle = computed(() => {
      if (selectedNavItem.value === '/') {
        return 'Home';
      }
      if (navigationList.value === undefined || navigationList.value === null) {
        return '';
      }
      return navigationList.value.find(obj => {
        return obj.href === selectedNavItem.value;
      })?.name
    })

    function toggleToolbar() {
      if (isScreenshotting.value) {
        return
      }
      genericStore.showToolbar = !genericStore.showToolbar;
    }

    function downloadPage() {
      if (isScreenshotting.value) {
        return;
      }
      isScreenshotting.value = true;
      const previousState = genericStore.showToolbar;
      genericStore.showToolbar = false;
      genericStore.screenshot = true;
      watch(computed(() => {
        return genericStore.screenshot
      }), () => {
        genericStore.showToolbar = previousState;
        isScreenshotting.value = false;
      })
      setTimeout(() => {
        if (genericStore.screenshot === true) {
          // something went wrong!
          genericStore.screenshot = false;
          isScreenshotting.value = false;
          sdk.showNotification('negative', 'Screenshot failed!')
        }
      }, 5000);
    }

    function hotKeyHandler(e: KeyboardEvent) {
      if (['d', 'e', 'b', 'u', 'g'].indexOf(e.key) > -1 && pressedKeys.value.length < 6) {
        pressedKeys.value.push(e.key)
      } else {
        pressedKeys.value = []
      }
      if (pressedKeys.value.join('') === 'debug' && genericStore.supportDebugging) {
        console.warn('DEBUGGING MODE ENABLED!')
        genericStore.debuggingEnabled = true;
      }
    }

    onMounted(() => {
      sdk.printLogo()
      document.addEventListener('keydown', hotKeyHandler);
    })
    onBeforeUnmount(() => {
      document.removeEventListener('keydown', hotKeyHandler);
    })

    return {
      navigationList,
      selectedNavItem,
      leftDrawerOpen,
      currentTitle,
      genericStore,
      downloadPage,
      toggleToolbar,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
});
</script>
