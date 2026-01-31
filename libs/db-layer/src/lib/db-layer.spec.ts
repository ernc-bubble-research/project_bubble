import { dbLayer } from './db-layer';

describe('dbLayer [P2]', () => {
  it('[1H.1-UNIT-001] should work', () => {
    expect(dbLayer()).toEqual('db-layer');
  });
});
