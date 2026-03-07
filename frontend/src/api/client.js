import axios from 'axios';

export const API_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||
  'https://archcoder-llm-excel-plotter-agent.hf.space';

const HEALTH_PATH = '/health';
const WAKE_DEBOUNCE_MS = 90 * 1000;
const MAX_BACKOFF_MS = 12000;
const DEFAULT_TIMEOUT_MS = 120000;
const BASE_BACKOFF_MS = 1200;
const DEFAULT_MAX_RETRIES = 4;
const WARMUP_INTERVAL_MS = Number(
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_WARMUP_INTERVAL_MS) || 0
);

let likelyAwakeUntil = 0;
let activeWakePromise = null;

function now() {
  return Date.now();
}

function markAwake() {
  likelyAwakeUntil = now() + WAKE_DEBOUNCE_MS;
}

function isLikelyAwake() {
  return now() < likelyAwakeUntil;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt) {
  const capped = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** (attempt - 1)));
  const jitter = Math.floor(Math.random() * 350);
  return capped + jitter;
}

function isRetryableError(error) {
  if (!error) return false;
  if (!error.response) return true; // network timeout, DNS, CORS preflight issues
  const status = error.response.status;
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

export async function pingHealth(timeout = 5000) {
  try {
    const res = await axios.get(`${API_URL}${HEALTH_PATH}`, {
      timeout,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.status >= 200 && res.status < 300) {
      markAwake();
      return { ok: true, status: res.status, data: res.data };
    }
    return { ok: false, status: res.status };
  } catch (error) {
    return {
      ok: false,
      error,
      status: error.response?.status,
    };
  }
}

async function wakeBackend(onStatus) {
  if (isLikelyAwake()) return { ok: true, skipped: true };
  if (!activeWakePromise) {
    activeWakePromise = pingHealth(7000).finally(() => {
      activeWakePromise = null;
    });
  }
  if (onStatus) onStatus('waking');
  return activeWakePromise;
}

export async function requestWithRetry(options) {
  const {
    method,
    path,
    data,
    headers,
    timeout = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    wakeBeforeFirstTry = true,
    onStatus,
  } = options;

  if (wakeBeforeFirstTry) {
    await wakeBackend(onStatus);
  }

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    try {
      if (attempt > 1 && onStatus) {
        onStatus('retrying', { attempt, maxRetries });
      } else if (onStatus) {
        onStatus('requesting', { attempt, maxRetries });
      }

      const response = await axios({
        method,
        url: `${API_URL}${path}`,
        data,
        headers,
        timeout,
      });

      markAwake();
      if (onStatus) onStatus('ready');
      return response;
    } catch (error) {
      const retryable = isRetryableError(error);
      const shouldRetry = retryable && attempt <= maxRetries;

      if (!shouldRetry) {
        if (onStatus) onStatus('failed', { error });
        throw error;
      }

      if (onStatus) onStatus('waking', { attempt, maxRetries, error });
      await wakeBackend(onStatus);

      const delay = backoffDelay(attempt);
      if (onStatus) onStatus('backoff', { attempt, maxRetries, delay });
      await sleep(delay);
    }
  }

  throw new Error('Request retry loop exited unexpectedly.');
}

export function startWarmupPinger() {
  if (!WARMUP_INTERVAL_MS || Number.isNaN(WARMUP_INTERVAL_MS)) {
    return () => {};
  }

  const minInterval = Math.max(60000, WARMUP_INTERVAL_MS);

  const runWarmup = async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (isLikelyAwake()) return;
    await pingHealth(5000);
  };

  const intervalId = setInterval(runWarmup, minInterval);
  runWarmup();

  return () => clearInterval(intervalId);
}
