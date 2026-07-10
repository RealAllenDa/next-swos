import {defineConfig} from '#q-app/wrappers';
import {readFileSync} from 'node:fs';

const {version} = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

const logo = Buffer.from(
  'JWMgICBfX19fX18gICAgICAgX18gICAgIF9fX19fCiAgLyBfX18vIHwgICAgIC8gL19fXyAvIF9fXy8KICBcX18gXHwgfCAvfCAvIC8gX18gXFxfXyBcIAogX19fLyAvfCB8LyB8LyAvIC9fLyAvX18vIC8gCi9fX19fLyB8X18vfF9fL1xfX19fL19fX18vICA=',
  'base64'
).toString();

export default defineConfig(() => ({
  boot: [],
  css: ['app.scss'],
  extras: ['fontawesome-v6', 'roboto-font', 'material-icons'],
  build: {
    target: {
      browser: ['es2022', 'edge120', 'firefox120', 'chrome120', 'safari16'],
      node: 'node24',
    },
    vueRouterMode: 'hash',
    rawDefine: {
      ENVIRONMENT: JSON.stringify(process.env.NODE_ENV),
      VERSION: JSON.stringify(version),
      LOGO: JSON.stringify(logo),
      API_URL: JSON.stringify(
        process.env.API_URL ??
        (process.env.NODE_ENV === 'development'
          ? 'http://10.0.0.50:8000'
          : 'https://api.daziannetwork.com')
      ),
      CDN_URL: JSON.stringify(
        process.env.CDN_URL ??
        (process.env.NODE_ENV === 'development'
          ? 'http://10.0.0.50:8000'
          : 'https://cdn.swos.daziannetwork.com')
      ),
      DB_API_URL: JSON.stringify(
        process.env.DB_API_URL ?? 'https://db.api.daziannetwork.com'
      ),
    },
  },
  devServer: {open: true},
  framework: {
    config: {},
    plugins: ['Notify'],
  },
  animations: [],
  ssr: {
    pwa: false,
    prodPort: 3000,
    middlewares: ['render'],
  },
  pwa: {
    workboxMode: 'GenerateSW',
    injectPwaMetaTags: true,
    swFilename: 'sw.js',
    manifestFilename: 'manifest.json',
    useCredentialsForManifestTag: false,
  },
}));
