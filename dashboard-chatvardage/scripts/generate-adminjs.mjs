import { existsSync } from 'node:fs';

import AdminJS from 'adminjs';

if (!existsSync(new URL('../dist/admin/options.js', import.meta.url))) {
  console.error('dist/admin/options.js introuvable : executer "npm run build" avant ce script.');
  process.exit(1);
}

const { default: options } = await import('../dist/admin/options.js');

await new AdminJS(options).initialize();
