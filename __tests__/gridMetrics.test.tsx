/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {
  columnsForWidth,
  useGridMetrics,
  type GridMetrics,
} from '../src/hooks/useGridMetrics';

const mockWindow = { width: 390, height: 844 };

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 3, fontScale: 1 }),
}));

function readMetrics(width: number, hPad: number, gutter: number): GridMetrics {
  mockWindow.width = width;
  let captured: GridMetrics | null = null;

  const Harness = () => {
    captured = useGridMetrics(hPad, gutter);
    return null;
  };

  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Harness />);
  });

  if (!captured) {
    throw new Error('hook did not run');
  }
  return captured;
}

describe('columnsForWidth', () => {
  it('keeps three columns on every phone width', () => {
    [320, 375, 390, 414, 430, 559].forEach(width => {
      expect(columnsForWidth(width)).toBe(3);
    });
  });

  it('adds columns as a tablet window gets wider', () => {
    expect(columnsForWidth(560)).toBe(4);
    expect(columnsForWidth(834)).toBe(5); // iPad 11" portrait
    expect(columnsForWidth(1024)).toBe(6);
    expect(columnsForWidth(1194)).toBe(6); // iPad 11" landscape
    expect(columnsForWidth(1366)).toBe(7); // iPad 13" landscape
  });
});

describe('useGridMetrics', () => {
  it('gives phones the card width they had before the grid became responsive', () => {
    // Live TV: H_PAD 20, GUTTER 10 — (390 - 40 - 20) / 3
    expect(readMetrics(390, 20, 10)).toEqual({ columns: 3, itemWidth: 110 });
    // Movies and Series: H_PAD 20, GUTTER 12 — (390 - 40 - 24) / 3
    expect(readMetrics(390, 20, 12)).toEqual({
      columns: 3,
      itemWidth: 326 / 3,
    });
  });

  it('keeps posters a readable size on an iPad', () => {
    const { columns, itemWidth } = readMetrics(834, 20, 12);
    expect(columns).toBe(5);
    expect(itemWidth).toBeCloseTo((834 - 40 - 48) / 5);
    expect(itemWidth).toBeLessThan(160);
  });
});
