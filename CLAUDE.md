# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TrackedMail is a **mono-tenant email tracking and follow-up application** built with Next.js 15, TypeScript, and Supabase. The application tracks sent emails and automatically sends follow-up reminders for those that haven't received responses.

### Key Characteristics

- **Email tracking only** - Tracks emails sent via Outlook, no initial email sending in the app
- **Microsoft Graph API integration** - Uses webhooks for automatic response detection
- **Mono-tenant architecture** - Serves a single organization with global configuration
- **Internal email exclusion** - Automatically excludes emails from the same domain/tenant

## Development Commands

### Building and Running

```bash
# Development server (with Turbopack for faster builds)
pnpm dev

# Production build (also uses Turbopack)
pnpm build

# Start production server
pnpm start

# Linting and Type Checking
pnpm lint                    # ESLint verification
pnpm lint:fix               # ESLint with auto-fix
pnpm typecheck              # Standard TypeScript check
pnpm typecheck:strict       # Strict TypeScript check (business code only)
pnpm format                 # Format code with Prettier
pnpm format:check           # Check code formatting
pnpm pre-commit             # Run lint-staged checks manually
```

### Supabase Local Development

```bash
# Check Supabase status
supabase status

# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Create new migration
supabase migration new migration_name

# Apply migrations locally
supabase migration up

# Reset database and apply all migrations
supabase db reset

# Create new Edge Function
supabase functions new function_name

# Serve Edge Function locally
supabase functions serve function_name

# Test Edge Function with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/function-name' \
  --header 'Authorization: Bearer SUPABASE_PUBLISHABLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

## Tech Stack and Architecture

### Frontend

- **Next.js 15** with App Router and React 19
- **TypeScript** in strict mode
- **Tailwind CSS 4** for styling
- **Shadcn/UI** components with "new-york" style
- **React Hook Form** with Zod validation
- **Lucide React** for icons

### Backend & Infrastructure

- **Supabase PostgreSQL** - Primary database
- **Supabase Auth** - Frontend user authentication
- **Supabase Edge Functions** - Serverless functions for:
  - Webhook processing and response detection
  - Microsoft Graph subscription management
  - Follow-up scheduling and sending
  - Database operations with transaction handling
- **Microsoft Graph API** - Email access with Application Permissions

### Key Dependencies

- **Microsoft Graph integration** for email tracking
- **Next-themes** for theme management
- **Sonner** for toast notifications
- **Recharts** for analytics visualization
- **CMDK** for command interfaces

## Project Structure

### Core Directories

```
app/                 # Next.js App Router pages
├── globals.css      # Global styles with Tailwind
├── layout.tsx       # Root layout with Geist fonts
└── page.tsx         # Homepage (currently Next.js default)

components/          # React components
├── ui/              # Shadcn/UI base components
└── [custom]/        # Custom application components

lib/                 # Utility functions
└── utils.ts         # Tailwind class merging utilities

supabase/            # Supabase configuration
├── config.toml      # Local Supabase configuration
├── functions/       # Edge Functions (when created)
└── migrations/      # Database migrations
```

## Database Architecture

The application uses a comprehensive PostgreSQL schema designed for email tracking:

### Core Tables

- **users** - Application users with role-based access (admin, manager, user)
- **mailboxes** - Email accounts being tracked
- **tracked_emails** - Sent emails with tracking status
- **followups** - Scheduled and sent follow-up emails
- **email_responses** - Detected responses to tracked emails

### Advanced Features

- **Threading detection** using conversationId, internetMessageId, inReplyTo, references
- **Webhook management** with automatic subscription renewal
- **Row Level Security (RLS)** for data access control
- **Automated triggers** for status updates and follow-up cancellation

### Status Flow

Tracked emails progress through: `pending` → `responded`/`stopped`/`max_reached`/`bounced`/`expired`

## Authentication Architecture

**Dual Authentication System:**

1. **Supabase Auth** - Frontend user sessions and access control
2. **Microsoft Graph** - Backend API access with Application Permissions:
   - `Mail.ReadWrite` (Application)
   - `Mail.Send` (Application)
   - `User.Read.All` (Application)

## Key Features to Implement

### Email Tracking

- Automatic email registration via Microsoft Graph webhooks
- Intelligent response detection using multiple threading methods
- Status management with automatic follow-up cancellation

### Follow-up System

- Maximum 3 follow-ups per email with configurable intervals
- Working hours enforcement (7h00-18h00 UTC, configurable)
- Customizable templates with dynamic variables
- Automatic stopping conditions

### User Management

- **Administrator**: Full system configuration access
- **Manager**: User management and global email tracking
- **User**: Assigned mailbox tracking only

## Configuration

### Type-Safe Configuration

- **Dual TypeScript config**: Standard (`tsconfig.json`) + Strict (`tsconfig.strict.json`)
- **Strict mode**: Applies only to business code (`app/`, `lib/`, custom components)
- **UI components excluded**: Shadcn/UI components exempted from ultra-strict checks
- **Pre-commit hooks**: Husky + lint-staged with type-safety verification

### Git Hooks (Husky)

Pre-commit automatically runs:

1. **TypeScript strict check** (`pnpm typecheck:strict`)
2. **ESLint verification** (`pnpm lint`)
3. **Lint-staged formatting** (ESLint fix + Prettier)

### Shadcn/UI Setup

- Style: "new-york"
- Base color: "neutral"
- Icon library: "lucide"
- Path aliases configured for `@/components`, `@/lib`, `@/utils`

### TypeScript Configuration

- **Standard mode**: Compatible with Next.js and external libraries
- **Strict mode**: Ultra-strict for business logic only
- **Path mapping**: `@/*` → `./*`
- **Target**: ES2017 with bundler module resolution

### Code Quality Tools

- **ESLint**: Next.js + TypeScript rules with type-safety enforcement
- **Prettier**: Consistent formatting with Tailwind CSS plugin
- **Lint-staged**: Selective formatting for staged files only
- **Exclusions**: `components/ui/**`, `.next/**`, build outputs

## Development Workflow

1. **Local Setup**: Start with `supabase start` then `pnpm dev`
2. **Database Changes**: Create migrations with `supabase migration new`
3. **Testing Edge Functions**: Use local serving and curl for testing
4. **Code Quality**: Run `pnpm lint` before commits

## Important Notes

- **Package Manager**: Uses pnpm (not npm/yarn)
- **Build Tool**: Turbopack enabled for faster development and builds
- **French Documentation**: Project documentation is primarily in French
- **Microsoft Graph**: Requires Application Permissions, not delegated permissions
- **Email Threading**: Handles complex email threading scenarios and client inconsistencies
- **Webhooks**: 3-day maximum expiration with automatic renewal 1 hour before expiry

## Documentation References

- **PROJECT-STRUCTURE.md** - Detailed French project overview and architecture
- **SCHEMA-DATABASE.md** - Complete database schema with tables, indexes, and relationships
- **SUPABASE-LOCAL-DEVELOPMENT-GUIDE.md** - Supabase CLI commands and Edge Function testing
- **FLUX-DETECTION-REPONSES.md** - Email response detection algorithms and logic
