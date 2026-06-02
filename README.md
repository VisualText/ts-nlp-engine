# Typescript Class for the NLP Engine

This class calls `nlp.exe` (the command line version of the NLP Engine) via `child_process`.

For production workloads, prefer the [NLPPlus Python package](https://github.com/VisualText/py-package-nlpengine) (native C++ bindings, no subprocess overhead) — this TypeScript class is for Node.js scripts that prefer the simpler shell-out model.

## Basic usage

```typescript
import * as path from 'path';
import { NLPEngine } from './nlp';

const analyzer = 'Telephone-Numbers';
const parentPath = path.dirname(__dirname);
const engineDir = path.join(parentPath, 'nlp-engine-linux');
const analyzersDir = path.join(engineDir, 'analyzers');

const filename = "text.txt";
const nlpEngine = new NLPEngine(engineDir, analyzersDir);
nlpEngine.analyzeStr(analyzer, filename, "the phone number is 555-1212");

const outputContents = nlpEngine.outputFileContents(analyzer, filename, 'codes.json');
```

## NLP Engine command-line executables

`engineDir` must point to a directory containing `nlp.exe`. Pre-built distributions are in:

* [Linux NLP Executable](https://github.com/VisualText/nlp-engine-linux)
* [Windows NLP Executable](https://github.com/VisualText/nlp-engine-windows)
* [macOS NLP Executable](https://github.com/VisualText/nlp-engine-mac)

## API

### `analyzeFile(analyzerFolder, textPath, dev=false, compiled=false): void`

Run the named analyzer over the input text. When `compiled` is `true`, passes `-COMPILED` to `nlp.exe` so the engine loads the analyzer's pre-built `bin/run.<ext>` + `bin/kb.<ext>` shared libraries instead of running interpreted from the `.nlp` source. Build those libraries first via `compileLocal()` or by running the platform's `scripts/compile-analyzer.{sh,ps1}` directly.

### `analyzeStr(analyzerFolder, filename, textStr): void`

Convenience for analyzing an in-memory string — writes it to the analyzer's input dir then calls `analyzeFile`.

### `compileAnalyzer(analyzerFolder, inputTextPath?, kbOnly=false): string`

Shell out to `nlp.exe -COMPILE` (or `-COMPILEKB` if `kbOnly` is true) to generate the analyzer's C++ source trees under `<analyzer>/run/*.cpp` and `<analyzer>/kb/*.cpp` (or just `kb/*.cpp` for KB-only). The trees still need to be built into shared libraries before `analyzeFile(..., compiled=true)` will work — see `compileLocal()`.

If `inputTextPath` is omitted, the function picks the first text file it finds under the analyzer's `input/` directory. The engine requires an input file at compile time but doesn't actually analyze it for `-COMPILE`.

Returns the analyzer directory path.

### `compileLocal(analyzerFolder, inputTextPath, kbOnly=false, ubuntu="ubuntu-latest"): string`

Drive the platform's `scripts/compile-analyzer.{sh,ps1}` to do the full local build end-to-end: `-COMPILE` step, cmake configure + build, and stage the resulting library into `<analyzer>/bin/` under every name the engine's load paths look for (`run.<ext>` / `runu.<ext>` / `kb.<ext>` / `kbu.<ext>`, or just `kb.<ext>` / `kbu.<ext>` for `kbOnly`).

After `compileLocal()` returns, `analyzeFile(..., compiled=true)` will load the staged libraries instead of running interpreted.

The `ubuntu` argument is only used by the Linux script — it selects which set of bundled `nlp.exe` + `compile-libs/<ubuntu>` to use, since the Linux distribution ships multiple Ubuntu variants. Ignored on Windows / macOS.

Returns the analyzer's `bin/` directory path.

### `outputFileContents(analyzerFolder, filename, outputFile): string`

Read a named file out of the analyzer's `<input>/<filename>_log/` directory (where the engine writes parse trees, output.json, etc.). Useful for slurping the analyzer's output back into the calling script.

### Other helpers

| Method | Purpose |
|---|---|
| `analyzerPath(folder)` / `kbPath(folder)` / `specPath(folder)` / `outputDir(folder, textPath)` / `inputFileDir(folder, textPath)` | Convenience path builders. |
| `isAnalyzerFolder(folder)` | Quick sanity check that an analyzer folder has the expected layout. |
| `clearLogFiles(folder)` | Delete all `_log/` subdirectories under the analyzer's `input/`. |
| `createInputDir(analyzer, inputFolder, clearFolder=true)` | Create (or clear+create) `<analyzer>/input/<inputFolder>/`. |
| `createInputFile(analyzer, filename, text)` | Create an input subdir and drop a single `input.txt` with the given text in it. |
