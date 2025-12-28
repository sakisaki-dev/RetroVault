# NFL RetroVault

**NFL RetroVault** is a **local-first analytics tool** designed for exploring and comparing NFL Retro Bowl–style player statistics across multiple seasons. It allows users to **compile season data manually** (from spreadsheets or CSVs) into a persistent local database, then **analyze, compare, and visualize** player performance over time.  

This tool is ideal for fans, analysts, or hobbyists who want to **track player stats longitudinally**, compare seasons, and see historical trends without relying on a server or cloud storage.  

---

## Acknowledgements

The initial **UI prototyping** for this project was assisted using [Loveable](https://www.lovable.dev). All **architecture, persistence, data handling, and logic** have been independently implemented and maintained by the developer.   

---

## Features

- **Season-based stat tracking:** Upload CSVs or manually compile stats for each season.  
- **Player comparison:** Quickly compare multiple players across different seasons.  
- **Historical data view:** Tap on a player to see previous season stats.  
- **Local-first persistence:** All data is stored in the browser using IndexedDB, surviving browser restarts.  
- **Privacy-friendly:** No external servers or cloud storage are used; all analysis occurs locally.  
- **Clean and responsive UI:** Built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui components.

---

## Tech Stack

- **Frontend:** React + TypeScript  
- **Bundler:** Vite  
- **Styling:** Tailwind CSS  
- **UI Components:** shadcn/ui  
- **Persistence:** IndexedDB (via `idb`) for local data storage  
- **Data Input:** CSVs exported from spreadsheets or manual entry  

---

## How It Works

1. **Prepare Your Data:**  
   - Create or update a spreadsheet with player statistics for a given season.  
   - Export the sheet to CSV format.  

2. **Upload CSV:**  
   - Use the app interface to upload season data.  
   - Each player row is saved locally in IndexedDB and tagged by season.  

3. **Analyze and Compare:**  
   - Select players to view individual stats and career trends.  
   - Compare multiple players across different seasons.  

4. **Persistence:**  
   - Data persists in IndexedDB locally.  
   - Closing or refreshing the browser does not erase stored data.  

5. **Reset or Update:**  
   - Clear the database if needed to start a new analysis.  
   - Upload additional CSVs for new seasons, appending to the existing database.  

---

## Getting Started (Local Development)

Clone the repository and install dependencies:

```bash
git clone https://github.com/sakisaki-dev/NFL_RetroVault.git
cd NFL_RetroVault
npm install
npm run dev
```


## Project Structure ## 
```

NFL_RetroVault/
├─ src/
│  ├─ components/       # React UI components
│  ├─ lib/              # Non-UI logic (CSV parsing, IndexedDB [in progress], analytics)
│  ├─ types/            # TypeScript type definitions
│  ├─ pages/            # Page-level React components
│  └─ main.tsx          # App entry point
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ postcss.config.js
└─ README.md
```

## Contact ## 
Email: samachir@ucsc.edu
Name: Saketh Machiraju
