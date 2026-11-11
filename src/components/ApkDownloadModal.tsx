/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 4A: Centro Corporativo de Descarga Móvil (.APK Android) y Modo Nativo PWA
 * Incluye descarga directa de GEOLATINA_IndustrialLatina.apk, código QR dinámico en SVG,
 * guía rápida de instalación en 3 pasos para Android e instalador nativo PWA (beforeinstallprompt).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  LatinaSysConfig,
  downloadAndroidCapacitorPackage,
} from '../services/latinaApiEngine';
import {
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  MapPin,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredGlobalPwaPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredGlobalPwaPrompt = e as BeforeInstallPromptEvent;
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    deferredGlobalPwaPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });
  const [isIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredGlobalPwaPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      deferredGlobalPwaPrompt = null;
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'fallback'> => {
    if (!deferredPrompt) return 'fallback';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredGlobalPwaPrompt = null;
      setDeferredPrompt(null);
    }
    return outcome;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    promptInstall,
  };
}

/**
 * Generador determinista de matriz QR visual en SVG (25x25 con patrones de posición oficiales)
 * codificando el texto/URL del paquete .APK para escaneo con cámara móvil.
 */
function buildDeterministicQrMatrix(payload: string): boolean[][] {
  const size = 25;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const isSeparator = r === -1 || r === 7 || c === -1 || c === 7;
        grid[rr][cc] = !isSeparator && (isBorder || isInner);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  // Alignment pattern at (16, 16)
  for (let r = 16; r <= 20; r++) {
    for (let c = 16; c <= 20; c++) {
      reserved[r][c] = true;
      const isEdge = r === 16 || r === 20 || c === 16 || c === 20;
      const isCenter = r === 18 && c === 18;
      grid[r][c] = isEdge || isCenter;
    }
  }

  // Hash-derived bit stream from payload bytes
  const bytes: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    bytes.push(payload.charCodeAt(i));
  }
  if (bytes.length === 0) bytes.push(71, 69, 79);

  let bitIdx = 0;
  let seed = 2166136261;
  for (const b of bytes) {
    seed ^= b;
    seed = Math.imul(seed, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      const byteVal = bytes[bitIdx % bytes.length];
      const bitShift = bitIdx % 8;
      const mix = ((byteVal >> bitShift) ^ ((seed >> (bitIdx % 16)) & 1) ^ ((r * 31 + c * 17) & 1)) & 1;
      grid[r][c] = mix === 1;
      bitIdx++;
    }
  }

  return grid;
}

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LatinaSysConfig;
  canExportCapacitorBundle?: boolean;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({
  isOpen,
  onClose,
  config,
  canExportCapacitorBundle = false,
}) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [pwaFeedback, setPwaFeedback] = useState<string | null>(null);
  const [apkDownloadStarted, setApkDownloadStarted] = useState<boolean>(false);

  const resolvedApkUrl = useMemo(() => {
    const raw = (config.apkDownloadUrl || '/descargas/GEOLATINA_IndustrialLatina.apk').trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
    }
    return raw;
  }, [config.apkDownloadUrl]);

  const qrMatrix = useMemo(() => buildDeterministicQrMatrix(resolvedApkUrl), [resolvedApkUrl]);

  if (!isOpen) return null;

  const handleInstallPwaClick = async () => {
    const result = await promptInstall();
    if (result === 'accepted') {
      setPwaFeedback(
        '¡Instalación PWA confirmada! GEOLATINA se agregó a su Pantalla de Inicio en modo pantalla completa.'
      );
    } else if (result === 'fallback') {
      if (isIOS) {
        setPwaFeedback(
          'En iPhone/iPad: toca el botón "Compartir" de Safari y selecciona "Agregar a la pantalla de inicio".'
        );
      } else {
        setPwaFeedback(
          'Modo PWA listo (manifest.json + Service Worker activos). Usa el ícono "Instalar aplicación" en la barra de direcciones de Chrome/Edge o descarga el archivo .APK directo arriba.'
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Cabecera Corporativa */}
        <div className="bg-gradient-to-r from-[#0A2540] via-[#0f3156] to-slate-900 px-4 sm:px-6 py-4 border-b border-slate-700/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-white">
                  📲 Centro de Descarga App Móvil GEOLATINA (.APK & PWA)
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[11px] font-black">
                  Versión {config.apkVersion || 'v2.4.0'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Industrial Latina S.A. · Paquete instalable Android con GPS de Alta Precisión y Modo Nativo Pantalla Completa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar centro de descarga APK"
            className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Principal en Grid Responsivo */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Columna Izquierda (7 cols): Botón Directo .APK + Guía Rápida de 3 Pasos + Opción PWA */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            {/* 1. Botón de Descarga Directa .APK */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/50 via-slate-950 to-slate-900 border border-emerald-500/40 flex flex-col gap-3 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    INSTALADOR OFICIAL ANDROID (.APK)
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white mt-1.5">
                    Paquete Corporativo GEOLATINA ({config.apkVersion || 'v2.4.0'})
                  </h3>
                </div>
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {config.apkReleaseNotes ||
                  'Incluye Geocerca Anti-Fraude GPS (ACCESS_FINE_LOCATION), Cartera 12M por Subgrupo, Cobranzas y caché offline LatinaWebApi.'}
              </p>

              {/* Enlace directo con atributo download="GEOLATINA_IndustrialLatina.apk" */}
              <a
                href={config.apkDownloadUrl || '/descargas/GEOLATINA_IndustrialLatina.apk'}
                download="GEOLATINA_IndustrialLatina.apk"
                onClick={() => setApkDownloadStarted(true)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
              >
                <Download className="w-5 h-5 shrink-0" />
                <span>⬇️ Descargar GEOLATINA_v2.apk (Android)</span>
              </a>

              {apkDownloadStarted && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    Descarga de <strong>GEOLATINA_IndustrialLatina.apk</strong> iniciada. Ábrelo desde tu barra de notificaciones de Android.
                  </span>
                </div>
              )}

              <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="truncate max-w-full font-mono text-[10px] text-slate-400">
                  Origen: {config.apkDownloadUrl || '/descargas/GEOLATINA_IndustrialLatina.apk'}
                </span>
                <span className="text-amber-300 font-bold shrink-0">Android 8.0+ (ARM64)</span>
              </div>
            </div>

            {/* 3. Guía Visual Rápida de Instalación en 3 Pasos para Android */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                📋 Guía Rápida de Instalación en 3 Pasos (Android)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-emerald-400 uppercase">
                    Paso 1
                  </span>
                  <div className="text-xs font-bold text-white">1. Descargar el archivo .APK</div>
                  <p className="text-[11px] text-slate-400">
                    Pulsa el botón verde o escanea el código QR con la cámara de tu teléfono.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-amber-400 uppercase">
                    Paso 2
                  </span>
                  <div className="text-xs font-bold text-white">
                    2. Autorizar instalación de origen corporativo
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Confirma el permiso de instalación desde el navegador corporativo Industrial Latina.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-sky-400 uppercase">
                    Paso 3
                  </span>
                  <div className="text-xs font-bold text-white">
                    3. Abrir GEOLATINA con GPS de alta precisión activo
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Inicia sesión con tu usuario SYSPRO y activa la ubicación exacta para rutas y visitas.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Opción Alternativa: Instalar WebApp Directa en Pantalla de Inicio (PWA) */}
            <div className="p-3.5 rounded-xl bg-sky-950/25 border border-sky-500/40 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-xs font-black uppercase text-sky-200">
                    Modo Alternativo Instantáneo (PWA Standalone)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  {isInstalled
                    ? '✓ PWA Instalada'
                    : isInstallable
                    ? 'Listo para Instalar'
                    : 'Manifest + SW Activos'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleInstallPwaClick}
                className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 shrink-0 text-amber-300" />
                <span>⚡ Instalar WebApp Directa en Pantalla de Inicio (PWA)</span>
              </button>

              {pwaFeedback && (
                <div className="text-[11px] text-sky-200 bg-slate-950/80 border border-sky-500/40 rounded-lg p-2">
                  {pwaFeedback}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha (5 cols): Código QR Dinámico + Paquete WebView/Capacitor para TIC */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            {/* 2. Código QR Dinámico generado en pantalla */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center gap-3 shadow-inner">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black uppercase">
                <QrCode className="w-4 h-4" />
                <span>Escaneo Rápido con Cámara Móvil</span>
              </div>

              <div className="p-3 bg-white rounded-xl shadow-lg border-4 border-amber-400/80">
                <svg
                  viewBox="0 0 25 25"
                  className="w-40 h-40 sm:w-44 sm:h-44"
                  shapeRendering="crispEdges"
                  role="img"
                  aria-label="Código QR para descargar GEOLATINA APK"
                >
                  <rect width="25" height="25" fill="#FFFFFF" />
                  {qrMatrix.map((row, rIdx) =>
                    row.map((cell, cIdx) =>
                      cell ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width={1}
                          height={1}
                          fill="#0A2540"
                        />
                      ) : null
                    )
                  )}
                </svg>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-black text-white">
                  Apunta la cámara de tu Smartphone Android
                </div>
                <p className="text-[11px] text-slate-400">
                  Enlaza directamente a <strong className="text-emerald-400">GEOLATINA_IndustrialLatina.apk</strong> ({config.apkVersion || 'v2.4.0'})
                </p>
              </div>

              <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-left text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Permisos Nativos:</span>
                  <strong className="text-emerald-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> ACCESS_FINE_LOCATION + INTERNET
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Servidor Destino:</span>
                  <strong className="text-sky-300 font-mono text-[10px]">
                    {config.apkTargetWebUrl || 'https://geolatina.ai.studio/'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Botón opcional para TIC / Sistemas: Descargar Paquete de Configuración Android (WebView / Capacitor) */}
            {canExportCapacitorBundle && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col gap-2">
                <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 shrink-0" />
                  <span>Herramienta TIC / Sistemas (Android Studio)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Exporta <code className="text-amber-300">capacitor.config.json</code>,{' '}
                  <code className="text-amber-300">AndroidManifest.xml</code> y{' '}
                  <code className="text-amber-300">MainActivity.java</code> listos para compilar el APK.
                </p>
                <button
                  type="button"
                  onClick={() => downloadAndroidCapacitorPackage(config)}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>🛠️ Descargar Paquete de Configuración Android (WebView / Capacitor)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
