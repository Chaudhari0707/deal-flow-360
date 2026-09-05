const MAX_LINES = 500;

interface RuleContext {
  filename: string;
  sourceCode: { lines: readonly unknown[] };
  report(descriptor: { node: unknown; messageId: string; data?: Record<string, string> }): void;
}

// Large files are a maintainability signal. The blocking file-size script uses the same threshold;
// this rule gives earlier editor feedback before a file reaches the handoff gate.
const maxFileLinesRule = {
  meta: {
    type: "problem",
    docs: {
      description: `Flag source files over ${MAX_LINES} lines so they get split before they grow further.`,
    },
    schema: [],
    messages: {
      tooManyLines:
        "This file has {{lineCount}} lines, over the {{maxLines}}-line guideline. Extract one responsibility at a time into a colocated module instead of growing this file further.",
    },
  },
  create(context: RuleContext) {
    const filename = context.filename;

    if (!filename || filename === "<input>") {
      return {};
    }

    return {
      Program(node: unknown) {
        const lineCount = context.sourceCode.lines.length;

        if (lineCount > MAX_LINES) {
          context.report({
            node,
            messageId: "tooManyLines",
            data: { lineCount: String(lineCount), maxLines: String(MAX_LINES) },
          });
        }
      },
    };
  },
};

export default maxFileLinesRule;
