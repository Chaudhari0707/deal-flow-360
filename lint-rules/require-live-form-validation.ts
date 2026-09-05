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

type PropertyNode = BaseNode & {
  computed?: boolean;
  key?: unknown;
  value?: unknown;
};

type ObjectExpressionNode = BaseNode & {
  properties?: unknown[];
};

type CallExpressionNode = BaseNode & {
  arguments?: unknown[];
  callee?: unknown;
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
  return Boolean(node && typeof node === "object" && (node as LiteralNode).type === "Literal");
}

function isObjectExpression(node: unknown): node is ObjectExpressionNode {
  return Boolean(
    node && typeof node === "object" && (node as ObjectExpressionNode).type === "ObjectExpression",
  );
}

function isProperty(node: unknown): node is PropertyNode {
  return Boolean(node && typeof node === "object" && (node as PropertyNode).type === "Property");
}

function getProperty(objectNode: ObjectExpressionNode, name: string) {
  return (objectNode.properties ?? []).find((property): property is PropertyNode => {
    if (!isProperty(property) || property.computed) {
      return false;
    }

    return (
      isIdentifier(property.key, name) || (isLiteral(property.key) && property.key.value === name)
    );
  });
}

function getLiteralValue(property: PropertyNode | undefined) {
  return isLiteral(property?.value) ? property.value.value : undefined;
}

function isUseFormCall(node: CallExpressionNode) {
  return isIdentifier(node.callee, "useForm");
}

const requireLiveFormValidationRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require react-hook-form forms to use realtime validation and first-error focus.",
    },
    schema: [],
    messages: {
      missingOptions:
        "Pass a useForm options object with mode, reValidateMode, and shouldFocusError.",
      invalidMode: 'Configure useForm with mode: "onChange" or mode: "all".',
      invalidReValidateMode: 'Configure useForm with reValidateMode: "onChange".',
      invalidShouldFocusError: "Keep useForm shouldFocusError enabled for first-error focus.",
    },
  },
  create(context: { report(descriptor: { node: unknown; messageId: string }): void }) {
    return {
      CallExpression(node: unknown) {
        const callNode = node as CallExpressionNode;

        if (!isUseFormCall(callNode)) {
          return;
        }

        const optionsNode = callNode.arguments?.[0];

        if (!isObjectExpression(optionsNode)) {
          context.report({
            node: callNode as never,
            messageId: "missingOptions",
          });
          return;
        }

        const mode = getLiteralValue(getProperty(optionsNode, "mode"));
        const reValidateMode = getLiteralValue(getProperty(optionsNode, "reValidateMode"));
        const shouldFocusError = getLiteralValue(getProperty(optionsNode, "shouldFocusError"));

        if (mode !== "onChange" && mode !== "all") {
          context.report({
            node: optionsNode as never,
            messageId: "invalidMode",
          });
        }

        if (reValidateMode !== "onChange") {
          context.report({
            node: optionsNode as never,
            messageId: "invalidReValidateMode",
          });
        }

        if (shouldFocusError !== true) {
          context.report({
            node: optionsNode as never,
            messageId: "invalidShouldFocusError",
          });
        }
      },
    };
  },
};

export default requireLiveFormValidationRule;
