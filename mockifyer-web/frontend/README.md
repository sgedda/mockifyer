# Express API Mock Frontend

Modern React + shadcn/ui frontend for the Express API Mock example project.

## Development

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev
```

The dev server runs on `http://localhost:5174` and proxies API requests to `http://localhost:3000`.

## Production Build

The frontend builds to `../public` directory, which is served by the Express backend.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **React Router** - Client-side routing

## Project Structure

```
frontend/
├── src/
│   ├── components/     # React components
│   │   ├── ui/        # shadcn/ui components
│   │   └── Navigation.tsx
│   ├── pages/          # Page components
│   │   ├── Introduction.tsx
│   │   ├── Playground.tsx
│   │   ├── RequestFlow.tsx
│   │   ├── DateConfig.tsx
│   │   ├── GettingStarted.tsx
│   │   ├── Roadmap.tsx
│   │   └── ConfigReference.tsx
│   ├── lib/           # Utilities
│   ├── App.tsx        # Main app component
│   └── main.tsx       # Entry point
├── index.html
└── package.json
```

## Running Both Frontend and Backend

From the project root:

```bash
# Run both together
npm run dev:all

# Or run separately
npm run dev          # Backend (port 3000)
npm run dev:frontend # Frontend (port 5174)
```


