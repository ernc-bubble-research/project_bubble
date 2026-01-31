import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LUCIDE_ICONS, LucideIconProvider, UserPlus, Send, X, AlertCircle } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { InviteUserDialogComponent } from './invite-user-dialog.component';
import { InvitationService } from '../../core/services/invitation.service';

describe('InviteUserDialogComponent [P2]', () => {
  let fixture: ComponentFixture<InviteUserDialogComponent>;
  let component: InviteUserDialogComponent;
  let invitationServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    invitationServiceMock = {
      create: jest.fn(),
      getAll: jest.fn(),
      resend: jest.fn(),
      revoke: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InviteUserDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: InvitationService, useValue: invitationServiceMock },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ UserPlus, Send, X, AlertCircle }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteUserDialogComponent);
    component = fixture.componentInstance;
    component.tenantId = 'tenant-1';
    fixture.detectChanges();
  });

  it('[1H.1-UNIT-001] should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('[1H.1-UNIT-002] should have an invalid form initially (email required)', () => {
    expect(component.form.valid).toBe(false);
  });

  it('[1H.1-UNIT-003] should validate email format', () => {
    component.form.get('email')?.setValue('invalid');
    expect(component.form.get('email')?.hasError('email')).toBe(true);

    component.form.get('email')?.setValue('bob@example.com');
    expect(component.form.get('email')?.valid).toBe(true);
  });

  it('[1H.1-UNIT-004] should have creator as default role', () => {
    expect(component.form.get('role')?.value).toBe('creator');
  });

  it('[1H.1-UNIT-005] should call InvitationService.create on valid submit', () => {
    invitationServiceMock.create.mockReturnValue(
      of({ id: 'inv-1', email: 'bob@example.com', role: 'creator', status: 'pending' }),
    );

    component.form.setValue({
      email: 'bob@example.com',
      role: 'creator',
      name: '',
    });

    const emitSpy = jest.spyOn(component.invited, 'emit');
    component.onSubmit();

    expect(invitationServiceMock.create).toHaveBeenCalledWith('tenant-1', {
      email: 'bob@example.com',
      role: 'creator',
      name: '',
    });
    expect(emitSpy).toHaveBeenCalled();
  });

  it('[1H.1-UNIT-006] should show error on 409 conflict', () => {
    invitationServiceMock.create.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { message: 'A user with this email already exists' },
      })),
    );

    component.form.setValue({
      email: 'bob@example.com',
      role: 'creator',
      name: '',
    });

    component.onSubmit();

    expect(component.errorMessage()).toBe('A user with this email already exists');
  });

  it('[1H.1-UNIT-007] should show generic error for non-409 failures', () => {
    invitationServiceMock.create.mockReturnValue(
      throwError(() => ({ status: 500 })),
    );

    component.form.setValue({
      email: 'bob@example.com',
      role: 'creator',
      name: '',
    });

    component.onSubmit();

    expect(component.errorMessage()).toBe('Failed to send invitation. Please try again.');
  });

  it('[1H.1-UNIT-008] should not submit invalid form', () => {
    component.onSubmit();
    expect(invitationServiceMock.create).not.toHaveBeenCalled();
  });

  it('[1H.1-UNIT-009] should emit closed when close is called', () => {
    const emitSpy = jest.spyOn(component.closed, 'emit');
    component.close();
    expect(emitSpy).toHaveBeenCalled();
  });
});
