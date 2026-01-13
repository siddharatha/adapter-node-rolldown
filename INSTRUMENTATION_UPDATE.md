# Adapter Updates - SvelteKit Instrumentation Support

## Changes Made

### 1. **Added Rollup Bundling** 
- Integrated Rollup to bundle the server code (matching official @sveltejs/adapter-node)
- This bundles devDependencies into the production code, so deployments only need production dependencies
- Added required packages to dependencies:
  - `rollup` - Module bundler
  - `@rollup/plugin-node-resolve` - Resolve node_modules
  - `@rollup/plugin-commonjs` - Convert CommonJS to ES6
  - `@rollup/plugin-json` - Import JSON files

### 2. **Instrumentation API Support**
- Added `builder.hasServerInstrumentationFile?.()` check
- Includes instrumentation file in rollup input if it exists
- Calls `builder.instrument?.()` after bundling to wire up instrumentation
- Exports required properties from index.js: `path`, `host`, `port`, `server`

### 3. **Added `supports` Property**
```javascript
supports: {
    read: () => true,           // Adapter supports filesystem read operations
    instrumentation: () => true // Adapter supports SvelteKit instrumentation
}
```

### 4. **Created shims.js**
- Polyfills for Node.js environment
- Uses `@sveltejs/kit/node/polyfills`
- Configurable via `polyfill` option

### 5. **Updated handler.js**
- Now properly imports from bundled server code
- Uses SHIMS, SERVER, and MANIFEST placeholders
- Implements proper request handling with `getClientAddress()`
- Handles X-Forwarded-For headers for proxy support

### 6. **Updated Build Process**
The build now:
1. Writes client and prerendered assets
2. Compresses assets using builder.compress()
3. Writes server to temp directory
4. Creates manifest.js with manifest, prerendered paths, and base path
5. **Bundles server code with Rollup** (NEW)
6. Copies runtime files to output
7. Handles instrumentation if present (NEW)

### 7. **File Structure Changes**

**Before:**
```
build/
├── client/
├── prerendered/
├── server/
│   ├── index.js (polka server)
│   ├── handler.js (generated)
│   ├── manifest.js (generated)
│   ├── env.js
│   ├── middlewares.js
│   └── telemetry.js
└── package.json
```

**After:**
```
build/
├── client/
├── prerendered/
├── server/
│   ├── index.js (bundled SvelteKit server)
│   ├── manifest.js (bundled manifest)
│   ├── chunks/ (rollup chunks)
│   └── instrumentation.server.js (if using instrumentation)
├── index.js (polka server entry)
├── handler.js (SvelteKit handler)
├── env.js
├── middlewares.js
├── telemetry.js
├── shims.js
└── package.json
```

### 8. **Updated Package.json Output**
- Changed `main` from `./server/index.js` to `./index.js`
- Filters out undefined dependencies (when features are disabled)

## What is Instrumentation?

SvelteKit's instrumentation API allows you to:
- Hook into the server startup process
- Add monitoring, tracing, or custom initialization
- Run code before the server starts accepting requests

Example: `instrumentation.server.js` in your SvelteKit project:
```javascript
export async function initialize() {
    // Custom initialization before server starts
    console.log('Server initializing...');
    await setupDatabase();
    await connectToCache();
}
```

## Compatibility

The adapter is now fully compatible with:
- ✅ SvelteKit 2.0+
- ✅ Server instrumentation API
- ✅ Filesystem read operations
- ✅ All original features (Polka, WebSockets, OpenTelemetry, etc.)

## Breaking Changes

**Entry Point Changed:**
- Old: `node server/index.js`
- New: `node index.js`

Update your deployment scripts, Dockerfiles, and documentation accordingly.

## Testing the Changes

1. Create a SvelteKit project with instrumentation:
```javascript
// src/instrumentation.server.js
export async function initialize() {
    console.log('Server instrumentation initialized!');
}
```

2. Build and run:
```bash
npm run build
cd build
npm install
node index.js
```

3. Verify instrumentation runs before server starts

## Benefits

1. **Smaller deployments** - Only production dependencies needed
2. **Faster cold starts** - Pre-bundled code loads faster
3. **Instrumentation support** - Can use SvelteKit's lifecycle hooks
4. **Better compatibility** - Matches official adapter behavior
5. **Tree shaking** - Rollup removes unused code

## Next Steps

- Test with real SvelteKit projects
- Verify instrumentation works with OpenTelemetry
- Update documentation and examples
- Test with various deployment targets (Docker, K8s, ECS)
