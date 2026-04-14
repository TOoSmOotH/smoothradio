import { test, expect } from '@playwright/test';

test.describe('Streaming and Curation Flow', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/auth/register', {
      data: { username: 'streamuser', password: 'password123' }
    });
    await request.post('/auth/login', {
      data: { username: 'streamuser', password: 'password123' }
    }).then(res => {
      const body = res.json();
      authToken = body.token;
    });
  });

  test('should stream a track with range requests', async ({ request }) => {
    // We assume a track exists with a known ID for the test environment
    const trackId = 'some-valid-track-id'; 
    const response = await request.get(`/stream/${trackId}`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Range': 'bytes=0-1023' }
    });
    expect(response.status()).toBe(206);
    expect(response.headers()['content-type']).toBe('audio/mpeg');
  });

  test('should curate an AI playlist', async ({ request }) => {
    const response = await request.post('/playlists/curate', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { mood: 'chill', genre: 'Ambient' }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.playlistName).toContain('chill');
    expect(Array.isArray(body.tracks)).toBe(true);
  });

  test('should track listening events', async ({ request }) => {
    const response = await request.post('/events/listen', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { trackId: 'some-valid-track-id', durationSeconds: 120 }
    });
    expect(response.status()).toBe(201);
  });
});
