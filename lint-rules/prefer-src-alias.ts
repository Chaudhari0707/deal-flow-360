const RELATIVE_IMPORT_PATTERN = /^\.{1,2}\//;
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;

type SourceNode = {
  value: unknown;
};

type ParsedPath = {
  root: string;
  segments: string[];
  caseInsensitive: boolean;
};

export function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}

export function getAliasImportPath(filename: string, importSource: string, srcRoot: string) {
  const currentDirectory = dirnamePath(filename);
  const resolvedImportPath = resolveRelativePath(currentDirectory, importSource);

  if (!isPathInsideRoot(resolvedImportPath, srcRoot)) {
    return null;
  }

  return relativePath(srcRoot, resolvedImportPath);
}

function dirnamePath(value: string) {
  const parsed = parsePath(value);

  if (parsed.segments.length <= 1) {
    return parsed.root || ".";
  }

  return buildPath({
    ...parsed,
    segments: parsed.segments.slice(0, -1),
  });
}

function relativePath(from: string, to: string) {
  const fromPath = parsePath(from);
  const toPath = parsePath(to);

  if (!rootsMatch(fromPath, toPath)) {
    return normalizePath(to);
  }

  const caseInsensitive = fromPath.caseInsensitive || toPath.caseInsensitive;
  let commonLength = 0;

  while (
    commonLength < fromPath.segments.length &&
    commonLength < toPath.segments.length &&
    pathPartEquals(fromPath.segments[commonLength], toPath.segments[commonLength], caseInsensitive)
  ) {
    commonLength += 1;
  }

  const parentSegments = Array.from({ length: fromPath.segments.length - commonLength }).fill("..");
  const relativeSegments = [...parentSegments, ...toPath.segments.slice(commonLength)];

  return relativeSegments.length > 0 ? relativeSegments.join("/") : ".";
}

function resolveRelativePath(from: string, to: string) {
  const parsedImportPath = parsePath(to);

  if (parsedImportPath.root) {
    return buildPath(parsedImportPath);
  }

  const parsedBasePath = parsePath(from);
  const baseSegments = normalizeSegments(
    [...parsedBasePath.segments, ...parsedImportPath.segments],
    parsedBasePath.root.length > 0,
  );

  return buildPath({
    ...parsedBasePath,
    segments: baseSegments,
  });
}

export function isPathInsideRoot(pathValue: string, rootValue: string) {
  const path = parsePath(pathValue);
  const root = parsePath(rootValue);

  if (!rootsMatch(path, root)) {
    return false;
  }

  if (root.segments.length > path.segments.length) {
    return false;
  }

  const caseInsensitive = path.caseInsensitive || root.caseInsensitive;

  return root.segments.every((segment, index) => {
    return pathPartEquals(segment, path.segments[index], caseInsensitive);
  });
}

function buildPath(parsed: ParsedPath) {
  if (parsed.root) {
    return parsed.segments.length > 0 ? `${parsed.root}${parsed.segments.join("/")}` : parsed.root;
  }

  return parsed.segments.length > 0 ? parsed.segments.join("/") : ".";
}

function normalizeSegments(segments: readonly string[], absolute: boolean) {
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }

    if (segment === "..") {
      const previousSegment = normalizedSegments.at(-1);

      if (previousSegment && previousSegment !== "..") {
        normalizedSegments.pop();
        continue;
      }

      if (!absolute) {
        normalizedSegments.push("..");
      }

      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments;
}

function parsePath(value: string): ParsedPath {
  const normalizedValue = normalizePath(value);

  if (normalizedValue.length === 0 || normalizedValue === ".") {
    return {
      root: "",
      segments: [],
      caseInsensitive: false,
    };
  }

  if (WINDOWS_DRIVE_PATTERN.test(normalizedValue)) {
    const drive = normalizedValue.slice(0, 2);
    const withoutDrive = normalizedValue.slice(2).replace(/^\/+/, "");

    return {
      root: `${drive}/`,
      segments: normalizeSegments(withoutDrive.split("/"), true),
      caseInsensitive: true,
    };
  }

  if (normalizedValue.startsWith("//")) {
    const [, , server = "", share = "", ...segments] = normalizedValue.split("/");

    return {
      root: server && share ? `//${server}/${share}/` : "//",
      segments: normalizeSegments(segments, true),
      caseInsensitive: true,
    };
  }

  if (normalizedValue.startsWith("/")) {
    return {
      root: "/",
      segments: normalizeSegments(normalizedValue.slice(1).split("/"), true),
      caseInsensitive: false,
    };
  }

  return {
    root: "",
    segments: normalizeSegments(normalizedValue.split("/"), false),
    caseInsensitive: false,
  };
}

function pathPartEquals(
  left: string | undefined,
  right: string | undefined,
  caseInsensitive: boolean,
) {
  if (left === undefined || right === undefined) {
    return false;
  }

  return caseInsensitive ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function rootsMatch(left: ParsedPath, right: ParsedPath) {
  return pathPartEquals(left.root, right.root, left.caseInsensitive || right.caseInsensitive);
}

const preferSrcAliasRule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Rewrite relative imports inside src to @/ absolute aliases.",
    },
    fixable: "code",
    schema: [],
    messages: {
      useAlias: "Use @/ absolute imports instead of relative imports inside src.",
    },
  },
  create(context: {
    filename: string;
    report(descriptor: {
      node: unknown;
      messageId: string;
      fix?: (fixer: { replaceText(node: never, text: string): unknown }) => unknown;
    }): void;
  }) {
    const filename = context.filename;

    if (!filename || filename === "<input>") {
      return {};
    }

    const normalizedFilename = normalizePath(filename);
    const srcMarker = "/src/";
    const srcIndex = normalizedFilename.indexOf(srcMarker);

    if (srcIndex === -1) {
      return {};
    }

    const srcRoot = normalizedFilename.slice(0, srcIndex + srcMarker.length - 1);

    if (!isPathInsideRoot(filename, srcRoot)) {
      return {};
    }

    function reportIfRelative(sourceNode: SourceNode) {
      const importSource = sourceNode.value;

      if (typeof importSource !== "string") {
        return;
      }

      if (!RELATIVE_IMPORT_PATTERN.test(importSource)) {
        return;
      }

      const aliasPath = getAliasImportPath(filename, importSource, srcRoot);

      if (!aliasPath) {
        return;
      }

      context.report({
        node: sourceNode as never,
        messageId: "useAlias",
        fix(fixer: { replaceText(node: never, text: string): unknown }) {
          return fixer.replaceText(sourceNode as never, `"@/${aliasPath}"`);
        },
      });
    }

    return {
      ImportDeclaration(node: unknown) {
        if (!(node && typeof node === "object" && "source" in node && node.source)) {
          return;
        }

        reportIfRelative(node.source as SourceNode);
      },
      ExportNamedDeclaration(node: unknown) {
        if (!(node && typeof node === "object" && "source" in node && node.source)) {
          return;
        }

        reportIfRelative(node.source as SourceNode);
      },
    };
  },
};

export default preferSrcAliasRule;
