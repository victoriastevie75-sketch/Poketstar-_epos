# Poketstar EPOS

Poket Star EPOS is an enterprise POS system for retail businesses in East Africa. The app is designed for local desktop use with browser-based POS workflows and a packaged Windows distribution for quick deployment.

## Features

- Offline-first local POS workflow
- Inventory, sales, users, and payments data management
- Desktop launcher for local Windows use
- Portable Windows ZIP package for distribution
- Downloadable desktop executable builds from GitHub releases

## Run locally

```bash
npm install
npm start
```

Then open:

- http://localhost:3000

## Launch desktop mode

```bash
npm run desktop
```

## Create a desktop release

```bash
npm run release:desktop
```

This builds the desktop executable bundle and places the generated release files in the `dist/` folder.

## GitHub release workflow

The repository contains a GitHub Actions workflow that publishes desktop packages automatically when a tagged release is created.

- `dist/PoketStar-POS.exe`
- `dist/PoketStar-POS-Portable.zip`
- `dist/PoketStar-POS-32bit.exe`
- `dist/PoketStar-POS-64bit.exe`

## Notes

- The desktop launcher is meant for Windows environments.
- If Windows SmartScreen blocks execution, choose More info > Run anyway.
- Keep the executable and support files together when distributing the portable build.
