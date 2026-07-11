import {defineConfig} from '#q-app';
import {readFileSync} from 'node:fs';

const {version} = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

const logo = Buffer.from(
  'JWMgICBfX19fX18gICAgICAgX18gICAgIF9fX19fCiAgLyBfX18vIHwgICAgIC8gL19fXyAvIF9fXy8KICBcX18gXHwgfCAvfCAvIC8gX18gXFxfXyBcIAogX19fLyAvfCB8LyB8LyAvIC9fLyAvX18vIC8gCi9fX19fLyB8X18vfF9fL1xfX19fL19fX18vICA=',
  'base64'
).toString();

export default defineConfig((ctx) => {
  const environment =
    process.env.NODE_ENV ?? (ctx.dev ? 'development' : 'production');
  const apiUrl =
    process.env.API_URL ??
    (ctx.dev ? 'http://10.0.0.50:8000' : 'https://api.daziannetwork.com');
  const cdnUrl =
    process.env.CDN_URL ??
    (ctx.dev
      ? 'http://10.0.0.50:8000'
      : 'https://cdn.swos.daziannetwork.com');

  return {
    boot: [],
    css: ['app.scss'],
    extras: ['fontawesome-v7', 'roboto-font', 'material-icons'],
    build: {
      target: {
        browser: ['es2022', 'edge120', 'firefox120', 'chrome120', 'safari16'],
        node: 'node24',
      },
      vueRouterMode: 'hash',
      vueOptionsAPI: true,
      alias: {
        src: ctx.appPaths.srcDir,
        app: ctx.appPaths.appDir,
        components: ctx.appPaths.resolve.src('components'),
        layouts: ctx.appPaths.resolve.src('layouts'),
        pages: ctx.appPaths.resolve.src('pages'),
        assets: ctx.appPaths.resolve.src('assets'),
        boot: ctx.appPaths.resolve.src('boot'),
        stores: ctx.appPaths.resolve.src('stores'),
      },
      define: {
        ENVIRONMENT: JSON.stringify(environment),
        VERSION: JSON.stringify(version),
        LOGO: JSON.stringify(logo),
        API_URL: JSON.stringify(apiUrl),
        CDN_URL: JSON.stringify(cdnUrl),
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
      injectPWAMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      useCredentialsForManifestTag: false,
    },
  };
});
