import { type AdminJSOptions } from 'adminjs';

import chargeurComposants from './component-loader.js';
import { ressourceMessages } from './resources/messages.js';
import { ressourceSalons } from './resources/salons.js';
import { ressourceServeurs } from './resources/serveurs.js';
import { ressourceUtilisateurs } from './resources/utilisateurs.js';

export { optionsRessource } from './resources/commun.js';

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
  resources: [ressourceUtilisateurs, ressourceServeurs, ressourceSalons, ressourceMessages],
  databases: [],
};

export default options;
