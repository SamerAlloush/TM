import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Note: Install @react-native-community/netinfo for network detection
// npm install @react-native-community/netinfo

interface SocketEventHandlers {
  'message:new': (data: any) => void;
  'message:read': (data: any) => void;
  'message:reaction': (data: any) => void;
  'typing:start': (data: any) => void;
  'typing:stop': (data: any) => void;
  'user:online': (data: any) => void;
  'user:offline': (data: any) => void;
  'conversation:joined': (data: any) => void;
  'error': (data: any) => void;
  'connect': () => void;
  'disconnect': () => void;
  'connect_error': (error: any) => void;
  // New events for connection status
  'connection:status': (status: ConnectionStatus) => void;
  'connection:notification': (notification: ConnectionNotification) => void;
  // Absence request events
  'absence:new': (data: any) => void;
  'absence:approved': (data: any) => void;
  'absence:rejected': (data: any) => void;
  'absenceUpdated': (data: any) => void;
  'absenceApproved': (data: any) => void;
  'absenceRejected': (data: any) => void;
  'absenceDeclared': (data: any) => void;
  // Intervention request events
  'intervention:new': (data: any) => void;
  'intervention:statusUpdate': (data: any) => void;
  'intervention:assigned': (data: any) => void;
  'intervention:comment': (data: any) => void;
  // Upload progress events
  'upload:progress': (data: any) => void;
  'upload:error': (data: any) => void;
  'upload:complete': (data: any) => void;
  'media_upload_complete': (data: any) => void;
  'media:upload_start': (data: any) => void;
  'media:upload_progress': (data: any) => void;
}

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  isOnline: boolean;
  lastConnected?: Date;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
  nextReconnectIn?: number;
}

export interface ConnectionNotification {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private eventHandlers: Partial<SocketEventHandlers> = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 15; // Increased max attempts
  private baseReconnectInterval: number = 1000; // Start with 1 second
  private maxReconnectInterval: number = 30000; // Max 30 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageQueue: Array<{event: string, data: any}> = [];
  private connectionStatus: ConnectionStatus = {
    status: 'disconnected',
    isOnline: false,
    maxReconnectAttempts: this.maxReconnectAttempts
  };
  private lastConnectionTime: Date | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isManualDisconnect: boolean = false;
  private networkRetryCount: number = 0;
  private maxNetworkRetries: number = 3;

  constructor() {
    // Auto-connect when service is instantiated if user is logged in
    this.initializeConnection();
    this.setupNetworkListener();
  }

  private async initializeConnection() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        this.connect();
      }
    } catch (error) {
      console.error('Error initializing socket connection:', error);
      this.notifyUser('error', 'Initialization Failed', 'Failed to initialize connection');
    }
  }

  private setupNetworkListener() {
    // For now, assume online - users can install @react-native-community/netinfo for advanced network detection
    this.connectionStatus.isOnline = true;
    
    // TODO: Uncomment when @react-native-community/netinfo is installed
    // NetInfo.addEventListener((state: NetInfoState) => {
    //   console.log('📶 Network state changed:', {
    //     isConnected: state.isConnected,
    //     type: state.type,
    //     socketConnected: this.isConnected
    //   });

    //   const wasOffline = !this.connectionStatus.isOnline;
    //   this.connectionStatus.isOnline = state.isConnected ?? false;

    //   // If we just came back online and socket is not connected, try to reconnect
    //   if (wasOffline && this.connectionStatus.isOnline && !this.isConnected && !this.isManualDisconnect) {
    //     console.log('🔄 Network back online, attempting socket reconnection');
    //     this.networkRetryCount = 0; // Reset network retry count
    //     setTimeout(() => {
    //       this.handleReconnect();
    //     }, 1000);
    //   }

    //   // If we went offline, update connection status
    //   if (!this.connectionStatus.isOnline && this.isConnected) {
    //     this.updateConnectionStatus('disconnected');
    //     this.notifyUser('warning', 'Network Offline', 'Connection lost due to network issues');
    //   }

    //   this.emitConnectionStatus();
    // });
  }

  private calculateReconnectDelay(): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.baseReconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectInterval
    );
    
    // Add jitter (±25%) to prevent thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    return Math.round(exponentialDelay + jitter);
  }

  public async connect(): Promise<void> {
    try {
      if (this.socket?.connected) {
        console.log('✅ Socket already connected');
        this.updateConnectionStatus('connected');
        return;
      }

      if (this.connectionStatus.status === 'connecting') {
        console.log('🔄 Connection already in progress');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('❌ No auth token found, cannot connect to socket');
        this.updateConnectionStatus('disconnected');
        this.notifyUser('error', 'Authentication Required', 'Please log in to connect');
        return;
      }

      this.isManualDisconnect = false;
      this.updateConnectionStatus('connecting');
      console.log(`🔌 Attempting to connect to Socket.IO server... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

      const serverUrl = __DEV__ 
        ? 'http://localhost:5000' 
        : 'https://your-production-api.com';

      this.socket = io(serverUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 30000, // 30s timeout to match backend
        forceNew: false,
        reconnection: true, // Enable automatic reconnection
        reconnectionAttempts: 15, // More attempts
        reconnectionDelay: 2000, // 2s delay between attempts
        reconnectionDelayMax: 10000, // Max 10s delay
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: true,
        closeOnBeforeunload: false, // Prevent disconnect on page refresh
        forceBase64: false // Allow binary for better performance
      });

      this.setupEventListeners();
      
    } catch (error) {
      console.error('❌ Socket connection error:', error);
      this.updateConnectionStatus('disconnected');
      this.handleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnected = true;
      this.lastConnectionTime = new Date();
      this.connectionStatus.lastConnected = this.lastConnectionTime;
      this.reconnectAttempts = 0;
      this.networkRetryCount = 0;
      this.updateConnectionStatus('connected');
      
      // Clear any pending reconnection timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Process any queued messages
      this.processMessageQueue();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Notify user of successful connection
      if (this.reconnectAttempts > 0) {
        this.notifyUser('success', 'Connected', 'Successfully reconnected to server');
      }
      
      this.eventHandlers['connect']?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.updateConnectionStatus('disconnected');
      this.eventHandlers['disconnect']?.();
      
      // Intelligent disconnect reason handling
      switch (reason) {
        case 'io server disconnect':
          console.log('🔄 Server initiated disconnect, will reconnect immediately');
          this.notifyUser('warning', 'Server Disconnected', 'Server closed connection, reconnecting...');
          this.handleReconnect(500); // Quick reconnect for server-initiated disconnects
          break;
          
        case 'transport close':
          console.log('🔄 Transport closed, using exponential backoff');
          this.notifyUser('warning', 'Connection Lost', 'Connection interrupted, reconnecting...');
          this.handleReconnect();
          break;
          
        case 'transport error':
          console.log('🔄 Transport error, reconnecting with delay');
          this.notifyUser('error', 'Connection Error', 'Network error occurred, retrying...');
          this.handleReconnect();
          break;
          
        case 'ping timeout':
          console.log('🔄 Ping timeout, reconnecting immediately');
          this.notifyUser('warning', 'Connection Timeout', 'Server not responding, reconnecting...');
          this.handleReconnect(1000);
          break;
          
        case 'io client disconnect':
          console.log('📱 Client initiated disconnect, not reconnecting');
          this.isManualDisconnect = true;
          // Don't reconnect for intentional client disconnects
          break;
          
        default:
          console.log('🔄 Unknown disconnect reason, using default reconnect logic');
          console.log('Disconnect reason details:', reason);
          this.notifyUser('warning', 'Disconnected', 'Connection lost, attempting to reconnect...');
          this.handleReconnect();
          break;
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚫 Socket connection error:', {
        message: error.message,
        description: (error as any).description,
        type: (error as any).type,
        context: (error as any).context
      });
      this.isConnected = false;
      this.eventHandlers['connect_error']?.(error);
      
      // Handle specific error types
      if (error.message?.includes('Authentication') || error.message?.includes('token')) {
        console.log('🔑 Authentication error detected');
        this.notifyUser('error', 'Authentication Failed', 'Please log in again');
        // Could trigger automatic token refresh here
      } else if (error.message?.includes('timeout')) {
        this.notifyUser('error', 'Connection Timeout', 'Server took too long to respond');
      } else {
        this.notifyUser('error', 'Connection Error', `Failed to connect: ${error.message}`);
      }
      
      this.handleReconnect();
    });

    // Messaging events
    this.socket.on('message:new', (data) => {
      console.log('📨 New message received:', data);
      this.eventHandlers['message:new']?.(data);
    });

    this.socket.on('message:read', (data) => {
      console.log('👁️ Message read:', data);
      this.eventHandlers['message:read']?.(data);
    });

    this.socket.on('message:reaction', (data) => {
      console.log('😀 Message reaction:', data);
      this.eventHandlers['message:reaction']?.(data);
    });

    // Typing indicators
    this.socket.on('typing:start', (data) => {
      this.eventHandlers['typing:start']?.(data);
    });

    this.socket.on('typing:stop', (data) => {
      this.eventHandlers['typing:stop']?.(data);
    });

    // User presence events
    this.socket.on('user:online', (data) => {
      this.eventHandlers['user:online']?.(data);
    });

    this.socket.on('user:offline', (data) => {
      this.eventHandlers['user:offline']?.(data);
    });

    // Conversation events
    this.socket.on('conversation:joined', (data) => {
      this.eventHandlers['conversation:joined']?.(data);
    });

    // Error handling
    this.socket.on('error', (data) => {
      console.error('🚫 Socket error:', data);
      this.eventHandlers['error']?.(data);
      this.notifyUser('error', 'Socket Error', data.message || 'An error occurred');
    });
  }

  private async handleReconnect(customDelay?: number): Promise<void> {
    // Don't reconnect if manually disconnected or no network
    if (this.isManualDisconnect || !this.connectionStatus.isOnline) {
      console.log('🚫 Skipping reconnect - manual disconnect or no network');
      return;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      this.updateConnectionStatus('disconnected');
      this.notifyUser('error', 'Connection Failed', 'Unable to reconnect. Please check your connection and try again.');
      return;
    }

    // Basic network check - can be enhanced with NetInfo
    if (!this.connectionStatus.isOnline) {
      console.log('📶 No network connectivity, waiting for network...');
      this.updateConnectionStatus('disconnected');
      if (this.networkRetryCount < this.maxNetworkRetries) {
        this.networkRetryCount++;
        setTimeout(() => this.handleReconnect(), 5000);
      }
      return;
    }

    this.reconnectAttempts++;
    this.updateConnectionStatus('reconnecting');

    const delay = customDelay || this.calculateReconnectDelay();
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    // Update connection status with countdown
    this.connectionStatus.nextReconnectIn = delay;
    this.emitConnectionStatus();

    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      console.log(`🔄 Executing reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connectionStatus.nextReconnectIn = undefined;
      
      // Clean up existing socket before reconnecting
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }
      
      await this.connect();
    }, delay);
  }

     private updateConnectionStatus(status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'): void {
     this.connectionStatus.status = status;
     this.connectionStatus.reconnectAttempt = this.reconnectAttempts;
     this.emitConnectionStatus();
   }
 
   private emitConnectionStatus(): void {
     this.eventHandlers['connection:status']?.(this.connectionStatus);
   }
 
   private notifyUser(type: 'success' | 'warning' | 'error' | 'info', title: string, message: string, duration?: number): void {
     const notification: ConnectionNotification = {
       type,
       title,
       message,
       duration: duration || (type === 'error' ? 5000 : 3000)
     };
     this.eventHandlers['connection:notification']?.(notification);
   }
 
   private startHeartbeat(): void {
     this.stopHeartbeat(); // Clear any existing heartbeat
     
     this.heartbeatInterval = setInterval(() => {
       if (this.socket?.connected) {
         this.socket.emit('ping', { timestamp: Date.now() });
       }
     }, 30000); // Send heartbeat every 30 seconds
   }
 
   private stopHeartbeat(): void {
     if (this.heartbeatInterval) {
       clearInterval(this.heartbeatInterval);
       this.heartbeatInterval = null;
     }
   }

  private processMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`📤 Processing ${this.messageQueue.length} queued messages...`);
      
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message && this.socket?.connected) {
          console.log(`📤 Sending queued message: ${message.event}`);
          this.socket.emit(message.event, message.data);
        }
      }
    }
  }

  private queueMessage(event: string, data: any): void {
    console.log(`📬 Queueing message: ${event}`);
    this.messageQueue.push({ event, data });
    
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 50) {
      console.log('⚠️ Message queue limit reached, removing oldest message');
      this.messageQueue.shift();
    }
  }

  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
    }
  }

  // Event subscription methods
  public on<K extends keyof SocketEventHandlers>(event: K, handler: SocketEventHandlers[K]): void {
    this.eventHandlers[event] = handler;
  }

  public off<K extends keyof SocketEventHandlers>(event: K): void {
    delete this.eventHandlers[event];
  }

  // Messaging methods
  public sendMessage(data: {
    conversationId: string;
    content: string;
    type?: string;
    attachments?: any[];
    replyTo?: string;
  }): void {
    if (!this.isConnected || !this.socket) {
      console.log('📬 Socket not connected, queueing message');
      this.queueMessage('message:send', data);
      return;
    }
    
    console.log('📤 Sending message:', data);
    this.socket.emit('message:send', data);
  }

  public joinConversation(conversationId: string): void {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected, cannot join conversation');
      return;
    }
    
    console.log('👥 Joining conversation:', conversationId);
    this.socket.emit('conversation:join', conversationId);
  }

  public leaveConversation(conversationId: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }
    
    console.log('👋 Leaving conversation:', conversationId);
    this.socket.emit('conversation:leave', conversationId);
  }

  public startTyping(conversationId: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }
    
    this.socket.emit('typing:start', { conversationId });
  }

  public stopTyping(conversationId: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }
    
    this.socket.emit('typing:stop', { conversationId });
  }

  public markMessageAsRead(messageId: string, conversationId: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }
    
    this.socket.emit('message:read', { messageId, conversationId });
  }

  public reactToMessage(messageId: string, emoji: string, action: 'add' | 'remove' = 'add'): void {
    if (!this.isConnected || !this.socket) {
      return;
    }
    
    this.socket.emit('message:react', { messageId, emoji, action });
  }

  // Utility methods
  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }

  public getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  public clearMessageQueue(): void {
    console.log(`🗑️ Clearing ${this.messageQueue.length} queued messages`);
    this.messageQueue = [];
  }

  public forceReconnect(): void {
    console.log('🔄 Force reconnecting...');
    this.reconnectAttempts = 0;
    this.isManualDisconnect = false;
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }

  public resetConnection(): void {
    console.log('🔄 Resetting connection...');
    this.reconnectAttempts = 0;
    this.networkRetryCount = 0;
    this.isManualDisconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.updateConnectionStatus('disconnected');
  }

  public getConnectionStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastConnected: this.lastConnectionTime,
      queuedMessages: this.messageQueue.length,
      socketId: this.socket?.id,
      status: this.connectionStatus.status
    };
  }
}

export default new SocketService();