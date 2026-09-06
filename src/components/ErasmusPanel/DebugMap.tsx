import { useState } from 'react';

const SPAIN =
  'M 283 440 286 441 284 446 282 447 276 443 278 439 283 440 Z M 222 386 227 388 229 391 235 393 237 395 240 394 243 396 252 396 252 394 260 396 261 398 262 400 265 399 269 401 271 400 275 402 280 400 283 400 283 408 280 410 272 415 269 417 257 421 253 424 248 432 243 438 240 444 241 451 246 455 239 460 236 464 234 473 228 473 222 478 218 485 212 484 209 486 204 485 190 486 186 489 180 490 177 494 174 496 169 494 163 482 159 478 152 479 151 473 155 466 157 466 153 460 154 456 157 453 153 443 153 441 158 441 159 437 158 433 161 431 161 427 160 421 169 414 165 412 164 408 159 407 154 409 148 408 145 409 145 405 138 408 136 405 139 403 136 398 135 395 133 392 134 389 137 387 141 387 145 385 145 383 152 381 157 383 176 383 190 386 201 384 207 386 209 385 216 387 222 386 Z';
const PORTUGAL =
  'M 138 408 145 405 145 409 148 408 154 409 159 407 164 408 165 412 169 414 160 421 161 427 161 431 158 433 159 437 158 441 153 441 153 443 157 453 154 456 153 460 157 466 155 466 151 473 152 479 147 481 137 480 132 481 135 475 135 470 134 467 135 464 134 459 130 460 130 457 127 455 129 446 132 443 136 435 135 434 139 421 137 412 138 408 Z';

type Mode = 'A' | 'B' | 'C';

export function DebugMap() {
  const [mode, setMode] = useState<Mode>('A');

  const strokeProps = (m: Mode) => {
    if (m === 'A') return {};
    const base = {
      stroke: 'white',
      strokeWidth: 2,
      paintOrder: 'stroke' as const,
      strokeLinejoin: 'round' as const,
    };
    if (m === 'C') return { ...base, vectorEffect: 'non-scaling-stroke' as const };
    return base;
  };

  const props = strokeProps(mode);

  return (
    <div className="flex flex-col gap-3 p-4 h-full">
      <div className="flex gap-2">
        {(['A', 'B', 'C'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode(m)}
          >
            Test {m}
          </button>
        ))}
        <span className="text-xs self-center text-base-content/60">
          {mode === 'A' && 'No stroke (baseline - borders should be invisible)'}
          {mode === 'B' && 'stroke=white, paintOrder=stroke'}
          {mode === 'C' && 'Same as B + vectorEffect=non-scaling-stroke'}
        </span>
      </div>
      <div className="flex-1 bg-base-200 rounded-xl border border-base-300 overflow-hidden">
        <svg viewBox="120 370 180 130" className="w-full h-full">
          <path d={SPAIN} fill="oklch(70% 0.08 250)" fillRule="evenodd" {...props} />
          <path d={PORTUGAL} fill="oklch(80% 0.06 250)" fillRule="evenodd" {...props} />
        </svg>
      </div>
    </div>
  );
}
