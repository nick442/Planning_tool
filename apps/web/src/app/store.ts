import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Per-device UI state. Data (goals, steps) lives in Dexie, not here.
 */
interface UiState {
  selectedGoalId: string | null;
  /** The row that has keyboard focus in the outline. */
  focusedStepId: string | null;
  /** The row whose title is being edited. */
  editingStepId: string | null;
  showCompleted: boolean;
  showArchived: boolean;
  /** Collapsed step ids (persisted). */
  collapsed: Record<string, true>;

  selectGoal: (id: string | null) => void;
  focusStep: (id: string | null) => void;
  editStep: (id: string | null) => void;
  setShowCompleted: (show: boolean) => void;
  setShowArchived: (show: boolean) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedGoalId: null,
      focusedStepId: null,
      editingStepId: null,
      showCompleted: false,
      showArchived: false,
      collapsed: {},

      selectGoal: (id) => set({ selectedGoalId: id, focusedStepId: null, editingStepId: null }),
      focusStep: (id) => set({ focusedStepId: id }),
      editStep: (id) =>
        set(id ? { editingStepId: id, focusedStepId: id } : { editingStepId: null }),
      setShowCompleted: (showCompleted) => set({ showCompleted }),
      setShowArchived: (showArchived) => set({ showArchived }),
      setCollapsed: (id, isCollapsed) =>
        set((state) => {
          const collapsed = { ...state.collapsed };
          if (isCollapsed) collapsed[id] = true;
          else delete collapsed[id];
          return { collapsed };
        }),
    }),
    {
      name: 'planning-ui',
      partialize: (s) => ({
        selectedGoalId: s.selectedGoalId,
        showCompleted: s.showCompleted,
        showArchived: s.showArchived,
        collapsed: s.collapsed,
      }),
    },
  ),
);
