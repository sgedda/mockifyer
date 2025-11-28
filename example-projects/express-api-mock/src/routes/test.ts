import express, { Request, Response } from 'express';
import { getCurrentWeather } from '../services/weather-fetch';

const router = express.Router();

router.get('/test/:city', async (req: Request, res: Response) => {
  
  try {
    const params = new URLSearchParams({
      key: '605873f11d7649c98b195527251603',
      q: 'London'
  });
  console.log('params', params.toString());
  const url = `https://api.github.com/users/octocat`
  console.log('url', url);
  const response = await fetch(url);
    const data = await response.json();
    console.log('data', data);
    res.json(data);
  } catch (error: any) {
    console.error('[WeatherFetchRoute] Error:', error);
    const errorMessage = error?.message || 'Failed to fetch weather data';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export { router as test };

