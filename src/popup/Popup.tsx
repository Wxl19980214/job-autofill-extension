import { useState } from 'react';
import type { ContentMessage, ContentResponse, AutofillResult } from '../shared/profileTypes';

type Status = 'idle' | 'loading' | 'success' | 'error';

const BTN: React.CSSProperties = {
  width: '100%',
  padding: '9px 14px',
  border: 'none',
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'opacity 0.1s',
};

export default function Popup() {
  const [status, setStatus]   = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function send(action: ContentMessage['action'], extra?: Partial<ContentMessage>) {
    setStatus('loading');
    setMessage('');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      setStatus('error');
      setMessage('No active tab found.');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage<ContentMessage, ContentResponse>(
        tab.id,
        { action, ...extra }
      );

      if (response?.success) {
        setStatus('success');
        if (action === 'autofill' && response.result) {
          const r = response.result as AutofillResult;
          setMessage(`Filled: ${r.filled}  ·  Suggested: ${r.suggested}  ·  Skipped: ${r.skipped}`);
        } else if (action === 'highlight') {
          setMessage('Fields highlighted. Green = high confidence, Yellow = review, Red = ambiguous.');
        } else if (action === 'clearHighlights') {
          setMessage('Highlights cleared.');
        }
      } else {
        setStatus('error');
        setMessage(response?.error ?? 'Failed to communicate with the page.');
      }
    } catch {
      setStatus('error');
      setMessage('Cannot connect to this page. Try refreshing the tab.');
    }
  }

  const statusColor = { success: '#16a34a', error: '#dc2626', loading: '#64748b', idle: '#64748b' }[status];
  const statusBg    = { success: '#f0fdf4', error: '#fef2f2', loading: '#f8fafc', idle: '#f8fafc' }[status];
  const statusBorder = { success: '#bbf7d0', error: '#fecaca', loading: '#e2e8f0', idle: '#e2e8f0' }[status];

  return (
    <div style={{ width: 270, padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#fff', fontWeight: 700, flexShrink: 0,
        }}>A</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Job Autofill</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Never auto-submits</div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <button
          style={{ ...BTN, background: '#3b82f6', color: '#fff' }}
          onClick={() => send('autofill')}
          disabled={status === 'loading'}
        >
          ⚡ Autofill Current Page
        </button>

        <button
          style={{ ...BTN, background: '#6366f1', color: '#fff' }}
          onClick={() => send('highlight')}
          disabled={status === 'loading'}
        >
          🔍 Highlight Detected Fields
        </button>

        <button
          style={{ ...BTN, background: '#e2e8f0', color: '#475569' }}
          onClick={() => send('clearHighlights')}
          disabled={status === 'loading'}
        >
          ✕  Clear Highlights
        </button>

        <div style={{ borderTop: '1px solid #f1f5f9', margin: '2px 0' }} />

        <button
          style={{ ...BTN, background: '#0f172a', color: '#fff' }}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          ⚙  Open Profile Settings
        </button>
      </div>

      {/* Status banner */}
      {status !== 'idle' && (
        <div style={{
          marginTop: 12,
          padding: '8px 10px',
          borderRadius: 6,
          fontSize: 12,
          background: statusBg,
          color: statusColor,
          border: `1px solid ${statusBorder}`,
          lineHeight: 1.5,
        }}>
          {status === 'loading' ? '⏳ Working…' : message}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, fontSize: 10, color: '#94a3b8' }}>
        <span><span style={{ color: '#22c55e' }}>●</span> Filled</span>
        <span><span style={{ color: '#eab308' }}>●</span> Suggested</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Ambiguous</span>
      </div>
    </div>
  );
}
