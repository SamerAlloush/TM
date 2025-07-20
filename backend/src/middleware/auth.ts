import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log(`🔐 Auth failed for ${req.method} ${req.path}: No token provided`);
      res.status(401).json({ 
        success: false, 
        error: 'Not authorized to access this route',
        message: 'Authentication token is required'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        console.log(`🔐 Auth failed for ${req.method} ${req.path}: User not found (ID: ${decoded.id})`);
        res.status(401).json({ 
          success: false, 
          error: 'User not found',
          message: 'The user associated with this token no longer exists'
        });
        return;
      }

      if (!req.user.isActive) {
        console.log(`🔐 Auth failed for ${req.method} ${req.path}: User account is inactive (ID: ${decoded.id})`);
        res.status(401).json({ 
          success: false, 
          error: 'Account inactive',
          message: 'Your account has been deactivated'
        });
        return;
      }

      console.log(`✅ Auth success for ${req.method} ${req.path}: User ${req.user.email} (${req.user.role})`);
      next();
    } catch (error: any) {
      console.log(`🔐 Auth failed for ${req.method} ${req.path}: Token verification failed - ${error.message}`);
      res.status(401).json({ 
        success: false, 
        error: 'Not authorized to access this route',
        message: error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token'
      });
      return;
    }
  } catch (error) {
    console.error(`🔐 Auth middleware error for ${req.method} ${req.path}:`, error);
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
      return;
    }

    next();
  };
};

// Specific role middleware functions
export const requireAdmin = authorize('Administrator');
export const requireHR = authorize('RH', 'Administrator');
export const requirePurchase = authorize('Purchase Department', 'Administrator');
export const requireWorker = authorize('Worker', 'Administrator');
export const requireWorkshop = authorize('Workshop', 'Administrator');
export const requireConductors = authorize('Conductors of Work', 'Administrator');
export const requireAccounting = authorize('Accounting', 'Administrator');
export const requireDesignOffice = authorize('Bureau d\'Études', 'Administrator');
export const requireProjectManager = authorize('Project Manager', 'Administrator');

// Multiple role combinations for common permissions
export const requireManagement = authorize('Administrator', 'RH', 'Conductors of Work');
export const requireFieldAccess = authorize('Conductors of Work', 'Worker', 'Workshop', 'Administrator', 'Project Manager');
export const requireFinancialAccess = authorize('Administrator', 'Accounting', 'Purchase Department');
export const requireInterventionAccess = authorize('Worker', 'Conductors of Work', 'Project Manager', 'Administrator'); 