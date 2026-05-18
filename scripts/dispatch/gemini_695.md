### NO COMMIT

NEVER run `git commit` or `git push` at any point. We will handle merging.

You are a Python developer fixing a Flask backend issue. The backend crashes on startup due to a missing `notebooklm` module and a deprecated Google Generative AI import. Follow these steps:

1. For `backend/providers/notebooklm.py`:
   - The `notebooklm` package is not installable via pip
   - Remove the file safely
   - Update `backend/providers/factory.py` to remove the NotebookLMProvider import and registration

2. For `backend/providers/google.py`:
   - Replace `import google.generativeai as genai` with `import google.genai as genai`
   - Update any other references to use the new package
   - Ensure no FutureWarning appears on startup

3. Verify:
   - Run `python3 -m backend.app` to confirm the server starts
   - Run `make test` to confirm tests pass

The changes should resolve the ModuleNotFoundError and FutureWarning while maintaining functionality for other providers.