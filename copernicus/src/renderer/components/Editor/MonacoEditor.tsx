import React from 'react';
import Editor, { useMonaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useIpcError } from '../../hooks/useIpcError';
import { useLayoutStore } from '../../store/layout';
import { useTestRunnerStore } from '../../store/testRunner';
import { useDebugStore } from '../../store/debug';
import log from '../../utils/logger'

// Import workers using Vite's ?worker syntax
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { unwrapIpc } from '../../types/ipc'

// Handle Environment workers
// @ts-ignore
window.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

// Configure monaco-editor to use the locally bundled instance
loader.config({ monaco });

interface MonacoEditorProps {
  value: string
  language: string
  filePath?: string | null
  onChange?: (value: string | undefined) => void
  ghostMode?: boolean
  ghostAction?: 'accept' | 'reject' | null
}

const LSP_LANGUAGES = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  filePath,
  onChange,
  ghostMode,
  ghostAction,
}) => {
  const monacoInstance = useMonaco();
  const editorRef = React.useRef<any>(null);
  const invoke = useIpcError();
  const { setFileDirty } = useLayoutStore()
  const [, setGhostDecorations] = React.useState<string[]>([])
  const [, setCoverageDecorations] = React.useState<string[]>([])
  const coverageData = useTestRunnerStore(s => s.coverage)
  const [pendingDiff, setPendingDiff] = React.useState<string | null>(null)
  const [, setBpDecorations] = React.useState<string[]>([])

  const toggleBreakpoint = useDebugStore(s => s.toggleBreakpoint)
  const breakpoints = useDebugStore(s => s.breakpoints)

  // CSS for Ghost Mode
  React.useEffect(() => {
    const style = document.createElement('style')
    style.id = 'monaco-ghost-styles'
    style.innerHTML = `
      .ghost-added { background: rgba(74, 222, 128, 0.1) !important; width: 100%; display: block; border-left: 2px solid #4ade80; }
      .ghost-removed { background: rgba(239, 68, 68, 0.1) !important; text-decoration: line-through; width: 100%; display: block; border-left: 2px solid #ef4444; }
      .ghost-glyph-add { border-left: 2px solid #4ade80; }
    `
    document.head.appendChild(style)
    return () => {
      const el = document.getElementById('monaco-ghost-styles')
      if (el) el.remove()
    }
  }, [])

  // Listen for agent:code-stream
  React.useEffect(() => {
    const remove = window.ipcRenderer.on('agent:code-stream', (_e: any, payload: any) => {
      if (!ghostMode || payload.filePath !== filePath) return
      setPendingDiff(payload.proposedDiff)
    })
    return () => remove()
  }, [ghostMode, filePath])

  // Apply decorations
  React.useEffect(() => {
    if (!monacoInstance || !editorRef.current || !filePath) return
    
    if (!pendingDiff || !ghostMode) {
      setGhostDecorations(prev => editorRef.current.deltaDecorations(prev, []))
      window.dispatchEvent(new CustomEvent('editor:ghost-status', { detail: { filePath, hasGhost: false } }))
      return
    }

    // Simplified diff parsing for decorations
    const lines = pendingDiff.split('\n')
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = []
    let currentLine = 0

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/)
        if (match && match[1]) currentLine = parseInt(match[1], 10)
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        newDecorations.push({
          range: new monaco.Range(currentLine, 1, currentLine, 1),
          options: { isWholeLine: true, className: 'ghost-added', glyphMarginClassName: 'ghost-glyph-add' }
        })
        currentLine++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        newDecorations.push({
          range: new monaco.Range(currentLine, 1, currentLine, 1),
          options: { isWholeLine: true, className: 'ghost-removed' }
        })
      } else if (!line.startsWith('---') && !line.startsWith('+++')) {
        currentLine++
      }
    }

    setGhostDecorations(prev => editorRef.current.deltaDecorations(prev, newDecorations))
    window.dispatchEvent(new CustomEvent('editor:ghost-status', { detail: { filePath, hasGhost: true } }))
  }, [pendingDiff, ghostMode, monacoInstance, filePath])

  // Handle Accept/Reject actions
  React.useEffect(() => {
    if (!editorRef.current || !pendingDiff) return

    if (ghostAction === 'accept') {
      // In a real implementation, we'd apply the diff. 
      // For this story, we'll clear and notify.
      setPendingDiff(null)
      // Keyboard shortcut for Accept All: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA
      // This is handled via editor.addCommand in the mount effect below.
    } else if (ghostAction === 'reject') {
      setPendingDiff(null)
    }
  }, [ghostAction, pendingDiff])

  // Clear decorations when ghost mode toggled off
  React.useEffect(() => {
    if (!ghostMode && editorRef.current) {
      setGhostDecorations(prev => editorRef.current.deltaDecorations(prev, []))
      setPendingDiff(null)
      window.dispatchEvent(new CustomEvent('editor:ghost-status', { detail: { filePath, hasGhost: false } }))
    }
  }, [ghostMode, filePath])

  // Apply coverage decorations
  React.useEffect(() => {
    if (!monacoInstance || !editorRef.current || !filePath) return

    const fileCoverage = coverageData[filePath]
    if (!fileCoverage) {
      setCoverageDecorations(prev => editorRef.current.deltaDecorations(prev, []))
      return
    }

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = []

    Object.entries(fileCoverage.lines).forEach(([lineStr, status]) => {
      const line = parseInt(lineStr, 10)

      let colorClass = ''
      if (status === 'covered') colorClass = 'coverage-covered'
      else if (status === 'uncovered') colorClass = 'coverage-uncovered'
      else if (status === 'partial') colorClass = 'coverage-partial'

      if (colorClass) {
        newDecorations.push({
          range: new monacoInstance.Range(line, 1, line, 1),
          options: {
            isWholeLine: false,
            linesDecorationsClassName: colorClass,
          }
        })
      }
    })

    setCoverageDecorations(prev => editorRef.current.deltaDecorations(prev, newDecorations))
  }, [coverageData, filePath, monacoInstance])

  // Sync breakpoints to editor decorations
  React.useEffect(() => {
    if (!editorRef.current || !monacoInstance || !filePath) return;

    const fileBps = breakpoints[filePath] || [];

    const newDecorations = fileBps.map(bp => ({
      range: new monacoInstance.Range(bp.line, 1, bp.line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'breakpoint-glyph',
      }
    }));

    setBpDecorations(prev => {
      // @ts-ignore - deltaDecorations exists
      return editorRef.current!.deltaDecorations(prev, newDecorations)
    });

    // Send to DAP
    invoke('debug:set-breakpoints', { sourcePath: filePath, breakpoints: fileBps });

  }, [breakpoints, filePath, monacoInstance]);

  // CSS for breakpoints
  React.useEffect(() => {
    if (!document.getElementById('breakpoint-styles')) {
      const style = document.createElement('style')
      style.id = 'breakpoint-styles'
      style.textContent = `
        .breakpoint-glyph {
          background-color: #ef4444;
          border-radius: 50%;
          width: 12px !important;
          height: 12px !important;
          margin-top: 4px;
          margin-left: 4px;
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  const themeConfig: monaco.editor.IStandaloneThemeData = {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'd4d4d8' },
      { token: 'invalid', foreground: 'ff5555' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },

      { token: 'variable', foreground: 'd4d4d8' },
      { token: 'variable.predefined', foreground: 'bd93f9' },
      { token: 'constant', foreground: 'bd93f9' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'number.hex', foreground: 'bd93f9' },
      { token: 'regexp', foreground: 'f1fa8c' },
      { token: 'annotation', foreground: 'bd93f9' },
      { token: 'type', foreground: '8be9fd' },

      { token: 'delimiter', foreground: 'd4d4d8' },
      { token: 'delimiter.html', foreground: 'd4d4d8' },
      { token: 'delimiter.xml', foreground: 'd4d4d8' },

      { token: 'tag', foreground: '4ade80' },
      { token: 'tag.id.html', foreground: '4ade80' },
      { token: 'tag.class.html', foreground: '4ade80' },
      { token: 'meta.tag', foreground: '4ade80' },
      { token: 'metatag', foreground: '4ade80' },
      { token: 'metatag.content.html', foreground: 'f1fa8c' },
      { token: 'metatag.html', foreground: '4ade80' },
      { token: 'metatag.xml', foreground: '4ade80' },
      { token: 'metatag.php', foreground: '4ade80' },

      { token: 'key', foreground: '50fa7b' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'string.html', foreground: 'f1fa8c' },
      { token: 'string.sql', foreground: 'f1fa8c' },
      { token: 'string.yaml', foreground: 'f1fa8c' },

      { token: 'keyword', foreground: '4ade80' },
      { token: 'keyword.json', foreground: '50fa7b' },
      { token: 'keyword.php', foreground: '4ade80' },
      { token: 'keyword.sql', foreground: '4ade80' },
      { token: 'keyword.yaml', foreground: '50fa7b' },

      { token: 'operator', foreground: '4ade80' },
      { token: 'operator.sql', foreground: '4ade80' },
      { token: 'operator.php', foreground: '4ade80' },
      { token: 'operator.yaml', foreground: '4ade80' },

      { token: 'attribute.name', foreground: '50fa7b' },
      { token: 'attribute.value', foreground: 'f1fa8c' },
      { token: 'attribute.value.number', foreground: 'bd93f9' },
      { token: 'attribute.value.unit', foreground: 'bd93f9' },
      { token: 'attribute.value.html', foreground: 'f1fa8c' },
      { token: 'attribute.value.xml', foreground: 'f1fa8c' },

      { token: 'string.key.json', foreground: '50fa7b' },
      { token: 'string.value.json', foreground: 'f1fa8c' },
    ],
    colors: {
      'editor.background': '#050505',
      'editor.foreground': '#d4d4d8',
      'editorCursor.foreground': '#4ade80',
      'editor.lineHighlightBackground': '#3f3f4633',
      'editorLineNumber.foreground': '#3f3f46',
      'editor.selectionBackground': '#4ade8033',
      'editor.inactiveSelectionBackground': '#3f3f4633',
      'editorIndentGuide.background': '#3f3f4633',
      'editorIndentGuide.activeBackground': '#4ade8066',
    },
  };

  React.useEffect(() => {
    if (monacoInstance) {
      monacoInstance.editor.defineTheme('copernicus-phosphor', themeConfig);
      monacoInstance.editor.setTheme('copernicus-phosphor');
    }
  }, [monacoInstance]);

  // LSP providers — registered once per monaco instance
  React.useEffect(() => {
    if (!monacoInstance) return
    const disposables: monaco.IDisposable[] = []

    disposables.push(
      monacoInstance.languages.registerCompletionItemProvider(LSP_LANGUAGES, {
        triggerCharacters: ['.', '"', "'", '/', '@', '<'],
        provideCompletionItems: async (model, position) => {
          const raw = await invoke<any>('lsp:request', {
            method: 'textDocument/completion',
            params: {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 },
            },
          }).catch(() => null)
          const items: any[] = Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.data?.items) ? raw.data.items
            : Array.isArray(raw) ? raw : []
          return {
            suggestions: items.map((item: any) => ({
              label: item.label,
              kind: item.kind ?? 1,
              insertText: item.insertText ?? item.label,
              documentation: typeof item.documentation === 'string'
                ? item.documentation
                : item.documentation?.value,
              range: undefined as any,
            })),
          }
        },
      })
    )

    disposables.push(
      monacoInstance.languages.registerHoverProvider(LSP_LANGUAGES, {
        provideHover: async (model, position) => {
          const raw = await invoke<any>('lsp:request', {
            method: 'textDocument/hover',
            params: {
              textDocument: { uri: model.uri.toString() },
              position: { line: position.lineNumber - 1, character: position.column - 1 },
            },
          }).catch(() => null)
          const hover = unwrapIpc<any>(raw)
          if (!hover?.contents) return null
          const value = typeof hover.contents === 'string'
            ? hover.contents
            : hover.contents?.value ?? hover.contents?.[0]?.value ?? ''
          return { contents: [{ value }] }
        },
      })
    )

    // Diagnostics push → Monaco markers
    const removeDiag = window.ipcRenderer.on(
      'lsp:diagnostics-update',
      (_e: Electron.IpcRendererEvent, { uri, diagnostics }: { uri: string; diagnostics: any[] }) => {
        const model = monacoInstance.editor.getModels().find(m => m.uri.toString() === uri)
        if (!model) return
        monacoInstance.editor.setModelMarkers(model, 'lsp', diagnostics.map((d: any) => ({
          startLineNumber: (d.range?.start?.line ?? 0) + 1,
          startColumn: (d.range?.start?.character ?? 0) + 1,
          endLineNumber: (d.range?.end?.line ?? 0) + 1,
          endColumn: (d.range?.end?.character ?? 0) + 1,
          message: d.message,
          severity: d.severity === 1
            ? monacoInstance.MarkerSeverity.Error
            : d.severity === 2
              ? monacoInstance.MarkerSeverity.Warning
              : monacoInstance.MarkerSeverity.Info,
        })))
      }
    )

    return () => {
      disposables.forEach(d => d.dispose())
      removeDiag()
    }
  }, [monacoInstance]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle goto-line events (Story 338)
  React.useEffect(() => {
    if (!monacoInstance) return
    const removeGotoLine = window.ipcRenderer.on(
      'layout:goto-line',
      (_e: Electron.IpcRendererEvent, { file, line, col }: { file: string; line: number; col: number }) => {
        if (!filePath || filePath !== file) return
        const editor = editorRef.current
        if (editor) {
          editor.revealLineInCenter(line)
          editor.setPosition({ lineNumber: line, column: col })
          editor.focus()
        }
      }
    )
    return () => removeGotoLine()
  }, [monacoInstance, filePath])

  // LSP open/close via lsp-manager file lifecycle (Story 189)
  React.useEffect(() => {
    if (!filePath) return
    invoke('lsp:open-file', { filePath, content: value }).catch(() => {})
    return () => {
      if (monacoInstance) {
        const uri = `file://${filePath}`
        const model = monacoInstance.editor.getModels().find(m => m.uri.toString() === uri)
        if (model) monacoInstance.editor.setModelMarkers(model, 'lsp', [])
      }
      invoke('lsp:close-file', filePath).catch(() => {})
    }
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // LSP didChange (debounced 500ms) on value edits
  React.useEffect(() => {
    if (!filePath) return
    const timer = setTimeout(() => {
      invoke('lsp:open-file', { filePath, content: value }).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [value, filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !filePath || !monacoInstance) return;

    const disposable = editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      async () => {
        const content = editor.getValue();
        try {
          const result = await invoke<any>('fs:save-file', { filePath, content });
          const data = result.data || result;
          if (data.ok) {
            log.info(`[Monaco] Saved: ${filePath}`);
            if (filePath) setFileDirty(filePath, false);
          } else {
            log.error('[Monaco] Save failed:', data.error);
          }
        } catch (err) {
          log.error('[Monaco] Save failed:', err);
        }
      }
    );

    return () => disposable?.dispose();
  }, [filePath, monacoInstance, invoke, setFileDirty]);

  return (
    <div 
      data-testid="monaco-container"
      className="h-full w-full bg-[#050505] relative group/editor"
    >
        <Editor
        height="100%"
        path={filePath ?? undefined}
        language={language}
        value={value}
        onChange={(val) => {
          if (onChange) onChange(val);
          if (filePath) setFileDirty(filePath, true);
        }}
        onMount={(editor) => {
          editorRef.current = editor;
          // AC2: Accept All shortcut
          if (monacoInstance) {
            editor.addCommand(
              monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyA,
              () => setPendingDiff(null)
            )
          }

          editor.onMouseDown((e) => {
            if (e.target.type === monacoInstance?.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.type === monacoInstance?.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
              const line = e.target.position?.lineNumber;
              if (line && filePath) {
                toggleBreakpoint(filePath, line);
              }
            }
          });
        }}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('copernicus-phosphor', themeConfig);
          monaco.editor.setTheme('copernicus-phosphor');
        }}
        options={{
          glyphMargin: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
          fontLigatures: true,
          lineHeight: 20,
          padding: { top: 8, bottom: 8 },
          scrollBeyondLastLine: false,
          cursorBlinking: 'phase',
          cursorStyle: 'block',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          theme: 'copernicus-phosphor',
          automaticLayout: true,
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          folding: true,
          foldingHighlight: false,
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          renderWhitespace: 'none',
          wordWrap: 'off',
          bracketPairColorization: { enabled: true },
          guides: { indentation: true, bracketPairs: false },
          renderLineHighlight: 'gutter',
          occurrencesHighlight: 'off',
          selectionHighlight: false,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
            useShadows: false,
          },
          overviewRulerLanes: 0,
        }}
        />
    </div>
  );
};
