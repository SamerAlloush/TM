import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array()); // Debug logging
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array()
    });
    return;
  }
  next();
};

// User registration validation - More reasonable rules
export const validateRegistration = [
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .trim(),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn([
      'Administrator',
      'RH',
      'Purchase Department', 
      'Mechanics',
      'Workshop',
      'Conductors of Work',
      'Accounting',
      'Bureau d\'Études'
    ])
    .withMessage('Invalid role selected'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),
  body('address')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters'),
  handleValidationErrors
];

// User login validation
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// OTP verification validation
export const validateOTPVerification = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('otp')
    .notEmpty()
    .withMessage('OTP code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP code must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP code must contain only numbers'),
  handleValidationErrors
];

// Resend OTP validation
export const validateResendOTP = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  handleValidationErrors
];

// Password change validation
export const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  handleValidationErrors
];

// Site validation
export const validateSite = [
  body('name')
    .notEmpty()
    .withMessage('Site name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Site name must be between 2 and 100 characters')
    .trim(),
  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 200 })
    .withMessage('Address cannot exceed 200 characters')
    .trim(),
  body('city')
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters')
    .trim(),
  body('postalCode')
    .matches(/^\d{5}$/)
    .withMessage('Postal code must be 5 digits'),
  body('startDate')
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  body('expectedEndDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid expected end date'),
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),
  body('projectManager')
    .isMongoId()
    .withMessage('Please provide a valid project manager ID'),
  handleValidationErrors
];

// Task validation
export const validateTask = [
  body('title')
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Task title must be between 2 and 100 characters')
    .trim(),
  body('site')
    .isMongoId()
    .withMessage('Please provide a valid site ID'),
  body('assignedTo')
    .isArray()
    .withMessage('Assigned users must be an array')
    .custom((value) => {
      if (value.length === 0) {
        throw new Error('At least one user must be assigned');
      }
      return true;
    }),
  body('assignedTo.*')
    .isMongoId()
    .withMessage('Please provide valid user IDs'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid due date'),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),
  handleValidationErrors
];

// Message validation
export const validateMessage = [
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Subject must be between 2 and 200 characters')
    .trim(),
  body('content')
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content cannot exceed 5000 characters'),
  body('recipients')
    .optional()
    .isArray()
    .withMessage('Recipients must be an array'),
  body('recipients.*')
    .optional()
    .isMongoId()
    .withMessage('Please provide valid recipient IDs'),
  body('externalEmail')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid external email'),
  handleValidationErrors
];

// Absence validation
export const validateAbsence = [
  body('type')
    .isIn(['Vacation', 'Sick Leave', 'Personal Leave', 'Emergency', 'Training', 'Other'])
    .withMessage('Invalid absence type'),
  body('startDate')
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  body('endDate')
    .isISO8601()
    .withMessage('Please provide a valid end date')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('requestType')
    .isIn(['Request', 'Declaration'])
    .withMessage('Invalid request type'),
  body('isFullDay')
    .isBoolean()
    .withMessage('isFullDay must be a boolean'),
  body('startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Please provide valid time format (HH:MM)'),
  body('endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Please provide valid time format (HH:MM)'),
  handleValidationErrors
];

// Validation middleware for sending messages
export const validateSendMessage = (req: Request, res: Response, next: NextFunction): void => {
  const { content, type } = req.body;
  const errors: string[] = [];

  // Validate content
  if (!content) {
    errors.push('Content is required');
  } else if (typeof content !== 'string') {
    errors.push('Content must be a string');
  } else if (content.trim().length === 0) {
    errors.push('Content cannot be empty');
  } else if (content.length > 5000) {
    errors.push('Content cannot exceed 5000 characters');
  }

  // Validate type if provided
  const validTypes = ['text', 'image', 'video', 'document', 'audio', 'contact', 'location', 'system'];
  if (type && !validTypes.includes(type)) {
    errors.push(`Type must be one of: ${validTypes.join(', ')}`);
  }

  // Validate conversation ID parameter
  const { id: conversationId } = req.params;
  if (!conversationId) {
    errors.push('Conversation ID is required');
  } else if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) {
    errors.push('Invalid conversation ID format');
  }

  if (errors.length > 0) {
    console.log('❌ Message validation failed:', errors);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      received: {
        content: content ? `${content.substring(0, 50)}${content.length > 50 ? '...' : ''}` : 'missing',
        type: type || 'text (default)',
        conversationId
      }
    });
    return;
  }

  console.log('✅ Message validation passed');
  next();
};

// Validation middleware for creating conversations
export const validateCreateConversation = (req: Request, res: Response, next: NextFunction): void => {
  const { participantId, participants, type } = req.body;
  const errors: string[] = [];

  // Check for participant(s)
  if (!participantId && (!participants || !Array.isArray(participants) || participants.length === 0)) {
    errors.push('Either participantId or participants array is required');
  }

  // Validate participant ID format
  if (participantId && !/^[0-9a-fA-F]{24}$/.test(participantId)) {
    errors.push('Invalid participant ID format');
  }

  // Validate participants array
  if (participants) {
    if (!Array.isArray(participants)) {
      errors.push('Participants must be an array');
    } else {
      participants.forEach((id, index) => {
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
          errors.push(`Invalid participant ID format at index ${index}`);
        }
      });
    }
  }

  // Validate type
  if (type && !['direct', 'group'].includes(type)) {
    errors.push('Type must be either "direct" or "group"');
  }

  if (errors.length > 0) {
    console.log('❌ Conversation validation failed:', errors);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      received: req.body
    });
    return;
  }

  console.log('✅ Conversation validation passed');
  next();
}; 