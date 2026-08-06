async page => {
  await page.waitForTimeout(1800);
  const url = page.url();
  const links = await page.locator('a').evaluateAll(nodes => nodes.map(node => ({
    href: node.href,
    text: node.innerText.trim(),
    image: node.querySelector('img')?.src || '',
    alt: node.querySelector('img')?.alt || '',
  })));
  const parts = url.replace(/^https?:\/\/[^/]+\//, '').split('?')[0].split('#')[0].split('/').filter(Boolean);
  const handle = parts[0] || '';
  const posts = [];
  const seen = new Set();
  for (const link of links) {
    if (!link.href.includes('/reel/')) continue;
    const shortcode = link.href.split('?')[0].split('/').filter(Boolean).at(-1);
    if (!shortcode || seen.has(shortcode)) continue;
    seen.add(shortcode);
    posts.push({ handle, shortcode, url: link.href, viewDisplay: link.text, image: link.image, alt: link.alt });
    if (posts.length >= 12) break;
  }
  const text = await page.locator('body').innerText().catch(() => '');
  const blocked = posts.length === 0 && /로그인|가입하기|페이지를 찾을 수 없습니다|죄송합니다/.test(text);
  return { url, handle, blocked, posts };
}
