import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api' 
  : 'https://your-production-api.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage
      await AsyncStorage.multiRemove(['token', 'user']);
    }
    return Promise.reject(error);
  }
);

// API Response interfaces
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  attemptsLeft?: number;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

interface LoginResponse {
  token: string;
  data: User;
}

interface RegisterResponse {
  email: string;
  expiresIn: string;
  attemptsLeft: number;
}

// Auth API functions
export const authAPI = {
  // Step 1: Register user and send OTP
  register: async (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    address?: string;
  }): Promise<ApiResponse<RegisterResponse>> => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  // Step 2: Verify OTP and complete registration
  verifyOTP: async (data: {
    email: string;
    otp: string;
  }): Promise<ApiResponse<LoginResponse>> => {
    try {
      const response = await api.post('/auth/verify-otp', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'OTP verification failed');
    }
  },

  // Resend OTP if needed
  resendOTP: async (email: string): Promise<ApiResponse<RegisterResponse>> => {
    try {
      const response = await api.post('/auth/resend-otp', { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to resend OTP');
    }
  },

  // Login user
  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>> => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  // Get current user
  getMe: async (): Promise<ApiResponse<User>> => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get user data');
    }
  },

  // Logout user
  logout: async (): Promise<ApiResponse<{}>> => {
    try {
      const response = await api.post('/auth/logout');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Logout failed');
    }
  },
};

// Absence interfaces
interface Absence {
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
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  dayCount: number;
  approvedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateAbsenceRequest {
  type: 'Vacation' | 'Sick Leave' | 'Personal Leave' | 'Emergency' | 'Training' | 'Other';
  startDate: string;
  endDate: string;
  reason?: string;
  requestType: 'Request' | 'Declaration';
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  dayCount?: number;
}

// Absence API functions
export const absenceAPI = {
  // Create absence request
  createAbsence: async (absenceData: CreateAbsenceRequest): Promise<ApiResponse<Absence>> => {
    try {
      const response = await api.post('/absences', absenceData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create absence request');
    }
  },

  // Get user's own absences
  getMyAbsences: async (): Promise<ApiResponse<Absence[]>> => {
    try {
      const response = await api.get('/absences/my-absences');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch absences');
    }
  },

  // Get single absence
  getAbsence: async (id: string): Promise<ApiResponse<Absence>> => {
    try {
      const response = await api.get(`/absences/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch absence');
    }
  },

  // Update absence (for pending requests)
  updateAbsence: async (id: string, updateData: Partial<CreateAbsenceRequest>): Promise<ApiResponse<Absence>> => {
    try {
      const response = await api.put(`/absences/${id}`, updateData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update absence');
    }
  },

  // Delete absence (for pending requests)
  deleteAbsence: async (id: string): Promise<ApiResponse<{}>> => {
    try {
      const response = await api.delete(`/absences/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete absence');
    }
  },

  // Declare absence (admin creates absence for user)
  declareAbsence: async (absenceData: CreateAbsenceRequest & { userId: string }): Promise<ApiResponse<Absence>> => {
    try {
      const response = await api.post('/absences/declare', absenceData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to declare absence');
    }
  },

  // Get user's absence history with calendar data
  getAbsenceHistory: async (userId: string): Promise<ApiResponse<{
    absenceHistory: Absence[];
    calendarData: { [key: string]: any };
    stats: {
      totalAbsences: number;
      totalDays: number;
      thisMonth: number;
    };
  }>> => {
    try {
      const response = await api.get(`/absences/history/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch absence history');
    }
  },

  // Get absence calendar data for date range
  getAbsenceCalendar: async (userId: string, startDate?: string, endDate?: string): Promise<ApiResponse<{ [key: string]: any }>> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const queryString = params.toString();
      const url = `/absences/calendar/${userId}${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch calendar data');
    }
  },

  // Get pending absence requests (Admin/HR only)
  getPendingAbsences: async (): Promise<ApiResponse<Absence[]>> => {
    try {
      const response = await api.get('/absences/pending');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch pending absences');
    }
  },

  // Approve absence request (Admin/HR only)
  approveAbsence: async (id: string): Promise<ApiResponse<Absence>> => {
    try {
      const response = await api.put(`/absences/${id}/approve`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to approve absence');
    }
  },

  // Reject absence request (Admin/HR only)
  rejectAbsence: async (id: string, rejectionReason?: string): Promise<ApiResponse<Absence>> => {
    try {
      const response = await api.put(`/absences/${id}/reject`, { rejectionReason });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to reject absence');
    }
  },
};

// Messaging interfaces
interface Conversation {
  _id: string;
  participants: User[];
  type: 'direct' | 'group';
  name?: string;
  lastMessage?: Message;
  lastActivity: string;
  unreadCount: number;
  otherParticipant?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: User;
  content: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'contact' | 'location' | 'system';
  attachments: Attachment[];
  replyTo?: Message;
  reactions: { [emoji: string]: User[] };
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  readBy: { [userId: string]: string };
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Attachment {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

interface MailData {
  recipient: string;
  subject: string;
  body: string;
  attachments: {
    uri: string;
    name: string;
    size: number;
    mimeType: string;
  }[];
}

interface MailResponse {
  success: boolean;
  messageId: string;
  conversationId?: string;
  message: string;
}

// Messaging API functions
// User API functions
export const userAPI = {
  // Get all users (for admins and RH)
  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    try {
      const response = await api.get('/users');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch users');
    }
  },

  // Get messaging contacts (for all authenticated users)
  getMessagingContacts: async (): Promise<ApiResponse<User[]>> => {
    try {
      const response = await api.get('/users/contacts');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch contacts');
    }
  },

  // Get single user
  getUser: async (id: string): Promise<ApiResponse<User>> => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch user');
    }
  },

  // Update user
  updateUser: async (id: string, userData: Partial<User>): Promise<ApiResponse<User>> => {
    try {
      const response = await api.put(`/users/${id}`, userData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update user');
    }
  },
};

export const messagingAPI = {
  // Conversations
  getConversations: async (): Promise<ApiResponse<Conversation[]>> => {
    try {
      const response = await api.get('/conversations');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch conversations');
    }
  },

  createConversation: async (data: { type: 'direct' | 'group', participants: string[], name?: string }): Promise<ApiResponse<Conversation>> => {
    try {
      // 🔍 DEBUG: Log the request being sent
      console.log('🚀 Creating conversation with data:', data);

      // Convert frontend format to backend format
      let payload: any;
      
      if (data.type === 'direct' && data.participants.length === 1) {
        // For direct conversations, send participantId (singular)
        payload = {
          participantId: data.participants[0],
          type: data.type,
          name: data.name
        };
      } else {
        // For group conversations or multiple participants, send participants array
        payload = {
          participants: data.participants,
          type: data.type,
          name: data.name
        };
      }

      console.log('📤 Sending payload to backend:', payload);

      const response = await api.post('/conversations', payload);
      
      console.log('✅ Conversation created successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Conversation creation failed:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        payload: data
      });
      throw new Error(error.response?.data?.message || error.response?.data?.error || 'Failed to create conversation');
    }
  },

  // Messages
  getMessages: async (conversationId: string, page: number = 1, limit: number = 50): Promise<ApiResponse<Message[]>> => {
    try {
      const response = await api.get(`/conversations/${conversationId}/messages`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch messages');
    }
  },

  sendMessage: async (conversationId: string, content: string, type: string = 'text', replyTo?: string): Promise<ApiResponse<Message>> => {
    try {
      // 🔍 DEBUG: Log the request being sent
      console.log('🚀 Sending message:', {
        conversationId,
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        type,
        replyTo,
        endpoint: `/conversations/${conversationId}/messages`
      });

      const payload = {
        content,
        type,
        replyTo
      };

      console.log('📤 Message payload:', payload);

      const response = await api.post(`/conversations/${conversationId}/messages`, payload);
      
      console.log('✅ Message sent successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Message sending failed:', {
        conversationId,
        error: error.response?.data || error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        payload: { content, type, replyTo }
      });

      // Return more specific error messages
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          `Failed to send message (${error.response?.status || 'Network Error'})`;
      
      throw new Error(errorMessage);
    }
  },

  sendMessageWithFiles: async (conversationId: string, content: string, files: any[], type: string = 'text', replyTo?: string): Promise<ApiResponse<Message>> => {
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('type', type);
      if (replyTo) formData.append('replyTo', replyTo);

      // Add files to FormData
      files.forEach((file, index) => {
        formData.append('files', {
          uri: file.uri,
          type: file.mimeType || file.type,
          name: file.name || `file_${index}`,
        } as any);
      });

      const response = await api.post(`/conversations/${conversationId}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to send message with files');
    }
  },

  deleteMessage: async (messageId: string): Promise<ApiResponse<{}>> => {
    try {
      const response = await api.delete(`/conversations/messages/${messageId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete message');
    }
  },

  // Search
  searchMessages: async (query: string, conversationId?: string): Promise<ApiResponse<Message[]>> => {
    try {
      const params: any = { q: query };
      if (conversationId) params.conversationId = conversationId;
      
      const response = await api.get('/conversations/search', { params });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to search messages');
    }
  },

  // File upload
  uploadFiles: async (conversationId: string, files: any[]): Promise<ApiResponse<{ files: Attachment[] }>> => {
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append('files', {
          uri: file.uri,
          type: file.mimeType || file.type,
          name: file.name || `file_${index}`,
        } as any);
      });

      const response = await api.post(`/conversations/${conversationId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to upload files');
    }
  },

  // Send Email
  sendMail: async (mailData: MailData): Promise<ApiResponse<MailResponse>> => {
    try {
      const formData = new FormData();
      formData.append('recipient', mailData.recipient);
      formData.append('subject', mailData.subject);
      formData.append('body', mailData.body);

      // Add attachments to FormData
      mailData.attachments.forEach((attachment, index) => {
        formData.append('attachments', {
          uri: attachment.uri,
          type: attachment.mimeType,
          name: attachment.name,
        } as any);
      });

      const response = await api.post('/mail/send', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      // Preserve the original error structure for better error handling
      const emailError = new Error(error.response?.data?.message || error.response?.data?.error || 'Failed to send email');
      (emailError as any).response = error.response; // Attach original response for error handling
      throw emailError;
    }
  },
};

// Health check function
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.data.status === 'OK';
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
};

export default api; 