# TransitOps AI — Fleet Intelligence Platform

A premium, full-stack SaaS dashboard for transit fleet management. Built with React, Vite, Tailwind CSS, and Supabase (PostgreSQL). Features secure authentication with role-based access control, complete CRUD modules, business-rule enforcement, interactive analytics, and a polished glassmorphism UI with dark/light mode.

## Features

### Authentication & RBAC
- Email/password authentication via Supabase Auth
- Five roles: **Admin**, **Fleet Manager**, **Driver**, **Safety Officer**, **Financial Analyst**
- Role-based navigation and dashboard views
- Protected routes — unauthenticated users are redirected to sign-in
- Auto-created user profiles on signup (via database trigger)
- Demo accounts for each role (one-click access)

### Fleet Modules (Full CRUD)
- **Vehicles** — registration number (unique), model, type, load capacity, odometer, acquisition cost, status, insurance details, document uploads
- **Drivers** — license details, expiry date, safety score, contact info, status
- **Trips** — origin/destination, cargo weight, revenue, dispatch/complete/cancel lifecycle
- **Maintenance** — service type, cost, open/closed lifecycle, service history
- **Fuel Logs** — liters, cost, odometer reading, efficiency tracking
- **Expenses** — category-based operational cost tracking

### Business Rules (Trip Management)
- Only **available** vehicles and drivers can be assigned
- **Retired** and **In-Shop** vehicles are excluded from selection
- Drivers with **expired licenses** or **suspended** status cannot be assigned
- Cargo weight **cannot exceed** vehicle load capacity
- **Dispatching** a trip sets vehicle and driver status to "On Trip"
- **Completing** or **cancelling** a trip restores both to "Available"
- **Creating** maintenance sets vehicle status to "In Shop"
- **Closing** maintenance restores vehicle to "Available"

### Analytics Dashboard
- KPIs: Active Vehicles, Available Vehicles, In Maintenance, Active Trips, Pending Trips, Drivers On Duty, Fleet Utilization, Fuel Efficiency, Operational Cost, Revenue, Profit, Vehicle ROI
- Interactive charts: profit trend, maintenance cost trend, fuel consumption, vehicle status distribution (donut), expense breakdown (donut)
- Compliance alerts for expiring licenses and insurance

### UI/UX
- Glassmorphism design with backdrop blur
- Dark/light mode toggle (persisted to localStorage)
- Fully responsive (mobile → desktop)
- Toast notifications
- Loading states and error handling
- Search, filters, sorting, and pagination on every table
- CSV and PDF export on all modules
- In-app notifications
- Profile management and settings page

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript |
| Styling | Tailwind CSS 3, custom glassmorphism utilities |
| Icons | Lucide React |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Charts | Custom SVG components (no external chart library) |

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview

# Type check
npm run typecheck
```

### Environment Variables

The Supabase credentials are pre-configured in `.env`:
```
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Demo Accounts

On the sign-in page, click any role button to instantly sign in with a demo account. The account is created on first use with the password `demo123456`. You can also sign up with any email/password and choose a role.

| Role | Email |
|------|-------|
| Admin | demo.admin@transitops.com |
| Fleet Manager | demo.fleet_manager@transitops.com |
| Driver | demo.driver@transitops.com |
| Safety Officer | demo.safety_officer@transitops.com |
| Financial Analyst | demo.financial_analyst@transitops.com |

## Project Structure

```
src/
├── components/
│   ├── AppShell.tsx        # Sidebar, topbar, notifications, profile menu
│   ├── charts.tsx         # SVG chart components (Line, Bar, Donut, KPI)
│   └── ui.tsx             # Reusable UI primitives (Card, Modal, Badge, etc.)
├── lib/
│   ├── auth.tsx           # Auth context (signIn, signUp, signOut, session)
│   ├── supabase.ts        # Supabase client + TypeScript types
│   ├── theme.tsx          # Dark/light theme context
│   ├── toast.tsx          # Toast notification context
│   └── utils.ts           # Helpers (formatting, export, RBAC, role labels)
├── pages/
│   ├── AuthPage.tsx       # Sign in / sign up with role selection
│   ├── DashboardPage.tsx  # Analytics dashboard with KPIs + charts
│   ├── VehiclesPage.tsx   # Vehicles CRUD + document upload
│   ├── DriversPage.tsx    # Drivers CRUD
│   ├── TripsPage.tsx      # Trips with business rule enforcement
│   ├── MaintenancePage.tsx # Maintenance with lifecycle management
│   ├── FuelPage.tsx       # Fuel logs CRUD
│   ├── ExpensesPage.tsx   # Expenses CRUD with category breakdown
│   ├── ProfilePage.tsx    # User profile management
│   └── SettingsPage.tsx   # Theme + notification preferences
├── App.tsx                # Root: providers + routing
├── main.tsx               # React entry point
└── index.css              # Tailwind + glassmorphism utilities
```

## Database Schema

Nine tables with Row Level Security enabled on all:

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` with role, name, phone, avatar |
| `vehicles` | Fleet vehicles with insurance and status |
| `drivers` | Drivers with license and safety score |
| `trips` | Trip assignments linking vehicles + drivers |
| `maintenance` | Service records with open/closed lifecycle |
| `fuel_logs` | Fuel entries for efficiency tracking |
| `expenses` | Operational expenses by category |
| `notifications` | Per-user in-app notifications |
| `documents` | Vehicle document upload metadata |

A database trigger (`handle_new_user_profile`) auto-creates a profile row when a user signs up, copying the email, full name, and role from signup metadata.

## License

© 2026 TransitOps AI. All rights reserved.
