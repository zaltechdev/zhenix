"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import {
  composerReducer,
  initialComposerState,
  type ComposerAction,
  type ComposerState
} from "@/lib/client/state/composer-machine";

/**
 * Shared composer state.
 *
 * The composer lives in the workspace shell while example commands live inside page
 * content, so the two need one source of truth. React context is enough here, which
 * is why no global store is introduced. See `.agents/rules.md` section 4.
 */
type CommandContextValue = {
  state: ComposerState;
  dispatch: (action: ComposerAction) => void;
};

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(composerReducer, initialComposerState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommandContext(): CommandContextValue {
  const value = useContext(CommandContext);
  if (value === null) {
    throw new Error("useCommandContext must be used inside CommandProvider.");
  }
  return value;
}

/**
 * Safe accessor for content that may render outside the workspace shell, such as a
 * unit test rendering a page in isolation.
 */
export function useOptionalCommandContext(): CommandContextValue | null {
  return useContext(CommandContext);
}
