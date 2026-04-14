import { describe, it, expect, vi } from 'vitest';
import { register, login } from '../../apps/api/src/controllers/auth';
import { Request, Response } from 'express';

describe('Auth Controller', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it('should return 400 if username or password is missing', async () => {
    mockRequest.body = { username: 'test' };
    await register(mockRequest, mockResponse);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Username and password are required' }));
  });
});
