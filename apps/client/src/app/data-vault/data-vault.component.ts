import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface AssetFile {
  id: number;
  name: string;
  uploadDate: string;
  size: string;
  type: string;
  usedIn: number;
  selected: boolean;
}

@Component({
  selector: 'app-data-vault',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-vault.component.html'
})
export class DataVaultComponent {
  files: AssetFile[] = [
    {
      id: 1,
      name: 'Exit_Interview_Oct_2025.pdf',
      uploadDate: 'Dec 15, 2025',
      size: '2.3 MB',
      type: 'PDF',
      usedIn: 3,
      selected: false
    },
    {
      id: 2,
      name: 'Customer_Survey_Results.xlsx',
      uploadDate: 'Dec 12, 2025',
      size: '1.8 MB',
      type: 'Excel',
      usedIn: 2,
      selected: false
    },
    {
      id: 3,
      name: 'Interview_Transcript_Dec.docx',
      uploadDate: 'Dec 10, 2025',
      size: '156 KB',
      type: 'Word',
      usedIn: 5,
      selected: false
    },
    {
      id: 4,
      name: 'Product_Feedback_Nov.txt',
      uploadDate: 'Nov 28, 2025',
      size: '45 KB',
      type: 'Text',
      usedIn: 1,
      selected: false
    },
    {
      id: 5,
      name: 'Market_Research_Report.pdf',
      uploadDate: 'Nov 20, 2025',
      size: '4.1 MB',
      type: 'PDF',
      usedIn: 0,
      selected: false
    },
    {
      id: 6,
      name: 'Competitor_Analysis.pdf',
      uploadDate: 'Nov 15, 2025',
      size: '1.2 MB',
      type: 'PDF',
      usedIn: 2,
      selected: false
    }
  ];

  get selectedCount(): number {
    return this.files.filter(f => f.selected).length;
  }

  toggleSelection(file: AssetFile): void {
    file.selected = !file.selected;
  }

  selectAll(): void {
    const allSelected = this.files.every(f => f.selected);
    this.files.forEach(f => f.selected = !allSelected);
  }

  getFileColor(type: string): string {
    switch (type.toLowerCase()) {
      case 'pdf': return 'text-red-500 bg-red-50';
      case 'excel': return 'text-green-600 bg-green-50';
      case 'word': return 'text-blue-600 bg-blue-50';
      case 'text': return 'text-gray-500 bg-gray-50';
      default: return 'text-gray-400 bg-gray-50';
    }
  }

  getFileIconPath(type: string): string {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm6 2l4 4h-4V4z M 9 12h6 M 9 16h6'; // Document with lines
      case 'excel':
        return 'M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm6 2l4 4h-4V4z M 8 13 l 8 0 M 8 17 l 8 0 M 12 13 l 0 4'; // Grid like logic
      case 'word':
        return 'M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-6-6H7zm6 2l4 4h-4V4z M 8 12 h 8 M 8 15 h 8 M 8 18 h 5'; // Text lines
      default:
        return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    }
  }
}
