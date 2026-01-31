import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _message = signal<string | null>(null);
  private _timer: ReturnType<typeof setTimeout> | null = null;
  readonly message = this._message.asReadonly();

  show(message: string, durationMs = 5000): void {
    if (this._timer) {
      clearTimeout(this._timer);
    }
    this._message.set(message);
    this._timer = setTimeout(() => {
      this._message.set(null);
      this._timer = null;
    }, durationMs);
  }

  dismiss(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._message.set(null);
  }
}
