import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The chunk address from the import error, e.g. "Failed to fetch dynamically imported module: https://…/assets/X-hash.js".
function failedChunk(error: unknown) {
  const match = String((error as Error)?.message ?? error).match(/https?:\/\/\S+?\.js\b/);
  return match && new URL(match[0]).origin === window.location.origin ? match[0] : undefined;
}

// The chunk responds again, but a module it imports keeps the failed address. Only a page reload clears it.
export class ReloadRequired extends Error {}

const responds = (url: string) => fetch(url, { cache: 'no-store' }).then(response => response.ok, () => false);

// Some browsers keep a failed module address until the page reloads. After a failure, each new request uses a new query string.
// The new address only covers the chunk itself, so a retry that fails while the chunk responds asks for a reload.
export function retryableImport<M>(load: () => Promise<M>) {
  let attempt = 0;
  let chunk: string | undefined;
  return () => {
    const retry = chunk;
    const loading: Promise<M> = retry ? import(/* @vite-ignore */ `${retry}?retry=${++attempt}`) : load();
    return loading.catch(async error => {
      chunk ??= failedChunk(error);
      if (retry && await responds(retry)) throw new ReloadRequired('The browser kept a failed module dependency.');
      throw error;
    });
  };
}

// React.lazy also keeps a rejected import in cache. After a failure the loader creates a new lazy component.
// request should come from retryableImport, or combine several of them.
export function retryableLazy<M, P extends object>(request: () => Promise<M>, pick: (module: M) => ComponentType<P>) {
  const create = () => lazy(() => request().then(module => ({ default: pick(module) })));
  let current = create();
  return { get: () => current, reset: () => { current = create(); } };
}

export const reloadMessage = 'A conexão voltou, mas o navegador precisa recarregar a página para usar o arquivo.';

type Loader<P extends object> = { get: () => ComponentType<P>; reset: () => void };

class LoadBoundary extends Component<{ fallback: (reload: boolean) => ReactNode; onError: () => void; children: ReactNode }, { failed: boolean; reload: boolean }> {
  state = { failed: false, reload: false };
  static getDerivedStateFromError(error: unknown) { return { failed: true, reload: error instanceof ReloadRequired }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback(this.state.reload) : this.props.children; }
}

// Contains a failed download inside the component, so the rest of the page stays usable.
export function LazyLoad<P extends object>({ loader, props, loading, message }: { loader: Loader<P>; props: P; loading: ReactNode; message: string }) {
  const [attempt, setAttempt] = useState(0);
  const Loaded = loader.get();
  // When only a reload recovers the download, the retry button gives way to the reload.
  const failure = (reload: boolean) => <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 p-4 text-center">
    <p className="text-sm">{message} {reload ? reloadMessage : 'Verifique a conexão e tente novamente.'}</p>
    <div className="flex flex-wrap justify-center gap-2">
      {!reload && <Button type="button" size="sm" onClick={() => setAttempt(value => value + 1)}><RotateCcw />Tentar novamente</Button>}
      <Button type="button" size="sm" variant={reload ? 'default' : 'ghost'} onClick={() => window.location.reload()}>Recarregar a página</Button>
    </div>
  </div>;
  return <LoadBoundary key={attempt} fallback={failure} onError={loader.reset}>
    <Suspense fallback={loading}><Loaded {...props} /></Suspense>
  </LoadBoundary>;
}
