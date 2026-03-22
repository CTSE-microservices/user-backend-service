import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerDocument } from './config/swagger';
import { routes } from './routes';
import { errorHandler } from './middlewares';

const app = express();

// So req.protocol / secure are correct behind Nginx, ALB, etc. (uses X-Forwarded-*)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

/** OpenAPI server URL must match the browser's origin. If it were localhost while the page is
 *  http://<EC2-IP>:4000, Chrome blocks fetch to loopback (Private Network Access / CORS-RFC1918). */
function swaggerDocumentForRequest(req: Request) {
  const host = req.get('host') ?? `localhost:${config.port}`;
  const serverUrl = `${req.protocol}://${host}${config.apiPrefix}`;
  return {
    ...swaggerDocument,
    servers: [{ url: serverUrl, description: 'This host (same as Swagger UI)' }],
  };
}

const swaggerUiOptions = {
  customSiteTitle: 'User Service API',
  customCss: '.swagger-ui .topbar { display: none }',
};

// Swagger UI at /api-docs — inject Host-based server URL so "Try it out" never targets localhost from EC2
app.use(
  '/api-docs',
  swaggerUi.serve,
  (req: Request, res: Response, next: NextFunction) =>
    swaggerUi.setup(swaggerDocumentForRequest(req), swaggerUiOptions)(req, res, next),
);

app.use(config.apiPrefix, routes);

app.use((_req: Request, res: Response) => res.status(404).json({ success: false, error: { message: 'Not found' } }));
app.use(errorHandler);

export default app;
