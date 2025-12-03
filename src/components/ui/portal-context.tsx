import React from 'react';

export const PortalContext = React.createContext<HTMLElement | null>(null);

export const usePortalContainer = () => React.useContext(PortalContext);
