"use client";

import { useEffect } from "react";

// Revela los `.reveal` al entrar en viewport añadiéndoles `.in`. Cada elemento
// se deja de observar en cuanto dispara, para que no se re-anime al subir.
export default function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
