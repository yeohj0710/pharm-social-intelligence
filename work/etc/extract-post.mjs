async page => {
  await page.waitForTimeout(4000);
  const url = page.url();
  const text = await page.locator('body').innerText().catch(() => '');
  const times = await page.locator('time').evaluateAll(nodes => nodes.map(node => ({ text: node.innerText, dateTime: node.dateTime || node.getAttribute('datetime') || '' })));
  const buttonData = await page.locator('button').evaluateAll(nodes => nodes.map(node => ({ text: node.innerText.trim(), aria: node.getAttribute('aria-label') || '', title: node.getAttribute('title') || '' })));
  const description = await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content').catch(() => null);
  const numeric = value => {
    const match = String(value).replaceAll(',', '').match(/^([0-9]+(?:\.[0-9]+)?)\s*(천|만|k|m)?$/i);
    if (!match) return null;
    const multiplier = match[2]?.toLowerCase() === '만' || match[2]?.toLowerCase() === 'm' ? 10000 : match[2]?.toLowerCase() === '천' || match[2]?.toLowerCase() === 'k' ? 1000 : 1;
    return Math.round(Number(match[1]) * multiplier);
  };
  const socialMatch = text.match(/(?:^|\n)([0-9]+(?:\.[0-9]+)?\s*(?:천|만|k|m)?)\n([0-9]+(?:\.[0-9]+)?\s*(?:천|만|k|m)?)\n\d{4}년/m);
  const numericButtons = socialMatch ? [numeric(socialMatch[1]), numeric(socialMatch[2])] : buttonData.flatMap(item => [item.text, item.aria, item.title]).map(numeric).filter(Number.isFinite);
  const exactSocial = description?.match(/^([0-9][0-9,]*) likes, ([0-9][0-9,]*) comments/);
  const videos = await page.locator('video').evaluateAll(nodes => nodes.map(node => Number.isFinite(node.duration) ? node.duration : null));
  const pathParts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  const shortcode = pathParts.at(-1) || '';
  const blocked = /로그인|가입하기|페이지를 찾을 수 없습니다|죄송합니다/.test(text) && !text.includes('좋아요');
  return {
    url,
    shortcode,
    blocked,
    dateText: times.at(-1)?.text || times[0]?.text || '',
    dateTime: times.at(-1)?.dateTime || times[0]?.dateTime || '',
    likes: exactSocial ? Number(exactSocial[1].replaceAll(',', '')) : (numericButtons[0] ?? null),
    comments: exactSocial ? Number(exactSocial[2].replaceAll(',', '')) : (numericButtons[1] ?? null),
    lengthSec: videos.find(value => Number.isFinite(value)) ?? null,
    title: await page.title(),
    description,
    image,
  };
}
