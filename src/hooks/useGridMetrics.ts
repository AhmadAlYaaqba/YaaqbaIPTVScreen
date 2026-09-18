import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { TV_NAV_RAIL_WIDTH } from '../tv/TVNavRail';
import { TV_CATEGORY_PANE_WIDTH } from '../tv/TVCatalogLayout';

const IS_TV = Platform.isTV;

export type GridMetrics = {
  /** Cards per row. */
  columns: number;
  /** Width of a single card, gutters and screen padding already removed. */
  itemWidth: number;
};

/**
 * Phones keep the three-column grid they have always had; only windows wide
 * enough to be a tablet (an iPad, or an iPad window in Split View) get more
 * columns, so posters stay a readable size instead of being blown up to a
 * third of a 1366pt screen.
 */
export function columnsForWidth(width: number): number {
  if (width >= 1200) {
    return 7;
  }
  if (width >= 1000) {
    return 6;
  }
  if (width >= 800) {
    return 5;
  }
  if (width >= 560) {
    return 4;
  }
  return 3;
}

/**
 * Grid geometry for the catalog screens. Reads the *live* window size, so an
 * iPad reflows on rotation and on a Split View resize (module-scope
 * `Dimensions.get()` is captured once at bundle load and cannot).
 *
 * TV is a fixed surface: it keeps the verified 10-foot layout (four columns
 * next to the nav rail and the category column) whatever this returns for
 * touch devices.
 */
export function useGridMetrics(
  hPad: number,
  gutter: number,
  tvColumns = 4,
): GridMetrics {
  const { width: windowWidth } = useWindowDimensions();

  return useMemo(() => {
    const width = IS_TV
      ? windowWidth - (TV_NAV_RAIL_WIDTH + TV_CATEGORY_PANE_WIDTH)
      : windowWidth;
    const columns = IS_TV ? tvColumns : columnsForWidth(windowWidth);
    const itemWidth = (width - hPad * 2 - gutter * (columns - 1)) / columns;

    return { columns, itemWidth };
  }, [gutter, hPad, tvColumns, windowWidth]);
}
