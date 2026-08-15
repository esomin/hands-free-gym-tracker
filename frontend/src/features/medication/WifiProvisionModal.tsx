import React, { useState } from 'react';
import { useWebBluetooth } from '../../hooks/useWebBluetooth';
import {
  IconWifi,
  IconBluetooth,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconLoader2,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAdjustments
} from '@tabler/icons-react';

interface WifiProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WifiProvisionModal: React.FC<WifiProvisionModalProps> = ({ isOpen, onClose }) => {
  const [ssid, setSsid] = useState(() => {
    try {
      return localStorage.getItem('last_wifi_ssid') || '';
    } catch (_) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [wsUrl, setWsUrl] = useState(() => {
    try {
      return localStorage.getItem('last_ws_url') || 'ws://192.168.0.10:8000/ws/default_user';
    } catch (_) {
      return 'ws://192.168.0.10:8000/ws/default_user';
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    isSupported,
    status,
    statusMessage,
    error,
    sendWifiConfig,
    sendWsConfig,
    sendCalibrationCmd,
    resetStatus,
  } = useWebBluetooth();

  if (!isOpen) return null;

  const isProcessing = status === 'scanning' || status === 'connecting' || status === 'sending';

  const handleSendWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssid.trim()) return;
    await sendWifiConfig(ssid, password);
  };

  const handleSendWs = async () => {
    if (!wsUrl.trim()) return;
    await sendWsConfig(wsUrl);
  };

  const handleSendCalib = async () => {
    await sendCalibrationCmd();
  };

  const handleClose = () => {
    resetStatus();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden transition-all duration-200">

        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <IconBluetooth size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">ESP32 Wi-Fi / BLE 설정</h2>
              <p className="text-[11px] text-gray-500 font-normal">웹 브라우저 Web Bluetooth API로 Wi-Fi 전송</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Browser Support Alert */}
          {!isSupported ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-amber-800 text-xs">
              <IconAlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Web Bluetooth 미지원 브라우저</p>
                <p className="text-[11px] mt-0.5 text-amber-700">
                  현재 사용 중인 브라우저는 Web Bluetooth API를 지원하지 않습니다.
                  <strong className="ml-1 font-semibold">Chrome, Edge 또는 Android Chrome</strong>을 사용해 주세요.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendWifi} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Wi-Fi 이름 (SSID) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                    <IconWifi size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="예: Home_WiFi_5G"
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    disabled={isProcessing}
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Wi-Fi 비밀번호
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                    <IconLock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호 입력 (공개망인 경우 빈칸)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isProcessing}
                    className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 border transition-all ${status === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : status === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                    }`}
                >
                  {isProcessing && <IconLoader2 size={16} className="animate-spin shrink-0 text-indigo-600 mt-0.5" />}
                  {status === 'success' && <IconCheck size={16} className="shrink-0 text-emerald-600 mt-0.5" />}
                  {status === 'error' && <IconAlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />}
                  <div className="flex-1">
                    <p className="font-semibold">{statusMessage}</p>
                    {error && <p className="mt-0.5 text-[11px] opacity-90 font-mono">{error}</p>}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing || !ssid.trim() || !isSupported}
                className={`w-full py-2.5 px-4 rounded-lg !text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${isProcessing || !ssid.trim() || !isSupported
                  ? 'bg-gray-300 shadow-none cursor-not-allowed text-gray-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                  }`}
              >
                {isProcessing ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>ESP32 연결 및 전송 중...</span>
                  </>
                ) : (
                  <>
                    <IconBluetooth size={16} />
                    <span>BLE로 Wi-Fi 정보 전송하기</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Advanced Settings Toggle */}
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="!text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <IconAdjustments size={15} />
              <span>고급 설정 (WebSocket URL 변경 및 영점 조절)</span>
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 bg-teal-50/40 rounded-lg space-y-3 border border-teal-100 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    WebSocket 백엔드 주소
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={wsUrl}
                      onChange={(e) => setWsUrl(e.target.value)}
                      placeholder="ws://192.168.0.10:8000/ws/default_user"
                      className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-mono focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendWs}
                      disabled={isProcessing || !isSupported}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-md font-semibold hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 cursor-pointer shrink-0 transition-colors shadow-2xs"
                    >
                      전송
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-teal-100 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-800">센서 영점 조절 (Calibration)</p>
                    <p className="text-[11px] text-gray-400">약통을 수평에 두고 오프셋을 초기화합니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCalib}
                    disabled={isProcessing || !isSupported}
                    className="px-3 py-1.5 bg-teal-500 text-white rounded-md font-semibold hover:bg-teal-600 active:bg-teal-700 disabled:opacity-50 cursor-pointer shrink-0 transition-colors shadow-2xs"
                  >
                    영점 조절
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>기기 이름: <strong className="text-gray-700 font-mono">SmartPillBox_*</strong></span>
          <button
            onClick={handleClose}
            className="hover:underline font-semibold text-gray-600 cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
