# gatsby-plugin-pages-from-json

Creates pages from JSON configuration using Gatsby's `createPages` API.

## Installing

```bash
npm install --dev vanska/gatsby-plugin-pages-from-json vanska/tiny-i18n
```

## Todo

- Remove dependency of tiny-i18n

## JSON configuration

```js
// config/site-config.json
{
  "languages": ["en", "fi"],
  "pages": [
    {
      "name": "home",
      "component": "src/templates/Home.js",
      "namespaces": ["home"],
      "navigation": "hidden"
    },
    {
      "name": "services",
      "component": "src/templates/Services.js",
      "namespaces": ["services"],
      "children": [
        {
          "name": "design",
          "component": "src/templates/Design.js",
          "namespaces": ["design"]
        }
      ]
    },
    {
      "name": "articles",
      "component": "src/templates/Articles.js",
      "namespaces": ["articles"],
      "markdownParent": true
    },
    {
      "name": "404",
      "component": "src/templates/404.js",
      "namespaces": ["404"],
      "navigation": "hidden",
      "metaRobots": "noindex, nofollow"
    }
  ],
  "generateFirebaseHostingRules": true
}
```
