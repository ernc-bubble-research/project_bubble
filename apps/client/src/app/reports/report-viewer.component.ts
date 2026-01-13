import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Assumption {
    id: number;
    type: 'ambiguity' | 'context' | 'inference';
    description: string;
    assumption: string;
}

interface Citation {
    id: number;
    number: number;
    fileName: string;
    fileType: string;
    excerpt: string;
}

@Component({
    selector: 'app-report-viewer',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './report-viewer.component.html'
})
export class ReportViewerComponent {
    assumptions: Assumption[] = [
        {
            id: 1,
            type: 'ambiguity',
            description: 'Critical event definition unclear',
            assumption: 'Assumed "critical event" refers to QBR window'
        },
        {
            id: 2,
            type: 'context',
            description: 'ICP definition needed',
            assumption: 'Used generic B2B SaaS criteria'
        }
    ];

    citations: Citation[] = [
        {
            id: 1,
            number: 1,
            fileName: 'Market_Analysis_Report_Q3_2023.PDF',
            fileType: 'PDF',
            excerpt: '"If it adds more steps to our workflow without clear value, we won\'t adopt it."'
        },
        {
            id: 2,
            number: 2,
            fileName: 'Competitor_Landscape.Link',
            fileType: 'URL',
            excerpt: 'The problem is our current system requires too many manual steps for data validation...'
        },
        {
            id: 3,
            number: 3,
            fileName: 'Customer_Interview_Transcripts.DOCX',
            fileType: 'Word',
            excerpt: '"We need something that integrates seamlessly with our existing tech stack."'
        }
    ];

    getAssumptionIcon(type: string): string {
        switch (type) {
            case 'ambiguity': return '⚠️';
            case 'context': return '❓';
            case 'inference': return '💡';
            default: return '•';
        }
    }

    getAssumptionLabel(type: string): string {
        switch (type) {
            case 'ambiguity': return 'Ambiguity';
            case 'context': return 'Context Needed';
            case 'inference': return 'Inference';
            default: return type;
        }
    }
}
