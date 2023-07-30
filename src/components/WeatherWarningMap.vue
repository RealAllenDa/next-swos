<template>
  <div id="map">
    <MapControl ref="legend" position="bottomright">
      <div class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm" style="background: white; border: 2px solid black;">
        <WeatherWarningLegend></WeatherWarningLegend>
      </div>
    </MapControl>
    <MapControl ref="detail" position="topright">
      <div class="q-pr-sm q-pl-sm q-pt-sm q-pb-sm" style="background: white; border: 2px solid black;">
        <WeatherWarningDetail></WeatherWarningDetail>
      </div>
    </MapControl>
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, onMounted, ref, Ref, toRaw, watch} from 'vue';
import {GeoJSON, Layer, LeafletMouseEvent, Map, TileLayer} from 'leaflet';
import {useLeafletMapStore} from 'stores/map';
import 'leaflet/dist/leaflet.css';
import sdk from 'src/composables/sdk';
import {Feature, GeoJsonObject} from 'geojson';
import {useWeatherWarningStore} from 'stores/weather-warning';
import MapControl from 'components/MapControl.vue';
import WeatherWarningLegend from 'components/WeatherWarningLegend.vue';
import WeatherWarningDetail from 'components/WeatherWarningDetail.vue';

export default defineComponent({
  name: 'WeatherWarningMap',
  components: {WeatherWarningDetail, WeatherWarningLegend, MapControl},
  setup() {
    const mapStore = useLeafletMapStore();
    const weatherWarningStore = useWeatherWarningStore();
    let map: Nullable<Map> = null;
    const legend: Ref<typeof MapControl | null> = ref(null);
    const detail: Ref<typeof MapControl | null> = ref(null);

    const warningLayer: Ref<Nullable<GeoJSON>> = ref();
    const weatherWarningList = computed(() => {
      return weatherWarningStore.currentWarningList
    });
    const centralDistricts = ['黄浦区', '徐汇区', '长宁区', '静安区',
      '普陀区', '闸北区', '虹口区', '杨浦区'];
    const defaultStyle = {
      fillColor: 'white',
      color: '#7F7F7F',
      weight: 1,
      fillOpacity: 1
    }
    const parseLevel = weatherWarningStore.parseLevel;

    const {data} = sdk.useFetch<GeoJsonObject>('https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=310000_full', true)
    watch(data, () => {
      if (data.value === undefined || data.value === null ||
        map === undefined || map === null ||
        warningLayer.value === undefined || warningLayer.value === null) {
        return;
      }
      warningLayer.value.addData(data.value)
    })

    function getStyle(feature: Feature | undefined) {
      if (feature === undefined) {
        return defaultStyle;
      }
      let color = '#c8c8cb'
      let districtName = feature.properties?.name
      if (centralDistricts.includes(feature.properties?.name)) {
        districtName = '上海市'
      }
      switch (weatherWarningList.value.coloring[districtName]) {
        case 0:
          color = '#c8c8cb'
          break
        case 1:
          color = '#41A0F8'
          break
        case 2:
          color = '#F3E843'
          break
        case 3:
          color = '#F8A931'
          break
        case 4:
          color = '#F74E3B'
          break
      }
      if (feature.properties?.parent.adcode === 310000) {
        // Is Shanghai
        return {
          fillColor: color,
          color: 'black',
          weight: 1,
          fillOpacity: 1
        }
      } else {
        return defaultStyle
      }
    }


    function clickedOnLayer(e: LeafletMouseEvent) {
      let districtName = e.target.feature.properties.name;
      if (centralDistricts.includes(districtName)) {
        districtName = '上海市'
      }
      weatherWarningStore.currentSelectedDistrict = districtName;
    }

    function getLayerHoverData(feature: Feature) {
      // It's a very ugly function - :<
      // I couldn't figure out another way to do that.
      // (Of course, without instantiating another Vue instance,
      // use some interesting component hack to make it display
      // content of a component.)
      let districtName;
      if (centralDistricts.includes(feature.properties?.name)) {
        districtName = '上海市'
      } else {
        districtName = feature.properties?.name;
      }

      const warnings: string[] = [];
      if (Object.keys(weatherWarningList.value.districts).includes(districtName)) {
        const weatherWarning = weatherWarningList.value.districts[districtName];
        weatherWarning.forEach(warning => {
          warnings.push(`
            <div class="q-mt-xs text-center text-subtitle1 warning-${warning.level} warning-wrapper q-pl-xs q-pr-xs">
                ${warning.type}${parseLevel(warning.level)}预警
            </div>`
          )
        })
      } else {
        warnings.push(`
            <div class="text-center text-subtitle1 warning-0 warning-wrapper q-pl-xs q-pr-xs">
               无预警
            </div>`
        )
      }
      return `<div class="text-h6 text-center">${districtName}</div>${warnings.join('')}`
    }

    function onEachFeature(feature: Feature, layer: Layer) {
      if (map === undefined || map === null) {
        return;
      }
      layer.on({
        click: clickedOnLayer
      })
      // Make sure that .addTo(map) is added!
      layer.bindTooltip(getLayerHoverData(feature), {
        sticky: true,
        direction: 'top'
      }).addTo(map);
    }

    onMounted(() => {
      map = new Map('map', mapStore.options);
      // TODO: Replace in future
      new TileLayer('http://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetPurplishBlue/MapServer/tile/{z}/{y}/{x}')
        .addTo(map)
      warningLayer.value = new GeoJSON(undefined, {
        style: getStyle,
        onEachFeature: onEachFeature
      }).addTo(toRaw(map))

      legend.value?.addToMap(map);
      detail.value?.addToMap(map);
    });

    return {
      map,
      legend,
      detail
    };
  }
})
</script>

<style>
#map {
  width: 100%;
  z-index: 1;
}
</style>
