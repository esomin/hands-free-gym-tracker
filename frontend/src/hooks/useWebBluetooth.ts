import { useState, useCallback } from 'react';

export const BLE_SERVICE_UUID = '4fa21234-8e3a-45c2-965e-04f76c3f1234'.toLowerCase();
export const BLE_CONFIG_CHAR_UUID = '4fa21234-8e3a-45c2-965e-04f76c3f1002'.toLowerCase();
export const BLE_STATUS_CHAR_UUID = '4fa21234-8e3a-45c2-965e-04f76c3f1001'.toLowerCase();

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

    let device: any = null;

    try {
      setStatus('scanning');
      setStatusMessage('주변 ESP32 약통 기기(SmartPillBox)를 탐색 중입니다...');
      setError(null);

      const navBt = (navigator as any).bluetooth;
      
      // Step 1. SmartPillBox 기기 탐색
      console.log('[BLE Step 1] Requesting BLE device...');
      try {
        device = await navBt.requestDevice({
          filters: [
            { namePrefix: 'SmartPillBox' },
            { namePrefix: 'Smart' },
            { namePrefix: 'ESP32' }
          ],
          optionalServices: [BLE_SERVICE_UUID],
        });
      } catch (filterErr: any) {
        if (filterErr.name === 'NotFoundError') {
          throw filterErr;
        }
        console.warn('[BLE Step 1 Warning] 필터 탐색 실패, 전체 기기 검색 모드로 재시도:', filterErr);
        device = await navBt.requestDevice({
          acceptAllDevices: true,
          optionalServices: [BLE_SERVICE_UUID],
        });
      }

      console.log('[BLE Step 1 Complete] Selected Device:', device.name, device.id);

      // Step 2. GATT 서버 연결
      setStatus('connecting');
      setStatusMessage(`[${device.name || 'SmartPillBox'}] 기기에 BLE GATT 연결을 진행합니다...`);
      console.log('[BLE Step 2] Connecting to GATT server...');

      const server: any = await device.gatt.connect();
      console.log('[BLE Step 2 Complete] GATT Connected:', server.connected);

      // Step 3. Primary Service & Characteristic 검색
      setStatusMessage('GATT 서비스 및 특성(Characteristic) 정보를 탐색 중...');
      console.log('[BLE Step 3] Fetching primary service:', BLE_SERVICE_UUID);
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);

      console.log('[BLE Step 3] Fetching characteristic:', BLE_CONFIG_CHAR_UUID);
      const configChar = await service.getCharacteristic(BLE_CONFIG_CHAR_UUID);
      console.log('[BLE Step 3 Complete] Characteristic found:', configChar.uuid);

      // Step 4. 데이터 전송
      setStatus('sending');
      setStatusMessage('ESP32 기기로 설정 데이터를 전송 중입니다...');

      const encoder = new TextEncoder();
      const dataBuffer = typeof payload === 'string' ? encoder.encode(payload) : payload;
      console.log('[BLE Step 4] Writing data buffer to characteristic:', typeof payload === 'string' ? payload : 'Uint8Array');

      try {
        if (typeof configChar.writeValueWithoutResponse === 'function') {
          console.log('[BLE Step 4] Using writeValueWithoutResponse...');
          await configChar.writeValueWithoutResponse(dataBuffer);
        } else if (typeof configChar.writeValueWithResponse === 'function') {
          console.log('[BLE Step 4] Using writeValueWithResponse...');
          await configChar.writeValueWithResponse(dataBuffer);
        } else {
          console.log('[BLE Step 4] Using writeValue...');
          await configChar.writeValue(dataBuffer);
        }
      } catch (writeErr: any) {
        console.warn('[BLE Step 4 Exception]', writeErr);
        // 만약 writeValueWithResponse가 오류를 던졌으나 구형 writeValue로 재시도 가능한 경우
        if (typeof configChar.writeValue === 'function') {
          console.log('[BLE Step 4 Fallback] Retrying with writeValue...');
          await configChar.writeValue(dataBuffer);
        } else {
          throw writeErr;
        }
      }

      console.log('[BLE Step 4 Complete] Data write successfully finished!');

      setStatus('success');
      setStatusMessage('설정이 성공적으로 전송되었습니다! ESP32 기기가 새로운 설정으로 재부팅됩니다.');

      // 1.5초 후 명시적 연결 해제
      setTimeout(() => {
        try {
          if (device && device.gatt && device.gatt.connected) {
            console.log('[BLE Step 5] Disconnecting GATT session.');
            device.gatt.disconnect();
          }
        } catch (_) {}
      }, 1500);

      return true;
    } catch (err: any) {
      console.error('[WebBluetooth Error]', err);
      
      try {
        if (device && device.gatt && device.gatt.connected) {
          device.gatt.disconnect();
        }
      } catch (_) {}

      if (err.name === 'NotFoundError') {
        setStatus('idle');
        setStatusMessage('기기 선택이 취소되었습니다.');
      } else {
        setStatus('error');
        const errMsg = err.message || 'BLE GATT 데이터 전송 중 오류가 발생했습니다.';
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

    try {
      localStorage.setItem('last_wifi_ssid', cleanSsid);
    } catch (_) {}

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

    try {
      localStorage.setItem('last_ws_url', cleanUrl);
    } catch (_) {}

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
