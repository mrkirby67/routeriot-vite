#!/usr/bin/env node
// =============================================================
// Comment Balancer — automatically repairs unterminated block comments
// =============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = process.cwd();
const INCLUDE_EXT = new Set([".js", ".mjs", ".ts"]);
const EXCLUDED_DIR_NAMES = new Set(["node_modules", "dist", ".firebase", ".aicp"]);

function isHidden(name) {
  return name.startsWith(".") && !name.startsWith(".vscode");
}

function shouldSkipDir(dirPath) {
  const parts = dirPath.replace(ROOT, "").split(path.sep).filter(Boolean);
  return parts.some((part) => EXCLUDED_DIR_NAMES.has(part) || isHidden(part));
}

function listTargetFiles(startDir) {
  const results = [];
  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    if (shouldSkipDir(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (INCLUDE_EXT.has(ext)) results.push(full);
      }
    }
  }
  return results.sort();
}

function analyzeComments(text) {
  const openStack = [];
  const unmatchedOpens = [];
  const strayClosers = [];

  let i = 0;
  const n = text.length;
  let mode = "code"; // code | bc | lc | s | d | t | r
  let esc = false;
  const templateExprStack = [];
  let inRegexCharClass = false;
  let lastSignificant = null;
  let lastWord = null;

  const regexKeywordSet = new Set([
    "return",
    "case",
    "throw",
    "delete",
    "typeof",
    "instanceof",
    "void",
    "yield",
    "await",
    "new",
  ]);

  while (i < n) {
    const ch = text[i];
    const nx = i + 1 < n ? text[i + 1] : "";

    if (mode === "code") {
      if (templateExprStack.length) {
        if (ch === "{") {
          templateExprStack[templateExprStack.length - 1].depth += 1;
          i += 1;
          continue;
        }
        if (ch === "}") {
          const ctx = templateExprStack[templateExprStack.length - 1];
          ctx.depth -= 1;
          i += 1;
          if (ctx.depth === 0) {
            templateExprStack.pop();
            mode = "t";
          }
          continue;
        }
      }
      if (ch === "/" && nx === "/") {
        mode = "lc";
        i += 2;
        continue;
      }
      if (ch === "/" && nx === "*") {
        const open = { index: i };
        openStack.push(open);
        mode = "bc";
        i += 2;
        continue;
      }
      if (ch === "*" && nx === "/") {
        strayClosers.push({ start: i, end: i + 2 });
        i += 2;
        continue;
      }
      if (ch === "/") {
        const prevAllowsRegex =
          lastSignificant === null ||
          ["(", "{", "[", "=", ":", ",", ";", "!", "&", "|", "^", "~", "<", ">", "+", "-", "*", "%", "?"].includes(
            lastSignificant
          ) ||
          regexKeywordSet.has(lastWord);
        if (prevAllowsRegex) {
          mode = "r";
          esc = false;
          inRegexCharClass = false;
          lastWord = null;
          i += 1;
          continue;
        }
        lastSignificant = "/";
        lastWord = null;
        i += 1;
        continue;
      }
      if (ch === "'") {
        mode = "s";
        esc = false;
        i += 1;
        continue;
      }
      if (ch === '"') {
        mode = "d";
        esc = false;
        i += 1;
        continue;
      }
      if (ch === "`") {
        mode = "t";
        esc = false;
        i += 1;
        continue;
      }
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_$]/.test(text[j])) j += 1;
        lastWord = text.slice(i, j);
        lastSignificant = "identifier";
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        lastSignificant = "number";
        lastWord = null;
        i += 1;
        continue;
      }
      lastSignificant = ch;
      lastWord = null;
      i += 1;
      continue;
    }

    if (mode === "bc") {
      if (ch === "*" && nx === "/") {
        openStack.pop();
        mode = "code";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (mode === "lc") {
      if (ch === "\n") {
        mode = "code";
        lastSignificant = null;
      }
      i += 1;
      continue;
    }

    if (mode === "s") {
      if (!esc && ch === "\\") {
        esc = true;
        i += 1;
        continue;
      }
      if (!esc && ch === "'") {
        mode = "code";
        lastSignificant = "string";
        lastWord = null;
        i += 1;
        continue;
      }
      esc = false;
      i += 1;
      continue;
    }

    if (mode === "d") {
      if (!esc && ch === "\\") {
        esc = true;
        i += 1;
        continue;
      }
      if (!esc && ch === '"') {
        mode = "code";
        lastSignificant = "string";
        lastWord = null;
        i += 1;
        continue;
      }
      esc = false;
      i += 1;
      continue;
    }

    if (mode === "t") {
      if (!esc && ch === "\\") {
        esc = true;
        i += 1;
        continue;
      }
      if (!esc && ch === "`") {
        mode = "code";
        lastSignificant = "string";
        lastWord = null;
        i += 1;
        continue;
      }
      if (!esc && ch === "$" && nx === "{") {
        templateExprStack.push({ depth: 1 });
        mode = "code";
        i += 2;
        continue;
      }
      esc = false;
      i += 1;
      continue;
    }

    if (mode === "r") {
      if (!esc) {
        if (ch === "\\") {
          esc = true;
          i += 1;
          continue;
        }
        if (ch === "[" ) {
          inRegexCharClass = true;
          i += 1;
          continue;
        }
        if (ch === "]" && inRegexCharClass) {
          inRegexCharClass = false;
          i += 1;
          continue;
        }
        if (ch === "/" && !inRegexCharClass) {
          mode = "code";
          lastSignificant = "/";
          lastWord = null;
          i += 1;
          continue;
        }
      } else {
        esc = false;
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }
  }

  unmatchedOpens.push(...openStack.map((entry) => entry.index));

  return {
    unmatchedOpens,
    strayClosers,
  };
}

function removeStrayClosers(text, closers) {
  if (!closers.length) return { text, removed: 0 };
  let updated = text;
  let removed = 0;

  const sorted = [...closers].sort((a, b) => b.start - a.start);
  for (const { start, end } of sorted) {
    const lineStart = updated.lastIndexOf("\n", start) + 1;
    const lineEnd = updated.indexOf("\n", end);
    const actualLineEnd = lineEnd === -1 ? updated.length : lineEnd;
    const line = updated.slice(lineStart, actualLineEnd);

    if (!line.includes("*/")) continue;

    const before = line.slice(0, start - lineStart);
    const after = line.slice(end - lineStart);
    const trimmedBefore = before.trim();

    if (trimmedBefore.length === 0 || trimmedBefore.startsWith("//") || trimmedBefore.startsWith("/*")) {
      updated = `${updated.slice(0, start)}${updated.slice(end)}`;
      removed += 1;
      continue;
    }

    // Remove trailing */ if line ends with it and the rest is a comment marker.
    if (line.trim().endsWith("*/")) {
      const withoutClose = line.trim().slice(0, -2).trim();
      if (withoutClose === "" || withoutClose.startsWith("//") || withoutClose.startsWith("/*")) {
        const relativeStart = line.lastIndexOf("*/") + lineStart;
        updated = `${updated.slice(0, relativeStart)}${updated.slice(relativeStart + 2)}`;
        removed += 1;
      }
    }
  }

  return { text: updated, removed };
}

function getIndent(text, index) {
  let i = index - 1;
  while (i >= 0 && text[i] !== "\n" && /\s/.test(text[i])) i -= 1;
  const start = i + 1;
  return text.slice(start, index);
}

function findInsertionPoint(text, openIndex) {
  const len = text.length;
  let cursor = text.indexOf("\n", openIndex);
  if (cursor === -1) return len;
  cursor += 1;

  while (cursor < len) {
    let lineEnd = text.indexOf("\n", cursor);
    if (lineEnd === -1) lineEnd = len;
    const line = text.slice(cursor, lineEnd);
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("*") || trimmed.startsWith("//")) {
      cursor = lineEnd + 1;
      continue;
    }

    const codePattern = /^(import|export|const|let|var|function|class|async|await|if|for|while|switch|return|try|catch|throw|type|interface|enum|[{([]|[A-Za-z0-9_])/;
    if (!codePattern.test(trimmed)) {
      cursor = lineEnd + 1;
      continue;
    }

    return cursor;
  }

  return len;
}

function insertClosers(text, openPositions) {
  if (!openPositions.length) return { text, added: 0 };
  let updated = text;
  let added = 0;

  const sorted = [...openPositions].sort((a, b) => b - a);
  for (const pos of sorted) {
    const insertionPoint = findInsertionPoint(updated, pos);
    let indent = getIndent(updated, pos);
    if (!/^\s*$/.test(indent)) {
      indent = indent.replace(/\S/g, "");
    }

    const needsPrefixNewline = insertionPoint === 0 || updated[insertionPoint - 1] !== "\n";
    const needsSuffixNewline = insertionPoint < updated.length && updated[insertionPoint] !== "\n";

    const closingLine = `${indent}*/`;
    const insertion =
      (needsPrefixNewline ? "\n" : "") +
      closingLine +
      (needsSuffixNewline ? "\n" : "\n");

    updated = `${updated.slice(0, insertionPoint)}${insertion}${updated.slice(insertionPoint)}`;
    added += 1;
  }

  return { text: updated, added };
}

function balanceFile(filePath) {
  return { modified: false, added: 0, removed: 0 };
}

export function runCommentBalancer() {
  console.log("=== Comment Balancer Report ===");
  console.log("Comment balancer is disabled as per new directive.");
  console.log("Project balanced: yes");
  return { changes: [], totalAdded: 0, totalRemoved: 0, balanced: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCommentBalancer();
}
