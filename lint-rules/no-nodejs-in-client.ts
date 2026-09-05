import { NODE_BUILTIN_SPECIFIERS } from "./node-builtins";

const NODE_MEMBER_GLOBALS = new Set(["Buffer", "global", "module", "process"]);
const NODE_TIMER_GLOBALS = new Set(["clearImmediate", "setImmediate"]);
const NODE_IDENTIFIER_GLOBALS = new Set(["__dirname", "__filename"]);
const ALLOWED_CLIENT_ENV_NAMES = new Set(["NODE_ENV"]);

type BaseNode = {
  type?: string;
  parent?: unknown;
};

type IdentifierNode = BaseNode & {
  name: string;
};

type LiteralNode = BaseNode & {
  value?: unknown;
};

type ProgramNode = BaseNode & {
  body?: ProgramStatement[];
};

type ProgramStatement = BaseNode & {
  directive?: unknown;
  expression?: BaseNode & {
    value?: unknown;
  };
};

type ImportLikeNode = BaseNode & {
  source?: LiteralNode;
};

type MemberExpressionNode = BaseNode & {
  object?: unknown;
  property?: unknown;
  computed?: boolean;
};

type CallExpressionNode = BaseNode & {
  callee?: unknown;
  arguments?: unknown[];
};

type NewExpressionNode = BaseNode & {
  callee?: unknown;
};

type ScopeVariable = {
  name?: string;
  defs?: unknown[];
};

type ScopeLike = {
  variables?: ScopeVariable[];
  upper?: ScopeLike | null;
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

function isMemberExpression(node: unknown): node is MemberExpressionNode {
  if (!node || typeof node !== "object") {
    return false;
  }

  return (node as MemberExpressionNode).type === "MemberExpression";
}

function isClientFile(program: ProgramNode | undefined) {
  for (const statement of program?.body ?? []) {
    if (statement.type !== "ExpressionStatement") {
      return false;
    }

    if (statement.directive === "use client") {
      return true;
    }

    if (!isLiteral(statement.expression) || typeof statement.expression.value !== "string") {
      return false;
    }
  }

  return false;
}

function isNodeBuiltinSpecifier(specifier: string) {
  return NODE_BUILTIN_SPECIFIERS.has(specifier);
}

function isAllowedClientEnvName(name: string) {
  return ALLOWED_CLIENT_ENV_NAMES.has(name) || name.startsWith("NEXT_PUBLIC_");
}

function isAllowedClientProcessEnvAccess(node: MemberExpressionNode) {
  if (
    !isIdentifier(node.object, "process") ||
    !isIdentifier(node.property, "env") ||
    node.computed
  ) {
    return false;
  }

  if (!isMemberExpression(node.parent) || node.parent.object !== node) {
    return false;
  }

  if (node.parent.computed) {
    return isLiteral(node.parent.property) && typeof node.parent.property.value === "string"
      ? isAllowedClientEnvName(node.parent.property.value)
      : false;
  }

  return isIdentifier(node.parent.property) && typeof node.parent.property.name === "string"
    ? isAllowedClientEnvName(node.parent.property.name)
    : false;
}

function isPropertyKey(node: IdentifierNode) {
  const parent = node.parent;

  if (!parent || typeof parent !== "object") {
    return false;
  }

  const typedParent = parent as {
    type?: string;
    key?: unknown;
    property?: unknown;
    computed?: boolean;
  };

  if (typedParent.type === "MemberExpression") {
    return typedParent.property === node && typedParent.computed !== true;
  }

  return (
    (typedParent.type === "Property" ||
      typedParent.type === "MethodDefinition" ||
      typedParent.type === "PropertyDefinition") &&
    typedParent.key === node &&
    typedParent.computed !== true
  );
}

interface RuleContext {
  sourceCode: {
    ast?: ProgramNode;
    getScope?: (targetNode: never) => ScopeLike | null | undefined;
  };
  report(descriptor: { node: unknown; messageId: string; data?: Record<string, string> }): void;
}

function isLocallyDefined(context: RuleContext, name: string, node: BaseNode) {
  const getScope = context.sourceCode.getScope;

  if (!getScope) {
    return false;
  }

  let scope: ScopeLike | null | undefined = getScope(node as never);

  while (scope) {
    const variable = scope.variables?.find((candidate) => candidate.name === name);

    if (variable) {
      return (variable.defs?.length ?? 0) > 0;
    }

    scope = scope.upper ?? null;
  }

  return false;
}

const noNodejsInClientRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban Node runtime globals and modules in React Client Components.",
    },
    schema: [],
    messages: {
      noNodeBuiltin:
        "Node builtin '{{name}}' is not available in \"use client\" files. Move this code to a server module or pass the data in through props.",
      noNodeGlobal:
        "Node runtime API '{{name}}' is not available in \"use client\" files. Move this code to a server module or pass the data in through props.",
    },
  },
  create(context: RuleContext) {
    const program = context.sourceCode.ast as ProgramNode | undefined;

    if (!isClientFile(program)) {
      return {};
    }

    function reportBuiltinSource(node: LiteralNode | undefined) {
      if (!node || typeof node.value !== "string" || !isNodeBuiltinSpecifier(node.value)) {
        return;
      }

      context.report({
        node: node as never,
        messageId: "noNodeBuiltin",
        data: {
          name: node.value,
        },
      });
    }

    function reportRuntimeGlobal(node: BaseNode, name: string) {
      context.report({
        node: node as never,
        messageId: "noNodeGlobal",
        data: {
          name,
        },
      });
    }

    return {
      ImportDeclaration(node: unknown) {
        reportBuiltinSource((node as ImportLikeNode).source);
      },
      ExportNamedDeclaration(node: unknown) {
        reportBuiltinSource((node as ImportLikeNode).source);
      },
      ExportAllDeclaration(node: unknown) {
        reportBuiltinSource((node as ImportLikeNode).source);
      },
      ImportExpression(node: unknown) {
        reportBuiltinSource((node as ImportLikeNode).source);
      },
      MemberExpression(node: unknown) {
        const memberNode = node as MemberExpressionNode;

        if (isIdentifier(memberNode.object) && NODE_MEMBER_GLOBALS.has(memberNode.object.name)) {
          if (isLocallyDefined(context, memberNode.object.name, memberNode.object)) {
            return;
          }

          if (memberNode.object.name === "process" && isAllowedClientProcessEnvAccess(memberNode)) {
            return;
          }

          reportRuntimeGlobal(memberNode.object, memberNode.object.name);
          return;
        }

        if (!isIdentifier(memberNode.object, "globalThis") || !isIdentifier(memberNode.property)) {
          return;
        }

        if (!NODE_MEMBER_GLOBALS.has(memberNode.property.name)) {
          return;
        }

        reportRuntimeGlobal(memberNode.property, memberNode.property.name);
      },
      CallExpression(node: unknown) {
        const callNode = node as CallExpressionNode;

        if (isIdentifier(callNode.callee, "require")) {
          if (isLocallyDefined(context, callNode.callee.name, callNode.callee)) {
            return;
          }

          const [firstArgument] = callNode.arguments ?? [];
          reportBuiltinSource(isLiteral(firstArgument) ? firstArgument : undefined);
          return;
        }

        if (
          isIdentifier(callNode.callee) &&
          NODE_TIMER_GLOBALS.has(callNode.callee.name) &&
          !isLocallyDefined(context, callNode.callee.name, callNode.callee)
        ) {
          reportRuntimeGlobal(callNode.callee, callNode.callee.name);
        }
      },
      NewExpression(node: unknown) {
        const newNode = node as NewExpressionNode;

        if (
          isIdentifier(newNode.callee, "Buffer") &&
          !isLocallyDefined(context, newNode.callee.name, newNode.callee)
        ) {
          reportRuntimeGlobal(newNode.callee, newNode.callee.name);
        }
      },
      Identifier(node: unknown) {
        const identifierNode = node as IdentifierNode;

        if (
          !NODE_IDENTIFIER_GLOBALS.has(
            typeof identifierNode.name === "string" ? identifierNode.name : "",
          ) ||
          isPropertyKey(identifierNode) ||
          isLocallyDefined(context, identifierNode.name as string, identifierNode)
        ) {
          return;
        }

        reportRuntimeGlobal(identifierNode, identifierNode.name as string);
      },
    };
  },
};

export default noNodejsInClientRule;
