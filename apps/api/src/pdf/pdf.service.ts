import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

const execFileAsync = promisify(execFile);

/** Ruta del binario tectonic (override por env para desarrollo local). */
function tectonicBin(): string {
  return process.env.TECTONIC_BIN ?? 'tectonic';
}

/** Tiempo máximo de compilación (ms) y tope de salida capturada. */
const COMPILE_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * Compila LaTeX → PDF invocando el binario `tectonic` (motor LaTeX autocontenido).
 *
 * Filosofía de degradación (igual que el 503 de OpenAI): si `tectonic` no está
 * instalado, `available()` es false y los endpoints de PDF responden 503 con un
 * mensaje amable; el resto de Yachai arranca y funciona igual. Si la compilación
 * falla (LaTeX inválido), se captura el log de tectonic y se devuelve un 422
 * claro — nunca se tumba la app.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  /** Probe cacheado de disponibilidad del binario (se resuelve una sola vez). */
  private availability: Promise<boolean> | null = null;

  /** ¿Está disponible el binario `tectonic` en el entorno? (cacheado) */
  available(): Promise<boolean> {
    if (!this.availability) {
      this.availability = execFileAsync(tectonicBin(), ['--version'], { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    }
    return this.availability;
  }

  /**
   * Compila una fuente LaTeX a un PDF (Buffer).
   * @throws 503 si `tectonic` no está instalado.
   * @throws 422 si la fuente LaTeX no compila (con la cola del log de tectonic).
   */
  async compile(latex: string): Promise<Buffer> {
    if (!(await this.available())) {
      throw new ServiceUnavailableException(
        'La generación de PDF requiere el motor LaTeX "tectonic" instalado en el servidor.',
      );
    }

    const dir = await mkdtemp(join(tmpdir(), 'yachai-pdf-'));
    const texPath = join(dir, 'doc.tex');
    const pdfPath = join(dir, 'doc.pdf');
    try {
      await writeFile(texPath, latex, 'utf8');
      // `--untrusted` desactiva shell-escape/features peligrosas (la fuente puede
      // venir de la IA o del cliente vía /pdf/compile). `--chatter minimal` reduce ruido.
      await execFileAsync(
        tectonicBin(),
        [texPath, '--outdir', dir, '--chatter', 'minimal', '--untrusted'],
        { timeout: COMPILE_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES },
      );
      const pdf = await readFile(pdfPath);
      if (pdf.length === 0) {
        throw new UnprocessableEntityException('La compilación produjo un PDF vacío.');
      }
      return pdf;
    } catch (err) {
      if (
        err instanceof ServiceUnavailableException ||
        err instanceof UnprocessableEntityException
      ) {
        throw err;
      }
      const log = extractTectonicLog(err);
      this.logger.warn(`Fallo compilando LaTeX con tectonic: ${log}`);
      throw new UnprocessableEntityException({
        message: 'No se pudo compilar el documento LaTeX.',
        detalle: log,
      });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Extrae una cola legible del log de error de tectonic (stderr del proceso). */
function extractTectonicLog(err: unknown): string {
  const stderr = (err as { stderr?: Buffer | string } | undefined)?.stderr;
  const text = stderr ? stderr.toString() : ((err as Error)?.message ?? 'error desconocido');
  return text.trim().split('\n').slice(-15).join('\n').slice(0, 4000);
}
