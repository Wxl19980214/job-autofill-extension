// Central type definitions shared across popup, options, content scripts, and background.

export interface UserProfile {
  // Personal
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  location: string;       // "City, State" combined for single-field location inputs
  linkedinUrl: string;
  websiteUrl: string;
  portfolioUrl: string;

  // Work
  currentCompany: string;
  currentTitle: string;
  yearsExperience: string;
  desiredRole: string;
  preferredLocations: string;
  openToRelocation: boolean;
  workAuthorization: string;  // e.g. "H1B"
  requiresSponsorship: boolean;
  authorizedToWork: boolean;  // true for H1B holders

  // Education
  school: string;
  degree: string;
  major: string;
  graduationYear: string;

  // Common free-text answers
  whyInterested: string;
  aboutYourself: string;
  howUseAI: string;

  // Location
  country: string;

  // Common yes/no consent and background questions
  previousEmployee: string;       // "No" — have you worked here before?
  privacyAcknowledgement: string; // "Yes" — I have read the privacy notice
  smsContact: string;             // "Yes" — OK to contact via SMS/WhatsApp

  // EEO / self-identification (values should match the option text on the form,
  // partial matching is used so "Asian" matches "Asian (not Hispanic or Latino)")
  eeoGender: string;
  eeoRace: string;
  eeoHispanic: string;
  eeoVeteran: string;
  eeoDisability: string;
  eeoTransgender: string;
}

export type ProfileKey = keyof UserProfile;

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'contenteditable';

export interface DetectedField {
  element: HTMLElement;
  fieldType: FieldType;
  signals: string;        // normalized combined label/name/placeholder — for debug
  profileKey: ProfileKey | null;
  confidence: number;     // 0–1
  currentValue: string;
}

export interface AutofillResult {
  filled: number;
  suggested: number;
  skipped: number;
}

export interface ContentMessage {
  action: 'autofill' | 'highlight' | 'clearHighlights' | 'ping';
  allowOverwrite?: boolean;
}

export interface ContentResponse {
  success: boolean;
  result?: AutofillResult;
  error?: string;
}
