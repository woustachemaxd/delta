import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInjector } from '../src/injector.js';

const TEST_SELECTORS = {
  CLAUDE_MESSAGE: '.test-message',
  STREAMING_DIV: '.test-streaming',
  RESPONSE_CONTENT: '.test-content',
};

function fakeMessage({ streaming = false, withContent = true } = {}) {
  const msg = document.createElement('div');
  msg.className = 'test-message';
  const streamingDiv = document.createElement('div');
  streamingDiv.className = 'test-streaming';
  streamingDiv.setAttribute('data-is-streaming', streaming ? 'true' : 'false');
  msg.appendChild(streamingDiv);
  if (withContent) {
    const content = document.createElement('div');
    content.className = 'test-content';
    content.textContent = 'hello';
    msg.appendChild(content);
  }
  return msg;
}

describe('injector — resilience', () => {
  let consoleSpy;
  let injector;

  beforeEach(() => {
    document.body.innerHTML = '';
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    injector?.stop();
    consoleSpy.mockRestore();
  });

  it('does not throw when CLAUDE_MESSAGE selector is syntactically invalid', () => {
    injector = createInjector(vi.fn(), {
      selectors: { CLAUDE_MESSAGE: '>>> invalid <<<', STREAMING_DIV: '.x', RESPONSE_CONTENT: '.y' },
    });
    expect(() => injector.start()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('does not throw when an individual onMount handler throws', () => {
    document.body.appendChild(fakeMessage());
    const onMount = vi.fn(() => {
      throw new Error('boom');
    });
    injector = createInjector(onMount, { selectors: TEST_SELECTORS });
    expect(() => injector.start()).not.toThrow();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('keeps mounting subsequent messages after one throws', () => {
    document.body.appendChild(fakeMessage());
    document.body.appendChild(fakeMessage());
    let call = 0;
    const onMount = vi.fn(() => {
      call += 1;
      if (call === 1) throw new Error('first one fails');
    });
    injector = createInjector(onMount, { selectors: TEST_SELECTORS });
    injector.start();
    expect(onMount).toHaveBeenCalledTimes(2);
  });

  it('skips messages whose streaming flag is true', () => {
    document.body.appendChild(fakeMessage({ streaming: true }));
    const onMount = vi.fn();
    injector = createInjector(onMount, { selectors: TEST_SELECTORS });
    injector.start();
    expect(onMount).not.toHaveBeenCalled();
  });

  it('marks mounted messages so they are not re-mounted', () => {
    document.body.appendChild(fakeMessage());
    const onMount = vi.fn();
    injector = createInjector(onMount, { selectors: TEST_SELECTORS });
    injector.start();
    injector.stop();
    injector = createInjector(onMount, { selectors: TEST_SELECTORS });
    injector.start();
    expect(onMount).toHaveBeenCalledTimes(1);
  });
});
