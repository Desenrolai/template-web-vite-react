import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem `globals: true` o auto-cleanup do Testing Library não se registra sozinho:
// o DOM do teste anterior sobrevive e `getByRole` acha elementos duplicados.
afterEach(cleanup);
