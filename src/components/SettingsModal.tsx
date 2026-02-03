import clsx from 'clsx';
import { useSettingsStore, RefreshInterval } from '../store/settingsStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { refreshInterval, setRefreshInterval } = useSettingsStore();

  if (!isOpen) return null;

  const intervals: Array<{ value: RefreshInterval; label: string }> = [
    { value: '30s', label: '30秒' },
    { value: '60s', label: '60秒' },
    { value: '90s', label: '90秒' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">设置</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary active:text-neon-red active:scale-90 transition-all duration-150 rounded-lg hover:bg-white/5 active:bg-white/10 p-1"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-3">
              自动刷新频率
            </label>
            <div className="flex gap-2">
              {intervals.map((interval) => {
                const isSelected = refreshInterval === interval.value;
                return (
                  <button
                    key={interval.value}
                    onClick={() => setRefreshInterval(interval.value)}
                    className={clsx(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
                      'flex items-center justify-center gap-2',
                      isSelected
                        ? 'bg-neon-blue/20 text-neon-blue border-2 border-neon-blue shadow-[0_0_20px_rgba(0,212,255,0.3)]'
                        : 'bg-white/5 text-text-secondary hover:text-text-primary hover:bg-white/10 border-2 border-transparent'
                    )}
                  >
                    {isSelected && (
                      <i className="ri-check-line text-base" />
                    )}
                    <span>{interval.label}</span>
                    {isSelected && (
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-blue/10 to-transparent pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-neon-blue/20 hover:bg-neon-blue/30 active:bg-neon-blue/40 text-neon-blue rounded-lg font-medium transition-all duration-150 shadow-lg hover:shadow-xl hover:shadow-neon-blue/20 active:shadow-md"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
