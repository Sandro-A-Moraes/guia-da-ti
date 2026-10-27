import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Globe2 } from 'lucide-react';
import { LoadingImage } from './LoadingImage';
import { resourceImage } from './resource-image';
import type { Resource } from './catalog';

type Point = { x: number; y: number };
type TriggerProps = React.HTMLAttributes<HTMLElement>;

export function ResourcePreview({ resource, extra = '', children, disabled = false }: { resource: Resource; extra?: string; children: ReactElement; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const tooltipId = useId();
  const image = resource.imageUrl || resourceImage(resource);

  function clearTimers() {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }

  function showAt(nextPoint: Point) {
    if (disabled) return;
    clearTimers();
    setPoint(nextPoint);
    setPosition(null);
    openTimer.current = window.setTimeout(() => setOpen(true), 280);
  }

  function closeSoon() {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return;
    showAt({ x: event.clientX, y: event.clientY });
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'touch') setPoint({ x: event.clientX, y: event.clientY });
  }

  function handleFocus(event: FocusEvent<HTMLElement>) {
    const rect = event.target instanceof HTMLElement ? event.target.getBoundingClientRect() : event.currentTarget.getBoundingClientRect();
    showAt({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    closeSoon();
  }

  useEffect(() => {
    if (disabled) {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
      setOpen(false);
    }
    return () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !point || !content.current) return;
    const rect = content.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(point.x + 16, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(point.y + 16, window.innerHeight - rect.height - margin));
    setPosition({ x: left, y: top });
  }, [open, point, resource.name, resource.description, extra, image]);

  const child = children as ReactElement<TriggerProps>;
  const describedBy = [child.props['aria-describedby'], ...(open ? [tooltipId] : [])].filter(Boolean).join(' ') || undefined;
  const triggerElement = cloneElement(child, {
    onPointerEnter: event => { child.props.onPointerEnter?.(event); handlePointerEnter(event); },
    onPointerMove: event => { child.props.onPointerMove?.(event); handlePointerMove(event); },
    onPointerLeave: event => { child.props.onPointerLeave?.(event); closeSoon(); },
    onFocus: event => { child.props.onFocus?.(event); handleFocus(event); },
    onBlur: event => { child.props.onBlur?.(event); handleBlur(event); },
    'aria-describedby': describedBy,
  });

  return <>
    {triggerElement}
    {open && point && typeof document !== 'undefined' && createPortal(
      <div
        id={tooltipId}
        ref={content}
        role="tooltip"
        data-slot="hover-card-content"
        className="resource-preview pointer-events-none fixed z-50 max-h-[calc(100dvh-1rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
        style={{ left: position?.x ?? Math.max(8, Math.min(point.x + 16, window.innerWidth - 464)), top: position?.y ?? Math.max(8, Math.min(point.y + 16, window.innerHeight - 240)) }}
      >
        {image && <LoadingImage src={image} alt="" loading="eager" className="h-36 w-full rounded-t-lg border-b bg-muted/40" imageClassName="object-contain p-3" />}
        <div className="p-4">
          {resource.url && <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Globe2 className="size-4" />{new URL(resource.url).hostname.replace(/^www\./, '')}</div>}
          <p className="text-base font-semibold">{resource.name}</p>
          <p className="mt-1 text-sm leading-relaxed">{resource.description}</p>
          {extra && <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{extra}</p>}
        </div>
      </div>,
      document.body,
    )}
  </>;
}
