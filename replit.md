# DevSpace IDE - AI Agent Development Environment

## Overview

DevSpace IDE is a web-based AI-powered development environment operating in Level-S Autonomous Mode. The AI Agent executes commands, creates/edits files, and runs shell operations immediately without confirmation.

## AI Agent Features (Level-S Mode)

### Autonomous Execution
- **No Confirmations**: Agent executes immediately without asking
- **Auto-Repair**: Automatically fixes errors when possible
- **Multi-step Tasks**: Chains operations seamlessly

### Session Persistence
- Chat history preserved across page refresh
- Settings retained in localStorage
- Mode/model selection persisted

### Chat Management
- **Pin Messages**: Keep important messages visible
- **Clear Chat**: Save to history and start fresh
- **Chat History**: Browse and load past conversations
- **Export**: Download chat logs as JSON

### Tool Capabilities
- Full bash shell (pipes, redirects, chains)
- File CRUD (create, read, update, delete, append)
- Directory operations (mkdir, move, copy)
- Search files by pattern
- 60s timeout, 50MB buffer

## System Architecture

### Frontend (React + TypeScript)
- **Routing**: Wouter
- **State**: TanStack React Query + localStorage
- **UI**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS (dark/light mode)

### Backend (Express.js)
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Shell**: Full bash via child_process
- **Files**: Direct workspace access

### IDE Components
- **File Tree**: CRUD with drag-drop support
- **Code Editor**: Multi-tab with syntax highlighting
- **Terminal**: Real shell + Agent Console
- **AI Chat**: Autonomous agent with tool execution
- **Package Manager**: npm package management

## Configuration

### Required Secrets
- `GROQ_API_KEY`: Groq API for AI

### Optional
- `OPENROUTER_API_KEY`: Alternative AI provider
- `DATABASE_URL`: PostgreSQL connection

## User Preferences
- Communication style: Simple, direct
- Execution mode: Autonomous (Level-S)
- Auto terminal switch: Enabled