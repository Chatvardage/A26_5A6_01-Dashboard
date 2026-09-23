import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { NestFactory } from '@nestjs/core';

import options from './admin/options.js';
import { ModuleApplication } from './app.module.js';

async function démarrerApplication() {
  const application = await NestFactory.create(ModuleApplication);
  const administration = new AdminJS(options);
  const secretSession = process.env.COOKIE_SECRET ?? 'dashboard_cookie_secret_for_local_development';
  const routeur = (AdminJSExpress as unknown as {
    buildAuthenticatedRouter: typeof import('@adminjs/express').default.buildAuthenticatedRouter;
  }).buildAuthenticatedRouter(
    administration,
    {
      authenticate: async (courriel, motDePasse) => authentifierAdministrateur(courriel, motDePasse),
      cookieName: 'chatvardage-admin',
      cookiePassword: secretSession,
    },
    undefined,
    {
      resave: false,
      saveUninitialized: false,
      secret: secretSession,
    },
  );

  application.getHttpAdapter().getInstance().use(administration.options.rootPath, routeur);
  await application.listen(process.env.PORT ?? 3000);
}
démarrerApplication();

async function authentifierAdministrateur(courriel: string, motDePasse: string) {
  try {
    const urlAuthentification = (process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const reponse = await fetch(`${urlAuthentification}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant: courriel, mot_de_passe: motDePasse }),
    });

    if (!reponse.ok) return null;

    const connexion = await reponse.json() as {
      jeton: string;
      utilisateur: { id: string; pseudo: string; courriel: string; role: string };
    };

    if (connexion.utilisateur.role !== 'admin') return null;

    return {
      id: connexion.utilisateur.id,
      email: connexion.utilisateur.courriel,
      title: connexion.utilisateur.pseudo,
      jeton: connexion.jeton,
    };
  } catch {
    return null;
  }
}
