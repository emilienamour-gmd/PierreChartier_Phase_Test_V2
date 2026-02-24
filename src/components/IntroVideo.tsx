import React, { useEffect, useState, useRef } from "react";

export function IntroVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const shouldShow = sessionStorage.getItem("showIntroVideo");

    if (shouldShow === "true") {
      setIsVisible(true);
      sessionStorage.removeItem("showIntroVideo");

      // On essaie de lancer la vidéo avec le son
      if (videoRef.current) {
        videoRef.current.volume = 1.0; // Volume max
        videoRef.current.play().catch((e) => {
          // ⚠️ Si le navigateur bloque le son, on log l'erreur
          console.log("Lecture auto bloquée par le navigateur:", e);
        });
      }

      // Timer pour le fondu (3.5s)
      const fadeTimer = setTimeout(() => setIsFading(true), 3500);
      
      // Timer pour suppression (4.5s)
      const removeTimer = setTimeout(() => setIsVisible(false), 4500);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        backgroundColor: "black",
        transition: "opacity 1s ease-out",
        opacity: isFading ? 0 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        playsInline
        // ❌ J'AI SUPPRIMÉ LA LIGNE "muted" POUR AVOIR LE SON
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
