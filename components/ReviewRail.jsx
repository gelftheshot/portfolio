"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

const SCROLL_SPEED = 20;
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const serverVisible = () => true;
const motionPreference = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function subscribeMotion(notify) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", notify);
  return () => preference.removeEventListener("change", notify);
}
const pageVisibility = () => !document.hidden;
function subscribeVisibility(notify) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

export default function ReviewRail({ children }) {
  const viewportId = useId();
  const hintId = useId();
  const viewportRef = useRef(null);
  const directionRef = useRef(1);
  const dragRef = useRef(null);
  const suppressClickUntil = useRef(0);
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionPreference, serverReady);
  const pageVisible = useSyncExternalStore(subscribeVisibility, pageVisibility, serverVisible);
  const [pauseOverride, setPaused] = useState(null);
  const paused = pauseOverride ?? reducedMotion;
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: false, overflow: false });

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function updatePreference(event) {
      if (event.matches) setPaused(true);
    }

    preference.addEventListener("change", updatePreference);
    return () => {
      preference.removeEventListener("change", updatePreference);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1),
      { threshold: [0, 0.1] }
    );
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    function updateEdges() {
      const limit = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const next = {
        start: viewport.scrollLeft <= 1,
        end: viewport.scrollLeft >= limit - 1,
        overflow: limit > 1,
      };
      setEdges((previous) => (
        previous.start === next.start && previous.end === next.end && previous.overflow === next.overflow
          ? previous
          : next
      ));
    }

    const observer = new ResizeObserver(updateEdges);
    observer.observe(viewport);
    viewport.addEventListener("scroll", updateEdges, { passive: true });
    updateEdges();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", updateEdges);
    };
  }, [children]);

  const autoScrolling = ready && !paused && !hovered && !focusWithin && visible && pageVisible && edges.overflow;

  useEffect(() => {
    if (!autoScrolling) return;
    const viewport = viewportRef.current;
    let position = viewport.scrollLeft;
    let previousTime;
    let frame;

    function advance(time) {
      const elapsed = previousTime === undefined ? 0 : Math.min(time - previousTime, 64) / 1000;
      previousTime = time;
      const limit = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (limit <= 1) return;

      // Keep fractional progress locally so 20px/second works on browsers that
      // round scrollLeft. Reverse at each end without resetting or cloning cards.
      position = Math.max(0, Math.min(limit, position + directionRef.current * SCROLL_SPEED * elapsed));
      if (position >= limit) directionRef.current = -1;
      else if (position <= 0) directionRef.current = 1;
      viewport.scrollLeft = position;
      frame = window.requestAnimationFrame(advance);
    }

    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [autoScrolling]);

  function moveByCard(direction) {
    setPaused(true);
    const viewport = viewportRef.current;
    const card = viewport.firstElementChild;
    const gap = Number.parseFloat(window.getComputedStyle(viewport).columnGap) || 0;
    const distance = card ? card.getBoundingClientRect().width + gap : viewport.clientWidth;
    viewport.scrollBy({ left: direction * distance, behavior: reducedMotion ? "auto" : "smooth" });
  }

  function togglePlayback() {
    if (paused) {
      const viewport = viewportRef.current;
      viewport.scrollTo({ left: viewport.scrollLeft, behavior: "auto" });
      // Explicit Play can resume while its own button retains keyboard focus.
      setFocusWithin(false);
    }
    setPaused(!paused);
  }

  function handleKeyDown(event) {
    if (event.target !== viewportRef.current) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveByCard(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setPaused(true);
      const viewport = viewportRef.current;
      viewport.scrollTo({ left: event.key === "Home" ? 0 : viewport.scrollWidth, behavior: "auto" });
    }
  }

  function handlePointerDown(event) {
    setPaused(true);
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: viewportRef.current.scrollLeft,
      moved: false,
    };
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    viewportRef.current.scrollLeft = drag.scrollLeft - distance;
  }

  function finishPointer(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickUntil.current = performance.now() + 250;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div
      className="review-rail"
      data-auto-scrolling={autoScrolling ? "true" : "false"}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
    >
      <div
        className={`client-work-grid review-rail-viewport${dragging ? " is-dragging" : ""}`}
        id={viewportId}
        ref={viewportRef}
        role="region"
        aria-label="Client reviews from completed Upwork jobs"
        aria-describedby={hintId}
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          if (dragRef.current && !dragRef.current.moved) dragRef.current = null;
        }}
        onKeyDown={handleKeyDown}
        onWheel={() => setPaused(true)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (performance.now() < suppressClickUntil.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
      <div className="review-rail-footer">
        <p className="review-rail-hint" id={hintId}>Swipe or use the arrows to see more reviews.</p>
        <div className="review-rail-controls" aria-label="Review scrolling controls">
          <button type="button" aria-label="Previous reviews" aria-controls={viewportId} disabled={!ready || edges.start} onClick={() => moveByCard(-1)}>
            <span aria-hidden="true">←</span> Previous
          </button>
          <button type="button" className="review-rail-playback" aria-label={paused ? "Play automatic review scrolling" : "Pause automatic review scrolling"} aria-controls={viewportId} disabled={!ready || !edges.overflow} onClick={togglePlayback}>
            {paused ? "Play" : "Pause"}
          </button>
          <button type="button" aria-label="Next reviews" aria-controls={viewportId} disabled={!ready || edges.end} onClick={() => moveByCard(1)}>
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
