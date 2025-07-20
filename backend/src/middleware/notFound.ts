import { Request, Response, NextFunction } from 'express';

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: `🔍 Not Found - ${req.originalUrl}`,
    message: 'The requested resource was not found on this server'
  });
}; 