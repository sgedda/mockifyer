# Mockifyer Dashboard Integration

The Mockifyer Dashboard provides a web interface to view and manage your mock data files.

## Quick Start ✅

Run the dashboard alongside Metro:

```bash
# Terminal 1: Start Metro
npm start

# Terminal 2: Start Dashboard
npm run dashboard
```

Then open **http://localhost:3001** in your browser.

## How It Works

The dashboard reads directly from your `./mock-data` folder, which is the same folder that Metro syncs to when using the Hybrid Provider. This means:

- ✅ Files saved by your app appear instantly in the dashboard
- ✅ No additional configuration needed
- ✅ Works with Metro's auto-sync feature
- ✅ Edit files in the dashboard and they're immediately available to your app

## Usage

### View All Mocks
The dashboard shows all mock files with:
- Endpoint URL
- HTTP method
- File size and modification date
- Search and filter capabilities

### Edit Mock Data
Click any mock file to:
- View request/response data
- Edit response data with JSON editor
- Save changes back to the file

### Delete Mocks
Remove unwanted mock files directly from the dashboard.

### Statistics
View statistics about your mock data:
- Total files and size
- Most used endpoints
- HTTP methods distribution
- Status codes distribution

## Integration with Metro

The dashboard works seamlessly with Metro's sync middleware:

1. **App saves mock** → Hybrid Provider saves to device + Metro (`/mockifyer-save`)
2. **Metro saves to project folder** → File appears in `./mock-data`
3. **Dashboard reads from `./mock-data`** → File appears in dashboard

No additional setup needed!

## Advanced: Running Both Together

If you want to run Metro and Dashboard together in one command, install `concurrently`:

```bash
npm install --save-dev concurrently
```

Then add to `package.json`:

```json
{
  "scripts": {
    "dev:all": "concurrently \"npm start\" \"npm run dashboard\""
  }
}
```

Run: `npm run dev:all`

## Alternative: Integrated into Metro (Future)

For tighter integration, the dashboard could be integrated directly into Metro middleware at `http://localhost:8081/mockifyer-dashboard`. This would require adapting the Express routes to Node.js HTTP format used by Metro middleware.

**Current recommendation**: Use the standalone dashboard (Option 1) as it's simpler and works immediately.

