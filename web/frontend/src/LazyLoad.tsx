import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// React.lazy keeps a rejected import in cache. After a failure the loader creates a new lazy component, so the next render requests the module again.
export function retryableLazy<P extends object>(load: () => Promise<ComponentType<P>>) {
  const create = () => lazy(() => load().then(component => ({ default: component })));
  let current = create();
  return { get: () => current, reset: () => { current = create(); } };
}

type Loader<P extends object> = ReturnType<typeof retryableLazy<P>>;

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
