# Pi Gateway

Web gateway for Pi Coding Agent, providing a beautiful AI chat interface and file management functionality.

**Tech Stack**: React 19 + TypeScript + Vite (Frontend) | Node.js + Express + TypeScript (Backend)

## Quick Start

```bash
# Clone and install
git clone https://github.com/3280382/pi-gateway-standalone.git
cd pi-gateway-standalone
npm install

# Start development - see AGENTS.md for detailed environment setup
bash scripts/start-tmux-dev.sh
```

> **Note**: For detailed development environment setup, auto-reload configuration, and troubleshooting, see [AGENTS.md](./AGENTS.md).

## Project Structure

```
src/
├── client/features/     # Frontend features (chat/, files/)
├── server/features/    # Backend features (chat/)
└── shared/             # Shared types only
```

## Documentation

| Document | Audience | Purpose |
|---------|---------|---------|
| [`AGENTS.md`](./AGENTS.md) | **AI Assistants** | **Primary reference - read this first** |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Developers | Development guide, architecture, coding standards |
| [`FEATURES.md`](./FEATURES.md) | Developers/PM | Feature specification, UI/UX guidelines |
| [`CHANGELOG.md`](./CHANGELOG.md) | Everyone | Version history |

## Common Commands

```bash
npm run dev              # Start dev server
npm run check            # Code check (Biome + TypeScript)
npm run build            # Production build
npm test                 # Run tests
```

## Browser Support

Chrome/Edge 90+, Firefox 90+, Safari 15+

## License

MIT
