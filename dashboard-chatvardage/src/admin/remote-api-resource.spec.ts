import { jest } from '@jest/globals';

import { RessourceApiDistante } from './remote-api-resource.js';

describe('RessourceApiDistante', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('relaye la creation au service proprietaire avec le jeton administrateur', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'message-1', content: 'Bonjour' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: ['senderId', 'recipientId'],
      transformerApercu: (message) => ({ ...message, apercu: String(message.content ?? '') }),
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { senderId: 'user-1', recipientId: 'user-2', content: 'Bonjour' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).resolves.toEqual({ id: 'message-1', content: 'Bonjour', apercu: 'Bonjour' });

    expect(fetchMock).toHaveBeenCalledWith('http://messages.test/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jeton-admin',
      },
      body: JSON.stringify({ senderId: 'user-1', recipientId: 'user-2', content: 'Bonjour' }),
    });
  });

  it('filtre et compte les seuls champs autorises', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'message-1', senderId: 'utilisateur-1', recipientId: 'utilisateur-2' },
        { id: 'message-2', senderId: 'utilisateur-3', recipientId: 'utilisateur-1' },
      ],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: ['senderId', 'recipientId'],
      champs: [{ path: 'id', type: 'uuid', isId: true }, { path: 'senderId', type: 'uuid' }],
    });
    const filtre = { filters: { senderId: { value: 'utilisateur-3' }, id: { value: 'message-1' } } };
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.count(filtre, contexte)).resolves.toBe(1);
    await expect(ressource.find(filtre, {}, contexte)).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retourne une erreur de validation au champ indique par le service', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'mot_de_passe: le mot de passe doit contenir entre 8 et 128 caracteres' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: ['id', 'pseudo', 'courriel', 'role'],
      champs: [
        { path: 'id', type: 'uuid', isId: true },
        { path: 'mot_de_passe', type: 'password' },
      ],
    });

    await expect(ressource.create(
      { pseudo: 'eva', mot_de_passe: 'court' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).rejects.toMatchObject({
      statusCode: 400,
      propertyErrors: {
        mot_de_passe: { message: 'le mot de passe doit contenir entre 8 et 128 caracteres' },
      },
    });
  });

  it('garde les messages avec deux-points dans les erreurs generales', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Service indisponible depuis 12:30' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { pseudo: 'eva' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).rejects.toThrow('Service indisponible depuis 12:30');
  });

  it('traite les 400 sans champ connu comme une erreur generale de formulaire', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'champInconnu: valeur invalide' }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'La valeur est invalide' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.create({ pseudo: 'Eva' }, contexte)).rejects.toMatchObject({
      baseError: { message: 'champInconnu: valeur invalide' },
    });
    await expect(ressource.create({ pseudo: 'Eva' }, contexte)).rejects.toMatchObject({
      baseError: { message: 'La valeur est invalide' },
    });
  });

  it('utilise le champ erreur ou le statut si le corps HTTP est incomplet', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ erreur: 'Maintenance' }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new Error('Corps absent'); },
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.find({}, {}, contexte)).rejects.toThrow('Maintenance');
    await expect(ressource.find({}, {}, contexte)).rejects.toThrow('Le service distant a retourne 502.');
  });

  it('propage les erreurs reseau de creation sans les convertir en validation', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { pseudo: 'eva' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).rejects.toBeInstanceOf(TypeError);
  });

  it('propage le 401 de creation comme une session expiree', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { pseudo: 'eva' },
      { currentAdmin: { jeton: 'jeton-expire' } },
    )).rejects.toThrow('La session administrateur a expire. Reconnectez-vous.');
  });

  it('invalide le cache de lecture apres une creation', async () => {
    let appelsListe = 0;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, initialisation) => {
      if (initialisation?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ id: 'utilisateur-2' }) } as Response;
      }
      appelsListe += 1;
      return {
        ok: true,
        status: 200,
        json: async () => (appelsListe === 1 ? [{ id: 'utilisateur-1' }] : [
          { id: 'utilisateur-1' }, { id: 'utilisateur-2' },
        ]),
      } as Response;
    });
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.count({}, contexte)).resolves.toBe(1);
    await ressource.create({ pseudo: 'Alex' }, contexte);
    await expect(ressource.count({}, contexte)).resolves.toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('identifie une session administrateur expiree sur une reponse 401', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-expire' } }))
      .rejects.toThrow('La session administrateur a expire. Reconnectez-vous.');
  });

  it('envoie l expediteur choisi a la route de creation administrateur', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'message-1', senderId: 'utilisateur-1' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages/admin',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      transformerCreation: ({ senderId, recipientId, content }) => ({ senderId, recipientId, content }),
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { senderId: 'utilisateur-1', recipientId: 'utilisateur-2', content: 'Bonjour' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).resolves.toMatchObject({ id: 'message-1', senderId: 'utilisateur-1' });

    expect(fetchMock).toHaveBeenCalledWith('http://messages.test/api/messages/admin', expect.objectContaining({
      body: JSON.stringify({
        senderId: 'utilisateur-1',
        recipientId: 'utilisateur-2',
        content: 'Bonjour',
      }),
    }));
  });

  it('ajoute un apercu compact au message pour la liste', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'message-1', content: 'Bonjour\n  tout le monde' }],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages/admin',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      transformerApercu: (message) => {
        const contenuCompact = String(message.content ?? '').replace(/\s+/g, ' ').trim();
        return {
          ...message,
          apercu: contenuCompact.length > 120 ? `${contenuCompact.slice(0, 120)}...` : contenuCompact,
        };
      },
      champs: [
        { path: 'id', type: 'uuid', isId: true },
        { path: 'content', type: 'textarea' },
        { path: 'apercu', type: 'string' },
      ],
    });

    const [message] = await ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } });

    expect(message.params).toMatchObject({
      content: 'Bonjour\n  tout le monde',
      apercu: 'Bonjour tout le monde',
    });
  });

  it('cree un salon dans le serveur selectionne', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'salon-1', nom: 'general', acces: 'tous', ecriture: 'moderateurs',
      }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'salons',
      cheminListe: 'http://salons.test/api/admin/servers',
      cheminCreation: ({ serverId }) => `http://salons.test/api/servers/${serverId}/channels`,
      cheminSuppression: (id) => `http://salons.test/api/channels/${id}`,
      champsFiltrables: [],
      transformerCreation: ({ name, access, writing }) => ({
        nom: name,
        acces: access,
        ecriture: writing,
      }),
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      {
        serverId: 'serveur-1', name: 'general', access: 'tous', writing: 'moderateurs',
      },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).resolves.toMatchObject({ id: 'salon-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://salons.test/api/servers/serveur-1/channels',
      expect.objectContaining({
        body: JSON.stringify({ nom: 'general', acces: 'tous', ecriture: 'moderateurs' }),
      }),
    );
  });

  it('transforme la reponse de salon pour les colonnes du tableau de bord', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{
        id: 'salon-1', nom: 'general', visibilite: 'prive', hoteId: 'admin-1',
      }],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'salons',
      cheminListe: 'http://salons.test/api/admin/rooms',
      cheminCreation: 'http://salons.test/api/rooms',
      cheminSuppression: (id) => `http://salons.test/api/rooms/${id}`,
      champsFiltrables: [],
      transformerLecture: ({
        nom, visibilite, hoteId, ...salon
      }) => ({
        ...salon,
        name: nom,
        visibility: visibilite === 'prive' ? 'private' : visibilite,
        ownerId: hoteId,
      }),
      champs: [
        { path: 'id', type: 'uuid', isId: true },
        { path: 'name', type: 'string' },
        { path: 'visibility', type: 'string' },
        { path: 'ownerId', type: 'uuid' },
      ],
    });

    const [salon] = await ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } });

    expect(salon.params).toMatchObject({
      id: 'salon-1',
      name: 'general',
      visibility: 'private',
      ownerId: 'admin-1',
    });
  });

  it('charge des enregistrements derives avec une requete authentifiee', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ serveurs: [{ id: 'serveur-1' }] }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'salons',
      cheminListe: 'http://salons.test/api/admin/servers',
      cheminCreation: 'http://salons.test/api/servers',
      cheminSuppression: (id) => `http://salons.test/api/channels/${id}`,
      champsFiltrables: [],
      chargerEnregistrements: async (requete) => {
        const reponse = await requete<{ serveurs: Array<{ id: string }> }>(
          'http://salons.test/api/admin/servers?limite=100',
        );
        return reponse.serveurs.map((serveur) => ({ id: `${serveur.id}-salon` }));
      },
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } }))
      .resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://salons.test/api/admin/servers?limite=100',
      expect.objectContaining({ headers: { Authorization: 'Bearer jeton-admin' } }),
    );
  });

  it('refuse un succes sans identifiant de creation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ message: 'Operation acceptee' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      transformerApercu: (message) => {
        const contenuCompact = String(message.content ?? '').replace(/\s+/g, ' ').trim();
        return {
          ...message,
          apercu: contenuCompact.length > 120 ? `${contenuCompact.slice(0, 120)}...` : contenuCompact,
        };
      },
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { recipientId: 'utilisateur-1', content: 'Bonjour' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).rejects.toThrow('Le service n a pas retourne l identifiant de l element cree.');
  });

  it('normalise les roles historiques pour le filtre', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'utilisateur-1', role: 'utilisateur' },
        { id: 'administrateur-1', role: 'ADMINISTRATEUR' },
        { id: 'moderateur-1', role: 'moderateur' },
      ],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: ['role'],
      champs: [{ path: 'id', type: 'uuid', isId: true }, { path: 'role', type: 'string' }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.count({ filters: { role: { value: 'user' } } }, contexte)).resolves.toBe(1);
    await expect(ressource.count({ filters: { role: { value: 'admin' } } }, contexte)).resolves.toBe(1);
    await expect(ressource.count({ filters: { role: { value: 'moderateur' } } }, contexte)).resolves.toBe(1);
  });

  it('trie, pagine et retrouve les enregistrements demandes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: '3', nom: 'Charlie' },
        { id: '1', nom: 'Alpha' },
        { id: '2', nom: 'Bravo' },
      ],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'serveurs',
      cheminListe: 'http://serveurs.test/api/servers',
      cheminCreation: 'http://serveurs.test/api/servers',
      cheminSuppression: (id) => `http://serveurs.test/api/servers/${id}`,
      champsFiltrables: ['nom'],
      champs: [
        { path: 'id', type: 'uuid', isId: true },
        { path: 'nom', type: 'string' },
      ],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    const enregistrements = await ressource.find({}, {
      offset: 1,
      limit: 1,
      sort: { sortBy: 'nom', direction: 'asc' },
    }, contexte);

    expect(ressource.databaseName()).toBe('ChatVardage');
    expect(ressource.id()).toBe('serveurs');
    expect(ressource.properties()).toHaveLength(2);
    expect(ressource.property('nom')?.path()).toBe('nom');
    expect(ressource.property('inconnu')).toBeNull();
    expect(enregistrements[0].params).toMatchObject({ id: '2', nom: 'Bravo' });
    await expect(ressource.findOne('1', contexte)).resolves.toMatchObject({ params: { nom: 'Alpha' } });
    await expect(ressource.findOne('inconnu', contexte)).resolves.toBeNull();
    await expect(ressource.findMany(['1', 3], contexte)).resolves.toHaveLength(2);
  });

  it('supprime avec le jeton administrateur et gere les reponses sans contenu', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => undefined,
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'serveurs',
      cheminListe: 'http://serveurs.test/api/servers',
      cheminCreation: 'http://serveurs.test/api/servers',
      cheminSuppression: (id) => `http://serveurs.test/api/servers/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.delete('serveur-1', { currentAdmin: { jeton: 'jeton-admin' } })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('http://serveurs.test/api/servers/serveur-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer jeton-admin' },
    });
    await expect(ressource.update()).rejects.toThrow('La modification est geree par le service proprietaire.');
  });

  it('refuse de supprimer un enregistrement dependant introuvable', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages/admin',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      suppressionDependanteEnregistrement: true,
      champsFiltrables: [],
      chargerEnregistrements: async () => [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.delete('message-absent', { currentAdmin: { jeton: 'jeton-admin' } }))
      .rejects.toThrow('Element introuvable pour la suppression.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse une session absente avant d appeler le service', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const ressource = new RessourceApiDistante({
      id: 'serveurs',
      cheminListe: 'http://serveurs.test/api/servers',
      cheminCreation: 'http://serveurs.test/api/servers',
      cheminSuppression: (id) => `http://serveurs.test/api/servers/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.find({}, {})).rejects.toThrow('Session administrateur invalide. Reconnectez-vous.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse un jeton contenant des retours de ligne avant la requete HTTP', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.find({}, {}, {
      currentAdmin: { jeton: 'header.payload.signature\r\nX-Injected: true' },
    })).rejects.toThrow('Session administrateur invalide. Reconnectez-vous.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse une virgule dans le jeton Bearer', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.find({}, {}, { currentAdmin: { jeton: 'header,payload.signature' } }))
      .rejects.toThrow('Session administrateur invalide. Reconnectez-vous.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tronque l apercu des messages longs', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'message-1', content: 'a'.repeat(121) }],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages/admin',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      transformerApercu: (message) => {
        const contenuCompact = String(message.content ?? '').replace(/\s+/g, ' ').trim();
        return {
          ...message,
          apercu: contenuCompact.length > 120 ? `${contenuCompact.slice(0, 120)}...` : contenuCompact,
        };
      },
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    const [message] = await ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } });

    expect(message.params.apercu).toBe(`${'a'.repeat(120)}...`);
  });

  it('gere les filtres invalides, les identifiants et les erreurs sans corps JSON', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'utilisateur-1', pseudo: 'Eva' },
        { id: 'utilisateur-2', pseudo: 'Alex' },
      ],
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'utilisateur-1', pseudo: 'Eva' },
        { id: 'utilisateur-2', pseudo: 'Alex' },
      ],
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new Error('Corps absent'); },
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: ['id', 'pseudo'],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.find({ filters: { pseudo: { value: 12 } } }, {}, contexte))
      .resolves.toHaveLength(2);
    await expect(ressource.find(
      { filters: { id: { value: 'utilisateur-2' } } },
      {},
      { currentAdmin: { jeton: 'autre-jeton-admin' } },
    ))
      .resolves.toHaveLength(1);
    await expect(ressource.create({ pseudo: 'Eva' }, contexte))
      .rejects.toThrow('Le service distant a retourne 502.');
  });

  it('gere les valeurs nulles, le tri descendant et les erreurs non standard', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const enregistrements = [
      { id: 'utilisateur-1', pseudo: null },
      { id: 'utilisateur-2', pseudo: 'Beta' },
    ];
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => enregistrements } as Response);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => enregistrements } as Response);
    fetchMock.mockRejectedValueOnce('Service indisponible');
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: ['pseudo'],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.find({ filters: { pseudo: { value: 'absent' } } }, {}, contexte))
      .resolves.toHaveLength(0);
    await expect(ressource.find({}, { sort: { sortBy: 'pseudo', direction: 'desc' } }, contexte))
      .resolves.toHaveLength(2);
    await expect(ressource.create({ pseudo: 'Eva' }, contexte))
      .rejects.toThrow('Le service n a pas retourne l identifiant de l element cree.');
  });
});
