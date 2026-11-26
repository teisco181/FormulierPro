export const STUDYFLOW_ORIGIN = 'https://teisco181.github.io';

export interface StudyFlowStofPayload {
  vak: string;
  titel: string;
  tekst: string;
}

export interface StudyFlowResultaatVraag {
  vraag: string;
  gegevenAntwoord: string;
  juistAntwoord: string;
  goed: boolean;
}

export interface StudyFlowResultaatPayload {
  vak: string;
  titel: string;
  score: number;
  maxScore: number;
  datum: string;
  vragen: StudyFlowResultaatVraag[];
}

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isEmbeddedInStudyFlow(): boolean {
  if (!isInsideIframe()) return false;
  try {
    if (window.location.origin === STUDYFLOW_ORIGIN) return true;
    const ancestor = window.location.ancestorOrigins?.[0];
    if (ancestor === STUDYFLOW_ORIGIN) return true;
    if (document.referrer && document.referrer.startsWith(STUDYFLOW_ORIGIN)) return true;
  } catch {
    // Ignore cross-origin property access errors
  }
  return false;
}

export function postToStudyFlowReady(): void {
  if (!isInsideIframe()) return;
  try {
    window.parent.postMessage({ type: 'TOETS_READY' }, STUDYFLOW_ORIGIN);
  } catch {
    // Ignore if host rejects targetOrigin mismatch (e.g. non-StudyFlow preview frame)
  }
}

export function postToStudyFlowResult(payload: StudyFlowResultaatPayload): boolean {
  if (!isInsideIframe()) return false;
  window.parent.postMessage(
    {
      type: 'TOETS_RESULTAAT',
      payload,
    },
    STUDYFLOW_ORIGIN
  );
  return true;
}
