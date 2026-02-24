import React, { useEffect, useState, useRef } from "react";
// Si tu n'as pas lucide-react, supprime l'import de Play ci-dessous
import { Play } from "lucide-react"; 

export function IntroVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const shouldShow = sessionStorage.getItem("showIntroVideo");

    if (shouldShow === "true") {
      setIsVisible(true);
      sessionStorage.removeItem("showIntroVideo");

      // On tente de lancer la vidéo automatiquement
      const attemptAutoPlay = async () => {
        if (videoRef.current) {
          try {
            videoRef.current.volume = 1.0;
            await videoRef.current.play();
            // Si ça marche, le bouton reste caché
          } catch (err) {
            console.log("Autoplay bloqué par le navigateur, affichage du bouton");
            setShowPlayButton(true);
          }
        }
      };

      attemptAutoPlay();
    }
  }, []);

  // Cette fonction se lance UNIQUEMENT quand la vidéo est finie
  const handleVideoEnded = () => {
    // 1. On lance le fondu (disparition progressive)
    setIsFading(true);

    // 2. On supprime complètement le composant après 1 seconde (temps de l'animation)
    setTimeout(() => {
      setIsVisible(false);
    }, 1000);
  };

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setShowPlayButton(false); // On cache le bouton dès qu'on clique
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
        backgroundColor: "black",
        transition: "opacity 1s ease-out", // Durée du fondu de sortie
        opacity: isFading ? 0 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={videoRef}
        src="/PierreChartier.mp4"
        playsInline
        // 👇 C'EST LA CLÉ : On déclenche la fin seulement quand la vidéo s'arrête
        onEnded={handleVideoEnded}
        style={{ 
          width: "100%", 
          height: "100%", 
          objectFit: "contain" // "contain" = on voit toute la vidéo (bandes noires possibles)
                               // "cover" = plein écran (ça peut couper un peu les bords)
        }}
      />

      {/* Bouton qui apparaît SEULEMENT si le navigateur bloque le lancement auto */}
      {showPlayButton && (
        <button
          onClick={handleManualPlay}
          className="absolute z-50 bg-white/10 backdrop-blur-md border border-white/30 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer shadow-2xl"
        >
          <span>▶</span> Lancer l'expérience
        </button>
      )}
    </div>
  );
}
