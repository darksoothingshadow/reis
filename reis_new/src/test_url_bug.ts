
function testUrlProcessing(link: string) {
    console.log(`Original: ${link}`);

    // Logic from documents.ts (UPDATED)
    let absoluteUrl = '';
    if (link.includes('slozka.pl')) {
        const splitIndex = link.indexOf('slozka.pl') + 9;
        const queryPart = link.substring(splitIndex);

        if (queryPart.length > 0) {
            let cleanQuery = queryPart.replace(/;/g, '&');
            if (cleanQuery.startsWith('&') || cleanQuery.startsWith('?')) {
                cleanQuery = '?' + cleanQuery.substring(1);
            } else if (cleanQuery.length > 0) {
                cleanQuery = '?' + cleanQuery;
            }
            absoluteUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl${cleanQuery}`;
        } else {
            absoluteUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl`;
        }
    }
    console.log(`Result: ${absoluteUrl}`);
    console.log('---');
}

testUrlProcessing('slozka.pl;id=123');
testUrlProcessing('slozka.pl?id=123');
testUrlProcessing('slozka.pl?;id=123');
testUrlProcessing('/auth/dok_server/slozka.pl;id=567;dok=890');
