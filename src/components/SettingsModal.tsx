import React from 'react';
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
    { value: '1m', label: '1分钟' },
    { value: '5m', label: '5分钟' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">设置</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
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
              {intervals.map((interval) => (
                <button
                  key={interval.value}
                  onClick={() => setRefreshInterval(interval.value)}
                  className={clsx(
                    'flex-1 px-4 py-2 rounded-lg text-sm transition-colors',
                    refreshInterval === interval.value
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                  )}
                >
                  {interval.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 text-white rounded-lg transition-colors"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
