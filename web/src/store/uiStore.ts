import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createUiPersistStorage } from '../lib/storage';
import type { ThemeMode } from '../lib/types';

type UIStoreState = {
  theme: ThemeMode;
  isSidebarCollapsed: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
};

export const useUIStore = create<UIStoreState>()(
  persist(
    (set) => ({
      theme: 'dark',
      isSidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    }),
    {
      name: 'prism-ui-store',
      version: 1,
      storage: createUiPersistStorage<UIStoreState>(
        (state) => ({
          theme: state.theme,
          isSidebarCollapsed: state.isSidebarCollapsed,
        }),
        (payload) => ({
          theme: payload.theme,
          isSidebarCollapsed: payload.isSidebarCollapsed,
        }) as UIStoreState,
      ),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<UIStoreState>),
      }),
      migrate: (persistedState) => persistedState as UIStoreState,
    },
  ),
);
