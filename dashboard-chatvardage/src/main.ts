import 'dotenv/config';
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
      signal: AbortSignal.timeout(10_000),
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
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    Logger.warn(`Echec de l'appel au service Authentification: ${detail}`, 'Dashboard');
    return null;
  }
}

// Valeur par defaut fournie par l'Infra (.env.example); remplacee en dev/test, refusee ailleurs.
const valeurSecreteLocale = 'dashboard_cookie_secret_for_local_development';

export function resoudreSecrets(environnement: NodeJS.ProcessEnv = process.env) {
  const mode = environnement.NODE_ENV;
  const peutGenerer = !mode || mode === 'development' || mode === 'test';
  const cookieConfigure = environnement.COOKIE_SECRET;
  const sessionConfigure = environnement.SESSION_SECRET;

  const secretCookie = peutGenerer && (!cookieConfigure || cookieConfigure === valeurSecreteLocale)
    ? randomBytes(32).toString('hex')
    : cookieConfigure ?? '';
  const secretSession = peutGenerer
    && (!sessionConfigure || sessionConfigure === secretCookie || sessionConfigure === valeurSecreteLocale)
    ? randomBytes(32).toString('hex')
    : sessionConfigure ?? '';

  if (secretCookie.length < 32 || secretCookie === valeurSecreteLocale) {
    throw new Error('COOKIE_SECRET doit contenir au moins 32 caracteres aleatoires.');
  }
  if (secretSession.length < 32 || secretSession === secretCookie || secretSession === valeurSecreteLocale) {
    throw new Error('SESSION_SECRET doit etre defini avec une valeur aleatoire distincte de COOKIE_SECRET.');
  }

  return { secretCookie, secretSession };
}

// Une chaine non numerique serait prise par Node pour un chemin de socket Unix, sans erreur.
export function resoudrePort(valeur: string | undefined = process.env.PORT): number {
  const port = Number(valeur ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT invalide : "${valeur}".`);
  }
  return port;
}

export async function demarrerApplication() {
  if (!process.env.NODE_ENV) {
    Logger.warn('NODE_ENV absent; les secrets aleatoires locaux seront regeneres au redemarrage.', 'Dashboard');
  }
  const { secretCookie, secretSession } = resoudreSecrets();
  const port = resoudrePort();
  const application = await NestFactory.create(ModuleApplication);
  const estProduction = process.env.NODE_ENV === 'production';
  // getInstance() est l'application Express : @nestjs/platform-express est l'adaptateur requis ici.
  // Le proxy HTTPS en amont transmet X-Forwarded-Proto, requis par cookie.secure = 'auto'.
  if (estProduction) application.getHttpAdapter().getInstance().set('trust proxy', 1);
  const administration = new AdminJS(options);
  // @adminjs/express (version figee) est un paquet CommonJS : sous NodeNext, TypeScript
  // type mal son import par defaut, alors que Node fournit bien l'objet attendu.
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
        cookie: {
          httpOnly: true,
          sameSite: 'strict',
          secure: estProduction ? 'auto' : false,
        },
      },
    );

  application.getHttpAdapter().getInstance().use(administration.options.rootPath, routeur);
  await application.listen(port);
}

/* istanbul ignore next -- the production entry point would open a real server during Jest. */
if (process.env.NODE_ENV !== 'test') {
  demarrerApplication().catch((erreur: unknown) => {
    Logger.error(erreur instanceof Error ? erreur.stack : String(erreur), 'Dashboard');
    process.exitCode = 1;
  });
}
