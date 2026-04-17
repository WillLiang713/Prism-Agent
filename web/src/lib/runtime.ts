export interface PrismRuntimeConfig {
  platform: 'web' | 'desktop' | 'mock';
  apiBase: string;
  authToken: string;
  backendManagedByDesktop: boolean;
  startupError: string;
}

function resolveRuntimeConfig(): PrismRuntimeConfig {
  const runtime = (window as Window & { __PRISM_RUNTIME__?: Record<string, unknown> })
    .__PRISM_RUNTIME__ || {};
  const params = new URLSearchParams(window.location.search);
  const queryApiBase = (params.get('apiBase') || '').trim();
  const queryPlatform = (params.get('platform') || '').trim();
  const queryAuthToken = (params.get('authToken') || '').trim();
  const injectedApiBase = String(runtime.apiBase || '').trim();
  const injectedAuthToken = String(runtime.authToken || '').trim();
  const envApiBase = String(import.meta.env.VITE_PRISM_API_BASE || '').trim();
  const envAuthToken = String(import.meta.env.VITE_PRISM_AUTH_TOKEN || '').trim();
  const envPlatform = String(import.meta.env.VITE_PRISM_PLATFORM || '').trim();
  const apiBase = (queryApiBase || injectedApiBase || envApiBase || '').replace(/\/+$/, '');
  const authToken = queryAuthToken || injectedAuthToken || envAuthToken;
  const explicitPlatform =
    queryPlatform || String(runtime.platform || '').trim() || envPlatform || '';
  const platform =
    explicitPlatform === 'mock'
      ? 'mock'
      : explicitPlatform === 'desktop'
      ? 'desktop'
      : explicitPlatform === 'web'
      ? 'web'
      : apiBase
      ? 'desktop'
      : 'web';

  return {
    platform,
    apiBase,
    authToken,
    backendManagedByDesktop:
      runtime.backendManagedByDesktop === true || platform === 'desktop',
    startupError: String(runtime.startupError || '').trim(),
  };
}

export const runtimeConfig = resolveRuntimeConfig();

export function buildApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return runtimeConfig.apiBase ? `${runtimeConfig.apiBase}${normalized}` : normalized;
}

export function isDesktopRuntime() {
  return runtimeConfig.platform === 'desktop';
}
