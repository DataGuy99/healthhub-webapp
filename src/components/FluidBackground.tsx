export function FluidBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0">
        {/* Animated pastel blobs */}
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <style>{`
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          animation: float 20s ease-in-out infinite;
        }

        .blob-1 {
          width: 500px;
          height: 500px;
          background: rgba(242, 217, 242, 0.5); /* Lavender */
          top: -10%;
          left: -10%;
          animation-delay: 0s;
        }

        .blob-2 {
          width: 600px;
          height: 600px;
          background: rgba(217, 242, 242, 0.5); /* Mint */
          top: 50%;
          right: -10%;
          animation-delay: -5s;
        }

        .blob-3 {
          width: 550px;
          height: 550px;
          background: rgba(242, 230, 217, 0.5); /* Peach */
          bottom: -10%;
          left: 30%;
          animation-delay: -10s;
        }

        .blob-4 {
          width: 450px;
          height: 450px;
          background: rgba(217, 230, 242, 0.5); /* Sky blue */
          top: 20%;
          left: 50%;
          animation-delay: -15s;
        }

        .blob-5 {
          width: 520px;
          height: 520px;
          background: rgba(242, 217, 230, 0.5); /* Rose */
          bottom: 20%;
          right: 20%;
          animation-delay: -7s;
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
