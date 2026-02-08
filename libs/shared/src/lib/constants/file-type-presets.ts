export interface FileTypePreset {
  key: string;
  label: string;
  hint: string;
  extensions: string[];
}

export const FILE_TYPE_PRESETS: FileTypePreset[] = [
  { key: 'documents', label: 'Documents', hint: '.pdf, .docx, ...', extensions: ['.pdf', '.doc', '.docx', '.rtf', '.txt', '.odt'] },
  { key: 'spreadsheets', label: 'Spreadsheets', hint: '.xlsx, .csv, ...', extensions: ['.xls', '.xlsx', '.csv', '.tsv', '.ods'] },
  { key: 'images', label: 'Images', hint: '.jpg, .png, ...', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'] },
  { key: 'audio-video', label: 'Audio/Video', hint: '.mp3, .mp4, ...', extensions: ['.mp3', '.wav', '.mp4', '.avi', '.mov', '.webm'] },
  { key: 'archives', label: 'Archives', hint: '.zip, .tar, ...', extensions: ['.zip', '.tar', '.gz', '.7z', '.rar'] },
  { key: 'code', label: 'Code', hint: '.js, .py, ...', extensions: ['.js', '.ts', '.py', '.java', '.json', '.xml', '.yaml', '.html', '.css'] },
  { key: 'all', label: 'All Files', hint: 'No restriction', extensions: [] },
];
