// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface PaginatedApiResponse<T = any> extends ApiResponse<T[]> {
  count: number;
  total: number;
  pagination: {
    page: number;
    limit: number;
    pages: number;
  };
}

// User Types
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'Administrator' | 'RH' | 'Workshop' | 'Worker' | 'Conductors of Work' | 'Project Manager';
  assignedSites?: string[];
  createdAt: string;
  updatedAt: string;
}

// Absence Types
export interface Absence {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  type: 'Vacation' | 'Sick Leave' | 'Personal Leave' | 'Emergency' | 'Training' | 'Other';
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Declared';
  requestType: 'Request' | 'Declaration';
  dayCount: number;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

// Intervention Request Types
export interface InterventionRequest {
  _id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'pending' | 'Transferred to Workshop' | 'In Progress' | 'Completed' | 'Cancelled';
  submittedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  relatedSite?: {
    _id: string;
    name: string;
    address?: string;
    city?: string;
  };
  relatedTask?: {
    _id: string;
    title: string;
    description: string;
  };
  workshopAssignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isEmergency: boolean;
  equipmentLocation?: string;
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;
  workshopNotes?: string;
  transferLog: TransferLogEntry[];
  comments: InterventionComment[];
  createdAt: string;
  updatedAt: string;
}

export interface TransferLogEntry {
  action: string;
  performedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  notes: string;
  timestamp: string;
}

export interface InterventionComment {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  text: string;
  createdAt: string;
}

// Site Types
export interface Site {
  _id: string;
  name: string;
  address: string;
  city: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
  createdAt: string;
  updatedAt: string;
}

// Type Guards for Runtime Type Checking
export function isApiResponse<T>(value: any): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.success === 'boolean'
  );
}

export function isPaginatedApiResponse<T>(value: any): value is PaginatedApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.success === 'boolean' &&
    typeof value.count === 'number' &&
    typeof value.total === 'number' &&
    typeof value.pagination === 'object' &&
    value.pagination !== null
  );
}

export function isAbsenceArray(value: any): value is Absence[] {
  return Array.isArray(value) && (value.length === 0 || isAbsence(value[0]));
}

export function isAbsence(value: any): value is Absence {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value._id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string'
  );
}

export function isInterventionRequestArray(value: any): value is InterventionRequest[] {
  return Array.isArray(value) && (value.length === 0 || isInterventionRequest(value[0]));
}

export function isInterventionRequest(value: any): value is InterventionRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value._id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.priority === 'string' &&
    typeof value.status === 'string'
  );
}

// API Error Types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

export function isApiError(value: any): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.message === 'string'
  );
} 