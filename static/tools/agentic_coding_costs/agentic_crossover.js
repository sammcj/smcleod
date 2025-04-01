// Global variables and DOM element cache
let costChart = null;
let comparisonBarChart = null;
let awsCostChart = null;
const domElements = {};
const WORKING_DAYS_PER_MONTH = 20;

// Helper functions
const formatCurrency = (value) => {
    return '$' + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
};

const getElement = (id) => {
    if (!domElements[id]) {
        domElements[id] = document.getElementById(id);
    }
    return domElements[id];
};

const getInputValue = (id, defaultValue) => {
    const element = getElement(id);
    return element && element.value ? parseFloat(element.value) : defaultValue;
};

const updateElement = (id, value) => {
    const element = getElement(id);
    if (element) element.textContent = value;
};

// Calculation functions
const calculateManualCost = (hourlyRate, manualTime, overheadFactor) => {
    return hourlyRate * manualTime * overheadFactor;
};

const calculateTokenCost = (tokensUsed, inputTokenPercentage, cachedTokenPercentage, modelRates, enableCaching = true, tokenCostMultiplier = 1.0) => {
    // Convert to actual tokens (from millions)
    const totalTokens = tokensUsed * 1000000;

    // Distribute tokens between input and output based on the input percentage
    const inputTokens = totalTokens * (inputTokenPercentage / 100);
    const outputTokens = totalTokens * (1 - inputTokenPercentage / 100);

    let inputCost = 0;
    let cacheWriteCost = 0;
    let cacheReadCost = 0;
    let outputCost = 0;

    // Calculate output cost with caching disabled (always calculate this for comparison)
    const outputCostNoCaching = outputTokens * modelRates.outputTokenRate / 1000;

    // Calculate costs based on caching status
    if (enableCaching) {
        // With caching enabled:

        // 1. Input tokens: Split between cached and non-cached
        const cachedInputTokens = inputTokens * (cachedTokenPercentage / 100);
        const nonCachedInputTokens = inputTokens * (1 - cachedTokenPercentage / 100);

        // Use the cache write rate for non-cached tokens (first-time processing)
        // These are tokens that haven't been seen before and need to be processed fully
        cacheWriteCost = nonCachedInputTokens * modelRates.cacheWriteRate / 1000;

        // Use the cache read rate for cached tokens (already processed before)
        // These are tokens that have been seen before and can be retrieved from cache
        cacheReadCost = cachedInputTokens * modelRates.cacheReadRate / 1000;

        // Total input cost is the sum of cache write and cache read costs
        inputCost = cacheWriteCost + cacheReadCost;

        // 2. Output tokens:
        // When caching is enabled, output tokens are retrieved from cache rather than
        // being generated from scratch, so we use the cache read rate.
        // This assumes the cache contains the appropriate responses for the inputs.
        // Business logic: Cached outputs cost the same as cached inputs (cacheReadRate)
        outputCost = outputTokens * modelRates.cacheReadRate / 1000;
    } else {
        // Without caching:

        // 1. Input tokens: All tokens use the standard input rate
        inputCost = inputTokens * modelRates.inputTokenRate / 1000;
        cacheWriteCost = 0;
        cacheReadCost = 0;

        // 2. Output tokens: All tokens use the standard output rate
        // This is typically much more expensive than with caching enabled
        outputCost = outputTokens * modelRates.outputTokenRate / 1000;
    }

    // Apply token cost multiplier to all costs
    const multipliedInputCost = inputCost * tokenCostMultiplier;
    const multipliedCacheWriteCost = cacheWriteCost * tokenCostMultiplier;
    const multipliedCacheReadCost = cacheReadCost * tokenCostMultiplier;
    const multipliedOutputCost = outputCost * tokenCostMultiplier;
    const multipliedOutputCostNoCaching = outputCostNoCaching * tokenCostMultiplier;

    // Total cost in USD (with multiplier applied)
    const totalCostUSD = multipliedInputCost + multipliedOutputCost;

    return {
        totalCostUSD,
        cacheWriteCost: multipliedCacheWriteCost,
        cacheReadCost: multipliedCacheReadCost,
        outputCost: multipliedOutputCost,
        outputCostNoCaching: multipliedOutputCostNoCaching,
        inputCost: multipliedInputCost
    };
};

const calculateAgenticCost = (hourlyRate, agenticSetupTime, guidenceTime, tokenCost, aiCapabilityFactor, skillMultiplier) => {
    // Calculate setup cost (one-time cost)
    // Note: skillMultiplier is not applied to setup time as it's a one-time operation
    // that may involve different personnel or standardized procedures
    const setupCost = hourlyRate * agenticSetupTime;

    // Calculate labor cost for prompting/guidance (human time cost)
    // Apply skill multiplier to reflect the impact of engineer skill on guidance efficiency
    const laborCost = hourlyRate * guidenceTime * skillMultiplier;

    // Apply AI capability factor to token cost, if not already applied elsewhere
    // In the main calculation flow, the capability factor is applied to token count before
    // calculating cost, so we typically pass 1.0 here to avoid double-application
    const adjustedTokenCost = tokenCost * aiCapabilityFactor;

    // Total cost is the sum of human costs (setup + labor) and adjusted token cost
    const totalCost = setupCost + laborCost + adjustedTokenCost;

    return totalCost;
};

// Calculate and update UI
const updateCalculations = () => {
    try {
        // Get values from inputs with proper null checks
        const hourlyRate = getInputValue('hourlyRate', defaultValues.hourlyRate);
        const manualTime = getInputValue('manualTime', defaultValues.manualTime);
        const agenticSetupTime = getInputValue('agenticSetupTime', defaultValues.agenticSetupTime);
        const guidenceTime = getInputValue('guidenceTime', defaultValues.guidenceTime);
        const tokensUsed = getInputValue('tokensUsed', defaultValues.tokensUsed);
        const overheadFactor = getInputValue('overheadFactor', defaultValues.overheadFactor);
        const skillMultiplier = getInputValue('skillMultiplier', defaultValues.skillMultiplier);
        // Get the agentic processing time early so it's available throughout the function
        let agenticProcessingTime = getInputValue('agenticProcessingTime', defaultValues.agenticProcessingTime);
        // We'll get aiCapabilityFactor from the model later

        // Get output-to-input ratio and calculate input percentage
        const outputToInputRatio = getInputValue('outputToInputRatio', 8);
        const inputTokenPercentage = 100 / (outputToInputRatio + 1);

        const cachedTokenPercentage = getInputValue('cachedTokenPercentage', defaultValues.cachedTokenPercentage);

        // Always calculate both with and without caching
        const enableCaching = true; // Default to caching enabled for primary calculations

        // Get model rates based on selection
        const modelSelectEl = getElement('modelSelect');
        const selectedModel = modelSelectEl && modelSelectEl.value ? modelSelectEl.value : 'claude_3_7_sonnet';
        let modelRates;

        if (selectedModel === 'custom') {
            modelRates = {
                inputTokenRate: getInputValue('inputTokenRate', 0.003),
                outputTokenRate: getInputValue('outputTokenRate', 0.015),
                cacheWriteRate: getInputValue('cacheWriteRate', 0.00375),
                cacheReadRate: getInputValue('cacheReadRate', 0.0003),
                speedMultiplier: getInputValue('speedMultiplier', 1.0),
                aiCapabilityFactor: getInputValue('aiCapabilityFactor', 1.0)
            };
        } else {
            modelRates = modelPricing[selectedModel];
        }

        // Get AI capability factor from the model or input
        const aiCapabilityFactor = selectedModel === 'custom'
            ? getInputValue('aiCapabilityFactor', defaultValues.aiCapabilityFactor)
            : (modelRates.aiCapabilityFactor || 1.0);

        // Basic calculations
        const manualEngineerCost = hourlyRate * manualTime;
        const setupCost = hourlyRate * agenticSetupTime;
        const agenticEngineerCost = hourlyRate * guidenceTime * skillMultiplier;

        console.log('Debugging cost calculation:');
        console.log('hourlyRate:', hourlyRate);
        console.log('guidenceTime:', guidenceTime);
        console.log('skillMultiplier:', skillMultiplier);
        console.log('Calculated agenticEngineerCost:', agenticEngineerCost);

        // Adjust tokens based on AI capability factor
        // Lower capability (< 1.0) means more tokens needed due to rework
        // Example: With capability factor of 0.8, we need 25% more tokens (1/0.8) to complete the same task
        const capabilityAdjustedTokens = tokensUsed / (aiCapabilityFactor > 0 ? aiCapabilityFactor : 0.1);

        // Get token cost multiplier - this is a separate factor that scales all token costs uniformly
        const tokenCostMultiplier = getInputValue('tokenCostMultiplier', defaultValues.tokenCostMultiplier);
        console.log('Token Cost Multiplier:', tokenCostMultiplier);
        console.log('Default Token Cost Multiplier:', defaultValues.tokenCostMultiplier);

        // Token cost calculation (capability factor already applied via capabilityAdjustedTokens)
        const tokenCostResult = calculateTokenCost(capabilityAdjustedTokens, inputTokenPercentage, cachedTokenPercentage, modelRates, enableCaching, tokenCostMultiplier);
        console.log('Token Cost Result (WITH multiplier):', tokenCostResult);
        console.log('Total Token Cost (WITH multiplier):', tokenCostResult.totalCostUSD);

        // Calculate the base token cost without multiplier for verification
        const baseTokenCost = calculateTokenCost(capabilityAdjustedTokens, inputTokenPercentage, cachedTokenPercentage, modelRates, enableCaching, 1.0);
        console.log('Base Token Cost (WITHOUT multiplier):', baseTokenCost.totalCostUSD);
        console.log('Verification - Base * Multiplier =', baseTokenCost.totalCostUSD * tokenCostMultiplier);

        const tokenCostUSD = tokenCostResult.totalCostUSD;

        // Full calculations with factors
        const manualCost = calculateManualCost(hourlyRate, manualTime, overheadFactor);
        // Pass 1.0 for aiCapabilityFactor in calculateAgenticCost to prevent double application
        // since the capability factor was already applied to token usage
        const agenticCost = calculateAgenticCost(hourlyRate, agenticSetupTime, guidenceTime, tokenCostUSD, 1.0, skillMultiplier);

        // Calculate cost savings (manual - agentic)
        const savings = manualCost - agenticCost;

        // Calculate time saved, accounting for all components of agentic time
        // This matches the logic used in timeline calculations
        const totalAgenticTime = agenticSetupTime + guidenceTime + agenticProcessingTime;
        const timeSaved = manualTime - totalAgenticTime;

        // Calculate ROI based on investment in setup and infrastructure
        // This more accurately reflects return on investment by considering only the initial investment
        // rather than treating ongoing costs as investments
        const investmentCost = agenticSetupTime * hourlyRate;  // Consider only setup time as investment
        const roi = investmentCost > 0 ? (savings / investmentCost) * 100 : 0;

        // Update results in UI
        updateElement('manualCost', formatCurrency(manualCost));
        updateElement('agenticCost', formatCurrency(agenticCost));
        updateElement('manualEngineerCost', formatCurrency(manualEngineerCost));
        updateElement('setupCost', formatCurrency(setupCost));
        updateElement('agenticEngineerCost', formatCurrency(agenticEngineerCost));
        updateElement('tokenCost', formatCurrency(tokenCostUSD));
        updateElement('inputTokenCost', formatCurrency(tokenCostResult.inputCost));
        updateElement('cacheWriteCost', formatCurrency(tokenCostResult.cacheWriteCost));
        updateElement('cacheReadCost', formatCurrency(tokenCostResult.cacheReadCost));
        updateElement('outputTokenCostNoCaching', formatCurrency(tokenCostResult.outputCostNoCaching));
        updateElement('outputTokenCost', formatCurrency(tokenCostResult.outputCost));
        updateElement('savings', formatCurrency(savings));
        updateElement('timeSaved', timeSaved + ' hours');
        updateElement('roi', roi.toFixed(0) + '%');

        // Add capability factor impact to token cost explanation if not 1.0
        if (aiCapabilityFactor !== 1.0) {
            const tokenCostElement = getElement('tokenCost');
            if (tokenCostElement && tokenCostElement.parentNode) {
                const explanation = document.createElement('span');
                explanation.className = 'capability-impact';
                explanation.style.display = 'block';
                explanation.style.fontSize = '0.8em';
                explanation.style.fontStyle = 'italic';
                explanation.style.marginTop = '5px';

                const percentChange = Math.abs((1 - aiCapabilityFactor) * 100).toFixed(0);
                const direction = aiCapabilityFactor < 1.0 ? 'higher' : 'lower';
                explanation.textContent = `(${percentChange}% ${direction} token usage due to model capability factor)`;

                // Check if explanation already exists
                const existingExplanation = tokenCostElement.parentNode.querySelector('.capability-impact');
                if (existingExplanation) {
                    existingExplanation.textContent = explanation.textContent;
                } else {
                    tokenCostElement.parentNode.appendChild(explanation);
                }
            }
        } else {
            // Remove explanation if capability factor is 1.0
            const tokenCostElement = getElement('tokenCost');
            if (tokenCostElement && tokenCostElement.parentNode) {
                const existingExplanation = tokenCostElement.parentNode.querySelector('.capability-impact');
                if (existingExplanation) {
                    existingExplanation.remove();
                }
            }
        }

        // Calculate project completion dates
        const workHoursPerDay = 8;
        const workDaysPerWeek = 5;

        // Calculate manual completion time in working days
        const manualWorkingHours = manualTime;
        const manualWorkingDays = Math.ceil(manualWorkingHours / workHoursPerDay);
        const manualWorkingWeeks = Math.floor(manualWorkingDays / workDaysPerWeek);
        const manualRemainingDays = manualWorkingDays % workDaysPerWeek;

        // Get agentic completion time (in hours) - includes both human guidance and AI processing time
        // Apply model speed multiplier if available
        if (selectedModel === 'custom') {
            // For custom pricing, use the speedMultiplier input field
            const customSpeedMultiplier = getInputValue('speedMultiplier', 1.0);
            agenticProcessingTime = agenticProcessingTime * customSpeedMultiplier;
        } else if (modelPricing[selectedModel] && modelPricing[selectedModel].speedMultiplier) {
            // For predefined models, use the speedMultiplier from the model pricing
            agenticProcessingTime = agenticProcessingTime * modelPricing[selectedModel].speedMultiplier;
        }

        console.log('Agentic Processing Time:', agenticProcessingTime);

        // Include setup time in the total working hours for agentic approach
        // This ensures the timeline accurately reflects all time investments
        const agenticWorkingHours = agenticSetupTime + guidenceTime + agenticProcessingTime;
        const agenticWorkingDays = Math.ceil(agenticWorkingHours / workHoursPerDay);
        const agenticWorkingWeeks = Math.floor(agenticWorkingDays / workDaysPerWeek);
        const agenticRemainingDays = agenticWorkingDays % workDaysPerWeek;

        // Calculate completion dates
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Ensure tomorrow is a weekday (Monday-Friday)
        while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
            tomorrow.setDate(tomorrow.getDate() + 1);
        }

        const manualCompletionDate = new Date(tomorrow);
        manualCompletionDate.setDate(manualCompletionDate.getDate() + (manualWorkingWeeks * 7) + manualRemainingDays);
        // Adjust for weekends
        let extraDays = 0;
        for (let i = 0; i < manualRemainingDays; i++) {
            const dayOfWeek = (tomorrow.getDay() + i) % 7;
            if (dayOfWeek === 0 || dayOfWeek === 6) extraDays++;
        }
        manualCompletionDate.setDate(manualCompletionDate.getDate() + extraDays);

        const agenticCompletionDate = new Date(tomorrow);
        agenticCompletionDate.setDate(agenticCompletionDate.getDate() + (agenticWorkingWeeks * 7) + agenticRemainingDays);
        // Adjust for weekends
        extraDays = 0;
        for (let i = 0; i < agenticRemainingDays; i++) {
            const dayOfWeek = (tomorrow.getDay() + i) % 7;
            if (dayOfWeek === 0 || dayOfWeek === 6) extraDays++;
        }
        agenticCompletionDate.setDate(agenticCompletionDate.getDate() + extraDays);

        // Format dates
        const formatDate = (date) => {
            return date.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        // Update project timeline in UI
        const projectTimelineEl = getElement('projectTimeline');
        if (projectTimelineEl) {
            // Calculate time difference in days and hours
            const timeDifferenceInDays = manualWorkingDays - agenticWorkingDays;
            const timeDifferenceInHours = manualWorkingHours - agenticWorkingHours;

            // Format the time difference text
            let timeDifferenceText;
            if (Math.abs(timeDifferenceInHours) < 8) {
                // If less than 1 working day (8 hours), show in hours
                timeDifferenceText = `${Math.abs(timeDifferenceInHours)} hours`;
            } else {
                // Otherwise show in working days
                timeDifferenceText = `${Math.abs(timeDifferenceInDays)} working days`;
            }

            projectTimelineEl.innerHTML = `
                <p><strong>Manual:</strong> ${formatDate(manualCompletionDate)} (${manualWorkingDays} working days)</p>
                <p><strong>Agentic:</strong> ${formatDate(agenticCompletionDate)} (${agenticWorkingDays} working days)</p>
                <p><strong>Time Difference:</strong> ${timeDifferenceText}</p>
            `;
        }

        // Update chart
        updateChart(hourlyRate, manualTime, agenticSetupTime, guidenceTime, tokensUsed, inputTokenPercentage, cachedTokenPercentage, modelRates, overheadFactor, aiCapabilityFactor, skillMultiplier, agenticWorkingDays, manualWorkingDays, agenticWorkingHours, enableCaching);
    } catch (error) {
        console.error('Error in updateCalculations:', error);
    }
};

// Create or update the chart
const updateChart = (hourlyRate, manualTime, agenticSetupTime, guidenceTime, tokensUsed, inputTokenPercentage, cachedTokenPercentage, modelRates, overheadFactor, aiCapabilityFactor, skillMultiplier, agenticWorkingDays, manualWorkingDays, agenticWorkingHours, enableCaching) => {
    try {
        // Generate data for a range of hourly rates
        const rates = [];
        const manualCosts = [];
        const agenticCosts = [];
        const agenticCostsWithoutCaching = []; // For showing costs without caching

        // Generate range around the current hourly rate (50% below to 100% above)
        const minRate = Math.max(10, Math.floor(hourlyRate * 0.5));
        const maxRate = Math.ceil(hourlyRate * 2);
        const step = Math.max(1, Math.floor((maxRate - minRate) / 20));

        // Get token cost multiplier from form
        const tokenCostMultiplier = getInputValue('tokenCostMultiplier', defaultValues.tokenCostMultiplier);
        console.log('Chart calculation - Token Cost Multiplier:', tokenCostMultiplier);

        // Calculate token costs once outside the loop to get the values
        const tokenCostWithCaching = calculateTokenCost(tokensUsed / (aiCapabilityFactor > 0 ? aiCapabilityFactor : 0.1), inputTokenPercentage, cachedTokenPercentage, modelRates, true, tokenCostMultiplier);
        const tokenCostWithoutCaching = calculateTokenCost(tokensUsed / (aiCapabilityFactor > 0 ? aiCapabilityFactor : 0.1), inputTokenPercentage, cachedTokenPercentage, modelRates, false, tokenCostMultiplier);

        // Calculate the final costs at completion time for agentic approach
        const finalAgenticCostWithCaching = calculateAgenticCost(hourlyRate, agenticSetupTime, guidenceTime, tokenCostWithCaching.totalCostUSD, 1.0, skillMultiplier);
        const finalAgenticCostWithoutCaching = calculateAgenticCost(hourlyRate, agenticSetupTime, guidenceTime, tokenCostWithoutCaching.totalCostUSD, 1.0, skillMultiplier);

        // Convert hours to x-axis points (rates)
        // We'll use a simple mapping where each rate point represents an hour
        const agenticCompletionRateIndex = Math.floor((agenticWorkingDays * 8 - minRate) / step);

        for (let i = 0; i < Math.ceil((maxRate - minRate) / step) + 1; i++) {
            const rate = minRate + (i * step);
            rates.push(rate);

            // Manual costs continue to grow with time/rate
            manualCosts.push(calculateManualCost(rate, manualTime, overheadFactor));

            // For agentic costs, if we're past the completion time, use the final cost
            // Otherwise, calculate the cost normally
            if (i > agenticCompletionRateIndex) {
                // Project is complete, costs don't increase
                agenticCosts.push(finalAgenticCostWithCaching);
                agenticCostsWithoutCaching.push(finalAgenticCostWithoutCaching);
            } else {
                // Project is still in progress, calculate costs normally
                const agenticCost = calculateAgenticCost(rate, agenticSetupTime, guidenceTime, tokenCostWithCaching.totalCostUSD, aiCapabilityFactor, skillMultiplier);
                agenticCosts.push(agenticCost);

                const agenticCostWithoutCaching = calculateAgenticCost(rate, agenticSetupTime, guidenceTime, tokenCostWithoutCaching.totalCostUSD, aiCapabilityFactor, skillMultiplier);
                agenticCostsWithoutCaching.push(agenticCostWithoutCaching);
            }
        }

        // Find crossover point
        let crossoverRate = null;
        let crossoverCost = null;

        for (let i = 0; i < rates.length - 1; i++) {
            const m1 = manualCosts[i];
            const m2 = manualCosts[i + 1];
            const a1 = agenticCosts[i];
            const a2 = agenticCosts[i + 1];

            if ((m1 <= a1 && m2 > a2) || (m1 >= a1 && m2 < a2)) {
                // Linear interpolation to find crossover point
                const r1 = rates[i];
                const r2 = rates[i + 1];

                const mSlope = (m2 - m1) / (r2 - r1);
                const mIntercept = m1 - mSlope * r1;

                const aSlope = (a2 - a1) / (r2 - r1);
                const aIntercept = a1 - aSlope * r1;

                if (mSlope !== aSlope) {
                    crossoverRate = (aIntercept - mIntercept) / (mSlope - aSlope);
                    crossoverCost = mSlope * crossoverRate + mIntercept;
                }
                break;
            }
        }

        // Crossover point calculation is done but we no longer display it in a separate element

        // Calculate labor costs (same for both cached and uncached)
        const laborCosts = [];
        for (let rateIndex = 0; rateIndex < rates.length; rateIndex++) {
            const rate = rates[rateIndex];
            // Labor cost = setup cost + prompting cost
            const setupCost = rate * agenticSetupTime;
            const promptingCost = rate * guidenceTime * skillMultiplier;
            // Don't apply AI capability factor to human labor costs
            const laborCost = setupCost + promptingCost;
            laborCosts.push(laborCost);
        }

        // Calculate token costs only (without labor costs)
        const tokenCostsWithCaching = [];
        const tokenCostsWithoutCaching = [];
        for (let i = 0; i < rates.length; i++) {
            // Token costs are the same regardless of hourly rate
            // Note: tokenCostWithCaching.totalCostUSD already has the tokenCostMultiplier applied
            tokenCostsWithCaching.push(tokenCostWithCaching.totalCostUSD * aiCapabilityFactor);
            tokenCostsWithoutCaching.push(tokenCostWithoutCaching.totalCostUSD * aiCapabilityFactor);
        }

        // Calculate total agentic costs (labor + token costs)
        const totalAgenticCosts = [];
        for (let i = 0; i < laborCosts.length; i++) {
            totalAgenticCosts.push(laborCosts[i] + tokenCostsWithCaching[i]);
        }

        // Calculate cost savings (manual - agentic)
        const costSavings = [];
        const roiValues = [];
        for (let i = 0; i < manualCosts.length; i++) {
            const saving = manualCosts[i] - totalAgenticCosts[i];
            costSavings.push(saving);

            // Calculate ROI based on setup investment
            // This matches the ROI calculation in updateCalculations
            const currentHourlyRate = getInputValue('hourlyRate', defaultValues.hourlyRate);
            const currentSetupTime = getInputValue('agenticSetupTime', defaultValues.agenticSetupTime);
            const setupInvestment = currentHourlyRate * currentSetupTime;
            const roiValue = setupInvestment > 0 ? (saving / setupInvestment) * 100 : 0;
            roiValues.push(roiValue);
        }

        // Setup chart data
        const datasets = [
            // Manual development (single line)
            {
                label: 'Manual Development Cost',
                data: manualCosts,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 3,
                fill: false,
                yAxisID: 'y'
            },
            // Total agentic costs (combined labor and token costs)
            {
                label: 'Total Agentic Development Cost',
                data: totalAgenticCosts,
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                borderWidth: 3,
                fill: false,
                yAxisID: 'y'
            },
            // Cost savings (most important metric)
            {
                label: 'Cost Savings with Agentic Approach',
                data: costSavings,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.3)',
                borderWidth: 4,
                borderDash: [5, 5],
                fill: true,
                yAxisID: 'y'
            }
        ];

        // Determine if we should use hours instead of days
        // Use hours only if both times are less than 2 working days (16 hours)
        const useHours = manualTime < 16 && agenticWorkingHours < 16;

        // Generate x-axis points (hours or days)
        let xAxisPoints;
        let xAxisLabels;

        if (useHours) {
            // For hours, use the maximum hours plus a couple extra for visualization
            const maxHours = Math.max(manualTime, agenticWorkingHours) + 2;
            xAxisPoints = Array.from({ length: Math.ceil(maxHours) }, (_, i) => i + 1);
            xAxisLabels = xAxisPoints.map(hour => 'Hour ' + hour);
        } else {
            // For days, use the maximum days plus a couple extra for visualization
            const maxDays = Math.max(manualWorkingDays, agenticWorkingDays) + 2;
            xAxisPoints = Array.from({ length: maxDays }, (_, i) => i + 1);
            xAxisLabels = xAxisPoints.map(day => 'Day ' + day);
        }

        // Calculate costs per time unit (hour or day)
        const manualCostsPerTimeUnit = [];
        const agenticCostsPerTimeUnit = [];
        const agenticCostsWithoutCachingPerTimeUnit = [];
        const laborCostsPerTimeUnit = [];
        const tokenCostsWithCachingPerTimeUnit = [];
        const tokenCostsWithoutCachingPerTimeUnit = [];

        // Get the total costs for manual and agentic approaches
        const totalManualCost = calculateManualCost(hourlyRate, manualTime, overheadFactor);
        const totalAgenticCost = calculateAgenticCost(hourlyRate, agenticSetupTime, guidenceTime, tokenCostWithCaching.totalCostUSD, aiCapabilityFactor, skillMultiplier);
        const totalAgenticCostWithoutCaching = calculateAgenticCost(hourlyRate, agenticSetupTime, guidenceTime, tokenCostWithoutCaching.totalCostUSD, aiCapabilityFactor, skillMultiplier);

        // Get labor costs for agentic approach
        const agenticLaborCost = hourlyRate * agenticSetupTime + hourlyRate * guidenceTime * skillMultiplier;

        // Cost calculation per time unit (hour or day)
        for (let i = 0; i < xAxisPoints.length; i++) {
            const timeUnit = xAxisPoints[i];

            // Calculate proportion of project completed at this time unit
            let manualProportion, agenticProportion;

            if (useHours) {
                // For hours
                manualProportion = Math.min(timeUnit / manualTime, 1);
                agenticProportion = Math.min(timeUnit / agenticWorkingHours, 1);
            } else {
                // For days
                manualProportion = Math.min(timeUnit / manualWorkingDays, 1);
                agenticProportion = Math.min(timeUnit / agenticWorkingDays, 1);
            }

            // Calculate costs based on proportion completed
            const manualCostPerTimeUnit = totalManualCost * manualProportion;
            manualCostsPerTimeUnit.push(manualCostPerTimeUnit);

            // Labor costs increase linearly until completion
            const laborCostPerTimeUnit = agenticLaborCost * agenticProportion;
            laborCostsPerTimeUnit.push(laborCostPerTimeUnit);

            // Token costs also increase linearly until completion
            // Note: tokenCostWithCaching.totalCostUSD already has the tokenCostMultiplier applied
            const tokenCostWithCachingPerTimeUnit = tokenCostWithCaching.totalCostUSD * aiCapabilityFactor * agenticProportion;
            tokenCostsWithCachingPerTimeUnit.push(tokenCostWithCachingPerTimeUnit);

            const tokenCostWithoutCachingPerTimeUnit = tokenCostWithoutCaching.totalCostUSD * aiCapabilityFactor * agenticProportion;
            tokenCostsWithoutCachingPerTimeUnit.push(tokenCostWithoutCachingPerTimeUnit);

            // Total agentic costs
            agenticCostsPerTimeUnit.push(laborCostPerTimeUnit + tokenCostWithCachingPerTimeUnit);
            agenticCostsWithoutCachingPerTimeUnit.push(laborCostPerTimeUnit + tokenCostWithoutCachingPerTimeUnit);
        }

        // Calculate cost savings per time unit
        const costSavingsPerTimeUnit = [];
        for (let i = 0; i < manualCostsPerTimeUnit.length; i++) {
            costSavingsPerTimeUnit.push(manualCostsPerTimeUnit[i] - agenticCostsPerTimeUnit[i]);
        }

        // Update datasets with time-based data
        datasets[0].data = manualCostsPerTimeUnit;  // Manual Development Cost
        datasets[1].data = agenticCostsPerTimeUnit; // Total Agentic Development Cost
        datasets[2].data = costSavingsPerTimeUnit;  // Cost Savings with Agentic Approach

        const chartData = {
            labels: xAxisLabels,
            datasets: datasets
        };

        // Main chart configuration - line chart with filled area showing difference
        const mainChartConfig = {
            type: 'line',
            data: {
                labels: xAxisLabels,
                datasets: [
                    {
                        label: 'Manual Development Cost',
                        data: manualCostsPerTimeUnit,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 3,
                        fill: '+1'  // Fill to the next dataset (agentic)
                    },
                    {
                        label: 'Agentic Development Cost',
                        data: agenticCostsPerTimeUnit,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        borderWidth: 3,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Development Cost Comparison',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.raw);
                            },
                            // Add a footer to show the difference
                            footer: function(tooltipItems) {
                                const manualCost = tooltipItems[0].raw;
                                const agenticCost = tooltipItems[1]?.raw || 0;
                                const difference = manualCost - agenticCost;
                                return 'Savings: ' + formatCurrency(difference);
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        align: 'start',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            boxWidth: 10
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: useHours ? 'Hours' : 'Days'
                        }
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Total Cost ($)'
                        },
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        // Horizontal bar chart configuration for cost comparison
        const barChartConfig = {
            type: 'bar',
            data: {
                labels: ['Total Cost'],
                datasets: [
                    {
                        label: 'Manual Development',
                        data: [totalManualCost],
                        backgroundColor: 'rgba(231, 76, 60, 0.7)',
                        borderColor: '#e74c3c',
                        borderWidth: 1
                    },
                    {
                        label: 'Agentic Development',
                        data: [totalAgenticCost],
                        backgroundColor: 'rgba(46, 204, 113, 0.7)',
                        borderColor: '#2ecc71',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                indexAxis: 'y',  // Horizontal bar chart
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cost Comparison',
                        font: {
                            size: 14
                        }
                    },
                    legend: {
                        position: 'top',
                        align: 'start',
                        labels: {
                            usePointStyle: true,
                            padding: 10,
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.raw);
                            },
                            // Add a footer to show the savings and ROI
                            footer: function(tooltipItems) {
                                if (tooltipItems.length === 2) {
                                    const manualCost = tooltipItems[0].raw;
                                    const agenticCost = tooltipItems[1].raw;
                                    const savings = manualCost - agenticCost;
                                    const savingsPercentage = ((savings / manualCost) * 100).toFixed(0);

                                    // Calculate ROI based on setup investment
                                    // Note: We need to get current values from the form
                                    const currentHourlyRate = getInputValue('hourlyRate', defaultValues.hourlyRate);
                                    const currentSetupTime = getInputValue('agenticSetupTime', defaultValues.agenticSetupTime);
                                    const setupInvestment = currentHourlyRate * currentSetupTime;
                                    const roi = setupInvestment > 0 ? ((savings / setupInvestment) * 100).toFixed(0) : 'N/A';

                                    return [
                                        'Savings: ' + formatCurrency(savings),
                                        'Savings Percentage: ' + savingsPercentage + '%',
                                        'ROI on Setup Investment: ' + roi + '%'
                                    ];
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Cost ($)'
                        },
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        };

        // Create or update main chart
        if (costChart) {
            costChart.data = mainChartConfig.data;
            costChart.options = mainChartConfig.options;
            costChart.update();
        } else {
            const chartCanvas = getElement('costChart');
            if (chartCanvas) {
                const ctx = chartCanvas.getContext('2d');
                if (ctx) {
                    costChart = new Chart(ctx, mainChartConfig);
                }
            }
        }

        // Create or update comparison bar chart
        if (comparisonBarChart) {
            comparisonBarChart.data = barChartConfig.data;
            comparisonBarChart.options = barChartConfig.options;
            comparisonBarChart.update();
        } else {
            const barChartCanvas = getElement('comparisonBarChart');
            if (barChartCanvas) {
                const ctx = barChartCanvas.getContext('2d');
                if (ctx) {
                    comparisonBarChart = new Chart(ctx, barChartConfig);
                }
            }
        }
    } catch (error) {
        console.error('Error in updateChart:', error);
    }
};

// Helper function to format time in hours and minutes
const formatTime = (hours) => {
    if (hours < 1) {
        // Convert to minutes if less than 1 hour
        const minutes = Math.round(hours * 60);
        return `${minutes}min`;
    } else if (Number.isInteger(hours)) {
        // If it's a whole number of hours
        return `${hours}h`;
    } else {
        // Format as hours and minutes
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        return `${wholeHours}h ${minutes}min`;
    }
};

// Helper function to format token count
const formatTokens = (tokens) => {
    if (tokens < 1) {
        // Convert to K if less than 1 million
        return `${(tokens * 1000).toFixed(0)}K`;
    } else {
        // Format as millions
        return `${tokens}M`;
    }
};

// AWS Run Cost Calculator Functions
const calculateAwsRunCost = () => {
    try {
        console.log('calculateAwsRunCost function called');

        // Debug DOM elements
        console.log('AWS DOM elements check:');
        console.log('developerCount element:', document.getElementById('developerCount'));
        console.log('tokensPerDev element:', document.getElementById('tokensPerDev'));
        console.log('forceMultiplier element:', document.getElementById('forceMultiplier'));
        console.log('awsModelSelect element:', document.getElementById('awsModelSelect'));
        console.log('awsCostChart element:', document.getElementById('awsCostChart'));

        // Get values from inputs with explicit fallbacks
        const developerCount = getInputValue('developerCount', 200);
        console.log('developerCount value:', developerCount);

        const tokensPerDev = getInputValue('tokensPerDev', 20); // millions per day
        console.log('tokensPerDev value:', tokensPerDev);

        const forceMultiplier = getInputValue('forceMultiplier', 3);
        console.log('forceMultiplier value:', forceMultiplier);

        // Get output-to-input ratio and calculate input percentage
        const outputToInputRatio = getInputValue('awsOutputToInputRatio', 8);
        const inputTokenPercentage = 100 / (outputToInputRatio + 1);

        const cachedTokenPercentage = getInputValue('awsCachedTokenPercentage', 88);

        // Get model rates based on selection
        const modelSelectEl = getElement('awsModelSelect');
        const selectedModel = modelSelectEl && modelSelectEl.value ? modelSelectEl.value : 'claude_3_7_sonnet';
        let modelRates;

        if (selectedModel === 'custom') {
            modelRates = {
                inputTokenRate: getInputValue('awsInputTokenRate', 0.003),
                outputTokenRate: getInputValue('awsOutputTokenRate', 0.015),
                cacheWriteRate: getInputValue('awsCacheWriteRate', 0.00375),
                cacheReadRate: getInputValue('awsCacheReadRate', 0.0003)
            };
        } else {
            modelRates = modelPricing[selectedModel];
        }

        // Calculate daily token usage per developer
        const dailyTokensPerDev = tokensPerDev; // Already in millions

        // Calculate daily cost per developer with caching
        const dailyTokenCostWithCaching = calculateTokenCost(
            dailyTokensPerDev,
            inputTokenPercentage,
            cachedTokenPercentage,
            modelRates,
            true, // with caching
            1.0 // no multiplier for AWS calculator
        );

        // Calculate daily cost per developer without caching
        const dailyTokenCostWithoutCaching = calculateTokenCost(
            dailyTokensPerDev,
            inputTokenPercentage,
            cachedTokenPercentage,
            modelRates,
            false, // without caching
            1.0 // no multiplier for AWS calculator
        );

        // Calculate daily costs
        const dailyPerDevCost = dailyTokenCostWithCaching.totalCostUSD;
        const dailyTotalCost = dailyPerDevCost * developerCount;

        // Calculate monthly costs (20 working days per month)
        const monthlyPerDevCost = dailyPerDevCost * WORKING_DAYS_PER_MONTH;
        const monthlyTotalCost = dailyTotalCost * WORKING_DAYS_PER_MONTH;

        // Calculate costs without caching
        const dailyPerDevCostWithoutCaching = dailyTokenCostWithoutCaching.totalCostUSD;
        const monthlyTotalCostWithoutCaching = dailyPerDevCostWithoutCaching * developerCount * WORKING_DAYS_PER_MONTH;

        // Calculate savings from caching
        const monthlyCachingSavings = monthlyTotalCostWithoutCaching - monthlyTotalCost;

        // Calculate annual projection
        const annualCost = monthlyTotalCost * 12;

        // Get the FTE cost per year (in thousands)
        const fteCostPerYear = getInputValue('fteCostPerYear', 150) * 1000; // Convert from thousands to actual dollars

        // Calculate equivalent FTE cost
        const fteCost = annualCost / fteCostPerYear;

        // Calculate ROI from force multiplier
        // Value unlocked = (developer count * force multiplier - developer count) * avg annual salary
        // ROI = (value unlocked - annual cost) / annual cost * 100
        const valueUnlocked = (developerCount * forceMultiplier - developerCount) * fteCostPerYear;
        const roi = (valueUnlocked - annualCost) / annualCost * 100;

        // Update results in UI
        console.log('Updating AWS UI elements');
        console.log('Monthly Total Cost:', monthlyTotalCost);
        updateElement('awsTotalCost', formatCurrency(monthlyTotalCost));

        console.log('Monthly Per Dev Cost:', monthlyPerDevCost);
        updateElement('awsPerDevCost', formatCurrency(monthlyPerDevCost));

        console.log('ROI:', roi.toFixed(0) + '%');
        updateElement('awsRoi', roi.toFixed(0) + '%');

        console.log('Daily Per Dev Cost:', dailyPerDevCost);
        updateElement('awsDailyPerDevCost', formatCurrency(dailyPerDevCost));

        console.log('Daily Total Cost:', dailyTotalCost);
        updateElement('awsDailyTotalCost', formatCurrency(dailyTotalCost));

        console.log('Working Days Per Month:', WORKING_DAYS_PER_MONTH);
        updateElement('workingDaysPerMonth', WORKING_DAYS_PER_MONTH);

        console.log('Monthly Cost With Caching:', monthlyTotalCost);
        updateElement('awsCostWithCaching', formatCurrency(monthlyTotalCost));

        console.log('Monthly Cost Without Caching:', monthlyTotalCostWithoutCaching);
        updateElement('awsCostWithoutCaching', formatCurrency(monthlyTotalCostWithoutCaching));

        console.log('Monthly Caching Savings:', monthlyCachingSavings);
        updateElement('awsCachingSavings', formatCurrency(monthlyCachingSavings));

        console.log('Annual Cost:', annualCost);
        updateElement('awsAnnualCost', formatCurrency(annualCost));

        console.log('FTE Cost:', fteCost.toFixed(1) + ' FTE');
        updateElement('awsFteCost', fteCost.toFixed(1) + ' FTE');

// Chart removed as requested
console.log('AWS cost calculation complete');

    } catch (error) {
        console.error('Error in calculateAwsRunCost:', error);
    }
};

// Create or update the AWS cost chart
const updateAwsCostChart = (developerCount, dailyPerDevCost, forceMultiplier) => {
    try {
        console.log('updateAwsCostChart function called');
        console.log('developerCount:', developerCount);
        console.log('dailyPerDevCost:', dailyPerDevCost);
        console.log('forceMultiplier:', forceMultiplier);

        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded. Cannot create or update AWS cost chart.');
            return;
        }

        // Generate data for a range of developer counts
        const devCounts = [];
        const monthlyCosts = [];
        const valueUnlocked = [];

        // Generate range around the current developer count (25% to 400%)
        const minCount = Math.max(10, Math.floor(developerCount * 0.25));
        const maxCount = Math.ceil(developerCount * 4);
        const step = Math.max(5, Math.floor((maxCount - minCount) / 20));

        // Get the FTE cost per year (in thousands)
        const fteCostPerYear = getInputValue('fteCostPerYear', 150) * 1000; // Convert from thousands to actual dollars

        for (let i = 0; i < Math.ceil((maxCount - minCount) / step) + 1; i++) {
            const count = minCount + (i * step);
            devCounts.push(count);

            // Calculate monthly cost for this developer count
            const monthlyTotalCost = count * dailyPerDevCost * WORKING_DAYS_PER_MONTH;
            monthlyCosts.push(monthlyTotalCost);

            // Calculate value unlocked by force multiplier (monthly)
            const monthlyValueUnlocked = (count * forceMultiplier - count) * (fteCostPerYear / 12);
            valueUnlocked.push(monthlyValueUnlocked);
        }

        // Calculate net value (value unlocked minus cost)
        const netValue = [];
        for (let i = 0; i < monthlyCosts.length; i++) {
            netValue.push(valueUnlocked[i] - monthlyCosts[i]);
        }

        // AWS cost chart configuration
        const awsChartConfig = {
            type: 'line',
            data: {
                labels: devCounts.map(count => count + ' Devs'),
                datasets: [
                    {
                        label: 'Monthly Run Cost',
                        data: monthlyCosts,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        fill: false
                    },
                    {
                        label: 'Value Unlocked by Force Multiplier',
                        data: valueUnlocked,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        borderWidth: 2,
                        fill: false
                    },
                    {
                        label: 'Net Value (Value - Cost)',
                        data: netValue,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.3)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Cost and Value by Developer Count',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.raw);
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        align: 'start',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            boxWidth: 10
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Developer Count'
                        }
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Monthly Cost/Value ($)'
                        },
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        // Create or update AWS cost chart with more robust error handling
        try {
            console.log('Attempting to create/update AWS cost chart');
            if (awsCostChart) {
                console.log('Updating existing AWS chart');
                awsCostChart.data = awsChartConfig.data;
                awsCostChart.options = awsChartConfig.options;
                awsCostChart.update();
            } else {
                console.log('Creating new AWS chart');
                const chartCanvas = getElement('awsCostChart');
                console.log('AWS chart canvas:', chartCanvas);

                if (chartCanvas) {
                    try {
                        const ctx = chartCanvas.getContext('2d');
                        console.log('Chart context:', ctx ? 'obtained' : 'failed');

                        if (ctx) {
                            console.log('Creating new Chart instance');
                            awsCostChart = new Chart(ctx, awsChartConfig);
                            console.log('AWS chart created:', awsCostChart ? 'success' : 'failed');
                        } else {
                            console.error('Failed to get 2D context from AWS chart canvas');
                        }
                    } catch (ctxError) {
                        console.error('Error getting context or creating chart:', ctxError);
                    }
                } else {
                    console.error('AWS chart canvas element not found');
                }
            }
        } catch (chartError) {
            console.error('Error in AWS chart creation/update:', chartError);
        }
    } catch (error) {
        console.error('Error in updateAwsCostChart:', error);
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    try {
        // Initialize the AWS calculator directly
        console.log('Initializing AWS calculator directly');
        setTimeout(() => {
            calculateAwsRunCost();
        }, 300);
        // Cache frequently used DOM elements
        const cacheElements = [
            'hourlyRate', 'manualTime', 'agenticSetupTime', 'guidenceTime',
            'tokensUsed', 'overheadFactor', 'aiCapabilityFactor', 'skillMultiplier',
            'outputToInputRatio', 'cachedTokenPercentage', 'modelSelect',
            'inputTokenRate', 'outputTokenRate', 'cacheWriteRate', 'cacheReadRate',
            'agenticProcessingTime', 'costChart', 'comparisonBarChart', 'projectTimeline',
            'outputToInputRatioLabel', 'cachedTokenPercentageLabel', 'customPricing',
            'project-presets', 'tokenCostMultiplier', 'tokenCostMultiplierLabel',
            // AWS calculator elements
            'developerCount', 'tokensPerDev', 'forceMultiplier', 'awsModelSelect',
            'awsOutputToInputRatio', 'awsCachedTokenPercentage', 'awsCostChart',
            'awsInputTokenRate', 'awsOutputTokenRate', 'awsCacheWriteRate', 'awsCacheReadRate',
            'awsCustomPricing', 'awsOutputToInputRatioLabel', 'awsCachedTokenPercentageLabel',
            'calculateAws'
        ];

        cacheElements.forEach(id => {
            getElement(id);
        });

        // Generate project preset cards from config.js
        const projectPresetsContainer = getElement('project-presets');
        if (projectPresetsContainer) {
            // Clear any existing content
            projectPresetsContainer.innerHTML = '';

            // Create a card for each project preset
            Object.entries(projectPresets).forEach(([key, preset]) => {
                // Format the preset name for display (capitalize first letter)
                const displayName = key.replace(/([A-Z])/g, ' $1').trim(); // Add space before capital letters
                const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

                // Create the card element
                const card = document.createElement('div');
                card.className = 'project-preset-card';
                card.setAttribute('data-preset', key);

                // Set the card content
                card.innerHTML = `
                    <h3>${formattedName}</h3>
                    <div class="preset-details">
                        <div class="preset-detail">${formatTokens(preset.tokens)} tokens</div>
                        <div class="preset-detail">${preset.manualHours}h manual dev</div>
                    </div>
                `;

                // Add the card to the container
                projectPresetsContainer.appendChild(card);
            });
        }

        // No more tab navigation - removed

        // Set up event listeners for all inputs in the main calculator
        const inputElements = document.querySelectorAll('#project-cost-section input, #project-cost-section select');
        inputElements.forEach(element => {
            element.addEventListener('change', updateCalculations);
            element.addEventListener('input', function() {
                // Update labels for range inputs
                if (this.id === 'outputToInputRatio') {
                    const ratio = parseFloat(this.value);
                    const outputPercentage = Math.round(ratio * 100 / (ratio + 1));
                    const inputPercentage = 100 - outputPercentage;
                    const outputToInputRatioLabel = getElement('outputToInputRatioLabel');
                    if (outputToInputRatioLabel) {
                        outputToInputRatioLabel.textContent = `${ratio}:1 (${outputPercentage}% output / ${inputPercentage}% input)`;
                    }
                } else if (this.id === 'cachedTokenPercentage') {
                    const percentage = this.value;
                    const cachedTokenPercentageLabel = getElement('cachedTokenPercentageLabel');
                    if (cachedTokenPercentageLabel) {
                        cachedTokenPercentageLabel.textContent = `${percentage}%`;
                    }
                } else if (this.id === 'tokenCostMultiplier') {
                    const multiplier = parseFloat(this.value);
                    const tokenCostMultiplierLabel = getElement('tokenCostMultiplierLabel');
                    if (tokenCostMultiplierLabel) {
                        tokenCostMultiplierLabel.textContent = `${multiplier}x`;
                    }
                }

                // For model select, show/hide custom pricing
                if (this.id === 'modelSelect') {
                    const customPricing = getElement('customPricing');
                    if (customPricing) {
                        customPricing.style.display = this.value === 'custom' ? 'block' : 'none';
                    }
                }

                // Update calculations on input change
                updateCalculations();
            });
        });

        // Set up event listeners for project preset cards
        const projectPresetCards = document.querySelectorAll('.project-preset-card');
        projectPresetCards.forEach(card => {
            card.addEventListener('click', function() {
                // Get the preset name from the data attribute
                const presetName = this.getAttribute('data-preset');

                if (presetName && projectPresets[presetName]) {
                    const preset = projectPresets[presetName];

                    // Update form values with preset data from config.js
                    const manualTimeInput = getElement('manualTime');
                    const tokensUsedInput = getElement('tokensUsed');
                    const guidenceTimeInput = getElement('guidenceTime');
                    const agenticProcessingTimeInput = getElement('agenticProcessingTime');
                    const initialSetupTimeInput = getElement('agenticSetupTime');
                    const overheadFactorInput = getElement('overheadFactor');

                    if (manualTimeInput) manualTimeInput.value = preset.manualHours;
                    if (tokensUsedInput) tokensUsedInput.value = preset.tokens;
                    if (guidenceTimeInput) guidenceTimeInput.value = preset.guidenceTime.toFixed(2);
                    if (agenticProcessingTimeInput) agenticProcessingTimeInput.value = preset.agenticProcessingTime;
                    if (initialSetupTimeInput) initialSetupTimeInput.value = preset.initialSetupTime;
                    if (overheadFactorInput) overheadFactorInput.value = preset.managementOverheadFactor;

                    // Update calculations with new values
                    updateCalculations();

                    // Highlight the selected card
                    projectPresetCards.forEach(c => c.classList.remove('selected'));
                    this.classList.add('selected');
                }
            });
        });

        // Set up AWS calculator specific event listeners
        const awsInputElements = document.querySelectorAll('.aws-controls input, .aws-controls select');
        awsInputElements.forEach(element => {
            element.addEventListener('change', calculateAwsRunCost);
            element.addEventListener('input', function() {
                // Update labels for range inputs
                if (this.id === 'awsOutputToInputRatio') {
                    const ratio = parseFloat(this.value);
                    const outputPercentage = Math.round(ratio * 100 / (ratio + 1));
                    const inputPercentage = 100 - outputPercentage;
                    const outputToInputRatioLabel = getElement('awsOutputToInputRatioLabel');
                    if (outputToInputRatioLabel) {
                        outputToInputRatioLabel.textContent = `${ratio}:1 (${outputPercentage}% output / ${inputPercentage}% input)`;
                    }
                } else if (this.id === 'awsCachedTokenPercentage') {
                    const percentage = this.value;
                    const cachedTokenPercentageLabel = getElement('awsCachedTokenPercentageLabel');
                    if (cachedTokenPercentageLabel) {
                        cachedTokenPercentageLabel.textContent = `${percentage}%`;
                    }
                }

                // For model select, show/hide custom pricing
                if (this.id === 'awsModelSelect') {
                    const customPricing = getElement('awsCustomPricing');
                    if (customPricing) {
                        customPricing.style.display = this.value === 'custom' ? 'block' : 'none';
                    }
                }

                // Update calculations on input change
                calculateAwsRunCost();
            });
        });

        // Set up AWS calculate button
        const calculateAwsButton = getElement('calculateAws');
        if (calculateAwsButton) {
            calculateAwsButton.addEventListener('click', calculateAwsRunCost);
        }

        // Set up AWS ratio preset buttons
        const awsRatioPresetButtons = document.querySelectorAll('.aws-controls .preset-button');
        awsRatioPresetButtons.forEach(button => {
            button.addEventListener('click', function() {
                const ratio = this.getAttribute('data-ratio');
                if (ratio) {
                    // Update the range input value
                    const awsOutputToInputRatio = getElement('awsOutputToInputRatio');
                    if (awsOutputToInputRatio) {
                        awsOutputToInputRatio.value = ratio;

                        // Update the label
                        const outputPercentage = Math.round(parseFloat(ratio) * 100 / (parseFloat(ratio) + 1));
                        const inputPercentage = 100 - outputPercentage;
                        const awsOutputToInputRatioLabel = getElement('awsOutputToInputRatioLabel');
                        if (awsOutputToInputRatioLabel) {
                            awsOutputToInputRatioLabel.textContent = `${ratio}:1 (${outputPercentage}% output / ${inputPercentage}% input)`;
                        }
                    }

                    // Remove active class from all buttons and add to clicked button
                    awsRatioPresetButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');

                    // Calculate AWS costs
                    calculateAwsRunCost();
                }
            });
        });

        // Set initial default values from config.js
        const tokenCostMultiplierInput = getElement('tokenCostMultiplier');
        const tokenCostMultiplierLabel = getElement('tokenCostMultiplierLabel');
        if (tokenCostMultiplierInput && defaultValues) {
            tokenCostMultiplierInput.value = defaultValues.tokenCostMultiplier;
            if (tokenCostMultiplierLabel) {
                tokenCostMultiplierLabel.textContent = `${defaultValues.tokenCostMultiplier}x`;
            }
        }

        // Initialize calculations
        setTimeout(() => {
            // Select the Tiny project preset by default for the project cost calculator
            const tinyPresetCard = document.querySelector('.project-preset-card[data-preset="tiny"]');
            if (tinyPresetCard) {
                // Manually trigger the click event handler instead of using click()
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                tinyPresetCard.dispatchEvent(event);
                tinyPresetCard.classList.add('selected');
            } else {
                // Run initial calculations if Tiny preset not found
                updateCalculations();
            }

            // Initialize project cost calculator
        }, 200); // Small delay to ensure DOM is fully ready
    } catch (error) {
        console.error('Error in initialization:', error);
    }
});
