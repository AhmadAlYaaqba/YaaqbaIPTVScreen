/* eslint-env jest */

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isCancel: jest.fn(() => false),
    isAxiosError: jest.fn(() => false),
  },
}));

import axios from 'axios';

import {
  getXtreamAccountInfo,
  getXtreamCategoryContent,
  getXtreamSeriesDetails,
} from '../src/services/xtream/xtreamService';

const connection = {
  username: 'user',
  password: 'pass',
  domain: 'http://example.com',
  port: '80',
  useProxy: false,
};

describe('Xtream service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes React Query cancellation to Axios and builds typed category requests', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      data: [{ stream_id: 123, name: 'News' }],
    });
    const controller = new AbortController();

    const result = await getXtreamCategoryContent(
      connection,
      'live',
      'category-4',
      controller.signal,
    );

    expect(result).toEqual([{ stream_id: 123, name: 'News' }]);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('action=get_live_streams'),
      expect.objectContaining({ signal: controller.signal, timeout: 15000 }),
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('category_id=category-4'),
      expect.any(Object),
    );
  });

  it('propagates an aborted request instead of converting it to a network error', async () => {
    (axios.get as jest.Mock).mockImplementation(
      (_url: string, config: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          config.signal.addEventListener('abort', () => {
            reject(new Error('request cancelled'));
          });
        }),
    );
    const controller = new AbortController();

    const request = getXtreamCategoryContent(
      connection,
      'movie',
      'category-5',
      controller.signal,
    );
    controller.abort();

    await expect(request).rejects.toThrow('request cancelled');
  });

  it('requests a series detail by its content id', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      data: { info: { name: 'Series' }, episodes: {} },
    });

    const result = await getXtreamSeriesDetails(connection, 'series-8');

    expect(result.info).toMatchObject({ name: 'Series' });
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('series_id=series-8'),
      expect.any(Object),
    );
  });

  it('loads normalized account information and passes cancellation to Axios', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      data: {
        user_info: {
          username: 'must-not-be-returned',
          password: 'must-not-be-returned',
          status: 'Active',
          is_trial: '0',
          exp_date: '2000000000',
          created_at: '1900000000',
          active_cons: '1',
          max_connections: '3',
          package_name: 'Family package',
          allowed_output_formats: ['m3u8', 'ts'],
        },
      },
    });
    const controller = new AbortController();

    const result = await getXtreamAccountInfo(connection, controller.signal);

    expect(result).toEqual({
      status: 'active',
      isTrial: false,
      expiresAt: 2000000000,
      createdAt: 1900000000,
      activeConnections: 1,
      maxConnections: 3,
      planName: 'Family package',
      allowedOutputFormats: ['m3u8', 'ts'],
    });
    expect(result).not.toHaveProperty('username');
    expect(result).not.toHaveProperty('password');
    expect(axios.get).toHaveBeenCalledWith(
      expect.not.stringContaining('action='),
      expect.objectContaining({ signal: controller.signal, timeout: 15000 }),
    );
  });
});
