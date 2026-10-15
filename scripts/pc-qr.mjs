const sameScope = (a, b) => !!a && !!b && a.profileId === b.profileId && a.accountId === b.accountId && a.revision === b.revision;
const sameIdentity = (a, b) => !!a && !!b && a.rootId === b.rootId && a.instanceId === b.instanceId && sameScope(a.profileScope, b.profileScope);

// Only an explicit IPC intent or manual P action enters here. Status polling
// watches an existing request; it never connects WhatsApp or opens another QR.
export function createPcQrViewer({ getIdentity, isStopping, readStatus, write, open, remove, acknowledge,
  report = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, ttl = 60000 }) {
  const seen = new Set();
  let active;
  function cleanup(nonce) {
    try { remove(nonce); return true; }
    catch {
      report('Private QR cleanup failed. Close its viewer, then remove the private pairing image from .runtime.');
      return false;
    }
  }
  function cancel() {
    if (!active) return;
    active.cancelled = true;
    cleanup(active.intent.nonce);
  }
  function request(intent, { manual = false } = {}) {
    if (isStopping() || !sameIdentity(intent, getIdentity()) || intent.type !== 'otherme-pc-display'
      || typeof intent.requestId !== 'string' || !intent.requestId || intent.requestId.length > 96
      || typeof intent.nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(intent.nonce)) return Promise.resolve();
    const key = JSON.stringify([intent.rootId, intent.instanceId, intent.profileScope.profileId, intent.profileScope.accountId, intent.profileScope.revision, intent.requestId]);
    if (seen.has(key)) return Promise.resolve();
    seen.add(key); cancel();
    const run = { intent, cancelled: false };
    active = run;
    const current = () => !run.cancelled && !isStopping() && sameIdentity(intent, getIdentity());
    const ack = state => { if (!manual) acknowledge({ type: 'otherme-pc-display-ack', requestId: intent.requestId,
      nonce: intent.nonce, rootId: intent.rootId, instanceId: intent.instanceId, profileScope: intent.profileScope, state }); };
    return (async () => {
      let terminal = 'expired';
      try {
        const deadline = now() + ttl;
        let displayed;
        while (current() && now() < deadline) {
          const status = await readStatus(intent);
          if (!current()) break;
          if (!manual && (status.pcDisplay?.requestId !== intent.requestId || !['requested', 'ready'].includes(status.pcDisplay.state))) break;
          if (status.state === 'error') {
            if (typeof status.error === 'string') report(status.error);
            terminal = 'unavailable'; break;
          }
          if (status.state === 'connected') { report('WhatsApp connected.'); break; }
          const qr = status.qr;
          if (displayed && qr !== displayed) break;
          if (!displayed && typeof qr === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr) && qr.length < 100000) {
            write(intent.nonce, Buffer.from(qr.slice('data:image/png;base64,'.length), 'base64'));
            if (!current()) break;
            await open(intent.nonce);
            if (!current()) break;
            displayed = qr; ack('ready');
            report('Private QR launch requested on this PC. Scan it in WhatsApp Linked devices.');
          }
          await wait(1000);
        }
      } catch {
        terminal = 'unavailable'; report('Pairing could not be displayed. Check Settings or use P.');
      } finally {
        if (!cleanup(intent.nonce)) terminal = 'unavailable';
        ack(terminal);
        if (active === run) active = undefined;
      }
    })();
  }
  return { request, cancel };
}
