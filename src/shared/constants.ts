// ≥ HIGH → fill automatically
export const CONFIDENCE_THRESHOLD_HIGH = 0.7;

// ≥ LOW but < HIGH → highlight yellow as suggestion, do not fill
export const CONFIDENCE_THRESHOLD_LOW = 0.3;

export const STORAGE_KEY = 'userProfile';

// Injected CSS class names so we can clean up easily
export const AUTOFILL_ATTR = 'data-autofill-state';
export const TOOLTIP_ATTR = 'data-autofill-tooltip';
export const STYLE_ELEMENT_ID = 'job-autofill-styles';
