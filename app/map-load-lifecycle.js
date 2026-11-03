export class MapLoadError extends Error {
  constructor(stage, message) { super(message); this.name = 'MapLoadError'; this.stage = stage; }
}

// A late metadata result must not attach a second, stale scene after a timeout.
export function withDeadline(promise, stage, timeoutMs = 30000, onLateResult = () => {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new MapLoadError(stage, `${stage} 단계 응답 시간 초과 (${timeoutMs / 1000}초)`));
    }, timeoutMs);
    Promise.resolve(promise).then(value => {
      if (settled) { onLateResult(value); return; }
      settled = true; clearTimeout(timer); resolve(value);
    }, error => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      reject(new MapLoadError(stage, error?.message || String(error)));
    });
  });
}

export function firstVisibleTile(tileset, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let removeVisible = () => {}, removeFailure = () => {}, lastFailure = '';
    const cleanup = () => { clearTimeout(timer); removeVisible(); removeFailure(); };
    const timer = setTimeout(() => {
      cleanup(); reject(new MapLoadError('first-tile', `첫 3D 타일 표시 시간 초과${lastFailure ? `: ${lastFailure}` : ''}`));
    }, timeoutMs);
    removeVisible = tileset.tileVisible.addEventListener(() => { cleanup(); resolve(); });
    if (tileset.tileFailed) removeFailure = tileset.tileFailed.addEventListener(e => { lastFailure = e?.message || '타일 요청 실패'; });
  });
}
