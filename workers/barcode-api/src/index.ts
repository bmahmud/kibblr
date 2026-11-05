import { createApp } from './app';
import { googleKeys } from './auth';
import { defaultUpstreams } from './upstreams';

export default createApp({
  keys: googleKeys,
  upstreams: defaultUpstreams,
  // A wrapper: the Workers runtime rejects `fetch` called without its global `this`.
  fetch: (input, init) => fetch(input, init),
});
