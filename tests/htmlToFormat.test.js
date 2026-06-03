import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import { createHtmlToFormat } from '../src/htmlToFormat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures', 'html');

function loadFixture(name) {
  const html = readFileSync(join(FIXTURE_DIR, name), 'utf8');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper;
}

const { markdown, plain, html } = createHtmlToFormat({ TurndownService, gfmTables: tables });

describe('HtmlToFormat — markdown', () => {
  it('renders a paragraph as plain markdown', () => {
    const out = markdown(loadFixture('paragraph.html'));
    expect(out).toContain('Hello, world.');
    expect(out).not.toContain('<p>');
  });

  it('preserves fenced code blocks with language hint', () => {
    const out = markdown(loadFixture('code-fenced.html'));
    expect(out).toMatch(/```python\n/);
    expect(out).toContain("print('hello')");
    expect(out).toMatch(/```\s*$/);
  });

  it('preserves nested ordered and unordered lists', () => {
    const out = markdown(loadFixture('nested-lists.html'));
    expect(out).toMatch(/1\.\s+First/);
    expect(out).toMatch(/\n\s+[-*+]\s+Nested A/);
    expect(out).toMatch(/2\.\s+Second/);
  });

  it('renders a GFM table', () => {
    const out = markdown(loadFixture('table.html'));
    expect(out).toContain('| Name |');
    expect(out).toMatch(/\|\s*-+\s*\|/);
    expect(out).toContain('| Alice |');
  });

  it('preserves inline code, bold, italics, and links', () => {
    const out = markdown(loadFixture('inline-formatting.html'));
    expect(out).toMatch(/\*\*bold\*\*/);
    expect(out).toMatch(/[*_]italic[*_]/);
    expect(out).toMatch(/`inline`/);
    expect(out).toMatch(/\[link\]\(https:\/\/example\.com\)/);
  });

  it('converts <br> tags to newlines', () => {
    const out = markdown(loadFixture('line-breaks.html'));
    expect(out).toContain('line one\nline two');
  });

  it('strips buttons and other interactive elements', () => {
    const out = markdown(loadFixture('with-buttons.html'));
    expect(out).toContain('Real content here.');
    expect(out).toContain('More real content.');
    expect(out).not.toContain('Thinking summary');
    expect(out).not.toContain('Create New Chat From Here');
  });
});

describe('HtmlToFormat — plain', () => {
  it('strips html tags and markdown markers from inline formatting', () => {
    const out = plain(loadFixture('inline-formatting.html'));
    expect(out).toContain('bold');
    expect(out).toContain('italic');
    expect(out).toContain('inline');
    expect(out).toContain('link');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('**');
    expect(out).not.toContain('`');
    expect(out).not.toContain('[');
  });

  it('strips interactive elements', () => {
    const out = plain(loadFixture('with-buttons.html'));
    expect(out).toContain('Real content here.');
    expect(out).toContain('More real content.');
    expect(out).not.toContain('Thinking summary');
    expect(out).not.toContain('Create New Chat From Here');
  });
});

describe('HtmlToFormat — html', () => {
  it('preserves formatting tags', () => {
    const out = html(loadFixture('inline-formatting.html'));
    expect(out).toMatch(/<strong>bold<\/strong>/);
    expect(out).toMatch(/<em>italic<\/em>/);
    expect(out).toMatch(/<code>inline<\/code>/);
    expect(out).toMatch(/<a [^>]*href="https:\/\/example\.com"[^>]*>link<\/a>/);
  });

  it('strips interactive elements but keeps surrounding content', () => {
    const out = html(loadFixture('with-buttons.html'));
    expect(out).not.toContain('<button');
    expect(out).not.toContain('Thinking summary');
    expect(out).not.toContain('Create New Chat From Here');
    expect(out).toContain('Real content here.');
    expect(out).toContain('More real content.');
  });
});
