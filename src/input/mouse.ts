/**
 * Mouse aim source. The cursor IS the sword tip: latest client position is
 * sampled once per sim tick by input.ts. Right button held = "planted"
 * (stand ground, no body chase).
 */

export interface MouseSource {
  /** Latest client-space position, or null until the mouse has moved at least once. */
  sample(): { x: number; y: number } | null;
  readonly planted: boolean;
  dispose(): void;
}

export function createMouseSource(): MouseSource {
  let x = 0;
  let y = 0;
  let moved = false;
  let planted = false;

  const onMove = (e: MouseEvent): void => {
    x = e.clientX;
    y = e.clientY;
    moved = true;
  };
  const onDown = (e: MouseEvent): void => {
    if (e.button === 2) planted = true;
  };
  const onUp = (e: MouseEvent): void => {
    if (e.button === 2) planted = false;
  };
  const onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('contextmenu', onContextMenu);

  return {
    sample() {
      return moved ? { x, y } : null;
    },
    get planted() {
      return planted;
    },
    dispose() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
