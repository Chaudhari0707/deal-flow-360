interface RuleContext {
  filename: string;
  sourceCode: {
    text: string;
    getText(node: unknown): string;
  };
  report(descriptor: {
    node: unknown;
    messageId: string;
    data?: Record<string, string>;
    fix?: (fixer: unknown) => unknown;
  }): void;
}

const sortTypesAndKeysRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce alphabetical sorting of types and type keys in types files.",
    },
    fixable: "code",
    schema: [],
    messages: {
      sortTypes:
        "Type/Interface '{{current}}' should be declared before '{{previous}}' to maintain alphabetical order.",
      sortKeys:
        "Property '{{current}}' should be declared before '{{previous}}' to maintain alphabetical order.",
    },
  },
  create(context: RuleContext) {
    const filename = context.filename;

    if (!filename || filename === "<input>") {
      return {};
    }

    const normalizedFilename = filename.replaceAll("\\", "/");
    // Only apply to files in _types/ directories
    if (!normalizedFilename.includes("/_types/")) {
      return {};
    }

    const declarations: { name: string; node: unknown }[] = [];
    let programNode: unknown = null;

    function getOuterNode(node: unknown): unknown {
      if (typeof node !== "object" || node === null) {
        return node;
      }
      const nodeObj = node as Record<string, unknown>;
      const parent = nodeObj.parent;
      if (
        parent &&
        typeof parent === "object" &&
        ((parent as Record<string, unknown>).type === "ExportNamedDeclaration" ||
          (parent as Record<string, unknown>).type === "ExportDefaultDeclaration")
      ) {
        return parent;
      }
      return node;
    }

    function checkSortedMembers(members: unknown[], messageId: string, parentNode: unknown) {
      const propertyNames: { name: string; node: unknown }[] = [];
      for (const member of members) {
        if (typeof member !== "object" || member === null) {
          continue;
        }
        const memberObj = member as Record<string, unknown>;
        if (memberObj.type === "TSPropertySignature" || memberObj.type === "TSMethodSignature") {
          const key = memberObj.key as Record<string, unknown> | undefined;
          if (key) {
            let name = "";
            if (key.type === "Identifier") {
              name = String(key.name);
            } else if (key.type === "Literal") {
              name = String(key.value);
            }
            if (name) {
              propertyNames.push({ name, node: member });
            }
          }
        }
      }

      let isSorted = true;
      for (let i = 1; i < propertyNames.length; i++) {
        if (
          propertyNames[i].name
            .toLowerCase()
            .localeCompare(propertyNames[i - 1].name.toLowerCase()) < 0
        ) {
          isSorted = false;
          break;
        }
      }

      if (!isSorted) {
        for (let i = 1; i < propertyNames.length; i++) {
          const prev = propertyNames[i - 1];
          const curr = propertyNames[i];
          if (curr.name.toLowerCase().localeCompare(prev.name.toLowerCase()) < 0) {
            context.report({
              node: curr.node,
              messageId,
              data: {
                current: curr.name,
                previous: prev.name,
              },
              fix(fixer: unknown) {
                const fixerObj = fixer as { replaceText(node: unknown, text: string): unknown };
                const sortedPropertyNames = [...propertyNames].sort((a, b) =>
                  a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
                );
                const memberTexts = sortedPropertyNames.map((p) =>
                  context.sourceCode.getText(p.node),
                );
                const newText = `{\n  ${memberTexts.join("\n  ")}\n}`;
                return fixerObj.replaceText(parentNode, newText);
              },
            });
          }
        }
      }
    }

    function isTopLevel(nodeObj: Record<string, unknown>): boolean {
      const parent = nodeObj.parent as Record<string, unknown> | undefined;
      if (!parent) {
        return false;
      }
      if (parent.type === "Program") {
        return true;
      }
      if (parent.type === "ExportNamedDeclaration") {
        const grandParent = parent.parent as Record<string, unknown> | undefined;
        return !!grandParent && grandParent.type === "Program";
      }
      return false;
    }

    return {
      Program(node: unknown) {
        programNode = node;
      },
      TSInterfaceDeclaration(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        if (isTopLevel(nodeObj)) {
          const id = nodeObj.id as Record<string, unknown> | undefined;
          if (id && typeof id.name === "string") {
            declarations.push({ name: id.name, node });
          }
        }
      },
      TSTypeAliasDeclaration(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        if (isTopLevel(nodeObj)) {
          const id = nodeObj.id as Record<string, unknown> | undefined;
          if (id && typeof id.name === "string") {
            declarations.push({ name: id.name, node });
          }
        }
      },
      TSInterfaceBody(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        const body = nodeObj.body;
        if (Array.isArray(body)) {
          checkSortedMembers(body, "sortKeys", node);
        }
      },
      TSTypeLiteral(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        const members = nodeObj.members;
        if (Array.isArray(members)) {
          checkSortedMembers(members, "sortKeys", node);
        }
      },
      "Program:exit"() {
        let isSorted = true;
        for (let i = 1; i < declarations.length; i++) {
          if (
            declarations[i].name
              .toLowerCase()
              .localeCompare(declarations[i - 1].name.toLowerCase()) < 0
          ) {
            isSorted = false;
            break;
          }
        }

        if (!isSorted && programNode) {
          for (let i = 1; i < declarations.length; i++) {
            const prev = declarations[i - 1];
            const curr = declarations[i];
            if (curr.name.toLowerCase().localeCompare(prev.name.toLowerCase()) < 0) {
              context.report({
                node: curr.node,
                messageId: "sortTypes",
                data: {
                  current: curr.name,
                  previous: prev.name,
                },
                fix(fixer: unknown) {
                  const fixerObj = fixer as { replaceText(node: unknown, text: string): unknown };
                  const sortedDecls = [...declarations].sort((a, b) =>
                    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
                  );

                  const declTexts = sortedDecls.map((d) => {
                    const outer = getOuterNode(d.node);
                    return context.sourceCode.getText(outer);
                  });

                  const fileText = context.sourceCode.text;
                  const firstOuter = getOuterNode(declarations[0].node);
                  const lastOuter = getOuterNode(declarations[declarations.length - 1].node);

                  if (
                    typeof firstOuter === "object" &&
                    firstOuter !== null &&
                    typeof lastOuter === "object" &&
                    lastOuter !== null
                  ) {
                    const firstOuterObj = firstOuter as { start: number; end: number };
                    const lastOuterObj = lastOuter as { start: number; end: number };

                    const firstStart = firstOuterObj.start;
                    const lastEnd = lastOuterObj.end;

                    const before = fileText.slice(0, firstStart);
                    const after = fileText.slice(lastEnd);

                    const newFileText = before + declTexts.join("\n\n") + after;

                    return fixerObj.replaceText(programNode, newFileText);
                  }
                  return null;
                },
              });
            }
          }
        }
      },
    };
  },
};

export default sortTypesAndKeysRule;
