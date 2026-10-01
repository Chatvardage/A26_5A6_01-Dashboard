import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

const construireRouteur = jest.fn();
jest.unstable_mockModule('@adminjs/express', () => ({
  default: { buildAuthenticatedRouter: construireRouteur },
}));

const { authentifierAdministrateur, demarrerApplication, resoudreSecrets } = await import('./main.js');

describe('Point d entree de l application', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    construireRouteur.mockClear();
  });

  it('authentifie un administrateur avec les informations du service', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        jeton: 'header.payload.signature',
        utilisateur: {
          id: 'admin-1', pseudo: 'Eva', courriel: 'eva@example.test', role: 'admin',
        },
      }),
    } as Response);

    await expect(authentifierAdministrateur('eva@example.test', 'mot-de-passe'))
      .resolves.toEqual({
        id: 'admin-1', email: 'eva@example.test', title: 'Eva', jeton: 'header.payload.signature',
      });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant: 'eva@example.test', mot_de_passe: 'mot-de-passe' }),
    });
  });

  it('refuse un compte non administrateur et une erreur du service', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jeton: 'user.header.signature',
        utilisateur: {
          id: 'utilisateur-1', pseudo: 'Alex', courriel: 'alex@example.test', role: 'user',
        },
      }),
    } as Response);
    fetchMock.mockRejectedValueOnce(new Error('Service indisponible'));

    await expect(authentifierAdministrateur('alex@example.test', 'mot-de-passe')).resolves.toBeNull();
    await expect(authentifierAdministrateur('alex@example.test', 'mot-de-passe')).resolves.toBeNull();
    await expect(authentifierAdministrateur('alex@example.test', 'mot-de-passe')).resolves.toBeNull();
  });

  it('monte le routeur AdminJS et ecoute le port configure', async () => {
    const utiliser = jest.fn();
    const ecouter = jest.fn().mockResolvedValue(undefined);
    const portInitial = process.env.PORT;
    const secretInitial = process.env.COOKIE_SECRET;
    const secretSessionInitial = process.env.SESSION_SECRET;
    const environnementInitial = process.env.NODE_ENV;
    delete process.env.PORT;
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = 'secret-cookie-de-test-de-plus-de-32-caracteres';
    process.env.SESSION_SECRET = 'secret-session-de-test-de-plus-de-32-caracteres';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        jeton: 'header.payload.signature',
        utilisateur: {
          id: 'admin-1', pseudo: 'Eva', courriel: 'eva@example.test', role: 'admin',
        },
      }),
    } as Response);
    construireRouteur.mockReturnValue('routeur-admin');
    jest.spyOn(NestFactory, 'create').mockResolvedValue({
      getHttpAdapter: () => ({ getInstance: () => ({ use: utiliser }) }),
      listen: ecouter,
    } as never);

    try {
      await demarrerApplication();
    } finally {
      if (portInitial === undefined) delete process.env.PORT;
      else process.env.PORT = portInitial;
      if (secretInitial === undefined) delete process.env.COOKIE_SECRET;
      else process.env.COOKIE_SECRET = secretInitial;
      if (secretSessionInitial === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = secretSessionInitial;
      if (environnementInitial === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environnementInitial;
    }

    expect(construireRouteur).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cookieName: 'chatvardage-admin',
        cookiePassword: 'secret-cookie-de-test-de-plus-de-32-caracteres',
      }),
      undefined,
      expect.objectContaining({
        resave: false,
        saveUninitialized: false,
        secret: 'secret-session-de-test-de-plus-de-32-caracteres',
      }),
    );
    expect(utiliser).toHaveBeenCalledWith('/administration', 'routeur-admin');
    expect(ecouter).toHaveBeenCalledWith(3000);

    const [, optionsAuthentification] = construireRouteur.mock.calls[0];
    const authentifier = (optionsAuthentification as {
      authenticate: (courriel: string, motDePasse: string) => Promise<unknown>;
    }).authenticate;
    await expect(authentifier('eva@example.test', 'mot-de-passe')).resolves.toMatchObject({
      id: 'admin-1',
    });

    const secretCookieDuplique = 'secret-cookie-de-test-de-plus-de-32-caracteres';
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = secretCookieDuplique;
    process.env.SESSION_SECRET = secretCookieDuplique;
    try {
      await expect(demarrerApplication()).rejects.toThrow('SESSION_SECRET doit etre defini');
      expect(construireRouteur).toHaveBeenCalledTimes(1);
    } finally {
      if (secretInitial === undefined) delete process.env.COOKIE_SECRET;
      else process.env.COOKIE_SECRET = secretInitial;
      if (secretSessionInitial === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = secretSessionInitial;
    }
  });

  it('refuse le secret de developpement en production avant de creer le serveur', async () => {
    const secretInitial = process.env.COOKIE_SECRET;
    const environnementInitial = process.env.NODE_ENV;
    delete process.env.COOKIE_SECRET;
    process.env.NODE_ENV = 'production';
    const creerApplication = jest.spyOn(NestFactory, 'create');

    try {
      await expect(demarrerApplication()).rejects.toThrow('COOKIE_SECRET doit contenir');
      expect(creerApplication).not.toHaveBeenCalled();
    } finally {
      if (secretInitial === undefined) delete process.env.COOKIE_SECRET;
      else process.env.COOKIE_SECRET = secretInitial;
      if (environnementInitial === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environnementInitial;
    }
  });

  it('exige un SESSION_SECRET independant en production', async () => {
    const cookieInitial = process.env.COOKIE_SECRET;
    const sessionInitial = process.env.SESSION_SECRET;
    const environnementInitial = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SECRET = 'cookie-secret-production-de-plus-de-32-caracteres';
    delete process.env.SESSION_SECRET;
    const creerApplication = jest.spyOn(NestFactory, 'create');

    try {
      await expect(demarrerApplication()).rejects.toThrow('SESSION_SECRET doit etre defini');
      expect(creerApplication).not.toHaveBeenCalled();
    } finally {
      if (cookieInitial === undefined) delete process.env.COOKIE_SECRET;
      else process.env.COOKIE_SECRET = cookieInitial;
      if (sessionInitial === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = sessionInitial;
      if (environnementInitial === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environnementInitial;
    }
  });

  it('avertit si NODE_ENV est absent et genere deux cles locales independantes', async () => {
    const secretInitial = process.env.COOKIE_SECRET;
    const sessionInitial = process.env.SESSION_SECRET;
    const environnementInitial = process.env.NODE_ENV;
    process.env.COOKIE_SECRET = 'dashboard_cookie_secret_for_local_development';
    delete process.env.SESSION_SECRET;
    delete process.env.NODE_ENV;
    const avertir = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    construireRouteur.mockReturnValue('routeur-admin');
    jest.spyOn(NestFactory, 'create').mockResolvedValue({
      getHttpAdapter: () => ({ getInstance: () => ({ use: jest.fn() }) }),
      listen: jest.fn().mockResolvedValue(undefined),
    } as never);

    try {
      await demarrerApplication();
    } finally {
      if (secretInitial === undefined) delete process.env.COOKIE_SECRET;
      else process.env.COOKIE_SECRET = secretInitial;
      if (sessionInitial === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = sessionInitial;
      if (environnementInitial === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environnementInitial;
    }

    const [, optionsAuthentification, , optionsSession] = construireRouteur.mock.calls[0];
    const motDePasseCookie = (optionsAuthentification as { cookiePassword: string }).cookiePassword;
    const secretSession = (optionsSession as { secret: string }).secret;
    expect(avertir).toHaveBeenCalledWith(
      expect.stringContaining('NODE_ENV absent'),
      'Dashboard',
    );
    expect(motDePasseCookie).not.toBe('dashboard_cookie_secret_for_local_development');
    expect(motDePasseCookie).toHaveLength(64);
    expect(secretSession).toHaveLength(64);
    expect(secretSession).not.toBe(motDePasseCookie);
  });

  it('conserve les secrets configures en developpement local', () => {
    const cookie = 'cookie-secret-local-de-plus-de-32-caracteres';
    const session = 'session-secret-local-de-plus-de-32-caracteres';

    expect(resoudreSecrets({ NODE_ENV: 'development', COOKIE_SECRET: cookie, SESSION_SECRET: session }))
      .toEqual({ secretCookie: cookie, secretSession: session });
  });

  it('refuse la valeur locale de l Infra en production', () => {
    expect(() => resoudreSecrets({
      NODE_ENV: 'production',
      COOKIE_SECRET: 'dashboard_cookie_secret_for_local_development',
      SESSION_SECRET: 'session-secret-production-de-plus-de-32-caracteres',
    })).toThrow('COOKIE_SECRET doit contenir');
  });
});
