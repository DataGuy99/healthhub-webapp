export function FluidBackground() {
  const hour = new Date().getHours();

  // Time-based color palettes (8 colors each)
  const colors = hour >= 5 && hour < 8 ? [
    // Dawn (5-8am): Soft morning pastels
    'rgba(255, 230, 210, 0.5)', // Peachy pink
    'rgba(255, 240, 220, 0.5)', // Cream
    'rgba(240, 220, 255, 0.5)', // Lavender
    'rgba(255, 210, 230, 0.5)', // Rose
    'rgba(230, 240, 255, 0.5)', // Sky blue
    'rgba(255, 235, 215, 0.5)', // Peach
    'rgba(240, 230, 255, 0.5)', // Lilac
    'rgba(255, 225, 235, 0.5)', // Blush
  ] : hour >= 8 && hour < 12 ? [
    // Morning (8am-12pm): Bright energetic pastels
    'rgba(255, 240, 200, 0.5)', // Sunny yellow
    'rgba(200, 240, 255, 0.5)', // Sky
    'rgba(220, 255, 220, 0.5)', // Mint green
    'rgba(255, 220, 240, 0.5)', // Pink
    'rgba(240, 230, 200, 0.5)', // Cream
    'rgba(210, 235, 255, 0.5)', // Baby blue
    'rgba(255, 235, 210, 0.5)', // Apricot
    'rgba(230, 255, 230, 0.5)', // Pale green
  ] : hour >= 12 && hour < 17 ? [
    // Afternoon (12-5pm): Warm vibrant pastels
    'rgba(255, 215, 180, 0.5)', // Coral
    'rgba(180, 220, 255, 0.5)', // Cerulean
    'rgba(255, 200, 220, 0.5)', // Flamingo
    'rgba(200, 230, 200, 0.5)', // Sage
    'rgba(255, 230, 190, 0.5)', // Gold
    'rgba(220, 200, 255, 0.5)', // Periwinkle
    'rgba(255, 210, 200, 0.5)', // Salmon
    'rgba(190, 240, 255, 0.5)', // Aqua
  ] : hour >= 17 && hour < 21 ? [
    // Evening (5-9pm): Sunset pastels
    'rgba(255, 180, 170, 0.5)', // Sunset pink
    'rgba(255, 200, 150, 0.5)', // Orange glow
    'rgba(200, 180, 255, 0.5)', // Twilight purple
    'rgba(255, 160, 200, 0.5)', // Magenta
    'rgba(240, 200, 160, 0.5)', // Amber
    'rgba(180, 200, 255, 0.5)', // Dusk blue
    'rgba(255, 190, 180, 0.5)', // Coral pink
    'rgba(220, 180, 240, 0.5)', // Orchid
  ] : [
    // Night (9pm-5am): Deep mystical pastels
    'rgba(180, 170, 220, 0.5)', // Midnight purple
    'rgba(170, 200, 230, 0.5)', // Moonlight blue
    'rgba(200, 180, 210, 0.5)', // Plum
    'rgba(160, 180, 240, 0.5)', // Indigo
    'rgba(190, 170, 200, 0.5)', // Mauve
    'rgba(170, 190, 220, 0.5)', // Steel blue
    'rgba(180, 180, 220, 0.5)', // Periwinkle
    'rgba(200, 190, 230, 0.5)', // Lilac mist
  ];

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0">
        {colors.map((color, i) => (
          <div key={i} className={`blob blob-${i}`} style={{ background: color }} />
        ))}
      </div>

      <style>{`
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.7;
          animation: float 20s ease-in-out infinite;
        }

        .blob-0 {
          width: 500px;
          height: 500px;
          top: -10%;
          left: -10%;
          animation-delay: 0s;
        }

        .blob-1 {
          width: 600px;
          height: 600px;
          top: 50%;
          right: -10%;
          animation-delay: -3s;
        }

        .blob-2 {
          width: 550px;
          height: 550px;
          bottom: -10%;
          left: 30%;
          animation-delay: -6s;
        }

        .blob-3 {
          width: 450px;
          height: 450px;
          top: 20%;
          left: 50%;
          animation-delay: -9s;
        }

        .blob-4 {
          width: 520px;
          height: 520px;
          bottom: 20%;
          right: 20%;
          animation-delay: -12s;
        }

        .blob-5 {
          width: 480px;
          height: 480px;
          top: 60%;
          left: 10%;
          animation-delay: -15s;
        }

        .blob-6 {
          width: 530px;
          height: 530px;
          top: 10%;
          right: 30%;
          animation-delay: -18s;
        }

        .blob-7 {
          width: 470px;
          height: 470px;
          bottom: 40%;
          left: 60%;
          animation-delay: -21s;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(50px, -50px) scale(1.1);
          }
          50% {
            transform: translate(-30px, 30px) scale(0.9);
          }
          75% {
            transform: translate(40px, 20px) scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
