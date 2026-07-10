import type {
  Map,
  RasterLayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

const BASE_MAP_LAYER_ID = 'base-map';
const pendingThemes = new WeakMap<Map, boolean>();

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
    glyphs: './{fontstack}/{range}.pbf',
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
        id: BASE_MAP_LAYER_ID,
        type: 'raster',
        source: 'base-raster',
        paint: dark ? darkRasterPaint : lightRasterPaint,
      },
    ],
  };
}

export function applyBaseMapTheme(map: Map | undefined, dark: boolean) {
  if (!map) return;
  pendingThemes.set(map, dark);

  const applyTheme = () => {
    const nextDark = pendingThemes.get(map) ?? dark;
    if (!map.getLayer(BASE_MAP_LAYER_ID)) {
      map.once('styledata', applyTheme);
      return;
    }
    const paint = nextDark ? darkRasterPaint : lightRasterPaint;
    Object.entries(paint).forEach(([property, value]) =>
      map.setPaintProperty(BASE_MAP_LAYER_ID, property, value)
    );
    map.getCanvas().style.backgroundColor = nextDark ? '#07111f' : '#e8eef4';
  };

  applyTheme();
}
