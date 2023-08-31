<template>
  <div id="map" ref="mapContainer">
    <MapControl ref="legendRain">
      <q-btn v-if="!isDesktopLayout"
             color="primary"
             icon="style"
             padding="xs"
             @click="showLegend = true">
      </q-btn>
      <div v-if="isDesktopLayout" class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm legend-rain">
        <PrecipFcstLegend></PrecipFcstLegend>
      </div>
      <q-dialog v-model="showLegend">
        <div class="legend-rain legend-rain-dialog">
          <PrecipFcstLegend></PrecipFcstLegend>
        </div>
      </q-dialog>
    </MapControl>
    <MapControl ref="legendDescription">
      <div v-if="precipitationStore.initialized" class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm legend-description column">
        <div class="row">
          <span>{{ precipitationStore.selectedDuration.slice(0, -1) }}小时降雨量</span>
          <span class="q-ml-xl">{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div v-if="precipitationStore.displayTorrentialRain" class="legend-description-sub row">
          <span>猛烈降水带</span>
          <span>{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div v-if="precipitationStore.displayGpv" class="legend-description-sub row">
          <span>网格雨量</span>
          <span>{{ precipitationStore.currentTimeFormatted }}</span>
        </div>
        <div v-if="precipitationStore.displayRainMeasurements && precipitationStore.rainMeasurementsSuccess"
             class="legend-description-sub row">
          <span>{{ precipitationStore.selectedDuration.replace('h', '') }}小时站点观测</span>
          <span>{{ precipitationStore.rainMeasurementsTime }}</span>
        </div>
      </div>
    </MapControl>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, markRaw, onMounted, ref, shallowRef, watch} from 'vue';
import {usePrecipitationStore} from 'stores/precipitation';
import sdk from 'src/composables/sdk';
import type {FeatureCollection} from '@turf/turf'
import * as turf from '@turf/turf'
import {round} from '@turf/turf'
import {FullscreenControl, Map, NavigationControl, Popup, ScaleControl} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapControl from 'components/MLMapControl.vue';
import PrecipFcstLegend from 'components/PrecipFcstLegend.vue';
import {useGenericStore} from 'stores/generic';
import {format} from 'date-fns';
import html2canvas from 'html2canvas';
import {useQuasar} from 'quasar';

export default defineComponent({
  components: {MapControl, PrecipFcstLegend},
  setup() {
    const isDesktopLayout = computed(() => {
      return useQuasar().screen.gt.sm;
    });
    const genericStore = useGenericStore();
    const precipitationStore = usePrecipitationStore();
    const map = shallowRef<Map>();
    const mapContainer = shallowRef<HTMLElement>();

    const currentData = computed(() => precipitationStore.currentData);
    const dataChanged = computed({
      get() {
        return precipitationStore.dataChanged
      },
      set() {
        precipitationStore.dataChanged = !precipitationStore.dataChanged
      }
    });
    const torrentialRainDisplay = computed(() => precipitationStore.displayTorrentialRain);
    const gpvDisplay = computed(() => precipitationStore.displayGpv);
    const rainMeasurementsDisplay = computed(() => precipitationStore.displayRainMeasurements);
    const isLastTime = computed(() => precipitationStore.endTime === precipitationStore.currentTime);

    const showLegend = ref(false);
    const legendRain = ref<typeof MapControl>();
    const legendDescription = ref<typeof MapControl>();

    const rainLayerInitialized = ref(false);
    const torrentialRainLayerInitialized = ref(false);
    const rainMeasurementsLayerInitialized = ref(false);
    const gpvLayerInitialized = ref(false);

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
        if (torrentialRainLayerInitialized.value) {
          map.value?.setLayoutProperty('torrential-rain', 'visibility', 'none');
        }
        return
      }
      const {data: torrentialRainGeoJson} = sdk.useFetch<FeatureCollection>(`/parse/rain/tor_zone_3h_5km_${currentData.value?.time}.geojson`)
      watch(torrentialRainGeoJson, () => {
        if (torrentialRainGeoJson.value === undefined || torrentialRainGeoJson.value === null) {
          sdk.showNotification('negative', 'Failed to fetch torrential rain');
          return
        }
        // if (torrentialRainGeoJson.value.features.length === 0) {
        //   return
        // }

        let dataCollection: FeatureCollection = {'type': 'FeatureCollection', 'features': []}
        torrentialRainGeoJson.value.features.forEach(feature => {
          const area = turf.convertArea(turf.area(feature), 'meters', 'kilometers')
          console.debug('area', area)
          let areaQualified = true;
          if (area < 500) {
            console.debug('rejected: area < 500, not a linear precipitation zone')
            areaQualified = false;
          }

          if (areaQualified) {
            // const result = computeTorrentialRainEllipsis(feature);
            dataCollection.features.push(feature);
          }
        })
        if (!torrentialRainLayerInitialized.value) {
          map.value?.addSource('torrential-rain', {
            type: 'geojson',
            data: dataCollection
          })
          map.value?.addLayer({
            id: 'torrential-rain',
            type: 'line',
            source: 'torrential-rain',
            // 'source-layer': 'sliced',
            layout: {},
            paint: {
              'line-color': '#ff0000',
              'line-width': 6
            }
          })
          torrentialRainLayerInitialized.value = true;
        } else {
          map.value?.setLayoutProperty('torrential-rain', 'visibility', 'visible');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('torrential-rain')?.setData(dataCollection);
        }
      })

    }

    function refreshGpv() {
      if (!gpvDisplay.value) {
        if (gpvLayerInitialized.value) {
          map.value?.setLayoutProperty('gpv', 'visibility', 'none');
        }
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!gpvLayerInitialized.value) {
        map.value?.addSource('gpv', {
          type: 'geojson',
          buffer: 0,
          tolerance: 0,
          data: `${sdk.apiUrl}/parse/rain/gpv_${precipitationStore.selectedDuration}_5km_${currentData.value?.time}.geojson`
        })
        map.value?.addLayer({
          id: 'gpv',
          type: 'symbol',
          source: 'gpv',
          minzoom: 9,
          layout: {
            'text-overlap': 'always',
            'text-font': ['Roboto Bold'],
            'text-field': ['get', 'value']
          },
          paint: {
            'text-color': '#FFF',
            'text-halo-color': '#000',
            'text-halo-width': 1,
            'text-halo-blur': 1
          }
        })
        gpvLayerInitialized.value = true;
      } else {
        map.value?.setLayoutProperty('gpv', 'visibility', 'visible');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        map.value?.getSource('gpv')?.setData(`${sdk.apiUrl}/parse/rain/gpv_${precipitationStore.selectedDuration}_5km_${currentData.value?.time}.geojson`)
      }
    }

    function setRainMeasurementsVisibility(visible = true) {
      if (!visible) {
        map.value?.setLayoutProperty('rain-measurements-3d', 'visibility', 'none');
        map.value?.setLayoutProperty('rain-measurements-label', 'visibility', 'none');
        map.value?.setLayoutProperty('rain-measurements-point', 'visibility', 'none');
        return
      }
      map.value?.setLayoutProperty('rain-measurements-point', 'visibility', 'visible');
      if (precipitationStore.rainMeasurementsDisplayOption === '3d') {
        map.value?.setLayoutProperty('rain-measurements-3d', 'visibility', 'visible');
        map.value?.setLayoutProperty('rain-measurements-label', 'visibility', 'none');
      } else if (precipitationStore.rainMeasurementsDisplayOption === 'text') {
        map.value?.setLayoutProperty('rain-measurements-3d', 'visibility', 'none');
        map.value?.setLayoutProperty('rain-measurements-label', 'visibility', 'visible');
      } else {
        throw new Error(`NOT IMPLEMENTED: ${precipitationStore.rainMeasurementsDisplayOption} option`)
      }
    }

    function getRainMeasurementsColor(precipitation: number) {
      let color;
      if (precipitationStore.selectedDuration === '1h') {
        if (1 < precipitation && precipitation < 3) {
          color = '#F2F2FF'
        } else if (3 <= precipitation && precipitation < 5) {
          color = '#A0D2FF'
        } else if (5 <= precipitation && precipitation < 10) {
          color = '#218CFF'
        } else if (10 <= precipitation && precipitation < 20) {
          color = '#0041FF'
        } else if (20 <= precipitation && precipitation < 30) {
          color = '#FFF500'
        } else if (30 <= precipitation && precipitation < 40) {
          color = '#FF9900'
        } else if (40 <= precipitation && precipitation < 50) {
          color = '#FF2800'
        } else if (50 <= precipitation) {
          color = '#B40068'
        } else {
          color = '#FFFFFF'
        }
      } else if (precipitationStore.selectedDuration === '3h') {
        if (1 < precipitation && precipitation < 10) {
          color = '#F2F2FF'
        } else if (10 <= precipitation && precipitation < 30) {
          color = '#A0D2FF'
        } else if (30 <= precipitation && precipitation < 40) {
          color = '#218CFF'
        } else if (40 <= precipitation && precipitation < 50) {
          color = '#0041FF'
        } else if (50 <= precipitation && precipitation < 60) {
          color = '#FFF500'
        } else if (60 <= precipitation && precipitation < 80) {
          color = '#FF9900'
        } else if (80 <= precipitation && precipitation < 100) {
          color = '#FF2800'
        } else if (100 <= precipitation) {
          color = '#B40068'
        } else {
          color = '#FFFFFF'
        }
      } else if (precipitationStore.selectedDuration === '24h') {
        if (1 < precipitation && precipitation < 25) {
          color = '#F2F2FF'
        } else if (25 <= precipitation && precipitation < 50) {
          color = '#A0D2FF'
        } else if (50 <= precipitation && precipitation < 80) {
          color = '#218CFF'
        } else if (80 <= precipitation && precipitation < 100) {
          color = '#0041FF'
        } else if (100 <= precipitation && precipitation < 150) {
          color = '#FFF500'
        } else if (150 <= precipitation && precipitation < 200) {
          color = '#FF9900'
        } else if (200 <= precipitation && precipitation < 250) {
          color = '#FF2800'
        } else if (250 <= precipitation) {
          color = '#B40068'
        } else {
          color = '#FFFFFF'
        }
      } else {
        throw new Error(`NOT IMPLEMENTED: color for ${precipitationStore.selectedDuration}`)
      }
      return color;
    }

    function refreshRainMeasurements() {
      if (!rainMeasurementsDisplay.value) {
        if (rainMeasurementsLayerInitialized.value) {
          precipitationStore.rainMeasurementsSuccess = false;
          setRainMeasurementsVisibility(false);
        }
        return
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
      let dataCollection: FeatureCollection = {type: 'FeatureCollection', features: []}
      let dataCollectionSquare: FeatureCollection = {type: 'FeatureCollection', features: []}
      const {data: rain} = sdk.useFetch<RainMeasurements>(rain_url, true);
      watch(rain, () => {
        if (rain.value === undefined || rain.value === null) {
          setRainMeasurementsVisibility(false);
          precipitationStore.rainMeasurementsSuccess = false;
          return;
        }
        rain.value.rain.forEach(station => {
          const precipitation = station.value;
          const color = getRainMeasurementsColor(precipitation);
          dataCollection.features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [station.longitude, station.latitude]
            },
            properties: {
              value: round(precipitation, 0),
              color: color
            }
          })
          let value = precipitation * 1000;
          if (value > 0) {
            dataCollectionSquare.features.push(
                turf.bboxPolygon(
                    turf.bbox(turf.circle([station.longitude, station.latitude], 1)),
                    {
                      properties: {
                        name: station.name,
                        value: value,
                        color: color
                      }
                    }
                )
            )
          }
        })
        // Time: yyyy-MM-ddTH:mm:ss+08:00 => yyyy-MM-dd HH:mm
        const time = Date.parse(rain.value.message_time)
        precipitationStore.rainMeasurementsTime = format(time, 'yyyy-MM-dd HH:mm');

        if (!rainMeasurementsLayerInitialized.value) {
          map.value?.addSource('rain-measurements', {
            type: 'geojson',
            data: dataCollection
          })
          map.value?.addSource('rain-measurements-square', {
            type: 'geojson',
            data: dataCollectionSquare
          })
          // Layer for displaying numbers
          map.value?.addLayer({
            id: 'rain-measurements-label',
            type: 'symbol',
            source: 'rain-measurements',
            minzoom: 8,
            layout: {
              'text-allow-overlap': true,
              'text-font': ['Roboto Bold'],
              'text-size': 20,
              'text-field': ['get', 'value']
            },
            paint: {
              'text-color': ['get', 'color'],
              'text-halo-color': '#707070',
              'text-halo-width': 1,
              'text-halo-blur': 1
            }
          })
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
              'fill-extrusion-opacity': 0.85
            }
          })
          // Layer for displaying points
          map.value?.addLayer({
            id: 'rain-measurements-point',
            type: 'circle',
            source: 'rain-measurements',
            maxzoom: 8,
            layout: {},
            paint: {
              'circle-radius': 7,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#000'
            }
          })
          const popup = new Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: 'none',
            className: 'rain-measurements-popup'
          });
          map.value?.on('mousemove', 'rain-measurements-3d', (e) => {
            // Change the cursor style as a UI indicator.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            map.value!.getCanvas().style.cursor = 'pointer';
            popup
                .setLngLat(e.lngLat)
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                .setHTML(`${e.features![0].properties.name}: ${e.features![0].properties.value / 1000}mm`)
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                .addTo(map.value!);
          })
          map.value?.on('mouseleave', 'rain-measurements-3d', () => {
            popup.remove()
          })
          rainMeasurementsLayerInitialized.value = true;
        } else {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('rain-measurements')?.setData(dataCollection);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          map.value?.getSource('rain-measurements-square')?.setData(dataCollectionSquare);
        }

        precipitationStore.rainMeasurementsSuccess = true;
        setRainMeasurementsVisibility();
      })
    }

    function refreshRainLayer() {
      precipitationStore.mapIsLoading = true;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!rainLayerInitialized.value) {
        map.value?.addSource('rain', {
          type: 'geojson',
          buffer: 0,
          tolerance: 0,
          data: `${sdk.apiUrl}/parse/rain/rain_${precipitationStore.selectedDuration}_${precipitationStore.selectedResolution}_${currentData.value?.time}.geojson`
          // type: 'vector',
          // tiles: [`http://localhost:3000/tile/${currentData.value?.time}/{z}/{x}/{y}`],
          // // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          // bounds: [currentData.value!.bounds[0][1], currentData.value!.bounds[1][0], currentData.value!.bounds[1][1], currentData.value!.bounds[0][0]]
        })
        map.value?.addLayer({
          id: 'rain',
          type: 'fill',
          source: 'rain',
          // 'source-layer': 'sliced',
          layout: {},
          paint: {
            'fill-color': ['to-color', ['concat', 'rgba(', ['get', 'c'], ')']],
            'fill-opacity': 0.7,
            'fill-outline-color': 'rgba(0,0,0,0)'
          }
        })
        rainLayerInitialized.value = true;
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        map.value?.getSource('rain')?.setData(`${sdk.apiUrl}/parse/rain/rain_${precipitationStore.selectedDuration}_${precipitationStore.selectedResolution}_${currentData.value?.time}.geojson`)
        // map.value?.getSource('rain').setTiles([`http://localhost:3000/tile/${currentData.value?.time}/{z}/{x}/{y}`])
      }
    }


    watch(dataChanged, () => {
      if (!dataChanged.value) {
        return;
      }
      if (currentData.value === undefined || currentData.value === null ||
        map.value === undefined) {
        return;
      }
      refreshRainLayer();
      refreshTorrentialRain();
      refreshGpv();
      refreshRainMeasurements();
      dataChanged.value = false;
    });

    watch(torrentialRainDisplay, refreshTorrentialRain);
    watch(gpvDisplay, refreshGpv)
    watch(rainMeasurementsDisplay, refreshRainMeasurements);
    watch(computed(() => {
      return precipitationStore.rainMeasurementsDisplayOption
    }), setRainMeasurementsVisibility)

    watch(computed(() => {
      return genericStore.screenshot
    }), async () => {
      if (genericStore.screenshot) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const pngImage = (await html2canvas(mapContainer.value!, {
          backgroundColor: '#FFFF00'
        })).toDataURL();
        const anchor = document.createElement('a')
        anchor.setAttribute('href', pngImage)
        anchor.setAttribute('download',
            `SWoS_PrecipForecast_${format(new Date(), 'yyyy_mm_dd_HH_mm_ss')}.png`)
        anchor.click()
        genericStore.screenshot = false;
      }
    })

    onMounted(() => {
      map.value = markRaw(new Map({
        container: 'map',
        // pitchWithRotate: false,
        // dragRotate: false,
        // touchPitch: false,
        keyboard: false,
        preserveDrawingBuffer: true,
        style: {
          'version': 8,
          'glyphs': './{fontstack}/{range}.pbf',
          'sources': {
            'base-raster': {
              'type': 'raster',
              'tiles': [
                'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
                'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
                'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
                'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
              ],
              'tileSize': 256,
              'attribution':
                  `&copy; ${new Date().getFullYear()} SWoS, HomeNetwork, AllenDa.<br>
        Data source: <a href="https://www.rainviewer.com/" target="_blank">RainViewer</a><br>
        Map source: GaoDe`

            }
          },
          'layers': [
            {
              'id': 'base-map',
              'type': 'raster',
              'source': 'base-raster',
              'minzoom': 0,
              'maxzoom': 14
            }
          ]
        },
        center: [121.51016235351564, 31.259183024923097],
        zoom: 10
      }));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      map.value.addControl(new legendRain.value!.MapLegend(), 'bottom-right')
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      map.value.addControl(new legendDescription.value!.MapLegend(), 'top-right')

      map.value.addControl(new FullscreenControl(), 'top-left');
      map.value.addControl(new NavigationControl(), 'top-left');
      map.value.addControl(new ScaleControl({unit: 'metric'}), 'bottom-left');

      map.value.on('sourcedata', (e) => {
        if (e.sourceId === 'rain') {
          precipitationStore.mapIsLoading = !e.isSourceLoaded
        }
      })
    });

    return {
      isDesktopLayout,
      map,
      mapContainer,
      showLegend,
      legendRain,
      legendDescription,
      currentData,
      rainMeasurementsDisplay,
      torrentialRainDisplay,
      precipitationStore,
      isLastTime
    };
  }
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
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.2);
  margin: 0 10px 10px 0;
}

.legend-rain-dialog {
  padding: 10px;
  margin: 0;
}

.legend-description {
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.2);
  margin: 10px 10px 0 0;
  font-size: 17px;
  font-weight: 700;
  border-radius: 4px;
}

.legend-description-sub {
  font-size: 14px;
  justify-content: space-between;
}

.rain-measurements-popup {
  font-size: 20px !important;
  padding: 5px !important;
}
</style>
