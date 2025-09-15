# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CSV Light Editor is a high-performance CSV editing application for Mac, built with Tauri (Rust backend) and React (TypeScript frontend). The project aims to handle CSV files with 1M+ rows efficiently using streaming and virtual scrolling techniques.

## Commands

### Development
```bash
cd app
pnpm install        # Install dependencies
pnpm tauri dev      # Run development server with hot reload
```

### Build
```bash
cd app
pnpm build          # Build frontend (TypeScript check + Vite build)
pnpm tauri build    # Build release version of the app
```

### Testing
```bash
cd app/src-tauri
cargo test          # Run Rust backend tests
cargo clippy        # Run Rust linter
cargo fmt           # Format Rust code
```

## Architecture

### Directory Structure
- `/app` - Main application directory
  - `/src` - React frontend source (TypeScript)
  - `/src-tauri` - Rust backend source (Tauri)
    - `/src/main.rs` - Entry point for Tauri application
    - `/Cargo.toml` - Rust dependencies
    - `/tauri.conf.json` - Tauri configuration
  - `/dist` - Frontend build output
  - `package.json` - Frontend dependencies and scripts
  - `vite.config.ts` - Vite bundler configuration

- `/docs` - Comprehensive project documentation
  - `requirements.md` - Functional and non-functional requirements
  - `implementation-tasks.md` - 12-week development roadmap with detailed tasks
  - `technical-architecture.md` - System design and component architecture

### Key Design Patterns

1. **IPC Communication**: Frontend communicates with Rust backend via Tauri's command system
2. **Streaming Processing**: Large CSV files are processed in chunks to maintain performance
3. **Virtual Scrolling**: UI renders only visible rows for efficient memory usage
4. **Metadata Sidecar**: CSV metadata stored in `.csvmeta` files alongside CSV files

### Technology Stack
- **Backend**: Rust with Tauri v1, using `csv`, `polars`, and `candle` crates
- **Frontend**: React 19 with TypeScript, Vite bundler
- **UI Components**: shadcn/ui (built on Radix UI primitives), TanStack Virtual for virtualization
- **Styling**: Tailwind CSS with design system tokens
- **State Management**: Zustand for frontend state
- **AI Features**: Candle for local inference (planned)

## UI Development Guidelines

### Component Standards
- **Use shadcn/ui components**: All new UI components should use shadcn/ui for consistency
- **Existing components**: Button, Dialog, Select, Label, Checkbox are available
- **Custom components**: Follow shadcn/ui patterns when creating new components
- **Styling**: Use Tailwind CSS classes with design system tokens (e.g., `bg-background`, `text-foreground`)

### Component Development
- Add new shadcn/ui components to `/src/components/ui/` as needed
- Maintain consistent import patterns using `@/components/ui/component-name`
- Follow shadcn/ui documentation for component APIs and styling

## Tauri Configuration Notes

- **CSP**: Currently disabled (`null`) in development
- **Allowed APIs**: Only `shell.open` is enabled for security
- **Dev Server**: Runs on `http://localhost:1420`
- **Bundle ID**: `io.hosshan.csv-light-editor`