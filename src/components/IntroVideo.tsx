import React, { useEffect, useState, useRef } from "react";

export function IntroVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // On vérifie le drapeau
    const shouldShow = sessionStorage.getItem("showIntroVideo");

    if (shouldShow === "true") {
      setIsVisible(true);
      // On nettoie tout de suite pour ne pas le rejouer plus tard
      sessionStorage.removeItem("showIntroVideo");

      // On tente de jouer la vidéo
      if (videoRef.current) {
        videoRef.current.volume = 1.0; // Volume Max
        videoRef.current.play().catch(err => console.error("Erreur lecture:", err));
      }

      // Timer pour le fondu (3.5s)
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 3500);

      // Timer pour la suppression (4.5s)
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
        zIndex: 9999,
        backgroundColor: "black",
        transition: "opacity 1s ease-out",
        opacity: isFading ? 0 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none", // Permet de cliquer à travers pendant le fondu
      }}
    >
      <video
        ref={videoRef}
        src="/PierreChartier.mp4" // Assure-toi que c'est le bon nom !
        autoPlay
        playsInline
        // Pas de "muted" ici, car on veut le son !
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
