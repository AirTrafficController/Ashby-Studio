import React, { useState, useEffect } from 'react';

/* ============================================================
   ResizeHandle
   ============================================================
   Thin draggable strip that adjusts a parent panel's width.
   Usage:
     <aside style={{ width, position: 'relative' }}>
       <ResizeHandle
         width={width} setWidth={setWidth}
         edge="right"     // 'right' = handle on right edge of THIS panel
         min={220} max={500}
       />
       ...
     </aside>

   The handle sits absolutely-positioned, straddling the panel
   edge for a comfortable hit area. It attaches global mousemove
   and mouseup listeners during drag so the cursor can leave the
   handle without losing the gesture.
   ============================================================ */

export default function ResizeHandle({
  width, setWidth,
  edge = 'right',
  min = 200, max = 600,
}) {
  const [dragging, setDragging] = useState(false);

  // Keep cursor and selection state correct while dragging
  useEffect(() => {
    if (!dragging) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  const onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const startX = e.clientX;
    const startW = width;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      // Handle on left edge: dragging right shrinks, left grows
      const next = edge === 'left' ? startW - dx : startW + dx;
      setWidth(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className={`resize-handle ${dragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        [edge]: -3,
        width: 6,
        zIndex: 20,
      }}
      title="Drag to resize"
    />
  );
}
