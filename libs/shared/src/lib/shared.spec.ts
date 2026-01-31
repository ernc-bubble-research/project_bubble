import { shared } from './shared';

describe('shared [P2]', () => {
  it('[1H.1-UNIT-001] should work', () => {
    expect(shared()).toEqual('shared');
  });
});
