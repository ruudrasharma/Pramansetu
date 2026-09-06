"use client";

/**
 * commandPaletteSignal — a lightweight event-bus for triggering the CommandPalette
 * from any component without prop drilling or a heavy global store.
 *
 * Usage:
 *   import { commandPaletteSignal } from "@/lib/commandPaletteSignal";
 *   commandPaletteSignal.open();   // trigger from ContextBar ⌘K button
 *   commandPaletteSignal.listen(cb); // subscribe in CommandPalette
 */

type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const commandPaletteSignal = {
  open() {
    listeners.forEach((fn) => fn());
  },
  listen(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
