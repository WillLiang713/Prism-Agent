import type { PersistStorage, StorageValue } from 'zustand/middleware';

import type {
  DesktopConfig,
  RuntimeModelConfig,
  ServiceConfig,
  ThemeMode,
  Topic,
} from './types';

export const STORAGE_KEYS = {
  config: 'prismConfig',
  topics: 'prismTopicsV1',
  activeTopicId: 'prismActiveTopicId',
  isSidebarCollapsed: 'prismIsSidebarCollapsed',
  theme: 'prismTheme',
  pinnedDirectories: 'prismPinnedDirectoriesV1',
} as const;

type ConfigPersistedShape = {
  version: number;
  serviceManagerSelectedId: string | null;
  services: ServiceConfig[];
  runtime: RuntimeModelConfig;
  desktop: DesktopConfig;
};

export function readRawJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    if (typeof fallback === 'string' || fallback === null) {
      return raw as T;
    }
    if (typeof fallback === 'boolean') {
      return (raw === 'true') as T;
    }
    return fallback;
  }
}

export function createConfigPersistStorage<TState extends object>(
  readState: (state: TState) => ConfigPersistedShape,
  fromPersisted: (persisted: Partial<ConfigPersistedShape>) => TState,
): PersistStorage<TState> {
  return {
    getItem: () => {
      const raw = readRawJson<Partial<ConfigPersistedShape>>(STORAGE_KEYS.config, {});
      return {
        state: fromPersisted(raw),
        version: 2,
      };
    },
    setItem: (_name, value) => {
      const storageValue = value as StorageValue<TState>;
      const persisted = readState(storageValue.state);
      window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(persisted));
    },
    removeItem: () => {
      window.localStorage.removeItem(STORAGE_KEYS.config);
    },
  };
}

export function createTopicsPersistStorage<TState extends object>(
  readState: (state: TState) => { topics: Topic[]; activeTopicId: string | null },
  fromPersisted: (topics: Topic[], activeTopicId: string | null) => TState,
): PersistStorage<TState> {
  return {
    getItem: () => {
      const topics = readRawJson<Topic[]>(STORAGE_KEYS.topics, []);
      const activeTopicId = readRawJson<string | null>(STORAGE_KEYS.activeTopicId, null);
      return {
        state: fromPersisted(Array.isArray(topics) ? topics : [], activeTopicId),
        version: 1,
      };
    },
    setItem: (_name, value) => {
      const storageValue = value as StorageValue<TState>;
      const { topics, activeTopicId } = readState(storageValue.state);
      window.localStorage.setItem(STORAGE_KEYS.topics, JSON.stringify(topics));
      if (activeTopicId) {
        window.localStorage.setItem(STORAGE_KEYS.activeTopicId, JSON.stringify(activeTopicId));
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.activeTopicId);
      }
    },
    removeItem: () => {
      window.localStorage.removeItem(STORAGE_KEYS.topics);
      window.localStorage.removeItem(STORAGE_KEYS.activeTopicId);
    },
  };
}

export function createUiPersistStorage<TState extends object>(
  readState: (state: TState) => { theme: ThemeMode; isSidebarCollapsed: boolean },
  fromPersisted: (payload: {
    theme: ThemeMode;
    isSidebarCollapsed: boolean;
  }) => TState,
): PersistStorage<TState> {
  return {
    getItem: () => {
      const theme = readRawJson<ThemeMode>(STORAGE_KEYS.theme, 'dark');
      const isSidebarCollapsed = readRawJson<boolean>(STORAGE_KEYS.isSidebarCollapsed, false);
      return {
        state: fromPersisted({ theme, isSidebarCollapsed }),
        version: 1,
      };
    },
    setItem: (_name, value) => {
      const storageValue = value as StorageValue<TState>;
      const payload = readState(storageValue.state);
      window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(payload.theme));
      window.localStorage.setItem(
        STORAGE_KEYS.isSidebarCollapsed,
        JSON.stringify(payload.isSidebarCollapsed),
      );
    },
    removeItem: () => {
      window.localStorage.removeItem(STORAGE_KEYS.theme);
      window.localStorage.removeItem(STORAGE_KEYS.isSidebarCollapsed);
    },
  };
}

export function createAgentSessionPersistStorage<TState extends object>(
  readState: (state: TState) => { pinnedDirectories: string[] },
  fromPersisted: (pinnedDirectories: string[]) => TState,
): PersistStorage<TState> {
  return {
    getItem: () => {
      const pinned = readRawJson<string[]>(STORAGE_KEYS.pinnedDirectories, []);
      return {
        state: fromPersisted(Array.isArray(pinned) ? pinned : []),
        version: 1,
      };
    },
    setItem: (_name, value) => {
      const storageValue = value as StorageValue<TState>;
      const { pinnedDirectories } = readState(storageValue.state);
      window.localStorage.setItem(STORAGE_KEYS.pinnedDirectories, JSON.stringify(pinnedDirectories));
    },
    removeItem: () => {
      window.localStorage.removeItem(STORAGE_KEYS.pinnedDirectories);
    },
  };
}
