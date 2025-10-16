// Handle all tooltips with interactive behavior
document.addEventListener('DOMContentLoaded', function() {
  const cells = document.querySelectorAll('.comparison-table td[data-tooltip]');

  cells.forEach(cell => {
    const tooltipText = cell.getAttribute('data-tooltip');

    // Skip cells that have a link as direct child (don't interfere with cell links)
    if (cell.classList.contains('has-cell-link')) {
      return;
    }

    // Check if tooltip contains URLs (simple regex for http/https URLs)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrls = urlRegex.test(tooltipText);

    // Create interactive tooltip element for all tooltips
    const tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'interactive-tooltip';

    // Ensure it never blocks clicks by default
    tooltipDiv.style.pointerEvents = 'none';

    if (hasUrls) {
      // Convert URLs to clickable links
      const htmlContent = tooltipText.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="tooltip-link">$1</a>');
      tooltipDiv.innerHTML = htmlContent;
    } else {
      // Plain text tooltip
      tooltipDiv.textContent = tooltipText;
    }

    // Add arrow
    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    tooltipDiv.appendChild(arrow);

    // Add to cell
    cell.appendChild(tooltipDiv);
    cell.classList.add('has-interactive-tooltip');

    let hideTimeout = null;

    const showTooltip = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      tooltipDiv.classList.add('visible');
      tooltipDiv.style.pointerEvents = 'auto';
      positionTooltip(cell, tooltipDiv);
    };

    const hideTooltip = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      hideTimeout = setTimeout(() => {
        tooltipDiv.classList.remove('visible');
        tooltipDiv.style.pointerEvents = 'none';
      }, 100);
    };

    // Show tooltip on cell hover
    cell.addEventListener('mouseenter', showTooltip);

    // Start hide countdown when leaving cell
    cell.addEventListener('mouseleave', hideTooltip);

    // Cancel hide and keep visible when entering tooltip
    tooltipDiv.addEventListener('mouseenter', showTooltip);

    // Hide when leaving tooltip
    tooltipDiv.addEventListener('mouseleave', hideTooltip);
  });
});

function positionTooltip(cell, tooltip) {
  const rect = cell.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // Check if there's enough space above
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;

  if (spaceAbove > tooltipRect.height + 20 || spaceAbove > spaceBelow) {
    tooltip.classList.remove('bottom');
    tooltip.classList.add('top');
  } else {
    tooltip.classList.remove('top');
    tooltip.classList.add('bottom');
  }
}
