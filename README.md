# SWoS

Shanghai Weather Observation System, built with Vue 3, Quasar, TypeScript, and MapLibre GL.

## Requirements

- Node.js 20, 22, or 24
- npm 10 or newer

## Development

```bash
npm install
npm run dev
```

The development API defaults to `http://10.0.0.50:8000`. Override either backend without changing source code:

```bash
API_URL=https://api.example.com DB_API_URL=https://db.example.com npm run dev
```

On PowerShell:

```powershell
$env:API_URL='https://api.example.com'
npm run dev
```

## Validation

```bash
npm test
npm run build
npm audit
```

`npm test` runs ESLint and the Vue/TypeScript type checker.

## Navigation

The drawer reads its entries from [`public/assets/page-list.json`](public/assets/page-list.json). This is a local static asset; changing navigation does not require an API deployment.

All map views use MapLibre GL. The migrated observation routes are `/rain/1h`, `/rain/24h`, `/rain/period`, `/wind`, `/inundation`, `/flood/rivers`, `/flood/stations`, and `/warning/flood`; `/generic` provides the migrated warning overview.
