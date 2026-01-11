import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { createWorker } from 'tesseract.js';
import {
  extractPlateCandidates,
  isValidChileanPlate,
  normalizePlate,
} from '@taller/shared';

type RoiRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScanStatus =
  | 'idle'
  | 'starting'
  | 'stabilizing'
  | 'scanning'
  | 'processing'
  | 'detected'
  | 'error';

type PlateScannerProps = {
  captureIntervalMs?: number;
  stabilityThreshold?: number;
  minConfidence?: number;
  roi?: RoiRect;
  enableUpload?: boolean;
  onPlateCandidate?: (text: string, confidence: number) => void;
  onPlateConfirmed?: (plate: string) => void;
  onError?: (message: string) => void;
  autoStart?: boolean;
};

const DEFAULT_ROI: RoiRect = { x: 0.1, y: 0.35, width: 0.8, height: 0.3 };

export function PlateScanner({
  captureIntervalMs = 900,
  stabilityThreshold = 10,
  minConfidence = 60,
  roi = DEFAULT_ROI,
  enableUpload = true,
  onPlateCandidate,
  onPlateConfirmed,
  onError,
  autoStart = false,
}: PlateScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(
    null,
  );
  const intervalRef = useRef<number | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableCountRef = useRef(0);
  const processingRef = useRef(false);
  const lastCandidateRef = useRef<string | null>(null);
  const candidateHitsRef = useRef(0);
  const startedRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [candidate, setCandidate] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);

  const label = useMemo(() => {
    switch (status) {
      case 'starting':
        return 'Iniciando camara...';
      case 'stabilizing':
        return 'Estabilizando...';
      case 'scanning':
        return 'Escaneando...';
      case 'processing':
        return 'Procesando OCR...';
      case 'detected':
        return 'Patente detectada';
      case 'error':
        return 'Error en el escaner';
      default:
        return 'Listo para escanear';
    }
  }, [status]);

  const setStatusSafe = useCallback((next: ScanStatus) => {
    setStatus((prev) => (prev === next ? prev : next));
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    lastFrameRef.current = null;
    stableCountRef.current = 0;
    processingRef.current = false;
    candidateHitsRef.current = 0;
    lastCandidateRef.current = null;
    startedRef.current = false;
    setStatusSafe('idle');
  }, [setStatusSafe]);

  const ensureWorker = useCallback(async () => {
    if (workerRef.current) {
      return workerRef.current;
    }
    const worker = await createWorker('eng');
    workerRef.current = worker;
    return worker;
  }, []);

  const applyPreprocess = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width, height } = ctx.canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const contrast = 1.3;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
      data[i] = adjusted;
      data[i + 1] = adjusted;
      data[i + 2] = adjusted;
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const runOcrOnCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      try {
        const worker = await ensureWorker();
        const result = await worker.recognize(canvas);
        const rawText = result.data.text ?? '';
        const score = result.data.confidence ?? 0;
        const candidates = extractPlateCandidates(rawText);
        const best = candidates[0] ? normalizePlate(candidates[0]) : '';

        if (best) {
          setCandidate(best);
          setConfidence(score);
          onPlateCandidate?.(best, score);
          if (best === lastCandidateRef.current) {
            candidateHitsRef.current += 1;
          } else {
            candidateHitsRef.current = 1;
          }
          lastCandidateRef.current = best;
          if (
            candidateHitsRef.current >= 2 &&
            isValidChileanPlate(best) &&
            score >= minConfidence
          ) {
            setStatusSafe('detected');
            onPlateConfirmed?.(best);
            return;
          }
          setStatusSafe('scanning');
          return;
        }
        setStatusSafe('scanning');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error OCR.';
        setStatusSafe('error');
        onError?.(message);
      }
    },
    [
      ensureWorker,
      minConfidence,
      onError,
      onPlateCandidate,
      onPlateConfirmed,
      setStatusSafe,
    ],
  );

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      setStatusSafe('starting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try {
          await videoRef.current.play();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'No se pudo iniciar video.';
          if (!message.includes('media was removed')) {
            throw err;
          }
        }
      }
      setStatusSafe('stabilizing');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo abrir la camara.';
      setStatusSafe('error');
      onError?.(message);
      startedRef.current = false;
    }
  }, [onError, setStatusSafe]);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 64;
    smallCanvas.height = 64;
    const smallCtx = smallCanvas.getContext('2d');
    if (!smallCtx) return;
    smallCtx.drawImage(video, 0, 0, smallCanvas.width, smallCanvas.height);
    const smallData = smallCtx.getImageData(
      0,
      0,
      smallCanvas.width,
      smallCanvas.height,
    ).data;

    let diff = 0;
    if (lastFrameRef.current) {
      for (let i = 0; i < smallData.length; i += 4) {
        diff += Math.abs(smallData[i] - lastFrameRef.current[i]);
      }
      diff /= smallData.length / 4;
    }
    lastFrameRef.current = new Uint8ClampedArray(smallData);

    const stable = diff > 0 && diff <= stabilityThreshold;
    if (!stable) {
      stableCountRef.current = 0;
      setStatusSafe('stabilizing');
      return;
    }

    stableCountRef.current += 1;
    if (stableCountRef.current < 2 || processingRef.current) {
      setStatusSafe('scanning');
      return;
    }

    processingRef.current = true;
    setStatusSafe('processing');

    const roiCanvas = document.createElement('canvas');
    const roiX = Math.floor(width * roi.x);
    const roiY = Math.floor(height * roi.y);
    const roiW = Math.floor(width * roi.width);
    const roiH = Math.floor(height * roi.height);
    roiCanvas.width = roiW;
    roiCanvas.height = roiH;
    const roiCtx = roiCanvas.getContext('2d');
    if (!roiCtx) {
      processingRef.current = false;
      return;
    }
    roiCtx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);

    applyPreprocess(roiCtx);
    await runOcrOnCanvas(roiCanvas);
    processingRef.current = false;
  }, [
    applyPreprocess,
    minConfidence,
    onError,
    onPlateCandidate,
    onPlateConfirmed,
    roi.height,
    roi.width,
    roi.x,
    roi.y,
    stabilityThreshold,
    setStatusSafe,
    runOcrOnCanvas,
  ]);

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      stop();
      setStatusSafe('processing');
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('No se pudo procesar la imagen.');
        }
        ctx.drawImage(img, 0, 0);
        const roiX = Math.floor(canvas.width * roi.x);
        const roiY = Math.floor(canvas.height * roi.y);
        const roiW = Math.floor(canvas.width * roi.width);
        const roiH = Math.floor(canvas.height * roi.height);
        const roiCanvas = document.createElement('canvas');
        roiCanvas.width = roiW;
        roiCanvas.height = roiH;
        const roiCtx = roiCanvas.getContext('2d');
        if (!roiCtx) {
          throw new Error('No se pudo procesar la imagen.');
        }
        roiCtx.drawImage(canvas, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);
        applyPreprocess(roiCtx);
        await runOcrOnCanvas(roiCanvas);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo procesar la imagen.';
        setStatusSafe('error');
        onError?.(message);
      } finally {
        event.target.value = '';
      }
    },
    [applyPreprocess, onError, roi, runOcrOnCanvas, setStatusSafe, stop],
  );

  useEffect(() => {
    if (!autoStart) return;
    start();
    return () => stop();
  }, [autoStart, start, stop]);

  useEffect(() => {
    if (status === 'idle' || status === 'error' || status === 'starting') {
      return;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(processFrame, captureIntervalMs);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [captureIntervalMs, processFrame, status]);

  useEffect(() => {
    return () => {
      stop();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [stop]);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'grey.900',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', display: 'block' }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: `${roi.x * 100}%`,
            top: `${roi.y * 100}%`,
            width: `${roi.width * 100}%`,
            height: `${roi.height * 100}%`,
            border: '2px solid #4caf50',
            boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        />
      </Box>

      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="subtitle2">{label}</Typography>
        {status === 'processing' && <CircularProgress size={18} />}
        {candidate && (
          <Typography variant="body2">
            {candidate} ({Math.round(confidence)}%)
          </Typography>
        )}
      </Stack>

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          onClick={start}
          disabled={status !== 'idle' && status !== 'error'}
        >
          Iniciar
        </Button>
        <Button variant="outlined" onClick={stop} disabled={status === 'idle'}>
          Detener
        </Button>
        {enableUpload && (
          <Button variant="outlined" onClick={handleUploadClick}>
            Subir imagen
          </Button>
        )}
      </Stack>
      {enableUpload && (
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      )}
    </Stack>
  );
}
