"""Download the curated Explore cards and photos for offline browsing."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError
from urllib.parse import quote

from app import WIKI_COLLECTIONS, WIKI_HEADERS, wikipedia_summary


def download_card(title):
    try:
        card = wikipedia_summary(title)
    except (URLError, TimeoutError):
        slug = title.replace(' ', '_')
        card = {'title': title, 'description': '', 'extract': '',
                'image': '', 'source_name': 'Wikipedia',
                'source_url': 'https://en.wikipedia.org/wiki/' + quote(slug)}
    source = card['image']
    name = card['source_url'].rsplit('/', 1)[-1]
    from urllib.parse import unquote
    existing = next(Path('static/assets/explore').glob(unquote(name) + '.*'), None)
    if existing:
        card['image'] = '/' + existing.as_posix()
    elif source:
        name = card['source_url'].rsplit('/', 1)[-1]
        try:
            response = urlopen(Request(source, headers=WIKI_HEADERS), timeout=20)
        except (URLError, TimeoutError):
            return dict(card, image='')
        with response:
            extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(response.headers.get_content_type())
            if extension:
                path = Path('static/assets/explore') / f'{name}.{extension}'
                path.write_bytes(response.read())
                card['image'] = '/' + path.as_posix()
                card['image_source'] = source
    if not card['image'].startswith('/static/'):
        card['image'] = ''
    return card


if __name__ == '__main__':
    Path('static/assets/explore').mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        cards = {slug: list(pool.map(download_card, collection['titles']))
                 for slug, collection in WIKI_COLLECTIONS.items()}
    Path('static/explore-cards.json').write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding='utf-8')
