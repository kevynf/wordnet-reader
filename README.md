# Wordnet Reader

A readability-focused, offline-friendly dictionary browser for
[Open English Wordnet](https://github.com/globalwordnet/english-wordnet).

Wordnet Reader presents definitions, examples, pronunciations, and lexical relations in a compact dark interface. It
runs entirely in the browser, requires no account or backend, and can cache the complete dictionary for offline use.

## Features

- Exact lookup with normalized prefix suggestions
- Definitions, examples, pronunciations, synonyms, and semantic relations
- Part-of-speech views with consistent headword-level metadata
- Local history and favorites stored on the current device
- Installable PWA with on-demand caching and an optional full offline download
- Static deployment with no server-side application or database

## Quick start

Requirements: Node.js 20 or later and pnpm 11.22.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server uses the four-word demo dataset committed under `public/data/demo/`. Open the URL printed by
Vite to work on the interface without downloading the full dictionary.

## Full dictionary

The complete 2025 Plus dataset is generated from the upstream Open English Wordnet release:

```sh
pnpm data:fetch
pnpm data:build
pnpm data:verify
```

The source archive checksum is pinned in `scripts/config.mjs`. Set `OEWN_SHA256` only when intentionally moving to a
republished archive. Generated source and dictionary files are excluded from Git; CI rebuilds them before deployment.

## Verification

```sh
pnpm format:check
pnpm test
pnpm data:verify
pnpm build
```

`pnpm build` creates the static production site in `dist/`. Run `pnpm preview` to inspect that build locally.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` installs dependencies from the frozen pnpm lockfile, rebuilds and
verifies the full dictionary, creates the PWA, and deploys `dist/`.

To deploy:

1. Set the repository's Pages source to **GitHub Actions**.
2. Push the `main` branch, or run the **Deploy to GitHub Pages** workflow manually.

The Vite build uses relative asset paths, so it works from a project subpath on GitHub Pages. No deployment secret is
required for the pinned upstream release; `OEWN_SHA256` is an optional repository variable for an intentional checksum
override.

## Data and licensing

Application code is available under the [MIT License](LICENSE). Dictionary data retains its upstream Princeton WordNet
License and Creative Commons Attribution 4.0 terms; see [NOTICE](NOTICE) for attribution and source details.

Wordnet Reader is an independent, unofficial browser and is not endorsed by Princeton University, the Global WordNet
Association, or the Open English Wordnet team.
