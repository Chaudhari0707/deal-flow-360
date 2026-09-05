import { NODE_BUILTIN_SPECIFIERS } from "./node-builtins";

type BaseNode = {
  type?: string;
};

type IdentifierNode = BaseNode & {
  name?: unknown;
};

type LiteralNode = BaseNode & {
  value?: unknown;
};

type ImportLikeNode = BaseNode & {
  source?: LiteralNode;
};

type CallExpressionNode = BaseNode & {
  callee?: unknown;
  arguments?: unknown[];
};

function isIdentifier(node: unknown, expectedName?: string): node is IdentifierNode {
  if (!node || typeof node !== "object") {
    return false;
  }

  const typedNode = node as IdentifierNode;

  if (typedNode.type !== "Identifier" || typeof typedNode.name !== "string") {
    return false;
  }

  return expectedName ? typedNode.name === expectedName : true;
}

function isLiteral(node: unknown): node is LiteralNode {
  if (!node || typeof node !== "object") {
    return false;
  }

  return (node as LiteralNode).type === "Literal";
}

const noNodejsImportsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban Node builtin module imports in repository code.",
    },
    schema: [],
    messages: {
      noNodeImport:
        "Node builtin '{{name}}' is banned repo-wide. Use Bun APIs or Web Platform APIs instead.",
    },
  },
  create(context: {
    report(descriptor: { node: unknown; messageId: string; data?: Record<string, string> }): void;
  }) {
    function reportIfNodeImport(node: LiteralNode | undefined) {
      if (!node || typeof node.value !== "string") {
        return;
      }

      if (!NODE_BUILTIN_SPECIFIERS.has(node.value)) {
        return;
      }

      context.report({
        node: node as never,
        messageId: "noNodeImport",
        data: {
          name: node.value,
        },
      });
    }

    return {
      ImportDeclaration(node: unknown) {
        reportIfNodeImport((node as ImportLikeNode).source);
      },
      ExportNamedDeclaration(node: unknown) {
        reportIfNodeImport((node as ImportLikeNode).source);
      },
      ExportAllDeclaration(node: unknown) {
        reportIfNodeImport((node as ImportLikeNode).source);
      },
      ImportExpression(node: unknown) {
        reportIfNodeImport((node as ImportLikeNode).source);
      },
      CallExpression(node: unknown) {
        const callNode = node as CallExpressionNode;

        if (!isIdentifier(callNode.callee, "require")) {
          return;
        }

        const [firstArgument] = callNode.arguments ?? [];
        reportIfNodeImport(isLiteral(firstArgument) ? firstArgument : undefined);
      },
    };
  },
};

export default noNodejsImportsRule;
