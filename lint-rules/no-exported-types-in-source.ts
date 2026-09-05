interface RuleContext {
  filename: string;
  report(descriptor: { node: unknown; messageId: string; data?: Record<string, string> }): void;
}

const noExportedTypesInSourceRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban exported type and interface declarations outside of _types/ directories.",
    },
    schema: [],
    messages: {
      noExportedType:
        "Exported type '{{name}}' is not allowed in source files. Move this declaration to a '_types/' directory.",
      noExportedInterface:
        "Exported interface '{{name}}' is not allowed in source files. Move this declaration to a '_types/' directory.",
      noLocalTypeExport:
        "Local type exports are not allowed in source files. Move '{{name}}' to a '_types/' directory.",
    },
  },
  create(context: RuleContext) {
    const filename = context.filename;

    if (!filename || filename === "<input>") {
      return {};
    }

    const normalizedFilename = filename.replaceAll("\\", "/");
    // Allowed if the file path is under a _types/ directory
    if (normalizedFilename.includes("/_types/")) {
      return {};
    }

    return {
      TSInterfaceDeclaration(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        const parent = nodeObj.parent as Record<string, unknown> | undefined;
        if (
          parent &&
          (parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration")
        ) {
          const id = nodeObj.id as Record<string, unknown> | undefined;
          const name = id && typeof id.name === "string" ? id.name : "Anonymous";
          context.report({
            node,
            messageId: "noExportedInterface",
            data: { name },
          });
        }
      },
      TSTypeAliasDeclaration(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        const parent = nodeObj.parent as Record<string, unknown> | undefined;
        if (
          parent &&
          (parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration")
        ) {
          const id = nodeObj.id as Record<string, unknown> | undefined;
          const name = id && typeof id.name === "string" ? id.name : "Anonymous";
          context.report({
            node,
            messageId: "noExportedType",
            data: { name },
          });
        }
      },
      ExportNamedDeclaration(node: unknown) {
        if (typeof node !== "object" || node === null) {
          return;
        }
        const nodeObj = node as Record<string, unknown>;
        // If it's a re-export (has source), it is allowed!
        if (nodeObj.source) {
          return;
        }
        // If the export kind is type, check specifiers
        if (nodeObj.exportKind === "type") {
          const specifiers = nodeObj.specifiers;
          if (Array.isArray(specifiers)) {
            for (const spec of specifiers) {
              if (typeof spec === "object" && spec !== null) {
                const specObj = spec as Record<string, unknown>;
                const exported = specObj.exported as Record<string, unknown> | undefined;
                const name =
                  exported && typeof exported.name === "string" ? exported.name : "Unknown";
                context.report({
                  node: spec,
                  messageId: "noLocalTypeExport",
                  data: { name },
                });
              }
            }
          }
        }
      },
    };
  },
};

export default noExportedTypesInSourceRule;
