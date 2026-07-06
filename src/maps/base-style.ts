import type { Map, RasterLayerSpecification, StyleSpecification } from 'maplibre-gl';

const darkRasterPaint: RasterLayerSpecification['paint'] = {
  'raster-saturation': -0.72,
  'raster-contrast': 0.28,
  'raster-brightness-min': 0,
  'raster-brightness-max': 0.46,
};

const lightRasterPaint: RasterLayerSpecification['paint'] = {
  'raster-saturation': 0,
  'raster-contrast': 0,
  'raster-brightness-min': 0,
  'raster-brightness-max': 1,
};

export function createBaseMapStyle(dark = false): StyleSpecification {
  return {
    version: 8,
    sources: {
      'base-raster': {
        type: 'raster',
        tiles: [
          'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
          'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
          'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
          'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        ],
        tileSize: 256,
        attribution: 'Map source: 高德地图',
      },
    },
    layers: [
      {
        id: 'base-map',
        type: 'raster',
        source: 'base-raster',
        paint: dark ? darkRasterPaint : lightRasterPaint,
      },
    ],
  };
}

export function applyBaseMapTheme(map: Map | undefined, dark: boolean) {
  if (!map?.getLayer('base-map')) return;
  const paint = dark ? darkRasterPaint : lightRasterPaint;
  Object.entries(paint).forEach(([property, value]) =>
    map.setPaintProperty('base-map', property, value)
  );
  map.getCanvas().style.backgroundColor = dark ? '#07111f' : '#e8eef4';
}
