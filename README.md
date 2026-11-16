# FSC – Ship Ledger

Shipment, ledger and clearance workspace for FSC (TanStack Start, React, Redux Toolkit / RTK Query).

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev
```

## Backend API

The API base URL is set in one place, `src/config/api.ts`, from `VITE_API_BASE_URL`:

- `.env.development` is used by `npm run dev`
- `.env.production` is used by `npm run build`

## Scripts

- `npm run build` – production build
- `npm test` – unit tests
- `npm run lint` – lint
