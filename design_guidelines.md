# Design Guidelines: Web-Based Development Environment with AI Integration

## Design Approach
**Reference-Based Approach**: Inspired by Replit IDE and CodeSandbox - integrated development environments with terminal, file tree, and editor panels.

## Color Palette
- **Primary**: #0F172A (deep slate)
- **Secondary**: #8B5CF6 (purple) 
- **Accent**: #10B981 (emerald green)
- **Background**: #1E293B (dark slate)
- **Terminal**: #000000 (black)
- **Success**: #22C55E (green)
- **Text**: #F8FAFC (off-white)

## Typography
- **Code/Terminal**: JetBrains Mono or Fira Code (monospace)
- **UI Elements**: Roboto
- Use monospace fonts consistently for terminal and code editor areas
- Standard UI text uses Roboto for readability

## Layout System
- **Spacing**: 12px base unit (use Tailwind units: p-3, m-3, gap-3)
- **Split-Panel Layout**: Resizable sections with drag handles
  - Left sidebar: File tree/manager (collapsible)
  - Main area: Code editor (largest panel)
  - Right panel: AI chat assistant (collapsible)
  - Bottom panel: Terminal shell (resizable height)

## Core Components

### File Tree Sidebar
- Hierarchical folder/file structure with expand/collapse
- File icons for different file types
- Context menu for create/delete/rename operations
- Upload/download buttons at top

### Code Editor Panel
- Syntax highlighting for JavaScript, Python, HTML, CSS, JSON
- Line numbers on left
- Tab system for multiple open files
- Save indicator and file path breadcrumb

### Terminal Panel
- Full-width black background terminal at bottom
- Command input with prompt
- Scrollable output history
- Clear terminal button

### AI Chat Panel
- Message thread with user/AI bubbles
- Input field with send button at bottom
- OpenRouter API integration indicator
- Collapsible to maximize editor space

### Package Manager Interface
- Search/install npm packages
- List of installed packages with versions
- Install/uninstall actions

## Design Principles
- Dark theme optimized for extended coding sessions
- Developer-focused efficiency with keyboard shortcuts
- Resizable panels for personalized workspace
- Clear visual hierarchy between panels using borders/shadows
- Minimal distractions - clean, functional interface

## Images
No hero images required - this is a functional IDE application focused on productivity and utility.