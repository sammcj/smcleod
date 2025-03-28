document.addEventListener('DOMContentLoaded', () => {
  const citationElements = document.querySelectorAll('.citation-inline.has-tooltip');
  const hoverDelay = 500; // 500ms delay
  let hoverTimer = null;

  citationElements.forEach(el => {
    const tooltip = el.querySelector('.citation-tooltip');
    if (!tooltip) return;

    el.addEventListener('mouseenter', () => {
      // Clear any existing timer
      clearTimeout(hoverTimer);
      // Start a new timer
      hoverTimer = setTimeout(() => {
        tooltip.classList.add('tooltip-visible');
      }, hoverDelay);
    });

    el.addEventListener('mouseleave', () => {
      // Clear the timer if the mouse leaves before delay is met
      clearTimeout(hoverTimer);
      // Hide the tooltip immediately
      tooltip.classList.remove('tooltip-visible');
    });

    // Optional: Hide tooltip if user clicks away
    document.addEventListener('click', (event) => {
      // Check if the click target is a Node before using contains
      if (event.target instanceof Node && !el.contains(event.target)) {
        tooltip.classList.remove('tooltip-visible');
      }
    });
    // Consider adding scroll event listener if needed
  });
});
