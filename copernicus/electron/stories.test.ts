import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { StoriesManager } from './stories';

vi.mock('node:fs', async () => {
  const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actualFs,
    default: {
      ...actualFs,
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      renameSync: vi.fn(),
      readFileSync: vi.fn(),
      watch: vi.fn(),
      readdirSync: vi.fn(),
    }
  };
});

describe('StoriesManager', () => {
  let ledgerMock: any;
  let manager: StoriesManager;

  beforeEach(() => {
    vi.clearAllMocks();

    ledgerMock = {
      db: { open: true },
      listStoriesFromDb: vi.fn().mockReturnValue([]),
      upsertStory: vi.fn(),
      updateStoryFields: vi.fn(),
      getStoryById: vi.fn(),
      deleteStory: vi.fn(),
    };

    // Make existSync return true for the project root to target it,
    // and true for the stories dir to skip mkdir
    (fs.existsSync as any).mockImplementation((p: string) => {
      if (p.endsWith('docs/stories') || p.endsWith('.git')) return true;
      return false;
    });

    (fs.readdirSync as any).mockReturnValue([]);

    manager = new StoriesManager('/mock/project', ledgerMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createStory writes ac and description to the markdown file when provided', () => {
    manager.createStory({
      title: 'Test Story with AC and Description',
      type: 'Feature',
      epic: 'Test Epic',
      priority: 'P1',
      ac: '- [ ] AC 1\n- [ ] AC 2',
      description: 'This is a test description for the story.'
    } as any);

    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = (fs.writeFileSync as any).mock.calls[0];
    const writtenContent = writeCall[1];

    expect(writtenContent).toContain('## Description\nThis is a test description for the story.');
    expect(writtenContent).toContain('## Acceptance Criteria\n- [ ] AC 1\n- [ ] AC 2');
  });

  it('createStory falls back to default ac and omits description if not provided', () => {
    manager.createStory({
      title: 'Test Story Default',
      type: 'Feature',
      epic: 'Test Epic',
      priority: 'P1'
    });

    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = (fs.writeFileSync as any).mock.calls[0];
    const writtenContent = writeCall[1];

    expect(writtenContent).not.toContain('## Description');
    expect(writtenContent).toContain('## Acceptance Criteria\n- [ ] Implement Test Story Default');
  });
});
