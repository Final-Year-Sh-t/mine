/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      src?: string;
      alt?: string;
      'auto-rotate'?: boolean | string;
      'auto-rotate-delay'?: string | number;
      'rotation-per-second'?: string;
      'camera-controls'?: boolean | string;
      'shadow-intensity'?: string;
      exposure?: string;
      'environment-image'?: string;
      loading?: 'lazy' | 'eager';
      bounds?: string;
      poster?: string;
      style?: React.CSSProperties;
      className?: string;
    }, HTMLElement>;
  }
}
