const DESKTOP_DEFAULT_API_BASE = 'http://127.0.0.1:33100';

export interface PrismRuntimeConfig {
  platform: 'web' | 'desktop';
  apiBase: string;
  backendManagedByDesktop: boolean;
  startupError: string;
}

function resolveRuntimeConfig(): PrismRuntimeConfig {
  const runtime = (window as Window & { __PRISM_RUNTIME__?: Record<string, unknown> })
    .__PRISM_RUNTIME__ || {};
  const params = new URLSearchParams(window.location.search);
  const queryApiBase = (params.get('apiBase') || '').trim();
  const queryPlatform = (params.get('platform') || '').trim();
  const injectedApiBase = String(runtime.apiBase || '').trim();
  const apiBase = (queryApiBase || injectedApiBase || '').replace(/\/+$/, '');
  const platform =
    queryPlatform === 'desktop' || runtime.platform === 'desktop' || apiBase
      ? 'desktop'
      : 'web';

  return {
    platform,
    apiBase: apiBase || (platform === 'desktop' ? DESKTOP_DEFAULT_API_BASE : ''),
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
