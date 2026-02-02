import {
  Component,
  input,
  output,
  inject,
  OnInit,
  signal,
  computed,
  viewChild,
  ElementRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import type { WorkflowDefinition } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  selector: 'app-wizard-prompt-step',
  templateUrl: './wizard-prompt-step.component.html',
  styleUrl: './wizard-step-shared.scss',
})
export class WizardPromptStepComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  // L3: Signal-based viewChild instead of @ViewChild decorator
  promptTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('promptTextarea');

  form!: FormGroup;

  /** All input names from Step 2 */
  availableVariables = computed(() => {
    return (this.state()?.inputs || []).map((i) => i.name).filter((n) => n);
  });

  /** Variables found in the prompt text */
  promptVariables = signal<string[]>([]);

  /** Variables used in the prompt */
  usedVariables = computed(() => {
    const vars = this.promptVariables();
    const available = this.availableVariables();
    return available.filter((v) => vars.includes(v));
  });

  /** Variables NOT used in the prompt */
  unusedVariables = computed(() => {
    const vars = this.promptVariables();
    const available = this.availableVariables();
    return available.filter((v) => !vars.includes(v));
  });

  /** Variables in prompt that don't match any input */
  unknownVariables = computed(() => {
    const vars = this.promptVariables();
    const available = this.availableVariables();
    return vars.filter((v) => !available.includes(v));
  });

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    const prompt = this.state()?.prompt || '';
    this.form = this.fb.group({
      prompt: [prompt, [Validators.required]],
    });

    this.extractVariables(prompt);

    // H2: takeUntilDestroyed prevents memory leak
    this.form.get('prompt')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val: string) => {
        this.extractVariables(val);
        this.syncToParent();
      });
  }

  private extractVariables(text: string): void {
    const regex = /\{([^}]+)\}/g;
    const vars: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (!vars.includes(match[1])) {
        vars.push(match[1]);
      }
    }
    this.promptVariables.set(vars);
  }

  insertVariable(name: string): void {
    const textarea = this.promptTextarea()?.nativeElement;
    if (!textarea) return;

    const insertText = `{${name}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = this.form.get('prompt')?.value || '';

    const newValue =
      currentValue.substring(0, start) +
      insertText +
      currentValue.substring(end);

    this.form.patchValue({ prompt: newValue });

    // Restore cursor position after insert
    setTimeout(() => {
      textarea.focus();
      const newPos = start + insertText.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  private syncToParent(): void {
    this.stateChange.emit({ prompt: this.form.get('prompt')?.value || '' });
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }
}
