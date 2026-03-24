# Known Failure Patterns

- **`any` type cast masking real type error**
  - **Symptom:** Code compiles but fails at runtime with "Cannot read properties of undefined".
  - **Cause:** Using `as any` or casting to a type without performing runtime validation or proper mapping.
  - **Fix:** Avoid `any` types. Define strict TypeScript interfaces and map database or external API responses properly before using.

- **Forgotten `await` causing silent no-op**
  - **Symptom:** UI updates missing, logs absent, or state out of sync without throwing errors.
  - **Cause:** A promise is returned but not awaited, allowing synchronous code execution to proceed blindly.
  - **Fix:** Ensure all IPC invokes, database writes, and file system calls are explicitly awaited, or use `.catch()` blocks.

- **Inline secret committed**
  - **Symptom:** API keys, local paths, or environment overrides are found in source control.
  - **Cause:** Committing `.env` modifications or hardcoding credentials instead of using config managers.
  - **Fix:** Review patches carefully, ensure `COPERNICUS_API_KEY` is not present in raw source, and remove sensitive values before pushing.
