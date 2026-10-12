# Energiebilanz

React-/TypeScript-Anwendung zur Abschätzung von Verbrauch, Akku- und Solarbedarf eines LoRa-Messsystems.

## Lokal ausführen

```shell
npm ci
npm run dev
```

Qualitätsprüfungen:

```shell
npm run lint
npm test
npm run build
```

## GitHub Pages

Der Workflow `.github/workflows/deploy-pages.yml` prüft jeden Push und Pull Request. Nur ein erfolgreicher Lauf auf dem bei GitHub hinterlegten Default-Branch wird veröffentlicht.

Einmalig im GitHub-Repository unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** auswählen. Danach erfolgt das Deployment automatisch.

Der Befehl `npm run build:pages` erzeugt relative Assetpfade, sodass die Anwendung sowohl unter einer Projekt-URL als auch mit einer GitHub-Pages-Unique-Domain funktioniert.