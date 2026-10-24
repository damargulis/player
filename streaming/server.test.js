const {mintToken} = require('./auth');

// Config is read at module load, so it has to be in place before the server is required.
const minted = mintToken();
process.env.GCS_BACKUP_BUCKET = 'test-bucket';
process.env.STREAM_DEVICE_TOKENS = `${minted.hash}:test-device`;
const {handle} = require('./server');

function fakeRes() {
  const out = {body: undefined, headers: undefined, status: undefined};
  return {
    captured: out,
    end(payload) {
      out.body = payload ? JSON.parse(payload) : undefined;
    },
    writeHead(status, headers) {
      out.status = status;
      out.headers = headers;
    },
  };
}

async function call(path, authorization) {
  const res = fakeRes();
  await handle({headers: {authorization, host: 'localhost'}, method: 'GET', url: path}, res);
  return res.captured;
}

const GOOD = `Bearer ${minted.token}`;

describe('/health', () => {
  // Cloud Run probes this; requiring auth would make the service look permanently unhealthy.
  it('is reachable without a token', async () => {
    const {body, status} = await call('/health');
    expect(status).toEqual(200);
    expect(body).toEqual({ok: true});
  });
});

describe('authentication', () => {
  it('rejects /catalog with no token', async () => {
    expect((await call('/catalog')).status).toEqual(401);
  });

  it('rejects /track with no token', async () => {
    expect((await call('/track/t1')).status).toEqual(401);
  });

  it('rejects a token that is not allowlisted', async () => {
    expect((await call('/catalog', `Bearer ${mintToken().token}`)).status).toEqual(401);
  });

  it('rejects a well-formed header with a junk token', async () => {
    expect((await call('/catalog', 'Bearer not-a-real-token')).status).toEqual(401);
  });

  // The 401 body must not hint at whether the device, the header or the path was the problem.
  it('says nothing useful in the rejection', async () => {
    expect((await call('/catalog')).body).toEqual({error: 'unauthorized'});
  });
});

describe('routing', () => {
  it('404s an unknown path for an authenticated device', async () => {
    const {body, status} = await call('/nope', GOOD);
    expect(status).toEqual(404);
    expect(body).toEqual({error: 'not found'});
  });

  // Unknown paths must not fall through to the catalog or leak that a route exists.
  it('404s an unknown path before touching storage', async () => {
    expect((await call('/track', GOOD)).status).toEqual(404);
  });
});

describe('responses', () => {
  it('forbids caching, since signed URLs expire', async () => {
    expect((await call('/health')).headers['Cache-Control']).toEqual('no-store');
  });
});
