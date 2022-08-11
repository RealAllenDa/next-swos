<template>
  <div id="map">
    <MapControl ref="typhoonDetail" :disable-click-propagation="true"
                :disable-scroll-propagation="true"
                position="topright">
      <TyphoonSelection></TyphoonSelection>
    </MapControl>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, onMounted, ref, Ref, watch} from 'vue';
import 'leaflet/dist/leaflet.css';
import {CircleMarker, DivIcon, FeatureGroup, LatLng, LatLngExpression, Map, Marker, Polyline, TileLayer} from 'leaflet'
import {useTyphoonStore} from 'stores/typhoon';
import {Semicircle} from '@mirei/leaflet-semicircle-ts';
import MapControl from 'components/MapControl.vue';
import TyphoonSelection from 'components/TyphoonDetail.vue';
import sdk from 'src/composables/sdk';

export default defineComponent({
  components: {TyphoonSelection, MapControl},
  setup() {
    const typhoonStore = useTyphoonStore();
    const typhoonDetail: Ref<typeof MapControl | null> = ref(null);
    const map: Ref<Nullable<Map>> = ref();

    const currentTyphoons = computed(() => {
      return typhoonStore.currentTyphoons
    });

    // Utility
    function getFillColor(point: string): string {
      let color: string;
      switch (point) {
        case '热带低压':
          color = '#00D5CB';
          break;
        case '热带低气压':
          color = '#00D5CB';
          break;
        case '热带风暴':
          color = '#FCFA00';
          break;
        case '强热带风暴':
          color = '#FDAE0D';
          break;
        case '台风':
          color = '#FB3B00';
          break;
        case '强台风':
          color = '#FC4D80';
          break;
        case '超强台风':
          color = '#C2218E';
          break;
        default:
          color = '#ffffff'
      }
      return color;
    }

    function getForecastLineColor(origin: string): string {
      let color: string;
      switch (origin) {
        case '中国':
          color = '#ff0000';
          break;
        case '日本':
          color = '#2BBE00';
          break;
        case '中国香港':
          color = '#fe9104';
          break;
        case '中国台湾':
          color = '#FF00FF';
          break;
        case '美国':
          color = '#11f7f7';
          break;
        default:
          color = '#ffffff'
      }
      return color;
    }

    // Land Info
    const landInfoLayer: Ref<Nullable<FeatureGroup>> = ref();

    function drawLandPoint() {
      if (map.value === null || map.value === undefined ||
        landInfoLayer.value === null || landInfoLayer.value === undefined) {
        return;
      }

      landInfoLayer.value.clearLayers()

      for (const i in currentTyphoons.value) {
        const landInfo = currentTyphoons.value[i].land_info;
        landInfo.forEach(land => {
          const icon = new DivIcon({
            iconAnchor: [20, 20],
            html: `<div class="dot">
            <div class="ring"></div>
            <div class="land-icon" style="border-bottom: 11px solid ${getFillColor(land.strength)};"></div></div>`,
            className: 'attention-icon',
          });
          const pointLayer = new Marker([parseFloat(land.latitude), parseFloat(land.longitude)], {
            icon: icon,
            pane: 'tooltipPane'
          });
          landInfoLayer.value?.addLayer(pointLayer)
        });
      }
    }

    // Forecast & Current Points
    const typhoonNowcastPolyline: Ref<{ [id: string]: LatLng[] }> = ref({});
    const typhoonForecasts: Ref<{ [id: string]: TyphoonPoints }> = ref({});

    const forecastPointsLayer: Ref<Nullable<FeatureGroup>> = ref();
    const nowcastPointLayer: Ref<Nullable<FeatureGroup>> = ref();

    const enableForecastOrigin = computed(() => typhoonStore.showTyphoonForecastOrigins);
    const currentTyphoonIndex = computed(() => typhoonStore.currentTyphoonIndex);

    function drawNowcastPoints() {
      if (map.value === null || map.value === undefined ||
        nowcastPointLayer.value === null || nowcastPointLayer.value === undefined) {
        return;
      }
      typhoonForecasts.value = {};
      typhoonNowcastPolyline.value = {};

      nowcastPointLayer.value.clearLayers();

      for (const i in currentTyphoons.value) {
        const typhoonPoints = currentTyphoons.value[i].points;
        typhoonPoints.forEach((point, index) => {
          if (!Object.keys(typhoonNowcastPolyline.value).includes(i)) {
            typhoonNowcastPolyline.value[i] = [];
          }
          typhoonNowcastPolyline.value[i].push(new LatLng(parseFloat(point.latitude), parseFloat(point.longitude)));

          const isCurrent = index === typhoonPoints.length - (currentTyphoonIndex.value + 1);
          let pointLayer;
          if (isCurrent) {
            const icon = new DivIcon({
              iconAnchor: [20, 20],
              html: `<div class="dot">
            <div class="ring"></div>
            <div class="icon" style="background: ${getFillColor(point.strength)}"></div></div>`,
              className: 'attention-icon',
            });
            pointLayer = new Marker([parseFloat(point.latitude), parseFloat(point.longitude)], {
              icon: icon,
              pane: 'tooltipPane'
            });
          } else {
            pointLayer = new CircleMarker([parseFloat(point.latitude), parseFloat(point.longitude)], {
              radius: 6,
              fillColor: getFillColor(point.strength),
              stroke: true,
              weight: 2,
              color: '#353433',
              fillOpacity: 1,
              pane: 'markerPane'
            })
          }
          nowcastPointLayer.value?.addLayer(pointLayer);
          if (index === 0) {
            // First point
            pointLayer.bindTooltip(`${i}${currentTyphoons.value[i].name}`, {
              direction: 'right',
              permanent: true,
              opacity: 1,
              offset: [10, 0]
            })
          } else if (isCurrent) {
            // Last point
            typhoonForecasts.value[i] = point;
          }
        })
      }
    }

    const typhoonForecastsPolyline: Ref<{ [id: string]: { [forecastName: string]: LatLng[] } }> = ref({});

    function drawForecastPoints() {
      if (map.value === null || map.value === undefined ||
        forecastPointsLayer.value === null || forecastPointsLayer.value === undefined) {
        return;
      }

      typhoonForecastsPolyline.value = {};
      forecastPointsLayer.value.clearLayers();

      if (Object.keys(typhoonForecasts.value).length === 0) {
        return;
      }

      for (const i in typhoonForecasts.value) {
        const content = typhoonForecasts.value[i];
        if (!Object.keys(typhoonForecastsPolyline).includes(i)) {
          typhoonForecastsPolyline.value[i] = {};
        }
        content.forecast.forEach((forecast) => {
          if (enableForecastOrigin.value.includes(forecast.origin)) {
            if (!Object.keys(typhoonForecastsPolyline.value[i]).includes(forecast.origin)) {
              typhoonForecastsPolyline.value[i][forecast.origin] = [];
            }
            forecast.forecast_points.forEach(point => {
              const pointLayer = new CircleMarker([parseFloat(point.latitude), parseFloat(point.longitude)], {
                radius: 6,
                fillColor: getFillColor(point.strength),
                stroke: true,
                weight: 2,
                color: '#353433',
                fillOpacity: 1,
                pane: 'markerPane'
              })
              forecastPointsLayer.value?.addLayer(pointLayer);
              typhoonForecastsPolyline.value[i][forecast.origin].push(
                new LatLng(parseFloat(point.latitude), parseFloat(point.longitude))
              )
            })
          }
        });
      }
    }

    // Lines
    const nowcastLineLayer: Ref<Nullable<FeatureGroup>> = ref();
    const forecastLineLayer: Ref<Nullable<FeatureGroup>> = ref();

    function drawNowcastLine() {
      if (map.value === null || map.value === undefined ||
        nowcastLineLayer.value === null || nowcastLineLayer.value === undefined) {
        return;
      }
      nowcastLineLayer.value.clearLayers();
      for (const i in typhoonNowcastPolyline.value) {
        const polyline = typhoonNowcastPolyline.value[i]
        if (polyline.length === 0) {
          return;
        }
        new Polyline(polyline, {
          color: 'white'
        }).addTo(nowcastLineLayer.value)
      }
    }

    function drawForecastLine() {
      if (map.value === null || map.value === undefined ||
        forecastLineLayer.value === null || forecastLineLayer.value === undefined) {
        return;
      }
      forecastLineLayer.value.clearLayers();
      for (const i in typhoonForecastsPolyline.value) {
        for (const j in typhoonForecastsPolyline.value[i]) {
          const polyline = typhoonForecastsPolyline.value[i][j];
          if (polyline.length === 0) {
            return;
          }
          new Polyline(polyline, {
            color: getForecastLineColor(j),
            dashArray: '5'
          }).addTo(forecastLineLayer.value)
        }
      }
    }

    // Strength Circle
    // Circle shape:
    //    1      |      2
    //    3      |      4

    // Data shape
    // 2 | 4 | 1 | 3
    const strengthCircleLayer: Ref<Nullable<FeatureGroup>> = ref();

    function drawStrength(circleString: string, latLng: LatLngExpression, strength: number) {
      const circles = circleString.split('|');
      if (circles.length < 4) {
        return;
      }
      let color = 'white', opacity = 0.1;
      if (strength === 7) {
        color = '#fff500';
        opacity = 0.5
      } else if (strength === 10) {
        color = '#ff4600';
        opacity = 0.7
      } else if (strength === 12) {
        color = '#b40068';
        opacity = 0.8
      } else {
        sdk.showNotification('negative', 'Failed to draw typhoon circle: Color unknown');
        return;
      }
      circles.forEach((radius, i) => {
        let index = i;
        if (i === 2) {
          index++;
        } else if (i === 3) {
          index--;
        }

        const circle = new Semicircle(latLng, {
          radius: parseInt(radius) * 1000,
          startAngle: index * 90,
          stopAngle: (index + 1) * 90,
          fillColor: color,
          fillOpacity: opacity,
          stroke: false
        });
        strengthCircleLayer.value?.addLayer(circle);
      })
    }

    function drawStrengthCircle() {
      if (map.value === null || map.value === undefined ||
        strengthCircleLayer.value === null || strengthCircleLayer.value === undefined) {
        return;
      }
      strengthCircleLayer.value.clearLayers();
      for (const i in currentTyphoons.value) {
        const currentTyphoonPoint = currentTyphoons.value[i].points[
        currentTyphoons.value[i].points.length - (currentTyphoonIndex.value + 1)
          ];
        drawStrength(
          currentTyphoonPoint.r7,
          [parseFloat(currentTyphoonPoint.latitude), parseFloat(currentTyphoonPoint.longitude)],
          7
        );
        drawStrength(
          currentTyphoonPoint.r10,
          [parseFloat(currentTyphoonPoint.latitude), parseFloat(currentTyphoonPoint.longitude)],
          10
        );
        drawStrength(
          currentTyphoonPoint.r12,
          [parseFloat(currentTyphoonPoint.latitude), parseFloat(currentTyphoonPoint.longitude)],
          12
        );
      }
    }

    // Attention Line
    function addAttentionLine() {
      if (map.value === null || map.value === undefined) {
        return;
      }
      const HOUR_24_ATTENTION_LINE = [
        new LatLng(34, 127),
        new LatLng(22, 127),
        new LatLng(15, 110)
      ];
      const HOUR_48_ATTENTION_LINE = [
        new LatLng(34, 132),
        new LatLng(22, 132),
        new LatLng(15, 125),
        new LatLng(15, 110)
      ];
      new Polyline(HOUR_24_ATTENTION_LINE, {color: 'yellow', weight: 1}).addTo(map.value);
      new Polyline(HOUR_48_ATTENTION_LINE, {color: 'lightblue', weight: 1}).addTo(map.value);
      let attention24HourIcon = new DivIcon({
        iconAnchor: [5, -50],
        html: '<span style=\'color: yellow\'>24<br>小<br>时<br>警<br>戒<br>线</span>',
        iconSize: [30, 30],
        className: 'attention-icon',
      });
      let attention48HourIcon = new DivIcon({
        iconAnchor: [5, -100],
        html: '<span style=\'color: lightblue\'>48<br>小<br>时<br>警<br>戒<br>线</span>',
        iconSize: [30, 30],
        className: 'attention-icon',
      });
      new Marker(HOUR_24_ATTENTION_LINE[0], {
        icon: attention24HourIcon
      }).addTo(map.value);
      new Marker(HOUR_48_ATTENTION_LINE[0], {
        icon: attention48HourIcon
      }).addTo(map.value);
    }

    // Bounds
    function fitBounds() {
      if (map.value === null || map.value === undefined) {
        return;
      }

      let boundsBase = nowcastPointLayer.value?.getBounds();
      const forecastPointBounds = forecastPointsLayer.value?.getBounds();
      const nowcastLineBounds = nowcastLineLayer.value?.getBounds();
      const forecastLineBounds = forecastLineLayer.value?.getBounds();
      const strengthCircleBounds = strengthCircleLayer.value?.getBounds();

      if (boundsBase?.isValid()) {
        if (forecastPointBounds?.isValid()) {
          boundsBase.extend(forecastPointBounds);
        }
        if (nowcastLineBounds?.isValid()) {
          boundsBase.extend(nowcastLineBounds);
        }
        if (forecastLineBounds?.isValid()) {
          boundsBase.extend(forecastLineBounds);
        }
        if (strengthCircleBounds?.isValid()) {
          boundsBase.extend(strengthCircleBounds);
        }
        boundsBase = boundsBase?.pad(-0.15)
        map.value.fitBounds(boundsBase)
      }
    }

    function redrawTyphoon() {
      // drawNowcastPoints() shall always be the first, since other parsing depends on points.
      drawNowcastPoints()
      drawForecastPoints()

      drawNowcastLine()
      drawForecastLine()

      drawLandPoint()
      drawStrengthCircle()

      fitBounds()
    }

    // Hooks
    watch(currentTyphoons, () => {
      redrawTyphoon()
    })

    watch(enableForecastOrigin, () => {
      redrawTyphoon()
    })

    watch(currentTyphoonIndex, () => {
      redrawTyphoon()
    })

    onMounted(() => {
      map.value = new Map('map', {
        center: [31.59, 120.29],
        zoom: 5,
        zoomSnap: 0.01,
        zoomDelta: 0.5
      });
      // TODO: Replace in future
      new TileLayer('///p1.map.gtimg.com/demTiles/{z}/1{x}/1{y}/{x}_{-y}.jpg')
        .addTo(map.value)

      forecastPointsLayer.value = new FeatureGroup().addTo(map.value);
      nowcastPointLayer.value = new FeatureGroup().addTo(map.value);
      forecastLineLayer.value = new FeatureGroup().addTo(map.value);
      nowcastLineLayer.value = new FeatureGroup().addTo(map.value);
      landInfoLayer.value = new FeatureGroup().addTo(map.value);
      strengthCircleLayer.value = new FeatureGroup().addTo(map.value);

      typhoonDetail.value?.addToMap(map.value);
      addAttentionLine();
    });

    return {
      map,
      typhoonDetail
    };
  }
});
</script>

<!--suppress CssNonIntegerLengthInPixels -->
<style>
#map {
  width: 100%;
  z-index: 1;
}

.attention-icon {
  width: 0;
  height: 0;
  border: none;
  background: none;
}

.dot {
  width: 40px;
  height: 40px;
  pointer-events: none;
  animation: linear infinite storm;
}

.ring {
  position: absolute;
  left: 10px;
  top: 10px;
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 0 6px rgb(0 0 0 / 33%);
}

@keyframes storm-dot {
  100% {
    transform: translate(12.5px, 12.5px) scale(.875);
  }
}

@keyframes storm {
  100% {
    transform: rotate(-360deg);
  }
}

.icon {
  position: absolute;
  left: 0;
  top: 0;
  width: 15px;
  height: 15px;
  border-radius: 7.5px;
  transform: translate(12.5px, 12.5px);
  animation: 1s ease-in-out infinite alternate-reverse storm-dot;
}

.land-icon {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-radius: 0;
  transform: translate(12.5px, 13.5px);
}
</style>
