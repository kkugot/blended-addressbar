var BlendedAddressbarModule = ((options) => {
  'use strict';

  options = options || {};
  const chromeDoc = options.chromeDoc;
  const readBoolPref = options.readBoolPref || (() => false);
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
  let paneSidebarResizeObserver = null;
  let paneSidebarModeObserver = null;

  function clearPaneCornerRadii(pane) {
    removeStylePropertyIfChanged(pane.style, '--blended-addressbar-pane-clip-inset');
    removeStylePropertyIfChanged(pane.style, '--blended-addressbar-pane-clip-radius');
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

  function updateSingleSidebarLayout() {
    const root = chromeDoc.documentElement;
    if (!root) return;
    const tabbox = chromeDoc.getElementById('tabbrowser-tabbox');
    const sidebar = chromeDoc.getElementById('sidebar-box');
    const panels = chromeDoc.getElementById('tabbrowser-tabpanels');
    const frame = chromeDoc.getElementById('zen-appcontent-wrapper');
    const enabled = !!sidebar && !sidebar.hidden && sidebar.hasAttribute('sidebar-panel-open')
      && !!panels && !!frame && !!tabbox
      && tabbox.getAttribute('zen-split-view') !== 'true'
      && root.getAttribute('zen-single-toolbar') !== 'true'
      && root.getAttribute('inDOMFullscreen') !== 'true'
      && !root.hasAttribute('customizing')
      && !(root.getAttribute('zen-compact-mode') === 'true' && readBoolPref('zen.view.compact.hide-toolbar', false));
    root.toggleAttribute('data-blended-sidebar-column', enabled);
    if (!enabled) return;

    const nav = chromeDoc.getElementById('nav-bar');
    const bookmarks = chromeDoc.getElementById('PersonalToolbar');
    const toolbarHeight = [nav, bookmarks].reduce((height, toolbar) => {
      if (!toolbar || toolbar.hidden || toolbar.getAttribute('collapsed') === 'true') return height;
      const style = chromeDoc.defaultView.getComputedStyle(toolbar);
      return style.display === 'none' || style.visibility === 'collapse'
        ? height : height + toolbar.getBoundingClientRect().height;
    }, 0);
    const pageBounds = panels.getBoundingClientRect();
    const frameBounds = frame.getBoundingClientRect();
    setStylePropertyIfChanged(root.style, '--blended-addressbar-sidebar-toolbar-height', `${toolbarHeight}px`);
    setStylePropertyIfChanged(root.style, '--blended-addressbar-sidebar-page-left', `${pageBounds.left - frameBounds.left}px`);
    setStylePropertyIfChanged(root.style, '--blended-addressbar-sidebar-page-width', `${pageBounds.width}px`);
  }

  function updatePaneCornerRadii() {
    paneCornerUpdateTimer = 0;
    updateSingleSidebarLayout();

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

    // Split panes can extend beyond the containers that clip their outer edges.
    const clips = [frame];
    for (const id of ['tabbrowser-tabbox', 'zen-tabbox-wrapper', 'zen-appcontent-wrapper']) {
      const bounds = chromeDoc.getElementById(id)?.getBoundingClientRect();
      if (bounds?.width && bounds.height) clips.push(bounds);
    }
    const visible = {
      top: Math.max(...clips.map(rect => rect.top)),
      right: Math.min(...clips.map(rect => rect.right)),
      bottom: Math.min(...clips.map(rect => rect.bottom)),
      left: Math.max(...clips.map(rect => rect.left))
    };

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
      const content = pane.querySelector(':scope > .browserContainer');
      if (allowTopRadius && content && !content.querySelector(':scope > .blended-addressbar-pane-highlight')) {
        const highlight = chromeDoc.createElement('div');
        highlight.className = 'blended-addressbar-pane-highlight';
        highlight.setAttribute('aria-hidden', 'true');
        content.appendChild(highlight);
      }
      const inset = [visible.top - rect.top, rect.right - visible.right,
        rect.bottom - visible.bottom, visible.left - rect.left];
      setStylePropertyIfChanged(pane.style, '--blended-addressbar-pane-clip-inset',
        inset.map(value => `${Math.max(0, value)}px`).join(' '));
      // Clip the page and its highlight together at the visible pane corners.
      const atTop = rect.top <= visible.top + tolerance;
      const atRight = rect.right >= visible.right - tolerance && !sidebarBlocksRightEdge;
      const atBottom = rect.bottom >= visible.bottom - tolerance;
      const atLeft = rect.left <= visible.left + tolerance && !sidebarBlocksLeftEdge;
      setStylePropertyIfChanged(pane.style, '--blended-addressbar-pane-clip-radius',
        [atTop && atLeft, atTop && atRight, atBottom && atRight, atBottom && atLeft]
          .map(round => round ? 'var(--blended-addressbar-frame-radius)' : '0px').join(' '));
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

    paneSidebarModeObserver?.disconnect();
    paneSidebarModeObserver = new MutationObserver(schedulePaneCornerRadiiUpdate);
    paneSidebarModeObserver.observe(chromeDoc.documentElement, {
      attributes: true, attributeFilter: ['zen-single-toolbar', 'zen-compact-mode', 'inDOMFullscreen', 'customizing']
    });
    if (typeof ResizeObserver !== 'undefined') {
      paneSidebarResizeObserver?.disconnect();
      paneSidebarResizeObserver = new ResizeObserver(schedulePaneCornerRadiiUpdate);
      for (const id of ['tabbrowser-tabpanels', 'zen-appcontent-wrapper', 'nav-bar', 'PersonalToolbar']) {
        const target = chromeDoc.getElementById(id);
        if (target) paneSidebarResizeObserver.observe(target);
      }
    }
    schedulePaneCornerRadiiUpdate();
  }

  function cleanupPaneCornerRadii() {
    paneSidebarResizeObserver?.disconnect();
    paneSidebarModeObserver?.disconnect();
    chromeDoc.documentElement?.removeAttribute('data-blended-sidebar-column');
    for (const property of ['height', 'left', 'width']) {
      const name = property === 'height' ? 'toolbar-height' : `page-${property}`;
      if (chromeDoc.documentElement) removeStylePropertyIfChanged(chromeDoc.documentElement.style, `--blended-addressbar-sidebar-${name}`);
    }
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
