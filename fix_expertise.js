const fs = require('fs');

const managerPath = 'copernicus/src/renderer/components/intelligence/IntelligenceManager.tsx';
let content = fs.readFileSync(managerPath, 'utf8');

// The best way to handle comma-separated lists is to keep raw string state and parse it into the object on change.
const parseEffectBlockReplacement = `
  useEffect(() => {
    if (selectedDoc) {
      setEditorContent(selectedDoc.content || '')
      setEditorTitle(selectedDoc.title || '')
      setEditorDesc(selectedDoc.description || '')

      if (selectedDoc.type === 'instruction') {
        const parsed = parseSoulMd(selectedDoc.content || '');
        setInstructionFields({
          agentName: parsed.agentName || selectedDoc.title || '',
          description: parsed.description || selectedDoc.description || '',
          communicationStyle: parsed.communicationStyle || '',
          coreValues: parsed.coreValues || [],
          expertiseAreas: parsed.expertiseAreas || [],
          isParsed: !!(parsed.agentName || parsed.communicationStyle || parsed.coreValues.length > 0 || parsed.expertiseAreas.length > 0)
        });
        setExpertiseAreasInput((parsed.expertiseAreas || []).join(', '));
        setCoreValuesInput((parsed.coreValues || []).join('\\n'));
      }

    } else {
      setEditorContent('')
      setEditorTitle('')
      setEditorDesc('')
      setInstructionFields({ agentName: '', description: '', communicationStyle: '', coreValues: [], expertiseAreas: [], isParsed: false });
      setExpertiseAreasInput('');
      setCoreValuesInput('');
    }
  }, [selectedDocId, selectedDoc?.content])
`;

content = content.replace(/  useEffect\(\(\) => \{\n    if \(selectedDoc\) \{\n      setEditorContent\(selectedDoc\.content \|\| ''\)\n      setEditorTitle\(selectedDoc\.title \|\| ''\)\n      setEditorDesc\(selectedDoc\.description \|\| ''\)\n\n      if \(selectedDoc\.type === 'instruction'\) \{\n        const parsed = parseSoulMd\(selectedDoc\.content \|\| ''\);\n        \/\/ We do not want to mutate original doc here directly or cause re-renders unnecessarily\.\n        \/\/ We'll manage these fields in local state to allow fast typing\n        setInstructionFields\(\{\n          agentName: parsed\.agentName \|\| selectedDoc\.title \|\| '',\n          description: parsed\.description \|\| selectedDoc\.description \|\| '',\n          communicationStyle: parsed\.communicationStyle \|\| '',\n          coreValues: parsed\.coreValues \|\| \[\],\n          expertiseAreas: parsed\.expertiseAreas \|\| \[\],\n          isParsed: !!\(parsed\.agentName \|\| parsed\.communicationStyle \|\| parsed\.coreValues\.length > 0 \|\| parsed\.expertiseAreas\.length > 0\)\n        \}\);\n      \}\n\n    \} else \{\n      setEditorContent\(''\)\n      setEditorTitle\(''\)\n      setEditorDesc\(''\)\n      setInstructionFields\(\{ agentName: '', description: '', communicationStyle: '', coreValues: \[\], expertiseAreas: \[\], isParsed: false \}\);\n    \}\n  \}, \[selectedDocId, selectedDoc\?\.content\]\)/, parseEffectBlockReplacement);

const newStates = `const [editorDesc, setEditorDesc] = useState('')
  const [instructionFields, setInstructionFields] = useState({
    agentName: '',
    description: '',
    communicationStyle: '',
    coreValues: [] as string[],
    expertiseAreas: [] as string[],
    isParsed: false
  })
  const [expertiseAreasInput, setExpertiseAreasInput] = useState('')
  const [coreValuesInput, setCoreValuesInput] = useState('')`;

content = content.replace(/const \[editorDesc, setEditorDesc\] = useState\(''\)\n  const \[instructionFields, setInstructionFields\] = useState\(\{\n    agentName: '',\n    description: '',\n    communicationStyle: '',\n    coreValues: \[\] as string\[\],\n    expertiseAreas: \[\] as string\[\],\n    isParsed: false\n  \}\)/, newStates);

const uiReplace = `
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Core Values (one per line)</label>
                        <textarea
                          className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors resize-y h-24"
                          value={coreValuesInput}
                          onChange={(e) => {
                            setCoreValuesInput(e.target.value);
                            handleInstructionFieldChange('coreValues', e.target.value.split('\\n').map(s => s.trim()).filter(Boolean));
                          }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Expertise Areas (comma-separated)</label>
                        <textarea
                          className="bg-black/40 border border-white/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500/50 transition-colors resize-y h-24"
                          value={expertiseAreasInput}
                          onChange={(e) => {
                            setExpertiseAreasInput(e.target.value);
                            const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            handleInstructionFieldChange('expertiseAreas', val);
                          }}
                        />
                      </div>
                    </div>
`;

content = content.replace(/                    <div className="flex gap-4">\n                      <div className="flex-1 flex flex-col gap-1.5">\n                        <label className="text-\[10px\] font-bold uppercase tracking-widest text-zinc-500">Core Values \(one per line\)<\/label>\n                        <textarea\n                          className="bg-black\/40 border border-white\/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500\/50 transition-colors resize-y h-24"\n                          value=\{instructionFields\.coreValues\.join\('\\\\n'\)\}\n                          onChange=\{\(e\) => handleInstructionFieldChange\('coreValues', e\.target\.value\.split\('\\\\n'\)\)\}\n                        \/>\n                      <\/div>\n                      <div className="flex-1 flex flex-col gap-1.5">\n                        <label className="text-\[10px\] font-bold uppercase tracking-widest text-zinc-500">Expertise Areas \(comma-separated\)<\/label>\n                        <textarea\n                          className="bg-black\/40 border border-white\/10 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-cyan-500\/50 transition-colors resize-y h-24"\n                          value=\{instructionFields\.expertiseAreas\.join\((?:', '|", ")\)\}\n                          onChange=\{\(e\) => \{\n                            const val = e\.target\.value\.split\(','\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\);\n                            handleInstructionFieldChange\('expertiseAreas', val\);\n                          \}\}\n                        \/>\n                      <\/div>\n                    <\/div>/, uiReplace);

const typeFix = `
  const handleInstructionFieldChange = (field: keyof typeof instructionFields, value: any) => {
    const newFields = { ...instructionFields, [field]: value };
`;
content = content.replace('const handleInstructionFieldChange = (field: string, value: any) => {', typeFix);


// Also hide textarea if parsed
const textareaReplacement = `
            {(!selectedDoc || (selectedDoc.type === 'instruction' && instructionFields.isParsed)) ? null : (
              <div className="flex-1 p-4 relative flex flex-col gap-2">
                {selectedDoc.type === 'agent' && (
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description / System Prompt</label>
                )}
                <textarea
                  className="w-full h-full bg-transparent text-zinc-300 font-mono text-xs outline-none resize-none scrollbar-thin scrollbar-thumb-zinc-800"
                  value={editorContent}
                  onChange={handleContentChange}
                  placeholder="Write your markdown content here..."
                  spellCheck={false}
                />
              </div>
            )}
`;
content = content.replace(/            <div className="flex-1 p-4 relative flex flex-col gap-2">\n              \{selectedDoc\.type === 'agent' && \(\n                <label className="text-\[10px\] font-bold uppercase tracking-widest text-zinc-500">Description \/ System Prompt<\/label>\n              \)\}\n              <textarea\n                className="w-full h-full bg-transparent text-zinc-300 font-mono text-xs outline-none resize-none scrollbar-thin scrollbar-thumb-zinc-800"\n                value=\{editorContent\}\n                onChange=\{handleContentChange\}\n                placeholder="Write your markdown content here\.\.\."\n                spellCheck=\{false\}\n              \/>\n            <\/div>/, textareaReplacement);

fs.writeFileSync(managerPath, content);
console.log('Done');
