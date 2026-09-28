import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAlbums, findAlbum, photosState, photosHref, step, swipe, isPhotoSrc, isImageHref, MIN_PHOTOS,
} from '../assets/js/deskbar/lib/albums.js';

const raw = [
  { id: 'cars', title: 'Cars', items: [{ src: '/a.jpg', thumb: '/a_t.jpg', caption: 'A', w: 800, h: 600 }, { src: 'https://x.org/b.jpg' }] },
  { id: 'rip-jimothy', title: 'Rest in peace', post: '/2020/10/rip-jimothy/', slug: 'rip-jimothy', auto: true, items: [{ src: '/1.jpg' }] },
  { id: 'castle-hill', title: 'Castle Hill', post: '/2016/08/winter/', slug: 'winter-wonder-land', items: [{ src: '/c.jpg' }] },
  { id: 'empty', title: 'Nothing here', items: [] },
  { id: 'cars', title: 'Duplicate id', items: [{ src: '/dup.jpg' }] },
  { title: 'No id', items: [{ src: '/x.jpg' }] },
  { id: 'bad-items', items: [null, { src: 42 }, { caption: 'no src' }, { src: '/ok.jpg', w: -1, h: 'tall', caption: 7 }] },
  null,
];

test('parseAlbums keeps usable albums and fills defaults', () => {
  const albums = parseAlbums(raw);
  assert.deepEqual(albums.map(a => a.id), ['cars', 'rip-jimothy', 'castle-hill', 'bad-items']);
  const [cars, rip, , bad] = albums;
  assert.deepEqual(cars.items[0], { src: '/a.jpg', thumb: '/a_t.jpg', caption: 'A', w: 800, h: 600 });
  assert.deepEqual(cars.items[1], { src: 'https://x.org/b.jpg', thumb: 'https://x.org/b.jpg', caption: '', w: 0, h: 0 },
    'hotlinked images are their own thumbnail');
  assert.equal(cars.auto, false);
  assert.equal(rip.auto, true);
  assert.equal(bad.title, 'bad-items', 'title falls back to the id');
  assert.deepEqual(bad.items, [{ src: '/ok.jpg', thumb: '/ok.jpg', caption: '', w: 0, h: 0 }]);
});

test('parseAlbums survives anything that is not a list', () => {
  for (const x of [null, undefined, {}, 'albums', 3]) assert.deepEqual(parseAlbums(x), []);
});

test('findAlbum looks up by id, then by post slug', () => {
  const albums = parseAlbums(raw);
  assert.equal(findAlbum(albums, 'cars').title, 'Cars');
  assert.equal(findAlbum(albums, 'winter-wonder-land').id, 'castle-hill');
  assert.equal(findAlbum(albums, 'nope'), null);
  assert.equal(findAlbum(albums, ''), null);
});

test('Photos addresses round trip through photosHref and photosState', () => {
  assert.equal(photosHref('/photos/', ''), '/photos/');
  assert.equal(photosHref('/photos/', 'cars'), '/photos/?album=cars');
  assert.equal(photosHref('/photos/', 'cars', 3), '/photos/?album=cars&photo=3');
  assert.deepEqual(photosState('/photos/?album=cars&photo=3'), { album: 'cars', photo: 3 });
  assert.deepEqual(photosState(photosHref('/photos/', 'a b&c', 2)), { album: 'a b&c', photo: 2 });
  assert.deepEqual(photosState('/photos/'), { album: '', photo: 0 });
  for (const bad of ['0', '-2', '1.5', 'x', '']) assert.equal(photosState('/photos/?album=a&photo=' + bad).photo, 0, bad);
});

test('lightbox steps wrap at both ends', () => {
  assert.equal(step(0, 1, 3), 1);
  assert.equal(step(2, 1, 3), 0, 'next from the last photo is the first');
  assert.equal(step(0, -1, 3), 2, 'previous from the first photo is the last');
  assert.equal(step(0, 1, 1), 0, 'a single photo stays put');
  assert.equal(step(0, 1, 0), -1, 'nothing to show');
});

test('only a clear sideways drag is a swipe', () => {
  assert.equal(swipe(-80, 10), 1, 'drag left moves to the next photo');
  assert.equal(swipe(80, -10), -1, 'drag right moves to the previous photo');
  assert.equal(swipe(30, 0), 0, 'too short');
  assert.equal(swipe(60, 90), 0, 'mostly vertical');
});

test('photo filters skip icons and match image links', () => {
  assert.equal(MIN_PHOTOS, 3);
  assert.ok(isPhotoSrc('photo-1.jpg'));
  assert.ok(isPhotoSrc('https://github.com/x/y.jpeg?raw=true'));
  assert.ok(!isPhotoSrc('/badge.svg'));
  assert.ok(!isPhotoSrc('https://img.shields.io/x.svg?style=flat'));
  assert.ok(!isPhotoSrc('data:image/png;base64,AAAA'));
  assert.ok(!isPhotoSrc(null));
  assert.ok(isImageHref('https://raw.githubusercontent.com/a/b/photos/IMG_1.JPG'));
  assert.ok(isImageHref('/a/b.webp?raw=true'));
  assert.ok(!isImageHref('https://github.com/sammcj'));
  assert.ok(!isImageHref(''));
});
