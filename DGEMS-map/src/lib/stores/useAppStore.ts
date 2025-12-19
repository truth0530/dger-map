/**
 * 전역 상태 관리 스토어 (Zustand)
 * 앱 전반의 상태를 중앙에서 관리
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ===== 타입 정의 =====

export type BedType = 'general' | 'cohort' | 'erNegative' | 'erGeneral' | 'pediatric' | 'pediatricNegative' | 'pediatricGeneral';

interface FilterState {
  selectedRegion: string;
  selectedBedTypes: BedType[];
  showCenterOnly: boolean;
  searchTerm: string;
}

interface UIState {
  isSidebarOpen: boolean;
  isLoading: boolean;
  activeTab: 'bed' | 'severe' | 'messages' | 'map';
  expandedCards: Set<number>;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastUpdated: number | null;
}

interface AppState {
  // 필터 상태
  filters: FilterState;

  // UI 상태
  ui: UIState;

  // 캐시 통계
  cacheStats: CacheStats;

  // 마지막 새로고침 시간
  lastRefresh: Record<string, number>;

  // 액션
  setSelectedRegion: (region: string) => void;
  setSelectedBedTypes: (types: BedType[]) => void;
  toggleBedType: (type: BedType) => void;
  setShowCenterOnly: (show: boolean) => void;
  setSearchTerm: (term: string) => void;
  resetFilters: () => void;

  setLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: UIState['activeTab']) => void;
  toggleCardExpanded: (cardId: number) => void;
  expandAllCards: (cardIds: number[]) => void;
  collapseAllCards: () => void;

  updateCacheStats: (stats: Partial<CacheStats>) => void;
  recordCacheHit: () => void;
  recordCacheMiss: () => void;

  updateLastRefresh: (key: string) => void;
  getTimeSinceRefresh: (key: string) => number | null;
}

// ===== 초기 상태 =====

const initialFilters: FilterState = {
  selectedRegion: '대구',
  selectedBedTypes: [],
  showCenterOnly: false,
  searchTerm: '',
};

const initialUI: UIState = {
  isSidebarOpen: true,
  isLoading: false,
  activeTab: 'bed',
  expandedCards: new Set(),
};

const initialCacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0,
  lastUpdated: null,
};

// ===== 스토어 생성 =====

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      filters: initialFilters,
      ui: initialUI,
      cacheStats: initialCacheStats,
      lastRefresh: {},

      // 필터 액션
      setSelectedRegion: (region) =>
        set((state) => ({
          filters: { ...state.filters, selectedRegion: region },
        })),

      setSelectedBedTypes: (types) =>
        set((state) => ({
          filters: { ...state.filters, selectedBedTypes: types },
        })),

      toggleBedType: (type) =>
        set((state) => {
          const current = state.filters.selectedBedTypes;
          const newTypes = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
          return {
            filters: { ...state.filters, selectedBedTypes: newTypes },
          };
        }),

      setShowCenterOnly: (show) =>
        set((state) => ({
          filters: { ...state.filters, showCenterOnly: show },
        })),

      setSearchTerm: (term) =>
        set((state) => ({
          filters: { ...state.filters, searchTerm: term },
        })),

      resetFilters: () =>
        set((state) => ({
          filters: initialFilters,
        })),

      // UI 액션
      setLoading: (loading) =>
        set((state) => ({
          ui: { ...state.ui, isLoading: loading },
        })),

      setSidebarOpen: (open) =>
        set((state) => ({
          ui: { ...state.ui, isSidebarOpen: open },
        })),

      setActiveTab: (tab) =>
        set((state) => ({
          ui: { ...state.ui, activeTab: tab },
        })),

      toggleCardExpanded: (cardId) =>
        set((state) => {
          const newExpanded = new Set(state.ui.expandedCards);
          if (newExpanded.has(cardId)) {
            newExpanded.delete(cardId);
          } else {
            newExpanded.add(cardId);
          }
          return {
            ui: { ...state.ui, expandedCards: newExpanded },
          };
        }),

      expandAllCards: (cardIds) =>
        set((state) => ({
          ui: { ...state.ui, expandedCards: new Set(cardIds) },
        })),

      collapseAllCards: () =>
        set((state) => ({
          ui: { ...state.ui, expandedCards: new Set() },
        })),

      // 캐시 통계 액션
      updateCacheStats: (stats) =>
        set((state) => ({
          cacheStats: { ...state.cacheStats, ...stats, lastUpdated: Date.now() },
        })),

      recordCacheHit: () =>
        set((state) => ({
          cacheStats: { ...state.cacheStats, hits: state.cacheStats.hits + 1 },
        })),

      recordCacheMiss: () =>
        set((state) => ({
          cacheStats: { ...state.cacheStats, misses: state.cacheStats.misses + 1 },
        })),

      // 새로고침 시간 관리
      updateLastRefresh: (key) =>
        set((state) => ({
          lastRefresh: { ...state.lastRefresh, [key]: Date.now() },
        })),

      getTimeSinceRefresh: (key) => {
        const lastTime = get().lastRefresh[key];
        return lastTime ? Date.now() - lastTime : null;
      },
    }),
    {
      name: 'dgems-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filters: {
          selectedRegion: state.filters.selectedRegion,
          selectedBedTypes: state.filters.selectedBedTypes,
          showCenterOnly: state.filters.showCenterOnly,
        },
      }),
    }
  )
);

// ===== 선택자 (Selectors) =====

export const selectFilters = (state: AppState) => state.filters;
export const selectUI = (state: AppState) => state.ui;
export const selectCacheStats = (state: AppState) => state.cacheStats;
export const selectIsLoading = (state: AppState) => state.ui.isLoading;
export const selectSelectedRegion = (state: AppState) => state.filters.selectedRegion;
