import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerDocument } from './config/swagger';
import { routes } from './routes';
import { errorHandler } from './middlewares';

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI at /api-docs (try it: http://localhost:3000/api-docs)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'User Service API',
  customCss: '.swagger-ui .topbar { display: none }',
}));

app.use(config.apiPrefix, routes);

app.use((_req: Request, res: Response) => res.status(404).json({ success: false, error: { message: 'Not found' } }));
app.use(errorHandler);

export default app;
