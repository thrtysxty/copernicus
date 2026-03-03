import os
import re

DIR = 'copernicus/src/renderer'

def find_import_path(filepath):
    depth = filepath.count('/') - 2
    if depth <= 0:
        return './types/ipc'
    return '../' * depth + 'types/ipc'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # regex to match: (varName as any)?.data ?? varName
    # also: varName?.data ?? varName
    # also: (varName as any).data ?? varName
    
    # 1. Match `(XXXX as any)?.data ?? XXXX` or `(XXXX as any).data ?? XXXX`
    pattern1 = r'\((?P<var>[a-zA-Z0-9_]+)\s+as\s+any\)\??\.data\s*\?\?\s*(?P=var)'
    content = re.sub(pattern1, r'unwrapIpc(\g<var>)', content)
    
    # 2. Match `XXXX?.data ?? XXXX`
    pattern2 = r'(?P<var>[a-zA-Z0-9_]+)\??\.data\s*\?\?\s*(?P=var)'
    content = re.sub(pattern2, r'unwrapIpc(\g<var>)', content)
    
    # 3. Handle `unwrapIpc(X) ?? []` pattern cases if `?? []` was outside the previous parenthesis
    # Wait, the previous regex just replaces the `(X as any)?.data ?? X` part. The `?? []` is untouched,
    # so `(raw as any)?.data ?? raw ?? []` becomes `unwrapIpc(raw) ?? []` which is exactly what we want!
    
    # Special cases
    # `(_rawTargeted as any)?.data ?? false`
    pattern3 = r'\((?P<var>[a-zA-Z0-9_]+)\s+as\s+any\)\??\.data'
    def replacer3(match):
        v = match.group('var')
        return f"unwrapIpc({v})"
        
    # We only want to replace if there's an explicit `?? false` or similar, but unwrapIpc handles it.
    # Actually, `unwrapIpc(r)` returns `data` or `r`. So `unwrapIpc(r) ?? false` is correct.
    # Let's replace `(r as any)?.data` with `unwrapIpc(r)` where r is a known variable if it didn't match the above
    content = re.sub(r'\((_rawTargeted)\s+as\s+any\)\??\.data', r'unwrapIpc(\1)', content)
    content = re.sub(r'r\?\.data', r'unwrapIpc(r)', content)
    content = re.sub(r'diagRes\?\.data', r'unwrapIpc(diagRes)', content)
    
    # Clean up double unwraps if any
    content = content.replace('unwrapIpc(unwrapIpc(r))', 'unwrapIpc(r)')

    if content != original_content:
        if 'unwrapIpc' not in original_content:
            import_path = find_import_path(filepath)
            import_matches = list(re.finditer(r'^import .*?from .*?$', content, re.MULTILINE))
            if import_matches:
                last_import = import_matches[-1]
                insert_pos = last_import.end()
                content = content[:insert_pos] + f"\nimport {{ unwrapIpc }} from '{import_path}'" + content[insert_pos:]
            else:
                content = f"import {{ unwrapIpc }} from '{import_path}'\n" + content
                
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk(DIR):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
