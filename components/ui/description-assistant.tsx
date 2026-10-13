'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export function DescriptionAssistant({
  value,
  onChange,
  context = 'business document',
  targetWords = 32,
}: {
  value: string;
  onChange: (value: string) => void;
  context?: string;
  targetWords?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  async function rewrite() {
    if (!value.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, context, targetWords }),
      });
      const result = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error || 'Rewrite unavailable.');
      onChange(result.text);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Rewrite unavailable.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="description-assistant">
      <button type="button" disabled={!value.trim() || loading} onClick={() => void rewrite()}>
        <Sparkles size={13} /> {loading ? 'Rewriting…' : 'AI rewrite'}
      </button>
      <small className={words > targetWords + 12 ? 'over' : ''}>
        {words} words · ideal {targetWords}–{targetWords + 12}
      </small>
      {error ? <small className="error">{error}</small> : null}
    </span>
  );
}
