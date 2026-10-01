import { RessourceApiDistante } from '../remote-api-resource.js';

import { optionsRessource, urlDuService } from './commun.js';

export const normaliserRole = (role: string): string => {
  const valeur = role.trim().toLowerCase();
  if (valeur === 'user' || valeur === 'utilisateur') return 'user';
  if (valeur === 'admin' || valeur === 'administrateur') return 'admin';
  return valeur;
};

export const normaliserChampUtilisateur = (champ: string, valeur: string): string => (
  champ === 'role' ? normaliserRole(valeur) : valeur
);

const cheminUtilisateurs = urlDuService('AUTH_SERVICE_URL', 'http://localhost:3001', '/api/users');

export const ressourceUtilisateurs = {
  resource: new RessourceApiDistante({
    id: 'utilisateurs',
    cheminListe: cheminUtilisateurs,
    cheminCreation: cheminUtilisateurs,
    cheminSuppression: (id) => `${cheminUtilisateurs}/${encodeURIComponent(id)}`,
    champsFiltrables: ['pseudo', 'courriel', 'role'],
    champsFiltrablesExacts: ['role'],
    normaliserChamp: normaliserChampUtilisateur,
    transformerLecture: (utilisateur) => (typeof utilisateur.role === 'string'
      ? { ...utilisateur, role: normaliserRole(utilisateur.role) }
      : utilisateur),
    champs: [
      { path: 'id', type: 'uuid', isId: true },
      { path: 'pseudo', type: 'string', isSortable: true },
      { path: 'courriel', type: 'string', isSortable: true },
      { path: 'mot_de_passe', type: 'password' },
      { path: 'role', type: 'string', isSortable: true },
      { path: 'cree_le', type: 'datetime', isSortable: true },
      { path: 'modifie_le', type: 'datetime', isSortable: true },
    ],
  }),
  options: optionsRessource(
    'Utilisateurs',
    ['pseudo', 'courriel', 'role', 'cree_le'],
    ['pseudo', 'courriel', 'mot_de_passe', 'role'],
    ['pseudo', 'courriel', 'role'],
    {
      id: { label: 'Identifiant' },
      pseudo: { label: 'Pseudonyme', isRequired: true, isTitle: true },
      courriel: { label: 'Courriel', isRequired: true },
      mot_de_passe: {
        label: 'Mot de passe',
        isRequired: true,
        description: 'Entre 8 et 128 caracteres (valide par le service Authentification).',
      },
      role: {
        label: 'Role',
        isRequired: true,
        availableValues: [
          { value: 'user', label: 'Utilisateur' },
          { value: 'admin', label: 'Administrateur' },
        ],
      },
      cree_le: { label: 'Cree le' },
      modifie_le: { label: 'Modifie le' },
    },
    'pseudo',
  ),
};
