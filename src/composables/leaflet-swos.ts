import L, {ImageOverlayOptions, LatLngBoundsExpression} from 'leaflet';

export class SWoSImageOverlay extends L.ImageOverlay {
  constructor(imageUrl: string, bounds: LatLngBoundsExpression, options?: ImageOverlayOptions) {
    super(imageUrl, bounds, options);
  }

  _initImage() {

  }
}
