import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The chunk address from the import error, e.g. "Failed to fetch dynamically imported module: https://…/assets/X-hash.js".
function failedChunk(error: unknown) {
  const match = String((error as Error)?.message ?? error).match(/https?:\/\/\S+?\.js\b/);
  return match && new URL(match[0]).origin === window.location.origin ? match[0] : undefined;
}

// Some browsers keep a failed module address until the page reloads. After a failure, each new request uses a new query string.
export function retryableImport<M>(load: () => Promise<M>) {
  let attempt = 0;
  let chunk: string | undefined;
  return () => {
    const loading: Promise<M> = chunk ? import(/* @vite-ignore */ `${chunk}?retry=${++attempt}`) : load();
    return loading.catch(error => { chunk ??= failedChunk(error); throw error; });
  };
}

// React.lazy also keeps a rejected import in cache. After a failure the loader creates a new lazy component.
export function retryableLazy<M, P extends object>(load: () => Promise<M>, pick: (module: M) => ComponentType<P>) {
  const request = retryableImport(load);
  const create = () => lazy(() => request().then(module => ({ default: pick(module) })));
  let current = create();
  return { get: () => current, reset: () => { current = create(); } };
}

type Loader<P extends object> = { get: () => ComponentType<P>; reset: () => void };

class LoadBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// Contains a failed download inside the component, so the rest of the page stays usable.
export function LazyLoad<P extends object>({ loader, props, loading, message }: { loader: Loader<P>; props: P; loading: ReactNode; message: string }) {
  const [attempt, setAttempt] = useState(0);
  const Loaded = loader.get();
  const failure = <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 p-4 text-center">
    <p className="text-sm">{message} Verifique a conexão e tente novamente.</p>
    <div className="flex flex-wrap justify-center gap-2">
      <Button type="button" size="sm" onClick={() => setAttempt(value => value + 1)}><RotateCcw />Tentar novamente</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => window.location.reload()}>Recarregar a página</Button>
    </div>
  </div>;
  return <LoadBoundary key={attempt} fallback={failure} onError={loader.reset}>
    <Suspense fallback={loading}><Loaded {...props} /></Suspense>
  </LoadBoundary>;
}
