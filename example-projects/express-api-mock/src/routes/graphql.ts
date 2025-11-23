import express, { Request, Response } from 'express';
import { graphqlService } from '../services/graphql';

const router = express.Router();

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, variables } = req.body;

    if (!query) {
      return res.status(400).json({ 
        error: 'GraphQL query is required',
        errors: [{ message: 'Query parameter is missing' }]
      });
    }

    const result = await graphqlService.executeQuery(query, variables);
    
    // Pass through mockifyer headers if present (case-insensitive check)
    const mockHeader = result.headers['x-mockifyer'] || result.headers['X-Mockifyer'] || result.headers['X-MOCKIFYER'];
    if (mockHeader === 'true') {
      res.setHeader('x-mockifyer', mockHeader);
      if (result.headers['x-mockifyer-timestamp'] || result.headers['X-Mockifyer-Timestamp']) {
        res.setHeader('x-mockifyer-timestamp', result.headers['x-mockifyer-timestamp'] || result.headers['X-Mockifyer-Timestamp']);
      }
      if (result.headers['x-mockifyer-filename'] || result.headers['X-Mockifyer-Filename']) {
        res.setHeader('x-mockifyer-filename', result.headers['x-mockifyer-filename'] || result.headers['X-Mockifyer-Filename']);
      }
      if (result.headers['x-mockifyer-filepath'] || result.headers['X-Mockifyer-Filepath']) {
        res.setHeader('x-mockifyer-filepath', result.headers['x-mockifyer-filepath'] || result.headers['X-Mockifyer-Filepath']);
      }
    }
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[GraphQLRoute] Error:', error);
    const errorMessage = error?.message || 'Failed to execute GraphQL query';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      errors: [{ message: errorMessage }],
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export const graphqlRouter = router;

