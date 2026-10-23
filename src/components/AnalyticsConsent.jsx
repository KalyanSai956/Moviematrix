import { useEffect, useState } from 'react';
import { BarChart3, Check, Settings2, X } from 'lucide-react';
import { analyticsConfigured, applyAnalyticsConsent, getAnalyticsConsent, track } from '../lib/analytics.js';

export default function AnalyticsConsent() {
  const [consent, setConsent] = useState(() => getAnalyticsConsent());
  const [open, setOpen] = useState(() => getAnalyticsConsent() === 'unset');
  const [showSettings, setShowSettings] = useState(false);
  const configured = analyticsConfigured();

  useEffect(() => {
    if (consent !== 'unset') applyAnalyticsConsent(consent);
  }, []);

  function choose(value) {
    applyAnalyticsConsent(value);
    if (value === 'accepted') track('game_page_viewed', { page: 'home', consent_action: 'accepted' });
    setConsent(value);
    setOpen(false);
    setShowSettings(false);
  }

  return <>
    <button className="privacy-settings-link" onClick={() => { setOpen(true); setShowSettings(true); }} aria-label="Privacy and analytics settings"><Settings2 size={14}/> Privacy settings</button>
    {open && <div className="consent-backdrop" role="presentation">
      <section className="consent-card" role="dialog" aria-modal="true" aria-labelledby="analytics-consent-title">
        <div className="consent-icon"><BarChart3 size={20}/></div>
        <button className="consent-close" onClick={() => { setOpen(false); setShowSettings(false); }} aria-label="Close privacy settings"><X size={17}/></button>
        <p className="eyebrow">YOUR PRIVACY MATTERS</p>
        <h2 id="analytics-consent-title">Help improve MovieMatrix?</h2>
        <p className="consent-copy">With your permission, we use PostHog analytics to understand visits, puzzle starts, completions and shares. Analytics is optional and does not affect gameplay. We do not intentionally send names, emails, phone numbers, crossword answers or typed letters to analytics.</p>
        {!configured && <p className="consent-status">Analytics is not configured yet. You can play normally; no analytics events will be sent until the site owner configures PostHog.</p>}
        {showSettings && <p className="consent-copy">You can change this choice any time using Privacy settings in the footer. Rejecting analytics disables our custom analytics tracking.</p>}
        <div className="consent-actions">
          <button className="secondary-button" onClick={() => choose('rejected')}>Reject analytics</button>
          <button className="primary-button" onClick={() => choose('accepted')}><Check size={16}/> Allow analytics</button>
        </div>
        <p className="consent-footnote">Your choice is saved in this browser. <a href="/privacy.html" target="_blank" rel="noreferrer">Read the privacy notice</a>.</p>
      </section>
    </div>}
  </>;
}
