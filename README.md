     # ChatVardage

Base backend NestJS du tableau de bord de ChatVardage. Le projet fournit une API française et une structure prête à recevoir le frontend Electron/React décrit dans [ReadmeFrontEnd.md](ReadmeFrontEnd.md) et [ArchitectureFrontEnd.md](ArchitectureFrontEnd.md).

## Démarrer le projet

1. Installer les dépendances :

```bash
npm --prefix dashboard-chatvardage install
```

2. Créer un fichier `.env` dans `dashboard-chatvardage` :

```env
COOKIE_SECRET=remplacer-par-un-secret-aleatoire-de-32-caracteres-minimum
SESSION_SECRET=
PORT=3000
```

En production, `COOKIE_SECRET` doit etre un secret aleatoire d au moins 32 caracteres.
`SESSION_SECRET` est facultatif; s il est absent, une cle distincte est derivee de
`COOKIE_SECRET`.

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

| Action | Service et routes utilisees |
| --- | --- |
| Connexion | Authentification: `POST /api/auth/login` |
| Utilisateurs | Authentification: `GET/POST /api/users`, `DELETE /api/users/:id` |
| Serveurs | Room-Service: `GET /api/admin/servers`, `GET /api/servers/:id`, `POST /api/servers`, `DELETE /api/servers/:id` |
| Salons | Room-Service: `POST /api/servers/:id/channels`, `DELETE /api/channels/:id` |
| Messages prives | Message-Service: `GET/POST /api/messages/admin`, `DELETE /api/messages/admin/:id` |
| Messages de salon | Message-Service: `GET /api/messages/rooms/:channelId/history?limit=100`, `POST /api/messages/rooms/:channelId/admin`, `DELETE /api/messages/rooms/:channelId/:id` |

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
