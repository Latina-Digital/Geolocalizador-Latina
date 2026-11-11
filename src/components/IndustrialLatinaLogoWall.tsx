/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Identidad Corporativa Oficial Inalterable — INDUSTRIAL LATINA S.A.
 * Renderiza el emblema arquitectónico en relieve 3D sobre muro azul pizarra (#1B2A3A / #152230):
 * - "INDUSTRIAL" en la parte superior (tipografía robusta con relleno azul profundo y borde blanco en relieve).
 * - "LATINA" debajo en mayor tamaño con ligera curvatura ascendente (relleno blanco con doble contorno azul y blanco en relieve 3D).
 * - Escarapela/engranaje central azul con borde blanco, círculo central amarillo oro (#F5B700) con la letra "L" azul en el medio
 *   y las dos cintas rojas inferiores (#D32F2F) con borde blanco.
 * - Eslogan oficial inalterable en mayúsculas:
 *   "SOLUCIONES INTEGRALES
 *    PARA LA CONSTRUCCIÓN"
 * - Soporta carga directa de imagen oficial (Base64 / URL) configurada por Administrador / Sistemas con respaldo vectorial SVG de alta fidelidad.
 */

import React, { useState, useEffect } from 'react';

interface IndustrialLatinaLogoWallProps {
  customLogoUrlOrBase64?: string;
  compact?: boolean;
}

export const IndustrialLatinaLogoWall: React.FC<IndustrialLatinaLogoWallProps> = ({
  customLogoUrlOrBase64,
  compact = false,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [customLogoUrlOrBase64]);

  const hasValidCustomImage = Boolean(
    customLogoUrlOrBase64 && customLogoUrlOrBase64.trim().length > 0 && !imgError
  );

  // Generar los 20 dientes suaves de la escarapela/engranaje alrededor del centro (cx=300, cy=288)
  const gearTeethCount = 20;
  const cx = 300;
  const cy = 288;
  const outerR = 64;
  const innerR = 56;

  const buildRosetteGearPath = (): string => {
    const points: string[] = [];
    const totalSteps = gearTeethCount * 2;
    for (let i = 0; i < totalSteps; i++) {
      const angle = (i * Math.PI * 2) / totalSteps - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    points.push('Z');
    return points.join(' ');
  };

  const rosettePath = buildRosetteGearPath();

  return (
    <div className="w-full flex flex-col items-center justify-center select-none">
      {hasValidCustomImage ? (
        <div className="w-full flex flex-col items-center justify-center">
          <div className="relative max-w-[520px] w-full flex items-center justify-center px-4">
            <img
              src={customLogoUrlOrBase64}
              alt="INDUSTRIAL LATINA — SOLUCIONES INTEGRALES PARA LA CONSTRUCCIÓN"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`w-full h-auto object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.65)] ${
                compact ? 'max-h-[220px]' : 'max-h-[380px]'
              }`}
            />
          </div>

          {/* Eslogan Oficial Inalterable garantizado debajo del emblema */}
          <div className="mt-3 sm:mt-5 text-center">
            <div
              className={`${
                compact
                  ? 'text-sm sm:text-lg tracking-[0.12em]'
                  : 'text-[15px] sm:text-xl lg:text-[25px] xl:text-[28px] tracking-[0.12em] sm:tracking-[0.15em]'
              } font-extrabold uppercase text-white leading-[1.28] drop-shadow-[0_4px_10px_rgba(0,0,0,0.75)]`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <div className="whitespace-nowrap">SOLUCIONES INTEGRALES</div>
              <div className="whitespace-nowrap">PARA LA CONSTRUCCIÓN</div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`w-full ${
            compact
              ? 'max-w-[280px]'
              : 'max-w-[290px] sm:max-w-[440px] lg:max-w-[560px] xl:max-w-[620px]'
          } flex flex-col items-center justify-center px-2`}
        >
          <svg
            viewBox="0 0 600 420"
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="INDUSTRIAL LATINA — SOLUCIONES INTEGRALES PARA LA CONSTRUCCIÓN"
          >
            <defs>
              {/* Sombra arquitectónica profunda 3D sobre muro azul pizarra */}
              <filter id="wall-relief-shadow" x="-15%" y="-15%" width="130%" height="135%">
                <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#070E17" floodOpacity="0.78" />
                <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.9" />
              </filter>

              <filter id="emblem-deep-shadow" x="-20%" y="-20%" width="140%" height="145%">
                <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#060C14" floodOpacity="0.82" />
              </filter>

              {/* Degradado Azul Corporativo Profundo para "INDUSTRIAL" y Escarapela */}
              <linearGradient id="industrial-blue-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#174A8B" />
                <stop offset="55%" stopColor="#0F3568" />
                <stop offset="100%" stopColor="#092347" />
              </linearGradient>

              {/* Degradado Amarillo Oro Corporativo (#F5B700) para el círculo central */}
              <linearGradient id="gold-medallion-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFE066" />
                <stop offset="45%" stopColor="#F5B700" />
                <stop offset="100%" stopColor="#D99B00" />
              </linearGradient>

              {/* Degradado Rojo Corporativo (#D32F2F) para las dos cintas inferiores */}
              <linearGradient id="red-ribbon-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="50%" stopColor="#D32F2F" />
                <stop offset="100%" stopColor="#991B1B" />
              </linearGradient>

              {/* Curva ascendente suave para "LATINA" */}
              <path id="latina-upward-curve" d="M 48,196 Q 300,152 552,196" />
            </defs>

            {/* ============================================================
                1. "INDUSTRIAL" — Parte superior, tipografía robusta con
                   relleno azul profundo y borde blanco en relieve 3D
               ============================================================ */}
            <g filter="url(#wall-relief-shadow)">
              {/* Extrusión 3D inferior blanca/grisácea */}
              <text
                x="300"
                y="78"
                textAnchor="middle"
                fill="#CBD5E1"
                stroke="#CBD5E1"
                strokeWidth="12"
                strokeLinejoin="round"
                paintOrder="stroke fill"
                fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
                fontWeight="900"
                fontSize="50"
                letterSpacing="5"
              >
                INDUSTRIAL
              </text>
              {/* Borde blanco en relieve + relleno azul profundo */}
              <text
                x="300"
                y="74"
                textAnchor="middle"
                fill="url(#industrial-blue-grad)"
                stroke="#FFFFFF"
                strokeWidth="10"
                strokeLinejoin="round"
                paintOrder="stroke fill"
                fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
                fontWeight="900"
                fontSize="50"
                letterSpacing="5"
              >
                INDUSTRIAL
              </text>
            </g>

            {/* ============================================================
                2. "LATINA" — Mayor tamaño con ligera curvatura ascendente,
                   relleno blanco con doble contorno azul y blanco en relieve 3D
               ============================================================ */}
            <g filter="url(#wall-relief-shadow)">
              {/* Capa 1: Contorno exterior blanco en relieve 3D (extrusión inferior) */}
              <text
                dy="5"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="24"
                strokeLinejoin="round"
                fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
                fontWeight="900"
                fontSize="94"
                letterSpacing="4"
              >
                <textPath href="#latina-upward-curve" startOffset="50%" textAnchor="middle">
                  LATINA
                </textPath>
              </text>

              {/* Capa 2: Contorno exterior blanco puro */}
              <text
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="22"
                strokeLinejoin="round"
                fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
                fontWeight="900"
                fontSize="94"
                letterSpacing="4"
              >
                <textPath href="#latina-upward-curve" startOffset="50%" textAnchor="middle">
                  LATINA
                </textPath>
              </text>

              {/* Capa 3: Contorno intermedio Azul Corporativo Profundo */}
              <text
                fill="none"
                stroke="url(#industrial-blue-grad)"
                strokeWidth="12"
                strokeLinejoin="round"
                fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
                fontWeight="900"
                fontSize="94"
                letterSpacing="4"
              >
                <textPath href="#latina-upward-curve" startOffset="50%" textAnchor="middle">
                  LATINA
                </textPath>
              </text>

              {/* Capa 4: Relleno interior Blanco Puro */}
              <text
                fill="#FFFFFF"
                fontFamily="'Plus Jakarta Sans', 'Arial Black', sans-serif"
                fontWeight="900"
                fontSize="94"
                letterSpacing="4"
              >
                <textPath href="#latina-upward-curve" startOffset="50%" textAnchor="middle">
                  LATINA
                </textPath>
              </text>
            </g>

            {/* ============================================================
                3. ESCARAPELA / ENGRANAJE CENTRAL CON CINTAS ROJAS Y "L"
               ============================================================ */}
            <g filter="url(#emblem-deep-shadow)">
              {/* Cinta Roja Inferior Izquierda con borde blanco */}
              <path
                d="M 272 325 L 236 396 L 260 388 L 274 405 L 296 338 Z"
                fill="url(#red-ribbon-grad)"
                stroke="#FFFFFF"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />

              {/* Cinta Roja Inferior Derecha con borde blanco */}
              <path
                d="M 328 325 L 364 396 L 340 388 L 326 405 L 304 338 Z"
                fill="url(#red-ribbon-grad)"
                stroke="#FFFFFF"
                strokeWidth="5.5"
                strokeLinejoin="round"
              />

              {/* Engranaje / Escarapela Azul con borde blanco en relieve */}
              <path
                d={rosettePath}
                fill="url(#industrial-blue-grad)"
                stroke="#FFFFFF"
                strokeWidth="6.5"
                strokeLinejoin="round"
              />

              {/* Anillo interior sutil de la escarapela */}
              <circle
                cx={cx}
                cy={cy}
                r="45"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeOpacity="0.9"
              />

              {/* Círculo central Amarillo Oro (#F5B700) */}
              <circle
                cx={cx}
                cy={cy}
                r="38"
                fill="url(#gold-medallion-grad)"
                stroke="#0F3568"
                strokeWidth="2.5"
              />

              {/* Letra "L" Azul en el centro del medallón dorado */}
              <path
                d="M 286 266 H 301 V 298 H 318 V 310 H 286 Z"
                fill="#0D3166"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          </svg>

          {/* ============================================================
              4. ESLOGAN OFICIAL INALTERABLE EN MAYÚSCULAS
                 "SOLUCIONES INTEGRALES
                  PARA LA CONSTRUCCIÓN"
             ============================================================ */}
          <div className="mt-1 text-center">
            <div
              className={`${
                compact
                  ? 'text-sm sm:text-base tracking-[0.12em]'
                  : 'text-[15px] sm:text-xl lg:text-[25px] xl:text-[29px] tracking-[0.12em] sm:tracking-[0.16em]'
              } font-extrabold uppercase text-white leading-[1.28] drop-shadow-[0_5px_12px_rgba(0,0,0,0.85)]`}
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                textShadow: '0 2px 0 rgba(10, 22, 36, 0.95), 0 6px 18px rgba(0, 0, 0, 0.75)',
              }}
            >
              <div className="whitespace-nowrap">SOLUCIONES INTEGRALES</div>
              <div className="whitespace-nowrap">PARA LA CONSTRUCCIÓN</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
