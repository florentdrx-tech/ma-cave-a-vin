/**
 * Connexion à un thermomètre / hygromètre Bluetooth Low Energy via Web Bluetooth.
 *
 * Profils pris en charge :
 *  - Environmental Sensing (0x181A) : température 0x2A6E, humidité 0x2A6F
 *    (capteurs avec firmware pvvx/ATC, nombreux capteurs génériques)
 *  - Xiaomi LYWSD03MMC firmware d'origine (service ebe0ccb0-…)
 *  - Health Thermometer (0x1809) : mesure 0x2A1C
 *
 * Web Bluetooth fonctionne sur Chrome / Edge (Android, Windows, macOS, ChromeOS).
 * Il n'est pas disponible sur iPhone/iPad (Safari) : la saisie manuelle reste possible.
 */

export interface SensorValue {
  temp?: number;
  humidity?: number;
}

const ENV_SENSING = 0x181a;
const TEMP_CHAR = 0x2a6e;
const HUM_CHAR = 0x2a6f;
const HEALTH_THERMO = 0x1809;
const TEMP_MEASUREMENT = 0x2a1c;
const XIAOMI_SERVICE = 'ebe0ccb0-7a0a-4b0c-8a1a-6ff2997da3a6';
const XIAOMI_CHAR = 'ebe0ccc1-7a0a-4b0c-8a1a-6ff2997da3a6';

export function bluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** Décode un nombre IEEE-11073 32 bits (FLOAT) utilisé par le profil Health Thermometer. */
function ieee11073Float(view: DataView, offset: number): number {
  const raw = view.getUint32(offset, true);
  let mantissa = raw & 0x00ffffff;
  const exponent = (raw >> 24) << 24 >> 24; // signé 8 bits
  if (mantissa >= 0x800000) mantissa -= 0x1000000;
  return mantissa * Math.pow(10, exponent);
}

export class ThermometerConnection {
  private device?: BluetoothDevice;
  private value: SensorValue = {};

  constructor(
    private onValue: (v: SensorValue) => void,
    private onDisconnect: () => void,
  ) {}

  get name() {
    return this.device?.name || 'Capteur';
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [ENV_SENSING, HEALTH_THERMO, XIAOMI_SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());
    const server = await this.device.gatt!.connect();

    let found = false;

    // 1. Environmental Sensing
    try {
      const svc = await server.getPrimaryService(ENV_SENSING);
      const t = await svc.getCharacteristic(TEMP_CHAR);
      this.handleEnvTemp(await t.readValue());
      await this.subscribe(t, (dv) => this.handleEnvTemp(dv));
      found = true;
      try {
        const h = await svc.getCharacteristic(HUM_CHAR);
        this.handleEnvHum(await h.readValue());
        await this.subscribe(h, (dv) => this.handleEnvHum(dv));
      } catch {
        /* pas d'humidité */
      }
    } catch {
      /* service absent */
    }

    // 2. Xiaomi d'origine
    if (!found) {
      try {
        const svc = await server.getPrimaryService(XIAOMI_SERVICE);
        const c = await svc.getCharacteristic(XIAOMI_CHAR);
        await this.subscribe(c, (dv) => {
          this.emit({ temp: dv.getInt16(0, true) / 100, humidity: dv.getUint8(2) });
        });
        found = true;
      } catch {
        /* service absent */
      }
    }

    // 3. Health Thermometer
    if (!found) {
      try {
        const svc = await server.getPrimaryService(HEALTH_THERMO);
        const c = await svc.getCharacteristic(TEMP_MEASUREMENT);
        await this.subscribe(c, (dv) => {
          const flags = dv.getUint8(0);
          let t = ieee11073Float(dv, 1);
          if (flags & 1) t = ((t - 32) * 5) / 9; // Fahrenheit -> Celsius
          this.emit({ temp: t });
        });
        found = true;
      } catch {
        /* service absent */
      }
    }

    if (!found) {
      this.disconnect();
      throw new Error("Ce capteur n'expose pas de service de température compatible.");
    }
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }

  private async subscribe(c: BluetoothRemoteGATTCharacteristic, handler: (dv: DataView) => void) {
    if (!c.properties.notify && !c.properties.indicate) return;
    c.addEventListener('characteristicvaluechanged', (e) => {
      const dv = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (dv) handler(dv);
    });
    await c.startNotifications();
  }

  private handleEnvTemp(dv: DataView) {
    this.emit({ ...this.value, temp: dv.getInt16(0, true) / 100 });
  }

  private handleEnvHum(dv: DataView) {
    this.emit({ ...this.value, humidity: dv.getUint16(0, true) / 100 });
  }

  private emit(v: SensorValue) {
    this.value = { ...this.value, ...v };
    this.onValue(this.value);
  }
}

/* ---------- Conditions idéales ---------- */

export const STORAGE = {
  tempMin: 10,
  tempMax: 14,
  tempIdeal: 12,
  humMin: 60,
  humMax: 80,
};

export const SERVING: { label: string; range: string }[] = [
  { label: 'Effervescents (champagne, crémant)', range: '6 – 8 °C' },
  { label: 'Blancs secs légers, rosés', range: '8 – 10 °C' },
  { label: 'Blancs de garde (Bourgogne, Graves…)', range: '11 – 13 °C' },
  { label: 'Liquoreux (Sauternes, Vouvray moelleux…)', range: '8 – 10 °C' },
  { label: 'Rouges légers (Beaujolais, Loire)', range: '13 – 15 °C' },
  { label: 'Rouges de garde (Bordeaux, Rhône…)', range: '16 – 18 °C' },
];

export type Level = 'ok' | 'warn' | 'bad';

export function tempLevel(t: number): Level {
  if (t >= STORAGE.tempMin && t <= STORAGE.tempMax) return 'ok';
  if (t >= 8 && t <= 16) return 'warn';
  return 'bad';
}

export function humLevel(h: number): Level {
  if (h >= STORAGE.humMin && h <= STORAGE.humMax) return 'ok';
  if (h >= 50 && h <= 85) return 'warn';
  return 'bad';
}
