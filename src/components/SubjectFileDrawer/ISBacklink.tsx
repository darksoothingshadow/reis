import { ExternalLink } from 'lucide-react';

interface ISBacklinkProps {
  href: string;
  label?: string;
  className?: string;
  showBorder?: boolean;
}

export function ISBacklink({
  href,
  label = 'IS MENDELU',
  className = '',
  showBorder = true,
}: ISBacklinkProps) {
  return (
    <div
      className={`flex justify-center py-4 mt-4 ${showBorder ? 'border-t border-base-300' : ''} ${className}`}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary normal-case font-bold hover:bg-base-200 transition-all duration-200"
      >
        <span>{label}</span>
        <ExternalLink size={14} className="opacity-70" />
      </a>
    </div>
  );
}
