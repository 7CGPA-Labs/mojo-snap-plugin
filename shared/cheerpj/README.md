# shared/cheerpj/

This directory is the self-hosted runtime slot for the **Java ME emulation** feature (Implementation Plan §4).

## What goes here

| File | Source | Purpose |
|---|---|---|
| `loader.js` | This repo | MojoSnap bridge shim (already present) |
| `freej2me.jar` | [hex007/freej2me](https://github.com/hex007/freej2me) | Java ME runtime running inside CheerpJ |
| `cj3loader.js` | [CheerpJ 3.x distribution](https://labs.leaningtech.com/cheerpj3) | CheerpJ VM loader (optional self-host) |
| `cj3worker.js` | CheerpJ distribution | CheerpJ background worker |
| `*.wasm` | CheerpJ distribution | WebAssembly JVM modules |

## Getting `freej2me.jar`

```bash
# Clone and build FreeJ2ME
git clone https://github.com/hex007/freej2me.git
cd freej2me
mvn package -DskipTests
# The output JAR will be at target/freej2me-*.jar
# Copy it here as freej2me.jar
cp target/freej2me-*.jar ../shared/cheerpj/freej2me.jar
```

> **Note:** A pre-built `freej2me.jar` can also be downloaded from the
> [FreeJ2ME releases page](https://github.com/hex007/freej2me/releases).

## Using the CDN (default)

By default, `j2me.js` loads CheerpJ from the Leaning Technologies CDN so you
**do not** need to self-host the runtime files.  The `shared/cheerpj/` folder
is only needed if you want to:

- Run the plugin fully offline
- Pin a specific CheerpJ version
- Bundle extra Java classpath JARs (e.g. MMAPI stubs)

To switch to self-hosted mode, update `CHEERPJ_RUNTIME_URL` in `src/Web/j2me.js`:

```javascript
// Before (CDN):
const CHEERPJ_RUNTIME_URL = 'https://cjrtnc.leaningtech.com/3.0/cj3loader.js';

// After (self-hosted):
const CHEERPJ_RUNTIME_URL = 'shared/cheerpj/loader.js';
```

## Directory contents (after self-hosting)

```
shared/cheerpj/
├── loader.js           ← MojoSnap bridge shim
├── freej2me.jar        ← FreeJ2ME runtime (place here manually)
├── cj3loader.js        ← CheerpJ loader   (place here manually)
├── cj3worker.js        ← CheerpJ worker   (place here manually)
└── *.wasm              ← CheerpJ WASM JVM (place here manually)
```
