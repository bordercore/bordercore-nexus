import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import Prism from "prismjs";
import "prismjs/components/prism-python";

// Declare Pyodide types
declare global {
  interface Window {
    loadPyodide?: (config: {
      indexURL: string;
      stdout: (text: string) => void;
      stderr: (text: string) => void;
    }) => Promise<any>;
  }
}

export interface PythonConsoleHandle {
  initialize: () => void;
}

interface PythonConsoleProps {
  height?: string;
}

export const PythonConsole = forwardRef<PythonConsoleHandle, PythonConsoleProps>(
  ({ height }, ref) => {
    const [output, setOutput] = useState("");
    const [pythonError, setPythonError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const codeRef = useRef<HTMLElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const pyodideRef = useRef<any>(null);
    const suppressOutputRef = useRef(true);

    const handleStdOut = useCallback((out: string) => {
      if (suppressOutputRef.current) {
        // Ignore initial pyodide initialization message
        suppressOutputRef.current = false;
      } else {
        setOutput(prev => prev + out + "\n");
      }
    }, []);

    const handleStdErr = useCallback((out: string) => {
      setPythonError(true);
      setOutput(out);
    }, []);

    const loadPyodideRuntime = useCallback(async () => {
      // Pyodide script is loaded via template, wait for it to be available
      if (!window.loadPyodide) {
        throw new Error("Pyodide not loaded - ensure script tag is in template");
      }

      return await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.19.1/full/",
        stdout: handleStdOut,
        stderr: handleStdErr,
      });
    }, [handleStdOut, handleStdErr]);

    const initialize = useCallback(async () => {
      if (pyodideRef.current || isLoading) return;

      setIsLoading(true);
      try {
        pyodideRef.current = await loadPyodideRuntime();
        setIsReady(true);
      } catch (err) {
        console.error("Failed to initialize Pyodide:", err);
        setOutput("Failed to load Python runtime");
        setPythonError(true);
      } finally {
        setIsLoading(false);
      }
    }, [isLoading, loadPyodideRuntime]);

    // Expose initialize to parent
    useImperativeHandle(ref, () => ({
      initialize,
    }));

    // Initialize on mount
    useEffect(() => {
      initialize();
    }, [initialize]);

    const update = useCallback(() => {
      if (!textareaRef.current || !codeRef.current) return;

      const raw = textareaRef.current.value;
      // Escape HTML entities for safe display - this is user's own code input
      // displayed back to them with syntax highlighting
      codeRef.current.textContent = raw;
      Prism.highlightElement(codeRef.current);
    }, []);

    const syncScroll = useCallback(() => {
      if (!textareaRef.current || !preRef.current) return;

      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }, []);

    const evaluatePython = useCallback(async () => {
      if (!pyodideRef.current) {
        setOutput("Python runtime not loaded yet");
        setPythonError(true);
        return;
      }

      setOutput("");
      setPythonError(false);

      const codeEl = textareaRef.current;
      if (!codeEl) return;

      const fullCode = codeEl.value.trim();
      if (!fullCode) return;

      const lines = fullCode.split("\n");
      const lastLine = lines[lines.length - 1].trim();

      // Detect a print statement on the last line
      const isPrintStmt = /^[\s]*print\s*\(.*\)/.test(lastLine);
      // Detect an expression (not a stmt or assignment or print)
      const isExpression =
        lastLine &&
        !isPrintStmt &&
        !/^[\s]*(?:def |class |import |from |if |for |while |with |\w+\s*=)/.test(lastLine);

      let toRun = fullCode;
      // If the last line is a standalone expression, wrap it to assign
      // to __repl_result and print it so its value shows up in the REPL
      if (isExpression) {
        const head = lines.slice(0, -1).join("\n");
        toRun = `
${head}
__repl_result = ${lastLine}
print(__repl_result)
      `.trim();
      }

      try {
        pyodideRef.current.runPython(toRun);
      } catch (err) {
        setPythonError(true);
        setOutput(String(err));
      }
    }, []);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const element = textareaRef.current;
          if (!element) return;

          const beforeTab = element.value.slice(0, element.selectionStart);
          const afterTab = element.value.slice(element.selectionEnd);
          const cursorPos = element.selectionStart + 1;

          element.value = beforeTab + "\t" + afterTab;
          element.selectionStart = cursorPos;
          element.selectionEnd = cursorPos;
          update();
        } else if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          evaluatePython();
        }
      },
      [update, evaluatePython]
    );

    const containerClasses = `python-console-root d-flex flex-column min-h-0 ${height ? "" : "flex-grow-1"}`;

    return (
      // Dynamic height prop - must remain inline when provided
      <div className={containerClasses} style={height ? { height } : {}}>
        <div className="code-header text-primary mb-2">Python Console</div>

        <div className="code-input code-input-pre-element-styled">
          <textarea
            ref={textareaRef}
            rows={5}
            spellCheck={false}
            onInput={update}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
          />
          <pre ref={preRef} className="python-console language-python" aria-hidden="true">
            <code ref={codeRef} className="language-python" />
          </pre>
        </div>

        <div id="output-container">
          <button
            type="button"
            className="btn btn-primary position-relative"
            onClick={evaluatePython}
            disabled={!isReady}
          >
            {isLoading ? "Loading Python..." : "Run"}
          </button>
          {output && (
            <div id="code-output" className={`mt-3 ${pythonError ? "python-error" : ""}`}>
              {output}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PythonConsole.displayName = "PythonConsole";

export default PythonConsole;
