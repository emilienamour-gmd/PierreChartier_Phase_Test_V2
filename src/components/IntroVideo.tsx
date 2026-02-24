import React, { useEffect, useState, useRef } from "react";

export function IntroVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 1. On vérifie le signal
    const shouldShow = sessionStorage.getItem("showIntroVideo");

    if (shouldShow === "true") {
      setIsVisible(true);
      sessionStorage.removeItem("showIntroVideo");

      // 2. On tente de jouer la vidéo avec le son
      if (videoRef.current) {
        videoRef.current.volume = 1.0; // Volume Max
        videoRef.current.play().catch((err) => {
          console.error("Erreur lecture auto:", err);
        });
      }

      // 3. Timer pour le fondu (3.5s)
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 3500);

      // 4. Timer pour la suppression totale (4.5s)
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
      }, 4500);

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
        zIndex: 9999, // Au-dessus de tout
        backgroundColor: "black",
        transition: "opacity 1s ease-out", // Effet de fondu
        opacity: isFading ? 0 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none", // Permet de cliquer à travers pendant le fondu
      }}
    >
      {/* 👇 LE NOM EXACT DE TON FICHIER ICI 👇 */}
      <video
        ref={videoRef}
        src="/PierreChartier.mp4" 
        autoPlay
        playsInline
        // Pas de "muted" ici pour avoir le son !
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
