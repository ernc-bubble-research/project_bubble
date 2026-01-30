import { dbLayer } from './db-layer';

describe('dbLayer', () => {
  it('should work', () => {
    expect(dbLayer()).toEqual('db-layer');
  });
});
