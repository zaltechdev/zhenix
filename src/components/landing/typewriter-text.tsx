"use client";

import { useEffect, useState } from "react";

export function TypewriterText({
  prefix,
  words,
  fallback,
}: {
  prefix: string;
  words: string[];
  fallback: string;
}) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!words || words.length === 0) return;

    if (isPaused) {
      const pauseTimeout = setTimeout(() => {
        setIsPaused(false);
        setReverse(true);
      }, 2200);
      return () => clearTimeout(pauseTimeout);
    }

    if (subIndex === words[index].length + 1 && !reverse) {
      // eslint-disable-next-line
      setIsPaused(true);
      return;
    }

    if (subIndex === 0 && reverse) {
      setReverse(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1));
    }, reverse ? 45 : 85);

    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse, isPaused, words]);

  const currentWord = words[index] ? words[index].substring(0, subIndex) : "";

  return (
    <>
      <span className="typewriter-fallback sr-only">{fallback}</span>
      <span className="typewriter-container" aria-hidden="true">
        <span>{prefix}</span>
        <span className="typewriter-word">{currentWord}</span>
        <span className="typewriter-cursor">
          |
        </span>
      </span>
    </>
  );
}
