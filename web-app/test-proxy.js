const url = 'https://corsproxy.io/?url=' + encodeURIComponent('https://files.catbox.moe/cg8ezq.jpg');

try {
    const res = await fetch(url);
    console.log(`Status code for proxy fetch: ${res.status}`);
} catch (e) {
    console.error(`Error fetching via proxy:`, e.message);
}
