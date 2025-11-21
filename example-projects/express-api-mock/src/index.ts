// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Initialize mockifyer before any other imports
import { initializeMockifyer } from './lib/mockifyer';
initializeMockifyer();

// Other imports after mockifyer is initialized
import express from 'express';
import cors from 'cors';
import path from 'path';
import { weatherRouter } from './routes/weather';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/weather', weatherRouter);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app; 