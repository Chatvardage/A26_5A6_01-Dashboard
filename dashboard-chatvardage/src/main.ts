import { randomBytes } from 'node:crypto';

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import options from './admin/options.js';
import { ModuleApplication } from './app.module.js';

export async function authentifierAdministrateur(courriel: string, motDePasse: string) {
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

export async function demarrerApplication() {
  if (!process.env.NODE_ENV) {
    Logger.warn('NODE_ENV absent; les secrets aleatoires locaux seront regeneres au redemarrage.', 'Dashboard');
  }
  const valeurSecreteLocale = 'dashboard_cookie_secret_for_local_development';
  const secretCookieConfigure = process.env.COOKIE_SECRET;
  const estDeveloppementLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const secretCookie = estDeveloppementLocal
    && (!secretCookieConfigure || secretCookieConfigure === valeurSecreteLocale)
    ? randomBytes(32).toString('hex')
    : secretCookieConfigure ?? valeurSecreteLocale;
  const secretSessionConfigure = process.env.SESSION_SECRET;
  const secretSession = (estDeveloppementLocal || process.env.NODE_ENV === 'test')
    && (!secretSessionConfigure || secretSessionConfigure === secretCookie)
    ? randomBytes(32).toString('hex')
    : secretSessionConfigure ?? '';
  if (process.env.NODE_ENV !== 'test') {
    if (secretCookie.length < 32 || secretCookie === valeurSecreteLocale) {
      throw new Error('COOKIE_SECRET doit contenir au moins 32 caracteres aleatoires hors tests.');
    }
    if (secretSession.length < 32 || secretSession === secretCookie) {
      throw new Error('SESSION_SECRET doit etre defini avec une valeur aleatoire distincte de COOKIE_SECRET.');
    }
  }
  const application = await NestFactory.create(ModuleApplication);
  const administration = new AdminJS(options);
  const routeur = (AdminJSExpress as unknown as typeof import('@adminjs/express').default)
    .buildAuthenticatedRouter(
      administration,
      {
        authenticate: async (courriel, motDePasse) => authentifierAdministrateur(courriel, motDePasse),
        cookieName: 'chatvardage-admin',
        cookiePassword: secretCookie,
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

/* istanbul ignore next -- the production entry point would open a real server during Jest. */
if (process.env.NODE_ENV !== 'test') demarrerApplication();
