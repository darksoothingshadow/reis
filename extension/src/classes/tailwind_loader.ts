export class TailwindLoaded{
    static readonly TAILWIND_CDN = "https://cdn.tailwindcss.com";
    static readonly ROOT_ID = 'chrome-extension-root';
    static loadTailwind():Promise<void>{
        return new Promise(p => {
            // Check if CDN is already injected to avoid re-injecting
            if (document.querySelector(`script[src="${TailwindLoaded.TAILWIND_CDN}"]`)) {
                return;
            }
            const script = document.createElement('script');
            script.src = TailwindLoaded.TAILWIND_CDN;
            script.onload = ()=>{
                console.log("Tailwind CDN script finished loading and execution.");
                p();
            }
            // Add the script to the head of the host document
            document.head.appendChild(script);
            console.log("Tailwind CDN script injection started.");
        });
    }
}