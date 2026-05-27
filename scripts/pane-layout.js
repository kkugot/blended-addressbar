var BlendedAddressbarModule = ((options) => {
  'use strict';

  options = options || {};
  const chromeDoc = options.chromeDoc;
  const removeStylePropertyIfChanged = options.removeStylePropertyIfChanged;
  const setStylePropertyIfChanged = options.setStylePropertyIfChanged;
  const paneCornerSelector = '#tabbrowser-tabpanels > .browserSidebarContainer:not(.zen-glance-overlay)';
  const paneCornerNeighborSelector = `${paneCornerSelector}, #sidebar-box[sidebar-panel-open]:not([hidden])`;
  const paneCornerRadiusProperties = [
    '--blended-addressbar-split-radius-top-left',
    '--blended-addressbar-split-radius-top-right',
    '--blended-addressbar-split-radius-bottom-right',
    '--blended-addressbar-split-radius-bottom-left'
  ];
  let paneCornerMutationObserver = null;
  let paneCornerUpdateTimer = 0;

  function clearPaneCornerRadii(pane) {
    for (const property of paneCornerRadiusProperties) {
      removeStylePropertyIfChanged(pane.style, property);
    }
  }

  function setPaneCornerRadius(pane, property, shouldRound, radius) {
    setStylePropertyIfChanged(pane.style, property, shouldRound ? radius : '0px');
  }

  function overlapsRange(startA, endA, startB, endB, tolerance) {
    return Math.max(startA, startB) <= Math.min(endA, endB) + tolerance;
  }

  function hasPaneNeighborAtCorner(paneRects, pane, rect, corner, tolerance) {
    const checksLeft = corner.endsWith('left');
    const checksTop = corner.startsWith('top');
    const verticalEdge = checksLeft ? rect.left : rect.right;
    const horizontalEdge = checksTop ? rect.top : rect.bottom;

    return paneRects.some(item => {
      if (item.pane === pane) return false;

      const other = item.rect;
      const touchesVerticalEdge = checksLeft
        ? Math.abs(other.right - verticalEdge) <= tolerance
        : Math.abs(other.left - verticalEdge) <= tolerance;
      const touchesHorizontalEdge = checksTop
        ? Math.abs(other.bottom - horizontalEdge) <= tolerance
        : Math.abs(other.top - horizontalEdge) <= tolerance;

      return (touchesVerticalEdge && overlapsRange(other.top, other.bottom, horizontalEdge, horizontalEdge, tolerance))
        || (touchesHorizontalEdge && overlapsRange(other.left, other.right, verticalEdge, verticalEdge, tolerance));
    });
  }

  function updatePaneCornerRadii() {
    paneCornerUpdateTimer = 0;

    const tabpanels = chromeDoc.getElementById('tabbrowser-tabpanels');
    const tabbox = chromeDoc.getElementById('tabbrowser-tabbox');
    const sidebarBox = chromeDoc.getElementById('sidebar-box');
    const panes = Array.from(chromeDoc.querySelectorAll(paneCornerSelector));

    if (!tabpanels || !panes.length) {
      for (const pane of chromeDoc.querySelectorAll('.browserSidebarContainer')) {
        clearPaneCornerRadii(pane);
      }
      return;
    }

    const frame = tabpanels.getBoundingClientRect();
    if (!frame.width || !frame.height) return;

    const tolerance = 1.5;
    const radius = 'var(--blended-addressbar-inner-radius)';
    const allowTopRadius = tabpanels.getAttribute('zen-split-view') === 'true';
    const sidebarPanelOpen = !!sidebarBox
      && !sidebarBox.hidden
      && sidebarBox.hasAttribute('sidebar-panel-open');
    const sidebarOnRight = sidebarPanelOpen
      && (sidebarBox.hasAttribute('sidebar-positionend') || tabbox?.hasAttribute('sidebar-positionend'));
    const sidebarBlocksLeftEdge = sidebarPanelOpen && !sidebarOnRight;
    const sidebarBlocksRightEdge = sidebarPanelOpen && sidebarOnRight;
    const paneRects = panes
      .map(pane => ({ pane, rect: pane.getBoundingClientRect() }))
      .filter(item => item.rect.width && item.rect.height);
    const cornerNeighborRects = Array.from(chromeDoc.querySelectorAll(paneCornerNeighborSelector))
      .map(pane => ({ pane, rect: pane.getBoundingClientRect() }))
      .filter(item => item.rect.width && item.rect.height);

    for (const { pane, rect } of paneRects) {
      const touchesTop = Math.abs(rect.top - frame.top) <= tolerance;
      const touchesRight = Math.abs(rect.right - frame.right) <= tolerance;
      const touchesBottom = Math.abs(rect.bottom - frame.bottom) <= tolerance;
      const touchesLeft = Math.abs(rect.left - frame.left) <= tolerance;

      setPaneCornerRadius(pane, '--blended-addressbar-split-radius-top-left', allowTopRadius && touchesTop && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner(cornerNeighborRects, pane, rect, 'top-left', tolerance), radius);
      setPaneCornerRadius(pane, '--blended-addressbar-split-radius-top-right', allowTopRadius && touchesTop && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner(cornerNeighborRects, pane, rect, 'top-right', tolerance), radius);
      setPaneCornerRadius(pane, '--blended-addressbar-split-radius-bottom-right', touchesBottom && touchesRight && !sidebarBlocksRightEdge && !hasPaneNeighborAtCorner(cornerNeighborRects, pane, rect, 'bottom-right', tolerance), radius);
      setPaneCornerRadius(pane, '--blended-addressbar-split-radius-bottom-left', touchesBottom && touchesLeft && !sidebarBlocksLeftEdge && !hasPaneNeighborAtCorner(cornerNeighborRects, pane, rect, 'bottom-left', tolerance), radius);
    }
  }

  function schedulePaneCornerRadiiUpdate() {
    if (paneCornerUpdateTimer) clearTimeout(paneCornerUpdateTimer);
    paneCornerUpdateTimer = setTimeout(updatePaneCornerRadii, 0);
  }

  function observePaneCornerRadii() {
    const tabpanels = chromeDoc.getElementById('tabbrowser-tabpanels');
    if (!tabpanels || typeof MutationObserver === 'undefined') return;
    const paneCornerObserverRoot = chromeDoc.getElementById('tabbrowser-tabbox') || tabpanels;

    if (paneCornerMutationObserver) paneCornerMutationObserver.disconnect();
    paneCornerMutationObserver = new MutationObserver(schedulePaneCornerRadiiUpdate);
    paneCornerMutationObserver.observe(paneCornerObserverRoot, {
      attributes: true,
      attributeFilter: ['class', 'style', 'zen-split-view', 'is-zen-split', 'zen-split', 'sidebar-panel-open', 'sidebar-positionend', 'checked'],
      childList: true,
      subtree: true
    });

    schedulePaneCornerRadiiUpdate();
  }

  function cleanupPaneCornerRadii() {
    if (paneCornerUpdateTimer) clearTimeout(paneCornerUpdateTimer);
    paneCornerUpdateTimer = 0;
    if (paneCornerMutationObserver) paneCornerMutationObserver.disconnect();
    paneCornerMutationObserver = null;
  }

  return Object.freeze({
    cleanupPaneCornerRadii,
    observePaneCornerRadii,
    schedulePaneCornerRadiiUpdate,
    updatePaneCornerRadii
  });
})(BlendedAddressbarModuleOptions);
