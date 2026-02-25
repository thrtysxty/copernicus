import React from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface MonacoEditorProps {
  value: string
  language: string
  onChange?: (value: string | undefined) => void
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  onChange,
}) => {
  const monaco = useMonaco();

  React.useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('copernicus-phosphor', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6272a4' },
          { token: 'keyword', foreground: '4ade80' },
          { token: 'string', foreground: 'f1fa8c' },
        ],
        colors: {
          'editor.background': '#050505',
          'editor.foreground': '#d4d4d8',
          'editorCursor.foreground': '#4ade80',
          'editor.lineHighlightBackground': '#3f3f4633',
          'editorLineNumber.foreground': '#3f3f46',
          'editor.selectionBackground': '#4ade8033',
        },
      });
      monaco.editor.setTheme('copernicus-phosphor');
    }
  }, [monaco]);

  return (
    <div className="h-full w-full bg-copernicus-bg">
        <Editor
        height="100%"
        language={language}
        value={value}
        onChange={onChange}
        options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            lineHeight: 20,
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            cursorBlinking: 'phase',
            cursorStyle: 'block',
            theme: 'copernicus-phosphor'
        }}
        />
    </div>
  );
};
