import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export class NLPEngine {
    private engineDir: string;
    private analyzersDir: string;

    constructor(engineDir: string, analyzersDir: string) {
        this.engineDir = engineDir;
        this.analyzersDir = analyzersDir;
    }

    analyzerPath(analyzerFolder: string): string {
        return path.join(this.analyzersDir, analyzerFolder);
    }

    kbPath(analyzerFolder: string): string {
        return path.join(this.analyzerPath(analyzerFolder), "kb", "user");
    }

    specPath(analyzerFolder: string): string {
        return path.join(this.analyzerPath(analyzerFolder), "spec");
    }

    outputDir(analyzerFolder: string, textPath: string): string {
        return path.join(this.analyzerPath(analyzerFolder), "input", `${textPath}_log`);
    }

    outputFileContents(analyzerFolder: string, filename: string, outputFile: string): string {
        const outputPath = path.join(this.outputDir(analyzerFolder, filename), outputFile);
        return fs.readFileSync(outputPath, "utf-8");
    }

    inputFileDir(analyzerFolder: string, textPath: string): string {
        return path.join(this.analyzerPath(analyzerFolder), "input", textPath);
    }

    /**
     * Run nlp.exe over textPath using the analyzer at analyzerFolder.
     *
     * If `compiled` is true, passes `-COMPILED` to nlp.exe so the engine
     * loads the analyzer's pre-built `bin/run.<ext>` + `bin/kb.<ext>`
     * shared libraries instead of running interpreted from the .nlp
     * source. Build those libraries first via compileAnalyzer() /
     * compileLocal() or by running the platform's
     * scripts/compile-analyzer.{sh,ps1} directly.
     */
    analyzeFile(analyzerFolder: string, textPath: string, dev: boolean = false, compiled: boolean = false): void {
        this.clearLogFiles(analyzerFolder);
        const analyzerPath = path.join(this.analyzersDir, analyzerFolder);
        const inputTextPath = path.join(analyzerPath, "input", textPath);

        try {
            const executablePath = path.join(this.engineDir, "nlp.exe");
            const args = [executablePath, "-ANA", analyzerPath, "-WORK", this.engineDir, inputTextPath];
            if (dev) {
                args.push("-DEV");
            }
            if (compiled) {
                args.push("-COMPILED");
            }

            const output = fs.openSync("output.txt", "w");
            const errors = fs.openSync("errors.txt", "w");

            child_process.spawnSync(args[0], args.slice(1), {
                stdio: ['ignore', output, errors],
                encoding: 'utf-8'
            });

            fs.closeSync(output);
            fs.closeSync(errors);
        } catch (error) {
            console.error(`An error occurred: ${error}`);
        }
    }

    /**
     * Generate C++ source files for the named analyzer.
     *
     * Runs `nlp.exe -COMPILE` (or `-COMPILEKB` if `kbOnly` is true),
     * which emits `<analyzer>/run/*.cpp` + `<analyzer>/kb/*.cpp` (or
     * just `<analyzer>/kb/*.cpp` for KB-only). The trees still need to
     * be built into shared libraries before analyzeFile with compiled
     * = true will work — see compileLocal() to drive the local cmake
     * build via scripts/compile-analyzer.{sh,ps1}.
     *
     * If `inputTextPath` isn't provided, the function picks the first
     * text file it finds under the analyzer's input/ directory — the
     * engine requires an input file at compile time but doesn't
     * actually analyze it for -COMPILE.
     *
     * Returns the analyzer directory path.
     */
    compileAnalyzer(analyzerFolder: string, inputTextPath?: string, kbOnly: boolean = false, analyzerOnly: boolean = false): string {
        if (kbOnly && analyzerOnly) {
            throw new Error("compileAnalyzer: kbOnly and analyzerOnly are mutually exclusive");
        }
        const analyzerPath = path.join(this.analyzersDir, analyzerFolder);
        let resolvedInput = inputTextPath;
        if (!resolvedInput) {
            const inputDir = path.join(analyzerPath, "input");
            if (fs.existsSync(inputDir) && fs.statSync(inputDir).isDirectory()) {
                for (const entry of fs.readdirSync(inputDir).sort()) {
                    const candidate = path.join(inputDir, entry);
                    if (fs.statSync(candidate).isFile()) {
                        resolvedInput = candidate;
                        break;
                    }
                }
            }
        }
        if (!resolvedInput || !fs.existsSync(resolvedInput)) {
            throw new Error(
                "compileAnalyzer needs an input text file path " +
                "(none provided and analyzer's input/ has no files)"
            );
        }

        const executablePath = path.join(this.engineDir, "nlp.exe");
        const flag = kbOnly ? "-COMPILEKB" : (analyzerOnly ? "-COMPILEANA" : "-COMPILE");
        const args = [flag, "-ANA", analyzerPath, "-WORK", this.engineDir, resolvedInput];

        const result = child_process.spawnSync(executablePath, args, {
            stdio: 'inherit',
            encoding: 'utf-8'
        });
        if (result.status !== 0) {
            throw new Error(`compileAnalyzer failed (exit ${result.status})`);
        }
        return analyzerPath;
    }

    /**
     * Drive the platform's scripts/compile-analyzer.{sh,ps1} to do the
     * full local build end-to-end: -COMPILE step, cmake configure +
     * build, and stage the resulting library into <analyzer>/bin/
     * under every name the engine's load paths look for (run.<ext> /
     * runu.<ext> / kb.<ext> / kbu.<ext>, or just kb.<ext> / kbu.<ext>
     * for kbOnly, or just run.<ext> / runu.<ext> for analyzerOnly).
     *
     * After this returns, analyzeFile(..., compiled=true) will load
     * the staged libraries instead of running interpreted.
     *
     * The `ubuntu` argument is only used by the Linux script — it
     * selects which set of bundled nlp.exe + compile-libs/<ubuntu> to
     * use, since the Linux distribution ships multiple Ubuntu variants.
     * Ignored on Windows / macOS.
     *
     * Returns the analyzer's bin/ directory path.
     */
    compileLocal(analyzerFolder: string, inputTextPath: string, kbOnly: boolean = false, analyzerOnly: boolean = false, ubuntu: string = "ubuntu-latest"): string {
        if (kbOnly && analyzerOnly) {
            throw new Error("compileLocal: kbOnly and analyzerOnly are mutually exclusive");
        }
        const analyzerPath = path.join(this.analyzersDir, analyzerFolder);
        const isWindows = process.platform === 'win32';
        const scriptName = isWindows ? 'compile-analyzer.ps1' : 'compile-analyzer.sh';
        const scriptPath = path.join(this.engineDir, 'scripts', scriptName);

        if (!fs.existsSync(scriptPath)) {
            throw new Error(`compile-analyzer script not found at ${scriptPath}`);
        }

        let command: string;
        let args: string[];
        if (isWindows) {
            command = 'powershell.exe';
            args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
            if (kbOnly) {
                args.push('-KbOnly');
            } else if (analyzerOnly) {
                args.push('-AnalyzerOnly');
            }
            args.push(analyzerPath, inputTextPath);
        } else {
            command = 'bash';
            args = [scriptPath];
            if (kbOnly) {
                args.push('--kb-only');
            } else if (analyzerOnly) {
                args.push('--analyzer-only');
            }
            args.push(analyzerPath, inputTextPath);
            // Only the Linux script accepts the ubuntu variant arg.
            if (process.platform === 'linux') {
                args.push(ubuntu);
            }
        }

        const result = child_process.spawnSync(command, args, {
            stdio: 'inherit',
            encoding: 'utf-8'
        });
        if (result.status !== 0) {
            throw new Error(`compileLocal failed (exit ${result.status})`);
        }
        return path.join(analyzerPath, 'bin');
    }

    analyzeStr(analyzerFolder: string, filename: string, textStr: string): void {
        const inputPath = this.inputFileDir(analyzerFolder, filename);
        fs.writeFileSync(inputPath, textStr, "utf-8");
        this.analyzeFile(analyzerFolder, filename, false);
    }

    isAnalyzerFolder(analyzerFolder: string): boolean {
        const requiredFolders = ['spec', 'input', 'kb/user'];
        for (const folder of requiredFolders) {
            if (!fs.existsSync(path.join(this.analyzersDir, analyzerFolder, folder))) {
                return false;
            }
        }
        return true;
    }

    clearLogFiles(analyzerFolder: string): void {
        const logPath = path.join(this.analyzersDir, analyzerFolder, "input");
        fs.readdirSync(logPath).forEach((fileOrDir) => {
            const fullPath = path.join(logPath, fileOrDir);
            if (fs.statSync(fullPath).isDirectory() && fileOrDir.endsWith("_log")) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            }
        });
    }

    createInputDir(analyzer: string, inputFolder: string, clearFolder: boolean = true): string {
        const inputPath = path.join(this.analyzerPath(analyzer), "input", inputFolder);
        if (clearFolder && fs.existsSync(inputPath)) {
            fs.rmSync(inputPath, { recursive: true, force: true });
        }
        if (!fs.existsSync(inputPath)) {
            fs.mkdirSync(inputPath, { recursive: true });
        }
        return inputPath;
    }

    createInputFile(analyzer: string, filename: string, text: string): string {
        const inputPath = this.createInputDir(analyzer, filename);
        const filePath = path.join(inputPath, "input.txt");
        fs.writeFileSync(filePath, text, "utf-8");
        return inputPath;
    }
}