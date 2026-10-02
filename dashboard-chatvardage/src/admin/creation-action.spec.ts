import AdminJS, { ViewHelpers, type ActionContext } from 'adminjs';
import { jest } from '@jest/globals';

import { ressourceUtilisateurs } from './resources/utilisateurs.js';

const jeton = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbi0xIn0.c2lnbmF0dXJlLWRlLXRlc3Q';

const creer = async (role = 'user') => {
  const admin = new AdminJS({ resources: [ressourceUtilisateurs] });
  const resource = admin.findResource('utilisateurs');
  const action = resource.decorate().actions.new;
  const contexte = {
    _admin: admin,
    resource,
    action,
    h: new ViewHelpers({ options: admin.options }),
    currentAdmin: { email: 'admin@test.ca', jeton },
  } as ActionContext;
  return action.handler({
    method: 'post',
    params: { resourceId: 'utilisateurs', action: 'new' },
    payload: {
      pseudo: 'alice', courriel: 'alice@test.ca', mot_de_passe: 'motdepasse123', role,
    },
  }, {}, contexte);
};

describe('Creation AdminJS avec le vrai gestionnaire d action', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    ressourceUtilisateurs.resource.viderCache();
  });

  it.each([400, 409, 422])('affiche une erreur et conserve le formulaire pour HTTP %s', async (status) => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status, json: async () => ({ erreur: 'Ce courriel est deja utilise' }),
    } as Response);
    const resultat = await creer();
    expect(resultat.notice).toEqual({ type: 'error', message: 'Ce courriel est deja utilise' });
    expect(resultat.redirectUrl).toBeUndefined();
    expect(resultat.record.params.courriel).toBe('alice@test.ca');
  });

  it('affiche une erreur de champ sans succes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 400, json: async () => ({ erreur: 'mot_de_passe: trop court' }),
    } as Response);
    const resultat = await creer();
    expect(resultat.notice.type).toBe('error');
    expect(resultat.record.errors.mot_de_passe.message).toBe('trop court');
  });

  it('signale la creation partielle si la promotion admin echoue', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true, status: 201, json: async () => ({ id: 'alice', role: 'utilisateur' }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ erreur: 'Indisponible' }) } as Response);
    const resultat = await creer('admin');
    expect(resultat.notice.type).toBe('error');
    expect(resultat.notice.message).toContain('cree comme utilisateur standard');
    expect(resultat.redirectUrl).toBeUndefined();
  });

  it('annonce le succes uniquement apres une creation reussie', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 201, json: async () => ({ id: 'alice', role: 'utilisateur' }),
    } as Response);
    const resultat = await creer();
    expect(resultat.notice.type).toBe('success');
    expect(resultat.record.id).toBe('alice');
    expect(resultat.redirectUrl).toBeDefined();
  });
});
