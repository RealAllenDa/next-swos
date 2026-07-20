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
          <span>线状降雨带</span>
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
          >站点观测</span
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
import type {Feature, FeatureCollection, Polygon} from 'geojson';
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
import {format} from 'date-fns';
import {useQuasar} from 'quasar';
import {applyBaseMapTheme, createBaseMapStyle} from 'src/maps/base-style';
import {addUserLocationControl} from 'src/maps/user-location-control';
import {TORRENTIAL_RAIN_BELT_NONE_LABEL, useTorrentialRainBelt,} from 'src/composables/torrential-rain-belt';

const RADAR_COVERAGE_MASK_SOURCE_ID = 'radar-coverage-mask';
const RADAR_COVERAGE_MASK_LAYER_ID = 'radar-coverage-mask';
const RADAR_COVERAGE_TILE_ZOOM = 7;
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;
const RADAR_COVERAGE_TILES = [
  {x: 106, y: 51},
  {x: 107, y: 51},
  {x: 106, y: 52},
  {x: 107, y: 52},
];

export default defineComponent({
  components: {MapControl, PrecipFcstLegend},
  setup() {
    const $q = useQuasar();
    const isDesktopLayout = computed(() => {
      return $q.screen.gt.sm;
    });
    const precipitationStore = usePrecipitationStore();
    const map = shallowRef<Map>();
    const mapStyleReady = ref(false);
    const mapContainer = shallowRef<HTMLElement>();
    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: 10,
    });

    const currentData = computed(() => precipitationStore.currentData);
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
    const torrentialRainBelt = useTorrentialRainBelt(
      computed(() =>
        precipitationStore.radarLayerAvailable
          ? currentData.value?.time
          : undefined
      )
    );

    const showLegend = ref(false);
    const legendRain = ref<typeof MapControl>();
    const legendDescription = ref<typeof MapControl>();

    const rainLayerInitialized = ref(false);
    let rainLayerRefreshToken = 0;
    let rainLayerLoadedToken = 0;
    let rainLayerLoadingFallback: number | undefined;
    let rainMeasurementsRefreshToken = 0;
    const torrentialRainLayerInitialized = ref(false);
    const rainMeasurementsLayerInitialized = ref(false);
    const gpvLayerInitialized = ref(false);
    const torrentialRainStatus = computed(() =>
      torrentialRainBelt.exists.value
        ? precipitationStore.currentTimeFormatted
        : TORRENTIAL_RAIN_BELT_NONE_LABEL
    );

    function tileLongitude(x: number, zoom: number) {
      return (x / 2 ** zoom) * 360 - 180;
    }

    function tileLatitude(y: number, zoom: number) {
      const radians = Math.atan(
        Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom))
      );
      return (radians * 180) / Math.PI;
    }

    function boundsFeature(
      west: number,
      south: number,
      east: number,
      north: number
    ): Feature<Polygon> {
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
        properties: {},
      };
    }

    function radarCoverageMaskCollection(): FeatureCollection<Polygon> {
      const west = tileLongitude(
        Math.min(...RADAR_COVERAGE_TILES.map((tile) => tile.x)),
        RADAR_COVERAGE_TILE_ZOOM
      );
      const east = tileLongitude(
        Math.max(...RADAR_COVERAGE_TILES.map((tile) => tile.x)) + 1,
        RADAR_COVERAGE_TILE_ZOOM
      );
      const north = tileLatitude(
        Math.min(...RADAR_COVERAGE_TILES.map((tile) => tile.y)),
        RADAR_COVERAGE_TILE_ZOOM
      );
      const south = tileLatitude(
        Math.max(...RADAR_COVERAGE_TILES.map((tile) => tile.y)) + 1,
        RADAR_COVERAGE_TILE_ZOOM
      );

      return {
        type: 'FeatureCollection',
        features: [
          boundsFeature(-180, north, 180, WEB_MERCATOR_MAX_LATITUDE),
          boundsFeature(-180, -WEB_MERCATOR_MAX_LATITUDE, 180, south),
          boundsFeature(-180, south, west, north),
          boundsFeature(east, south, 180, north),
        ],
      };
    }

    function radarCoverageMaskBeforeId() {
      return map.value?.getLayer(RADAR_COVERAGE_MASK_LAYER_ID)
        ? RADAR_COVERAGE_MASK_LAYER_ID
        : undefined;
    }

    function ensureRadarCoverageMask() {
      const currentMap = map.value;
      if (!currentMap) return;
      if (!currentMap.getSource(RADAR_COVERAGE_MASK_SOURCE_ID)) {
        currentMap.addSource(RADAR_COVERAGE_MASK_SOURCE_ID, {
          type: 'geojson',
          data: radarCoverageMaskCollection(),
        });
      }
      if (!currentMap.getLayer(RADAR_COVERAGE_MASK_LAYER_ID)) {
        currentMap.addLayer({
          id: RADAR_COVERAGE_MASK_LAYER_ID,
          type: 'fill',
          source: RADAR_COVERAGE_MASK_SOURCE_ID,
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.72,
          },
        });
      }
      currentMap.setLayoutProperty(
        RADAR_COVERAGE_MASK_LAYER_ID,
        'visibility',
        'visible'
      );
      currentMap.moveLayer(RADAR_COVERAGE_MASK_LAYER_ID);
    }

    function hideRadarCoverageMask() {
      const currentMap = map.value;
      if (!currentMap?.getLayer(RADAR_COVERAGE_MASK_LAYER_ID)) return;
      currentMap.setLayoutProperty(
        RADAR_COVERAGE_MASK_LAYER_ID,
        'visibility',
        'none'
      );
    }

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
      if (!map.value || !mapStyleReady.value) return;
      if (
        !torrentialRainDisplay.value ||
        !precipitationStore.radarLayerAvailable
      ) {
        if (torrentialRainLayerInitialized.value) {
          map.value?.setLayoutProperty('torrential-rain', 'visibility', 'none');
        }
        return;
      }
      const dataCollection = torrentialRainBelt.collection.value;
      if (!torrentialRainLayerInitialized.value) {
        map.value?.addSource('torrential-rain', {
          type: 'geojson',
          data: dataCollection,
        });
        map.value?.addLayer(
          {
            id: 'torrential-rain',
            type: 'line',
            source: 'torrential-rain',
            // 'source-layer': 'sliced',
            layout: {},
            paint: {
              'line-color': '#ff0000',
              'line-width': 6,
            },
          },
          radarCoverageMaskBeforeId()
        );
        torrentialRainLayerInitialized.value = true;
        return;
      }
      map.value?.setLayoutProperty(
        'torrential-rain',
        'visibility',
        'visible'
      );
      (map.value?.getSource('torrential-rain') as GeoJSONSource | undefined)
        ?.setData(dataCollection);
    }

    function refreshGpv() {
      if (!gpvDisplay.value || !precipitationStore.radarLayerAvailable) {
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
        map.value?.addLayer(
          {
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
          },
          radarCoverageMaskBeforeId()
        );
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
            map.value?.addLayer(
              {
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
              },
              radarCoverageMaskBeforeId()
            );
            // Layer for displaying 3d maps
            map.value?.addLayer(
              {
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
              },
              radarCoverageMaskBeforeId()
            );
            // Layer for displaying points
            map.value?.addLayer(
              {
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
              },
              radarCoverageMaskBeforeId()
            );
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
      const refreshToken = rainLayerRefreshToken;
      precipitationStore.mapIsLoading = true;
      if (rainLayerLoadingFallback) {
        window.clearTimeout(rainLayerLoadingFallback);
        rainLayerLoadingFallback = undefined;
      }
      if (!precipitationStore.radarLayerAvailable) {
        if (rainLayerInitialized.value) {
          map.value?.setLayoutProperty('rain', 'visibility', 'none');
        }
        hideRadarCoverageMask();
        finishRainLayerLoading(refreshToken);
        return;
      }
      rainLayerLoadingFallback = window.setTimeout(() => {
        const currentMap = map.value;
        if (
          refreshToken === rainLayerRefreshToken &&
          (!currentMap?.getSource('rain') || currentMap.isSourceLoaded('rain'))
        ) {
          finishRainLayerLoading(refreshToken);
        }
      }, 10_000);
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
        ensureRadarCoverageMask();
      } else {
        map.value?.setLayoutProperty('rain', 'visibility', 'visible');
        (map.value?.getSource('rain') as GeoJSONSource | undefined)?.setData(
          getRainUrl()
        );
        // map.value?.getSource('rain').setTiles([`http://localhost:3000/tile/${currentData.value?.time}/{z}/{x}/{y}`])
        ensureRadarCoverageMask();
      }
    }

    function finishRainLayerLoading(refreshToken = rainLayerRefreshToken) {
      if (refreshToken !== rainLayerRefreshToken) {
        return;
      }
      rainLayerLoadedToken = refreshToken;
      if (rainLayerLoadingFallback) {
        window.clearTimeout(rainLayerLoadingFallback);
        rainLayerLoadingFallback = undefined;
      }
      precipitationStore.mapIsLoading = false;
    }

    watch(
      computed(() => {
        return precipitationStore.isInPlayback;
      }),
      () => {
        if (precipitationStore.initialized) {
          refreshRainLayer();
        }
      }
    );

    function refreshMapLayersForCurrentData() {
      if (
        currentData.value === undefined ||
        currentData.value === null ||
        map.value === undefined ||
        !mapStyleReady.value ||
        !precipitationStore.initialized
      ) {
        return;
      }
      refreshRainLayer();
      refreshTorrentialRain();
      refreshGpv();
      refreshRainMeasurements();
      precipitationStore.dataChanged = false;
    }

    watch(
      [
        currentData,
        () => precipitationStore.initialized,
        () => precipitationStore.selectedDuration,
        () => precipitationStore.selectedResolution,
        () => precipitationStore.radarLayerAvailable,
        () => precipitationStore.optInThumbnailLoading,
      ],
      refreshMapLayersForCurrentData
    );

    watch(torrentialRainDisplay, refreshTorrentialRain);
    watch(() => torrentialRainBelt.collection.value, refreshTorrentialRain);
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
        if (!e.isSourceLoaded) {
          return;
        }
        const refreshToken = rainLayerRefreshToken;
        if (rainLayerLoadedToken === refreshToken) {
          return;
        }
        finishRainLayerLoading(refreshToken);
      });
      map.value.on('error', (event) => {
        if ((event as { sourceId?: string }).sourceId === 'rain') {
          finishRainLayerLoading();
        }
      });
      map.value.once('load', () => {
        mapStyleReady.value = true;
        refreshMapLayersForCurrentData();
      });
    });

    onBeforeUnmount(() => {
      if (rainLayerLoadingFallback) {
        window.clearTimeout(rainLayerLoadingFallback);
      }
      map.value?.remove();
    });

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
