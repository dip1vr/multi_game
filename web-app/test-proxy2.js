const url = 'https://wsrv.nl/?url=files.catbox.moe/cg8ezq.jpg';

try {
    const res = await fetch(url);
    console.log(`Status code via wsrv.nl: ${res.status}`);
} catch (e) {
    console.error(`Error fetching via wsrv.nl:`, e.message);
}
