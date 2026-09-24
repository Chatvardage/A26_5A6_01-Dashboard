import type { AdminJSOptions } from 'adminjs';

import chargeurComposants from './component-loader.js';
import {
  type ChargeurEnregistrements,
  RessourceApiDistante,
} from './remote-api-resource.js';

const urlDuService = (
  variable: string,
  valeurParDefaut: string,
  chemin: string,
): string => `${(process.env[variable] ?? valeurParDefaut).replace(/\/$/, '')}${chemin}`;

type PageServeurs = {
  serveurs: Record<string, unknown>[];
  suivant: number | null;
};

const chargerPageServeurs = async (
  requete: <T>(chemin: string) => Promise<T>,
  chemin: string,
  decalage = 0,
): Promise<Record<string, unknown>[]> => {
  const page = await requete<PageServeurs>(`${chemin}?decalage=${decalage}&limite=100`);
  if (page.suivant === null) return page.serveurs;

  const autresServeurs = await chargerPageServeurs(requete, chemin, page.suivant);
  return [...page.serveurs, ...autresServeurs];
};

const chargerTousLesServeurs = (chemin: string): ChargeurEnregistrements => {
  const charger = async (requete: Parameters<ChargeurEnregistrements>[0]) => chargerPageServeurs(requete, chemin);
  return charger;
};

const chargerTousLesSalons = (
  cheminListeServeurs: string,
  cheminServeurs: string,
): ChargeurEnregistrements => async (requete) => {
  const serveurs = await chargerTousLesServeurs(cheminListeServeurs)(requete);
  const details = await Promise.all(
    serveurs.map((serveur) => requete<Record<string, unknown>>(`${cheminServeurs}/${serveur.id}`)),
  );

  return details.flatMap((serveur) => {
    const salons = Array.isArray(serveur.salons) ? serveur.salons : [];
    return salons
      .filter((salon): salon is Record<string, unknown> => typeof salon === 'object' && salon !== null)
      .map((salon) => ({ ...salon, serverId: serveur.id, serverName: serveur.nom }));
  });
};

export const optionsRessource = (
  nom: string,
  colonnes: string[],
  champsCreation: string[],
  champsFiltre: string[],
  proprietes?: Record<string, object>,
  proprieteTitre?: string,
  champsDetails?: string[],
  peutCreer?: boolean,
) => ({
  navigation: { name: 'Gestion', icon: 'View' },
  listProperties: colonnes,
  showProperties: champsDetails ?? colonnes,
  editProperties: champsCreation,
  filterProperties: champsFiltre,
  properties: proprietes ?? {},
  titleProperty: proprieteTitre,
  actions: {
    new: { isVisible: peutCreer ?? true },
    edit: { isVisible: false },
    bulkDelete: { isVisible: false },
  },
  label: nom,
});

const cheminListeServeurs = urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', '/api/admin/servers');
const cheminServeurs = urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', '/api/servers');

const options: AdminJSOptions = {
  componentLoader: chargeurComposants,
  rootPath: '/administration',
  loginPath: '/administration/login',
  branding: {
    companyName: 'ChatVardage',
  },
  locale: {
    language: 'fr',
    fallbackLng: 'en',
    translations: {
      fr: {
        actions: {
          new: 'Nouveau',
          show: 'Afficher',
          list: 'Liste',
          delete: 'Supprimer',
        },
        buttons: {
          save: 'Enregistrer',
          addNewItem: 'Ajouter un element',
          cancel: 'Annuler',
          filter: 'Filtrer',
          filterActive: 'Filtrer ({{count}})',
          applyChanges: 'Appliquer',
          resetFilter: 'Reinitialiser',
          logout: 'Deconnexion',
          login: 'Connexion',
          createFirstRecord: 'Creer le premier element',
          confirm: 'Confirmer',
        },
        labels: {
          navigation: 'Navigation',
          pages: 'Pages',
          selectedRecords: 'Selectionnes ({{selected}})',
          filters: 'Filtres',
          dashboard: 'Tableau de bord',
        },
        messages: {
          successfullyDeleted: 'Element supprime avec succes',
          successfullyUpdated: 'Element modifie avec succes',
          successfullyCreated: 'Element cree avec succes',
          thereWereValidationErrors: 'Des erreurs de validation sont presentes',
          errorFetchingRecords: 'Impossible de charger les elements',
          errorFetchingRecord: 'Impossible de charger cet element',
          noRecordsInResource: 'Aucun element dans cette ressource',
          noRecords: 'Aucun element',
          confirmDelete: 'Voulez-vous vraiment supprimer cet element?',
          welcomeOnBoard_title: 'Bienvenue dans ChatVardage!',
          welcomeOnBoard_subtitle: 'Gerez les utilisateurs, les salons et les messages.',
          addingResources_title: 'Ressources',
          addingResources_subtitle: 'Accedez aux ressources dans la navigation.',
          customizeResources_title: 'Gestion des ressources',
          customizeResources_subtitle: 'Consultez et filtrez les donnees disponibles.',
          customizeActions_title: 'Actions',
          customizeActions_subtitle: 'Creez et supprimez les elements autorises.',
          writeOwnComponents_title: 'Utilisateurs',
          writeOwnComponents_subtitle: 'Gerez les comptes de clavardage.',
          customDashboard_title: 'Salons',
          customDashboard_subtitle: 'Gerez les salons publics et prives.',
          roleBasedAccess_title: 'Messages',
          roleBasedAccess_subtitle: 'Consultez et gerez les messages.',
        },
      },
    },
  },
  resources: [
    {
      resource: new RessourceApiDistante({
        id: 'utilisateurs',
        cheminListe: urlDuService('AUTH_SERVICE_URL', 'http://localhost:3001', '/api/users'),
        cheminCreation: urlDuService('AUTH_SERVICE_URL', 'http://localhost:3001', '/api/users'),
        cheminSuppression: (id) => urlDuService('AUTH_SERVICE_URL', 'http://localhost:3001', `/api/users/${id}`),
        champsFiltrables: ['pseudo', 'courriel', 'role'],
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
            props: { minLength: 8, maxLength: 128 },
            description: 'Entre 8 et 128 caracteres.',
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
    },
    {
      resource: new RessourceApiDistante({
        id: 'serveurs',
        cheminListe: cheminListeServeurs,
        cheminCreation: cheminServeurs,
        cheminSuppression: (id) => `${cheminServeurs}/${id}`,
        champsFiltrables: ['name', 'visibility'],
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
    },
    {
      resource: new RessourceApiDistante({
        id: 'salons',
        cheminListe: cheminListeServeurs,
        cheminCreation: ({ serverId }) => `${cheminServeurs}/${serverId}/channels`,
        cheminSuppression: (id) => urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', `/api/channels/${id}`),
        champsFiltrables: ['serverId', 'serverName', 'name', 'access', 'writing'],
        chargerEnregistrements: chargerTousLesSalons(cheminListeServeurs, cheminServeurs),
        transformerCreation: ({ name, access, writing }) => ({
          nom: name,
          acces: access,
          ecriture: writing,
        }),
        transformerLecture: ({
          nom, acces, ecriture, creePar, ...salon
        }) => ({
          ...salon,
          name: nom,
          access: acces,
          writing: ecriture,
          createdBy: creePar,
        }),
        champs: [
          { path: 'id', type: 'uuid', isId: true },
          { path: 'serverId', type: 'uuid' },
          { path: 'name', type: 'string', isSortable: true },
          { path: 'serverName', type: 'string', isSortable: true },
          { path: 'access', type: 'string', isSortable: true },
          { path: 'writing', type: 'string', isSortable: true },
          { path: 'position', type: 'string', isSortable: true },
        ],
      }),
      options: optionsRessource(
        'Salons',
        ['name', 'serverName', 'access', 'writing', 'position'],
        ['serverId', 'name', 'access', 'writing'],
        ['serverId', 'serverName', 'name', 'access', 'writing'],
        {
          id: { label: 'Identifiant' },
          name: { label: 'Nom', isRequired: true },
          serverId: {
            label: 'Serveur',
            isRequired: true,
            reference: 'serveurs',
            isVisible: { list: false, show: true, edit: true },
          },
          serverName: { label: 'Serveur' },
          access: {
            label: 'Acces',
            isRequired: true,
            availableValues: [
              { value: 'tous', label: 'Tous' },
              { value: 'moderateurs', label: 'Moderateurs' },
            ],
          },
          writing: {
            label: 'Ecriture',
            isRequired: true,
            availableValues: [
              { value: 'tous', label: 'Tous' },
              { value: 'moderateurs', label: 'Moderateurs' },
            ],
          },
          position: { label: 'Position' },
          createdBy: { label: 'Cree par' },
        },
        'name',
        ['name', 'serverName', 'access', 'writing', 'position', 'createdBy'],
      ),
    },
    {
      resource: new RessourceApiDistante({
        id: 'messages',
        cheminListe: urlDuService(
          'MESSAGE_SERVICE_URL',
          'http://localhost:3004',
          '/api/messages/admin',
        ),
        cheminCreation: urlDuService(
          'MESSAGE_SERVICE_URL',
          'http://localhost:3004',
          '/api/messages/admin',
        ),
        cheminSuppression: (id) => urlDuService(
          'MESSAGE_SERVICE_URL',
          'http://localhost:3004',
          `/api/messages/admin/${id}`,
        ),
        champsFiltrables: ['recipientId', 'senderId'],
        transformerCreation: ({ senderId, recipientId, content }) => ({ senderId, recipientId, content }),
        champs: [
          { path: 'id', type: 'uuid', isId: true },
          { path: 'senderId', type: 'uuid', isSortable: true },
          { path: 'recipientId', type: 'uuid', isSortable: true },
          { path: 'content', type: 'textarea' },
          { path: 'apercu', type: 'string' },
          { path: 'createdAt', type: 'datetime', isSortable: true },
          { path: 'updatedAt', type: 'datetime', isSortable: true },
        ],
      }),
      options: optionsRessource(
        'Messages',
        ['senderId', 'recipientId', 'apercu', 'createdAt'],
        ['senderId', 'recipientId', 'content'],
        ['recipientId', 'senderId'],
        {
          id: { label: 'Identifiant' },
          senderId: {
            label: 'Expediteur',
            isRequired: true,
            reference: 'utilisateurs',
          },
          recipientId: { label: 'Destinataire', isRequired: true, reference: 'utilisateurs' },
          content: { label: 'Contenu', isRequired: true },
          apercu: {
            label: 'Apercu',
            isTitle: true,
            isVisible: { show: false, edit: false, filter: false },
          },
          createdAt: { label: 'Cree le' },
          updatedAt: { label: 'Modifie le' },
        },
        'apercu',
        ['senderId', 'recipientId', 'content', 'createdAt'],
      ),
    },
  ],
  databases: [],
};

export default options;
