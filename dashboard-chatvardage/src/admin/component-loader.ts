import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ComponentLoader } from 'adminjs';

const chargeurComposants = new ComponentLoader();
const dossierCourant = dirname(fileURLToPath(import.meta.url));

export const composantDestinationMessage = chargeurComposants.add(
  'DestinationMessage',
  join(dossierCourant, 'message-destination-property'),
);

export default chargeurComposants;
