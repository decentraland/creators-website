# Wemotes Builder

Wemotes Builder is the new UI for Decentraland **wearables and emotes creators**. It replaces the front end of the legacy [builder](https://github.com/decentraland/builder) project with a modern interface, better UX, and new creator tools, while continuing to use the existing [builder-server](https://github.com/decentraland/builder-server) back end.

This project follows the same approach as the **shop** project (the modern re-version of the legacy marketplace UI): same tech stack and the same color palette, for visual consistency across the new Decentraland front ends. Feature designs and mockups live in Figma.

## Table of Contents

- [Features](#features)
- [Dependencies & Related Services](#dependencies--related-services)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the UI](#running-the-ui)
- [Testing](#testing)

## Features

<!-- To be expanded as features are implemented -->

- Creation and management of wearable and emote collections for Decentraland creators (replacing the legacy builder front end).

## Dependencies & Related Services

This UI interacts with the following services:

- **[builder-server](https://github.com/decentraland/builder)**: Existing back end for creator collections, items, and publishing — reused as-is by this new front end.

Related projects:

- **[shop](https://github.com/decentraland/shop)**: The modern re-version of the marketplace UI; this project shares its tech stack and visual identity.

## Tech Stack

Vite + React 18 + TypeScript (strict), React Router, @tanstack/react-query (server state), zustand (client state), react-intl (en/es), Emotion + decentraland-ui2 for styling (shop's theme and color palette), Sentry for monitoring, Vitest + Testing Library for unit tests and Puppeteer for e2e. Auth via decentraland-connect + single sign-on, with AuthChain-signed requests to builder-server.

## Getting Started

### Prerequisites

Before running this service, ensure you have the following installed:

- **Node.js**: Version 24.x or higher
- **npm**: Version 8.x or higher

### Installation

1. Clone the repository:

```bash
git clone https://github.com/decentraland/wemotes-builder.git
cd wemotes-builder
```

2. Install dependencies:

```bash
npm install
```

### Configuration

The UI uses the `@dcl/ui-env` module to configure the environment in which it the UI will run.

All of these different configurations are located under the `/src/config/env` directory, where a `json` file can be found for each environment. This package automatically loads the environment file for each site in production (zone, today, org). On `.zone`, `.today` and localhost the `?env=` query parameter switches to another environment while live, i.e: `?env=prod`; production hostnames ignore it, so a link can never point a production visitor at the dev or staging back ends.

In order to configure the starting environment of the site in development mode, create a new `.env` file based on `.env.default`. The `.env.default` file also contains other variables that are usually modified at build time.

### Running the UI

Running the start command will result in the Vite development server to start.

```bash
npm run start
```

## Testing

This UI contains tests that assert the behavior of components, stores and business logic.

### Running tests

Run all tests:

```bash
npm run test
```

Run all tests with coverage:

```bash
npm run test:coverage
```

### Test Structure

Tests are colocated with the file they're testing, using a `.spec.ts` / `.spec.tsx` extension.

---

This repository was bootstrapped from Decentraland's [dapps-template](https://github.com/decentraland/dapps-template).
