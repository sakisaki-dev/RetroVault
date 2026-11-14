import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * The app's last line of defence: an uncaught render error used to unmount everything and leave a blank page. This
 * catches it and shows what broke (message, the first lines of the stack, the page it was on, the browser) with a
 * reload button, so a crash on the phone can be read off a screenshot. Errors outside React (window error,
 * unhandled promise rejections) are kept too and shown alongside. The last crash is remembered in sessionStorage so
 * it survives the reload button once.
 */
const LAST = 'retroVault:lastCrash';
const extra: string[] = [];
const note = (s: string) => {
  extra.push(s.slice(0, 400));
  if (extra.length > 5) extra.shift();
};
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => note(`error: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    note(`promise: ${r?.message ?? String(e.reason)} ${(r?.stack ?? '').split('\n').slice(0, 2).join(' | ')}`);
  });
}

interface State {
  error: Error | null;
  stack: string;
}

export default class CrashScreen extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = [
      ...(error.stack ?? '').split('\n').slice(0, 6),
      '— component —',
      ...(info.componentStack ?? '').split('\n').filter(Boolean).slice(0, 8),
    ].join('\n');
    this.setState({ stack });
    try {
      sessionStorage.setItem(LAST, JSON.stringify({ at: Date.now(), message: error.message, hash: location.hash }));
    } catch {
      // storage unavailable
    }
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', padding: '48px 16px', background: '#0b0f1c', color: '#e8e6df', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ color: '#f5b83d', fontWeight: 700, letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' }}>Retro Vault hit an error</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '8px 0 12px' }}>{error.name}: {error.message}</h1>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
            Page {location.hash || '#'} · {navigator.userAgent.match(/(iPhone OS [\d_]+|Version\/[\d.]+|Chrome\/[\d.]+)/g)?.join(' · ')}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 11, lineHeight: 1.45, background: '#151b2e', padding: 12, borderRadius: 8, maxHeight: '45vh', overflow: 'auto' }}>
            {stack}
            {extra.length ? `\n— also —\n${extra.join('\n')}` : ''}
          </pre>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{ marginTop: 16, padding: '12px 20px', borderRadius: 8, background: '#f5b83d', color: '#0b0f1c', fontWeight: 800, border: 0 }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
