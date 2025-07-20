import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  approveDocument,
  rejectDocument,
  getDocumentsByType,
  uploadDocument,
  downloadDocument
} from '../controllers/documentController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/documents
// @desc    Get all documents
// @access  Admin, RH, Bureau d'Études
router.get('/', authorize('Administrator', 'RH', 'Bureau d\'Études'), getDocuments);

// @route   GET /api/documents/type/:type
// @desc    Get documents by type
// @access  Role-based access depending on document type
router.get('/type/:type', getDocumentsByType);

// @route   GET /api/documents/:id
// @desc    Get single document
// @access  Creator, approvers, or role-based access
router.get('/:id', getDocument);

// @route   GET /api/documents/:id/download
// @desc    Download document file
// @access  Creator, approvers, or role-based access
router.get('/:id/download', downloadDocument);

// @route   POST /api/documents
// @desc    Create new document
// @access  All authenticated users
router.post('/', createDocument);

// @route   POST /api/documents/upload
// @desc    Upload document file
// @access  All authenticated users
router.post('/upload', uploadDocument);

// @route   PUT /api/documents/:id
// @desc    Update document
// @access  Creator or authorized roles
router.put('/:id', updateDocument);

// @route   PUT /api/documents/:id/approve
// @desc    Approve document
// @access  Role-based approvers
router.put('/:id/approve', approveDocument);

// @route   PUT /api/documents/:id/reject
// @desc    Reject document
// @access  Role-based approvers
router.put('/:id/reject', rejectDocument);

// @route   DELETE /api/documents/:id
// @desc    Delete document
// @access  Creator, Admin, or authorized roles
router.delete('/:id', deleteDocument);

export default router; 