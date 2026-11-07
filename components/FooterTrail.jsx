"use client";

import { useEffect, useRef } from "react";

const GRID = 24;
const BLOCK = 18;
const LENGTH = 24;
const STEP = 28;
const HOLD = 650;
const FADE = 550;

export default function FooterTrail() {
  const surfaceRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    let width = 0;
    let height = 0;
    let bounds;
    let visible = false;
    let frame = 0;
    let target = null;
    let cursor = null;
    let trail = [];
    let lastInput = 0;
    let lastStep = 0;
    let horizontal = true;

    const enabled = () => visible && !document.hidden && !motion.matches && pointer.matches;
    const clear = () => context.clearRect(0, 0, width, height);

    function stop() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      trail = [];
      target = null;
      cursor = null;
      clear();
    }

    function draw(now) {
      frame = 0;
      if (!enabled()) return stop();

      const head = trail.at(-1);
      if (head && target && now - lastStep >= STEP) {
        const dx = target.x - head.x;
        const dy = target.y - head.y;
        if (dx || dy) {
          const moveX = dx && (!dy || horizontal);
          trail.push({ x: head.x + (moveX ? Math.sign(dx) : 0), y: head.y + (moveX ? 0 : Math.sign(dy)) });
          if (trail.length > LENGTH) trail.shift();
          horizontal = !horizontal;
        }
        lastStep = now;
      }

      clear();
      const alpha = Math.max(0, 1 - Math.max(0, now - lastInput - HOLD) / FADE);
      context.fillStyle = `rgba(250, 250, 250, ${alpha})`;
      for (const cell of trail) {
        context.beginPath();
        context.roundRect(cell.x * GRID + (GRID - BLOCK) / 2, cell.y * GRID + (GRID - BLOCK) / 2, BLOCK, BLOCK, 3);
        context.fill();
      }
      if (alpha > 0) frame = window.requestAnimationFrame(draw);
      else trail = [];
    }

    function start() {
      if (!frame && enabled()) frame = window.requestAnimationFrame(draw);
    }

    function aim() {
      if (!cursor || !enabled()) return;
      const x = cursor.x - bounds.left;
      const y = cursor.y - bounds.top;
      if (x < 0 || x >= width || y < 0 || y >= height) return leave();
      target = {
        x: Math.min(Math.floor(x / GRID), Math.max(0, Math.floor(width / GRID) - 1)),
        y: Math.min(Math.floor(y / GRID), Math.max(0, Math.floor(height / GRID) - 1)),
      };
      const now = performance.now();
      if (!trail.length) {
        trail = [{ ...target }];
        lastStep = now;
      }
      lastInput = now;
      start();
    }

    function follow(event) {
      if (event.pointerType === "touch" || !enabled()) return;
      if (!cursor) bounds = surface.getBoundingClientRect();
      cursor = { x: event.clientX, y: event.clientY };
      aim();
    }

    function leave() {
      cursor = null;
      target = null;
      lastInput = performance.now() - HOLD;
      if (trail.length) start();
    }

    function scroll() {
      if (!cursor) return;
      bounds = surface.getBoundingClientRect();
      aim();
    }

    function resize() {
      width = surface.clientWidth;
      height = surface.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      bounds = surface.getBoundingClientRect();
      stop();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(surface);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) stop();
    });
    intersectionObserver.observe(surface);

    surface.addEventListener("pointerenter", follow);
    surface.addEventListener("pointermove", follow);
    surface.addEventListener("pointerleave", leave);
    surface.addEventListener("wheel", follow, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("visibilitychange", stop);
    motion.addEventListener("change", stop);
    pointer.addEventListener("change", stop);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      surface.removeEventListener("pointerenter", follow);
      surface.removeEventListener("pointermove", follow);
      surface.removeEventListener("pointerleave", leave);
      surface.removeEventListener("wheel", follow);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("visibilitychange", stop);
      motion.removeEventListener("change", stop);
      pointer.removeEventListener("change", stop);
    };
  }, []);

  return (
    <div className="footer-trail" ref={surfaceRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
