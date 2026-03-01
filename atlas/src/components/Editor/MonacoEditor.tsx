import React from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

export const MonacoEditor: React.FC = () => {
  const monaco = useMonaco();

  React.useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('copernicus-phosphor', {
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
      monaco.editor.setTheme('copernicus-phosphor');
    }
  }, [monaco]);

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      defaultValue="// Welcome to COPERNICUS IDE"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        lineHeight: 24,
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        cursorBlinking: 'phase',
        cursorStyle: 'block',
        theme: 'copernicus-phosphor',
        automaticLayout: true,
        formatOnPaste: true,
        formatOnType: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        folding: true,
        lineNumbers: 'on',
      }}
    />
  );
};
