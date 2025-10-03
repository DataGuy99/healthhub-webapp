import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/40',
      text: 'text-red-300',
      button: 'bg-red-500/30 hover:bg-red-500/40 border-red-500/50'
    },
    warning: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/40',
      text: 'text-yellow-300',
      button: 'bg-yellow-500/30 hover:bg-yellow-500/40 border-yellow-500/50'
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/40',
      text: 'text-blue-300',
      button: 'bg-blue-500/30 hover:bg-blue-500/40 border-blue-500/50'
    }
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-md p-6 rounded-2xl border ${styles.bg} ${styles.border} backdrop-blur-xl`}
          >
            {/* Title */}
            <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>

            {/* Message */}
            <p className="text-white/70 mb-6">{message}</p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 px-4 py-3 rounded-xl font-medium border ${styles.button} ${styles.text} transition-all`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
