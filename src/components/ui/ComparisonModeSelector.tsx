'use client';

/**
 * 비교 모드 선택기 컴포넌트
 * 단일 지역 / 프리셋 비교 모드 전환
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Preset,
  RegionPreset,
  getRegionPresets,
  getHospitalPresets,
  addRegionPreset,
  deletePreset,
  getLastUsedPreset,
  setLastUsedPreset,
  getPresetById
} from '@/lib/utils/presetStorage';
import { REGIONS } from '@/lib/constants/dger';

export type SelectionMode = 'single' | 'comparison';

interface ComparisonModeSelectorProps {
  isDark: boolean;
  mode: SelectionMode;
  onModeChange: (mode: SelectionMode) => void;
  // 단일 모드
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  // 비교 모드
  selectedPresetId: string | null;
  onPresetChange: (presetId: string | null, preset: Preset | null) => void;
}

export default function ComparisonModeSelector({
  isDark,
  mode,
  onModeChange,
  selectedRegion,
  onRegionChange,
  selectedPresetId,
  onPresetChange
}: ComparisonModeSelectorProps) {
  const [regionPresets, setRegionPresets] = useState<RegionPreset[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetRegions, setNewPresetRegions] = useState<string[]>([]);

  // 프리셋 목록 로드
  useEffect(() => {
    setRegionPresets(getRegionPresets());
  }, []);

  // 마지막 사용 프리셋 복원
  useEffect(() => {
    if (mode === 'comparison' && !selectedPresetId) {
      const lastUsed = getLastUsedPreset();
      if (lastUsed) {
        const preset = getPresetById(lastUsed);
        if (preset) {
          onPresetChange(lastUsed, preset);
        }
      }
    }
  }, [mode, selectedPresetId, onPresetChange]);

  const handleModeToggle = useCallback(() => {
    const newMode = mode === 'single' ? 'comparison' : 'single';
    onModeChange(newMode);
  }, [mode, onModeChange]);

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = getPresetById(presetId);
    if (preset) {
      onPresetChange(presetId, preset);
      setLastUsedPreset(presetId);
    }
  }, [onPresetChange]);

  const handleAddPreset = useCallback(() => {
    if (!newPresetName.trim() || newPresetRegions.length < 2) {
      return;
    }

    const result = addRegionPreset(newPresetName.trim(), newPresetRegions);
    if (result) {
      setRegionPresets(getRegionPresets());
      setShowAddModal(false);
      setNewPresetName('');
      setNewPresetRegions([]);
      // 새로 추가한 프리셋 선택
      onPresetChange(result.id, result);
      setLastUsedPreset(result.id);
    }
  }, [newPresetName, newPresetRegions, onPresetChange]);

  const handleDeletePreset = useCallback((presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletePreset(presetId)) {
      setRegionPresets(getRegionPresets());
      if (selectedPresetId === presetId) {
        onPresetChange(null, null);
      }
    }
  }, [selectedPresetId, onPresetChange]);

  const toggleRegionForNewPreset = useCallback((region: string) => {
    setNewPresetRegions(prev =>
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  }, []);

  const buttonBaseStyle = `px-3 py-1.5 text-sm rounded border h-9 transition-colors whitespace-nowrap`;
  const activeButtonStyle = isDark
    ? 'bg-gray-600 border-gray-500 text-white'
    : 'bg-[#4A5D5D] border-[#4A5D5D] text-white';
  const inactiveButtonStyle = isDark
    ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100';

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {/* 모드 토글 버튼 */}
      <button
        onClick={handleModeToggle}
        className={`${buttonBaseStyle} ${mode === 'comparison' ? activeButtonStyle : inactiveButtonStyle}`}
        title={mode === 'single' ? '비교 모드로 전환' : '단일 지역 모드로 전환'}
      >
        <span className="sm:hidden">{mode === 'single' ? '단일' : '비교'}</span>
        <span className="hidden sm:inline">{mode === 'single' ? '단일 지역' : '비교 모드'}</span>
      </button>

      {/* 단일 모드: 지역 선택 */}
      {mode === 'single' && (
        <select
          value={selectedRegion}
          onChange={(e) => onRegionChange(e.target.value)}
          className={`px-2 py-1.5 border rounded text-sm h-9 ${
            isDark
              ? 'bg-gray-800 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          }`}
          style={{ minWidth: '70px' }}
        >
          {REGIONS.map(region => (
            <option key={region.value} value={region.value}>
              {region.value}
            </option>
          ))}
        </select>
      )}

      {/* 비교 모드: 프리셋 선택 */}
      {mode === 'comparison' && (
        <>
          <select
            value={selectedPresetId || ''}
            onChange={(e) => handlePresetSelect(e.target.value)}
            className={`px-2 py-1.5 border rounded text-sm h-9 ${
              isDark
                ? 'bg-gray-800 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            style={{ minWidth: '100px' }}
          >
            <option value="" disabled>프리셋 선택</option>
            <optgroup label="기본 프리셋">
              {regionPresets.filter(p => p.isBuiltIn).map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.regions.join('+')})
                </option>
              ))}
            </optgroup>
            {regionPresets.some(p => !p.isBuiltIn) && (
              <optgroup label="내 프리셋">
                {regionPresets.filter(p => !p.isBuiltIn).map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({preset.regions.join('+')})
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* 프리셋 추가 버튼 */}
          <button
            onClick={() => setShowAddModal(true)}
            className={`${buttonBaseStyle} ${inactiveButtonStyle}`}
            title="새 프리셋 추가"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ 프리셋</span>
          </button>

          {/* 선택된 커스텀 프리셋 삭제 버튼 */}
          {selectedPresetId && !regionPresets.find(p => p.id === selectedPresetId)?.isBuiltIn && (
            <button
              onClick={(e) => handleDeletePreset(selectedPresetId, e)}
              className={`px-2 py-1.5 text-sm rounded border h-9 transition-colors ${
                isDark
                  ? 'bg-red-900/50 border-red-700 text-red-300 hover:bg-red-900'
                  : 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
              }`}
              title="프리셋 삭제"
            >
              삭제
            </button>
          )}
        </>
      )}

      {/* 프리셋 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`rounded-lg shadow-xl p-4 w-80 max-w-[90vw] ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              새 프리셋 추가
            </h3>

            {/* 프리셋 이름 */}
            <div className="mb-4">
              <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                프리셋 이름
              </label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="예: 내 지역"
                className={`w-full px-3 py-2 border rounded text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            {/* 지역 선택 */}
            <div className="mb-4">
              <label className={`block text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                지역 선택 (2개 이상)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {REGIONS.map(region => (
                  <button
                    key={region.value}
                    onClick={() => toggleRegionForNewPreset(region.value)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      newPresetRegions.includes(region.value)
                        ? (isDark ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-500 border-blue-500 text-white')
                        : (isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-700')
                    }`}
                  >
                    {region.value}
                  </button>
                ))}
              </div>
              {newPresetRegions.length > 0 && (
                <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  선택됨: {newPresetRegions.join(', ')}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewPresetName('');
                  setNewPresetRegions([]);
                }}
                className={`px-4 py-2 text-sm rounded border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                취소
              </button>
              <button
                onClick={handleAddPreset}
                disabled={!newPresetName.trim() || newPresetRegions.length < 2}
                className={`px-4 py-2 text-sm rounded border ${
                  !newPresetName.trim() || newPresetRegions.length < 2
                    ? (isDark ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed' : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed')
                    : (isDark ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500' : 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600')
                }`}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
