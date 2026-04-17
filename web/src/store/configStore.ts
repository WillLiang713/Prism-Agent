import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createConfigPersistStorage } from '../lib/storage';
import type {
  ConnectivityState,
  DesktopConfig,
  ReasoningEffort,
  RuntimeModelConfig,
  ServiceConfig,
  ServiceModelConfig,
} from '../lib/types';
import { createId } from '../lib/utils';

type ConfigStoreState = {
  serviceManagerSelectedId: string | null;
  services: ServiceConfig[];
  runtimeModelConfig: RuntimeModelConfig;
  desktop: DesktopConfig;
  setServiceManagerSelectedId: (serviceId: string) => void;
  upsertService: (service: Partial<ServiceConfig> & { id?: string }) => string;
  removeService: (serviceId: string) => void;
  updateRuntimeModelConfig: (patch: Partial<RuntimeModelConfig>) => void;
  updateDesktopConfig: (patch: Partial<DesktopConfig>) => void;
  getSelectedService: () => ServiceConfig | null;
  getServiceById: (serviceId: string | null | undefined) => ServiceConfig | null;
  getRuntimeRequestConfig: (mode?: 'main' | 'title') => {
    provider: ServiceModelConfig['provider'];
    providerSelection: ServiceModelConfig['providerSelection'];
    endpointMode: ServiceModelConfig['endpointMode'];
    apiKey: string;
    model: string;
    apiUrl: string;
    systemPrompt: string;
    reasoningEffort: ReasoningEffort;
    serviceName: string;
  };
};

function createConnectivityState(): ConnectivityState {
  return {
    status: 'idle',
    message: '',
    testedAt: 0,
  };
}

function createDefaultService(): ServiceConfig {
  const id = createId();
  return {
    id,
    name: '默认服务',
    model: {
      provider: 'openai',
      providerSelection: 'openai_chat',
      endpointMode: 'chat_completions',
      apiKey: '',
      model: '',
      modelServiceId: '',
      titleModel: '',
      titleModelServiceId: '',
      apiUrl: '',
      systemPrompt: '',
    },
    reasoningEffort: 'high',
    connectivity: createConnectivityState(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createDefaultRuntimeConfig(): RuntimeModelConfig {
  return {
    model: '',
    modelServiceId: '',
    titleModel: '',
    titleModelServiceId: '',
    systemPrompt: '',
    reasoningEffort: 'high',
  };
}

function normalizeServices(services: ServiceConfig[] | undefined) {
  if (services && services.length > 0) {
    return services;
  }
  return [createDefaultService()];
}

export function resolveSelectedService(
  services: ServiceConfig[],
  serviceManagerSelectedId: string | null,
) {
  return services.find((service) => service.id === serviceManagerSelectedId) || services[0] || null;
}

export function resolveRuntimeRequestConfig(
  services: ServiceConfig[],
  runtimeModelConfig: RuntimeModelConfig,
  serviceManagerSelectedId: string | null,
  mode: 'main' | 'title' = 'main',
) {
  const fallbackService = resolveSelectedService(services, serviceManagerSelectedId);
  const sourceServiceId =
    mode === 'title'
      ? runtimeModelConfig.titleModelServiceId || runtimeModelConfig.modelServiceId
      : runtimeModelConfig.modelServiceId;
  const sourceService =
    services.find((service) => service.id === sourceServiceId) || fallbackService;
  const model =
    mode === 'title'
      ? runtimeModelConfig.titleModel ||
        runtimeModelConfig.model ||
        sourceService?.model.titleModel ||
        sourceService?.model.model ||
        ''
      : runtimeModelConfig.model || sourceService?.model.model || '';

  return {
    provider: sourceService?.model.provider || 'openai',
    providerSelection: sourceService?.model.providerSelection || 'openai_chat',
    endpointMode: sourceService?.model.endpointMode || 'chat_completions',
    apiKey: sourceService?.model.apiKey || '',
    model,
    apiUrl: sourceService?.model.apiUrl || '',
    systemPrompt: runtimeModelConfig.systemPrompt || sourceService?.model.systemPrompt || '',
    reasoningEffort: runtimeModelConfig.reasoningEffort,
    serviceName: sourceService?.name || '',
  };
}

export const useConfigStore = create<ConfigStoreState>()(
  persist(
    (set, get) => ({
      serviceManagerSelectedId: null,
      services: normalizeServices(undefined),
      runtimeModelConfig: createDefaultRuntimeConfig(),
      desktop: {
        closeToTrayOnClose: true,
      },
      setServiceManagerSelectedId: (serviceId) => {
        set({ serviceManagerSelectedId: serviceId });
      },
      upsertService: (service) => {
        const id = service.id || createId();
        const currentServices = get().services;
        const existing = currentServices.find((item) => item.id === id);
        const nextService: ServiceConfig = {
          ...(existing || createDefaultService()),
          ...service,
          id,
          model: {
            ...(existing?.model || createDefaultService().model),
            ...(service.model || {}),
          },
          connectivity: {
            ...(existing?.connectivity || createConnectivityState()),
            ...(service.connectivity || {}),
          },
          updatedAt: Date.now(),
        };

        const nextServices = existing
          ? currentServices.map((item) => (item.id === id ? nextService : item))
          : [nextService, ...currentServices];

        set((state) => ({
          services: nextServices,
          serviceManagerSelectedId: state.serviceManagerSelectedId || id,
        }));
        return id;
      },
      removeService: (serviceId) => {
        const nextServices = get().services.filter((service) => service.id !== serviceId);
        const ensuredServices = normalizeServices(nextServices);
        set({
          services: ensuredServices,
          serviceManagerSelectedId: ensuredServices[0]?.id || null,
        });
      },
      updateRuntimeModelConfig: (patch) => {
        set((state) => ({
          runtimeModelConfig: {
            ...state.runtimeModelConfig,
            ...patch,
          },
        }));
      },
      updateDesktopConfig: (patch) => {
        set((state) => ({
          desktop: {
            ...state.desktop,
            ...patch,
          },
        }));
      },
      getSelectedService: () => {
        const { services, serviceManagerSelectedId } = get();
        return resolveSelectedService(services, serviceManagerSelectedId);
      },
      getServiceById: (serviceId) => {
        if (!serviceId) {
          return null;
        }
        return get().services.find((service) => service.id === serviceId) || null;
      },
      getRuntimeRequestConfig: (mode = 'main') => {
        const state = get();
        return resolveRuntimeRequestConfig(
          state.services,
          state.runtimeModelConfig,
          state.serviceManagerSelectedId,
          mode,
        );
      },
    }),
    {
      name: 'prism-config-store',
      version: 2,
      storage: createConfigPersistStorage<ConfigStoreState>(
        (state) => ({
          version: 2,
          serviceManagerSelectedId:
            state.serviceManagerSelectedId || state.services[0]?.id || null,
          services: state.services,
          runtime: state.runtimeModelConfig,
          desktop: state.desktop,
        }),
        (persisted) => ({
          serviceManagerSelectedId:
            persisted.serviceManagerSelectedId ||
            persisted.services?.[0]?.id ||
            normalizeServices(undefined)[0].id,
          services: normalizeServices(persisted.services),
          runtimeModelConfig: persisted.runtime || createDefaultRuntimeConfig(),
          desktop: { closeToTrayOnClose: true },
        }) as ConfigStoreState,
      ),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<ConfigStoreState>),
      }),
      migrate: (persistedState) => persistedState as ConfigStoreState,
    },
  ),
);
