import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { InvitationService } from '../../core/services/invitation.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  selector: 'app-invite-user-dialog',
  templateUrl: './invite-user-dialog.component.html',
  styleUrl: './invite-user-dialog.component.scss',
})
export class InviteUserDialogComponent {
  @Input({ required: true }) tenantId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() invited = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly invitationService = inject(InvitationService);

  form: FormGroup;
  isSubmitting = signal(false);
  errorMessage = signal('');

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      role: ['creator', [Validators.required]],
      name: [''],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.invitationService.create(this.tenantId, this.form.value).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.invited.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.errorMessage.set(
            err.error?.message || 'A user with this email already exists',
          );
        } else {
          this.errorMessage.set('Failed to send invitation. Please try again.');
        }
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
