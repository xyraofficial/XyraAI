# DevSpace IDE - Web-Based Development Environment

## Overview

DevSpace IDE is a web-based integrated development environment with AI assistance, inspired by Replit and CodeSandbox. It provides a complete coding environment with file management, code editing, terminal access, package management, and AI-powered chat assistance through OpenRouter.

The application follows a monorepo structure with a React frontend and Express backend, using PostgreSQL for data persistence and real-time terminal command execution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **API Pattern**: RESTful endpoints under `/api/*`
- **File Operations**: Direct filesystem access in workspace directory
- **Command Execution**: Child process spawning for terminal commands

### IDE Components
The frontend implements a split-panel IDE layout with resizable sections:
- **File Tree Sidebar**: Hierarchical file browser with CRUD operations
- **Code Editor**: Multi-tab editor with syntax highlighting
- **Terminal Panel**: Real shell access with command history
- **AI Chat Panel**: OpenRouter-powered AI assistant with model selection
- **Package Manager**: npm package search, install, and management

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Managed via `drizzle-kit push`
- **Current Tables**: Users table with UUID primary keys

### Design System
The project follows specific design guidelines:
- Dark slate color palette with purple accents
- Monospace fonts (JetBrains Mono/Fira Code) for code areas
- Roboto for UI elements
- 12px base spacing unit

## External Dependencies

### AI Integration
- **OpenRouter API**: AI chat functionality via `OPENROUTER_API_KEY` environment variable
- **Supported Models**: Claude 3.5 Sonnet, GPT-4 Turbo, Gemini Pro, Llama 3 70B

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Session Store**: connect-pg-simple for Express sessions

### Key Libraries
- **UI**: Radix UI primitives, Lucide icons, react-resizable-panels
- **Forms**: React Hook Form with Zod validation
- **Data**: Drizzle ORM, TanStack Query
- **Utilities**: date-fns, clsx, tailwind-merge