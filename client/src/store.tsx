import React, { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type {
  PanelType,
  Session,
  Message,
  GatewayStatus,
  ConnectionStatus,
  Channel,
  CronJob,
  ActivityItem,
  LogEntry,
  Skill,
  Node,
  ConfigEntry,
  ConfigSchema,
  ToastMessage,
  ChatRun,
  ModelOption,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface AppState {
  activePanel: PanelType;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  connectionStatus: ConnectionStatus;
  gatewayStatus: GatewayStatus | null;
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  thinkingEnabled: boolean;
  selectedModel: string;
  models: ModelOption[];
  channels: Channel[];
  cronJobs: CronJob[];
  activityFeed: ActivityItem[];
  logs: LogEntry[];
  skills: Skill[];
  nodes: Node[];
  config: ConfigEntry[];
  configSchema: ConfigSchema[];
  toasts: ToastMessage[];
  pendingRuns: ChatRun[];
}

export const initialState: AppState = {
  activePanel: 'chat',
  sidebarOpen: false,
  commandPaletteOpen: false,
  connectionStatus: 'disconnected',
  gatewayStatus: null,
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  thinkingEnabled: false,
  selectedModel: '',
  models: [],
  channels: [],
  cronJobs: [],
  activityFeed: [],
  logs: [],
  skills: [],
  nodes: [],
  config: [],
  configSchema: [],
  toasts: [],
  pendingRuns: [],
};

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export type AppAction =
  | { type: 'SET_ACTIVE_PANEL'; payload: PanelType }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'TOGGLE_COMMAND_PALETTE' }
  | { type: 'SET_COMMAND_PALETTE_OPEN'; payload: boolean }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_GATEWAY_STATUS'; payload: GatewayStatus | null }
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | null }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; content: string; thinking?: string; isStreaming?: boolean } }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_THINKING_ENABLED'; payload: boolean }
  | { type: 'SET_SELECTED_MODEL'; payload: string }
  | { type: 'SET_MODELS'; payload: ModelOption[] }
  | { type: 'SET_CHANNELS'; payload: Channel[] }
  | { type: 'SET_CRON_JOBS'; payload: CronJob[] }
  | { type: 'ADD_CRON_JOB'; payload: CronJob }
  | { type: 'UPDATE_CRON_JOB'; payload: CronJob }
  | { type: 'DELETE_CRON_JOB'; payload: string }
  | { type: 'ADD_ACTIVITY'; payload: ActivityItem }
  | { type: 'SET_ACTIVITY_FEED'; payload: ActivityItem[] }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'SET_LOGS'; payload: LogEntry[] }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_SKILLS'; payload: Skill[] }
  | { type: 'UPDATE_SKILL'; payload: Skill }
  | { type: 'SET_NODES'; payload: Node[] }
  | { type: 'UPDATE_NODE'; payload: Node }
  | { type: 'SET_CONFIG'; payload: ConfigEntry[] }
  | { type: 'SET_CONFIG_SCHEMA'; payload: ConfigSchema[] }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'ADD_PENDING_RUN'; payload: ChatRun }
  | { type: 'REMOVE_PENDING_RUN'; payload: string }
  | { type: 'CLEAR_PENDING_RUNS' };

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload };

    case 'TOGGLE_COMMAND_PALETTE':
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };

    case 'SET_COMMAND_PALETTE_OPEN':
      return { ...state, commandPaletteOpen: action.payload };

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };

    case 'SET_GATEWAY_STATUS':
      return { ...state, gatewayStatus: action.payload };

    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };

    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload, messages: [] };

    case 'ADD_SESSION':
      return { ...state, sessions: [action.payload, ...state.sessions] };

    case 'REMOVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.payload),
        activeSessionId:
          state.activeSessionId === action.payload ? null : state.activeSessionId,
      };

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id
            ? {
                ...m,
                content: action.payload.content,
                thinking: action.payload.thinking ?? m.thinking,
                isStreaming: action.payload.isStreaming ?? m.isStreaming,
              }
            : m
        ),
      };

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };

    case 'SET_THINKING_ENABLED':
      return { ...state, thinkingEnabled: action.payload };

    case 'SET_SELECTED_MODEL':
      return { ...state, selectedModel: action.payload };

    case 'SET_MODELS':
      return { ...state, models: action.payload };

    case 'SET_CHANNELS':
      return { ...state, channels: action.payload };

    case 'SET_CRON_JOBS':
      return { ...state, cronJobs: action.payload };

    case 'ADD_CRON_JOB':
      return { ...state, cronJobs: [...state.cronJobs, action.payload] };

    case 'UPDATE_CRON_JOB':
      return {
        ...state,
        cronJobs: state.cronJobs.map((job) =>
          job.id === action.payload.id ? action.payload : job
        ),
      };

    case 'DELETE_CRON_JOB':
      return {
        ...state,
        cronJobs: state.cronJobs.filter((job) => job.id !== action.payload),
      };

    case 'ADD_ACTIVITY':
      return {
        ...state,
        activityFeed: [action.payload, ...state.activityFeed].slice(0, 100),
      };

    case 'SET_ACTIVITY_FEED':
      return { ...state, activityFeed: action.payload };

    case 'ADD_LOG':
      return {
        ...state,
        logs: [...state.logs, action.payload].slice(-2000),
      };

    case 'SET_LOGS':
      return { ...state, logs: action.payload };

    case 'CLEAR_LOGS':
      return { ...state, logs: [] };

    case 'SET_SKILLS':
      return { ...state, skills: action.payload };

    case 'UPDATE_SKILL':
      return {
        ...state,
        skills: state.skills.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };

    case 'SET_NODES':
      return { ...state, nodes: action.payload };

    case 'UPDATE_NODE':
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.payload.id ? action.payload : n
        ),
      };

    case 'SET_CONFIG':
      return { ...state, config: action.payload };

    case 'SET_CONFIG_SCHEMA':
      return { ...state, configSchema: action.payload };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };

    case 'ADD_PENDING_RUN':
      return { ...state, pendingRuns: [...state.pendingRuns, action.payload] };

    case 'REMOVE_PENDING_RUN':
      return {
        ...state,
        pendingRuns: state.pendingRuns.filter((r) => r.id !== action.payload),
      };

    case 'CLEAR_PENDING_RUNS':
      return { ...state, pendingRuns: [] };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  return useContext(AppStateContext);
}

export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(AppDispatchContext);
}
