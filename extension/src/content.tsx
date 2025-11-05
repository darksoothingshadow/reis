import { createRoot } from 'react-dom/client';
import tailwindCss from './content.css?inline';
import { HomePage } from './uis/home/App';

// ✨ 1. Create a function to inject the font into the main document's head.
function injectDmSansFont() {
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000&display=swap';
  
  // Append the link to the document's head
  document.head.appendChild(fontLink);
}

async function firstLoad() {
  //LOGIN CHECK
  const contains = document.body.innerHTML.includes("/system/login.pl");
  if(contains){
    console.log("[INFO] Login detected.");
    document.documentElement.style.visibility = 'visible'; // Show original login page
    return;
  }
  //HIDDEN CHECK
  const storage = window.localStorage;
  if(storage.getItem("hidden") == "true"){
    console.log("[INFO] Hidden detected.");
    document.documentElement.style.visibility = 'visible'; // Show original page
    return;
  };
  //
  console.log("Content loaded");
  // Remove all existing content
  document.body.innerHTML = '';
  document.head.innerHTML = ''; // The head is cleared here...

  // ✨ 2. Call the function to add the font link to the new, empty head.
  injectDmSansFont(); 

  document.documentElement.style.fontFamily = '"DM Sans", sans-serif';

  // Create container for shadow root
  const host = document.createElement('div');
  host.id = 'custom-extension-root';
  document.body.appendChild(host);

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject Tailwind CSS inside the shadow root
  const style = document.createElement('style');
  style.textContent = tailwindCss;
  shadow.appendChild(style);

  // Create root element for React inside shadow DOM
  const app = document.createElement('div');
  app.id = 'app';
  shadow.appendChild(app);

  // Render React app into shadow DOM
  const reactRoot = createRoot(app);
  reactRoot.render(<HomePage />);
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', firstLoad);
} else {
  firstLoad();
}