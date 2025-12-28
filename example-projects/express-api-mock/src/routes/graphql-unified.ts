import express, { Request, Response } from 'express';
import { executeQueryUnified } from '../services/graphql-unified';

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

    // Get clientType and scope from query parameters, with defaults
    const clientType = (req.query.clientType as string) || 'axios';
    const scope = (req.query.scope as string) || 'local';
    
    // Validate clientType and scope
    if (clientType !== 'axios' && clientType !== 'fetch') {
      return res.status(400).json({ 
        error: 'Invalid clientType. Must be "axios" or "fetch"' 
      });
    }
    
    if (scope !== 'local' && scope !== 'global') {
      return res.status(400).json({ 
        error: 'Invalid scope. Must be "local" or "global"' 
      });
    }

    const result = await executeQueryUnified(
      query,
      variables,
      clientType as 'axios' | 'fetch',
      scope as 'local' | 'global'
    );

    // Prevent browser caching to ensure fresh headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Forward mockifyer headers if present
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-mockifyer')) {
          res.setHeader(key, value);
        }
      });
    }
    
    // Add client configuration headers for frontend display
    res.setHeader('x-client-type', clientType);
    res.setHeader('x-scope', scope);
    
    res.json(result.data);
  } catch (error: any) {
    console.error('[GraphQLUnifiedRoute] Error:', error);
    const errorMessage = error?.message || 'Failed to execute GraphQL query';
    const statusCode = error?.response?.status || 500;
    res.status(statusCode).json({ 
      error: errorMessage,
      errors: [{ message: errorMessage }],
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

export { router as graphqlUnifiedRouter };

