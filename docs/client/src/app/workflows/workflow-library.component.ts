import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Workflow {
    id: number;
    name: string;
    description: string;
    category: string;
    recommended: boolean;
    runs: number;
}

@Component({
    selector: 'app-workflow-library',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './workflow-library.component.html',
    styleUrl: './workflow-library.component.scss'
})
export class WorkflowLibraryComponent {
    workflows: Workflow[] = [
        {
            id: 1,
            name: 'SPICED Discovery',
            description: 'Analyze customer interviews to identify pain points, decision criteria, and buying signals using the SPICED framework.',
            category: 'Customer Research',
            recommended: true,
            runs: 127
        },
        {
            id: 2,
            name: 'Feature Prioritization',
            description: 'Extract and rank product features from customer feedback based on frequency, impact, and strategic alignment.',
            category: 'Product Strategy',
            recommended: true,
            runs: 89
        },
        {
            id: 3,
            name: 'Competitive Analysis',
            description: 'Synthesize competitive intelligence from market research, identifying strengths, weaknesses, and positioning opportunities.',
            category: 'Market Intelligence',
            recommended: false,
            runs: 45
        },
        {
            id: 4,
            name: 'ICP Validation',
            description: 'Validate and refine your Ideal Customer Profile based on interview data and behavioral patterns.',
            category: 'Customer Research',
            recommended: false,
            runs: 62
        }
    ];
}
