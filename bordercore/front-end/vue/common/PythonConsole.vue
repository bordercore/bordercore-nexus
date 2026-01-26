<template>
    <div>
        <div class="code-header text-primary mb-2">
            Python Console
        </div>

        <div class="code-input code-input-pre-element-styled">
            <textarea rows="5" spellcheck="false" @input="update" @keydown="checkTab" @scroll="syncScroll" />

            <!-- Don't place the 'code' block on a new line to avoid whitespace issues -->
            <pre class="python-console" aria-hidden="true"><code class="language-python" /></pre>
        </div>

        <div id="output-container">
            <input type="button" class="btn btn-primary position-relative" value="Run" @click="evaluatePython">
            <!-- Don't indent the 'output' block to avoid whitespace issues -->
            <div v-if="output" v-cloak id="code-output" class="mt-3" :class="{'python-error': pythonError}">{{ output }}
            </div>
        </div>
    </div>
</template>

<script>

    export default {
        setup() {
            let pyodideReadyPromise = null;
            let suppressOutput = true;

            const output = ref("");
            const pythonError = ref(false);

            function update() {
                const raw = document.querySelector(".code-input textarea");
                const resultElement = document.querySelector(".code-input pre code");

                resultElement.innerHTML = raw.value.replace(new RegExp("&", "g"), "&").replace(new RegExp("<", "g"), "<");

                // Syntax Highlight
                Prism.highlightElement(resultElement);
            };

            function handleStdOut(out) {
                if (suppressOutput) {
                    // Ignore initial pyodide intialization message
                    suppressOutput = false;
                } else {
                    output.value += out + "\n";
                }
            };

            function handleStdErr(out) {
                pythonError.value = true;
                output.value = out;
            };

            async function main() {
                return await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.19.1/full/",
                    stdout: handleStdOut,
                    stderr: handleStdErr,
                });
            };

            async function evaluatePython() {
                output.value = "";
                pythonError.value = false;
                const pyodide = await pyodideReadyPromise;
                const codeEl = document.querySelector(".code-input textarea");
                const fullCode = codeEl.value.trim();

                const lines = fullCode.split("\n");
                const lastLine = lines[lines.length - 1].trim();

                // Detect a print statement on the last line
                const isPrintStmt = /^[\s]*print\s*\(.*\)/.test(lastLine);
                // Detect an expression (not a stmt or assignment or print)
                const isExpression = lastLine &&
                                     !isPrintStmt &&
                                     !/^[\s]*(?:def |class |import |from |if |for |while |with |\w+\s*=)/.test(lastLine);

                let toRun = fullCode;
                // If the last line is a standalone expression, wrap it to assign
                //  to __repl_result and print it so its value shows up in the REPL
                if (isExpression) {
                    const head = lines.slice(0, -1).join("\n");
                    toRun = `
${head}
__repl_result = ${lastLine}
print(__repl_result)
                    `.trim();
                }
                try {
                    pyodide.runPython(toRun);
                } catch (err) {
                    pythonError.value = true;
                    output.value = err;
                }
            };

            function initialize() {
                pyodideReadyPromise = main();

                const resultElement = document.querySelector(".code-input pre code");
                resultElement.value = "";
            };

            function checkTab(event) {
                const element = document.querySelector(".code-input textarea");
                if (event.key == "Tab") {
                    event.preventDefault(); // stop normal
                    const beforeTab = element.value.slice(0, element.selectionStart); // text before tab
                    const afterTab = element.value.slice(element.selectionEnd, element.value.length); // text after tab
                    const cursorPos = element.selectionEnd + 1; // where cursor moves after tab - moving forward by 1 char to after tab
                    element.value = beforeTab + "\t" + afterTab; // add tab char
                    // move cursor
                    element.selectionStart = cursorPos;
                    element.selectionEnd = cursorPos;
                    update(element.value); // Update text to include indent
                }
            };

            function syncScroll() {
                // Scroll result to scroll coords of event - sync with textarea
                const inputElement = document.querySelector(".code-input textarea");
                const resultElement = document.querySelector(".code-input pre");

                // Get and set x and y
                resultElement.scrollTop = inputElement.scrollTop;
                resultElement.scrollLeft = inputElement.scrollLeft;
            };

            return {
                checkTab,
                evaluatePython,
                initialize,
                output,
                pythonError,
                suppressOutput,
                syncScroll,
                update,
            };
        },
    };

</script>


<style scoped>

    .code-header {
        font-size: 1.5rem;
    }

    .code-input {
        /* Allow other elements to be inside */
        position: relative;
        top: 0;
        left: 0;
        display: block;

        /* Normal inline styles */
        padding: 8px;
        margin: 8px;
        width: calc(100% - 16px);
        height: 250px;

        font-size: 15pt;
        font-family: monospace;
        line-height: 20pt;
        tab-size: 2;
        caret-color: darkgrey;
        white-space: pre;
    }

    .code-input textarea, .code-input:not(.code-input-pre-element-styled) pre code, .code-input.code-input-pre-element-styled pre {
        /* Both elements need the same text and space styling so they are directly on top of each other */
        margin: 0px!important;
        padding: var(--padding, 16px)!important;
        border: 0;
        width: calc(100% - (var(--padding, 16px)*2))!important;
        height: calc(100% - (var(--padding, 16px)*2))!important;
    }

    .code-input:not(.code-input-pre-element-styled) pre, .code-input.code-input-pre-element-styled pre code {
        margin: 0!important;
        border: 0!important;
        padding: 0!important;
        overflow: auto!important;
        width: 100%!important;
        height: 100%!important;
    }

    .code-input textarea, .code-input pre, .code-input pre * {
        /* Also add text styles to highlighting tokens */
        font-size: inherit!important;
        font-family: inherit!important;
        line-height: inherit!important;
        tab-size: inherit!important;
    }

    .code-input textarea, .code-input pre {
        /* In the same place */
        position: absolute;
        top: 0;
        left: 0;
    }

    /* Move the textarea in front of the result */

    .code-input textarea {
        z-index: 1;
    }
    .code-input pre {
        z-index: 0;
    }

    /* Make textarea almost completely transparent */

    .code-input textarea {
        color: transparent;
        background: transparent;
        caret-color: inherit!important; /* Or choose your favourite color */
    }

    /* Can be scrolled */
    .code-input textarea, .code-input pre {
        overflow: auto!important;

        white-space: inherit;
        word-spacing: normal;
        word-break: normal;
        word-wrap: normal;
    }

    /* No resize on textarea; stop outline */
    .code-input textarea {
        resize: none;
        outline: none!important;
    }

    #code-output {
        font-family: monospace;
        font-size: 1.5rem;
        white-space: pre-wrap;
    }

    .python-error {
        color: #f00;
    }

</style>
