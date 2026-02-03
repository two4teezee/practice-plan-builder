/**
 * LAYOUT CONFIGURATION
 * =====================
 * 
 * Adjust these values to experiment with the layout.
 * These values control ALL pages: Create Practice, Drills Library, and History.
 * 
 * IMPORTANT: Values are in pixels (converted to rem for CSS).
 * 
 * After changing values:
 * 1. Save this file
 * 2. The app will hot-reload with the new values
 * 
 * Common reference sizes:
 *   4px, 8px, 12px, 16px, 20px, 24px, 32px
 */

export const LAYOUT_CONFIG = {
  // ============================================
  // SHARED PAGE SETTINGS (All Pages)
  // ============================================
  
  /** Maximum container width for all pages (in pixels) */
  maxWidth: 1600,                // was 1280px (max-w-7xl)
  
  /** Page header icon size (in pixels) */
  pageHeaderIconSize: 24,        // was 32px
  
  /** Page header title font size (in pixels) */
  pageHeaderTitleSize: 18,       // was 24px (text-2xl)
  
  /** Page header subtitle font size (in pixels) */
  pageHeaderSubtitleSize: 13,    // was 16px
  
  /** Page header margin bottom (in pixels) */
  pageHeaderMarginBottom: 12,    // was 32px (mb-8)
  
  /** Section spacing / gap between major sections (in pixels) */
  sectionGap: 12,                // was 16px
  
  /** Card padding (in pixels) */
  cardPadding: 12,               // was 20px

  // ============================================
  // MAIN LAYOUT PADDING (in pixels)
  // ============================================
  
  /** Padding around main content area (mobile) */
  mainPaddingMobile: 8,          // was 16px
  
  /** Padding around main content area (desktop) */
  mainPaddingDesktop: 16,        // was 32px
  
  /** Top padding on mobile (clearance for nav button) */
  mainPaddingTopMobile: 56,      // was 64px
  
  /** Top padding on desktop */
  mainPaddingTopDesktop: 16,     // was 32px

  // ============================================
  // GRID LAYOUT (Practice Plan Page)
  // ============================================
  
  /** Gap between main columns (in pixels) */
  columnGap: 12,                 // was 16px

  // ============================================
  // PRACTICE DETAILS PANE
  // ============================================
  
  /** Card padding (in pixels) */
  detailsCardPadding: 12,        // was 16px
  
  /** Space between form fields (in pixels) */
  detailsFieldSpacing: 8,        // was 12px
  
  /** Section header font size (in pixels) */
  detailsHeaderFontSize: 14,     // was 16px (text-base)
  
  /** Label font size (in pixels) */
  detailsLabelFontSize: 11,      // was ~14px
  
  /** Input font size (in pixels) */
  detailsInputFontSize: 13,      // was 14px (text-sm)
  
  /** Input padding Y (in pixels) */
  detailsInputPaddingY: 6,       // was 8px
  
  /** Input padding X (in pixels) */
  detailsInputPaddingX: 8,       // was 12px
  
  /** Header margin bottom (in pixels) */
  detailsHeaderMarginBottom: 8,  // was 12px

  // ============================================
  // PRACTICE DRILLS PANE
  // ============================================
  
  /** Card padding (in pixels) */
  drillsCardPadding: 12,         // was 16px
  
  /** Header margin bottom (in pixels) */
  drillsHeaderMarginBottom: 8,   // was 12px

  // ============================================
  // TIMELINE
  // ============================================
  
  /** Margin top for timeline (in pixels) */
  timelineMarginTop: 12,         // was 16px

  // ============================================
  // PAGE HEADER
  // ============================================
  
  /** Header margin bottom (in pixels) */
  headerMarginBottom: 8,         // was 16px
  
  /** Header icon size (in pixels) */
  headerIconSize: 24,            // was 28px
  
  /** Header title font size (in pixels) */
  headerTitleFontSize: 18,       // was 20px

  // ============================================
  // BUTTONS & ACTIONS
  // ============================================
  
  /** Gap between action buttons (in pixels) */
  actionButtonGap: 6,            // was 8px
  
  /** Gap between form row columns (in pixels) */
  formRowGap: 8,                 // was 12px
};

/**
 * Convert pixels to rem string for CSS
 */
export function px(pixels: number): string {
  return `${pixels / 16}rem`;
}

/**
 * Pre-computed style objects for performance
 */
export const LAYOUT_STYLES = {
  // ============================================
  // SHARED STYLES (All Pages)
  // ============================================
  
  /** Container max width */
  container: {
    maxWidth: px(LAYOUT_CONFIG.maxWidth),
  },
  
  /** Page header wrapper */
  pageHeaderWrapper: {
    marginBottom: px(LAYOUT_CONFIG.pageHeaderMarginBottom),
  },
  
  /** Page header icon */
  pageHeaderIcon: {
    width: px(LAYOUT_CONFIG.pageHeaderIconSize),
    height: px(LAYOUT_CONFIG.pageHeaderIconSize),
  },
  
  /** Page header title */
  pageHeaderTitle: {
    fontSize: px(LAYOUT_CONFIG.pageHeaderTitleSize),
  },
  
  /** Page header subtitle */
  pageHeaderSubtitle: {
    fontSize: px(LAYOUT_CONFIG.pageHeaderSubtitleSize),
  },
  
  /** Section gap */
  sectionGap: {
    gap: px(LAYOUT_CONFIG.sectionGap),
  },
  
  /** Card padding */
  card: {
    padding: px(LAYOUT_CONFIG.cardPadding),
  },

  // ============================================
  // CREATE PRACTICE PAGE SPECIFIC
  // ============================================
  
  // Main layout
  mainPadding: {
    padding: px(LAYOUT_CONFIG.mainPaddingMobile),
    paddingTop: px(LAYOUT_CONFIG.mainPaddingTopMobile),
  },
  mainPaddingDesktop: {
    padding: px(LAYOUT_CONFIG.mainPaddingDesktop),
    paddingTop: px(LAYOUT_CONFIG.mainPaddingTopDesktop),
  },
  
  // Grid
  columnGap: {
    gap: px(LAYOUT_CONFIG.columnGap),
  },
  
  // Details pane
  detailsCard: {
    padding: px(LAYOUT_CONFIG.detailsCardPadding),
  },
  detailsFieldSpacing: {
    gap: px(LAYOUT_CONFIG.detailsFieldSpacing),
  },
  detailsHeader: {
    fontSize: px(LAYOUT_CONFIG.detailsHeaderFontSize),
    marginBottom: px(LAYOUT_CONFIG.detailsHeaderMarginBottom),
  },
  detailsLabel: {
    fontSize: px(LAYOUT_CONFIG.detailsLabelFontSize),
  },
  detailsInput: {
    fontSize: px(LAYOUT_CONFIG.detailsInputFontSize),
    paddingTop: px(LAYOUT_CONFIG.detailsInputPaddingY),
    paddingBottom: px(LAYOUT_CONFIG.detailsInputPaddingY),
    paddingLeft: px(LAYOUT_CONFIG.detailsInputPaddingX),
    paddingRight: px(LAYOUT_CONFIG.detailsInputPaddingX),
  },
  
  // Drills pane
  drillsCard: {
    padding: px(LAYOUT_CONFIG.drillsCardPadding),
  },
  drillsHeader: {
    marginBottom: px(LAYOUT_CONFIG.drillsHeaderMarginBottom),
  },
  
  // Timeline
  timeline: {
    marginTop: px(LAYOUT_CONFIG.timelineMarginTop),
  },
  
  // Page header (Create Practice specific - uses shared values)
  pageHeader: {
    marginBottom: px(LAYOUT_CONFIG.headerMarginBottom),
  },
  headerIcon: {
    width: px(LAYOUT_CONFIG.headerIconSize),
    height: px(LAYOUT_CONFIG.headerIconSize),
  },
  headerTitle: {
    fontSize: px(LAYOUT_CONFIG.headerTitleFontSize),
  },
  
  // Buttons
  actionButtonGap: {
    gap: px(LAYOUT_CONFIG.actionButtonGap),
  },
  formRowGap: {
    gap: px(LAYOUT_CONFIG.formRowGap),
  },
};
