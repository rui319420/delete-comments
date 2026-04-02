import * as assert from 'assert';
import { removeComments, cleanupText } from '../extension';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
const JS_CONFIG = {
  lineComment:      ['//'],
  blockComment:     [['/*', '*/'] as [string, string]],
  stringDelimiters: ['`', '"', "'"],
};

const PY_CONFIG = {
  lineComment:      ['#'],
  stringDelimiters: ['"""', "'''", '"', "'"],
};

const HTML_CONFIG = {
  blockComment: [['<!--', '-->'] as [string, string]],
};

// -----------------------------------------------------------------------
// removeComments – JavaScript / TypeScript
// -----------------------------------------------------------------------
suite('removeComments – JS/TS', () => {
  test('removes single-line comments', () => {
    const input  = 'const x = 1; // set x\nconst y = 2;\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(!result.includes('// set x'));
    assert.ok(result.includes('const x = 1;'));
    assert.ok(result.includes('const y = 2;'));
  });

  test('removes block comments', () => {
    const input  = 'const x = /* value */ 42;\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(!result.includes('/* value */'));
    assert.ok(result.includes('const x ='));
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

  test('removes JSDoc-style comments', () => {
    const input  = '/**\n * @param {number} n\n * @returns {number}\n */\nfunction double(n) { return n * 2; }\n';
    const result = removeComments(input, JS_CONFIG);
    assert.ok(!result.includes('@param'));
    assert.ok(result.includes('function double'));
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

  test('preserves content inside single-quoted triple strings', () => {
    const input  = "s = '''line one\nline two'''\n";
    const result = removeComments(input, PY_CONFIG);
    assert.ok(result.includes('line one'));
    assert.ok(result.includes('line two'));
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

  test('removes multi-line HTML comments', () => {
    const input  = '<!--\n  Old code\n-->\n<p>Keep</p>\n';
    const result = removeComments(input, HTML_CONFIG);
    assert.ok(!result.includes('Old code'));
    assert.ok(result.includes('<p>Keep</p>'));
  });
});

// -----------------------------------------------------------------------
// cleanupText
// -----------------------------------------------------------------------
suite('cleanupText', () => {
  test('trims trailing whitespace', () => {
    const input  = 'const x = 1;   \nconst y = 2;\n';
    const result = cleanupText(input);
    assert.ok(!result.includes('1;   '));
    assert.ok(result.includes('const x = 1;'));
  });

  test('collapses consecutive blank lines', () => {
    const input  = 'a\n\n\n\nb\n';
    const result = cleanupText(input);
    // Should have at most one consecutive blank line
    assert.ok(!result.includes('\n\n\n'));
    assert.ok(result.includes('a'));
    assert.ok(result.includes('b'));
  });

  test('strips leading blank lines', () => {
    const input  = '\n\nconst x = 1;\n';
    const result = cleanupText(input);
    assert.strictEqual(result[0], 'c');
  });

  test('ends with a single newline', () => {
    const input  = 'const x = 1;\n\n\n';
    const result = cleanupText(input);
    assert.ok(result.endsWith('\n'));
    assert.ok(!result.endsWith('\n\n'));
  });
});