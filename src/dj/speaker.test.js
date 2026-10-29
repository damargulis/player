import session, {OWNER} from './session';

// The DJ must be told who is talking. This is plumbing with no visible failure mode: when the
// speaker is lost the turn still runs and the reply still arrives, and the only symptom is the
// DJ not knowing who it is answering — which is how it survived until it asked Chloe whether
// she was Chloe.
//
// fetch is stubbed rather than the api module mocked: jest.mock is unusable under the
// jest-electron runner, and .env.local holds a real key at test time, so an unstubbed run
// would make live API calls. Every turn fails fast and runTurn records the user entry before
// it ever calls out, which is the part under test.
let realFetch;

beforeEach(() => {
  realFetch = global.fetch;
  global.fetch = () => Promise.reject(new Error('stubbed: no network in tests'));
  session.reset();
});

afterEach(() => {
  global.fetch = realFetch;
});

/** Lets the async drain loop finish; each turn rejects immediately on the stub. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function speakers() {
  return session.getChatState(100).entries
    .filter((entry) => entry.role === 'user')
    .map((entry) => entry.speaker);
}

describe('speaker attribution', () => {
  it('records who sent a message', async () => {
    session.send('something mellow', 'Chloe');
    await settle();
    expect(speakers()).toStrictEqual(['Chloe']);
  });

  it('falls back to the owner when no one is named', async () => {
    session.send('something mellow');
    await settle();
    expect(speakers()).toStrictEqual([OWNER]);
  });

  // The regression: a message sent while a turn was in flight was queued WITH its speaker and
  // then drained WITHOUT it, so the DJ saw an unattributed message and the transcript had no
  // label. Two sends in a row is the ordinary case — the second always lands mid-turn.
  it('keeps the speaker on a message queued while the DJ is busy', async () => {
    session.send('first one', OWNER);
    session.send('second one', 'Chloe');
    await settle();
    await settle();
    expect(speakers()).toStrictEqual([OWNER, 'Chloe']);
  });

  it('keeps distinct speakers across several queued messages', async () => {
    session.send('a', 'Chloe');
    session.send('b', OWNER);
    session.send('c', 'Chloe');
    await settle();
    await settle();
    await settle();
    expect(speakers()).toStrictEqual(['Chloe', OWNER, 'Chloe']);
  });

  it('tells clients who the owner is, so a guest can be told apart', () => {
    expect(session.getChatState().owner).toEqual(OWNER);
  });
});
