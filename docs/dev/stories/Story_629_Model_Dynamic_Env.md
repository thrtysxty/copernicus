# User Story: Model Configuration & Dynamic Environment (ID: 629)

## Actor
The End User and Developer.

## Goal
Implement a dynamic and flexible model management system and extend system settings for personas and templates.

## Acceptance Criteria
- [ ] Model Management: Model lists are dynamic based on configurations across the entire platform.
- [ ] Model Hot-swapping: Enable hot-swapping of models in any area driven by user/model interaction.
- [ ] Personas: Add default system personas to the persona list (Settings:Personas).
- [ ] Story Templates: Add Epic, Bug, Feature, Security, Foundation, Dependency Update, Regression, Refactor to the templates list.
- [ ] Environment/IDE: Identify and implement the drivers for "Settings:Environment" and "Settings: IDE Capabilities."
- [ ] Embedding: Ensure all default and user-added providers are in the list.

## Documentation Impact
- Update `MODEL_HOTSWAP.md` to explain the model switching logic.
- Ensure the `SETTINGS_GUIDE.md` reflects the new templates and persona management.

## Canonical Paths
- Settings Store: `copernicus/src/renderer/store/settings.ts`
- Model Manager: `copernicus/electron/codebase-indexer.ts` (Verify)
- Template Config: `copernicus/src/renderer/templates/index.ts`
