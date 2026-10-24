# notewith.me

Built by Mehmet Firat Aksoy · [mfirataksoy.com](https://mfirataksoy.com)

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

### Run the full app locally
Needs a MongoDB on `mongodb://127.0.0.1:27017` (or set `MONGODB_URI`).
```
npm run build
npm start        # Express serves the API on /api and the built app on :2500
```
For hot reload run `npm start` and `npm run dev` side by side; the dev server proxies `/api` to :2500.

### Deploy (Netlify + MongoDB Atlas)
`netlify.toml` builds the Vue app into `dist` and runs the API as a Netlify Function
(`netlify/functions/api.js`, which wraps `app.js`); `/api/*` is rewritten to it.
Set `MONGODB_URI` (an Atlas connection string) in the site's environment variables.

`npm start` still runs everything as one Express server, e.g. for Railway/Render.
