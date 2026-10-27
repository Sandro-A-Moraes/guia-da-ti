import { renderToString } from 'react-dom/server';
import { App } from './App';
export { routes, pageInfo } from './catalog';
export { preloadRoadmap } from './roadmap-data';
export function render(path: string) { return renderToString(<App path={path} />); }
