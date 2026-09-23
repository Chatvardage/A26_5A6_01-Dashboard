     # ChatVardage

Base backend NestJS du tableau de bord de ChatVardage. Le projet fournit une API française et une structure prête à recevoir le frontend Electron/React décrit dans [ReadmeFrontEnd.md](ReadmeFrontEnd.md) et [ArchitectureFrontEnd.md](ArchitectureFrontEnd.md).

## Démarrer le projet

1. Installer les dépendances :

```bash
npm install
```

2. Créer un fichier `.env` dans `dashboard-chatvardage` :

```env
COOKIE_SECRET=remplacer-par-un-secret-local
PORT=3000
```

3. Démarrer le serveur :

```bash
cd dashboard-chatvardage
npm run start:dev
```

Le serveur est disponible sur `http://localhost:3000`.

## Panneau d'administration

Le panneau est disponible sur `http://localhost:3000/administration`. Il utilise
le service Authentification pour la connexion et refuse les comptes dont le rôle
n'est pas `admin`.

Une fois connecté, il permet de lister et supprimer les utilisateurs, les salons
et les 100 messages les plus récents. Les opérations sont relayées aux services
propriétaires; le dashboard ne contient ni base de données ni données simulées.

| Action | Service et route utilisee |
| --- | --- |
| Connexion et utilisateurs | Authentification: `/api/auth/login`, `/api/users` |
| Salons | Room-Service: `/api/admin/rooms`, `/api/rooms/:id` |
| Messages | Message-Service: `/api/messages/admin`, `/api/messages/admin/:id` |

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

Depuis `dashboard-chatvardage` :

```bash
npm run build
npm test -- --runInBand
npx eslint "src/**/*.ts"
```
