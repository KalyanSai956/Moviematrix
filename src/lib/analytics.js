import posthog from 'posthog-js';

const CONSENT_KEY = 'moviematrix.analyticsConsent.v1';
let initialized = false;
let currentConsent = 'unset';

export function getAnalyticsConsent() {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'accepted' || value === 'rejected' ? value : 'unset';
  } catch {
    return 'unset';
  }
}

export function analyticsConfigured() {
  return Boolean(import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST);
}

function initPostHog() {
  if (initialized || !analyticsConfigured()) return false;
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    person_profiles: 'never',
    persistence: 'localStorage',
    respect_dnt: true,
    loaded: (client) => {
      if (currentConsent !== 'accepted') client.opt_out_capturing();
    },
  });
  initialized = true;
  return true;
}

export function applyAnalyticsConsent(consent) {
  currentConsent = consent;
  try { localStorage.setItem(CONSENT_KEY, consent); } catch { /* consent remains session-only if storage is unavailable */ }
  if (consent === 'accepted') {
    initPostHog();
    if (initialized) posthog.opt_in_capturing();
    return;
  }
  if (initialized) posthog.opt_out_capturing();
}

export function track(event, properties = {}) {
  if (currentConsent !== 'accepted' || !analyticsConfigured()) return;
  initPostHog();
  if (!initialized || posthog.has_opted_out_capturing()) return;
  posthog.capture(event, {
    app: 'moviematrix',
    ...properties,
  });
}

export function initializeAnalyticsFromSavedConsent() {
  const consent = getAnalyticsConsent();
  currentConsent = consent;
  if (consent === 'accepted') {
    initPostHog();
    if (initialized) posthog.opt_in_capturing();
  } else if (consent === 'rejected' && initialized) {
    posthog.opt_out_capturing();
  }
  return consent;
}

export function resetAnalyticsConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
  currentConsent = 'unset';
  if (initialized) posthog.opt_out_capturing();
}
