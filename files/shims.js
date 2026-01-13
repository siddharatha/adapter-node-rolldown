// Polyfills for Node.js environment
import { installPolyfills } from '@sveltejs/kit/node/polyfills';

if (JSON.parse('POLYFILL')) {
    installPolyfills();
}
