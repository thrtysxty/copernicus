import { create } from 'zustand';

type Storyboard = 'Blueprint' | 'Studio' | 'EngineRoom';

interface PanelState {
  id: string;
  flipped: boolean;
  spotlight: boolean;
}

interface LayoutState {
  activeStoryboard: Storyboard;
  panels: Record<string, PanelState>;
  setStoryboard: (storyboard: Storyboard) => void;
  toggleFlip: (panelId: string) => void;
  toggleSpotlight: (panelId: string) => void;
  registerPanel: (panelId: string) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeStoryboard: 'Studio',
  panels: {},
  setStoryboard: (storyboard) => set({ activeStoryboard: storyboard }),
  toggleFlip: (panelId) =>
    set((state) => {
      const panel = state.panels[panelId];
      if (!panel) return state;
      return {
        panels: {
          ...state.panels,
          [panelId]: { ...panel, flipped: !panel.flipped },
        },
      };
    }),
  toggleSpotlight: (panelId) =>
    set((state) => {
      const panel = state.panels[panelId];
      if (!panel) return state;
      // If turning on spotlight, turn off others? Or just maximize this one.
      // Usually only one spotlight at a time.
      const newSpotlight = !panel.spotlight;
      const newPanels = { ...state.panels };

      if (newSpotlight) {
        // Disable spotlight on all others
        Object.keys(newPanels).forEach((key) => {
          newPanels[key].spotlight = false;
        });
      }

      newPanels[panelId] = { ...panel, spotlight: newSpotlight };

      return { panels: newPanels };
    }),
  registerPanel: (panelId) =>
    set((state) => {
      if (state.panels[panelId]) return state;
      return {
        panels: {
          ...state.panels,
          [panelId]: { id: panelId, flipped: false, spotlight: false },
        },
      };
    }),
}));
