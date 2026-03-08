copernicus/src/renderer/App.tsx:5:import { useLayoutStore } from './store/layout'
copernicus/src/renderer/App.tsx:45:  const { activeFilePath } = useLayoutStore()
copernicus/src/renderer/App.tsx:153:  } = useLayoutStore()
copernicus/src/renderer/App.tsx:198:      const target = useLayoutStore.getState().spotlightPane ?? 'chat'
copernicus/src/renderer/App.tsx:203:      const current = useLayoutStore.getState().spotlightPane
copernicus/src/renderer/components/settings/sections/AppearanceSection.tsx:2:import { useLayoutStore, PHOSPHOR_PRESETS, PhosphorColor } from '../../../store/layout'
copernicus/src/renderer/components/settings/sections/AppearanceSection.tsx:12:  } = useLayoutStore()
copernicus/src/renderer/components/FileTree/FileTree.tsx:5:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/FileTree/FileTree.tsx:49:  const { setCenterMode, setActiveFilePath, setActiveFileContent, setActiveFileLanguage } = useLayoutStore()
copernicus/src/renderer/components/FileTree/FileTree.tsx:67:      const { setView } = useLayoutStore.getState()
copernicus/src/renderer/components/FileTree/FileTree.tsx:139:  const { spotlightPane, setSpotlight, toggleFlip, setSidebarOpen } = useLayoutStore()
copernicus/src/renderer/components/chat/ChatThread.tsx:7:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/chat/ChatThread.tsx:44:  const { setCanvasContent, setUIComponents } = useLayoutStore()
copernicus/src/renderer/components/chat/ChatThread.tsx:173:  } = useLayoutStore()
copernicus/src/renderer/components/chat/GuideCopernicus.tsx:3:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/chat/GuideCopernicus.tsx:27:  const { retakeTour } = useLayoutStore()
copernicus/src/renderer/components/chat/useChatPanel.ts:4:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/chat/useChatPanel.ts:67:  } = useLayoutStore()
copernicus/src/renderer/components/CommandDeck.tsx:3:import { useLayoutStore } from '../store/layout'
copernicus/src/renderer/components/CommandDeck.tsx:10:  const { spotlightPane, setSpotlight, toggleFlip, setSidebarOpen } = useLayoutStore()
copernicus/src/renderer/components/layout/FlippablePanel.tsx:3:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/layout/FlippablePanel.tsx:20:  const { flippedPanes } = useLayoutStore()
copernicus/src/renderer/components/layout/SharedPanelHeader.tsx:3:import { useLayoutStore, PaneId } from '../../store/layout'
copernicus/src/renderer/components/layout/SharedPanelHeader.tsx:17:  const { spotlightPane, setSpotlight } = useLayoutStore()
copernicus/src/renderer/components/layout/StatusBar.tsx:2:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/layout/StatusBar.tsx:18:  } = useLayoutStore()
copernicus/src/renderer/components/layout/ActivityBar.tsx:6:import { useLayoutStore, StoryboardView } from '../../store/layout'
copernicus/src/renderer/components/layout/ActivityBar.tsx:26:  } = useLayoutStore()
copernicus/src/renderer/components/layout/Header.tsx:2:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/layout/Header.tsx:5:  const { workingDir, gitBranch } = useLayoutStore()
copernicus/src/renderer/components/layout/ProjectSelectorDialog.tsx:5:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/layout/ProjectSelectorDialog.tsx:22:  const { setWorkingDir } = useLayoutStore()
copernicus/src/renderer/components/layout/SpotlightContainer.tsx:3:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/layout/SpotlightContainer.tsx:13:  const { spotlightPane, setSpotlight } = useLayoutStore()
copernicus/src/renderer/components/layout/ApplicationHeader.tsx:2:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/layout/ApplicationHeader.tsx:5:  const { workingDir, activeStoryId } = useLayoutStore()
copernicus/src/renderer/components/KanbanBoard.tsx:4:import { useLayoutStore } from '../store/layout'
copernicus/src/renderer/components/KanbanBoard.tsx:53:  } = useLayoutStore()
copernicus/src/renderer/components/planning/StoryDetail.tsx:5:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/planning/StoryDetail.tsx:38:  const { setDrawerStory, spotlightPane, setSpotlight } = useLayoutStore()
copernicus/src/renderer/components/Terminal/Terminal.tsx:5:import { useLayoutStore } from '../../store/layout';
copernicus/src/renderer/components/Terminal/Terminal.tsx:21:  const setTerminalBusy = useLayoutStore(s => s.setTerminalBusy);
copernicus/src/renderer/components/Terminal/TerminalTabs.tsx:5:import { useLayoutStore } from '../../store/layout';
copernicus/src/renderer/components/Terminal/TerminalTabs.tsx:15:  const { terminals, activeTerminalId, setActiveTerminal, removeTerminal, setTerminalBusy, addTerminal } = useLayoutStore();
copernicus/src/renderer/components/testing/UITestDrawer.tsx:3:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/testing/UITestDrawer.tsx:15:  const toggleUITestingDrawer = useLayoutStore(s => s.toggleUITestingDrawer)
copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx:3:import { useLayoutStore } from '../../store/layout';
copernicus/src/renderer/components/workflow/WorkflowCanvas.tsx:111:  } = useLayoutStore();
copernicus/src/renderer/components/telemetry/TelemetryPanel.tsx:3:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/telemetry/TelemetryPanel.tsx:6:  const { agentTelemetry, capexTotal, capexTimer } = useLayoutStore()
copernicus/src/renderer/components/Editor/ui-builder/UIBuilderCanvas.tsx:2:import { useLayoutStore } from '../../../store/layout'
copernicus/src/renderer/components/Editor/ui-builder/UIBuilderCanvas.tsx:55:  } = useLayoutStore()
copernicus/src/renderer/components/Editor/CenterPanelRouter.tsx:8:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/Editor/CenterPanelRouter.tsx:31:  } = useLayoutStore()
copernicus/src/renderer/components/Editor/DiffViewer.tsx:3:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/Editor/DiffViewer.tsx:23:  const { reviewEnabled } = useLayoutStore()
copernicus/src/renderer/components/Editor/DiffPanel.tsx:4:import { useLayoutStore } from '../../store/layout'
copernicus/src/renderer/components/Editor/DiffPanel.tsx:9:  const { pendingDiff, clearReviewMode, setReviewMode } = useLayoutStore()
copernicus/src/renderer/components/Editor/UICanvas.tsx:2:import { useLayoutStore } from '../../store/layout';
copernicus/src/renderer/components/Editor/UICanvas.tsx:6:  const { canvasContent, canvasUrl, setCanvasUrl, setCanvasContent } = useLayoutStore();
copernicus/src/renderer/hooks/useThemeManager.ts:2:import { useLayoutStore, PHOSPHOR_PRESETS } from '../store/layout'
copernicus/src/renderer/hooks/useThemeManager.ts:8:  const phosphorColor = useLayoutStore((state) => state.phosphorColor)
copernicus/src/renderer/store/layout.ts:195:export const useLayoutStore = create<LayoutState>()(
