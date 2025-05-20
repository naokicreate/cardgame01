import React from 'react';
import { motion } from 'framer-motion';
import './PhaseIndicator.css';

const PHASES = {
  START: '開始フェーズ',
  DRAW: 'ドローフェーズ',
  MAIN: 'メインフェーズ',
  BATTLE: 'バトルフェーズ',
  END: '終了フェーズ'
};

const PhaseIndicator = ({ currentPhase, onPhaseChange, isPlayerTurn }) => {
  return (
    <div className="phase-indicator-container">
      <div className={`turn-indicator ${isPlayerTurn ? 'your-turn' : 'opponent-turn'}`}>
        {isPlayerTurn ? 'あなたのターン' : '相手のターン'}
      </div>
      
      <div className="phases">
        {Object.entries(PHASES).map(([phase, label]) => (
          <motion.div
            key={phase}
            className={`phase ${currentPhase === phase ? 'active' : ''}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => isPlayerTurn && onPhaseChange(phase)}
          >
            {label}
            {currentPhase === phase && (
              <motion.div
                className="phase-highlight"
                layoutId="highlight"
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20
                }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PhaseIndicator;
