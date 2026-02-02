import { CanDeactivateFn } from '@angular/router';
import { HasUnsavedChanges } from './has-unsaved-changes.interface';

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (component.isDirty()) {
    return confirm('You have unsaved changes. Are you sure you want to leave?');
  }
  return true;
};
