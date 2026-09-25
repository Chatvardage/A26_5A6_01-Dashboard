import { jest } from '@jest/globals';
import { NestFactory } from '@nestjs/core';

const construireRouteur = jest.fn();
const lireFichier = jest.fn();
jest.unstable_mockModule('@adminjs/express', () => ({
  default: { buildAuthenticatedRouter: construireRouteur },
}));
jest.unstable_mockModule('node:fs/promises', () => ({ readFile: lireFichier }));

const { authentifierAdministrateur, démarrerApplication } = await import('./main.js');

describe('Point d entree de l application', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    construireRouteur.mockClear();
    lireFichier.mockReset();
  });

  it('authentifie un administrateur avec les informations du service', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        jeton: 'jeton-admin',
        utilisateur: {
          id: 'admin-1', pseudo: 'Eva', courriel: 'eva@example.test', role: 'admin',
        },
      }),
    } as Response);

    await expect(authentifierAdministrateur('eva@example.test', 'mot-de-passe'))
      .resolves.toEqual({
        id: 'admin-1', email: 'eva@example.test', title: 'Eva', jeton: 'jeton-admin',
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
        jeton: 'jeton-utilisateur',
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
    delete process.env.PORT;
    delete process.env.COOKIE_SECRET;
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        jeton: 'jeton-admin',
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
      await démarrerApplication();
    } finally {
      if (portInitial === undefined) delete process.env.PORT;
      else process.env.PORT = portInitial;
      if (secretInitial === undefined) delete process.env.COOKIE_SECRET;
      else process.env.COOKIE_SECRET = secretInitial;
    }

    expect(construireRouteur).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cookieName: 'chatvardage-admin' }),
      expect.anything(),
      expect.objectContaining({
        resave: false,
        saveUninitialized: false,
        secret: 'dashboard_cookie_secret_for_local_development',
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
  });

  it('sert le bundle des composants et transmet les erreurs de lecture', async () => {
    const utiliser = jest.fn();
    const ecouter = jest.fn().mockResolvedValue(undefined);
    const reponse = { type: jest.fn().mockReturnThis(), send: jest.fn() };
    const suivant = jest.fn();
    construireRouteur.mockReturnValue('routeur-admin');
    jest.spyOn(NestFactory, 'create').mockResolvedValue({
      getHttpAdapter: () => ({ getInstance: () => ({ use: utiliser }) }),
      listen: ecouter,
    } as never);

    await démarrerApplication();
    const routeurHttp = construireRouteur.mock.calls[0][2] as unknown as {
      stack: Array<{
        route?: {
          path: string;
          stack: Array<{ handle: (requete: unknown, reponse: unknown, suivant: unknown) => unknown }>;
        };
      }>;
    };
    const handler = routeurHttp.stack.find(
      (couche) => couche.route?.path === '/frontend/assets/components.bundle.js',
    )?.route?.stack[0].handle;

    lireFichier.mockResolvedValue('bundle');
    await handler?.({}, reponse, suivant);
    expect(reponse.type).toHaveBeenCalledWith('application/javascript');
    expect(reponse.send).toHaveBeenCalledWith('bundle');

    const erreur = new Error('Bundle introuvable');
    lireFichier.mockRejectedValue(erreur);
    await handler?.({}, reponse, suivant);
    expect(suivant).toHaveBeenCalledWith(erreur);
  });
});
