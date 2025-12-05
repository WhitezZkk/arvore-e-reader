# Árvore E-Reader Automation Tool

## Overview

This is a web-based automation tool designed to automate reading sessions on the Árvore E-Reader platform. The application provides a dashboard interface where users can configure automation parameters (email, password, book slug, reading interval), start/pause/stop automation sessions, and monitor real-time progress through WebSocket communication. Built as a single-page application with a focus on real-time feedback and status monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: Shadcn/ui components built on Radix UI primitives, following Material Design principles for a utility-focused, dashboard-like interface. The design emphasizes clarity, efficiency, and real-time status monitoring with immediate access to controls.

**State Management**: 
- React hooks for local component state
- TanStack Query (React Query) for server state management
- Custom `useAutomation` hook managing WebSocket connection, session state, and real-time updates
- EventEmitter pattern for handling automation lifecycle events

**Routing**: Wouter for lightweight client-side routing

**Styling**: Tailwind CSS with custom design tokens, supporting both light and dark themes via a ThemeProvider context

**Key Design Patterns**:
- Single-page dashboard layout (no scrolling required for core functionality)
- Real-time WebSocket communication for bidirectional data flow
- Component composition with separation of concerns (ConfigurationPanel, ControlPanel, ProgressPanel, ActivityLog)
- Form validation using React Hook Form with Zod schema validation

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Build System**: ESBuild for server bundling with selective dependency bundling to optimize cold start times

**WebSocket Server**: ws library for real-time bidirectional communication with clients, managing automation sessions with unique session IDs

**Browser Automation**: Puppeteer Core for headless browser control to automate the e-reader platform interactions

**Session Management**: 
- In-memory session storage using Map data structure
- Each WebSocket connection gets a unique session with its own AutomationService instance
- Event-driven architecture using Node.js EventEmitter for state changes, progress updates, and logging

**Development Environment**: Vite development server with HMR (Hot Module Replacement) middleware mode for seamless development experience

**Key Design Patterns**:
- Service-oriented architecture with AutomationService encapsulating all automation logic
- Event-driven communication between automation service and WebSocket clients
- Session isolation ensuring multiple users can run independent automation sessions

### Data Storage Solutions

**Current Implementation**: In-memory storage using JavaScript Map objects for user data

**Database Schema**: Defined using Drizzle ORM with PostgreSQL dialect, though currently using memory storage. The schema includes:
- Users table with id, username, and password fields
- Prepared for PostgreSQL migration when persistence is needed

**Data Validation**: Zod schemas for runtime type validation and data integrity across shared types between client and server

### Authentication and Authorization

**Current State**: Basic user schema defined but authentication not actively implemented in the automation flow

**Prepared Infrastructure**: 
- User model with username/password fields
- Storage interface (IStorage) abstracting CRUD operations
- Ready for integration with session-based or token-based authentication

### External Dependencies

**Browser Automation**: 
- Puppeteer Core for controlling headless Chrome/Chromium
- Selenium reference implementation (Python script in attached_assets) showing the original automation approach

**Target Platform**: Árvore E-Reader web application (https://e-reader.arvore.com.br/)
- Login flow automation
- Book navigation via slug parameter
- Page progression tracking

**UI Component Libraries**:
- Radix UI primitives for accessible, unstyled components
- Lucide React for icon system
- Embla Carousel for carousel functionality
- CMDK for command palette patterns

**Development Tools**:
- Replit-specific plugins for development environment integration
- TypeScript for type safety across the stack
- Drizzle Kit for database schema management

**Communication Protocol**: WebSocket-based real-time messaging with typed message schemas for:
- State updates (connecting, logging_in, loading_book, reading, paused, completed, error)
- Progress updates (current page, total pages, percentage, elapsed time, estimated time remaining)
- Log entries (info, success, warning, error)
- Control commands (start, pause, resume, stop, reset)