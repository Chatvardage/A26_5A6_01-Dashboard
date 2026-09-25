import { jest } from '@jest/globals';

import ProprieteDestinationMessage from './message-destination-property.js';

describe('ProprieteDestinationMessage', () => {
  const property = { path: 'recipientId', components: { edit: 'personnalise', show: 'lecture' } };

  it('clears the channel when a recipient is selected', () => {
    const onChange = jest.fn();
    const element = ProprieteDestinationMessage({
      property, record: {}, onChange,
    } as never);
    const changer = element.props.onChange as (path: string, value: unknown) => void;

    changer('recipientId', 'utilisateur-1');

    expect(onChange).toHaveBeenNthCalledWith(1, 'recipientId', 'utilisateur-1', undefined);
    expect(onChange).toHaveBeenNthCalledWith(2, 'channelId', undefined);
    expect(element.props.property.components).toEqual({ show: 'lecture' });
  });

  it('clears the recipient when a channel is selected and preserves an empty value', () => {
    const onChange = jest.fn();
    const element = ProprieteDestinationMessage({
      property: { ...property, path: 'channelId' }, record: {}, onChange,
    } as never);
    const changer = element.props.onChange as (path: string, value: unknown) => void;

    changer('channelId', 'salon-1');
    changer('channelId', '');

    expect(onChange).toHaveBeenNthCalledWith(2, 'recipientId', undefined);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('supports a property without custom components', () => {
    const element = ProprieteDestinationMessage({
      property: { path: 'recipientId' }, record: {}, onChange: jest.fn(),
    } as never);

    expect(element.props.property.components).toEqual({});
  });
});
