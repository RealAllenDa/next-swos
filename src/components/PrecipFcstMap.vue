<template>
  <div id="map" ref="mapContainer">
    <MapControl ref="legendRain">
      <q-btn
        v-if="!isDesktopLayout"
        color="primary"
        icon="style"
        padding="xs"
        @click="showLegend = true"
      >
      </q-btn>
      <div
        v-if="isDesktopLayout"
        class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm legend-rain"
      >
        <PrecipFcstLegend></PrecipFcstLegend>
      </div>
      <q-dialog v-model="showLegend">
        <div class="legend-rain legend-rain-dialog">
          <PrecipFcstLegend></PrecipFcstLegend>
        </div>
      </q-dialog>
    </MapControl>
    <MapControl ref="legendDescription">
      <div
        v-if="precipitationStore.initialized"
        class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm legend-description column"
      >
        <div class="row">
          <span
          >{{
              precipitationStore.selectedDuration.slice(0, -1)
            }}小时降雨量</span
          >
          <span class="q-ml-xl">{{
              precipitationStore.currentTimeFormatted
            }}</span>
        </div>
        <div
          v-if="precipitationStore.displayTorrentialRain"
          class="legend-description-sub row"
        >
          <span>猛烈降水带</span>
          <span>{{ torrentialRainStatus }}</span>
        </div>
        <div
          v-if="precipitationStore.displayGpv"
          class="legend-description-sub row"
        >
          <span>网格雨量</span>
          <span>{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div
          v-if="
            precipitationStore.displayRainMeasurements &&
            precipitationStore.rainMeasurementsSuccess
          "
          class="legend-description-sub row"
        >
          <span
          >{{
              precipitationStore.selectedDuration.replace('h', '')
            }}小时站点观测</span
          >
          <span>{{ precipitationStore.rainMeasurementsTime }}</span>
        </div>
      </div>
    </MapControl>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch,} from 'vue';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';
import type {FeatureCollection} from '@turf/turf';
import * as turf from '@turf/turf';
import {round} from '@turf/turf';
import {
  FullscreenControl,
  type GeoJSONSource,
  Map,
  type MapLayerMouseEvent,
  NavigationControl,
  Popup,
  ScaleControl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapControl from 'components/MLMapControl.vue';
import PrecipFcstLegend from 'components/PrecipFcstLegend.vue';
import {useGenericStore} from 'stores/generic';
import {format} from 'date-fns';
import html2canvas from 'html2canvas';
import {useQuasar} from 'quasar';
import {applyBaseMapTheme, createBaseMapStyle} from 'src/maps/base-style';
import {addUserLocationControl} from 'src/maps/user-location-control';

export default defineComponent({
  components: {MapControl, PrecipFcstLegend},
  setup() {
    const $q = useQuasar();
    const isDesktopLayout = computed(() => {
      return $q.screen.gt.sm;
    });
    const genericStore = useGenericStore();
    const precipitationStore = usePrecipitationStore();
    const map = shallowRef<Map>();
    const mapContainer = shallowRef<HTMLElement>();
    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: 10,
    });

    const currentData = computed(() => precipitationStore.currentData);
    const dataChanged = computed({
      get() {
        return precipitationStore.dataChanged;
      },
      set(value: boolean) {
        precipitationStore.dataChanged = value;
      },
    });
    const torrentialRainDisplay = computed(
      () => precipitationStore.displayTorrentialRain
    );
    const gpvDisplay = computed(() => precipitationStore.displayGpv);
    const rainMeasurementsDisplay = computed(
      () => precipitationStore.displayRainMeasurements
    );
    const isLastTime = computed(
      () => precipitationStore.endTime === precipitationStore.currentTime
    );

    const showLegend = ref(false);
    const legendRain = ref<typeof MapControl>();
    const legendDescription = ref<typeof MapControl>();

    const rainLayerInitialized = ref(false);
    let rainLayerRefreshToken = 0;
    let rainLayerLoadedToken = 0;
    let rainMeasurementsRefreshToken = 0;
    const torrentialRainLayerInitialized = ref(false);
    const rainMeasurementsLayerInitialized = ref(false);
    const gpvLayerInitialized = ref(false);
    const torrentialRainStatus = ref('无');

    function registerFeatureHover(
      layerId: string,
      content: (event: MapLayerMouseEvent) => { title: string; detail?: string }
    ) {
      const currentMap = map.value;
      if (!currentMap) return;
      currentMap.on('mousemove', layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        currentMap.getCanvas().style.cursor = 'pointer';
        const result = content(event);
        const wrapper = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = result.title;
        wrapper.append(title);
        if (result.detail) {
          const detail = document.createElement('div');
          detail.textContent = result.detail;
          wrapper.append(detail);
        }
        hoverPopup
          .setLngLat(event.lngLat)
          .setDOMContent(wrapper)
          .addTo(currentMap);
      });
      currentMap.on('mouseleave', layerId, () => {
        currentMap.getCanvas().style.cursor = '';
        hoverPopup.remove();
      });
    }

    // function radians_to_degrees(radians: number) {
    //   var pi = Math.PI;
    //   return radians * (180 / pi);
    // }

    // function computeTorrentialRainEllipsis(feature: turf.helpers.Feature): turf.helpers.Feature | undefined {
    //   const bbox = turf.bbox(turf.envelope(feature));
    //   const center = turf.center(feature);
    //
    //   console.log(bbox);
    //   // same lat
    //   const xMin = turf.point([bbox[0], bbox[1]]);
    //   const xMax = turf.point([bbox[2], bbox[1]]);
    //   const sigmaX = new Decimal(turf.distance(xMin, xMax, {units: 'kilometers'}))
    //
    //   // same lng
    //   const yMin = turf.point([bbox[0], bbox[1]]);
    //   const yMax = turf.point([bbox[0], bbox[3]]);
    //   const sigmaY = new Decimal(turf.distance(yMin, yMax, {units: 'kilometers'}))
    //
    //   const tempW = ((sigmaX.minus(sigmaY)).pow(2).plus(sigmaY.mul(sigmaX).pow(2).mul(4))).squareRoot()
    //   const sigmaW = sigmaX.plus(sigmaY).plus(tempW).dividedBy(2)
    //   const sigmaH = sigmaX.plus(sigmaY).minus(tempW).dividedBy(2)
    //
    //   const computedW = sigmaW.squareRoot().mul(2.448);
    //   const computedH = sigmaH.squareRoot().mul(2.448);
    //
    //   const tanTheta = sigmaW.minus(sigmaX).dividedBy(sigmaX.mul(sigmaY))
    //   const degTheta = tanTheta.inverseTangent();
    //   console.log(tempW.toString(), sigmaX.toString(), sigmaY.toString(), sigmaW.toString(), sigmaH.toString(),
    //       tanTheta.toString(), radians_to_degrees(degTheta.toNumber()))
    //
    //   let ratio;
    //   if (computedW.gt(computedH)) {
    //     ratio = computedW.dividedBy(computedH)
    //   } else {
    //     ratio = computedH.dividedBy(computedW)
    //   }
    //   console.debug('computedH', computedH.toString(), 'computedW', computedW.toString(), 'ratio', ratio.toString())
    //   if (ratio.lte(2.5)) {
    //     console.debug('rejected: ratio <= 2.5, not a linear precipitation zone')
    //     // return undefined;
    //   }
    //   return turf.ellipse(center, computedW.toNumber(), computedH.toNumber(), {
    //     angle: radians_to_degrees(degTheta.toNumber())
    //   });
    // }

    function refreshTorrentialRain() {
      if (!torrentialRainDisplay.value) {
        torrentialRainStatus.value = '无';
        if (torrentialRainLayerInitialized.value) {
          map.value?.setLayoutProperty('torrential-rain', 'visibility', 'none');
        }
        return;
      }
      torrentialRainStatus.value = '无';
      const {data: torrentialRainGeoJson} = sdk.useFetch<FeatureCollection>(
        `${sdk.cdnUrl}/analysis/rain/tor_zone_3h_5km_${currentData.value?.time}.geojson`,
        true
      );
      watch(
        torrentialRainGeoJson,
        () => {
          if (
            torrentialRainGeoJson.value === undefined ||
            torrentialRainGeoJson.value === null
          ) {
            torrentialRainStatus.value = '无';
            sdk.showNotification('negative', 'Failed to fetch torrential rain');
            return;
          }
          // if (torrentialRainGeoJson.value.features.length === 0) {
          //   return
          // }

          let dataCollection: FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
          };
          torrentialRainGeoJson.value.features.forEach((feature) => {
            const area = turf.convertArea(
              turf.area(feature),
              'meters',
              'kilometers'
            );
            let areaQualified = true;
            if (area < 500) {
              areaQualified = false;
            }

            if (areaQualified) {
              // const result = computeTorrentialRainEllipsis(feature);
              dataCollection.features.push(feature);
            }
          });
          torrentialRainStatus.value =
            dataCollection.features.length > 0
              ? precipitationStore.currentTimeFormatted
              : '无';
          if (!torrentialRainLayerInitialized.value) {
            map.value?.addSource('torrential-rain', {
              type: 'geojson',
              data: dataCollection,
            });
            map.value?.addLayer({
              id: 'torrential-rain',
              type: 'line',
              source: 'torrential-rain',
              // 'source-layer': 'sliced',
              layout: {},
              paint: {
                'line-color': '#ff0000',
                'line-width': 6,
              },
            });
            torrentialRainLayerInitialized.value = true;
          } else {
            map.value?.setLayoutProperty(
              'torrential-rain',
              'visibility',
              'visible'
            );
            (
              map.value?.getSource('torrential-rain') as
                | GeoJSONSource
                | undefined
            )?.setData(dataCollection);
          }
        },
        {once: true}
      );
    }

    function refreshGpv() {
      if (!gpvDisplay.value) {
        if (gpvLayerInitialized.value) {
          map.value?.setLayoutProperty('gpv', 'visibility', 'none');
        }
        return;
      }
      if (!gpvLayerInitialized.value) {
        map.value?.addSource('gpv', {
          type: 'geojson',
          // buffer: 0,
          tolerance: 0,
          data: `${sdk.cdnUrl}/analysis/rain/gpv_${precipitationStore.selectedDuration}_5km_${currentData.value?.time}.geojson`,
        });
        map.value?.addLayer({
          id: 'gpv',
          type: 'symbol',
          source: 'gpv',
          minzoom: 9,
          layout: {
            'text-overlap': 'always',
            'text-font': ['Roboto Bold'],
            'text-field': ['get', 'value'],
          },
          paint: {
            'text-color': '#FFF',
            'text-halo-color': '#000',
            'text-halo-width': 1,
            'text-halo-blur': 1,
          },
        });
        gpvLayerInitialized.value = true;
      } else {
        map.value?.setLayoutProperty('gpv', 'visibility', 'visible');
        (map.value?.getSource('gpv') as GeoJSONSource | undefined)?.setData(
          `${sdk.cdnUrl}/analysis/rain/gpv_${precipitationStore.selectedDuration}_5km_${currentData.value?.time}.geojson`
        );
      }
    }

    function setRainMeasurementsVisibility(visible = true) {
      if (!visible) {
        map.value?.setLayoutProperty(
          'rain-measurements-3d',
          'visibility',
          'none'
        );
        map.value?.setLayoutProperty(
          'rain-measurements-label',
          'visibility',
          'none'
        );
        map.value?.setLayoutProperty(
          'rain-measurements-point',
          'visibility',
          'none'
        );
        return;
      }
      map.value?.setLayoutProperty(
        'rain-measurements-point',
        'visibility',
        'visible'
      );
      if (precipitationStore.rainMeasurementsDisplayOption === '3d') {
        map.value?.setLayoutProperty(
          'rain-measurements-3d',
          'visibility',
          'visible'
        );
        map.value?.setLayoutProperty(
          'rain-measurements-label',
          'visibility',
          'none'
        );
      } else if (precipitationStore.rainMeasurementsDisplayOption === 'text') {
        map.value?.setLayoutProperty(
          'rain-measurements-3d',
          'visibility',
          'none'
        );
        map.value?.setLayoutProperty(
          'rain-measurements-label',
          'visibility',
          'visible'
        );
      } else {
        throw new Error(
          `NOT IMPLEMENTED: ${precipitationStore.rainMeasurementsDisplayOption} option`
        );
      }
    }

    function getRainMeasurementsColor(precipitation: number) {
      let color;
      if (precipitationStore.selectedDuration === '1h') {
        if (1 < precipitation && precipitation < 3) {
          color = '#F2F2FF';
        } else if (3 <= precipitation && precipitation < 5) {
          color = '#A0D2FF';
        } else if (5 <= precipitation && precipitation < 10) {
          color = '#218CFF';
        } else if (10 <= precipitation && precipitation < 20) {
          color = '#0041FF';
        } else if (20 <= precipitation && precipitation < 30) {
          color = '#FFF500';
        } else if (30 <= precipitation && precipitation < 40) {
          color = '#FF9900';
        } else if (40 <= precipitation && precipitation < 50) {
          color = '#FF2800';
        } else if (50 <= precipitation) {
          color = '#B40068';
        } else {
          color = '#FFFFFF';
        }
      } else if (precipitationStore.selectedDuration === '3h') {
        if (1 < precipitation && precipitation < 10) {
          color = '#F2F2FF';
        } else if (10 <= precipitation && precipitation < 30) {
          color = '#A0D2FF';
        } else if (30 <= precipitation && precipitation < 40) {
          color = '#218CFF';
        } else if (40 <= precipitation && precipitation < 50) {
          color = '#0041FF';
        } else if (50 <= precipitation && precipitation < 60) {
          color = '#FFF500';
        } else if (60 <= precipitation && precipitation < 80) {
          color = '#FF9900';
        } else if (80 <= precipitation && precipitation < 100) {
          color = '#FF2800';
        } else if (100 <= precipitation) {
          color = '#B40068';
        } else {
          color = '#FFFFFF';
        }
      } else if (precipitationStore.selectedDuration === '24h') {
        if (1 < precipitation && precipitation < 25) {
          color = '#F2F2FF';
        } else if (25 <= precipitation && precipitation < 50) {
          color = '#A0D2FF';
        } else if (50 <= precipitation && precipitation < 80) {
          color = '#218CFF';
        } else if (80 <= precipitation && precipitation < 100) {
          color = '#0041FF';
        } else if (100 <= precipitation && precipitation < 150) {
          color = '#FFF500';
        } else if (150 <= precipitation && precipitation < 200) {
          color = '#FF9900';
        } else if (200 <= precipitation && precipitation < 250) {
          color = '#FF2800';
        } else if (250 <= precipitation) {
          color = '#B40068';
        } else {
          color = '#FFFFFF';
        }
      } else {
        throw new Error(
          `NOT IMPLEMENTED: color for ${precipitationStore.selectedDuration}`
        );
      }
      return color;
    }

    function refreshRainMeasurements() {
      rainMeasurementsRefreshToken += 1;
      const refreshToken = rainMeasurementsRefreshToken;
      if (!rainMeasurementsDisplay.value) {
        precipitationStore.rainMeasurementsSuccess = false;
        precipitationStore.rainMeasurementsTime = '';
        if (rainMeasurementsLayerInitialized.value) {
          setRainMeasurementsVisibility(false);
        }
        return;
      }
      let rain_url;
      if (precipitationStore.selectedDuration === '1h') {
        rain_url = `https://db.api.daziannetwork.com/rain_state?hours=1&end_time=${precipitationStore.currentTimeFormatted}`;
      } else if (precipitationStore.selectedDuration === '24h') {
        rain_url = `https://db.api.daziannetwork.com/rain_state?hours=24&end_time=${precipitationStore.currentTimeFormatted}`;
      } else if (precipitationStore.selectedDuration === '3h') {
        rain_url = `https://db.api.daziannetwork.com/rain_state?hours=3&end_time=${precipitationStore.currentTimeFormatted}`;
      } else {
        throw new Error('Exhaustive handling of rainMeasurements');
      }
      let dataCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };
      let dataCollectionSquare: FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };
      const {data: rain} = sdk.useFetch<RainMeasurements>(rain_url, true);
      watch(
        rain,
        () => {
          if (refreshToken !== rainMeasurementsRefreshToken) {
            return;
          }
          if (rain.value === undefined) {
            return;
          }
          if (rain.value === null) {
            setRainMeasurementsVisibility(false);
            precipitationStore.rainMeasurementsSuccess = false;
            precipitationStore.rainMeasurementsTime = '';
            return;
          }
          rain.value.rain.forEach((station) => {
            const precipitation = station.value;
            const color = getRainMeasurementsColor(precipitation);
            let value = precipitation * 1000;
            if (precipitation > 1) {
              dataCollection.features.push({
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [station.longitude, station.latitude],
                },
                properties: {
                  name: station.name,
                  value: round(precipitation, 2),
                  color: color,
                },
              });
              dataCollectionSquare.features.push(
                turf.bboxPolygon(
                  turf.bbox(
                    turf.circle([station.longitude, station.latitude], 1)
                  ),
                  {
                    properties: {
                      name: station.name,
                      value: value,
                      color: color,
                    },
                  }
                )
              );
            }
          });
          // Time: yyyy-MM-ddTH:mm:ss+08:00 => yyyy-MM-dd HH:mm
          const time = Date.parse(rain.value.message_time);
          precipitationStore.rainMeasurementsTime = format(
            time,
            'yyyy-MM-dd HH:mm'
          );

          if (!rainMeasurementsLayerInitialized.value) {
            map.value?.addSource('rain-measurements', {
              type: 'geojson',
              data: dataCollection,
            });
            map.value?.addSource('rain-measurements-square', {
              type: 'geojson',
              data: dataCollectionSquare,
            });
            // Layer for displaying numbers
            map.value?.addLayer({
              id: 'rain-measurements-label',
              type: 'symbol',
              source: 'rain-measurements',
              minzoom: 8,
              layout: {
                'symbol-sort-key': ['-', 0, ['to-number', ['get', 'value']]],
                'text-allow-overlap': false,
                'text-font': ['Roboto Bold'],
                'text-size': 20,
                'text-field': ['get', 'value'],
              },
              paint: {
                'text-color': ['get', 'color'],
                'text-halo-color': '#707070',
                'text-halo-width': 1,
                'text-halo-blur': 1,
              },
            });
            // Layer for displaying 3d maps
            map.value?.addLayer({
              id: 'rain-measurements-3d',
              type: 'fill-extrusion',
              source: 'rain-measurements-square',
              minzoom: 8,
              paint: {
                'fill-extrusion-color': ['get', 'color'],
                'fill-extrusion-height': ['get', 'value'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.85,
              },
            });
            // Layer for displaying points
            map.value?.addLayer({
              id: 'rain-measurements-point',
              type: 'circle',
              source: 'rain-measurements',
              maxzoom: 8,
              layout: {
                'circle-sort-key': ['get', 'value'],
              },
              paint: {
                'circle-radius': 7,
                'circle-color': ['get', 'color'],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#000',
              },
            });
            const measurementContent = (event: MapLayerMouseEvent) => ({
              title: String(
                event.features?.[0]?.properties.name ?? '降雨观测站'
              ),
              detail: `${
                event.features?.[0]?.layer.id === 'rain-measurements-3d'
                  ? Number(event.features?.[0]?.properties.value ?? 0) / 1000
                  : Number(event.features?.[0]?.properties.value ?? 0)
              } mm`,
            });
            registerFeatureHover('rain-measurements-3d', measurementContent);
            registerFeatureHover('rain-measurements-label', measurementContent);
            rainMeasurementsLayerInitialized.value = true;
          } else {
            (
              map.value?.getSource('rain-measurements') as
                | GeoJSONSource
                | undefined
            )?.setData(dataCollection);
            (
              map.value?.getSource('rain-measurements-square') as
                | GeoJSONSource
                | undefined
            )?.setData(dataCollectionSquare);
          }

          precipitationStore.rainMeasurementsSuccess = true;
          setRainMeasurementsVisibility();
        },
        {once: true}
      );
    }

    function getRainUrl() {
      let resolution = precipitationStore.selectedResolution;
      if (
        precipitationStore.optInThumbnailLoading &&
        precipitationStore.isInPlayback
      ) {
        resolution = precipitationStore.thumbnailQualityResolution;
      }
      return `${sdk.cdnUrl}/analysis/rain/rain_${precipitationStore.selectedDuration}_${resolution}_${currentData.value?.time}.geojson`;
    }

    function refreshRainLayer() {
      rainLayerRefreshToken += 1;
      precipitationStore.mapIsLoading = true;
      if (!rainLayerInitialized.value) {
        map.value?.addSource('rain', {
          type: 'geojson',
          // buffer: 0,
          tolerance: 0,
          data: getRainUrl(),
        });
        map.value?.addLayer({
          id: 'rain',
          type: 'fill',
          source: 'rain',
          // 'source-layer': 'sliced',
          layout: {},
          paint: {
            'fill-color': ['to-color', ['get', 'c']],
            'fill-opacity': 0.7,
            'fill-outline-color': 'rgba(0,0,0,0)',
          },
        });
        rainLayerInitialized.value = true;
      } else {
        (map.value?.getSource('rain') as GeoJSONSource | undefined)?.setData(
          getRainUrl()
        );
        // map.value?.getSource('rain').setTiles([`http://localhost:3000/tile/${currentData.value?.time}/{z}/{x}/{y}`])
      }
    }

    watch(
      computed(() => {
        return precipitationStore.isInPlayback;
      }),
      () => {
        if (
          !precipitationStore.isInPlayback &&
          precipitationStore.initialized
        ) {
          refreshRainLayer();
        }
      }
    );

    watch(dataChanged, () => {
      if (!dataChanged.value) {
        return;
      }
      if (
        currentData.value === undefined ||
        currentData.value === null ||
        map.value === undefined ||
        !map.value.isStyleLoaded() ||
        !precipitationStore.initialized
      ) {
        return;
      }
      refreshRainLayer();
      refreshTorrentialRain();
      refreshGpv();
      refreshRainMeasurements();
      dataChanged.value = false;
    });

    watch(torrentialRainDisplay, refreshTorrentialRain);
    watch(gpvDisplay, refreshGpv);
    watch(rainMeasurementsDisplay, refreshRainMeasurements);
    watch(
      () => $q.dark.isActive,
      (dark) => applyBaseMapTheme(map.value, dark)
    );
    watch(
      computed(() => {
        return precipitationStore.rainMeasurementsDisplayOption;
      }),
      () => {
        setRainMeasurementsVisibility();
      }
    );

    watch(
      computed(() => {
        return genericStore.screenshot;
      }),
      async () => {
        if (!genericStore.screenshot || !mapContainer.value) return;
        genericStore.screenshotHandled = true;
        try {
          const pngImage = (
            await html2canvas(mapContainer.value, {
              backgroundColor: $q.dark.isActive ? '#07111f' : '#fff',
            })
          ).toDataURL();
          const anchor = document.createElement('a');
          anchor.setAttribute('href', pngImage);
          anchor.setAttribute(
            'download',
            `SWoS_PrecipForecast_${format(
              new Date(),
              'yyyy_MM_dd_HH_mm_ss'
            )}.png`
          );
          anchor.click();
        } finally {
          genericStore.screenshot = false;
        }
      }
    );

    onMounted(() => {
      map.value = markRaw(
        new Map({
          container: mapContainer.value as HTMLElement,
          maxZoom: 13,
          // pitchWithRotate: false,
          // dragRotate: false,
          // touchPitch: false,
          keyboard: false,
          preserveDrawingBuffer: true,
          style: {
            ...createBaseMapStyle($q.dark.isActive),
            glyphs: './{fontstack}/{range}.pbf',
          },
          center: [121.51016235351564, 31.259183024923097],
          zoom: 10,
        })
      );
      if (legendRain.value) {
        map.value.addControl(new legendRain.value.MapLegend(), 'bottom-right');
      }
      if (legendDescription.value) {
        map.value.addControl(
          new legendDescription.value.MapLegend(),
          'top-right'
        );
      }

      map.value.addControl(new NavigationControl(), 'top-left');
      addUserLocationControl(map.value, 'top-left');
      map.value.addControl(new FullscreenControl(), 'top-left');
      map.value.addControl(new ScaleControl({unit: 'metric'}), 'bottom-left');

      map.value.on('sourcedata', (e) => {
        if (e.sourceId !== 'rain') {
          return;
        }
        if (
          !e.isSourceLoaded ||
          map.value?.isSourceLoaded('rain') !== true
        ) {
          precipitationStore.mapIsLoading = true;
          return;
        }
        const refreshToken = rainLayerRefreshToken;
        if (rainLayerLoadedToken === refreshToken) {
          return;
        }
        rainLayerLoadedToken = refreshToken;
        precipitationStore.mapIsLoading = false;
      });
      map.value.once('load', () => {
        if (precipitationStore.dataChanged) {
          refreshRainLayer();
          refreshTorrentialRain();
          refreshGpv();
          refreshRainMeasurements();
          precipitationStore.dataChanged = false;
        }
      });
    });

    onBeforeUnmount(() => map.value?.remove());

    return {
      isDesktopLayout,
      map,
      mapContainer,
      showLegend,
      legendRain,
      legendDescription,
      torrentialRainStatus,
      currentData,
      rainMeasurementsDisplay,
      torrentialRainDisplay,
      precipitationStore,
      isLastTime,
    };
  },
});
</script>

<!--suppress CssUnusedSymbol -->
<style>
#map {
  height: 100%;
  width: 100%;
}

.clear-layer {
  image-rendering: pixelated;
}

.gpv-labels {
  background-color: transparent;
  border: transparent;
  box-shadow: none;
}

.legend-rain {
  color: inherit;
  background: var(--swos-map-card);
  border: 2px solid var(--swos-border);
  margin: 0 10px 10px 0;
}

.legend-rain-dialog {
  padding: 10px;
  margin: 0;
}

.legend-description {
  color: inherit;
  background: var(--swos-map-card);
  border: 2px solid var(--swos-border);
  margin: 10px 10px 0 0;
  min-width: 260px;
  gap: 4px;
  font-size: 17px;
  font-weight: 700;
  border-radius: 4px;
}

.legend-description-sub {
  gap: 16px;
  font-size: 14px;
  justify-content: space-between;
}

.legend-description-sub span:last-child {
  margin-left: auto;
  white-space: nowrap;
}

.rain-measurements-popup {
  font-size: 20px !important;
  padding: 5px !important;
}

@media (max-width: 650px) {
  .legend-description {
    min-width: 220px;
    margin: 8px 8px 0 0;
    font-size: 14px;
  }

  .legend-description-sub {
    font-size: 12px;
  }
}
</style>
