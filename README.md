# {{project_name}} UI

[![Coverage Status](https://coveralls.io/repos/github/{org-name}/{repo-name}/badge.svg?branch=main)](https://coveralls.io/github/{org-name}/{repo-name}?branch=main)

<!-- A brief description of the purpose of this UI -->

This UI displays A and B using the external services X and Y.

## Table of Contents

- [Features](#features)
- [Dependencies & Related Services](#dependencies--related-services)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the UI](#running-the-ui)
- [Testing](#testing)

<!-- List of features the server has -->

- **Feature 1**: Provides Y functionality to the users.

## Dependencies & Related Services

<!-- List any services this server depends on or interacts with -->

This service interacts with the following services:

- **[Service Name 1](link-to-service-repo)**: Description of interaction
- **[Service Name 2](link-to-service-repo)**: Description of interaction

## Getting Started

### Prerequisites

Before running this service, ensure you have the following installed:

- **Node.js**: Version 22.x or higher (LTS recommended)
- **Yarn**: Version 1.22.x or higher

<!-- List any other dependencies that are required to run the UI -->

### Installation

1. Clone the repository:

```bash
git clone https://github.com/{org-name}/{repo-name}.git
cd {repo-name}
```

2. Install dependencies:

```bash
npm install
```

### Configuration

The UI uses the `@dcl/ui-env` module to configure the environment in which it the UI will run.

All of these different configurations are located under the `/src/config/env` directory, where a `json` file can be found for each environment.
This package automatically loads the environment file for each site in production (zone, today, org) and can be configured to run on a different
environment while live by using the `?env=` query parameter with the desired environment, i.e: `?env=prod`.

In order to configure the starting environment of the site in the development mode, copy the create a new `.env` file based on the `.default.env`.
The `.default.env` also contains other variables that are usually modified at build time.

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

Tests are written in files named along the file they're testing, but with a different extension.

```bash

```

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).

---
