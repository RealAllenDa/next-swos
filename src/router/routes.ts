import {RouteRecordRaw} from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/IndexPage.vue')}]
  },
  {
    path: '/typhoon',
    component: () => import('layouts/MainLayout.vue'),
    children: [{path: '', component: () => import('pages/TyphoonPage.vue')}],
  },
  {
    path: '/precip',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'forecast',
        component: () => import('pages/PrecipitationForecast.vue')
      },
    ]
  },
  {
    path: '/warning',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'weather',
        component: () => import('pages/WeatherWarning.vue')
      },
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
