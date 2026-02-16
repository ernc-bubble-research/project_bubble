import { generateOutputFilename } from './output-filename.util';

describe('generateOutputFilename', () => {
  it('[4-5-UNIT-013] should substitute {subject} with input filename stem', () => {
    const result = generateOutputFilename('{subject}-report.md', 'data.xlsx', 0);
    expect(result).toBe('data-report.md');
  });

  it('[4-5-UNIT-014] should substitute {index} with zero-padded index', () => {
    const result = generateOutputFilename('output-{index}.md', 'data.xlsx', 3);
    expect(result).toBe('output-03.md');
  });

  it('[4-5-UNIT-015] should substitute {date} with ISO date string', () => {
    const result = generateOutputFilename('report-{date}.md', 'data.xlsx', 0);
    // Match YYYY-MM-DD pattern
    expect(result).toMatch(/^report-\d{4}-\d{2}-\d{2}\.md$/);
  });

  it('[4-5-UNIT-016] should handle all placeholders together', () => {
    const result = generateOutputFilename('{subject}_{index}_{date}.md', 'input.pdf', 5);
    expect(result).toMatch(/^input_05_\d{4}-\d{2}-\d{2}\.md$/);
  });

  it('[4-5-UNIT-017] should fallback to output-{index}.md when template is undefined', () => {
    const result = generateOutputFilename(undefined, 'data.xlsx', 7);
    expect(result).toBe('output-07.md');
  });

  it('[4-5-UNIT-018] should fallback to output-{index}.md when template is empty string', () => {
    const result = generateOutputFilename('', 'data.xlsx', 0);
    expect(result).toBe('output-00.md');
  });

  it('[4-5-UNIT-019] should handle subject file with multiple dots', () => {
    const result = generateOutputFilename('{subject}.md', 'my.report.v2.pdf', 0);
    expect(result).toBe('my.report.v2.md');
  });

  it('[4-5-UNIT-020] should handle subject file with no extension', () => {
    const result = generateOutputFilename('{subject}.md', 'noextension', 0);
    expect(result).toBe('noextension.md');
  });

  it('[4-5-UNIT-021] should sanitize unsafe characters in output filename', () => {
    const result = generateOutputFilename('{subject} report.md', 'my file (1).pdf', 0);
    // Spaces and parens get sanitized to underscores
    expect(result).not.toMatch(/[ ()]/);
    expect(result).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it('[4-5-UNIT-022] should use fallback subject name when subjectFileName is undefined', () => {
    const result = generateOutputFilename('{subject}.md', undefined, 3);
    expect(result).toBe('file-3.md');
  });

  it('[4-5-UNIT-023] should handle multiple {subject} placeholders in template', () => {
    const result = generateOutputFilename('{subject}-{subject}.md', 'data.csv', 0);
    expect(result).toBe('data-data.md');
  });
});
