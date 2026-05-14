import { useState, useEffect } from 'react';
import type { UserProfile } from '../shared/profileTypes';
import { getProfile, saveProfile } from '../shared/storage';

// ── Primitive field components ────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  resize: 'vertical',
  minHeight: 72,
  fontFamily: 'inherit',
};

type Updater = (key: keyof UserProfile, value: string | boolean) => void;

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'start' }}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TextInput({
  profile, k, type = 'text', update,
}: { profile: UserProfile; k: keyof UserProfile; type?: string; update: Updater }) {
  return (
    <input
      type={type}
      value={String(profile[k] ?? '')}
      onChange={(e) => update(k, e.target.value)}
      style={INPUT_STYLE}
    />
  );
}

function TextArea({
  profile, k, update,
}: { profile: UserProfile; k: keyof UserProfile; update: Updater }) {
  return (
    <textarea
      value={String(profile[k] ?? '')}
      onChange={(e) => update(k, e.target.value)}
      style={TEXTAREA_STYLE}
      rows={3}
    />
  );
}

function CheckboxField({
  label, hint, profile, k, update,
}: { label: string; hint?: string; profile: UserProfile; k: keyof UserProfile; update: Updater }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{hint}</div>}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={Boolean(profile[k])}
          onChange={(e) => update(k, e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: '#374151' }}>{Boolean(profile[k]) ? 'Yes' : 'No'}</span>
      </label>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#6366f1',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 14,
        paddingBottom: 8,
        borderBottom: '2px solid #e0e7ff',
      }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Options() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saved, setSaved]     = useState(false);
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  if (!profile) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', color: '#64748b' }}>
        Loading profile…
      </div>
    );
  }

  function update(key: keyof UserProfile, value: string | boolean) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : null));
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!profile) return;
    await saveProfile(profile);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  }

  const u = update; // short alias for JSX below

  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '32px 20px 60px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Profile Settings</h1>
        <p style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>
          Your data is stored locally in Chrome. It is never sent to any server.
          Fields left blank will be skipped during autofill.
        </p>
      </div>

      {/* ── Personal ── */}
      <Section title="Personal">
        <Field label="First Name">
          <TextInput profile={profile} k="firstName" update={u} />
        </Field>
        <Field label="Last Name">
          <TextInput profile={profile} k="lastName" update={u} />
        </Field>
        <Field label="Full Name" hint="Used for single-name fields">
          <TextInput profile={profile} k="fullName" update={u} />
        </Field>
        <Field label="Email">
          <TextInput profile={profile} k="email" type="email" update={u} />
        </Field>
        <Field label="Phone">
          <TextInput profile={profile} k="phone" type="tel" update={u} />
        </Field>
        <Field label="City">
          <TextInput profile={profile} k="city" update={u} />
        </Field>
        <Field label="State">
          <TextInput profile={profile} k="state" update={u} />
        </Field>
        <Field label="Location" hint="Used for combined City/State fields">
          <TextInput profile={profile} k="location" update={u} />
        </Field>
        <Field label="Country">
          <TextInput profile={profile} k="country" update={u} />
        </Field>
        <Field label="LinkedIn URL">
          <TextInput profile={profile} k="linkedinUrl" type="url" update={u} />
        </Field>
        <Field label="Website URL">
          <TextInput profile={profile} k="websiteUrl" type="url" update={u} />
        </Field>
        <Field label="Portfolio URL">
          <TextInput profile={profile} k="portfolioUrl" type="url" update={u} />
        </Field>
      </Section>

      {/* ── Work ── */}
      <Section title="Work">
        <Field label="Current Company">
          <TextInput profile={profile} k="currentCompany" update={u} />
        </Field>
        <Field label="Current Title">
          <TextInput profile={profile} k="currentTitle" update={u} />
        </Field>
        <Field label="Years of Experience">
          <TextInput profile={profile} k="yearsExperience" update={u} />
        </Field>
        <Field label="Desired Role">
          <TextInput profile={profile} k="desiredRole" update={u} />
        </Field>
        <Field label="Preferred Locations">
          <TextInput profile={profile} k="preferredLocations" update={u} />
        </Field>
        <CheckboxField label="Open to Relocation" profile={profile} k="openToRelocation" update={u} />
        <Field label="Work Authorization" hint='e.g. "H1B", "US Citizen", "Green Card"'>
          <TextInput profile={profile} k="workAuthorization" update={u} />
        </Field>
        <CheckboxField
          label="Requires Sponsorship"
          hint="Checked = Yes, I need sponsorship"
          profile={profile}
          k="requiresSponsorship"
          update={u}
        />
        <CheckboxField
          label="Authorized to Work in US"
          hint="Checked = Yes"
          profile={profile}
          k="authorizedToWork"
          update={u}
        />
      </Section>

      {/* ── Education ── */}
      <Section title="Education">
        <Field label="School">
          <TextInput profile={profile} k="school" update={u} />
        </Field>
        <Field label="Degree" hint='e.g. "Master of Science"'>
          <TextInput profile={profile} k="degree" update={u} />
        </Field>
        <Field label="Major">
          <TextInput profile={profile} k="major" update={u} />
        </Field>
        <Field label="Graduation Year">
          <TextInput profile={profile} k="graduationYear" update={u} />
        </Field>
      </Section>

      {/* ── Common Answers ── */}
      <Section title="Common Answers">
        <Field label="About Yourself" hint="Used for self-introduction fields">
          <TextArea profile={profile} k="aboutYourself" update={u} />
        </Field>
        <Field label="Why Interested" hint="Why are you interested in this company?">
          <TextArea profile={profile} k="whyInterested" update={u} />
        </Field>
        <Field label="How You Use AI" hint="AI tools / workflow question">
          <TextArea profile={profile} k="howUseAI" update={u} />
        </Field>
      </Section>

      {/* ── Save button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 28px',
            background: dirty ? '#3b82f6' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          Save Profile
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            ✓ Saved!
          </span>
        )}
        {dirty && !saved && (
          <span style={{ fontSize: 12, color: '#f59e0b' }}>Unsaved changes</span>
        )}
      </div>

      {/* ── Consent / Background ── */}
      <Section title="Consent & Background Questions">
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
          These cover common yes/no dropdowns: privacy acknowledgements, SMS opt-in, previous employment.
        </p>
        <Field label="Have you worked here before?" hint='"No" for most applications'>
          <TextInput profile={profile} k="previousEmployee" update={u} />
        </Field>
        <Field label="Privacy Acknowledgement" hint='"Yes" = I have read the privacy notice'>
          <TextInput profile={profile} k="privacyAcknowledgement" update={u} />
        </Field>
        <Field label="SMS / WhatsApp Contact" hint='"Yes" = OK to contact via text'>
          <TextInput profile={profile} k="smsContact" update={u} />
        </Field>
      </Section>

      {/* ── EEO / Self-identification ── */}
      <Section title="EEO / Self-Identification">
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
          Values are fuzzy-matched against dropdown options — "Asian" will match "Asian (not Hispanic or Latino)".
          Leave blank to skip these fields.
        </p>
        <Field label="Gender">
          <TextInput profile={profile} k="eeoGender" update={u} />
        </Field>
        <Field label="Race">
          <TextInput profile={profile} k="eeoRace" update={u} />
        </Field>
        <Field label="Hispanic / Latinx">
          <TextInput profile={profile} k="eeoHispanic" update={u} />
        </Field>
        <Field label="Transgender">
          <TextInput profile={profile} k="eeoTransgender" update={u} />
        </Field>
        <Field label="Veteran Status" hint='e.g. "I am not a protected veteran"'>
          <TextInput profile={profile} k="eeoVeteran" update={u} />
        </Field>
        <Field label="Disability Status" hint={"e.g. \"No, I don't have a disability\""} >
          <TextInput profile={profile} k="eeoDisability" update={u} />
        </Field>
      </Section>

      {/* ── Future enhancements note ── */}
      <div style={{
        marginTop: 40,
        padding: '14px 16px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: '#64748b' }}>Coming soon:</strong> per-company saved answers,
        resume upload, LLM-assisted answer generation, Workday / Greenhouse / Lever adapters,
        export/import profile JSON.
      </div>
    </div>
  );
}
