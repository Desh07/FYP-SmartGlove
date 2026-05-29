import {
  BLE_SERVICE_UUID,
  BLE_CHAR_UUID,
  BLE_DEVICE_NAME,
  parseBinaryPayload,
  type SensorData,
  type GloveDevice,
  type ConnectionState,
  type IGloveConnection,
} from './bleTypes';

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: any): Promise<BluetoothDevice>;
    };
  }
  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: {
      connect(): Promise<BluetoothRemoteGATTServer>;
      connected: boolean;
      disconnect(): void;
    };
    addEventListener(type: string, listener: () => void): void;
  }
  interface BluetoothRemoteGATTServer {
    getPrimaryService(service: string | number): Promise<BluetoothGATTService>;
  }
  interface BluetoothGATTService {
    getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  interface BluetoothRemoteGATTCharacteristic {
    value?: DataView;
    startNotifications(): Promise<any>;
    stopNotifications(): Promise<any>;
    addEventListener(type: string, listener: (e: any) => void): void;
    removeEventListener(type: string, listener: (e: any) => void): void;
  }
}

export class WebBleConnection implements IGloveConnection {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private state: ConnectionState = 'disconnected';
  private dataCallbacks: Set<(data: SensorData) => void> = new Set();
  private stateCallbacks: Set<(state: ConnectionState) => void> = new Set();

  async scan(): Promise<GloveDevice[]> {
    console.log('[WebBleConnection] scan() initiated');
    if (!(navigator as any).bluetooth) {
      console.error('[WebBleConnection] Navigator has no bluetooth object. Check secure context (HTTPS/localhost) and browser support.');
      throw new Error('Web Bluetooth not supported. Use Chrome/Edge or verify secure context.');
    }

    this.setState('scanning');

    try {
      console.log('[WebBleConnection] Requesting bluetooth device. Filtering by Service UUID:', BLE_SERVICE_UUID);
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
      });

      console.log('[WebBleConnection] Device selected by user:', device.name, '(', device.id, ')');
      this.device = device;
      return [{ id: device.id, name: device.name || BLE_DEVICE_NAME }];
    } catch (err: any) {
      console.error('[WebBleConnection] scan() failed with error:', err);
      this.setState('disconnected');
      if (err.name === 'NotFoundError') {
        console.log('[WebBleConnection] User cancelled the device chooser popup.');
        return [];
      }
      throw err;
    }
  }

  async connect(deviceId?: string): Promise<void> {
    console.log('[WebBleConnection] connect() initiated for device:', deviceId);
    if (!this.device) {
      console.error('[WebBleConnection] No active device selected. Call scan() first.');
      throw new Error('No device selected. Call scan() first.');
    }

    this.setState('connecting');

    try {
      console.log('[WebBleConnection] Connecting to GATT server...');
      const server = await this.device.gatt!.connect();
      console.log('[WebBleConnection] GATT server connected. Fetching service:', BLE_SERVICE_UUID);

      // Get the HandGlow service
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      console.log('[WebBleConnection] Service fetched. Fetching characteristic:', BLE_CHAR_UUID);

      // Get the sensor data characteristic
      this.characteristic = await service.getCharacteristic(BLE_CHAR_UUID);
      console.log('[WebBleConnection] Characteristic fetched. Starting notifications...');

      // Subscribe to notifications
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleNotification
      );

      // Handle unexpected disconnection
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);

      this.setState('connected');
    } catch (err) {
      this.setState('disconnected');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleNotification
        );
        try {
          await this.characteristic.stopNotifications();
        } catch (_) {
          // May fail if already disconnected
        }
        this.characteristic = null;
      }

      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch (_) {
      // Best-effort cleanup
    } finally {
      this.device = null;
      this.setState('disconnected');
    }
  }

  onData(callback: (data: SensorData) => void): void {
    this.dataCallbacks.add(callback);
  }

  offData(callback: (data: SensorData) => void): void {
    this.dataCallbacks.delete(callback);
  }

  getState(): ConnectionState {
    return this.state;
  }

  onStateChange(callback: (state: ConnectionState) => void): void {
    this.stateCallbacks.add(callback);
  }

  // ─── Private ───

  private setState(newState: ConnectionState): void {
    this.state = newState;
    this.stateCallbacks.forEach(cb => cb(newState));
  }

  private handleNotification = (event: Event): void => {
    const target = event.target as any;
    const value = target?.value;
    if (!value) return;

    const sensorData = parseBinaryPayload(value.buffer as ArrayBuffer);
    if (sensorData) {
      this.dataCallbacks.forEach(cb => cb(sensorData));
    }
  };

  private handleDisconnect = (): void => {
    this.characteristic = null;
    this.setState('disconnected');
  };
}
