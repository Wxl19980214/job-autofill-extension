// Each rule maps a set of regex patterns (tested against a field's combined
// label/name/placeholder/aria-label signals) to a profile key with a base
// confidence weight.  The fieldMatcher picks the highest-weight matching rule.

import type { ProfileKey } from './profileTypes';

export interface MatchRule {
  key: ProfileKey;
  patterns: RegExp[];
  weight: number; // base confidence score when any pattern matches (0–1)
}

export const MATCH_RULES: MatchRule[] = [
  // ── Personal ──────────────────────────────────────────────────────────────
  {
    key: 'firstName',
    patterns: [
      /\bfirst[\s_-]?name\b/i,
      /\bfname\b/i,
      /\bgiven[\s_-]?name\b/i,
      /^first$/i,
    ],
    weight: 0.92,
  },
  {
    key: 'lastName',
    patterns: [
      /\blast[\s_-]?name\b/i,
      /\blname\b/i,
      /\bfamily[\s_-]?name\b/i,
      /\bsurname\b/i,
      /^last$/i,
    ],
    weight: 0.92,
  },
  {
    key: 'fullName',
    patterns: [
      /\bfull[\s_-]?name\b/i,
      /^name$/i,
      /\byour[\s_-]?name\b/i,
      /\bfull[\s_-]?legal[\s_-]?name\b/i,
    ],
    weight: 0.85,
  },
  {
    key: 'email',
    patterns: [
      // Require specific context — plain "email" in a sentence like
      // "contact you via the email you provided" must NOT match here.
      /^e[\s_-]?mail$/i,                      // label is exactly "Email"
      /\bemail[\s_-]?address\b/i,
      /\byour[\s_-]?e[\s_-]?mail\b/i,
      /\bwork[\s_-]?email\b/i,
      /\bpersonal[\s_-]?email\b/i,
      /\bcontact[\s_-]?email\b/i,
      /\benter.*e[\s_-]?mail\b/i,
    ],
    weight: 0.93,
  },
  {
    key: 'phone',
    patterns: [
      /\bphone\b/i,
      /\bmobile\b/i,
      /\bcell\b/i,
      /\btelephone\b/i,
      /\btel\b/i,
    ],
    weight: 0.90,
  },
  {
    key: 'city',
    patterns: [
      /^city$/i,
      /\bcity[\s_-]?name\b/i,
      /\btown\b/i,
      /\bcity[\s_-]?of[\s_-]?residence\b/i,
      // "Location (City)" label used by Greenhouse and others
      /location\s*\(?\s*city\s*\)?/i,
    ],
    weight: 0.90,
  },
  {
    key: 'state',
    patterns: [
      /^state$/i,
      /\bstate[\s_-]\/[\s_-]?province\b/i,
      /\bprovince\b/i,
    ],
    weight: 0.85,
  },
  {
    key: 'country',
    patterns: [
      /\bcountry\b/i,
      /\bnation\b/i,
      /\bcountry[\s_-]?of[\s_-]?(residence|origin|citizenship)\b/i,
    ],
    weight: 0.92,
  },
  {
    key: 'location',
    patterns: [
      // Only match plain "location" — NOT "location (city)" which is handled by city rule above
      /^location$/i,
      /\bcity[\s,\/]?state\b/i,
      /\bwhere[\s_-]?are[\s_-]?you[\s_-]?(located|based)\b/i,
      /\bcurrent[\s_-]?location\b/i,
    ],
    weight: 0.72,
  },
  {
    key: 'linkedinUrl',
    patterns: [/linkedin/i],
    weight: 0.97,
  },
  {
    key: 'websiteUrl',
    patterns: [
      /\bwebsite\b/i,
      /\bpersonal[\s_-]?site\b/i,
      /\bweb[\s_-]?url\b/i,
      /\bpersonal[\s_-]?url\b/i,
    ],
    weight: 0.80,
  },
  {
    key: 'portfolioUrl',
    patterns: [
      /\bportfolio[\s_-]?url\b/i,
      /\bportfolio[\s_-]?link\b/i,
      /\bportfolio[\s_-]?website\b/i,
      /\bportfolio\b/i,
    ],
    weight: 0.88,
  },

  // ── Work ──────────────────────────────────────────────────────────────────
  {
    key: 'currentCompany',
    patterns: [
      /\bcurrent[\s_-]?company\b/i,
      /\bcurrent[\s_-]?employer\b/i,
      /\bemployer\b/i,
      /\bcompany[\s_-]?name\b/i,
      /\bwhere[\s_-]?do[\s_-]?you[\s_-]?work\b/i,
      /^company$/i,
      /\bmost[\s_-]?recent[\s_-]?(company|employer)\b/i,
    ],
    weight: 0.85,
  },
  {
    key: 'currentTitle',
    patterns: [
      /\bcurrent[\s_-]?title\b/i,
      /\bjob[\s_-]?title\b/i,
      /\bcurrent[\s_-]?role\b/i,
      /\bcurrent[\s_-]?position\b/i,
      /\bmost[\s_-]?recent[\s_-]?title\b/i,
      /^title$/i,
    ],
    weight: 0.85,
  },
  {
    key: 'yearsExperience',
    patterns: [
      /\byears[\s_-]?of[\s_-]?exp/i,
      /\byears[\s_-]?exp\b/i,
      /\bexperience[\s_-]?years\b/i,
      /\bhow[\s_-]?many[\s_-]?years\b/i,
      /\btotal[\s_-]?years\b/i,
    ],
    weight: 0.88,
  },
  {
    key: 'desiredRole',
    patterns: [
      /\bdesired[\s_-]?role\b/i,
      /\bdesired[\s_-]?position\b/i,
      /\bdesired[\s_-]?title\b/i,
      /\bapplying[\s_-]?for\b/i,
      /\bposition[\s_-]?interested\b/i,
    ],
    weight: 0.80,
  },
  {
    key: 'workAuthorization',
    patterns: [
      /\bvisa[\s_-]?status\b/i,
      /\bemployment[\s_-]?auth/i,
      /\bimmigration[\s_-]?status\b/i,
      /\bwork[\s_-]?visa[\s_-]?type\b/i,
    ],
    weight: 0.88,
  },
  {
    key: 'authorizedToWork',
    patterns: [
      /\bauthorized[\s_-]?to[\s_-]?work\b/i,
      /\blegally[\s_-]?auth/i,
      /\bright[\s_-]?to[\s_-]?work\b/i,
      /\bwork[\s_-]?eligib/i,
      /\bwork[\s_-]?auth/i,
      /\bare[\s_-]?you[\s_-]?authorized\b/i,
      /\bus[\s_-]?work[\s_-]?auth/i,
      /\bcan[\s_-]?you[\s_-]?legally[\s_-]?work\b/i,
    ],
    weight: 0.90,
  },
  {
    key: 'requiresSponsorship',
    patterns: [
      /\bsponsor/i,
      /\bvisa[\s_-]?sponsor/i,
      /\brequire[\s_-]?sponsor/i,
      /\bneed[\s_-]?sponsor/i,
      /\bwork[\s_-]?visa[\s_-]?sponsor/i,
    ],
    weight: 0.92,
  },

  // ── Education ─────────────────────────────────────────────────────────────
  {
    key: 'school',
    patterns: [
      /\bschool\b/i,
      /\buniversity\b/i,
      /\bcollege\b/i,
      /\binstitution\b/i,
      /\balma[\s_-]?mater\b/i,
      /\bwhere[\s_-]?did[\s_-]?you[\s_-]?study\b/i,
    ],
    weight: 0.88,
  },
  {
    key: 'degree',
    patterns: [
      /^degree$/i,
      /\bdegree[\s_-]?type\b/i,
      /\bhighest[\s_-]?degree\b/i,
      /\blevel[\s_-]?of[\s_-]?education\b/i,
      /\beducation[\s_-]?level\b/i,
      /\bdegree[\s_-]?earned\b/i,
    ],
    weight: 0.88,
  },
  {
    key: 'major',
    patterns: [
      /\bmajor\b/i,
      /\bfield[\s_-]?of[\s_-]?study\b/i,
      /\barea[\s_-]?of[\s_-]?study\b/i,
      /\bconcentration\b/i,
      /\bdiscipline\b/i,
      /\bspeciali[sz]ation\b/i,
    ],
    weight: 0.88,
  },
  {
    key: 'graduationYear',
    patterns: [
      /\bgraduation[\s_-]?year\b/i,
      /\bgrad[\s_-]?year\b/i,
      /\byear[\s_-]?graduated\b/i,
      /\bgraduated\b/i,
      /\byear[\s_-]?of[\s_-]?graduation\b/i,
      /\bcompletion[\s_-]?year\b/i,
    ],
    weight: 0.88,
  },

  // ── Free-text answers ─────────────────────────────────────────────────────
  {
    key: 'whyInterested',
    patterns: [
      /why[\s_-]?(are[\s_-]?you[\s_-]?)?interested/i,
      /why[\s_-]?do[\s_-]?you[\s_-]?want/i,
      /why[\s_-]?this[\s_-]?company/i,
      /why[\s_-]?join/i,
      /what[\s_-]?excites[\s_-]?you/i,
      /why[\s_-]?apply/i,
      /why[\s_-]?us\b/i,
    ],
    weight: 0.80,
  },
  {
    key: 'aboutYourself',
    patterns: [
      /about[\s_-]?yourself/i,
      /tell[\s_-]?us[\s_-]?about/i,
      /introduce[\s_-]?yourself/i,
      /brief[\s_-]?(bio|background|introduction)/i,
      /personal[\s_-]?statement/i,
      /describe[\s_-]?yourself/i,
      /professional[\s_-]?summary/i,
    ],
    weight: 0.75,
  },
  {
    key: 'howUseAI',
    patterns: [
      /how[\s_-]?do[\s_-]?you[\s_-]?use[\s_-]?ai/i,
      /ai[\s_-]?in[\s_-]?your[\s_-]?work/i,
      /use[\s_-]?of[\s_-]?ai/i,
      /ai[\s_-]?tools/i,
      /artificial[\s_-]?intelligence/i,
      /how[\s_-]?you[\s_-]?leverage[\s_-]?ai/i,
    ],
    weight: 0.88,
  },

  // ── Consent / background questions ────────────────────────────────────────
  {
    key: 'previousEmployee',
    patterns: [
      /have you (ever |previously )?worked (at|for)/i,
      /previous (employee|employment|experience) (at|with)/i,
      /prior (employee|employment)/i,
      /formerly (employed|worked)/i,
    ],
    weight: 0.88,
  },
  {
    key: 'privacyAcknowledgement',
    patterns: [
      /privacy\s*(acknowledgement|acknowledge|notice|policy)/i,
      /applicant\s*privacy/i,
      /i have read\s*(and\s*understand)?/i,
      /read\s*(and\s*(understand|agree))/i,
      /data\s*(protection|privacy)\s*(acknowledgement|consent)/i,
    ],
    weight: 0.88,
  },
  {
    key: 'smsContact',
    patterns: [
      /\bsms\b/i,
      /\bwhatsapp\b/i,
      /contact.*text\s*message/i,
      /text\s*message.*contact/i,
      /reach.*via.*sms/i,
      /contact.*via.*sms/i,
      /sms.*whatsapp/i,
    ],
    weight: 0.90,
  },

  // ── EEO / Self-identification ──────────────────────────────────────────────
  // Values are fuzzy-matched, so "Asian" matches "Asian (not Hispanic or Latino)"
  {
    key: 'eeoGender',
    patterns: [/\bgender\b/i, /\bsex\b(?!ual)/i],
    weight: 0.88,
  },
  {
    key: 'eeoRace',
    patterns: [
      /\brace\b/i,
      /\bracial[\s_-]?background\b/i,
      /\brace[\s_-]?\/[\s_-]?ethnicity\b/i,
      // Don't match plain "ethnicity" — covered by eeoHispanic below
    ],
    weight: 0.85,
  },
  {
    key: 'eeoHispanic',
    patterns: [
      /\bhispanic\b/i,
      /\blatinx?\b/i,
      /\blatino\b/i,
      /\blatina\b/i,
      /\bethnic[\s_-]?origin\b/i,
    ],
    weight: 0.90,
  },
  {
    key: 'eeoVeteran',
    patterns: [
      /\bveteran\b/i,
      /\bmilitary[\s_-]?status\b/i,
      /\barmed[\s_-]?forces\b/i,
      /\bprotected[\s_-]?veteran\b/i,
    ],
    weight: 0.88,
  },
  {
    key: 'eeoDisability',
    patterns: [
      /\bdisabilit/i,
      /\bhandicap\b/i,
      /\bdisabled\b/i,
      /\baccommodat/i,
    ],
    weight: 0.88,
  },
  {
    key: 'eeoTransgender',
    patterns: [
      /\btransgender\b/i,
      /\btrans[\s_-]?identity\b/i,
      /\bgender[\s_-]?identit/i,
    ],
    weight: 0.90,
  },
];
