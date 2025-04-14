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

    analyzeFile(analyzerFolder: string, textPath: string, dev: boolean = false): void {
        this.clearLogFiles(analyzerFolder);
        const analyzerPath = path.join(this.analyzersDir, analyzerFolder);
        const inputTextPath = path.join(analyzerPath, "input", textPath);

        try {
            const executablePath = path.join(this.engineDir, "nlp.exe");
            const args = [executablePath, "-ANA", analyzerPath, "-WORK", this.engineDir, inputTextPath];
            if (dev) {
                args.push("-DEV");
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