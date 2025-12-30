# Mockifyer Dashboard Frontend

Modern React + shadcn/ui frontend for the Mockifyer Dashboard.

## Development

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Build for production
npm run build
```

The dev server runs on `http://localhost:5173` and proxies API requests to `http://localhost:3002`.

## Production Build

The frontend builds to `../public` directory, which is served by the Express backend.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives

## Project Structure

```
frontend/
├── src/
│   ├── components/     # React components
│   │   ├── ui/        # shadcn/ui components
│   │   ├── Dashboard.tsx
│   │   ├── MockList.tsx
│   │   ├── MockEditor.tsx
│   │   ├── StatsView.tsx
│   │   └── Settings.tsx
│   ├── lib/           # Utilities and API client
│   ├── types/         # TypeScript types
│   ├── App.tsx        # Main app component
│   └── main.tsx       # Entry point
├── index.html
└── package.json
```

