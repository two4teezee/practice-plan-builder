# Hockey Practice Planner

A modern web application for hockey coaches to create, manage, and export practice plans.

## Features

- **Create Practice Plans**: Build custom practice plans with drag-and-drop drill ordering
- **Drills Library**: Manage a library of drills with categories, durations, and detailed instructions
- **Previous Plans**: View and manage saved practice plans
- **Export Options**: Export practice plans to PDF, Word document, or print
- **Dark/Light Mode**: Toggle between dark and light themes
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Offline-First**: All data stored locally in IndexedDB

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: IndexedDB (via Dexie.js)
- **Drag & Drop**: @dnd-kit
- **PDF Export**: jsPDF
- **Word Export**: docx
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd hockey-practice-planner

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deployment

### Vercel (Recommended)

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "Import Project" and select your repository
4. Vercel will automatically detect Next.js and configure the build settings
5. Click "Deploy"

Your app will be live at `https://your-project-name.vercel.app`

### Manual Build

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Usage

### Creating a Practice Plan

1. Navigate to "Create Practice Plan" (default view)
2. Fill in practice details (name, date, duration, location, coach)
3. Click "Add Drill" to add drills from your library
4. Drag and drop drills to reorder them
5. Click "Save Plan" to save

### Managing Drills

1. Navigate to "Drills Library"
2. View existing drills or click "New Drill" to create one
3. Fill in drill details including:
   - Name, Category, Duration, Skill Focus
   - Objective, Setup, Execution
   - Coaching Points, Variations
   - Equipment needed
   - Optional video and PDF links

### Viewing Previous Plans

1. Navigate to "Previous Plans"
2. Click on a plan to expand and view details
3. Export to PDF/Word or print directly from the interface

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Create Practice Plan (home)
│   ├── drills/           # Drills Library page
│   └── history/          # Previous Plans page
├── components/           # React components
│   ├── ui/               # Reusable UI components
│   ├── drills/           # Drill-related components
│   └── practice/         # Practice plan components
└── lib/                  # Utilities and configuration
    ├── db.ts             # IndexedDB setup with Dexie
    ├── types.ts          # TypeScript interfaces
    └── export.ts         # PDF/Word/Print export functions
```

## License

MIT
