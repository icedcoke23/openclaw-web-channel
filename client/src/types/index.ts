export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type PanelType = 'chat' | 'dashboard' | 'sessions' | 'config' | 'logs' | 'skills' | 'nodes' | 'cron' | 'discovery';

export interface Session {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  model?: string;
  tokens?: {
    input?: number;
    output?: number;
  };
  attachments?: Attachment[];
  isStreaming?: boolean;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  url?: string;
  content?: string;
}

export interface ChatRun {
  id: string;
  sessionId: string;
  startedAt: number;
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface GatewayStatus {
  status: ConnectionStatus;
  version?: string;
  uptime?: number;
  model?: string;
  sessions?: number;
  cpu?: number;
  memory?: number;
  disk?: DiskUsage;
}

export interface Channel {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  config?: Record<string, unknown>;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused' | 'error';
  command?: string;
}

export interface ActivityItem {
  id: string;
  type: 'message' | 'session' | 'config' | 'skill' | 'node' | 'error';
  description: string;
  timestamp: number;
  details?: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
  meta?: Record<string, unknown>;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  version?: string;
  category?: string;
  config?: Record<string, unknown>;
}

export interface Node {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'error';
  capabilities?: string[];
  config?: Record<string, unknown>;
  lastSeen?: string;
}

export interface ConfigSchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  enum?: unknown[];
  required?: boolean;
}

export interface ConfigEntry {
  key: string;
  value: unknown;
  description?: string;
  type?: string;
}

export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface RpcEvent {
  method: string;
  params?: Record<string, unknown>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

// Device Management Types
export type DeviceType = 'mobile' | 'desktop' | 'web';
export type DeviceStatus = 'pending' | 'approved' | 'revoked';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  pairedAt: string;
  lastSeen: string;
  ipAddress: string;
}

// Gateway Discovery Types
export interface DiscoveredGateway {
  id: string;
  name: string;
  url: string;
  version?: string;
  lastSeen: string;
  rssi?: number;
}

export interface DiscoveryStatus {
  scanning: boolean;
  found: DiscoveredGateway[];
  lastScan: string | null;
}

// Canvas Types
export interface CanvasElement {
  id: string;
  type: 'rectangle' | 'circle' | 'line' | 'text' | 'image' | 'path';
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  content?: string;
  src?: string;
  points?: Array<{ x: number; y: number }>;
}

export interface CanvasData {
  elements: CanvasElement[];
  background: string;
  width: number;
  height: number;
}
