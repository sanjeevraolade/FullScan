# FullScanFieldApp

Enterprise field verification application — Field Executives physically verify candidates at their location with tamper-proof GPS, camera, and biometric evidence.

## Quick Start

### Prerequisites
- Node.js 18+
- React Native CLI (`npx react-native`)
- Xcode 15+ (iOS) / Android Studio (Android)
- CocoaPods (`gem install cocoapods`)

### Mobile
```bash
cd mobile
npm install
cd ios && pod install && cd ..
npx react-native run-ios       # iOS
npx react-native run-android   # Android
```

### Server
```bash
cd server
npm install
cp .env.example .env           # Configure environment
npm run dev                     # Start with hot reload (http://localhost:3000)
```

### Testing
```bash
cd mobile && npm test           # Jest unit tests
cd server && npm test           # Vitest unit + integration tests
```

## Project Structure

```
FullScanFieldApp/
├── mobile/                     # React Native app
│   └── src/
│       ├── components/         # Reusable UI components
│       ├── screens/            # Screen components
│       ├── navigation/         # React Navigation setup
│       ├── services/           # API client, location, camera, sync
│       ├── hooks/              # Custom hooks
│       ├── store/              # Global state (Zustand)
│       ├── db/                 # SQLite local database
│       ├── utils/              # Helpers
│       └── types/              # TypeScript interfaces
├── server/                     # Node.js + Express API
│   └── src/
│       ├── routes/             # Express routers
│       ├── controllers/        # Request handlers
│       ├── services/           # Business logic
│       ├── middleware/         # Auth, validation, uploads
│       ├── db/                 # SQLite + migrations
│       ├── utils/              # Helpers
│       └── types/              # TypeScript interfaces
├── docs/                       # Documentation
└── .github/                    # Copilot agents, instructions, prompts
```

## Documentation

- [Architecture](docs/Architecture.md) — system design and data flow
- [Technology Stack](docs/TechnologyStack.md) — libraries and rationale
- [API Reference](docs/API.md) — REST endpoints
- [Security Model](docs/SecurityModel.md) — evidence integrity and auth
- [SRS](docs/SRS.md) — software requirements
- [SAD](docs/SAD.md) — software architecture document

## Environment Variables

### Server (`.env`)
```
PORT=3000
JWT_SECRET=<your-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>
DB_PATH=./data/fullscan.sqlite
UPLOAD_DIR=./uploads
GEO_FENCE_RADIUS_METERS=200
```

## License

Private — All rights reserved.
