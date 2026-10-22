import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { CmsAppConfig, CmsNavigation, CmsTabNode } from '../types';

const DEFAULT_APP_CONFIG: CmsAppConfig = {
  showLuggageLottery: true,
  enableChaosDice: true,
  enableGraphqlTrips: true,
  minChaosForLegendary: 70,
  defaultDiscoverKey: 'atlantis',
  themePreset: 'midnight',
  maintenanceBanner: '',
  featureFlags: ['graphql-trips', 'lore-remix'],
  configVersion: 1,
  extras: {},
};

interface CmsContextValue {
  navigation: CmsNavigation | null;
  appConfig: CmsAppConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getTab: (screenKey: string) => CmsTabNode | undefined;
  hasFeature: (flag: string) => boolean;
}

const CmsContext = createContext<CmsContextValue | null>(null);

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [navigation, setNavigation] = useState<CmsNavigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await api.cmsNavigation();
      setNavigation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CMS navigation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const appConfig = useMemo(
    () => ({ ...DEFAULT_APP_CONFIG, ...(navigation?.app.config ?? {}) }),
    [navigation]
  );

  const getTab = useCallback(
    (screenKey: string) => navigation?.tabs.find((tab) => tab.screenKey === screenKey),
    [navigation]
  );

  const hasFeature = useCallback(
    (flag: string) => appConfig.featureFlags.includes(flag),
    [appConfig.featureFlags]
  );

  const value = useMemo(
    () => ({ navigation, appConfig, loading, error, refresh, getTab, hasFeature }),
    [navigation, appConfig, loading, error, refresh, getTab, hasFeature]
  );

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}

export function useCms(): CmsContextValue {
  const ctx = useContext(CmsContext);
  if (!ctx) {
    throw new Error('useCms must be used within CmsProvider');
  }
  return ctx;
}
