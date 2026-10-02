# Chatvardage — Dashboard d’administration

Application web NestJS/Express et AdminJS, déployée dans un conteneur séparé de l’API. Seuls les comptes `admin` peuvent se connecter. Elle liste, crée et supprime utilisateurs, serveurs, salons et messages en appelant directement leurs services propriétaires; elle ne possède aucune base métier.

## Démarrage complet recommandé

Suivre le [README Infra](https://github.com/Chatvardage/A26_5A6_01-Infra/blob/develop/README.md), créer le premier compte admin puis ouvrir **http://localhost:3002/administration**. Depuis Infra, `./scripts/healthcheck.sh` vérifie aussi ce Dashboard.

## Développement local

Prérequis : Node.js 22.22.3 ou plus récent dans la série 22, npm; Authentification, Room-Service et Message-Service démarrés.

```bash
npm --prefix dashboard-chatvardage ci
cp dashboard-chatvardage/.env.example dashboard-chatvardage/.env
# Renseigner deux secrets distincts COOKIE_SECRET et SESSION_SECRET
# Générer chaque secret séparément : openssl rand -hex 32
npm --prefix dashboard-chatvardage run start:dev
```

En local, le port par défaut est **3000**, déjà utilisé par le Gateway Infra. Définir `PORT=3002` si le Dashboard Docker est arrêté, ou un autre port libre. Les URL par défaut des services sont `http://localhost:3001`, `:3003`, `:3004`. Dans Docker, utiliser leurs noms de service.

## Vérifications et CI

```bash
cd dashboard-chatvardage
npx eslint 'src/**/*.ts' --max-warnings=0
npx tsc --noEmit -p tsconfig.json --incremental false
npm run test:cov -- --runInBand
npm run build
node scripts/generate-adminjs.mjs
docker build -t chatvardage-dashboard:local .
```

Le CI sur PR et push vers `develop`/`main` exécute installation reproductible, audit au seuil critique, lint, types, couverture, build, génération AdminJS et construction Docker.

Une création refusée (400/409/422, notamment un courriel déjà utilisé) garde le formulaire et affiche l’erreur. Une promotion admin échouée après création annonce explicitement que le compte standard existe déjà. Ces parcours sont testés avec l’action AdminJS réelle.

## Documentation

- [Guide détaillé et limites](https://github.com/Chatvardage/A26_5A6_01-Infra/blob/develop/docs/services/Dashboard.md)
- [Architecture et flux internes](https://github.com/Chatvardage/A26_5A6_01-Infra/blob/develop/docs/architecture.md)
- [Validation et permissions](https://github.com/Chatvardage/A26_5A6_01-Infra/blob/develop/docs/validation.md)
- [Consignes de contribution](AGENTS.md)
