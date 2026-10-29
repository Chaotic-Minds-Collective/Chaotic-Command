import { useContext } from 'react';
import { MockContext } from './mock-provider-context.js';

/**
 * determine whether a component
 * is running in a mocked context.
 */
export function useIsMock() {
  const isMock = useContext(MockContext);
  return Boolean(isMock);
}
