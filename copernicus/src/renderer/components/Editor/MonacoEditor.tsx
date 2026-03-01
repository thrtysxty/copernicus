import React from 'react';
import Editor, { useMonaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useIpcError } from '../../hooks/useIpcError';

// Import workers using Vite's ?worker syntax
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

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
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  filePath,
  onChange,
}) => {
  const monacoInstance = useMonaco();
  const editorRef = React.useRef<any>(null);
  const invoke = useIpcError();

  React.useEffect(() => {
    if (monacoInstance) {
      monacoInstance.editor.defineTheme('copernicus-phosphor', {
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
      });
      monacoInstance.editor.setTheme('copernicus-phosphor');
    }
  }, [monacoInstance]);

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
            console.log(`[Monaco] Saved: ${filePath}`);
          } else {
            console.error('[Monaco] Save failed:', data.error);
          }
        } catch (err) {
          console.error('[Monaco] Save failed:', err);
        }
      }
    );

    return () => disposable?.dispose();
  }, [filePath, monacoInstance, invoke]);

  return (
    <div className="h-full w-full bg-copernicus-bg">
        <Editor
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        onMount={(editor) => { editorRef.current = editor; }}
        options={{
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
