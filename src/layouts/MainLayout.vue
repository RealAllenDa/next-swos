<template>
  <q-layout view="hHh lpR fFf">

    <q-header class="bg-primary text-white" elevated reveal>
      <q-toolbar>
        <q-btn dense flat icon="menu" round @click="toggleLeftDrawer"/>

        <q-toolbar-title>
          SWoS - {{ currentTitle }}
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered overlay side="left">
      <q-scroll-area class="fit">
        <q-list>

          <template v-for="i in navigationList" :key="i.id">
            <q-item v-ripple :active="i.href === selectedNavItem" :to="i.href"
                    clickable>
              <q-item-section avatar>
                <q-icon :name="'svguse:nav-icons/icons.svg#' + i.icon"/>
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

    <q-footer class="bg-grey-8 text-white" elevated reveal>
      <q-toolbar>
        <q-toolbar-title>
          &copy; {{ new Date().getFullYear() }} SWoS, HomeNetwork, AllenDa.
          HomeNetwork Confidential. All Rights Reserved. Unauthorized Disclosure prohibited.
        </q-toolbar-title>
      </q-toolbar>
    </q-footer>

  </q-layout>
</template>

<script lang="ts">
import {computed, defineComponent, onMounted, ref} from 'vue';
import sdk from 'src/composables/sdk';
import {useRoute} from 'vue-router';

export default defineComponent({
  name: 'MainLayout',

  setup() {
    const route = useRoute()
    const leftDrawerOpen = ref(false)
    const {data: navigationList} = sdk.useFetch<NavigationList[]>('/assets/generic/nav_list');
    const selectedNavItem = computed(() => {
      return route.path;
    })
    const currentTitle = computed(() => {
      if (navigationList.value === undefined || navigationList.value === null) {
        return '';
      }
      return navigationList.value.find(obj => {
        return obj.href === selectedNavItem.value;
      })?.name
    })

    onMounted(() => {
      sdk.printLogo()
    })

    return {
      navigationList,
      selectedNavItem,
      leftDrawerOpen,
      currentTitle,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
});
</script>
