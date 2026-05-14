// Maps a field's combined signal string to a profile key with a confidence score.
// Uses the rules in matchingRules.ts and applies minor boosts based on field type.

import type { ProfileKey, FieldType } from '../shared/profileTypes';
import { MATCH_RULES } from '../shared/matchingRules';

export interface MatchResult {
  key: ProfileKey;
  confidence: number;
}

// Certain HTML input types strongly constrain which profile keys can match
const FIELD_TYPE_OVERRIDES: Partial<Record<FieldType, ProfileKey[]>> = {
  email:    ['email'],
  tel:      ['phone'],
  url:      ['linkedinUrl', 'websiteUrl', 'portfolioUrl'],
  checkbox: ['openToRelocation', 'requiresSponsorship', 'authorizedToWork'],
};

export function matchFieldToProfile(
  signals: string,
  fieldType: FieldType
): MatchResult | null {
  const allowedKeys = FIELD_TYPE_OVERRIDES[fieldType];
  let best: MatchResult | null = null;

  for (const rule of MATCH_RULES) {
    // If the field type restricts possible keys, skip non-matching rules
    if (allowedKeys && !allowedKeys.includes(rule.key)) continue;

    for (const pattern of rule.patterns) {
      if (pattern.test(signals)) {
        if (!best || rule.weight > best.confidence) {
          best = { key: rule.key, confidence: rule.weight };
        }
        break; // first pattern match is enough for this rule
      }
    }
  }

  // Small boost for type-confirmed fields (email input matching email key)
  if (best) {
    if (fieldType === 'email' && best.key === 'email') {
      best.confidence = Math.min(1, best.confidence + 0.04);
    }
    if (fieldType === 'tel' && best.key === 'phone') {
      best.confidence = Math.min(1, best.confidence + 0.04);
    }
    if (fieldType === 'url' && best.key === 'linkedinUrl') {
      best.confidence = Math.min(1, best.confidence + 0.02);
    }
  }

  return best;
}
