import * as vscode from 'vscode';

interface CommentConfig {
  lineComment?: string[];
  blockComment?: Array<[string, string]>;
  stringDelimiters?: string[];
}

const LANGUAGE_CONFIG: Record<string, CommentConfig> = {
  javascript:       { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  typescript:       { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  javascriptreact:  { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
  typescriptreact:  { lineComment: ['//'], blockComment: [['/*', '*/']], stringDelimiters: ['`', '"', "'"] },
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

export function is42Header(blockCommentText: string): boolean {
  return blockCommentText.includes(':::      ::::::::');
}

export interface RemoveOptions {
  preserve42Header?: boolean;
}

function extract42HeaderPrefix(
  text: string,
  blockComments: Array<[string, string]>,
): string {
  if (!blockComments.some(([start, end]) => start === '/*' && end === '*/')) {
    return '';
  }

  let i = 0;
  let sawCommentLine = false;
  let saw42Signature = false;

  while (i < text.length) {
    const newlineIdx = text.indexOf('\n', i);
    const lineEnd = newlineIdx === -1 ? text.length : newlineIdx;
    const line = text.slice(i, lineEnd);
    const trimmed = line.trim();

    if (!sawCommentLine && trimmed === '') {
      i = newlineIdx === -1 ? text.length : newlineIdx + 1;
      continue;
    }

    const isSingleLineBlock = trimmed.startsWith('/*') && trimmed.endsWith('*/');
    if (!isSingleLineBlock) {
      break;
    }

    sawCommentLine = true;
    if (line.includes(':::      ::::::::')) {
      saw42Signature = true;
    }

    i = newlineIdx === -1 ? text.length : newlineIdx + 1;
  }

  if (!sawCommentLine || !saw42Signature) {
    return '';
  }

  return text.slice(0, i);
}

export function removeComments(
  text: string,
  config: CommentConfig,
  options: RemoveOptions = {},
): string {
  const { preserve42Header = true } = options;

  const lineComments  = config.lineComment  ?? [];
  const blockComments = config.blockComment ?? [];
  const stringDelims  = [...(config.stringDelimiters ?? [])].sort((a, b) => b.length - a.length);

  const preservedHeader = preserve42Header
    ? extract42HeaderPrefix(text, blockComments)
    : '';
  const sourceText = text.slice(preservedHeader.length);

  let result             = '';
  let i                  = 0;
  let inString           = false;
  let stringChar         = '';
  let inLineComment      = false;
  let inBlockComment     = false;
  let blockCommentEnd    = '';
  let blockCommentBuffer = '';

  while (i < sourceText.length) {
    const ch = sourceText[i];

    if (ch === '\n') {
      if (inBlockComment) {
        blockCommentBuffer += '\n';
        i++;
        continue;
      }
      inLineComment = false;
      result += '\n';
      i++;
      continue;
    }

    if (inLineComment) {
      i++;
      continue;
    }

    if (inBlockComment) {
      if (sourceText.startsWith(blockCommentEnd, i)) {
        blockCommentBuffer += blockCommentEnd;
        i                  += blockCommentEnd.length;
        inBlockComment      = false;

        if (preserve42Header && is42Header(blockCommentBuffer)) {
          result += blockCommentBuffer;
        } else {
          const newlines = (blockCommentBuffer.match(/\n/g) ?? []).length;
          result += '\n'.repeat(newlines);
        }

        blockCommentBuffer = '';
      } else {
        blockCommentBuffer += ch;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        result += ch + (sourceText[i + 1] ?? '');
        i += 2;
        continue;
      }
      if (sourceText.startsWith(stringChar, i)) {
        result += stringChar;
        i      += stringChar.length;
        inString = false;
        continue;
      }
      result += ch;
      i++;
      continue;
    }

    let matched = false;
    for (const delim of stringDelims) {
      if (sourceText.startsWith(delim, i)) {
        inString   = true;
        stringChar = delim;
        result    += delim;
        i         += delim.length;
        matched    = true;
        break;
      }
    }
    if (matched) { continue; }

    for (const [start, end] of blockComments) {
      if (sourceText.startsWith(start, i)) {
        inBlockComment     = true;
        blockCommentEnd    = end;
        blockCommentBuffer = start;
        i                 += start.length;
        matched            = true;
        break;
      }
    }
    if (matched) { continue; }

    for (const lc of lineComments) {
      if (sourceText.startsWith(lc, i)) {
        inLineComment = true;
        i            += lc.length;
        matched       = true;
        break;
      }
    }
    if (matched) { continue; }

    result += ch;
    i++;
  }

  return preservedHeader + result;
}

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

  while (out.length > 0 && out[0].trim() === '')              { out.shift(); }
  while (out.length > 0 && out[out.length - 1].trim() === '') { out.pop(); }

  return out.join('\n') + '\n';
}

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

      const settings = vscode.workspace.getConfiguration('delete-comments');
      const options: RemoveOptions = {
        preserve42Header: settings.get<boolean>('preserve42Header', true),
      };

      const original = document.getText();
      const result   = cleanupText(removeComments(original, config, options));

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
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void { /* nothing to clean up */ }