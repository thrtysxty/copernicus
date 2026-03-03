import os
import re

DIR = 'copernicus/src/renderer'

def find_import_path(filepath):
    rel_path = os.path.relpath(filepath, DIR)
    depth = rel_path.count('/')
    if depth == 0:
        return './types/ipc'
    return '../' * depth + 'types/ipc'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_path = find_import_path(filepath)
    # find all wrong imports
    # They could be `import { unwrapIpc } from '...'`
    content = re.sub(r"import \{ unwrapIpc \} from '.*?/types/ipc'", f"import {{ unwrapIpc }} from '{new_path}'", content)
    
    with open(filepath, 'w') as f:
        f.write(content)
        
for root, dirs, files in os.walk(DIR):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
