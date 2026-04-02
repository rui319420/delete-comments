import * as assert from 'assert';
import { removeComments, cleanupText, is42Header } from '../extension';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
const JS_CONFIG = {
  lineComment:      ['//'],
  blockComment:     [['/*', '*/'] as [string, string]],
  stringDelimiters: ['`', '"', "'"],
};

const C_CONFIG = {
  lineComment:      ['//'],
  blockComment:     [['/*', '*/'] as [string, string]],
  stringDelimiters: ['"', "'"],
};

const PY_CONFIG = {
  lineComment:      ['#'],
  stringDelimiters: ['"""', "'''", '"', "'"],
};

const HTML_CONFIG = {
  blockComment: [['<!--', '-->'] as [string, string]],
};

// Realistic 42 school header (abridged)
const HEADER_42 = [
  '/* ************************************************************************** */',
  '/*                                                                            */',
  '/*                                                        :::      ::::::::   */',
  '/* filename.c                                           :+:      :+:    :+:  */',
  '/*                                                    +:+ +:+         +:+    */',
  '/* By: rui <rui@student.42tokyo.jp>                +#+  +:+       +#+        */',
  '/*                                                +#+#+#+#+#+   +#+          */',
  '/* Created: 2024/01/01 00:00:00 by rui               #+#    #+#              */',
  '/* Updated: 2024/01/01 12:00:00 by rui              ###   ########.fr        */',
  '/*                                                                            */',
  '/* ************************************************************************** */',
].join('\n');

// -----------------------------------------------------------------------
// is42Header
// -----------------------------------------------------------------------
suite('is42Header', () => {
  test('returns true for a real 42 header', () => {
    assert.ok(is42Header(HEADER_42));
  });

  test('returns false for a regular block comment', () => {
    assert.ok(!is42Header('/* This is a normal comment */'));
  });

  test('returns false for a JSDoc comment', () => {
    assert.ok(!is42Header('/**\n * @param x\n * @returns y\n */'));
  });
});

// -----------------------------------------------------------------------
// removeComments – 42 header preservation
// -----------------------------------------------------------------------
suite('removeComments – 42 header', () => {
  test('preserves 42 header by default', () => {
    const input  = HEADER_42 + '\n\nint\tmain(void)\n{\n\treturn (0); /* done */\n}\n';
    const result = removeComments(input, C_CONFIG);
    assert.ok(result.includes(':::      ::::::::'), '42 header should be kept');
    assert.ok(!result.includes('done'), 'inline comment should be removed');
  });

  test('removes 42 header when preserve42Header is false', () => {
    const input  = HEADER_42 + '\nint main(void) { return 0; }\n';
    const result = removeComments(input, C_CONFIG, { preserve42Header: false });
    assert.ok(!result.includes(':::      ::::::::'), '42 header should be removed');
    assert.ok(result.includes('int main'), 'code should remain');
  });

  test('preserves 42 header line count when header is kept', () => {
    const input  = HEADER_42 + '\nint main(void) { return 0; }\n';
    const result = removeComments(input, C_CONFIG, { preserve42Header: true });
    assert.strictEqual(
      input.split('\n').length,
      result.split('\n').length,
      'line count should not change',
    );
  });

  test('maintains line count even when header is removed', () => {
    const input  = HEADER_42 + '\nint main(void) { return 0; }\n';
    const result = removeComments(input, C_CONFIG, { preserve42Header: false });
    assert.strictEqual(
      input.split('\n').length,
      result.split('\n').length,
      'line count should be preserved via replacement newlines',
    );
  });
});

// -----------------------------------------------------------------------
// removeComments – JS/TS
// -----------------------------------------------------------------------
suite('removeComments – JS/TS', () => {
  test('removes single-line comments', () => {
    const input  = 'const x = 1; // set x\nconst y = 2;\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(!result.includes('// set x'));
    assert.ok(result.includes('const x = 1;'));
  });

  test('removes block comments', () => {
    const input  = 'const x = /* value */ 42;\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(!result.includes('/* value */'));
    assert.ok(result.includes('42'));
  });

  test('preserves // inside double-quoted strings', () => {
    const input  = 'const url = "https://example.com";\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(result.includes('https://example.com'));
  });

  test('preserves /* inside single-quoted strings', () => {
    const input  = "const s = '/* not a comment */';\n";
    const result = removeComments(input, JS_CONFIG);
    assert.ok(result.includes('/* not a comment */'));
  });

  test('preserves // inside template literals', () => {
    const input  = 'const s = `http://example.com`;\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(result.includes('http://example.com'));
  });

  test('handles escape sequences inside strings', () => {
    const input  = 'const s = "He said \\"hello\\""; // greeting\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(result.includes('\\"hello\\"'));
    assert.ok(!result.includes('// greeting'));
  });

  test('removes multi-line block comments', () => {
    const input  = '/*\n * Header comment\n */\nconst x = 1;\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(!result.includes('Header comment'));
    assert.ok(result.includes('const x = 1;'));
  });
});

// -----------------------------------------------------------------------
// removeComments – Python
// -----------------------------------------------------------------------
suite('removeComments – Python', () => {
  test('removes # comments', () => {
    const input  = 'x = 1  # set x\ny = 2\n';
    const result = removeComments(input, PY_CONFIG);
    assert.ok(!result.includes('# set x'));
    assert.ok(result.includes('x = 1'));
  });

  test('preserves # inside double-quoted strings', () => {
    const input  = 'pattern = "#hashtag"\n';
    const result = removeComments(input, PY_CONFIG);
    assert.ok(result.includes('#hashtag'));
  });

  test('preserves triple-quoted strings', () => {
    const input  = 'msg = """Hello # world"""\n';
    const result = removeComments(input, PY_CONFIG);
    assert.ok(result.includes('Hello # world'));
  });
});

// -----------------------------------------------------------------------
// removeComments – HTML
// -----------------------------------------------------------------------
suite('removeComments – HTML', () => {
  test('removes HTML comments', () => {
    const input  = '<div><!-- TODO: fix --><p>Hello</p></div>\n';
    const result = removeComments(input, HTML_CONFIG);
    assert.ok(!result.includes('TODO: fix'));
    assert.ok(result.includes('<p>Hello</p>'));
  });
});

// -----------------------------------------------------------------------
// cleanupText
// -----------------------------------------------------------------------
suite('cleanupText', () => {
  test('trims trailing whitespace', () => {
    const result = cleanupText('const x = 1;   \nconst y = 2;\n');
    assert.ok(!result.includes('1;   '));
  });

  test('collapses consecutive blank lines', () => {
    const result = cleanupText('a\n\n\n\nb\n');
    assert.ok(!result.includes('\n\n\n'));
    assert.ok(result.includes('a'));
    assert.ok(result.includes('b'));
  });

  test('strips leading blank lines', () => {
    const result = cleanupText('\n\nconst x = 1;\n');
    assert.strictEqual(result[0], 'c');
  });

  test('ends with exactly one newline', () => {
    const result = cleanupText('const x = 1;\n\n\n');
    assert.ok(result.endsWith('\n'));
    assert.ok(!result.endsWith('\n\n'));
  });
});