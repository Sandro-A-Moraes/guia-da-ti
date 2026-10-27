import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { preloadRoadmap } from './roadmap-data';
import './styles.css';
const root = document.getElementById('root')!;
const path = window.location.pathname.replace(/\/$/, '') || '/';
// A roadmap page needs its step tree before hydration, or the markup would differ from the pre-rendered HTML.
preloadRoadmap(path).catch(() => undefined).then(() => {
  if (root.querySelector('main')) hydrateRoot(root, <App path={path} />);
  else createRoot(root).render(<App path={path} />);
});
