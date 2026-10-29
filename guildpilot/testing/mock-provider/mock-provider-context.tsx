import { createContext } from 'react';

/**
 * context for running in mock mode.
 */
export const MockContext = createContext<boolean>(false);
