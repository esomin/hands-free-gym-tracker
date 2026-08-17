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
  IconAdjustments,
  IconCopy,
  IconPlus,
} from '@tabler/icons-react';

interface WifiProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterWithDevice?: (deviceId: string) => void;
}

export const WifiProvisionModal: React.FC<WifiProvisionModalProps> = ({
  isOpen,
  onClose,
  onRegisterWithDevice,
}) => {
  const [isCopied, setIsCopied] = useState(false);
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
      return localStorage.getItem('last_ws_url') || 'ws://172.30.1.28:8000/ws/user-1';
    } catch (_) {
      return 'ws://172.30.1.28:8000/ws/user-1';
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    isSupported,
    status,
    statusMessage,
    error,
    connectedDeviceName,
    connectBleDevice,
    sendWifiConfig,
    sendWsConfig,
    sendCalibrationCmd,
    disconnectBleDevice,
    resetStatus,
  } = useWebBluetooth();

  if (!isOpen) return null;

  const isProcessing = status === 'scanning' || status === 'connecting' || status === 'sending';
  const isSuccess = status === 'success';

  const handleCopyDeviceId = () => {
    if (!connectedDeviceName) return;
    navigator.clipboard.writeText(connectedDeviceName);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Step 1: BLE 연결
  const handleConnectBle = async () => {
    await connectBleDevice();
  };

  // Step 2: Wi-Fi 설정 BLE 전송
  const handleSubmitProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuccess || isProcessing || !connectedDeviceName || !ssid.trim()) return;
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
    disconnectBleDevice();
    resetStatus();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full transition-all duration-200 relative">

        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <IconWifi size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">기기 Wi-Fi / BLE 설정</h2>
              <p className="text-[11px] text-gray-500 font-normal">ESP32 약통 기기의 Wi-Fi 자격 증명을 BLE로 설정합니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer !text-xs"
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
            <div>
              {/* Step 1: 기기 연결 전 화면 */}
              {!connectedDeviceName ? (
                <div className="space-y-4 text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                    <IconBluetooth size={28} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">1단계: ESP32 약통 기기 탐색 및 연결</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                      ESP32 약통 기기의 전원을 켜고 아래 버튼을 눌러 블루투스로 연결해 주세요.
                    </p>
                  </div>

                  {statusMessage && (
                    <div className="p-3 rounded-lg text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 text-left flex items-start gap-2">
                      {isProcessing && <IconLoader2 size={16} className="animate-spin text-indigo-600 shrink-0 mt-0.5" />}
                      <span>{statusMessage}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleConnectBle}
                    disabled={isProcessing}
                    className="w-full py-3 px-4 rounded-lg !text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <IconLoader2 size={16} className="animate-spin" />
                        <span>주변 기기 탐색 중...</span>
                      </>
                    ) : (
                      <>
                        <IconBluetooth size={16} />
                        <span>1단계: 주변 ESP32 약통 기기 선택</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Step 2: Wi-Fi 설정 전송 폼 */
                <form onSubmit={handleSubmitProvision} className="space-y-3.5">
                  {/* Connected Device Badge - 약통 등록 버튼 색상(Teal 톤)과 통일 */}
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-teal-900 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                      <span>연결된 기기: <strong className="font-mono text-teal-950 font-bold">{connectedDeviceName}</strong></span>
                      <button
                        type="button"
                        onClick={handleCopyDeviceId}
                        className="p-1 hover:bg-teal-100/80 rounded text-teal-700 hover:text-teal-900 transition-colors cursor-pointer flex items-center gap-0.5"
                        title="기기 ID 클립보드 복사"
                      >
                        {isCopied ? (
                          <IconCheck size={14} className="text-teal-600 font-bold" />
                        ) : (
                          <IconCopy size={14} />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={disconnectBleDevice}
                      className="!text-[11px] font-semibold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                    >
                      다른 기기 선택
                    </button>
                  </div>

                  {/* Wi-Fi 설정 입력 */}
                  <div>
                    <label className="block !text-xs font-semibold text-gray-700 mb-0.5">
                      Wi-Fi 이름 (SSID) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
                        <IconWifi size={14} />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="예: Home_WiFi_2G"
                        value={ssid}
                        onChange={(e) => setSsid(e.target.value)}
                        disabled={isProcessing}
                        className="w-full pl-7 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md !text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block !text-xs font-semibold text-gray-700 mb-0.5">
                      Wi-Fi 비밀번호
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
                        <IconLock size={14} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="비밀번호 입력"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isProcessing}
                        className="w-full pl-7 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-md !text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showPassword ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Status Banner */}
                  {statusMessage && (
                    status === 'success' ? (
                      <div className="pt-0.5 pb-0 !text-xs flex items-center justify-center gap-1.5 text-indigo-600 font-semibold text-center animate-fade-in">
                        <IconCheck size={15} className="text-indigo-600 shrink-0" />
                        <span>{statusMessage}</span>
                      </div>
                    ) : (
                      <div
                        className={`p-2.5 rounded-md !text-xs flex items-start gap-2 border transition-all ${status === 'error'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                          }`}
                      >
                        {isProcessing && <IconLoader2 size={15} className="animate-spin shrink-0 text-indigo-600 mt-0.5" />}
                        {status === 'error' && <IconAlertCircle size={15} className="shrink-0 text-rose-600 mt-0.5" />}
                        <div className="flex-1">
                          <p className="font-semibold">{statusMessage}</p>
                          {error && <p className="mt-0.5 text-[11px] opacity-90 font-mono">{error}</p>}
                        </div>
                      </div>
                    )
                  )}

                  {/* Submit Button - 성공 시 상단 간격을 -mt-2로 밀착 */}
                  <button
                    type="submit"
                    disabled={isProcessing || isSuccess || !ssid.trim()}
                    className={`w-full py-2 px-3 rounded-md !text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-xs ${isSuccess ? '-mt-2' : ''} ${isProcessing || !ssid.trim()
                      ? 'bg-gray-300 shadow-none cursor-not-allowed text-gray-500'
                      : isSuccess
                        ? 'bg-indigo-300/80 text-white shadow-none cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 cursor-pointer'
                      }`}
                  >
                    {isProcessing ? (
                      <>
                        <IconLoader2 size={16} className="animate-spin" />
                        <span>전송 처리 중...</span>
                      </>
                    ) : isSuccess ? (
                      <>
                        <IconCheck size={16} />
                        <span>Wi-Fi 설정 전송 완료</span>
                      </>
                    ) : (
                      <>
                        <IconCheck size={16} />
                        <span>ESP32 기기로 Wi-Fi 설정 전송</span>
                      </>
                    )}
                  </button>

                  {/* Wi-Fi 전송 성공 시 원클릭 약통 추가 연동 버튼 노출 */}
                  {isSuccess && onRegisterWithDevice && connectedDeviceName && (
                    <button
                      type="button"
                      onClick={() => onRegisterWithDevice(connectedDeviceName)}
                      className="w-full py-2 px-3 rounded-md !text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs animate-fade-in border border-teal-700 mt-2"
                    >
                      <IconPlus size={15} />
                      <span>이 기기로 약통 추가</span>
                    </button>
                  )}
                </form>
              )}
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="!text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <IconAdjustments size={14} />
              <span>고급 설정 (WebSocket URL 변경 및 영점 조절)</span>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-2.5 bg-teal-50/40 rounded-md space-y-2.5 border border-teal-100 !text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-0.5">
                    WebSocket 백엔드 주소
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={wsUrl}
                      onChange={(e) => setWsUrl(e.target.value)}
                      placeholder="ws://172.30.1.28:8000/ws/user-1"
                      className="flex-1 px-2.5 py-1 bg-white border border-gray-200 rounded-md !text-xs font-mono focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendWs}
                      disabled={isProcessing || !connectedDeviceName}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-md font-semibold !text-xs hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 cursor-pointer shrink-0 transition-colors shadow-2xs"
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
                    disabled={isProcessing || !connectedDeviceName}
                    className="px-3 py-1.5 bg-teal-500 text-white rounded-md font-semibold !text-xs hover:bg-teal-600 active:bg-teal-700 disabled:opacity-50 cursor-pointer shrink-0 transition-colors shadow-2xs"
                  >
                    영점 조절
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 rounded-b-xl">
          <span>기기 식별 패턴: <strong className="text-gray-700 font-mono">SmartPillBox_*</strong></span>
          <button
            type="button"
            onClick={handleClose}
            className="hover:underline font-semibold text-gray-600 cursor-pointer !text-xs"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
