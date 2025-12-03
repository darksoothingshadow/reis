// Brand Icons
// Teams and Outlook icons are now using Lucide React icons in Sidebar.tsx
// Mendelu logo is imported from assets in components

export const MENDELU_LOGO_PATH = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.getURL("mendelu_logo_128.png") : "mendelu_logo_128.png";
