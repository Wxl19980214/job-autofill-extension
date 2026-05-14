import type { UserProfile } from './profileTypes';
import { STORAGE_KEY } from './constants';

export const DEFAULT_PROFILE: UserProfile = {
  // Personal
  firstName: 'Xilin',
  lastName: 'Wang',
  fullName: 'Xilin Wang',
  email: 'stinsionwang@gmail.com',
  phone: '+1 734-968-8779',
  city: 'Austin',
  state: 'Texas',
  location: 'Austin, Texas',
  linkedinUrl: 'https://www.linkedin.com/in/xilin-wang-37652b188/',
  websiteUrl: '',
  portfolioUrl: '',

  // Work
  currentCompany: 'Apple',
  currentTitle: 'Software Engineer',
  yearsExperience: '3',
  desiredRole: 'Software Engineer',
  preferredLocations: 'Anywhere in the United States',
  openToRelocation: true,
  workAuthorization: 'H1B',
  requiresSponsorship: true,
  authorizedToWork: true, // H1B holders are authorized to work

  // Education
  school: 'University of Michigan, Ann Arbor',
  degree: 'Master of Science',
  major: 'Computer Science',
  graduationYear: '2023',

  // Free-text answers
  whyInterested: '',
  aboutYourself:
    'Software Engineer with 3+ years of experience in backend and distributed systems at Apple, ' +
    'specializing in Java, Flink, Kafka, and Spark. Led high-throughput data platform work and ' +
    'real-time streaming pipelines supporting millions of records.',
  howUseAI: '',
};

export async function getProfile(): Promise<UserProfile> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as Partial<UserProfile> | undefined;
      resolve({ ...DEFAULT_PROFILE, ...stored });
    });
  });
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: profile }, resolve);
  });
}
