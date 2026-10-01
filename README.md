# ChatVardage

Base backend NestJS du tableau de bord de ChatVardage. Le projet fournit une API française et une structure prête à recevoir le frontend Electron/React décrit dans [ReadmeFrontEnd.md](ReadmeFrontEnd.md) et [ArchitectureFrontEnd.md](ArchitectureFrontEnd.md).

## Démarrer le projet

1. Installer les dépendances :

```bash
npm --prefix dashboard-chatvardage install
```

2. Créer le fichier `.env` à partir du modèle, puis y générer `COOKIE_SECRET` et `SESSION_SECRET` (deux valeurs distinctes, `openssl rand -hex 32`) :

```bash
cp dashboard-chatvardage/.env.example dashboard-chatvardage/.env
```

`.env` est chargé par `dotenv` au tout début de `main.ts`, avant la lecture des secrets.

En production, `COOKIE_SECRET` doit etre un secret aleatoire d au moins 32 caracteres.
`SESSION_SECRET` doit aussi etre un secret aleatoire distinct d au moins 32 caracteres.
En developpement local, les deux secrets sont generes separement si les variables
sont absentes.

3. Démarrer le serveur :

```bash
npm --prefix dashboard-chatvardage run start:dev
```

Le serveur est disponible sur `http://localhost:3000`.

## Panneau d'administration

Le panneau est disponible sur `http://localhost:3000/administration`. Il utilise
le service Authentification pour la connexion et refuse les comptes dont le rôle
n'est pas `admin`.

Une fois connecté, il permet de créer, lister et supprimer les utilisateurs, les
salons et les 100 messages les plus récents. Les opérations sont relayées aux
services propriétaires; le dashboard ne contient ni base de données ni données
simulées.

AdminJS est monté avec `@adminjs/express` sur l adaptateur Express de Nest, car
ses ressources personnalisées relaient les requêtes vers les microservices.
AdminJS authentifie ses routes par le service Authentification; les guards,
interceptors et filtres propres aux contrôleurs Nest ne s appliquent pas à ces
routes. L application n utilise pas de guards globaux. Toute future politique
globale doit couvrir explicitement les routes AdminJS.

`RessourceApiDistante` implémente l interface `BaseResource` d AdminJS; ses
méthodes `databaseName()` et `update()` sont requises par cette interface, même
si le dashboard ne possède pas de base locale et délègue les écritures.

`allowScripts` dans `package.json` autorise le script d installation d esbuild,
dont le binaire natif est requis par le bundler AdminJS. Le Dockerfile autorise
également explicitement les scripts npm durant les installations.

| Action | Service et routes utilisees |
| --- | --- |
| Connexion | Authentification: `POST /api/auth/login` |
| Utilisateurs | Authentification: `GET/POST /api/users`, `PATCH /api/users/:id/role` (compte cree comme administrateur), `DELETE /api/users/:id` |
| Serveurs | Room-Service: `GET /api/admin/servers`, `GET /api/servers/:id`, `POST /api/servers`, `DELETE /api/servers/:id` |
| Salons | Room-Service: `POST /api/servers/:id/channels`, `DELETE /api/channels/:id` |
| Messages prives | Message-Service: `GET/POST /api/messages/admin`, `DELETE /api/messages/admin/:id` |
| Messages de salon | Message-Service: `GET /api/messages/rooms/:channelId/history?limit=100`, `POST /api/messages/rooms/:channelId/admin`, `DELETE /api/messages/rooms/:channelId/:id` |

### Limites connues

Le dashboard charge les messages de chaque salon séparément, par lots d au plus
cinq salons simultanement. La suppression d un message charge aussi les
enregistrements pour retrouver son salon. Les API actuelles n offrent pas de
lecture groupée ni de recherche directe commune par identifiant; réduire ces
chargements demande une évolution compatible de Message-Service.

Les listes réutilisent leurs résultats pendant une seconde afin d éviter de
refaire le même chargement pour `count` puis `find`. La suppression d un message
recherche encore son salon dans les enregistrements chargés; une API propriétaire
de lecture par identifiant éviterait ce parcours.

La liste des serveurs est chargée par pages de 100, jusqu à 50 pages
(5 000 serveurs). Au-delà, le chargement s arrête avec un avertissement dans
les journaux : une pagination côté AdminJS serait alors nécessaire.

La CI (`.github/workflows/ci.yml`) exécute `npm audit` au seuil `critical`.
Les avis restants (`tinymce`, `@tiptap/*`, `react-router`, `uuid`,
`i18next-http-backend`) viennent tous d `adminjs` 7.8.17 et
`@adminjs/design-system` 4.1.1, les dernières versions publiées. Ces paquets
livrent des bundles navigateur déjà compilés : forcer des versions avec
`overrides` ferait taire `npm audit` sans changer le code servi. Le dashboard
n utilise pas l éditeur riche (`richtext`), seulement des champs `textarea`.
`@adminjs/express` est figé à `5.1.0` : surveiller ses avis manuellement.

## Configuration

Le dashboard utilise les valeurs locales suivantes si les variables ne sont pas
definies:

```env
PORT=3000
AUTH_SERVICE_URL=http://localhost:3001
ROOM_SERVICE_URL=http://localhost:3003
MESSAGE_SERVICE_URL=http://localhost:3004
```

En environnement conteneurise, remplacer les hotes par les noms de service du
reseau Docker.

## Vérifications

Depuis la racine du dépôt :

```bash
npm --prefix dashboard-chatvardage run build
npm --prefix dashboard-chatvardage test -- --runInBand
npm --prefix dashboard-chatvardage run test:cov -- --runInBand
npm --prefix dashboard-chatvardage exec -- eslint "dashboard-chatvardage/src/**/*.ts"
```

Le rapport HTML est genere dans `dashboard-chatvardage/coverage/lcov-report/index.html`.
