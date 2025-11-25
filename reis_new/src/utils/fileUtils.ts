/**
 * Resolves the final direct download URL for a file from IS Mendelu.
 * Handles intermediate pages like 'dokumenty_cteni.pl' and relative paths.
 */
export async function resolveFinalFileUrl(link: string): Promise<string> {
    // Check if it's a "dokumenty_cteni.pl" link (view link)
    // We can directly construct the download link and bypass the intermediate page
    if (link.includes('dokumenty_cteni.pl')) {
        try {
            // Extract parameters
            // Handle both & and ; as separators
            const normalizedLink = link.replace(/;/g, '&').replace(/\?/g, '&');
            const idMatch = normalizedLink.match(/[&]id=(\d+)/);
            const dokMatch = normalizedLink.match(/[&]dok=(\d+)/);

            if (idMatch && dokMatch) {
                const id = idMatch[1];
                const dok = dokMatch[1];
                // Construct direct download URL
                // Using z=1 as requested by user
                return `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${dok}&id=${id}&z=1`;
            }
        } catch (e) {
            console.warn('Failed to construct direct download URL:', e);
            // Fallback to standard processing if extraction fails
        }
    }

    // Construct the full URL for other cases
    let fullUrl = '';
    if (link.startsWith('http')) {
        fullUrl = link;
    } else {
        // It's usually relative to /auth/dok_server/
        if (link.startsWith('/')) {
            fullUrl = `https://is.mendelu.cz${link}`;
        } else {
            fullUrl = `https://is.mendelu.cz/auth/dok_server/${link}`;
        }
    }

    // Check if we need to find the download link (if it's an intermediate page)
    // dokumenty_cteni.pl IS an intermediate page that contains the download link
    if (!fullUrl.includes('download=')) {
        try {
            const pageResponse = await fetch(fullUrl, { credentials: 'include' });
            const pageText = await pageResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageText, 'text/html');

            // Look for the download link: <a> containing <img sysid> and href with 'download='
            const downloadLink = Array.from(doc.querySelectorAll('a')).find(a =>
                a.href.includes('download=') && a.querySelector('img[sysid]')
            );

            if (downloadLink) {
                let newLink = downloadLink.getAttribute('href');
                if (newLink) {
                    // Handle relative paths
                    if (!newLink.startsWith('http')) {
                        if (newLink.startsWith('/')) {
                            if (newLink.includes('dokumenty_cteni.pl')) {
                                fullUrl = `https://is.mendelu.cz/auth/dok_server${newLink}`;
                            } else {
                                fullUrl = `https://is.mendelu.cz${newLink}`;
                            }
                        } else {
                            fullUrl = `https://is.mendelu.cz/auth/dok_server/${newLink}`;
                        }
                    } else {
                        fullUrl = newLink;
                        if (fullUrl.includes('dokumenty_cteni.pl') && !fullUrl.includes('/auth/')) {
                            fullUrl = fullUrl.replace('is.mendelu.cz/dokumenty_cteni.pl', 'is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl');
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to parse intermediate page:', e);
            // Fallback to original URL if parsing fails
        }
    }
    return fullUrl;
}
