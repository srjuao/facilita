import React from 'react';

const reloadKey = 'facilita_chunk_reload_at';
const retryWindowMs = 30_000;

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload (css|module)/i.test(message);
}

export function reloadAfterChunkError(error: unknown) {
  if (!isChunkLoadError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(reloadKey) || 0);
    if (Date.now() - last < retryWindowMs) return false;
    sessionStorage.setItem(reloadKey, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export class ChunkLoadBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error) { reloadAfterChunkError(error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-load-error" role="alert">
      <section>
        <h1>Não foi possível carregar esta tela</h1>
        <p>O site pode ter sido atualizado enquanto esta página estava aberta. Recarregue para continuar.</p>
        <button className="btn primary" type="button" onClick={() => window.location.reload()}>Recarregar página</button>
      </section>
    </main>;
  }
}
