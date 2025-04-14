# Typescipt Class for the NLP Engine

This class calls the nlp.exe using the command line version of the engine: nlp.exe.

Example:

```
    const analyzer = 'Telephone-Nummbers';
    const parentPath = path.dirname(__dirname);
    const engineDir = path.join(parentPath, 'nlp-engine-linux');
    const analyzersDir = path.join(parentPath, 'nlp-engine-linux', 'analyzers');

    const filename = "text.txt";
    const nlpEngine = new NLPEngine(engineDir, analyzersDir);
    nlpEngine.analyzeStr(analyzer, filename, text);

    const outputContents = nlpEngine.outputFileContents(analyzer, filename, 'codes.json');
```
