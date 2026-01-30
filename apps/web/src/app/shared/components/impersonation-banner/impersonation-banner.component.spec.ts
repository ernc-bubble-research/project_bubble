import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

@Component({ standalone: true, template: '' })
class DummyComponent {}
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  X,
} from 'lucide-angular';
import { ImpersonationBannerComponent } from './impersonation-banner.component';
import { ImpersonationService } from '../../../core/services/impersonation.service';

describe('ImpersonationBannerComponent', () => {
  let component: ImpersonationBannerComponent;
  let fixture: ComponentFixture<ImpersonationBannerComponent>;
  let impersonationService: ImpersonationService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ImpersonationBannerComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ X }),
        },
      ],
    }).compileComponents();

    impersonationService = TestBed.inject(ImpersonationService);
    impersonationService.storeImpersonation('token', {
      id: 'tenant-1',
      name: 'Test Tenant',
    });

    fixture = TestBed.createComponent(ImpersonationBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display tenant name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.banner-text')?.textContent).toContain(
      'Test Tenant'
    );
  });

  it('should have exit button', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.exit-btn')).toBeTruthy();
    expect(el.querySelector('.exit-btn')?.textContent).toContain(
      'Exit Impersonation'
    );
  });
});
