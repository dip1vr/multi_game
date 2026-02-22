const url = 'https://files.catbox.moe/cg8ezq.jpg';

try {
    const res = await fetch(url);
    console.log(`Status code for ${url}: ${res.status}`);
} catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
}
