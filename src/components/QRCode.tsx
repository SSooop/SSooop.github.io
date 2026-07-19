import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  /** URL or data to encode in the QR code */
  value: string;
  /** Size of the QR code in pixels */
  size?: number;
  /** CSS class name for styling */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
}

/**
 * Client-side QR code generator component
 * Uses qrcode.react for secure, offline QR code generation
 */
export default function QRCode({
  value,
  size = 192,
  className = '',
  alt = 'QR Code',
}: QRCodeProps): React.ReactElement {
  return (
    <div className={className}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#000000"
        aria-label={alt}
      />
    </div>
  );
}
