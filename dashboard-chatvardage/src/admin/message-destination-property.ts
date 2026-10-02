import React from 'react';
import {
  BasePropertyComponent,
  type EditPropertyProps,
  type OnPropertyChange,
} from 'adminjs';

const autreDestination = (chemin: string): string => (chemin === 'recipientId' ? 'channelId' : 'recipientId');

const ProprieteDestinationMessage = ({
  property,
  record,
  onChange,
  ...props
}: EditPropertyProps): React.ReactElement => {
  const autreChemin = autreDestination(property.path);
  const composantsParDefaut = { ...(property.components ?? {}) };
  delete composantsParDefaut.edit;
  const changer: OnPropertyChange = (chemin, valeur, enregistrementSelectionne) => {
    onChange(chemin, valeur, enregistrementSelectionne);
    if (valeur) onChange(autreChemin, undefined);
  };

  return React.createElement(BasePropertyComponent, {
    ...props,
    property: {
      ...property,
      components: composantsParDefaut,
    },
    record,
    onChange: changer,
  });
};

export default ProprieteDestinationMessage;
