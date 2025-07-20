import { Request, Response, NextFunction } from 'express';
import { Document } from '../models/Document';
import { AuthenticatedRequest } from '../middleware/auth';

// @desc    Get all documents
// @route   GET /api/documents
// @access  Admin, RH, Bureau d'Études
export const getDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const documents = await Document.find()
      .populate('createdBy', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single document
// @route   GET /api/documents/:id
// @access  Creator, approvers, or role-based access
export const getDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email');

    if (!document) {
      res.status(404).json({
        success: false,
        error: 'Document not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    next(error);
  }
};

// Placeholder functions for all imported functions
export const createDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const updateDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const deleteDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const approveDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const rejectDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const getDocumentsByType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const uploadDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const downloadDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
}; 