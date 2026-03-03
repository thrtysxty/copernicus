import os
import re

DIR = 'copernicus/src/renderer'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    content = re.sub(r'unwrapIpc\(([^)]+)\)', r'unwrapIpc<any>(\1)', content)
    
    # fix double <any> if happened
    content = content.replace('unwrapIpc<any><string>', 'unwrapIpc<string>')
    content = content.replace('unwrapIpc<any><any>', 'unwrapIpc<any>')
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)

for root, dirs, files in os.walk(DIR):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
