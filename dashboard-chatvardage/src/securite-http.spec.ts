import { jest } from '@jest/globals';
import type { Request, Response } from 'express';

import { limiterConnexions } from './securite-http.js';

function appel(
  limiter: ReturnType<typeof limiterConnexions>,
  ip: string | undefined = undefined,
  path = '/login',
  method = 'POST',
  remoteAddress: string | undefined = undefined,
) {
  const suite = jest.fn();
  const reponse = { setHeader: jest.fn(), status: jest.fn(), end: jest.fn() };
  reponse.status.mockReturnValue(reponse);
  limiter({
    ip, path, method, socket: { remoteAddress },
  } as Request, reponse as unknown as Response, suite);
  return { suite, reponse };
}

describe('Limitation des connexions administrateur', () => {
  it('bloque la onzième tentative, y compris avec casse ou slash final, avant Auth', () => {
    let instant = 0;
    const limiter = limiterConnexions(() => instant);
    for (let i = 0; i < 10; i += 1) expect(appel(limiter, 'a').suite).toHaveBeenCalled();
    const refuse = appel(limiter, 'a', '/LOGIN/');
    expect(refuse.suite).not.toHaveBeenCalled();
    expect(refuse.reponse.status).toHaveBeenCalledWith(429);
    expect(refuse.reponse.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(appel(limiter, 'b').suite).toHaveBeenCalled();
    instant = 60_000;
    expect(appel(limiter, 'a').suite).toHaveBeenCalled();
  });

  it('laisse passer les pages et utilise une adresse de repli', () => {
    const limiter = limiterConnexions(() => 0);
    expect(appel(limiter, 'a', '/login', 'GET').suite).toHaveBeenCalled();
    expect(appel(limiter, 'a', '/resources').suite).toHaveBeenCalled();
    expect(appel(limiter, undefined, '/login', 'POST', '127.0.0.1').suite).toHaveBeenCalled();
    const sansAdresse = appel(limiter);
    expect(sansAdresse.suite).not.toHaveBeenCalled();
    expect(sansAdresse.reponse.status).toHaveBeenCalledWith(429);
  });

  it('refuse les nouvelles adresses quand le plafond mémoire est atteint', () => {
    let instant = 0;
    const limiter = limiterConnexions(() => instant);
    for (let i = 0; i < 10_000; i += 1) appel(limiter, String(i));
    const refuse = appel(limiter, 'nouvelle');
    expect(refuse.reponse.status).toHaveBeenCalledWith(429);
    expect(refuse.suite).not.toHaveBeenCalled();
    expect(appel(limiter, '0').suite).toHaveBeenCalled();
    instant = 60_000;
    expect(appel(limiter, 'nouvelle').suite).toHaveBeenCalled();
  });

  it('expire les anciennes fenêtres sans réinitialiser les compteurs encore actifs', () => {
    let instant = 0;
    const limiter = limiterConnexions(() => instant);
    appel(limiter, 'ancienne');
    instant = 59_000;
    for (let i = 0; i < 10; i += 1) appel(limiter, 'active');
    instant = 60_000;
    expect(appel(limiter, 'ancienne').suite).toHaveBeenCalled();
    expect(appel(limiter, 'active').reponse.status).toHaveBeenCalledWith(429);
  });
});
