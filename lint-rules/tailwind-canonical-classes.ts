/**
 * Custom oxlint rule that suggests canonical Tailwind class names
 * instead of arbitrary values for spacing utilities (px and rem),
 * and normalizes important modifier placement.
 *
 * Tailwind's spacing scale uses 4px increments:
 *   w-[260px] → w-65, py-[1.125rem] → py-4.5
 *
 * Important modifier normalization:
 *   hover:!opacity-100 → hover:opacity-100!
 *
 * Shared linting rule — covers the full Tailwind spacing utility set.
 */

// All Tailwind spacing utilities whose [Npx] or [Nrem] form may have
// a canonical equivalent.
// Verified against Tailwind v4 source: only utilities using
// calc(var(--spacing) * N) belong here.
const SPACING_UTILITIES = new Set([
  "size",
  "w",
  "h",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "basis",
  "p",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "m",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "inset",
  "inset-x",
  "inset-y",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "translate-x",
  "translate-y",
  "scroll-m",
  "scroll-mx",
  "scroll-my",
  "scroll-mt",
  "scroll-mr",
  "scroll-mb",
  "scroll-ml",
  "scroll-p",
  "scroll-px",
  "scroll-py",
  "scroll-pt",
  "scroll-pr",
  "scroll-pb",
  "scroll-pl",
]);

// Groups: (prefix)(sign)(utility)-[ (number)px ]
const ARBITRARY_PX_RE = /((?:[a-z]+:)*)(-?)([a-z]+(?:-[a-z]+)*)-\[(\d+(?:\.\d+)?)px\]/g;

// Groups: (prefix)(sign)(utility)-[ (number)rem ]
const ARBITRARY_REM_RE = /((?:[a-z]+:)*)(-?)([a-z]+(?:-[a-z]+)*)-\[(\d+(?:\.\d+)?)rem\]/g;

// Groups: (prefix):! (utility-value)
const MISPLACED_IMPORTANT_RE = /((?:[a-z]+:)+)!(\S+)/g;

/**
 * Convert an arbitrary spacing value to its canonical Tailwind class.
 * Supports px (÷ 4) and rem (× 16 ÷ 4) units.
 * Returns null if the value doesn't align with Tailwind's .5-increment scale.
 */
function canonicalSpacingClass(
  prefix: string,
  sign: string,
  utility: string,
  rawValue: string,
  unit: "px" | "rem",
): string | null {
  const numericValue = Number.parseFloat(rawValue);
  if (Number.isNaN(numericValue) || numericValue <= 0) return null;

  // rem → px conversion: 1rem = 16px
  const pxValue = unit === "rem" ? numericValue * 16 : numericValue;
  const token = pxValue / 4;

  // Tailwind's default spacing scale only supports whole numbers
  // and .5 increments (e.g., 7.5, but not 3.25).
  if (token % 0.5 !== 0) return null;

  const formatted = token % 1 === 0 ? String(token) : String(token);
  return `${prefix}${sign}${utility}-${formatted}`;
}

type BaseNode = {
  type?: string;
};

type LiteralNode = BaseNode & {
  value?: unknown;
  raw?: unknown;
};

type JSXAttributeNode = BaseNode & {
  name?: { type?: string; name?: unknown };
  value?: LiteralNode | null;
};

const tailwindCanonicalClassesRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Suggest canonical Tailwind class names instead of arbitrary [Npx] values.",
    },
    fixable: "code",
    schema: [],
    messages: {
      useCanonical: "Use '{{canonical}}' instead of '{{original}}'.",
      useImportantSuffix: "Use '{{canonical}}' instead of '{{original}}' (move ! to the end).",
    },
  },
  create(context: {
    report(descriptor: {
      node: unknown;
      messageId: string;
      data?: Record<string, string>;
      fix?: (fixer: { replaceText(node: unknown, text: string): unknown }) => unknown;
    }): void;
  }) {
    function isClassNameAttr(name: unknown): name is string {
      return name === "className" || name === "class";
    }

    function isStringLiteral(node: LiteralNode | null | undefined): node is LiteralNode {
      return (
        !!node &&
        typeof node === "object" &&
        node.type === "Literal" &&
        typeof node.value === "string"
      );
    }

    return {
      JSXAttribute(node: unknown) {
        const attr = node as JSXAttributeNode;

        if (!attr.name || typeof attr.name !== "object") return;
        if (!isClassNameAttr(attr.name.name)) return;
        if (!isStringLiteral(attr.value)) return;

        const classString = attr.value.value as string;
        const rawString = attr.value.raw as string;

        const matches: Array<{ match: string; canonical: string }> = [];
        let regMatch: RegExpExecArray | null;

        // --- Pass 1: Arbitrary px spacing values ---
        ARBITRARY_PX_RE.lastIndex = 0;
        while ((regMatch = ARBITRARY_PX_RE.exec(classString)) !== null) {
          const [, prefix, sign, utility, val] = regMatch;
          if (!SPACING_UTILITIES.has(utility)) continue;
          const canonical = canonicalSpacingClass(prefix, sign, utility, val, "px");
          if (!canonical || canonical === regMatch[0]) continue;
          matches.push({ match: regMatch[0], canonical });
        }

        // --- Pass 2: Arbitrary rem spacing values ---
        ARBITRARY_REM_RE.lastIndex = 0;
        while ((regMatch = ARBITRARY_REM_RE.exec(classString)) !== null) {
          const [, prefix, sign, utility, val] = regMatch;
          if (!SPACING_UTILITIES.has(utility)) continue;
          const canonical = canonicalSpacingClass(prefix, sign, utility, val, "rem");
          if (!canonical || canonical === regMatch[0]) continue;
          matches.push({ match: regMatch[0], canonical });
        }

        // --- Pass 3: Misplaced important modifier (prefix:!utility → prefix:utility!) ---
        MISPLACED_IMPORTANT_RE.lastIndex = 0;
        const importantMatches: Array<{ match: string; canonical: string }> = [];
        while ((regMatch = MISPLACED_IMPORTANT_RE.exec(classString)) !== null) {
          const [, prefix, utility] = regMatch;
          const canonical = `${prefix}${utility}!`;
          if (canonical === regMatch[0]) continue;
          importantMatches.push({ match: regMatch[0], canonical });
        }

        if (matches.length === 0 && importantMatches.length === 0) return;

        let fixed = classString;
        for (const m of matches) {
          fixed = fixed.replace(m.match, m.canonical);
        }
        const importantCanonicals: string[] = [];
        for (const m of importantMatches) {
          fixed = fixed.replace(m.match, m.canonical);
          importantCanonicals.push(`${m.match} → ${m.canonical}`);
        }

        const quote = rawString.startsWith("'") ? "'" : '"';

        // Report spacing canonicalizations
        if (matches.length > 0) {
          context.report({
            node,
            messageId: "useCanonical",
            data: {
              canonical: matches.map((m) => m.canonical).join(", "),
              original: matches.map((m) => m.match).join(", "),
            },
            fix(fixer: { replaceText(node: unknown, text: string): unknown }) {
              return fixer.replaceText(attr.value, `${quote}${fixed}${quote}`);
            },
          });
        }

        // Report important modifier fixes
        if (importantMatches.length > 0) {
          context.report({
            node,
            messageId: "useImportantSuffix",
            data: {
              canonical: importantCanonicals.join(", "),
              original: importantMatches.map((m) => m.match).join(", "),
            },
            fix(fixer: { replaceText(node: unknown, text: string): unknown }) {
              return fixer.replaceText(attr.value, `${quote}${fixed}${quote}`);
            },
          });
        }
      },
    };
  },
};

export default tailwindCanonicalClassesRule;
