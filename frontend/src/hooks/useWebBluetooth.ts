import { useState, useCallback } from 'react';

export const BLE_SERVICE_UUID = '4fa21234-8e3a-45c2-965e-04f76c3f1234';
export const BLE_CONFIG_CHAR_UUID = '4fa21234-8e3a-45c2-965e-04f76c3f1002';
export const BLE_STATUS_CHAR_UUID = '4fa21234-8e3a-45c2-965e-04f76c3f1001';

export type BLEStatus = 'idle' | 'scanning' | 'connecting' | 'sending' | 'success' | 'error';

export interface UseWebBluetoothReturn {
  isSupported: boolean;
  status: BLEStatus;
  statusMessage: string;
  error: string | null;
  sendWifiConfig: (ssid: string, pass: string) => Promise<boolean>;
  sendWsConfig: (wsUrl: string) => Promise<boolean>;
  sendCalibrationCmd: () => Promise<boolean>;
  resetStatus: () => void;
}

export function useWebBluetooth(): UseWebBluetoothReturn {
  const isSupported = typeof window !== 'undefined' && 'bluetooth' in navigator;
  const [status, setStatus] = useState<BLEStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setStatusMessage('');
    setError(null);
  }, []);

  const sendPayloadToChar = useCallback(async (payload: string | Uint8Array): Promise<boolean> => {
    if (!isSupported) {
      setError('이 브라우저는 Web Bluetooth API를 지원하지 않습니다. Chrome, Edge 또는 Android Chrome을 사용해주세요.');
      setStatus('error');
      return false;
    }

    try {
      setStatus('scanning');
      setStatusMessage('주변 ESP32 약통 기기(SmartPillBox)를 탐색 중입니다...');
      setError(null);

      const navBt = (navigator as any).bluetooth;
      const device = await navBt.requestDevice({
        filters: [{ namePrefix: 'SmartPillBox' }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      setStatus('connecting');
      setStatusMessage(`[${device.name || 'SmartPillBox'}] 기기에 BLE 연결을 시도합니다...`);

      const server = await device.gatt.connect();

      setStatusMessage('GATT 서비스 정보를 읽어오는 중...');
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const configChar = await service.getCharacteristic(BLE_CONFIG_CHAR_UUID);

      setStatus('sending');
      setStatusMessage('ESP32 기기로 설정 데이터를 전송 중입니다...');

      const encoder = new TextEncoder();
      const dataBuffer = typeof payload === 'string' ? encoder.encode(payload) : payload;

      await configChar.writeValue(dataBuffer);

      setStatus('success');
      setStatusMessage('설정이 성공적으로 전송되었습니다! ESP32 기기가 새로운 설정으로 재부팅됩니다.');

      setTimeout(() => {
        if (device.gatt && device.gatt.connected) {
          device.gatt.disconnect();
        }
      }, 1000);

      return true;
    } catch (err: any) {
      console.error('[WebBluetooth Error]', err);
      if (err.name === 'NotFoundError') {
        setStatus('idle');
        setStatusMessage('기기 선택이 취소되었습니다.');
      } else {
        setStatus('error');
        const errMsg = err.message || 'BLE 데이터 전송 중 오류가 발생했습니다.';
        setError(errMsg);
        setStatusMessage(`오류 발생: ${errMsg}`);
      }
      return false;
    }
  }, [isSupported]);

  const sendWifiConfig = useCallback(async (ssid: string, pass: string): Promise<boolean> => {
    const cleanSsid = ssid.trim();
    const cleanPass = pass.trim();
    if (!cleanSsid) {
      setError('Wi-Fi SSID를 입력해주세요.');
      setStatus('error');
      return false;
    }
    const payload = `WIFI:${cleanSsid},${cleanPass}`;
    return sendPayloadToChar(payload);
  }, [sendPayloadToChar]);

  const sendWsConfig = useCallback(async (wsUrl: string): Promise<boolean> => {
    const cleanUrl = wsUrl.trim();
    if (!cleanUrl) {
      setError('WebSocket URL을 입력해주세요.');
      setStatus('error');
      return false;
    }
    const payload = `WS:${cleanUrl}`;
    return sendPayloadToChar(payload);
  }, [sendPayloadToChar]);

  const sendCalibrationCmd = useCallback(async (): Promise<boolean> => {
    const cmd = new Uint8Array([0x01]);
    return sendPayloadToChar(cmd);
  }, [sendPayloadToChar]);

  return {
    isSupported,
    status,
    statusMessage,
    error,
    sendWifiConfig,
    sendWsConfig,
    sendCalibrationCmd,
    resetStatus,
  };
}
