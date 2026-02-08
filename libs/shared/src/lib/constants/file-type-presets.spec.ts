import { FILE_TYPE_PRESETS, FileTypePreset } from './file-type-presets';

describe('FILE_TYPE_PRESETS', () => {
  it('[3.10-UNIT-001] should have 7 preset groups', () => {
    expect(FILE_TYPE_PRESETS).toHaveLength(7);
  });

  it('[3.10-UNIT-001a] should have dot-prefixed extensions in every group', () => {
    for (const preset of FILE_TYPE_PRESETS) {
      for (const ext of preset.extensions) {
        expect(ext).toMatch(/^\./);
      }
    }
  });

  it('[3.10-UNIT-001b] should have no duplicate extensions across non-all groups', () => {
    const nonAll = FILE_TYPE_PRESETS.filter((p) => p.key !== 'all');
    const allExtensions = nonAll.flatMap((p) => p.extensions);
    const unique = new Set(allExtensions);
    expect(allExtensions.length).toBe(unique.size);
  });

  it('[3.10-UNIT-001c] should have required properties on every preset', () => {
    for (const preset of FILE_TYPE_PRESETS) {
      expect(preset.key).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.hint).toBeTruthy();
      expect(Array.isArray(preset.extensions)).toBe(true);
    }
  });

  it('[3.10-UNIT-001d] should have "all" preset with empty extensions', () => {
    const allPreset = FILE_TYPE_PRESETS.find((p) => p.key === 'all');
    expect(allPreset).toBeDefined();
    expect(allPreset!.extensions).toEqual([]);
    expect(allPreset!.label).toBe('All Files');
  });
});
