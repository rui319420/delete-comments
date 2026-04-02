import * as vscode from 'vscode';

// -----------------------------------------------------------------------
// Language configurations
// -----------------------------------------------------------------------

interface CommentConfig {
  lineComment?: string[];
  blockComment?: Array<[string, string]>;
  /** Sorted longest-first so triple quotes are matched before single quotes */
  stringDelimiters?: string[];
}

const LANGUAGE_CONFIG: Record<string, CommentConfig> = {
  javascript:       { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  typescript:       { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  javascriptreact:  { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  typescriptreact:  { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  // Python triple-quoted strings are treated as strings (preserved), only # is removed
  python:           { lineComment: ['#'], stringDelimiters: ['"""', "'''", '"', "'"] },
  ruby:             { lineComment: ['#'], stringDelimiters: ['"', "'"] },
  shellscript:      { lineComment: ['#'], stringDelimiters: ['"', "'"] },
  html:             { blockComment: [['<!--', '-->']] },
  css:              { blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  scss:             { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  less:             { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  c:                { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  cpp:              { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  java:             { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  go:               { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"'] },
  rust:             { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"'] },
  php:              { lineComment: ['//', '#'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  swift:            { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"'] },
  kotlin:           { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  csharp:           { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  lua:              { lineComment: ['--'], blockComment: [['--[[', ']]']], stringDelimiters: ['"', "'"] },
  sql:              { lineComment: ['--'], blockComment: [['/*', '*/']], stringDelimiters: ['"', "'"] },
  yaml:             { lineComment: ['#'], stringDelimiters: ['"', "'"] },
  toml:             { lineComment: ['#'], stringDelimiters: ['"""', "'''", '"', "'"] },
  ini:              { lineComment: ['#', ';'], stringDelimiters: ['"', "'"] },
  makefile:         { lineComment: ['#'] },
  dockerfile:       { lineComment: ['#'] },
  r:                { lineComment: ['#'], stringDelimiters: ['"', "'"] },
  perl:             { lineComment: ['#'], stringDelimiters: ['"', "'"] },
  coffeescript:     { lineComment: ['#'], blockComment: [['###', '###']], stringDelimiters: ['"', "'", '`'] },
};

// -----------------------------------------------------------------------
// State-machine comment remover
// -----------------------------------------------------------------------

/**
 * Removes comments from `text` while correctly ignoring comment-like
 * sequences inside string literals.
 */
export function removeComments(text: string, config: CommentConfig): string {
  const lineComments  = config.lineComment  ?? [];
  const blockComments = config.blockComment ?? [];
  // Sort longest-first so e.g. `"""` is tried before `"`
  const stringDelims  = [...(config.stringDelimiters ?? [])].sort((a, b) => b.length - a.length);

  let result          = '';
  let i               = 0;
  let inString        = false;
  let stringChar      = '';
  let inLineComment   = false;
  let inBlockComment  = false;
  let blockCommentEnd = '';

  while (i < text.length) {
    const ch = text[i];

    // ── Newline ────────────────────────────────────────────────────────
    if (ch === '\n') {
      inLineComment = false;          // line comment ends here
      result += '\n';
      i++;
      continue;
    }

    // ── Inside a line comment ──────────────────────────────────────────
    if (inLineComment) {
      i++;
      continue;
    }

    // ── Inside a block comment ─────────────────────────────────────────
    if (inBlockComment) {
      if (text.startsWith(blockCommentEnd, i)) {
        i += blockCommentEnd.length;
        inBlockComment = false;
      } else {
        i++;
      }
      continue;
    }

    // ── Inside a string literal ────────────────────────────────────────
    if (inString) {
      // Escape sequence (not applicable to raw backtick template literals in the
      // same way, but harmless to check for `\`)
      if (ch === '\\') {
        result += ch + (text[i + 1] ?? '');
        i += 2;
        continue;
      }
      // Check for closing delimiter
      if (text.startsWith(stringChar, i)) {
        result += stringChar;
        i += stringChar.length;
        inString = false;
        continue;
      }
      result += ch;
      i++;
      continue;
    }

    // ── Normal mode: probe for string / block comment / line comment ───

    // String start (longest delimiter wins)
    let matched = false;
    for (const delim of stringDelims) {
      if (text.startsWith(delim, i)) {
        inString   = true;
        stringChar = delim;
        result    += delim;
        i         += delim.length;
        matched    = true;
        break;
      }
    }
    if (matched) { continue; }

    // Block comment start
    for (const [start, end] of blockComments) {
      if (text.startsWith(start, i)) {
        inBlockComment  = true;
        blockCommentEnd = end;
        i              += start.length;
        matched         = true;
        break;
      }
    }
    if (matched) { continue; }

    // Line comment start
    for (const lc of lineComments) {
      if (text.startsWith(lc, i)) {
        inLineComment = true;
        i            += lc.length;
        matched       = true;
        break;
      }
    }
    if (matched) { continue; }

    // Ordinary character
    result += ch;
    i++;
  }

  return result;
}

// -----------------------------------------------------------------------
// Post-processing helpers
// -----------------------------------------------------------------------

/**
 * After comment removal:
 *  1. Trims trailing whitespace on every line.
 *  2. Collapses 2+ consecutive blank lines into a single blank line.
 *  3. Strips a leading blank line and a trailing newline.
 */
export function cleanupText(text: string): string {
  const lines = text.split('\n').map(l => l.trimEnd());

  const out: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 1) { out.push(line); }
    } else {
      blankRun = 0;
      out.push(line);
    }
  }

  // Drop leading blank lines
  while (out.length > 0 && out[0].trim() === '') { out.shift(); }
  // Drop trailing blank lines
  while (out.length > 0 && out[out.length - 1].trim() === '') { out.pop(); }

  return out.join('\n') + '\n';
}

// -----------------------------------------------------------------------
// Extension entry points
// -----------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'delete-comments.deleteComments',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('delete-comments: No active editor.');
        return;
      }

      const { document } = editor;
      const languageId   = document.languageId;
      const config       = LANGUAGE_CONFIG[languageId];

      if (!config) {
        vscode.window.showWarningMessage(
          `delete-comments: "${languageId}" is not supported yet.`
        );
        return;
      }

      const original = document.getText();
      const result   = cleanupText(removeComments(original, config));

      if (result === original) {
        vscode.window.showInformationMessage('delete-comments: No comments found.');
        return;
      }

      await editor.edit(builder => {
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(original.length)
        );
        builder.replace(fullRange, result);
      });

      vscode.window.showInformationMessage('delete-comments: Comments removed ✓');
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void { /* nothing to clean up */ }