# DailyMoney

DailyMoney is a modern personal finance tracker built for daily use. It helps you log income and expenses, review trends, manage account balances, edit past-day transactions, and now includes authentication, profile management, and account settings in a React-based app experience.

The project is still intentionally lightweight: Flask on the backend, React on the frontend, and JSON storage instead of a full database. That keeps the app easy to run locally while still feeling like a proper product.

## Overview

- React-based frontend served by Flask
- Session-based authentication with login and registration
- Persistent login sessions until explicit logout
- Forgot-password flow using registered email + secure password reset
- Profile overview and account settings pages
- Daily finance tracking with insights and yearly analysis
- Day Editor with calendar-based past-date editing
- JSON storage for users, settings, accounts, and entries
- INR-first money formatting and animated UI

## Tech Stack

- Frontend: React, ReactDOM, Tailwind CSS via CDN, Chart.js
- Backend: Python, Flask
- Auth: Flask session cookies + password hashing
- Storage: JSON files
- Runtime: Local `.venv`

## Current Architecture

### High-Level Flow

```text
React Frontend
    |
    v
Flask App Shell + JSON API
    |
    +--> Auth routes
    +--> Profile/settings routes
    +--> Finance entry + analytics routes
    |
    v
JSON Storage in data/
```

### Project Structure

```text
DailyMoney/
├── app.py
├── requirements.txt
├── install.ps1
├── run.ps1
├── data/
│   ├── ledger.json
│   └── users.json
├── static/
│   ├── css/
│   │   └── app.css
│   └── js/
│       └── app.jsx
├── templates/
│   └── react_app.html
└── frontend/
    ├── dashboard/
    ├── daily_entry/
    ├── monthly_insights/
    ├── yearly_analysis/
    ├── login_screen/
    ├── register_screen/
    ├── profile_overview/
    └── account_settings/
```

## Folder Explanation

There are two important UI-related folders in this repo:

- `templates/`
  This is the live Flask template folder. Right now the app uses a single entry file: `react_app.html`.

- `frontend/`
  This is the design/reference folder that contains the source UI mockups and inspiration screens used while building the app.

The React app itself lives in:

- `static/js/app.jsx`
- `static/css/app.css`

## Core Features

### Finance Tracking

- Add income, expense, and savings entries
- Track balances across accounts
- Support categories, descriptions, and custom labels
- Delete individual entries or clear all entries
- Edit older transactions from a calendar-based day editor

### Analytics

- Dashboard with total tracked money and account balances
- Cash flow chart with live range switching
- Insights page with daily/monthly line graph switching
- Yearly analysis with inflow vs outflow trends
- Monthly category allocation and spending summaries
- AI-style spending suggestions from real data

### Auth & User Features

- Register and login flow
- Session-based authentication
- Persistent session login across browser restarts
- Forgot password flow with email verification and password reset
- Profile overview page
- Account settings page
- Editable user profile information
- Editable finance settings such as:
  - monthly budget
  - monthly income target
  - notification preferences

### UI/UX

- React frontend with animated transitions
- Collapsible sidebar
- Interactive cards and hover states
- Lightweight animated starfield background
- Premium dark finance look with neon highlights

## Pages

### Public

- `/login`
- `/register`

### Protected App Pages

- `/dashboard`
- `/daily-entry`
- `/monthly-insights`
- `/yearly-analysis`
- `/day-editor`
- `/profile-overview`
- `/account-settings`

## Data Model

DailyMoney currently avoids MongoDB/SQL and stores data in JSON:

- `data/users.json`
  Stores registered users, password hashes, profile data, settings, preferences, and user finance data.

- `data/ledger.json`
  Legacy finance seed file retained for lightweight migration/bootstrapping.

This approach keeps the project easy to run locally and simple to iterate on before moving to a real database later.

## Backend Responsibilities

`app.py` currently handles:

- serving the React app shell
- authentication APIs
- persistent session handling
- forgot-password reset API
- profile and settings APIs
- finance entry CRUD APIs
- metrics generation
- chart data generation
- account balance rebuilding
- JSON persistence

## Frontend Responsibilities

`static/js/app.jsx` currently handles:

- app routing by page path
- auth screens
- dashboard, insights, yearly, and day-editor screens
- profile overview and account settings
- interactive charts
- sidebar behavior
- animated UI state and lightweight background effects

## Setup

### 1. Activate the virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Or use:

```powershell
.\install.ps1
```

### 3. Run the app

```powershell
.\.venv\Scripts\python.exe app.py
```

Or use:

```powershell
.\run.ps1
```

Then open:

```text
http://127.0.0.1:5000
```

## Login Behavior

DailyMoney now keeps the user logged in with a persistent Flask session.

- you stay logged in after refreshing the page
- you stay logged in after reopening the browser
- you only need to log in again if you:
  - click logout
  - clear browser cookies
  - let the session expire

If you forget your password, use the `Forgot Password` option on the login page and reset it using the registered email address.

## Why No Database Yet?

For the current stage of DailyMoney, JSON storage is enough because the app is still:

- local-first
- lightweight
- single-user or limited-user
- focused on fast iteration

When the project grows further, the next natural step would be moving to SQLite or PostgreSQL.

## Roadmap Ideas

- move from JSON to SQLite/PostgreSQL
- password reset flow
- recurring transactions
- category budgets
- CSV export
- richer AI advice and expense insights
- optional API-first separation for frontend/backend deployment

## License

This repository currently does not include an explicit license file. Add one before wider public distribution if you want others to reuse or contribute to the code.
