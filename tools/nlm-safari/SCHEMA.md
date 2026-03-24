# NLM Tools Safari Extension Storage Schema

This document outlines the schema for data stored in `browser.storage.local` by the NLM Tools Safari Extension.

## Keys

### `nlm_folders`

- **Description**: Stores information about user-defined folders for organizing notebooks.
- **Type**: `object`
- **Structure**:
  ```typescript
  interface NlmFolders {
    [folderId: string]: {
      name: string;
      notebookIds: string[];
    };
  }
  ```
- **Example**:
  ```json
  {
    "folder-12345": {
      "name": "Research Projects",
      "notebookIds": ["nb-abcde", "nb-fghij"]
    },
    "folder-67890": {
      "name": "Meeting Notes",
      "notebookIds": ["nb-klmno"]
    }
  }
  ```

### `nlm_tags`

- **Description**: Stores tags associated with individual notebooks.
- **Type**: `object`
- **Structure**:
  ```typescript
  interface NlmTags {
    [notebookId: string]: string[];
  }
  ```
- **Example**:
  ```json
  {
    "nb-abcde": ["AI", "Machine Learning", "Q1-2024"],
    "nb-fghij": ["Internal", "Project X"],
    "nb-klmno": ["Client Meeting", "Daily Standup"]
  }
  ```

### `nlm_prompts`

- **Description**: Stores user-saved prompts for quick insertion into the NotebookLM chat interface.
- **Type**: `object`
- **Structure**:
  ```typescript
  interface NlmPrompts {
    [promptId: string]: {
      title: string;
      body: string;
    };
  }
  ```
- **Example**:
  ```json
  {
    "prompt-alpha": {
      "title": "Summarize Document",
      "body": "Please summarize the key points of the attached document in bullet points."
    },
    "prompt-beta": {
      "title": "Generate Ideas",
      "body": "Brainstorm 5 new ideas for improving user engagement on our platform."
    }
  }
  ```