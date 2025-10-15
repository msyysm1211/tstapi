import worker from '/Users/mashengyuan/Project/delete/tstapi/index.js';
import Cache from './mock/cache.js';
import mockKV from './mock/kv.js';

var mock_cache = new Cache(18080);
globalThis.mockCache = mock_cache;
mockKV.port = 18080;
globalThis.mockKV = mockKV;

export default worker;
