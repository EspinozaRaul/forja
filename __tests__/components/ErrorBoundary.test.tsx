import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import i18n from '../../lib/i18n';
import { ErrorBoundary } from '../../components/ErrorBoundary';

/**
 * The crash screen is the last thing between a broken render and the user, so
 * its release behaviour is asserted rather than assumed. Release must show the
 * generic message and none of the internals; development must keep the stack.
 *
 * `__DEV__` is a runtime global under Jest (jest-expo sets it, nothing inlines
 * it at transform time), so these tests flip it and restore it afterwards.
 */

const ORIGINAL_DEV = (globalThis as { __DEV__?: boolean }).__DEV__;

function Boom(): never {
  throw new Error('INTERNAL_MARKER boom');
}

describe('ErrorBoundary', () => {
  // React routes every caught error through console.error. What matters here is
  // what the boundary renders, so that noise is silenced rather than printed.
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    (globalThis as { __DEV__?: boolean }).__DEV__ = ORIGINAL_DEV;
  });

  it('renders its children while nothing throws', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    await render(
      <ErrorBoundary>
        <Text>CONTENT</Text>
      </ErrorBoundary>
    );

    expect(screen.getByText('CONTENT')).toBeTruthy();
    expect(screen.queryByText('ERROR')).toBeNull();
  });

  it('keeps the message and the stack in development', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    // The bare message is its own node; the marker also appears inside the stack
    // and the component stack, so more than one match proves the stacks render.
    expect(screen.getByText('INTERNAL_MARKER boom')).toBeTruthy();
    expect(screen.getAllByText(/INTERNAL_MARKER/).length).toBeGreaterThanOrEqual(2);
  });

  it('hides every internal detail in release', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText(i18n.t('common.unexpectedError'))).toBeTruthy();
    expect(screen.queryByText(/INTERNAL_MARKER/)).toBeNull();
    expect(screen.queryByText(/at .*\.(?:ts|tsx|js):\d+/)).toBeNull();
  });

  it('does not fall back to rendering the children after a crash', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    await render(
      <ErrorBoundary>
        <Boom />
        <Text>AFTER_CRASH</Text>
      </ErrorBoundary>
    );

    expect(screen.queryByText('AFTER_CRASH')).toBeNull();
  });
});
