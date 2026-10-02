import { RessourceApiDistante } from '../remote-api-resource.js';

import {
  cheminListeServeurs, cheminServeurs, chargerTousLesServeurs, optionsRessource,
} from './commun.js';

export const ressourceServeurs = {
  resource: new RessourceApiDistante({
    id: 'serveurs',
    cheminListe: cheminListeServeurs,
    cheminCreation: cheminServeurs,
    cheminSuppression: (id) => `${cheminServeurs}/${encodeURIComponent(id)}`,
    champsFiltrables: ['name', 'visibility'],
    champsFiltrablesExacts: ['visibility'],
    chargerEnregistrements: chargerTousLesServeurs(cheminListeServeurs),
    transformerCreation: ({ name, visibility }) => ({
      nom: name,
      public: visibility === 'public',
    }),
    transformerLecture: ({
      nom, public: estPublic, nombreMembres, ...serveur
    }) => ({
      ...serveur,
      name: nom,
      visibility: estPublic ? 'public' : 'private',
      memberCount: nombreMembres,
    }),
    champs: [
      { path: 'id', type: 'uuid', isId: true },
      { path: 'name', type: 'string', isSortable: true },
      { path: 'visibility', type: 'string', isSortable: true },
      { path: 'memberCount', type: 'string', isSortable: true },
    ],
  }),
  options: optionsRessource(
    'Serveurs',
    ['name', 'visibility', 'memberCount'],
    ['name', 'visibility'],
    ['name', 'visibility'],
    {
      id: { label: 'Identifiant' },
      name: { label: 'Nom', isRequired: true, isTitle: true },
      visibility: {
        label: 'Visibilite',
        isRequired: true,
        availableValues: [
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Prive' },
        ],
      },
      memberCount: { label: 'Membres' },
    },
    'name',
  ),
};
