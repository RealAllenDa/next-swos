import type { RouteRecordRaw } from 'vue-router';

const hazardPage = (path: string, config: HazardConfig): RouteRecordRaw => ({
  path,
  component: () => import('layouts/MainLayout.vue'),
  children: [
    {
      path: '',
      component: () => import('pages/HazardPage.vue'),
      props: { config },
    },
  ],
});

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  },
  {
    path: '/typhoon',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/TyphoonPage.vue') }],
  },
  {
    path: '/precip',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'forecast',
        component: () => import('pages/PrecipitationForecast.vue'),
      },
    ],
  },
  hazardPage('/rain/1h', {
    mode: 'rain-1h',
    title: '1小时降雨',
    subtitle: '1H Precipitation Observations',
    endpoint: '/warning/rain_state_1h',
  }),
  hazardPage('/rain/24h', {
    mode: 'rain-24h',
    title: '24小时降雨',
    subtitle: '24H Precipitation Observations',
    endpoint: '/warning/rain_state',
  }),
  hazardPage('/rain/period', {
    mode: 'rain-period',
    title: '1小时降雨重现期',
    subtitle: '1H Rainfall Return Period',
    endpoint: '/warning/rain_state_1h',
  }),
  hazardPage('/wind', {
    mode: 'wind',
    title: '风速风向一览',
    subtitle: 'Wind Speed & Direction Overview',
    endpoint: '/warning/wind_state',
  }),
  hazardPage('/inundation', {
    mode: 'inundation',
    title: '道路积水一览',
    subtitle: 'Road Inundation Overview',
    endpoint: '/warning/inundation_state',
  }),
  hazardPage('/flood/rivers', {
    mode: 'flood-rivers',
    title: '河流洪水预报',
    subtitle: 'Flood Forecast for Rivers',
    endpoint: '/warning/flood_state',
  }),
  hazardPage('/flood/stations', {
    mode: 'flood-stations',
    title: '水位观测站一览',
    subtitle: 'Water Level Observation Stations',
    endpoint: '/warning/flood_state',
  }),
  hazardPage('/warning/flood', {
    mode: 'flood-warning',
    title: '防汛预警一览',
    subtitle: 'Flood & River Water Level Warnings',
    endpoint: '/warning/flood_warning',
  }),
  {
    path: '/warning/weather',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/WeatherWarning.vue') },
    ],
  },
  {
    path: '/generic',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/WarningOverviewPage.vue') },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
