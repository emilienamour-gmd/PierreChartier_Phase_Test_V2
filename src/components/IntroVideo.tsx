import React, { useEffect, useState, useRef } from "react";

export function IntroVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // On vérifie le signal
    const shouldShow = sessionStorage.getItem("showIntroVideo");

    if (shouldShow === "true") {
      setIsVisible(true);
      sessionStorage.removeItem("showIntroVideo");

      // TENTATIVE DE LECTURE FORCÉE
      const playVideo = async () => {
        if (videoRef.current) {
          try {
            videoRef.current.volume = 1.0;
            videoRef.current.currentTime = 0;
            await videoRef.current.play();
            console.log("Lecture vidéo démarrée avec succès");
          } catch (err) {
            console.error("Lecture bloquée par le navigateur:", err);
            // Si bloqué, on réessaie en muet (mieux que rien)
            if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play();
            }
          }
        }
      };

      playVideo();

      // Timers
      const fadeTimer = setTimeout(() => setIsFading(true), 3500);
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
        zIndex: 99999, // Z-index extrême
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
        src="/PierreChartier.mp4"
        playsInline // Important pour mobile
        preload="auto"
        style={{ 
          width: "100%", 
          height: "100%", 
          // 👇 C'est ça qui empêche le zoom !
          objectFit: "contain" 
        }}
      />
    </div>
  );
}
