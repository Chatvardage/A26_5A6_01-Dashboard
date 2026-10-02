import { execFileSync } from 'node:child_process';

// Jest ne peut pas charger ce paquet CommonJS qui requiert adminjs (ESM) : Node le verifie directement.
describe('Compatibilite de @adminjs/express', () => {
  it('expose buildAuthenticatedRouter sur l import par defaut utilise par main.ts', () => {
    const script = 'import(\'@adminjs/express\')'
      + '.then((m) => process.stdout.write(typeof m.default.buildAuthenticatedRouter))';

    expect(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' })).toBe('function');
  });
});
