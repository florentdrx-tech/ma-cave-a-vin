import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db } from './db';
import { ThermometerConnection, type SensorValue } from './thermometer';

interface ThermoState {
  connected: boolean;
  deviceName?: string;
  live?: SensorValue;
  error?: string;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<ThermoState | null>(null);

/** Intervalle d'enregistrement automatique des mesures lorsqu'un capteur est connecté. */
const LOG_EVERY_MS = 10 * 60 * 1000;

export function ThermoProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [live, setLive] = useState<SensorValue>();
  const [error, setError] = useState<string>();
  const [deviceName, setDeviceName] = useState<string>();
  const conn = useRef<ThermometerConnection>();
  const lastLog = useRef(0);

  const onValue = useCallback((v: SensorValue) => {
    setLive(v);
    if (v.temp !== undefined && Date.now() - lastLog.current > LOG_EVERY_MS) {
      lastLog.current = Date.now();
      db.readings.add({ date: Date.now(), temp: Math.round(v.temp * 10) / 10, humidity: v.humidity !== undefined ? Math.round(v.humidity) : undefined, source: 'bluetooth' });
    }
  }, []);

  const connect = useCallback(async () => {
    setError(undefined);
    setConnecting(true);
    try {
      const c = new ThermometerConnection(onValue, () => setConnected(false));
      await c.connect();
      conn.current = c;
      lastLog.current = 0;
      setDeviceName(c.name);
      setConnected(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) setError(msg);
    } finally {
      setConnecting(false);
    }
  }, [onValue]);

  const disconnect = useCallback(() => {
    conn.current?.disconnect();
    setConnected(false);
  }, []);

  useEffect(() => () => conn.current?.disconnect(), []);

  return <Ctx.Provider value={{ connected, connecting, deviceName, live, error, connect, disconnect }}>{children}</Ctx.Provider>;
}

export function useThermo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ThermoProvider manquant');
  return v;
}
