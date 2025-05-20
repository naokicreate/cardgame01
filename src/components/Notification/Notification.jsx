import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Notification.css';

const Notification = ({ message, type, onClose }) => {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className={`notification ${type}`}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
        >
          <div className="notification-content">
            {type === 'error' && <span className="icon">⚠️</span>}
            {type === 'success' && <span className="icon">✅</span>}
            {type === 'info' && <span className="icon">ℹ️</span>}
            {message}
          </div>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Notification;
