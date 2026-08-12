/**
 * Touch aim source (mobile). The first touch to land becomes the aim pointer —
 * its position is tracked by identifier through touchmove. A second,
 * simultaneous touch plants the feet for as long as it's held. preventDefault
 * on all touch events over the canvas stops the page from scrolling/zooming.
 */

export interface TouchSource {
  /** Latest client-space position of the aim touch, or null if none is down. */
  sample(): { x: number; y: number } | null;
  readonly active: boolean;
  readonly planted: boolean;
  dispose(): void;
}

export function createTouchSource(canvas: HTMLCanvasElement): TouchSource {
  let aimId: number | null = null;
  let aimX = 0;
  let aimY = 0;
  let plantId: number | null = null;

  const onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (aimId === null) {
        aimId = t.identifier;
        aimX = t.clientX;
        aimY = t.clientY;
      } else if (plantId === null && t.identifier !== aimId) {
        plantId = t.identifier;
      }
    }
  };
  const onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === aimId) {
        aimX = t.clientX;
        aimY = t.clientY;
      }
    }
  };
  const onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === aimId) {
        aimId = null;
        // if a plant finger is still down, promote it to the aim pointer so
        // lifting the primary finger doesn't strand aiming with no source.
        if (plantId !== null) {
          aimId = plantId;
          plantId = null;
          for (const t2 of e.touches) {
            if (t2.identifier === aimId) {
              aimX = t2.clientX;
              aimY = t2.clientY;
            }
          }
        }
      } else if (t.identifier === plantId) {
        plantId = null;
      }
    }
  };

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  return {
    sample() {
      return aimId !== null ? { x: aimX, y: aimY } : null;
    },
    get active() {
      return aimId !== null;
    },
    get planted() {
      return plantId !== null;
    },
    dispose() {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    },
  };
}
