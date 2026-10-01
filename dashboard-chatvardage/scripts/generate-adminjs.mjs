import { existsSync } from 'node:fs';

import AdminJS from 'adminjs';

if (!existsSync(new URL('../dist/admin/options.js', import.meta.url))) {
  console.error('dist/admin/options.js introuvable : executer "npm run build" avant ce script.');
  process.exit(1);
}

try {
  const { default: options } = await import('../dist/admin/options.js');
  if (!options?.resources) throw new Error('dist/admin/options.js n exporte pas d options AdminJS valides.');
  await new AdminJS(options).initialize();
} catch (erreur) {
  console.error('Generation des composants AdminJS impossible :', erreur);
  process.exit(1);
}
