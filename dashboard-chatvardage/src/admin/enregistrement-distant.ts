import { BaseRecord } from 'adminjs';

// AdminJS 7 ignore baseError dans BaseRecord.isValid(). Une erreur generale
// (conflit, validation globale, promotion partielle) doit aussi bloquer le succes.
export class EnregistrementDistant extends BaseRecord {
  isValid(): boolean {
    return !this.baseError && super.isValid();
  }
}
