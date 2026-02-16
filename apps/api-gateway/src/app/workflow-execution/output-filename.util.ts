/**
 * Deterministic filename generation for workflow output files.
 * Expands template placeholders using subject file name and run context.
 */

/**
 * Generate an output filename from a template with placeholder substitution.
 *
 * Supported placeholders:
 * - `{subject}` — input filename without extension
 * - `{index}` — zero-padded file number (e.g., "01")
 * - `{date}` — ISO date string (YYYY-MM-DD)
 *
 * @param template - Filename template from workflow definition (e.g., "{subject}-report.md")
 * @param subjectFileName - Original input filename (e.g., "data.xlsx")
 * @param index - File index in the fan-out run (0-based)
 * @returns Generated filename (e.g., "data-report.md")
 */
export function generateOutputFilename(
  template: string | undefined,
  subjectFileName: string | undefined,
  index: number,
): string {
  // Fallback if no template defined
  if (!template || template.trim().length === 0) {
    return `output-${String(index).padStart(2, '0')}.md`;
  }

  const subjectStem = extractFileStem(subjectFileName ?? `file-${index}`);
  const paddedIndex = String(index).padStart(2, '0');
  const isoDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let result = template;
  result = result.replace(/\{subject\}/g, subjectStem);
  result = result.replace(/\{index\}/g, paddedIndex);
  result = result.replace(/\{date\}/g, isoDate);

  // Sanitize: remove unsafe characters for filesystem
  result = result.replace(/[^a-zA-Z0-9._-]/g, '_');

  return result;
}

/**
 * Extract filename without extension.
 * "report.pdf" → "report", "my.file.txt" → "my.file", "noext" → "noext"
 */
function extractFileStem(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}
