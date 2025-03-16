import express, { Request, Response } from 'express';
import { weatherService } from '../services/weather';

const router = express.Router();

router.get('/current/:city', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const weatherData = await weatherService.getCurrentWeather(city);
    res.json(weatherData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

router.get('/forecast/:city', async (req: Request, res: Response) => {
  try {
    const { city } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 3;
    const forecast = await weatherService.getForecast(city, days);
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch forecast data' });
  }
});

export const weatherRouter = router; 