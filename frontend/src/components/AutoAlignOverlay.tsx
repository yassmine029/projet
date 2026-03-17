import React, { useEffect, useState } from 'react';

// ✅ BUG 3 CORRIGÉ : interface étendue pour supporter les métriques MINE (MI)
// et les métriques manuelles (RMSE/corrélation)
interface QualityMetrics {
  // Métrique principale IRM/PET — retournée par MINE ET par align() corrigé
  mutual_information?: number;
  mi_quality?: string;
  // Métriques complémentaires — retournées par align()
  rmse?: number;
  normalized_rmse?: number;
  correlation?: number;
  quality_score?: number;
  processing_time_ms?: number;
  success: boolean;
}

interface AutoAlignOverlayProps {
  isVisible: boolean;
  status: 'processing' | 'success' | 'error';
  metrics?: QualityMetrics;
  errorMessage?: string;
  onClose?: () => void;
  algorithm?: 'ANTs' | 'MINE';
}

const AutoAlignOverlay: React.FC<AutoAlignOverlayProps> = ({
  isVisible,
  status,
  metrics,
  errorMessage,
  onClose,
  algorithm = 'MINE',
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status === 'processing') {
      setElapsedTime(0);
      setProgress(0);
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 0.1);
        setProgress((prev) => prev < 90 ? prev + (90 - prev) * 0.05 : prev);
      }, 100);
      return () => clearInterval(timer);
    } else if (status === 'success') {
      setProgress(100);
    }
  }, [status]);

  if (!isVisible) return null;

  // ✅ Helpers pour affichage MI
  const mi = metrics?.mutual_information;
  const miQuality = metrics?.mi_quality || (
    mi === undefined ? 'N/A' :
      mi > 0.5 ? 'Excellent' :
        mi > 0.3 ? 'Bon' : 'Faible'
  );
  const miColor = mi === undefined ? '#94a3b8' :
    mi > 0.5 ? '#10b981' :
      mi > 0.3 ? '#3b82f6' : '#f97316';
  const miPercent = mi !== undefined ? Math.min(100, (mi / 0.6) * 100) : 0;

  return (
    <div className="auto-align-overlay">
      <div className="overlay-backdrop" onClick={status !== 'processing' ? onClose : undefined} />

      <div className={`overlay-content state-${status}`}>
        {/* ── PROCESSING ── */}
        {status === 'processing' && (
          <div className="processing-state">
            <div className="spinner-container">
              <div className="spinner-glow"></div>
              <div className="spinner">
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-percentage">{Math.round(progress)}%</div>
              </div>
            </div>
            <h2 className="overlay-title">Analyse en cours...</h2>
            <p className="overlay-subtitle">
              {algorithm === 'MINE'
                ? "Le modèle Deep Learning MINE synchronise vos images"
                : "L'algorithme ANTs SyN recalage vos données"}
            </p>
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div className="progress-fill" style={{ width: `${progress}%` }}>
                  <div className="progress-light" />
                </div>
              </div>
            </div>
            <div className="elapsed-time">
              <span className="time-label">Temps écoulé :</span>
              <span className="time-value">{elapsedTime.toFixed(1)}s</span>
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === 'success' && (
          <div className="success-state animate-fade-up">
            <div className="success-icon-wrapper">
              <div className="success-icon-bg"></div>
              <div className="success-icon-glow"></div>
              <div className="success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>

            <h2 className="overlay-title">Recalage Terminé</h2>
            <p className="overlay-subtitle">Alignement optimal atteint avec succès</p>

            <div className="metrics-container">
              {/* Main Metric: Mutual Information */}
              <div className="main-metric-card" style={{ '--accent-color': miColor } as any}>
                <div className="main-metric-header">
                  <span className="metric-tag">Score Global</span>
                  <div className={`quality-badge ${miQuality.toLowerCase()}`}>
                    {miQuality}
                  </div>
                </div>
                <div className="main-metric-body">
                  <div className="metric-label">Information Mutuelle</div>
                  <div className="metric-value-wrapper">
                    <span className="metric-value">{mi !== undefined ? mi.toFixed(4) : 'N/A'}</span>
                  </div>
                </div>
                <div className="visual-gauge">
                  <div className="gauge-track">
                    <div className="gauge-fill" style={{ width: `${miPercent}%`, background: miColor }} />
                  </div>
                  <div className="gauge-labels">
                    <span>Faible</span>
                    <span>Excellent</span>
                  </div>
                </div>
              </div>

              {/* Secondary Metrics Row */}
              <div className="secondary-metrics-row">
                {metrics?.processing_time_ms !== undefined && metrics.processing_time_ms > 0 && (
                  <div className="secondary-card">
                    <div className="card-icon">⚡</div>
                    <div className="card-content">
                      <span className="card-label">Temps GPU</span>
                      <span className="card-value">{(metrics.processing_time_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                )}
                {metrics?.rmse !== undefined && (
                  <div className="secondary-card">
                    <div className="card-icon">🎯</div>
                    <div className="card-content">
                      <span className="card-label">RMSE</span>
                      <span className="card-value">{metrics.rmse.toFixed(3)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="actions-wrapper">
              <button className="primary-button" onClick={onClose}>
                Terminer la session
                <div className="btn-effect" />
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="error-state animate-shake">
            <div className="error-icon-wrapper">
              <div className="error-icon">✕</div>
            </div>
            <h2 className="overlay-title">Échec du Recalage</h2>
            <p className="overlay-subtitle error-msg">{errorMessage || 'Une erreur système est survenue'}</p>
            <div className="error-advice">
              <div className="advice-header">Conseils pour réussir :</div>
              <ul className="advice-list">
                <li>Essayez de marquer quelques points manuellement avant</li>
                <li>Vérifiez le contraste de vos images</li>
                <li>Redémarrez le processus d'importation</li>
              </ul>
            </div>
            <button className="error-button" onClick={onClose}>Réessayer</button>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');

        .auto-align-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          color: white;
        }

        .overlay-backdrop {
          backdrop-filter: blur(8px);
          animation: fadeIn 0.4s ease-out;
        }
 
        .overlay-content {
          position: relative;
          width: 500px; max-width: 90%;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 32px;
          padding: 2.5rem 2rem;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.1), inset 0 0 1px 1px rgba(255, 255, 255, 0.5);
          overflow: hidden;
        }
 
        /* Animations */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes successGlow { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
        
        .animate-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }

        .overlay-title {
          font-family: 'Sora', sans-serif;
          font-size: 1.5rem; font-weight: 700; color: #0f172a;
          text-align: center; margin-bottom: 0.25rem; letter-spacing: -0.01em;
        }
        .overlay-subtitle {
          font-size: 0.9rem; color: #64748b;
          text-align: center; margin-bottom: 2rem;
          font-weight: 400;
        }
 
         /* Success Icon */
         .success-icon-wrapper {
           position: relative; width: 64px; height: 64px; margin: 0 auto 1.25rem;
           display: flex; align-items: center; justify-content: center;
         }
         .success-icon-bg {
           position: absolute; inset: 0; background: #10b981; border-radius: 50%;
           box-shadow: 0 8px 16px rgba(16, 185, 129, 0.2);
         }
         .success-icon-glow {
           position: absolute; inset: -10px; background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
           animation: successGlow 3s ease-in-out infinite;
         }
         .success-icon { position: relative; color: white; width: 32px; height: 32px; }
 
         /* Metrics */
         .metrics-container { margin-bottom: 2.5rem; width: 100%; }
 
         .main-metric-card {
           background: #f8fafc;
           border: 1px solid #f1f5f9;
           border-radius: 24px; padding: 1.5rem; margin-bottom: 1rem;
           position: relative; overflow: hidden;
           box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);
         }
         .main-metric-card::before {
           content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
           background: var(--accent-color);
         }
 
         .main-metric-header {
           display: flex; justify-content: space-between; align-items: center;
           margin-bottom: 1.25rem;
         }
         .metric-tag { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em; }
         .quality-badge { 
           padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800;
           box-shadow: 0 2px 8px rgba(0,0,0,0.05);
         }
         .quality-badge.excellent { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.15); }
         .quality-badge.bon { background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.15); }
         .quality-badge.faible { background: rgba(249, 115, 22, 0.1); color: #d97706; border: 1px solid rgba(249, 115, 22, 0.15); }
 
         .metric-label { font-size: 0.85rem; color: #64748b; margin-bottom: 0.35rem; }
         .metric-value-wrapper { margin-bottom: 1rem; }
         .metric-value { font-family: 'Sora', sans-serif; font-size: 2.25rem; font-weight: 700; color: #0f172a; display: block; }
 
         .visual-gauge { width: 100%; }
         .gauge-track { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem; }
         .gauge-fill { height: 100%; border-radius: 4px; transition: width 1.5s cubic-bezier(0.16, 1, 0.3, 1); }
         .gauge-labels { display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
 
         .secondary-metrics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
         .secondary-card {
           background: #ffffff; border: 1px solid #f1f5f9;
           border-radius: 20px; padding: 1rem; display: flex; gap: 0.75rem; align-items: center;
           box-shadow: 0 2px 4px rgba(0,0,0,0.02);
           transition: background 0.3s ease;
         }
         .secondary-card:hover { background: #f8fafc; }
         .card-icon { font-size: 1.25rem; opacity: 0.8; }
         .card-label { font-size: 0.75rem; color: #94a3b8; display: block; font-weight: 600; margin-bottom: 0.15rem; }
         .card-value { font-family: 'Sora', sans-serif; font-size: 1.15rem; font-weight: 700; color: #1e293b; display: block; }
 
         /* Button */
         .actions-wrapper { display: flex; justify-content: center; }
         .primary-button {
           position: relative; width: 100%; padding: 0.9rem;
           background: #0f172a;
           color: white; border: none; border-radius: 14px;
           font-size: 0.95rem; font-weight: 600; cursor: pointer;
           box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
           transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
         }
         .primary-button:hover {
           transform: translateY(-2px);
           box-shadow: 0 12px 30px rgba(15, 23, 42, 0.25);
           background: #1e293b;
         }
         .primary-button:active { transform: translateY(0); }
 
         /* Processing */
         .spinner-container { position: relative; width: 140px; height: 140px; margin: 0 auto 2.5rem; }
         .spinner-glow { position: absolute; inset: -20px; background: radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%); animation: pulseGlow 2s infinite; }
         @keyframes pulseGlow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
         
         .spinner { position: relative; width: 100%; height: 100%; }
         .spinner-ring {
           position: absolute; inset: 0; border: 4px solid #f1f5f9; border-top-color: #3b82f6; border-radius: 50%;
           animation: spin 2s linear infinite;
         }
         .spinner-ring:nth-child(2) { inset: 12px; border-top-color: #8b5cf6; animation-duration: 2.5s; animation-direction: reverse; }
         .spinner-ring:nth-child(3) { inset: 24px; border-top-color: #ec4899; animation-duration: 3s; }
         @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
         
         .spinner-percentage {
           position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
           font-family: 'Sora', sans-serif; font-size: 1.75rem; font-weight: 800; color: #0f172a;
         }
 
         .progress-container { margin-bottom: 2rem; }
         .progress-bar-bg { height: 10px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
         .progress-fill { position: relative; height: 100%; background: linear-gradient(90deg, #3b82f6, #8062f8); border-radius: 6px; transition: width 0.4s ease; }
         .progress-light {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 2s infinite;
        }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
 
         .elapsed-time { display: flex; gap: 0.5rem; justify-content: center; align-items: center; }
         .time-label { font-size: 0.9rem; color: #94a3b8; font-weight: 500; }
         .time-value { font-family: 'Sora', sans-serif; font-size: 1.1rem; font-weight: 700; color: #0f172a; }
 
         /* Error state */
         .error-icon-wrapper { width: 70px; height: 70px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #ef4444; margin: 0 auto 1.5rem; box-shadow: 0 0 20px rgba(239, 68, 68, 0.2); }
         .error-msg { color: #ef4444; font-weight: 600; }
         .error-advice { text-align: left; background: #fef2f2; padding: 1.5rem; border-radius: 20px; margin-bottom: 2rem; border: 1px solid #fee2e2; }
         .advice-header { font-weight: 700; color: #1e293b; margin-bottom: 0.75rem; font-size: 0.95rem; }
         .advice-list { list-style: none; padding: 0; margin: 0; }
         .advice-list li { position: relative; padding-left: 1.25rem; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; }
         .advice-list li::before { content: '•'; position: absolute; left: 0; color: #ef4444; font-weight: bold; }
         .error-button { width: 100%; padding: 1rem; background: #e2e8f0; color: #475569; border: none; border-radius: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
         .error-button:hover { background: #cbd5e1; color: #1e293b; }
      `}</style>
    </div>
  );
};

export default AutoAlignOverlay;