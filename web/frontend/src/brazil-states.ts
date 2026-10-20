import { retryableImport } from './LazyLoad';

export type BrazilStatesMap = typeof import('./data/brazil-states.json');

// The filter and the form request the map directly, without a static import in another chunk.
// A failure then belongs to this request, and the retry downloads it from a new address.
const request = retryableImport(() => import('./data/brazil-states.json'));
export const requestBrazilStates = () => request().then(module => module.default as BrazilStatesMap);
